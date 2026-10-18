// The yard around each lawn and the things that sit on it: fences, bushes,
// trees for every world, and a little 3D model for each kind of obstacle.
// Everything is built from simple shapes with shared painted-toy materials.
import { THREE, toy } from './renderer.js';
import { makeEmoji, makeShadow } from './sprites.js';
import { makePine, makeRock, makeTree } from './props.js';
import { makeHouse } from './houses.js';
import { makeAnimal } from './animals.js';
import { YARD } from './ground.js';
import { hillHeight, mulberry32 } from '../terrain.js';

const shared = (g) => {
  g.userData.shared = true;
  return g;
};
const BALL = shared(new THREE.IcosahedronGeometry(1, 3));
const HALF = shared(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
const CYL = shared(new THREE.CylinderGeometry(1, 1, 1, 20));
const CONE = shared(new THREE.ConeGeometry(1, 1, 20));
const BOX = shared(new THREE.BoxGeometry(1, 1, 1));
const UP = new THREE.Vector3(0, 1, 0);

// A shape scaled from one of the unit geometries above.
function part(geo, mat, x, y, z, sx, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

const canvasTex = new Map();
function texture(key, w, h, draw) {
  let t = canvasTex.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  canvasTex.set(key, t);
  return t;
}

const candyStripes = () =>
  texture('candy', 64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff4f8b';
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 24, h);
      g.lineTo(i * 24 + 12, h);
      g.lineTo(i * 24 + 12 + h, 0);
      g.lineTo(i * 24 + h, 0);
      g.fill();
    }
  });

const swirl = (a, b) =>
  texture(`swirl${a}${b}`, 128, 128, (g) => {
    g.fillStyle = a;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = b;
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    for (let t = 0; t < 22; t += 0.05) g.lineTo(64 + Math.cos(t) * t * 2.7, 64 + Math.sin(t) * t * 2.7);
    g.stroke();
  });

const waffle = () =>
  texture('waffle', 64, 64, (g) => {
    g.fillStyle = '#e0a458';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#b97a35';
    g.lineWidth = 4;
    for (let i = -64; i < 128; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 64, 64);
      g.moveTo(i + 64, 0);
      g.lineTo(i, 64);
      g.stroke();
    }
  });

const bands = (key, colors) =>
  texture(key, 8, 64, (g) => {
    colors.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, (i * 64) / colors.length, 8, 64 / colors.length + 1);
    });
  });

// ---------- yard pieces ----------

// How each world dresses up its yard.
const STYLE = {
  day: { fence: 'picket', bush: ['#4caf50', '#66bb6a'], flowers: ['#ff5252', '#ffeb3b', '#ff80ab', '#ffffff'] },
  sunset: { fence: 'rail', bush: ['#8bc34a', '#9ccc65'], flowers: ['#ff7043', '#ffca28', '#fff3e0'] },
  night: { fence: 'hedge', bush: ['#2e6b3a', '#336f40'], flowers: ['#b39ddb', '#90caf9', '#ffffff'] },
  candy: { fence: 'candy', bush: ['#ff80ab', '#80d8ff', '#ffd740', '#b9f6ca'], flowers: ['#ff4081', '#40c4ff', '#ffd740'] },
  moon: { fence: null, bush: null, flowers: null },
};

// A rounded bush (or gumdrops in candy land, or a few rocks on the moon).
export function makeShrub(themeId, s = 1, rng = Math.random) {
  const g = new THREE.Group();
  const S = STYLE[themeId] || STYLE.day;
  if (themeId === 'moon') {
    for (let i = 0; i < 3; i++) {
      const r = makeRock(s * (0.35 + rng() * 0.3), i % 2 ? '#8e8aa8' : '#a7a3c2');
      r.position.set((rng() - 0.5) * s * 1.2, 0, (rng() - 0.5) * s);
      g.add(r);
    }
    return g;
  }
  if (themeId === 'candy') {
    for (let i = 0; i < 3; i++) {
      const c = S.bush[(rng() * S.bush.length) | 0];
      const r = s * (0.35 + rng() * 0.15);
      g.add(part(HALF, toy(c, { rough: 0.25 }), (i - 1) * s * 0.55, 0, (rng() - 0.5) * s * 0.4, r, r * 1.3, r));
    }
    return g;
  }
  const leaf = toy(S.bush[(rng() * S.bush.length) | 0], { rough: 0.9 });
  for (const [x, y, z, r] of [[0, 0.42, 0, 0.55], [-0.48, 0.32, 0.12, 0.42], [0.48, 0.32, -0.06, 0.44], [0.1, 0.3, 0.38, 0.36]])
    g.add(part(BALL, leaf, x * s, y * s, z * s, r * s, r * s * 0.9, r * s));
  return g;
}

