// Houses for every world, built from simple shapes with painted textures:
// a cottage (day), a red barn (sunset), a log cabin (night), a gingerbread
// house (candy) and a dome base (moon). Each lawn number n picks its own
// colors and extras, so the street isn't a row of identical houses.
// A house faces +z and is about 5 wide. The owner stands by the door.
import { THREE, toy } from './renderer.js';
import { makeShadow } from './sprites.js';
import { hasAnimalModel, makeAnimal } from './animals.js';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '../terrain.js';

// ---------- textures (all drawn light grey so the material color tints them) ----------

const texCache = new Map();
function tex(key, w, h, draw) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// 1 texture repeat = 1 unit of wall
const siding = () =>
  tex('siding', 64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const y = (i * h) / 5;
      const gr = g.createLinearGradient(0, y, 0, y + h / 5);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#dcdcdc');
      g.fillStyle = gr;
      g.fillRect(0, y, w, h / 5);
      g.fillStyle = '#b8b8b8';
      g.fillRect(0, y + h / 5 - 2, w, 2);
    }
  });

const boards = () =>
  tex('boards', 64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8c8c8';
    for (let i = 0; i < 4; i++) g.fillRect((i * w) / 4, 0, 2, h);
  });

const logs = () =>
  tex('logs', 64, 64, (g, w, h) => {
    for (let i = 0; i < 3; i++) {
      const y = (i * h) / 3;
      const gr = g.createLinearGradient(0, y, 0, y + h / 3);
      gr.addColorStop(0, '#bdbdbd');
      gr.addColorStop(0.35, '#ffffff');
      gr.addColorStop(1, '#8a8a8a');
      g.fillStyle = gr;
      g.fillRect(0, y, w, h / 3);
    }
  });

const shingles = () =>
  tex('shingles', 64, 64, (g, w, h) => {
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, w, h);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      for (let i = -1; i < 5; i++) {
        const x = i * 16 + (r % 2 ? 8 : 0);
        g.fillStyle = (i + r) % 3 ? '#ffffff' : '#ececec';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 15, y);
        g.lineTo(x + 15, y + h / rows - 4);
        g.quadraticCurveTo(x + 7.5, y + h / rows + 2, x, y + h / rows - 4);
        g.fill();
      }
    }
  });

const bricks = () =>
  tex('bricks', 64, 64, (g, w, h) => {
    g.fillStyle = '#d6d6d6';
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++)
      for (let i = -1; i < 4; i++) {
        g.fillStyle = (i * 7 + r * 3) % 4 ? '#ffffff' : '#eeeeee';
        g.fillRect(i * 20 + (r % 2 ? 10 : 0) + 1, r * 8 + 1, 18, 6);
      }
  });

const stones = () =>
  tex('stones', 64, 64, (g, w, h) => {
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, w, h);
    const rng = mulberry32(3);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `hsl(0,0%,${78 + rng() * 22}%)`;
      g.beginPath();
      g.ellipse(rng() * w, rng() * h, 6 + rng() * 5, 4 + rng() * 3, rng(), 0, Math.PI * 2);
      g.fill();
    }
  });

const garagePanels = () =>
  tex('garage', 64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c4c4c4';
    g.lineWidth = 2;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.strokeRect(c * 16 + 2, r * 16 + 2, 12, 12);
  });

const domePanels = () =>
  tex('dome', 128, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9c9d6';
    g.lineWidth = 2;
    for (let i = 0; i <= 12; i++) {
      g.beginPath();
      g.moveTo((i * w) / 12, 0);
      g.lineTo((i * w) / 12, h);
      g.stroke();
    }
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, (i * h) / 4);
      g.lineTo(w, (i * h) / 4);
      g.stroke();
    }
  });

const candyStripes = () =>
  tex('candy', 32, 32, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff4f8b';
    for (let i = -2; i < 3; i++) {
      g.beginPath();
      g.moveTo(i * 16, h);
      g.lineTo(i * 16 + 8, h);
      g.lineTo(i * 16 + 8 + h, 0);
      g.lineTo(i * 16 + h, 0);
      g.fill();
    }
  });

