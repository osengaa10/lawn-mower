import { pick, shuffle } from './util.js';
import { STICKER_BY_ID } from './catalog.js';
import { PICTURES } from './pictures.js';
import { RAMP, eventTrigger, groundHeight, makeHills, mulberry32, rampLocal } from './terrain.js';

export const OUT = 0;
export const TALL = 1;
export const CUT = 2;
export const BLOCK = 3;

// The mower is this many grid cells long. Everything on the lawn is measured in cells.
export const MOWER_CELLS = 3;
export const CUT_RADIUS = 1.75;

// Lawn outline in grid units (0..cols, 0..rows).
export function shapePath(shape, cols, rows) {
  const p = new Path2D();
  const cx = cols / 2;
  const cy = rows / 2;
  const m = 0.15;
  switch (shape) {
    case 'roundrect': {
      const r = Math.min(cols, rows) * 0.3;
      roundRect(p, m, m, cols - 2 * m, rows - 2 * m, r);
      break;
    }
    case 'oval':
      p.ellipse(cx, cy, cols / 2 - m, rows / 2 - m, 0, 0, Math.PI * 2);
      break;
    case 'heart': {
      const w = Math.min(cols - 2 * m, (rows - 2 * m) * 1.12);
      const h = w * 0.9;
      const x = cx - w / 2;
      const y = cy - h / 2;
      p.moveTo(x + w / 2, y + h * 0.28);
      p.bezierCurveTo(x + w / 2, y - h * 0.02, x, y - h * 0.02, x, y + h * 0.3);
      p.bezierCurveTo(x, y + h * 0.6, x + w / 2, y + h * 0.8, x + w / 2, y + h);
      p.bezierCurveTo(x + w / 2, y + h * 0.8, x + w, y + h * 0.6, x + w, y + h * 0.3);
      p.bezierCurveTo(x + w, y - h * 0.02, x + w / 2, y - h * 0.02, x + w / 2, y + h * 0.28);
      p.closePath();
      break;
    }
    case 'star': {
      const R = Math.min(cols, rows * 1.05) / 2 - m;
      const yc = cy + R * 0.08;
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? R : R * 0.55;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(a) * rr;
        const py = yc + Math.sin(a) * rr;
        if (i === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      }
      p.closePath();
      break;
    }
    case 'diamond':
      p.moveTo(cx, m);
      p.lineTo(cols - m, cy);
      p.lineTo(cx, rows - m);
      p.lineTo(m, cy);
      p.closePath();
      break;
    case 'plus': {
      const tw = cols * 0.42;
      const th = rows * 0.42;
      roundRect(p, m, cy - th / 2, cols - 2 * m, th, th * 0.3);
      roundRect(p, cx - tw / 2, m, tw, rows - 2 * m, tw * 0.3);
      break;
    }
    case 'cloud': {
      const s = Math.min(cols / 4.2, rows / 2.6);
      const blobs = [
        [-1.3, 0.2, 0.85], [-0.45, -0.25, 1.05], [0.55, -0.3, 1.0], [1.35, 0.2, 0.8], [0.0, 0.45, 0.9], [-0.9, 0.55, 0.65], [0.9, 0.55, 0.65],
      ];
      for (const [bx, by, br] of blobs) {
        p.moveTo(cx + bx * s + br * s, cy + by * s);
        p.arc(cx + bx * s, cy + by * s, br * s, 0, Math.PI * 2);
      }
      break;
    }
    default:
      roundRect(p, m, m, cols - 2 * m, rows - 2 * m, 0.8);
  }
  return p;
}