// A tree that suits the world (a lollipop in candy land, a rock pile on the moon).
export function makeYardTree(themeId, h = 2.6, rng = Math.random) {
  if (themeId === 'night') return makePine(h * 1.1, rng() < 0.5 ? '#1b4d2c' : '#22603a');
  if (themeId === 'sunset') return makeTree(h, ['#ef6c00', '#7cb342', '#f9a825'][(rng() * 3) | 0]);
  if (themeId === 'candy') return makeLollipop(h, rng);
  if (themeId === 'moon') {
    const g = new THREE.Group();
    const big = makeRock(h * 0.32, '#9e9ab8');
    g.add(big, makeShrub('moon', h * 0.45, rng));
    return g;
  }
  return makeTree(h, rng() < 0.5 ? '#43a047' : '#4caf50');
}

export function makeLollipop(h = 2.6, rng = Math.random) {
  const g = new THREE.Group();
  const [a, b] = [['#ff4081', '#ffffff'], ['#40c4ff', '#ffffff'], ['#ffd740', '#ff6e40'], ['#b388ff', '#ffffff']][(rng() * 4) | 0];
  g.add(part(CYL, toy('#ffffff', { rough: 0.4 }), 0, h * 0.35, 0, h * 0.035, h * 0.7, h * 0.035));
  const r = h * 0.3;
  const capMat = toy('#ffffff', { rough: 0.2, map: swirl(a, b) });
  const disc = new THREE.Mesh(CYL, [toy(a, { rough: 0.2 }), capMat, capMat]);
  disc.scale.set(r, r * 0.3, r);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = h * 0.7 + r * 0.6;
  g.add(disc);
  return g;
}

// A straight run of fence from (x0, z0) to (x1, z1).
export function makeFence(style, x0, z0, x1, z1) {
  const g = new THREE.Group();
  const len = Math.hypot(x1 - x0, z1 - z0);
  g.position.set(x0, 0, z0);
  g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  const posts = Math.max(2, Math.round(len / 2.4) + 1);
  const step = len / (posts - 1);
  if (style === 'hedge') {
    // a neatly trimmed hedge
    g.add(part(BOX, toy('#2b6236', { rough: 0.95 }), len / 2, 0.42, 0, len, 0.84, 0.7));
    return g;
  }
  const wood = style === 'picket' ? toy('#ffffff', { rough: 0.7 }) : style === 'candy' ? toy('#ffffff', { rough: 0.3, map: candyStripes() }) : toy('#a1764a', { rough: 0.85 });
  const rail = style === 'candy' ? toy('#ff80ab', { rough: 0.3 }) : wood;
  for (let i = 0; i < posts; i++) {
    if (style === 'candy') g.add(part(CYL, wood, i * step, 0.55, 0, 0.09, 1.1, 0.09));
    else g.add(part(BOX, wood, i * step, 0.5, 0, 0.16, 1.0, 0.16));
  }
  for (const y of style === 'picket' ? [0.3, 0.68] : [0.38, 0.78]) g.add(part(BOX, rail, len / 2, y, style === 'picket' ? -0.06 : 0, len, 0.09, 0.06));
  if (style === 'picket') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.07, 0);
    shape.lineTo(0.07, 0);
    shape.lineTo(0.07, 0.8);
    shape.lineTo(0, 0.92);
    shape.lineTo(-0.07, 0.8);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    const n = Math.floor(len / 0.32);
    const inst = new THREE.InstancedMesh(geo, wood, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) inst.setMatrixAt(i, m.makeTranslation((i + 0.5) * (len / n), 0, 0));
    g.add(inst);
  }
  return g;
}

