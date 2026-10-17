import { DPR, drawEmoji, pick, shuffle } from './util.js';
import { STICKER_BY_ID } from './catalog.js';

export const OUT = 0;
export const TALL = 1;
export const CUT = 2;
export const BLOCK = 3;

const CELLS_PER_MOWER = 3;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lawn outline in grid units (0..cols, 0..rows).
function shapePath(shape, cols, rows) {
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

function scaledPath(path, scale, ox, oy) {
  const out = new Path2D();
  out.addPath(path, new DOMMatrix([scale, 0, 0, scale, ox, oy]));
  return out;
}

// Grid cell size that gives the mower a comfy, finger-sized look on this screen.
export function mowerCell(W, H) {
  return Math.max(110, Math.min(W, H) * 0.19) / CELLS_PER_MOWER;
}

export class Lawn {
  constructor(def, availW, availH, cellPx, surpriseKinds) {
    this.def = def;
    this.theme = def.theme;
    this.seed = Math.floor(Math.random() * 1e9);
    const rng = mulberry32(this.seed);

    // Size the grid as a fraction of what fits on screen at full mower size,
    // so fill = 1 is a lawn that covers the whole play area.
    const fullCols = Math.max(CELLS_PER_MOWER * 2, Math.floor(availW / cellPx));
    const fullRows = Math.max(CELLS_PER_MOWER * 2, Math.floor(availH / cellPx));
    const shaped = def.shape !== 'rect' && def.shape !== 'roundrect';
    // round/pointy shapes only fill part of their box, so give them a bigger box
    const fill = shaped ? Math.max(def.fill, 0.92) : def.fill;
    let cols = Math.max(CELLS_PER_MOWER * 2, Math.round(fullCols * fill));
    let rows = Math.max(CELLS_PER_MOWER * 2, Math.round(fullRows * fill));
    if (shaped) {
      // ...but don't stretch them so far they look squashed
      cols = Math.min(cols, Math.round(rows * 1.6));
      rows = Math.min(rows, Math.round(cols * 1.6));
    }
    this.cols = cols;
    this.rows = rows;

    this.path = shapePath(def.shape, cols, rows);
    const probe = document.createElement('canvas').getContext('2d');
    this.grid = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        // a cell counts if its middle or any point near its corners is inside, so pointy tips get grass too
        if ([[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].some(([dx, dy]) => probe.isPointInPath(this.path, c + dx, r + dy)))
          this.grid[r * cols + c] = TALL;

    const inside = [];
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === TALL) inside.push(i);

    // start on the left side, middle height
    let best = inside[0];
    let bestD = Infinity;
    for (const i of inside) {
      const c = i % cols;
      const r = (i / cols) | 0;
      const d = (c - cols * 0.12) ** 2 + (r - rows * 0.5) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.start = { gx: (best % cols) + 0.5, gy: ((best / cols) | 0) + 0.5 };

    // obstacles - well inside the lawn, away from the start and each other
    this.obstacles = [];
    const far = (gx, gy, list, d) => list.every((o) => (o.gx - gx) ** 2 + (o.gy - gy) ** 2 > d * d);
    const isInside = (gx, gy, rad) => {
      for (let a = 0; a < 8; a++) {
        const px = gx + Math.cos((a / 8) * Math.PI * 2) * (rad + 1.2);
        const py = gy + Math.sin((a / 8) * Math.PI * 2) * (rad + 1.2);
        if (!probe.isPointInPath(this.path, px, py)) return false;
      }
      return true;
    };
    for (let tries = 0; tries < 300 && this.obstacles.length < def.obstacles; tries++) {
      const kind = pick(this.theme.obstacles);
      const gr = kind === 'pond' ? 1.7 : 1.15;
      const gx = 2 + rng() * (cols - 4);
      const gy = 2 + rng() * (rows - 4);
      if (!isInside(gx, gy, gr)) continue;
      if ((gx - this.start.gx) ** 2 + (gy - this.start.gy) ** 2 < 36) continue;
      if (!far(gx, gy, this.obstacles, gr + 4.5)) continue;
      this.obstacles.push({ kind, gx, gy, gr, wobble: 0, x: 0, y: 0, r: 0 });
    }
    for (const o of this.obstacles) {
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if ((c + 0.5 - o.gx) ** 2 + (r + 0.5 - o.gy) ** 2 <= (o.gr + 0.2) ** 2 && this.grid[r * cols + c] === TALL)
            this.grid[r * cols + c] = BLOCK;
        }
    }

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

    this.plants = []; // flowers etc. that pop up and stay on the lawn
    this.bgLayer = document.createElement('canvas');
    this.tallLayer = document.createElement('canvas');
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
      surprises: [...this.surprises].map(([i, k]) => [i, k.type === 'star' ? '*' : k.s.id]),
      plants: this.plants.map(({ e, gx, gy }) => ({ e, gx, gy })),
    };
  }

  static restore(def, d) {
    if (!d || d.n !== def.n || !d.grid || d.grid.length !== d.cols * d.rows) return null;
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
    L.obstacles = d.obstacles.map((o) => ({ ...o, wobble: 0, x: 0, y: 0, r: 0 }));
    L.surprises = new Map();
    for (const [i, id] of d.surprises) {
      if (id === '*') L.surprises.set(i, { type: 'star' });
      else if (STICKER_BY_ID[id]) L.surprises.set(i, { type: 'sticker', s: STICKER_BY_ID[id] });
    }
    L.plants = d.plants.map((p) => ({ ...p, age: 10, ph: Math.random() * 6 }));
    L.bgLayer = document.createElement('canvas');
    L.tallLayer = document.createElement('canvas');
    return L;
  }

  get progress() {
    return this.total ? this.cutCount / this.total : 1;
  }

  layout(W, H, top, pad) {
    this.top = top;
    this.W = W;
    this.H = H;
    const availW = W - pad * 2;
    const availH = H - top - pad;
    this.cell = Math.min(availW / this.cols, availH / this.rows, mowerCell(W, H));
    this.ox = pad + (availW - this.cols * this.cell) / 2;
    this.oy = top + (availH - this.rows * this.cell) / 2;
    this.bounds = { x: this.ox, y: this.oy, w: this.cols * this.cell, h: this.rows * this.cell };
    this.mowerSize = this.cell * CELLS_PER_MOWER;
    this.cutRadius = this.cell * 1.75;
    this.pxPath = scaledPath(this.path, this.cell, this.ox, this.oy);
    for (const o of this.obstacles) {
      o.x = this.ox + o.gx * this.cell;
      o.y = this.oy + o.gy * this.cell;
      o.r = o.gr * this.cell;
    }
    this.renderBg();
    this.renderTall();
  }

  toPx(gx, gy) {
    return { x: this.ox + gx * this.cell, y: this.oy + gy * this.cell };
  }

  cellCenter(i) {
    return this.toPx((i % this.cols) + 0.5, ((i / this.cols) | 0) + 0.5);
  }

  renderBg() {
    const { W, H, theme, cell } = this;
    const c = this.bgLayer;
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
    const g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const rng = mulberry32(this.seed + 7);

    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(1, theme.bg[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // little dots/flowers/sprinkles on the ground
    const n = Math.floor((W * H) / 2200);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.25 + rng() * 0.45;
      g.fillStyle = theme.sprinkle[Math.floor(rng() * theme.sprinkle.length)];
      g.beginPath();
      g.arc(rng() * W, rng() * H, 1 + rng() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // lawn shadow + border
    g.save();
    g.translate(cell * 0.12, cell * 0.22);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fill(this.pxPath);
    g.restore();
    g.lineJoin = 'round';
    g.lineWidth = cell * 0.7;
    g.strokeStyle = theme.edge;
    g.stroke(this.pxPath);

    // mowed stripes (revealed as tall grass is cut)
    g.save();
    g.clip(this.pxPath);
    const landscape = this.cols >= this.rows;
    const stripe = cell * CELLS_PER_MOWER;
    const span = landscape ? this.cols * cell : this.rows * cell;
    for (let s = 0, k = 0; s < span + stripe; s += stripe, k++) {
      g.fillStyle = k % 2 ? theme.cutA : theme.cutB;
      if (landscape) g.fillRect(this.ox + s, this.oy, stripe + 1, this.rows * cell);
      else g.fillRect(this.ox, this.oy + s, this.cols * cell, stripe + 1);
    }
    // soft checker texture
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let r = 0; r < this.rows; r++)
      for (let cc = (r % 2); cc < this.cols; cc += 2) g.fillRect(this.ox + cc * cell, this.oy + r * cell, cell, cell);
    // ponds are flat, so they live in the background
    for (const o of this.obstacles) {
      if (o.kind !== 'pond') continue;
      g.fillStyle = '#8d6e63';
      g.beginPath();
      g.ellipse(o.x, o.y, o.r * 1.12, o.r * 0.95, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = theme.id === 'candy' ? '#80d8ff' : theme.id === 'moon' ? '#4fc3f7' : '#42a5f5';
      g.beginPath();
      g.ellipse(o.x, o.y, o.r, o.r * 0.83, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.35, o.r * 0.14, -0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // decorations around the lawn
    const step = Math.max(56, Math.min(W, H) / 7);
    const b = this.bounds;
    const marginBox = { x: b.x - cell * 0.9, y: b.y - cell * 0.9, w: b.w + cell * 1.8, h: b.h + cell * 1.8 };
    for (let y = step * 0.6; y < H; y += step) {
      for (let x = step * 0.5; x < W; x += step) {
        if (rng() > 0.55) continue;
        const px = x + (rng() - 0.5) * step * 0.6;
        const py = y + (rng() - 0.5) * step * 0.6;
        const sz = step * (0.42 + rng() * 0.3);
        const ex = sz * 0.65;
        if (px + ex > marginBox.x && px - ex < marginBox.x + marginBox.w && py + ex > marginBox.y && py - ex < marginBox.y + marginBox.h) continue;
        if (py - sz * 0.5 < this.top - 20) continue; // keep the HUD clear
        g.fillStyle = 'rgba(0,0,0,0.15)';
        g.beginPath();
        g.ellipse(px, py + sz * 0.4, sz * 0.4, sz * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        drawEmoji(g, theme.decor[Math.floor(rng() * theme.decor.length)], px, py, sz);
      }
    }
  }

  renderTall() {
    const { W, H, theme, cell, cols, rows } = this;
    const c = this.tallLayer;
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
    const g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.save();
    g.clip(this.pxPath);
    g.fillStyle = theme.tallBase;
    for (let r = 0; r < rows; r++)
      for (let cc = 0; cc < cols; cc++)
        if (this.grid[r * cols + cc] === TALL || this.grid[r * cols + cc] === BLOCK) g.fillRect(this.ox + cc * cell - 0.5, this.oy + r * cell - 0.5, cell + 1, cell + 1);

    // blades, batched by color so it's one stroke per color
    const paths = theme.blades.map(() => new Path2D());
    for (let r = 0; r < rows; r++)
      for (let cc = 0; cc < cols; cc++) {
        const v = this.grid[r * cols + cc];
        if (v !== TALL && v !== BLOCK) continue;
        const x0 = this.ox + cc * cell;
        const y0 = this.oy + r * cell;
        for (let k = 0; k < 6; k++) {
          const bx = x0 + Math.random() * cell;
          const by = y0 + cell * (0.7 + Math.random() * 0.4);
          const lean = (Math.random() - 0.5) * cell * 0.7;
          const hgt = cell * (0.7 + Math.random() * 0.5);
          const p = paths[(Math.random() * paths.length) | 0];
          p.moveTo(bx, by);
          p.quadraticCurveTo(bx + lean * 0.2, by - hgt * 0.6, bx + lean, by - hgt);
        }
      }
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.5, cell * 0.13);
    paths.forEach((p, i) => {
      g.strokeStyle = theme.blades[i];
      g.stroke(p);
    });
    g.restore();
    // round clearings around obstacles (instead of square holes)
    for (const o of this.obstacles) this.eraseTall(o.x, o.y, (o.gr + 0.2) * cell);
  }

  eraseTall(x, y, r) {
    const g = this.tallLayer.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  clearAllTall() {
    const g = this.tallLayer.getContext('2d');
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.tallLayer.width, this.tallLayer.height);
    g.restore();
  }

  // Cut everything within the mower's radius along a segment. Returns newly cut cell indices.
  mowSegment(x0, y0, x1, y1) {
    const R = this.cutRadius;
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / (R * 0.4)));
    const out = [];
    for (let s = 1; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      this.eraseTall(x, y, R);
      this.cutCircle(x, y, R, out);
    }
    return out;
  }

  cutCircle(x, y, R, out) {
    const { cols, rows, cell } = this;
    const gx = (x - this.ox) / cell;
    const gy = (y - this.oy) / cell;
    const Rg = R / cell;
    const r0 = Math.max(0, Math.floor(gy - Rg));
    const r1 = Math.min(rows - 1, Math.ceil(gy + Rg));
    const c0 = Math.max(0, Math.floor(gx - Rg));
    const c1 = Math.min(cols - 1, Math.ceil(gx + Rg));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (this.grid[i] !== TALL) continue;
        if ((c + 0.5 - gx) ** 2 + (r + 0.5 - gy) ** 2 <= Rg * Rg) {
          this.grid[i] = CUT;
          this.cutCount++;
          out.push(i);
        }
      }
  }

  cutCell(i) {
    if (this.grid[i] !== TALL) return false;
    this.grid[i] = CUT;
    this.cutCount++;
    const p = this.cellCenter(i);
    this.eraseTall(p.x, p.y, this.cell * 1.2);
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

  drawObstacles(ctx, t, dt) {
    for (const o of this.obstacles) {
      if (o.kind === 'pond') {
        drawEmoji(ctx, this.theme.id === 'moon' ? '🐙' : '🦆', o.x + Math.sin(t * 0.8) * o.r * 0.35, o.y + Math.cos(t * 0.6) * o.r * 0.2, o.r * 0.7);
        continue;
      }
      o.wobble = Math.max(0, o.wobble - dt * 2.5);
      const w = Math.sin(t * 30) * o.wobble * 0.15;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(o.x + o.r * 0.1, o.y + o.r * 0.7, o.r * 0.9, o.r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      drawEmoji(ctx, o.kind, o.x, o.y - o.r * 0.15, o.r * 2.1, w);
      if (o.kind === '🐕') drawEmoji(ctx, '💤', o.x + o.r * 0.8, o.y - o.r * 1.1 - Math.sin(t * 2) * 4, o.r * 0.7);
    }
  }

  drawPlants(ctx, t) {
    for (const p of this.plants) {
      const k = Math.min(1, p.age / 0.4);
      const s = this.cell * 1.6 * (k < 1 ? k * 1.2 : 1 + Math.sin(t * 3 + p.ph) * 0.04);
      const pos = this.toPx(p.gx, p.gy);
      drawEmoji(ctx, p.e, pos.x, pos.y - s * 0.3, s);
    }
  }
}