// ---------- building blocks ----------

// A box whose texture repeats once per `unit` of real size on every face.
function boxGeo(w, h, d, unit = 1) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // faces: +x, -x, +y, -y, +z, -z with 4 vertices each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / unit, (uv.getY(i) * dims[f][1]) / unit);
    }
  return geo;
}

function add(g, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

const rounded = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);

// A triangle (or barn-shaped) gable end, extruded front to back.
function gableGeo(w, rh, d, gambrel = false) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  if (gambrel) {
    s.lineTo(w * 0.36, rh * 0.62);
    s.lineTo(0, rh);
    s.lineTo(-w * 0.36, rh * 0.62);
  } else s.lineTo(0, rh);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
}

// A roof slab from (x0, y0) up to (x1, y1) in the x/y plane, running front to back.
function slab(g, mat, x0, y0, x1, y1, depth, thick = 0.14) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const m = add(g, boxGeo(len, thick, depth, 1.2), mat, (x0 + x1) / 2, (y0 + y1) / 2, 0);
  m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  // lift so the underside sits on the line
  m.translateY(thick / 2);
  return m;
}

function window_(g, S, x, y, z, w = 0.85, h = 0.75, { shutters = false, box = false, round = false, rng = Math.random } = {}) {
  const frame = toy(S.trim, { rough: 0.5 });
  if (round) {
    add(g, new THREE.TorusGeometry(w / 2, 0.06, 8, 24), frame, x, y, z + 0.02);
    add(g, new THREE.CircleGeometry(w / 2, 24), S.glass, x, y, z + 0.01);
    add(g, new THREE.BoxGeometry(0.04, w, 0.03), frame, x, y, z + 0.03);
    add(g, new THREE.BoxGeometry(w, 0.04, 0.03), frame, x, y, z + 0.03);
    return;
  }
  add(g, rounded(w + 0.16, h + 0.16, 0.08, 0.03), frame, x, y, z + 0.02);
  add(g, new THREE.PlaneGeometry(w, h), S.glass, x, y, z + 0.065);
  add(g, new THREE.BoxGeometry(0.04, h, 0.04), frame, x, y, z + 0.08);
  add(g, new THREE.BoxGeometry(w, 0.04, 0.04), frame, x, y, z + 0.08);
  add(g, rounded(w + 0.3, 0.07, 0.18, 0.02), frame, x, y - h / 2 - 0.1, z + 0.08);
  if (shutters) {
    const sh = toy(S.shutter, { rough: 0.55 });
    for (const s of [-1, 1]) add(g, boxGeo(0.26, h + 0.1, 0.05, 0.5), sh, x + s * (w / 2 + 0.24), y, z + 0.03);
  }
  if (box) {
    add(g, rounded(w + 0.1, 0.18, 0.22, 0.03), toy('#8d6e63', { rough: 0.8 }), x, y - h / 2 - 0.24, z + 0.14);
    const colors = S.flowers;
    for (let i = 0; i < 5; i++) {
      const b = add(g, new THREE.IcosahedronGeometry(0.09, 1), toy(colors[(rng() * colors.length) | 0], { rough: 0.5 }), x - w / 2 + 0.1 + (i * (w - 0.2)) / 4, y - h / 2 - 0.1, z + 0.15);
      b.scale.y = 0.8;
    }
  }
}