// A small round bed of flowers.
export function makeFlowerBed(themeId, r = 0.9, rng = Math.random, n = Math.round(r * 9)) {
  const g = new THREE.Group();
  const S = STYLE[themeId] || STYLE.day;
  g.add(part(CYL, toy('#6d4c41', { rough: 1 }), 0, 0.06, 0, r, 0.12, r * 0.8));
  const stem = toy('#43a047', { rough: 0.8 });
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * r * 0.75;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d * 0.8;
    const h = 0.3 + rng() * 0.25;
    g.add(part(CYL, stem, x, h / 2, z, 0.025, h, 0.025));
    g.add(part(BALL, toy(S.flowers[(rng() * S.flowers.length) | 0], { rough: 0.5 }), x, h + 0.06, z, 0.11, 0.13, 0.11));
  }
  return g;
}

// ---------- obstacles ----------

function ribbed(r, ribs = 8, depth = 0.08) {
  const geo = new THREE.SphereGeometry(r, 32, 16);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 - depth * Math.pow(Math.abs(Math.sin((a * ribs) / 2)), 3);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function pumpkin(r) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(ribbed(r, 10, 0.12), toy('#fb8c00', { rough: 0.5 }));
  body.scale.y = 0.72;
  body.position.y = r * 0.68;
  const stem = part(CYL, toy('#6d4c41', { rough: 0.9 }), 0, r * 1.36, 0, r * 0.1, r * 0.35, r * 0.1);
  stem.rotation.z = 0.25;
  g.add(body, stem);
  return g;
}

function sunflower(h, rng) {
  const g = new THREE.Group();
  const green = toy('#558b2f', { rough: 0.8 });
  g.add(part(CYL, green, 0, h / 2, 0, 0.06, h, 0.06));
  for (const s of [-1, 1]) {
    const l = part(BALL, green, s * 0.22, h * 0.45, 0, 0.26, 0.05, 0.12);
    l.rotation.z = s * 0.4;
    g.add(l);
  }
  const head = new THREE.Group();
  const petals = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const rr = i % 2 ? 0.34 : 0.55;
    if (i === 0) petals.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else petals.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  head.add(new THREE.Mesh(new THREE.ExtrudeGeometry(petals, { depth: 0.04, bevelEnabled: false }), toy('#ffc107', { rough: 0.5 })));
  head.add(part(CYL, toy('#5d4037', { rough: 0.9 }), 0, 0, 0.05, 0.28, 0.08, 0.28).rotateX(Math.PI / 2));
  head.position.y = h;
  head.rotation.x = -0.5;
  head.rotation.y = (rng() - 0.5) * 0.6;
  g.add(head);
  return g;
}

function tulip(h, color) {
  const g = new THREE.Group();
  g.add(part(CYL, toy('#43a047', { rough: 0.8 }), 0, h / 2, 0, 0.04, h, 0.04));
  const cup = new THREE.Mesh(ribbed(0.17, 3, 0.25), toy(color, { rough: 0.45 }));
  cup.scale.y = 1.4;
  cup.position.y = h + 0.12;
  g.add(cup);
  return g;
}

function mushroom(r) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.38, r * 1.1, 20), toy('#fff3e0', { rough: 0.7 }));
  stem.position.y = r * 0.55;
  const cap = part(HALF, toy('#e53935', { rough: 0.35 }), 0, r * 0.95, 0, r, r * 0.7, r);
  g.add(stem, cap);
  const dot = toy('#ffffff', { rough: 0.5 });
  for (const [a, e] of [[0, 0.5], [1.3, 0.8], [2.6, 0.45], [3.9, 0.85], [5.1, 0.55], [0.6, 1.25], [3.2, 1.2]]) {
    const v = new THREE.Vector3().setFromSphericalCoords(1, e, a);
    const d = part(BALL, dot, v.x * r, r * 0.95 + v.y * r * 0.7, v.z * r, r * 0.13, r * 0.04, r * 0.13);
    d.quaternion.setFromUnitVectors(UP, v.set(v.x, v.y / 0.7, v.z).normalize());
    g.add(d);
  }
  return g;
}

