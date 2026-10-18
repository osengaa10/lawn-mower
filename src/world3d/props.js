// Low-poly toys and scenery: trees, rocks, ramps, houses, power-ups,
// the balloon, presents and sprinklers. Anything without a model is an emoji cutout.
import { THREE } from './renderer.js';
import { makeEmoji, makeShadow } from './sprites.js';
import { RAMP, hillHeight, mulberry32 } from '../terrain.js';
import { YARD } from './ground.js';

const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const flat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- scenery ----------

export function makeTree(h = 2.4, leaf = '#43a047') {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(h * 0.07, h * 0.09, h * 0.45, 7), flat('#795548'), 0, h * 0.22, 0));
  const leaves = flat(leaf);
  for (const [x, y, z, r] of [[0, 0.62, 0, 0.36], [-0.2, 0.5, 0.08, 0.26], [0.22, 0.52, -0.05, 0.27], [0.02, 0.82, 0, 0.24]])
    g.add(mesh(new THREE.IcosahedronGeometry(h * r, 0), leaves, x * h, y * h, z * h));
  return g;
}

export function makePine(h = 2.6, leaf = '#2e7d32') {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(h * 0.06, h * 0.07, h * 0.3, 6), flat('#6d4c41'), 0, h * 0.15, 0));
  const m = flat(leaf);
  for (const [y, r, hh] of [[0.38, 0.32, 0.42], [0.6, 0.25, 0.36], [0.8, 0.17, 0.3]])
    g.add(mesh(new THREE.ConeGeometry(h * r, h * hh, 7), m, 0, h * y, 0));
  return g;
}

export function makeRock(r = 1, color = '#90a4ae') {
  const m = mesh(new THREE.DodecahedronGeometry(r, 0), flat(color), 0, r * 0.45, 0);
  m.scale.set(1.15, 0.75, 1);
  m.rotation.y = Math.random() * 6;
  return m;
}

// An obstacle on the lawn. Returns a group whose `wobbler` child shakes when bumped.
export function makeObstacle(o, theme) {
  const g = new THREE.Group();
  let w = null;
  const r = o.gr;
  if (o.kind === 'pond') {
    const duck = makeEmoji(theme.id === 'moon' ? '🐙' : '🦆', r * 0.9);
    g.add(duck);
    g.userData.duck = duck;
    return g;
  }
  if (o.kind === '🌳') w = makeTree(r * 2.6, theme.id === 'sunset' ? '#7cb342' : theme.id === 'night' ? '#1b5e20' : '#43a047');
  else if (o.kind === '🌲') w = makePine(r * 2.8, theme.id === 'night' ? '#1b4d2c' : '#2e7d32');
  else if (o.kind === '🪨') w = makeRock(r * 0.95);
  else if (o.kind === '🌑') w = makeRock(r * 0.95, '#757575');
  else w = makeEmoji(o.kind, r * 2.3);
  g.add(makeShadow(r * 2.2, r * 1.8, 0.8));
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

let plankTex = null;
function planks() {
  if (plankTex) return plankTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#d7a35a' : '#c99146';
    g.fillRect(0, (i * 128) / 6, 128, 128 / 6 + 1);
  }
  // a big arrow so it's clear which way to go
  g.fillStyle = '#ffeb3b';
  g.strokeStyle = '#f57f17';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(20, 34);
  g.lineTo(64, 64);
  g.lineTo(20, 94);
  g.lineTo(20, 78);
  g.lineTo(42, 64);
  g.lineTo(20, 50);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(62, 34);
  g.lineTo(106, 64);
  g.lineTo(62, 94);
  g.lineTo(62, 78);
  g.lineTo(84, 64);
  g.lineTo(62, 50);
  g.closePath();
  g.fill();
  g.stroke();
  plankTex = new THREE.CanvasTexture(c);
  plankTex.colorSpace = THREE.SRGBColorSpace;
  return plankTex;
}

export function makeRamp(rp, hills) {
  const g = new THREE.Group();
  const { len, wid, h } = RAMP;
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, 0);
  shape.lineTo(len / 2, 0);
  shape.lineTo(len / 2, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: wid, bevelEnabled: false });
  geo.translate(0, 0, -wid / 2);
  g.add(mesh(geo, lambert('#a1712f')));
  const slope = Math.hypot(len, h);
  const topGeo = new THREE.PlaneGeometry(slope, wid).rotateX(-Math.PI / 2).rotateZ(Math.atan2(h, len));
  g.add(mesh(topGeo, lambert('#ffffff', { map: planks() }), 0, h / 2 + 0.01, 0));
  g.add(makeShadow(len * 1.2, wid * 1.2, 0.6));
  g.position.set(rp.gx, hillHeight(hills, rp.gx, rp.gy), rp.gy);
  g.rotation.y = -rp.a;
  return g;
}

// ---------- houses ----------