function door(g, S, x, z, { w = 0.95, h = 1.75, barn = false } = {}) {
  const frame = toy(S.trim, { rough: 0.5 });
  const y0 = 0.28;
  add(g, rounded(w + 0.2, h + 0.12, 0.08, 0.03), frame, x, y0 + h / 2 + 0.06, z + 0.02);
  const d = toy(S.door, { rough: 0.45 });
  add(g, rounded(w, h, 0.1, 0.03), d, x, y0 + h / 2, z + 0.05);
  if (barn) {
    // white X braces
    for (const s of [-1, 1]) {
      const b = add(g, new THREE.BoxGeometry(Math.hypot(w, h) * 0.92, 0.08, 0.04), frame, x, y0 + h / 2, z + 0.12);
      b.rotation.z = s * Math.atan2(h, w);
    }
    add(g, new THREE.BoxGeometry(w, 0.08, 0.04), frame, x, y0 + h / 2, z + 0.12);
  } else {
    for (const py of [0.3, 0.68]) add(g, rounded(w * 0.62, h * 0.26, 0.04, 0.02), toy(S.door, { rough: 0.6 }), x, y0 + h * py, z + 0.11);
    add(g, new THREE.SphereGeometry(0.06, 12, 8), toy('#ffd54f', { rough: 0.2, metal: 0.9 }), x + w * 0.32, y0 + h * 0.48, z + 0.14);
  }
}

function chimney(g, S, x, y, z, h = 1.4) {
  const m = S.chimney === 'stone' ? toy('#ffffff', { rough: 0.95, map: stones() }) : toy(S.chimney || '#b5653f', { rough: 0.9, map: bricks() });
  add(g, boxGeo(0.55, h, 0.55, 0.8), m, x, y + h / 2, z);
  add(g, rounded(0.7, 0.14, 0.7, 0.03), toy('#616161', { rough: 0.8 }), x, y + h + 0.05, z);
}

function porch(g, S, x, z, w, wallH) {
  const floor = toy(S.porch || '#a1887f', { rough: 0.8, map: boards() });
  add(g, boxGeo(w, 0.25, 1.1, 0.8), floor, x, 0.125, z + 0.55);
  add(g, boxGeo(w * 0.5, 0.13, 0.45, 0.8), floor, x, 0.065, z + 1.32);
  const post = S.candy ? toy('#ffffff', { rough: 0.3, map: candyStripes() }) : toy(S.trim, { rough: 0.5 });
  for (const s of [-1, 1]) {
    if (S.candy) add(g, new THREE.CylinderGeometry(0.07, 0.07, wallH * 0.82, 12), post, x + s * (w / 2 - 0.15), 0.25 + wallH * 0.41, z + 1.0);
    else add(g, rounded(0.14, wallH * 0.82, 0.14, 0.03), post, x + s * (w / 2 - 0.15), 0.25 + wallH * 0.41, z + 1.0);
  }
  const roof = add(g, rounded(w + 0.3, 0.12, 1.35, 0.04), toy(S.roof, { rough: 0.7 }), x, 0.25 + wallH * 0.84, z + 0.62);
  roof.rotation.x = 0.18;
}

// ---------- the looks for each world ----------