function roundRect(p, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

let probeCtx = null;
const probe = () => (probeCtx ||= document.createElement('canvas').getContext('2d'));

// The biggest box with the picture's proportions that fits well inside the lawn.
export function fitPictureBox(path, cols, rows, aspect) {
  const g = probe();
  const inside = (x, y) => g.isPointInPath(path, x, y);
  let best = null;
  for (const fy of [0.5, 0.42, 0.58]) {
    const cx = cols / 2;
    const cy = rows * fy;
    for (let h = Math.min(rows, cols / aspect) * 0.84; h > 1.5; h *= 0.94) {
      const w = h * aspect;
      const x0 = cx - w / 2 - 0.4;
      const y0 = cy - h / 2 - 0.4;
      const x1 = cx + w / 2 + 0.4;
      const y1 = cy + h / 2 + 0.4;
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const f = k / 4;
        pts.push([x0 + (x1 - x0) * f, y0], [x0 + (x1 - x0) * f, y1], [x0, y0 + (y1 - y0) * f], [x1, y0 + (y1 - y0) * f]);
      }
      if (pts.every(([x, y]) => inside(x, y))) {
        if (!best || h > best.h) best = { x: cx - w / 2, y: cy - h / 2, w, h };
        break;
      }
    }
  }
  return best || { x: cols * 0.3, y: rows * 0.3, w: cols * 0.4, h: rows * 0.4 };
}