const HOUSE = {
  day: { wall: '#fff3e0', roof: '#e53935', door: '#8d6e63', trim: '#ffffff' },
  sunset: { wall: '#c62828', roof: '#5d4037', door: '#ffffff', trim: '#ffffff' },
  night: { wall: '#8d6e63', roof: '#37474f', door: '#4e342e', trim: '#5d4037' },
  candy: { wall: '#c68642', roof: '#ff80ab', door: '#ff4081', trim: '#ffffff' },
  moon: { wall: '#e0e0e0', roof: '#b0bec5', door: '#7e57c2', trim: '#80deea' },
};

// A house facing +z, about 5 wide. The owner stands by the door.
export function makeHouse(themeId, owner) {
  const S = HOUSE[themeId] || HOUSE.day;
  const g = new THREE.Group();
  const glow = themeId === 'night' || themeId === 'moon';
  const winMat = glow ? new THREE.MeshBasicMaterial({ color: '#ffe082' }) : lambert('#81d4fa');
  if (themeId === 'moon') {
    g.add(mesh(new THREE.SphereGeometry(2.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lambert(S.wall)));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), lambert('#90a4ae'), 0.8, 2.9, 0));
    g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff5252' }), 0.8, 3.7, 0));
    g.add(mesh(new THREE.BoxGeometry(1, 1.5, 0.3), lambert(S.door), 0, 0.75, 2.2));
    for (const x of [-1.4, 1.4]) g.add(mesh(new THREE.CircleGeometry(0.35, 16), winMat, x, 1.1, 1.75 + 0.06));
  } else {
    g.add(mesh(new THREE.BoxGeometry(4.6, 2.6, 3.4), lambert(S.wall), 0, 1.3, 0));
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.7, 0);
    roofShape.lineTo(2.7, 0);
    roofShape.lineTo(0, 1.9);
    roofShape.closePath();
    const roof = mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 3.8, bevelEnabled: false }).translate(0, 0, -1.9), flat(S.roof), 0, 2.6, 0);
    g.add(roof);
    g.add(mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), flat(S.roof), 1.4, 3.6, -0.4));
    g.add(mesh(new THREE.BoxGeometry(1, 1.7, 0.1), lambert(S.door), 0, 0.85, 1.72));
    g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), lambert('#ffd54f'), 0.3, 0.85, 1.8));
    for (const x of [-1.5, 1.5]) {
      g.add(mesh(new THREE.BoxGeometry(0.95, 0.85, 0.1), lambert(S.trim), x, 1.5, 1.71));
      g.add(mesh(new THREE.BoxGeometry(0.75, 0.65, 0.12), winMat, x, 1.5, 1.72));
    }
    if (themeId === 'candy') {
      const dots = ['#ff5252', '#40c4ff', '#ffd740', '#69f0ae'];
      for (let i = 0; i < 8; i++)
        g.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), lambert(dots[i % 4]), -2 + i * 0.57, 2.65, 1.95));
    }
  }
  if (owner) {
    const o = makeEmoji(owner.e, 1.5);
    o.position.set(-1.0, 0, 2.6);
    g.add(o);
    g.userData.owner = o;
  }
  g.add(makeShadow(6.5, 5, 0.5));
  return g;
}

// ---------- the yard around the lawn ----------

export function makeYard(lawn) {
  const g = new THREE.Group();
  const { cols, rows, theme, def } = lawn;
  const rng = mulberry32(lawn.seed + 11);
  const house = makeHouse(theme.id, def.owner);
  house.position.set(cols / 2, hillHeight(lawn.hills, cols / 2, -4.6), -4.6);
  g.add(house);
  g.userData.house = house;
  const step = 2.7;
  const treeKind = { day: 'tree', sunset: 'tree', night: 'pine' }[theme.id];
  let trees = 0;
  for (let z = -YARD + 1; z < rows + YARD - 1; z += step)
    for (let x = -YARD + 1; x < cols + YARD - 1; x += step) {
      if (rng() > 0.42) continue;
      const px = x + (rng() - 0.5) * step * 0.8;
      const pz = z + (rng() - 0.5) * step * 0.8;
      if (px > -1.6 && px < cols + 1.6 && pz > -1.6 && pz < rows + 1.6) continue;
      // keep the house and the path to it clear
      if (Math.abs(px - cols / 2) < 4.5 && pz < -1 && pz > -8.5) continue;
      let o;
      if (treeKind && trees < 14 && rng() < 0.35) {
        trees++;
        o = treeKind === 'pine' ? makePine(2.2 + rng() * 1.4) : makeTree(2 + rng() * 1.2, theme.id === 'sunset' ? (rng() < 0.5 ? '#ef6c00' : '#7cb342') : '#43a047');
        o.add(makeShadow(1.8, 1.4, 0.6));
      } else {
        o = makeEmoji(theme.decor[(rng() * theme.decor.length) | 0], 1.3 + rng() * 1.1);
      }
      o.position.set(px, 0, pz);
      g.add(o);
    }
  return g;
}

// ---------- power-ups and surprises ----------

function glowRing(color) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  m.position.y = 0.05;
  return m;
}