function style(themeId, rng) {
  const p = (list) => list[(rng() * list.length) | 0];
  const dark = themeId === 'night' || themeId === 'moon';
  const glass = dark
    ? toy('#ffcc66', { rough: 0.3, emissive: '#ffb84d', emissiveIntensity: 1.1 })
    : toy('#8fc9ea', { rough: 0.05, metal: 0.3 });
  switch (themeId) {
    case 'sunset':
      return { kind: 'barn', wall: p(['#c62828', '#b3261e', '#cf4a2a']), roof: p(['#5d4037', '#455a64', '#4e342e']), trim: '#ffffff', door: '#a62420', shutter: '#ffffff', glass, wallTex: boards, flowers: ['#ffca28', '#ff7043', '#ffffff'] };
    case 'night':
      return { kind: 'cabin', wall: p(['#9c6b45', '#8d5f3c', '#a87a50']), roof: p(['#37474f', '#3e4a52', '#4e342e']), trim: '#5d4037', door: '#4e342e', shutter: '#33691e', glass, wallTex: logs, chimney: 'stone', porch: '#795548', flowers: ['#b39ddb', '#90caf9', '#ffffff'] };
    case 'candy':
      return { kind: 'ginger', wall: p(['#c68642', '#b8763a', '#d09050']), roof: p(['#ff80ab', '#ffffff', '#80d8ff', '#ce93d8']), trim: '#ffffff', door: p(['#ff4081', '#40c4ff', '#69f0ae']), shutter: '#ff80ab', glass, wallTex: null, candy: true, chimney: '#ff80ab', porch: '#ffd6e8', flowers: ['#ff4081', '#40c4ff', '#ffd740'] };
    case 'moon':
      return { kind: 'dome', wall: p(['#e0e0ec', '#d6dbe8', '#ece4f4']), roof: '#b0bec5', trim: '#80deea', door: p(['#7e57c2', '#5c6bc0', '#26a69a']), glass };
    default:
      return { kind: 'cottage', wall: p(['#fff3e0', '#e3f2fd', '#fff9c4', '#f1f8e9', '#fce4ec']), roof: p(['#e53935', '#1e88e5', '#6d4c41', '#546e7a']), trim: '#ffffff', door: p(['#8d6e63', '#1565c0', '#c62828', '#2e7d32']), shutter: p(['#1565c0', '#2e7d32', '#455a64', '#8d6e63']), glass, wallTex: siding, flowers: ['#ff5252', '#ffeb3b', '#ff80ab', '#ffffff'] };
  }
}

