// Low-poly toys and scenery: trees, rocks, ramps, houses, power-ups,
// the balloon, presents and sprinklers. Anything without a model is an emoji cutout.
import { THREE, toy } from './renderer.js';
import { makeEmoji, makeShadow } from './sprites.js';
import { RAMP, hillHeight } from '../terrain.js';


function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- scenery ----------

// A lumpy ball: an icosphere nudged in and out a little, with lighter and
// darker patches painted into its vertex colors.
function blob(r, detail, bump, seed, shade = 0.18) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const col = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.7) * Math.sin(v.z * 3.3 + seed * 0.6);
    v.multiplyScalar(1 + n * bump);
    p.setXYZ(i, v.x, v.y, v.z);
    // brighter on top, a touch darker underneath
    const k = 1 + (v.y / r) * shade + n * 0.12;
    col.push(k, k, k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// A trunk that flares out at the roots.
function trunk(h, r) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(new THREE.Vector2(r * (1 + 0.7 * (1 - t) ** 3), t * h));
  }
  return new THREE.LatheGeometry(pts, 10);
}

export function makeTree(h = 2.4, leaf = '#43a047') {
  const g = new THREE.Group();
  g.add(mesh(trunk(h * 0.5, h * 0.06), toy('#7a5236', { rough: 0.9 }), 0, 0, 0));
  const leaves = toy(leaf, { rough: 0.85, vertexColors: true });
  const seed = h * 13.7;
  for (const [x, y, z, r] of [[0, 0.62, 0, 0.34], [-0.22, 0.52, 0.1, 0.25], [0.24, 0.54, -0.06, 0.26], [0.04, 0.82, 0.02, 0.24], [0.06, 0.55, 0.26, 0.22]])
    g.add(mesh(blob(h * r, 2, 0.12, seed + x * 10), leaves, x * h, y * h, z * h));
  return g;
}

export function makePine(h = 2.6, leaf = '#2e7d32') {
  const g = new THREE.Group();
  g.add(mesh(trunk(h * 0.32, h * 0.05), toy('#6d4c41', { rough: 0.9 }), 0, 0, 0));
  const m = toy(leaf, { rough: 0.85 });
  for (const [y, r, hh] of [[0.36, 0.33, 0.42], [0.58, 0.26, 0.37], [0.79, 0.18, 0.31]]) {
    // the tiers droop a little at the edge
    const geo = new THREE.ConeGeometry(h * r, h * hh, 14, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -h * hh * 0.45) p.setY(i, p.getY(i) - h * 0.03 * Math.sin(i * 1.7) ** 2);
    geo.computeVertexNormals();
    g.add(mesh(geo, m, 0, h * y, 0));
  }
  return g;
}

export function makeRock(r = 1, color = '#90a4ae') {
  const geo = new THREE.DodecahedronGeometry(r, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + Math.sin(p.getX(i) * 4.1) * Math.sin(p.getZ(i) * 3.3) * 0.12;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, toy(color, { rough: 0.95, flatShading: true }), 0, r * 0.42, 0);
  m.scale.set(1.15, 0.72, 1);
  m.rotation.y = Math.random() * 6;
  return m;
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
  g.add(mesh(geo, toy('#a1712f', { rough: 0.8 })));
  const slope = Math.hypot(len, h);
  const topGeo = new THREE.PlaneGeometry(slope, wid).rotateX(-Math.PI / 2).rotateZ(Math.atan2(h, len));
  g.add(mesh(topGeo, toy('#ffffff', { rough: 0.75, map: planks() }), 0, h / 2 + 0.01, 0));
  g.add(makeShadow(len * 1.2, wid * 1.2, 0.6, true));
  g.position.set(rp.gx, hillHeight(hills, rp.gx, rp.gy), rp.gy);
  g.rotation.y = -rp.a;
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
    item.add(mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 12), toy('#fff8e1'), 0, 0.25, 0));
    item.add(mesh(new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#e53935', shininess: 80 }), 0, 0.42, 0));
    const white = toy('#ffffff');
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
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), toy('#8d6e63'), 0, 0, 0));
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
  box.add(mesh(new THREE.BoxGeometry(1, 0.85, 1), toy(c, { rough: 0.35 }), 0, 0.425, 0));
  const rib = toy('#ffeb3b');
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
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10), toy('#78909c'), 0, 0.25, 0));
  const head = new THREE.Group();
  head.add(mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), toy('#ffeb3b'), 0, 0, 0));
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