function tent(r) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(0, r * 1.25);
  s.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: r * 1.7, bevelEnabled: false }).translate(0, 0, -r * 0.85), toy('#ff7043', { rough: 0.8 }));
  g.add(body);
  const door = new THREE.Shape();
  door.moveTo(-r * 0.38, 0);
  door.lineTo(r * 0.38, 0);
  door.lineTo(0, r * 0.85);
  door.closePath();
  const d = new THREE.Mesh(new THREE.ShapeGeometry(door), toy('#4e342e', { rough: 1 }));
  d.position.z = r * 0.86;
  g.add(d);
  g.add(part(CYL, toy('#8d6e63'), 0, r * 1.3, r * 0.86, 0.04, 0.3, 0.04));
  return g;
}

function cake(r) {
  const g = new THREE.Group();
  const icing = toy('#ffffff', { rough: 0.4 });
  g.add(part(CYL, toy('#f8bbd0', { rough: 0.5 }), 0, r * 0.32, 0, r, r * 0.64, r));
  g.add(part(CYL, toy('#fff8e1', { rough: 0.5 }), 0, r * 0.88, 0, r * 0.66, r * 0.5, r * 0.66));
  for (const [y, rr] of [[r * 0.64, r], [r * 1.13, r * 0.66]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(rr, r * 0.07, 8, 40), icing);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    g.add(t);
  }
  const flame = new THREE.MeshBasicMaterial({ color: '#ffca28' });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * r * 0.4;
    const z = Math.sin(a) * r * 0.4;
    g.add(part(CYL, toy(['#40c4ff', '#ffd740', '#69f0ae'][i % 3]), x, r * 1.28, z, 0.05, r * 0.3, 0.05));
    g.add(part(CONE, flame, x, r * 1.5, z, 0.05, 0.13, 0.05));
  }
  return g;
}

function iceCream(r) {
  const g = new THREE.Group();
  const cone = part(CONE, toy('#ffffff', { rough: 0.7, map: waffle() }), 0, r * 0.75, 0, r * 0.48, r * 1.5, r * 0.48);
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.add(part(BALL, toy('#a5d6a7', { rough: 0.6 }), 0, r * 1.62, 0, r * 0.52));
  g.add(part(BALL, toy('#f48fb1', { rough: 0.6 }), 0, r * 2.15, 0, r * 0.45));
  g.add(part(BALL, toy('#d50000', { rough: 0.2 }), 0, r * 2.66, 0, r * 0.12));
  return g;
}

function donut(r) {
  const g = new THREE.Group();
  const dough = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, r * 0.36, 20, 40), toy('#e0a458', { rough: 0.7 }));
  dough.rotation.x = Math.PI / 2;
  dough.position.y = r * 0.36;
  const frost = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, r * 0.33, 20, 40, Math.PI * 2), toy('#ff80ab', { rough: 0.3 }));
  frost.rotation.x = Math.PI / 2;
  frost.scale.z = 0.7;
  frost.position.y = r * 0.48;
  g.add(dough, frost);
  const colors = ['#ffffff', '#ffeb3b', '#40c4ff', '#69f0ae', '#7c4dff'];
  const rng = mulberry32(5);
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.42 + rng() * 0.4);
    const s = part(BOX, toy(colors[i % colors.length], { rough: 0.4 }), Math.cos(a) * d, r * 0.72, Math.sin(a) * d, 0.16, 0.04, 0.05);
    s.rotation.y = rng() * 6;
    g.add(s);
  }
  return g;
}