export function makePowerup(kind) {
  const g = new THREE.Group();
  const item = new THREE.Group();
  if (kind === 'giant') {
    item.add(mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 12), lambert('#fff8e1'), 0, 0.25, 0));
    item.add(mesh(new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#e53935', shininess: 80 }), 0, 0.42, 0));
    const white = lambert('#ffffff');
    for (const [a, e] of [[0, 0.5], [2.1, 0.6], [4.2, 0.55], [1, 1.2], [3.2, 1.1], [5.2, 1.25]]) {
      const d = mesh(new THREE.SphereGeometry(0.1, 8, 6), white);
      d.position.setFromSphericalCoords(0.53, e, a);
      d.position.y += 0.42;
      d.scale.set(1, 0.5, 1);
      d.lookAt(0, 0.42, 0);
      item.add(d);
    }
  } else if (kind === 'turbo') {
    const s = new THREE.Shape();
    s.moveTo(0.1, 0.6);
    s.lineTo(-0.3, 0);
    s.lineTo(-0.02, 0);
    s.lineTo(-0.15, -0.6);
    s.lineTo(0.32, 0.1);
    s.lineTo(0.04, 0.1);
    s.closePath();
    const bolt = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }).translate(0, 0, -0.08), new THREE.MeshPhongMaterial({ color: '#ffeb3b', emissive: '#ff8f00', emissiveIntensity: 0.5, shininess: 90 }), 0, 0.6, 0);
    item.add(bolt);
  } else {
    item.add(mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshPhongMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.55, shininess: 120, specular: 0xffffff }), 0, 0.6, 0));
    item.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), -0.18, 0.78, 0.35));
    const s2 = mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshPhongMaterial({ color: '#f8bbd0', transparent: true, opacity: 0.55 }), 0.45, 1.05, 0);
    item.add(s2);
  }
  g.add(item, glowRing(kind === 'giant' ? '#ff5252' : kind === 'turbo' ? '#ffd740' : '#80d8ff'));
  g.userData.item = item;
  return g;
}

function stripeTexture(colors) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const g = c.getContext('2d');
  colors.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect((i * 128) / colors.length, 0, 128 / colors.length + 1, 8);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeBalloon(themeId) {
  const g = new THREE.Group();
  if (themeId === 'moon') {
    // a friendly flying saucer instead
    const disc = mesh(new THREE.SphereGeometry(1.6, 24, 12), new THREE.MeshPhongMaterial({ color: '#b0bec5', shininess: 90 }), 0, 0, 0);
    disc.scale.set(1, 0.3, 1);
    g.add(disc);
    g.add(mesh(new THREE.SphereGeometry(0.8, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#80deea', transparent: true, opacity: 0.7 }), 0, 0.3, 0));
    const alien = makeEmoji('👽', 0.9);
    alien.position.y = 0.2;
    g.add(alien);
    const lights = ['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: lights[i % 4] }), Math.cos(a) * 1.45, -0.05, Math.sin(a) * 1.45));
    }
    return g;
  }
  const colors = themeId === 'candy' ? ['#ff80ab', '#ffffff', '#80d8ff', '#ffffff'] : ['#e53935', '#ffeb3b', '#1e88e5', '#ffeb3b', '#43a047', '#ffeb3b'];
  const ball = mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshLambertMaterial({ map: stripeTexture(colors) }), 0, 2.2, 0);
  ball.scale.set(1, 1.15, 1);
  g.add(ball);
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), lambert('#8d6e63'), 0, 0, 0));
  const rope = new THREE.LineBasicMaterial({ color: '#5d4037' });
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.3, z), new THREE.Vector3(x * 2, 1.2, z * 2)]);
    g.add(new THREE.Line(geo, rope));
  }
  const pilot = makeEmoji('🐻', 0.7);
  pilot.position.y = 0.25;
  g.add(pilot);
  return g;
}

export function makePresent() {
  const g = new THREE.Group();
  const colors = ['#e53935', '#8e24aa', '#1e88e5', '#43a047'];
  const c = colors[(Math.random() * colors.length) | 0];
  const box = new THREE.Group();
  box.add(mesh(new THREE.BoxGeometry(1, 0.85, 1), new THREE.MeshPhongMaterial({ color: c, shininess: 60 }), 0, 0.425, 0));
  const rib = lambert('#ffeb3b');
  box.add(mesh(new THREE.BoxGeometry(1.02, 0.87, 0.2), rib, 0, 0.425, 0));
  box.add(mesh(new THREE.BoxGeometry(0.2, 0.87, 1.02), rib, 0, 0.425, 0));
  for (const s of [-1, 1]) {
    const bow = mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12), rib, s * 0.15, 0.95, 0);
    bow.rotation.y = Math.PI / 2;
    bow.rotation.x = s * 0.5;
    box.add(bow);
  }
  g.add(makeShadow(1.4, 1.4, 0.7), box);
  g.userData.box = box;
  return g;
}

export function makeSprinkler() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10), lambert('#78909c'), 0, 0.25, 0));
  const head = new THREE.Group();
  head.add(mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), lambert('#ffeb3b'), 0, 0, 0));
  head.position.y = 0.52;
  g.add(head);
  g.userData.head = head;
  return g;
}

export function makeHintRing() {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.45, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }),
  );
  return m;
}