export class Lawn {
  // portrait: lay the lawn out tall instead of wide, to suit a phone held upright
  constructor(def, portrait, surpriseKinds) {
    this.def = def;
    this.theme = def.theme;
    this.seed = Math.floor(Math.random() * 1e9);
    const rng = mulberry32(this.seed);
    const cols = portrait ? def.short : def.long;
    const rows = portrait ? def.long : def.short;
    this.cols = cols;
    this.rows = rows;

    this.path = shapePath(def.shape, cols, rows);
    const g = probe();
    const inPath = (x, y) => g.isPointInPath(this.path, x, y);
    this.grid = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        // a cell counts if its middle or any point near its corners is inside, so pointy tips get grass too
        if ([[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].some(([dx, dy]) => inPath(c + dx, r + dy)))
          this.grid[r * cols + c] = TALL;

    const inside = [];
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === TALL) inside.push(i);

    // start near the front-left, where the street is
    let best = inside[0];
    let bestD = Infinity;
    for (const i of inside) {
      const c = i % cols;
      const r = (i / cols) | 0;
      const d = (c - cols * 0.12) ** 2 + (r - rows * 0.6) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.start = { gx: (best % cols) + 0.5, gy: ((best / cols) | 0) + 0.5 };

    // obstacles - well inside the lawn, away from the start, each other and the middle of the picture
    const pic = fitPictureBox(this.path, cols, rows, PICTURES[def.picture]?.aspect || 1);
    const onPicture = (gx, gy, tries) =>
      tries < 150 && Math.abs(gx - (pic.x + pic.w / 2)) < pic.w * 0.32 && Math.abs(gy - (pic.y + pic.h / 2)) < pic.h * 0.32;
    this.obstacles = [];
    const far = (gx, gy, list, d) => list.every((o) => (o.gx - gx) ** 2 + (o.gy - gy) ** 2 > d * d);
    const isInside = (gx, gy, rad) => {
      for (let a = 0; a < 8; a++) {
        const px = gx + Math.cos((a / 8) * Math.PI * 2) * (rad + 1.2);
        const py = gy + Math.sin((a / 8) * Math.PI * 2) * (rad + 1.2);
        if (!inPath(px, py)) return false;
      }
      return true;
    };
    for (let tries = 0; tries < 300 && this.obstacles.length < def.obstacles; tries++) {
      const kind = pick(this.theme.obstacles);
      const gr = kind === 'pond' ? 1.7 : 1.15;
      const gx = 2 + rng() * (cols - 4);
      const gy = 2 + rng() * (rows - 4);
      if (!isInside(gx, gy, gr) || onPicture(gx, gy, tries)) continue;
      if ((gx - this.start.gx) ** 2 + (gy - this.start.gy) ** 2 < 36) continue;
      if (!far(gx, gy, this.obstacles, gr + 4.5)) continue;
      this.obstacles.push({ kind, gx, gy, gr });
    }

    // ramps - the mower can drive over these and fly off the end
    this.ramps = [];
    // (a second, looser pass so narrow shapes still get one)
    for (const loose of [false, true])
      for (let tries = 0; tries < 400 && this.ramps.length < def.ramps; tries++) {
        const gx = 2 + rng() * (cols - 4);
        const gy = 2 + rng() * (rows - 4);
        const a = (cols >= rows ? 0 : Math.PI / 2) + (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.7;
        if (!isInside(gx, gy, loose ? 0.6 : 1.3) || (!loose && onPicture(gx, gy, tries))) continue;
        if ((gx - this.start.gx) ** 2 + (gy - this.start.gy) ** 2 < (loose ? 12 : 25)) continue;
        if (!far(gx, gy, this.obstacles, loose ? 3.2 : 3.8) || !far(gx, gy, this.ramps, 6)) continue;
        this.ramps.push({ gx, gy, a });
      }

    this.markBlocked();
    this.hills = makeHills(this.seed, cols, rows, def.hills);

    this.total = 0;
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === TALL) this.total++;
    this.cutCount = 0;

    // hide surprises under tall grass, spread out
    this.surprises = new Map();
    const cand = shuffle(this.grid.reduce((a, v, i) => (v === TALL ? (a.push(i), a) : a), []));
    const placed = [];
    // small lawns get fewer surprises so they don't end up packed together
    const maxSurprises = Math.min(surpriseKinds.length, Math.max(3, Math.floor(this.total / 12)));
    // first try to spread them out; on small lawns relax the spacing so all of them fit
    for (const spacing of [9, 2, 0]) {
      for (const i of cand) {
        if (placed.length >= maxSurprises) break;
        if (this.surprises.has(i)) continue;
        const c = i % cols;
        const r = (i / cols) | 0;
        if (spacing && (c + 0.5 - this.start.gx) ** 2 + (r + 0.5 - this.start.gy) ** 2 < 9) continue;
        if (!placed.every((p) => (p.c - c) ** 2 + (p.r - r) ** 2 > spacing)) continue;
        placed.push({ c, r });
        this.surprises.set(i, surpriseKinds[placed.length - 1]);
      }
    }

    // power-ups sit on top of the grass where he can see them
    this.powerups = [];
    for (const kind of def.powerups) {
      for (const i of cand) {
        const gx = (i % cols) + 0.5;
        const gy = ((i / cols) | 0) + 0.5;
        if ((gx - this.start.gx) ** 2 + (gy - this.start.gy) ** 2 < 25) continue;
        if (!far(gx, gy, this.powerups, 6) || !far(gx, gy, this.ramps, 3.5) || !far(gx, gy, this.obstacles, 3)) continue;
        if (!isInside(gx, gy, 0)) continue;
        this.powerups.push({ kind, gx, gy, taken: false });
        break;
      }
    }

    this.eventDone = false;
    this.plants = []; // flowers etc. that pop up and stay on the lawn
    this.finishSetup();
  }

  // cells under obstacles and ramps don't count as grass
  markBlocked() {
    const { cols, rows } = this;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (this.grid[i] !== TALL) continue;
        const x = c + 0.5;
        const y = r + 0.5;
        if (this.obstacles.some((o) => (x - o.gx) ** 2 + (y - o.gy) ** 2 <= (o.gr + 0.2) ** 2)) this.grid[i] = BLOCK;
        else if (this.ramps.some((rp) => {
          const { u, v } = rampLocal(rp, x, y);
          return u > -0.3 && u < RAMP.len + 0.3 && Math.abs(v) < RAMP.wid / 2 + 0.3;
        })) this.grid[i] = OUT;
      }
  }

  // derived things that are rebuilt (not saved) when a lawn is restored
  finishSetup() {
    for (const o of this.obstacles) Object.assign(o, { x: o.gx, y: o.gy, r: o.gr, wobble: 0 });
    this.bounds = { x: 0, y: 0, w: this.cols, h: this.rows };
    this.eventAt = eventTrigger(this.seed);
    this.pictureBox = fitPictureBox(this.path, this.cols, this.rows, PICTURES[this.def.picture]?.aspect || 1);
    this.maxHeight = 0;
    for (let r = 0; r <= this.rows; r += 1)
      for (let c = 0; c <= this.cols; c += 1) this.maxHeight = Math.max(this.maxHeight, this.height(c, r));
  }