function pitchedHouse(g, S, rng) {
  const W = 4.3 + rng() * 0.7;
  const H = 2.4 + rng() * 0.4;
  const D = 3.4;
  const barn = S.kind === 'barn';
  const rh = barn ? 2.1 : 1.6 + rng() * 0.5;
  const over = 0.3;
  const wall = toy(S.wall, { rough: 0.8, map: S.wallTex ? S.wallTex() : null });

  // foundation and walls
  add(g, boxGeo(W + 0.16, 0.28, D + 0.16, 0.8), toy('#ffffff', { rough: 0.95, map: stones() }), 0, 0.14, 0);
  add(g, boxGeo(W, H, D), wall, 0, 0.28 + H / 2, 0);
  add(g, gableGeo(W, rh, D, barn), wall, 0, 0.28 + H, 0);

  // roof
  const roofMat = toy(S.roof, { rough: 0.75, map: S.candy ? null : shingles() });
  const top = 0.28 + H;
  const ey = top - over * (rh / (W / 2));
  const depth = D + over * 2;
  if (barn) {
    const kx = W * 0.36;
    const ky = top + rh * 0.62;
    for (const s of [-1, 1]) {
      slab(g, roofMat, s * (W / 2 + over * 0.6), top - 0.2, s * kx, ky, depth);
      slab(g, roofMat, s * kx, ky, 0, top + rh + 0.05, depth);
    }
  } else {
    for (const s of [-1, 1]) slab(g, roofMat, s * (W / 2 + over), ey, 0, top + rh + 0.08, depth);
    add(g, rounded(0.22, 0.16, depth + 0.04, 0.05), toy(S.candy ? '#ffffff' : S.roof, { rough: 0.6 }), 0, top + rh + 0.12, 0);
  }

  // trim boards along the front gable
  const trim = toy(S.trim, { rough: 0.5 });
  if (!barn)
    for (const s of [-1, 1]) {
      const len = Math.hypot(W / 2, rh);
      const t = add(g, new THREE.BoxGeometry(len, 0.12, 0.06), trim, (s * W) / 4, top + rh / 2 - 0.02, D / 2 + 0.04);
      t.rotation.z = -s * Math.atan2(rh, W / 2);
    }
  for (const x of [-W / 2, W / 2]) add(g, new THREE.BoxGeometry(0.12, H, 0.12), trim, x, 0.28 + H / 2, D / 2);

  const front = D / 2;
  const doorX = barn ? 0 : rng() < 0.5 ? 0 : (rng() < 0.5 ? -1 : 1) * W * 0.18;
  door(g, S, doorX, front, barn ? { w: 1.5, h: 1.9, barn: true } : {});
  const winY = 0.28 + H * 0.58;
  const shutters = S.kind !== 'ginger' && rng() < 0.7;
  const box = S.flowers && rng() < 0.6;
  for (const s of [-1, 1]) {
    const x = s * W * 0.32;
    if (Math.abs(x - doorX) < 1.1) continue;
    window_(g, S, x, winY, front, 0.85, 0.75, { shutters, box, rng });
  }
  // a window up in the gable
  if (barn) window_(g, S, 0, top + rh * 0.42, front, 0.8, 0.6, { rng });
  else window_(g, S, 0, top + rh * 0.4, front, Math.min(0.6, rh * 0.45), 0, { round: true });
  // side windows
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    window_(w, S, 0, winY, 0, 0.75, 0.7, { rng });
    w.rotation.y = s * Math.PI / 2;
    w.position.x = s * W / 2;
    g.add(w);
  }

  if (!barn && rng() < 0.85) chimney(g, S, (rng() < 0.5 ? -1 : 1) * W * 0.25, top + rh * 0.35, -D * 0.15, rh * 0.7 + 0.5);
  if (S.kind === 'cabin' || (S.kind !== 'barn' && rng() < 0.45)) porch(g, S, doorX, front, 1.9, H);
  else if (!barn) add(g, boxGeo(1.4, 0.18, 0.5, 0.8), toy('#bdbdbd', { rough: 0.9, map: stones() }), doorX, 0.09, front + 0.3);

  // a garage on one side
  if (S.kind === 'cottage' && rng() < 0.4) {
    const side = rng() < 0.5 ? -1 : 1;
    const gw = 2.2;
    const gh = H * 0.85;
    const gx = side * (W / 2 + gw / 2);
    add(g, boxGeo(gw, gh, D - 0.4, 1), wall, gx, 0.14 + gh / 2, -0.2);
    const gr = add(g, boxGeo(gw + 0.3, 0.14, D, 1.2), roofMat, gx, 0.14 + gh + 0.1, -0.2);
    gr.rotation.z = side * -0.12;
    add(g, boxGeo(gw * 0.78, gh * 0.75, 0.06, gw * 0.78), toy('#ffffff', { rough: 0.6, map: garagePanels() }), gx, 0.14 + (gh * 0.75) / 2, D / 2 - 0.37);
    add(g, boxGeo(gw * 0.9, 0.04, 1.8, 1), toy('#bdbdbd', { rough: 0.95 }), gx, 0.02, D / 2 + 0.7);
  }

  if (S.candy) {
    // icing drips along the eaves, gumdrops on the ridge, candy trim
    const icing = toy('#ffffff', { rough: 0.35 });
    for (const s of [-1, 1])
      for (let i = 0; i < 9; i++) {
        const z = -depth / 2 + 0.2 + (i * (depth - 0.4)) / 8;
        const b = add(g, new THREE.SphereGeometry(0.12, 10, 8), icing, s * (W / 2 + over - 0.05), ey - 0.05, z);
        b.scale.y = 1.5;
      }
    const drops = ['#ff5252', '#40c4ff', '#ffd740', '#69f0ae'];
    for (let i = 0; i < 6; i++) {
      const z = -depth / 2 + 0.4 + (i * (depth - 0.8)) / 5;
      const gd = add(g, new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toy(drops[i % 4], { rough: 0.2 }), 0, top + rh + 0.15, z);
      gd.scale.y = 1.4;
    }
    for (let i = 0; i < 8; i++) {
      const x = -W / 2 + 0.3 + (i * (W - 0.6)) / 7;
      add(g, new THREE.SphereGeometry(0.11, 10, 8), toy(drops[i % 4], { rough: 0.2 }), x, 0.3, D / 2 + 0.08);
    }
  }
  if (S.kind === 'cabin') {
    // a lantern by the door
    add(g, rounded(0.18, 0.26, 0.18, 0.04), toy('#ffcc66', { emissive: '#ffb84d', emissiveIntensity: 1.6 }), doorX + 0.85, 1.6, front + 0.12);
  }
  return { W, D };
}