function planet(r) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(BALL, toy('#ffffff', { rough: 0.6, map: bands('planet', ['#ffb74d', '#ffe0b2', '#ff8a65', '#ffcc80', '#ffab91']) }));
  ball.scale.setScalar(r * 0.8);
  ball.position.y = r * 0.8;
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.05, r * 1.45, 48), toy('#d1c4e9', { rough: 0.5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2 + 0.45;
  ring.position.y = r * 0.8;
  g.add(ball, ring);
  return g;
}

function satellite(r) {
  const g = new THREE.Group();
  const leg = toy('#90a4ae', { rough: 0.4, metal: 0.6 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(part(CYL, leg, x * r * 0.3, r * 0.25, z * r * 0.3, 0.04, r * 0.5, 0.04));
  g.add(part(BOX, toy('#ffc107', { rough: 0.25, metal: 0.8 }), 0, r * 0.75, 0, r * 0.7, r * 0.6, r * 0.7));
  const panel = toy('#1e3a8a', { rough: 0.2, metal: 0.4 });
  for (const s of [-1, 1]) {
    g.add(part(CYL, leg, s * r * 0.55, r * 0.8, 0, 0.03, r * 0.4, 0.03).rotateZ(Math.PI / 2));
    g.add(part(BOX, panel, s * r * 1.15, r * 0.8, 0, r * 0.8, 0.04, r * 0.55));
  }
  const dish = part(HALF, toy('#eceff1', { rough: 0.3, side: THREE.DoubleSide }), 0, r * 1.25, 0, r * 0.35, r * 0.15, r * 0.35);
  dish.rotation.x = Math.PI;
  dish.position.y = r * 1.35;
  g.add(dish, part(CYL, leg, 0, r * 1.2, 0, 0.03, r * 0.2, 0.03));
  return g;
}

function stoneHead(r) {
  const g = new THREE.Group();
  const stone = toy('#8d8a9e', { rough: 0.95 });
  g.add(part(BOX, stone, 0, r * 0.85, 0, r * 0.9, r * 1.7, r * 0.75));
  g.add(part(BOX, stone, 0, r * 1.25, r * 0.4, r * 0.95, r * 0.18, r * 0.2));
  g.add(part(BOX, stone, 0, r * 0.95, r * 0.45, r * 0.22, r * 0.5, r * 0.25));
  g.add(part(BOX, stone, 0, r * 0.45, r * 0.38, r * 0.7, r * 0.22, r * 0.12));
  return g;
}

function tulipBed(r, rng) {
  const g = makeFlowerBed('day', r * 0.9, rng, 0);
  const colors = ['#e53935', '#ff80ab', '#ffeb3b', '#ab47bc'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const d = i === 0 ? 0 : r * 0.5;
    const t = tulip(0.6 + rng() * 0.35, colors[i % colors.length]);
    t.position.set(i === 0 ? 0 : Math.cos(a) * d, 0, i === 0 ? 0 : Math.sin(a) * d * 0.8);
    g.add(t);
  }
  return g;
}

// The 3D model for an obstacle kind, or null to fall back to an emoji.
function obstacleModel(kind, r, theme) {
  const rng = mulberry32(Math.round(r * 1000) + kind.codePointAt(0));
  switch (kind) {
    case '🌳': return makeTree(r * 2.6, theme.id === 'sunset' ? '#7cb342' : theme.id === 'night' ? '#1b5e20' : '#43a047');
    case '🌲': return makePine(r * 2.8, theme.id === 'night' ? '#1b4d2c' : '#2e7d32');
    case '🪨': return makeRock(r * 0.95);
    case '🌑': return makeRock(r * 0.95, '#757575');
    case '🌷': return tulipBed(r, rng);
    case '🎃': {
      const g = pumpkin(r * 0.75);
      const small = pumpkin(r * 0.42);
      small.position.set(r * 0.85, 0, r * 0.35);
      g.add(small);
      return g;
    }
    case '🌻': {
      const g = new THREE.Group();
      for (const [x, z, h] of [[0, 0, 2.1], [-0.55, 0.4, 1.6], [0.55, 0.35, 1.8]]) {
        const f = sunflower(h * r * 0.85, rng);
        f.position.set(x * r, 0, z * r);
        g.add(f);
      }
      return g;
    }
    case '🍄': return mushroom(r * 1.05);
    case '🏕️': return tent(r * 1.05);
    case '🎂': return cake(r * 0.95);
    case '🍦': return iceCream(r * 0.9);
    case '🍭': return makeLollipop(r * 2.4, rng);
    case '🍩': return donut(r * 1.05);
    case '🪐': return planet(r);
    case '🛰️': return satellite(r * 0.9);
    case '🗿': return stoneHead(r * 1.05);
    default: return null;
  }
}

// An obstacle on the lawn. Returns a group whose `wobbler` child shakes when bumped.
export function makeObstacle(o, theme) {
  const g = new THREE.Group();
  const r = o.gr;
  if (o.kind === 'pond') {
    const duck = makeAnimal(theme.id === 'moon' ? '🐙' : '🦆', r * 0.9);
    g.add(duck.root);
    g.userData.duck = duck;
    return g;
  }
  let w = obstacleModel(o.kind, r, theme);
  let solid = !!w;
  if (!w) {
    // an animal (the sleeping dog), or an emoji cutout
    const actor = makeAnimal(o.kind, r * 1.4);
    actor.faceNow(1, 0.6);
    solid = actor.isModel;
    if (actor.isModel) {
      w = actor.root;
      g.userData.actor = actor;
    } else {
      w = actor.sprite; // a sprite wobbles by turning its picture
      w.scale.setScalar(r * 2.3);
    }
  }
  g.add(makeShadow(r * 2.2, r * 1.8, 0.8, solid));
  g.add(w);
  g.userData.wobbler = w;
  if (o.kind === '🐕') {
    const z = makeEmoji('💤', r * 0.7);
    z.position.set(r * 0.8, r * 1.6, 0);
    g.add(z);
    g.userData.zzz = z;
  }
  return g;
}

// ---------- the yard around the lawn ----------

// A tidy yard: the house with a path down to the lawn, a tree either side,
// a few clumps out at the corners and a fence around the back. The ring
// right around the lawn is left empty so the lawn stands out.
export function makeYard(lawn) {
  const g = new THREE.Group();
  const { cols, rows, theme, def } = lawn;
  const rng = mulberry32(lawn.seed + 11);
  const at = (o, x, z) => {
    o.position.set(x, hillHeight(lawn.hills, x, z), z);
    g.add(o);
    return o;
  };
  const house = at(makeHouse(theme.id, def.owner, def.n), cols / 2, -4.6);
  g.userData.house = house;

  for (const s of [-1, 1]) {
    const t = at(makeYardTree(theme.id, 2.6 + rng() * 0.6, rng), cols / 2 + s * (5.2 + rng() * 0.8), -5.4 - rng());
    t.add(makeShadow(1.8, 1.4, 0.6, true));
    if (STYLE[theme.id].flowers) at(makeFlowerBed(theme.id, 0.7, rng), cols / 2 + s * 2.9, -2.6);
  }

  // clumps of trees and bushes near the corners, well away from the lawn
  const corners = [[-6.5, -3], [cols + 6.5, -3], [-6, rows + 3.5], [cols + 6, rows + 3.5]];
  for (const [cx, cz] of corners) {
    if (rng() < 0.25) continue;
    const t = at(makeYardTree(theme.id, 2.2 + rng() * 1.2, rng), cx + (rng() - 0.5) * 2, cz + (rng() - 0.5) * 2);
    t.add(makeShadow(1.8, 1.4, 0.6, true));
    for (let i = 0; i < 2; i++) at(makeShrub(theme.id, 0.8 + rng() * 0.4, rng), cx + (rng() - 0.5) * 4, cz + 1.2 + rng() * 1.5);
  }

  const style = STYLE[theme.id].fence;
  if (style) {
    const back = -YARD + 1.2;
    const l = -5;
    const r = cols + 5;
    g.add(makeFence(style, l, back, r, back));
    g.add(makeFence(style, l, back, l, rows + 4));
    g.add(makeFence(style, r, back, r, rows + 4));
  }
  return g;
}