  // Everything needed to rebuild this exact lawn later (saved so a closed app resumes mid-lawn).
  serialize() {
    return {
      n: this.def.n,
      seed: this.seed,
      cols: this.cols,
      rows: this.rows,
      grid: this.grid.join(''),
      start: this.start,
      total: this.total,
      cutCount: this.cutCount,
      obstacles: this.obstacles.map(({ kind, gx, gy, gr }) => ({ kind, gx, gy, gr })),
      ramps: this.ramps,
      surprises: [...this.surprises].map(([i, k]) => [i, k.type === 'star' ? '*' : k.s.id]),
      plants: this.plants.map(({ e, gx, gy }) => ({ e, gx, gy })),
      powerups: this.powerups,
      eventDone: this.eventDone,
    };
  }

  static restore(def, d) {
    if (!d || d.v !== 2 || d.n !== def.n || !d.grid || d.grid.length !== d.cols * d.rows) return null;
    const L = Object.create(Lawn.prototype);
    L.def = def;
    L.theme = def.theme;
    L.seed = d.seed;
    L.cols = d.cols;
    L.rows = d.rows;
    L.path = shapePath(def.shape, d.cols, d.rows);
    L.grid = Uint8Array.from(d.grid, Number);
    L.start = d.start;
    L.total = d.total;
    L.cutCount = d.cutCount;
    L.obstacles = d.obstacles.map((o) => ({ ...o }));
    L.ramps = d.ramps || [];
    L.hills = makeHills(d.seed, d.cols, d.rows, def.hills);
    L.surprises = new Map();
    for (const [i, id] of d.surprises) {
      if (id === '*') L.surprises.set(i, { type: 'star' });
      else if (STICKER_BY_ID[id]) L.surprises.set(i, { type: 'sticker', s: STICKER_BY_ID[id] });
    }
    L.plants = d.plants.map((p) => ({ ...p, age: 10, ph: Math.random() * 6 }));
    L.powerups = (d.powerups || []).map((p) => ({ ...p }));
    L.eventDone = !!d.eventDone;
    L.finishSetup();
    return L;
  }

  get progress() {
    return this.total ? this.cutCount / this.total : 1;
  }

  height(x, z) {
    return groundHeight(this.hills, this.ramps, x, z);
  }

  inside(x, z) {
    return probe().isPointInPath(this.path, x, z);
  }

  cellCenter(i) {
    return { x: (i % this.cols) + 0.5, y: ((i / this.cols) | 0) + 0.5 };
  }

  // Cut everything within radius R along a segment. Returns newly cut cell indices.
  mowSegment(x0, y0, x1, y1, R = CUT_RADIUS) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / (R * 0.4)));
    const out = [];
    for (let s = 1; s <= steps; s++) this.cutCircle(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, R, out);
    return out;
  }

  cutCircle(gx, gy, R, out = []) {
    const { cols, rows } = this;
    const r0 = Math.max(0, Math.floor(gy - R));
    const r1 = Math.min(rows - 1, Math.ceil(gy + R));
    const c0 = Math.max(0, Math.floor(gx - R));
    const c1 = Math.min(cols - 1, Math.ceil(gx + R));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (this.grid[i] !== TALL) continue;
        if ((c + 0.5 - gx) ** 2 + (r + 0.5 - gy) ** 2 <= R * R) {
          this.grid[i] = CUT;
          this.cutCount++;
          out.push(i);
        }
      }
    return out;
  }

  cutCell(i) {
    if (this.grid[i] !== TALL) return false;
    this.grid[i] = CUT;
    this.cutCount++;
    return true;
  }

  tallCells() {
    const out = [];
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === TALL) out.push(i);
    return out;
  }

  nearestTall(x, y) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] !== TALL) continue;
      const p = this.cellCenter(i);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
}