function domeHouse(g, S, rng) {
  const wall = toy(S.wall, { rough: 0.35, metal: 0.2, map: domePanels() });
  add(g, new THREE.CylinderGeometry(2.55, 2.65, 0.3, 40), toy('#9e9eb8', { rough: 0.8 }), 0, 0.15, 0);
  add(g, new THREE.SphereGeometry(2.4, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), wall, 0, 0.28, 0);
  // airlock tunnel with the door
  const tube = add(g, new THREE.CylinderGeometry(0.85, 0.85, 1.4, 28).rotateX(Math.PI / 2), wall, 0, 0.95, 2.2);
  tube.scale.y = 1.1;
  add(g, new THREE.TorusGeometry(0.85, 0.08, 10, 32), toy(S.trim, { rough: 0.3 }), 0, 0.95, 2.92);
  add(g, rounded(0.9, 1.35, 0.1, 0.12), toy(S.door, { rough: 0.35 }), 0, 0.9, 2.9);
  add(g, new THREE.BoxGeometry(0.5, 0.06, 0.04), toy(S.trim, { emissive: S.trim, emissiveIntensity: 0.8 }), 0, 1.25, 2.97);
  // round windows that glow
  for (const a of [-0.75, 0.75]) {
    const x = Math.sin(a) * 2.35;
    const z = Math.cos(a) * 2.35;
    const w = add(g, new THREE.CircleGeometry(0.38, 24), S.glass, x, 1.25, z);
    w.lookAt(x * 2, 1.25, z * 2);
    const r = add(g, new THREE.TorusGeometry(0.38, 0.06, 8, 24), toy(S.trim, { rough: 0.3 }), x, 1.25, z);
    r.lookAt(x * 2, 1.25, z * 2);
  }
  // antenna with a blinking light
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), toy('#90a4ae', { rough: 0.3, metal: 0.7 }), 0.9, 3.0, -0.4);
  const blink = add(g, new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff5252', toneMapped: false }), 0.9, 3.85, -0.4);
  g.userData.blink = blink;
  // a solar panel on a stand
  const side = rng() < 0.5 ? -1 : 1;
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), toy('#90a4ae', { rough: 0.3, metal: 0.7 }), side * 3.3, 0.6, 0.2);
  const panel = add(g, new THREE.BoxGeometry(1.6, 0.06, 1.0), toy('#283593', { rough: 0.15, metal: 0.5 }), side * 3.3, 1.25, 0.2);
  panel.rotation.x = -0.6;
  // sometimes a little dome next door
  if (rng() < 0.5) {
    add(g, new THREE.SphereGeometry(1.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), wall, -side * 2.9, 0, -0.9);
    const link = add(g, new THREE.CylinderGeometry(0.45, 0.45, 1.2, 20).rotateZ(Math.PI / 2), wall, -side * 2.1, 0.5, -0.5);
    link.rotation.y = side * 0.35;
  }
  return { W: 4.8, D: 4.8 };
}

export function makeHouse(themeId, owner, n = 0) {
  const rng = mulberry32(n * 131 + 7);
  const S = style(themeId, rng);
  const g = new THREE.Group();
  if (S.kind === 'dome') domeHouse(g, S, rng);
  else pitchedHouse(g, S, rng);
  if (owner) {
    const o = makeAnimal(owner.e, hasAnimalModel(owner.e) ? 1.9 : 1.5);
    o.root.position.set(-1.0, 0, S.kind === 'dome' ? 3.4 : 2.6);
    g.add(o.root);
    g.userData.owner = o;
  }
  g.add(makeShadow(6.5, 5, 0.5, true));
  return g;
}
