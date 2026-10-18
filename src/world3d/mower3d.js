// The ride-on mower: a rounded glossy hood with a grille and headlights,
// treaded tires on rims, a cushioned seat, a steering wheel, the cutting deck
// with a side chute, and an exhaust stack. It's modelled 1 unit long facing
// +x and scaled to the mower's size, so every skin in catalog.js works.
// The animal driver is an emoji cutout, like the 2D drawing.
import { THREE, castAll, newToy, toy } from './renderer.js';
import { makeEmoji, makeShadow, disposeTree } from './sprites.js';
import { makeAnimal } from './animals.js';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../vendor/addons/utils/BufferGeometryUtils.js';

const RAINBOW = ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'];

function rainbowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  RAINBOW.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect((i * 64) / RAINBOW.length, 0, 64 / RAINBOW.length + 1, 8);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const shared = (g) => {
  g.userData.shared = true;
  return g;
};

// A tire with rounded shoulders and chunky tread lugs, axle along z.
function tireGeometry(r, w) {
  const inner = r * 0.6;
  const c = Math.min(w * 0.3, r * 0.2);
  const pts = [new THREE.Vector2(inner, -w / 2)];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, -w / 2 + c + Math.sin(a) * c));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - c + Math.cos(a) * c, w / 2 - c + Math.sin(a) * c));
  }
  pts.push(new THREE.Vector2(inner, w / 2));
  const parts = [new THREE.LatheGeometry(pts, 28)];
  const lugs = 16;
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    for (const s of [-1, 1]) {
      const lug = new THREE.BoxGeometry(r * 0.16, r * 0.1, w * 0.42);
      lug.rotateY(s * 0.5);
      lug.translate(0, r + r * 0.02, s * w * 0.2 + (i % 2 ? 0.01 : -0.01));
      // lathe spins round y, so the lugs go round y too
      lug.rotateX(Math.PI / 2);
      lug.rotateY(a);
      parts.push(lug.toNonIndexed());
    }
  }
  const geo = mergeGeometries([parts[0].toNonIndexed(), ...parts.slice(1)]);
  geo.rotateX(Math.PI / 2);
  return shared(geo);
}

// The rim, hub cap and lug nuts, axle along z, facing out toward +z.
function rimGeometry(r, w) {
  const parts = [];
  const rim = new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.84, 24).rotateX(Math.PI / 2);
  const dish = new THREE.CylinderGeometry(r * 0.48, r * 0.56, w * 0.1, 24).rotateX(Math.PI / 2).translate(0, 0, w * 0.44);
  parts.push(rim, dish);
  return shared(mergeGeometries(parts));
}

function capGeometry(r, w) {
  const parts = [new THREE.SphereGeometry(r * 0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, w * 0.48)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(new THREE.CylinderGeometry(r * 0.045, r * 0.045, w * 0.12, 6).rotateX(Math.PI / 2).translate(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34, w * 0.48));
  }
  return shared(mergeGeometries(parts.map((p) => p.toNonIndexed())));
}

const GEO = {};
function wheelGeo(r, w) {
  const k = `${r}|${w}`;
  return (GEO[k] ||= { tire: tireGeometry(r, w), rim: rimGeometry(r, w), cap: capGeometry(r, w) });
}

const rounded = (w, h, d, radius) => new RoundedBoxGeometry(w, h, d, 3, radius);

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Mower3D {
  constructor(skin) {
    this.root = new THREE.Group();
    this.root.rotation.order = 'YZX';
    this.shadow = makeShadow(1, 1, 0.9, true);
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 0, 0.7, 0.6, 1);
    this.headlight.position.set(0.5, 0.45, 0);
    this.headlight.target.position.set(3, 0, 0);
    this.steer = 0;
    this.lastT = null;
    this.setSkin(skin);
  }

  setSkin(skin) {
    if (this.skin === skin && this.body) return;
    this.skin = skin;
    if (this.body) {
      this.root.remove(this.body);
      disposeTree(this.body);
    }
    const B = (this.body = new THREE.Group());
    const paint = skin.rainbow ? newToy('#ffffff', { rough: 0.3, map: rainbowTexture() }) : newToy(skin.body, { rough: 0.28 });
    const trim = toy(skin.trim, { rough: 0.35 });
    const dark = toy('#2b3238', { rough: 0.55 });
    const metal = toy('#4f5b62', { rough: 0.4, metal: 0.6 });
    const chrome = toy('#e8edf0', { rough: 0.15, metal: 1 });
    const rubber = toy('#1d1d1d', { rough: 0.9 });
    const seat = toy('#2a2422', { rough: 0.45 });
    const rimMat = skin.id === 'green' ? toy('#ffd600', { rough: 0.35 }) : toy(skin.trim, { rough: 0.35, metal: 0.2 });

    // cutting deck with a side chute
    const deck = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.08, 32), metal, 0.04, 0.1, 0);
    deck.scale.set(1.05, 1, 1.2);
    B.add(deck);
    const chute = mesh(rounded(0.16, 0.06, 0.16, 0.025), dark, -0.02, 0.1, 0.46);
    chute.rotation.y = 0.35;
    B.add(chute);
    this.chute = new THREE.Vector3(-0.08, 0.12, 0.56);

    // chassis and footboard
    B.add(mesh(rounded(0.92, 0.07, 0.5, 0.03), dark, 0, 0.22, 0));

    // rear body under the seat, with fenders over the big wheels
    B.add(mesh(rounded(0.46, 0.17, 0.5, 0.06), paint, -0.21, 0.32, 0));
    const arch = new THREE.Shape();
    arch.absarc(0, 0, 0.23, 0, Math.PI, false);
    arch.absarc(0, 0, 0.2, Math.PI, 0, true);
    arch.closePath();
    const fender = new THREE.ExtrudeGeometry(arch, { depth: 0.13, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 16 }).translate(0, 0, -0.065);
    for (const s of [-1, 1]) B.add(mesh(fender, paint, -0.28, 0.17, s * 0.355));

    // hood, stripe, grille and headlights
    B.add(mesh(rounded(0.46, 0.25, 0.44, 0.08), paint, 0.27, 0.4, 0));
    B.add(mesh(rounded(0.42, 0.02, 0.1, 0.008), trim, 0.27, 0.525, 0));
    B.add(mesh(rounded(0.03, 0.16, 0.3, 0.012), dark, 0.5, 0.38, 0));
    for (let i = 0; i < 3; i++) B.add(mesh(new THREE.BoxGeometry(0.012, 0.015, 0.26), chrome, 0.515, 0.33 + i * 0.045, 0));
    const lens = new THREE.MeshBasicMaterial({ color: '#fff9d6', toneMapped: false });
    const bezel = new THREE.TorusGeometry(0.045, 0.012, 8, 20).rotateY(Math.PI / 2);
    const lamp = new THREE.CircleGeometry(0.045, 16).rotateY(Math.PI / 2);
    for (const s of [-1, 1]) {
      B.add(mesh(bezel, chrome, 0.505, 0.46, s * 0.15));
      B.add(mesh(lamp, lens, 0.507, 0.46, s * 0.15));
    }

    // dashboard, steering column and wheel
    B.add(mesh(rounded(0.08, 0.12, 0.38, 0.03), dark, 0.03, 0.52, 0));
    const col = mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.2, 8), dark, -0.01, 0.62, 0);
    col.rotation.z = 0.55;
    B.add(col);
    const sw = new THREE.Group();
    sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 24), seat));
    for (let i = 0; i < 3; i++) {
      const spoke = mesh(new THREE.BoxGeometry(0.075, 0.012, 0.01), chrome, 0, 0, 0);
      spoke.rotation.z = (i / 3) * Math.PI * 2 + Math.PI / 2;
      spoke.position.set(Math.cos(spoke.rotation.z) * 0.037, Math.sin(spoke.rotation.z) * 0.037, 0);
      sw.add(spoke);
    }
    sw.position.set(-0.06, 0.7, 0);
    sw.rotation.order = 'ZYX';
    sw.rotation.set(0, Math.PI / 2, 1.0);
    B.add(sw);

    // seat with a backrest and armrests
    B.add(mesh(rounded(0.25, 0.07, 0.32, 0.03), seat, -0.21, 0.44, 0));
    const back = mesh(rounded(0.06, 0.22, 0.32, 0.03), seat, -0.35, 0.56, 0);
    back.rotation.z = 0.18;
    B.add(back);
    for (const s of [-1, 1]) B.add(mesh(rounded(0.18, 0.03, 0.04, 0.012), seat, -0.24, 0.52, s * 0.17));

    // exhaust stack with a rain cap
    B.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), chrome, 0.2, 0.62, 0.17));
    const flap = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 12), chrome, 0.2, 0.745, 0.17);
    flap.rotation.z = 0.35;
    B.add(flap);
    this.flap = flap;

    // wheels: big ones at the back, steering ones at the front
    this.wheels = [];
    this.steerers = [];
    const wheel = (r, w, x, z, steers) => {
      const geo = wheelGeo(r, w);
      const spin = new THREE.Group();
      const side = z > 0 ? 1 : -1;
      spin.add(new THREE.Mesh(geo.tire, rubber));
      const rim = new THREE.Mesh(geo.rim, rimMat);
      const cap = new THREE.Mesh(geo.cap, chrome);
      // the hub faces outward on both sides
      if (side < 0) rim.rotation.y = cap.rotation.y = Math.PI;
      spin.add(rim, cap);
      spin.userData.r = r;
      const pivot = new THREE.Group();
      pivot.position.set(x, r, z);
      pivot.add(spin);
      B.add(pivot);
      this.wheels.push(spin);
      if (steers) this.steerers.push(pivot);
    };
    wheel(0.17, 0.14, -0.28, 0.355, false);
    wheel(0.17, 0.14, -0.28, -0.355, false);
    wheel(0.11, 0.09, 0.33, 0.29, true);
    wheel(0.11, 0.09, 0.33, -0.29, true);

    if (skin.fins) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(-0.28, 0.32);
      shape.lineTo(-0.2, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
      const red = toy('#e53935', { rough: 0.3 });
      for (const s of [-1, 1]) B.add(mesh(geo, red, -0.38, 0.32, s * 0.27 - 0.015));
      const top = mesh(geo, red, -0.38, 0.41, 0.015);
      top.rotation.x = -Math.PI / 2;
      B.add(top);
    }
    if (skin.spikes) {
      const g = new THREE.ConeGeometry(0.05, 0.13, 10);
      const m = toy('#558b2f', { rough: 0.5 });
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) B.add(mesh(g, m, -0.42 + i * 0.14, 0.43, s * 0.22));
    }
    this.sirens = null;
    if (skin.siren) {
      // a roll bar behind the seat carries the light bar
      for (const s of [-1, 1]) B.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), chrome, -0.42, 0.6, s * 0.2));
      B.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 8).rotateX(Math.PI / 2), chrome, -0.42, 0.85, 0));
      const red = new THREE.MeshBasicMaterial({ color: '#ff1744', toneMapped: false });
      const blue = new THREE.MeshBasicMaterial({ color: '#2979ff', toneMapped: false });
      B.add(mesh(rounded(0.09, 0.07, 0.16, 0.025), red, -0.42, 0.9, 0.09));
      B.add(mesh(rounded(0.09, 0.07, 0.16, 0.025), blue, -0.42, 0.9, -0.09));
      this.sirens = { red, blue };
    }

    // the driver: a little animal riding on the seat, facing forward
    const drv = makeAnimal(skin.driver, 0.55);
    this.driverActor = drv;
    this.driverBase = drv.isModel ? 0.47 : 0.42;
    if (drv.isModel) {
      drv.root.scale.setScalar(0.8);
      drv.faceNow(1, 0);
      // characters that can sit settle into the seat; animals stand on it
      if (drv.sit()) this.driverBase = 0.36;
    }
    this.driver = drv.root;
    this.driver.position.set(-0.2, this.driverBase, 0);
    B.add(this.driver);
    if (skin.crown) {
      this.crown = makeEmoji('👑', 0.28);
      this.crown.position.set(-0.2, 0.88, 0);
      B.add(this.crown);
    } else this.crown = null;

    castAll(B);
    B.add(this.headlight, this.headlight.target);
    this.root.add(B);
  }

  setLights(on) {
    this.headlight.intensity = on ? 9 : 0;
  }

  // Where grass clippings fly out, in world space.
  chutePos(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld();
    return this.body.localToWorld(out.copy(this.chute));
  }

  // m: the Mower (physics). ground(x, z): ground height under a point.
  update(m, ground, t) {
    const dt = this.lastT === null ? 0 : Math.min(0.1, t - this.lastT);
    this.lastT = t;
    const size = m.size * m.scale;
    const root = this.root;
    root.position.set(m.x, m.h, m.y);
    // lean with the slope under the mower
    const c = Math.cos(m.heading);
    const s = Math.sin(m.heading);
    const d = size * 0.35;
    let pitch = 0;
    let roll = 0;
    if (!m.airborne) {
      pitch = Math.atan2(ground(m.x + c * d, m.y + s * d) - ground(m.x - c * d, m.y - s * d), d * 2);
      roll = Math.atan2(ground(m.x - s * d, m.y + c * d) - ground(m.x + s * d, m.y - c * d), d * 2);
    } else pitch = Math.max(-0.3, Math.min(0.35, m.vh * 0.05));
    root.rotation.set(-roll, -m.heading, pitch);

    // front wheels turn the way the mower is turning
    if (dt > 0) {
      const turn = wrapAngle(m.heading - (this.lastHeading ?? m.heading)) / dt;
      const want = Math.max(-0.55, Math.min(0.55, turn * 0.35));
      this.steer += (want - this.steer) * (1 - Math.exp(-dt * 10));
    }
    this.lastHeading = m.heading;
    for (const p of this.steerers) p.rotation.y = -this.steer;

    const sq = m.squash;
    const moving = m.speed01 > 0.05 && !m.airborne;
    const shake = moving ? Math.sin(t * 60) * 0.012 * m.speed01 : Math.sin(t * 38) * 0.003;
    this.body.scale.set(size * (1 + sq * 0.12), size * (1 - sq * 0.28), size * (1 + sq * 0.12));
    this.body.position.y = shake * size;
    for (const w of this.wheels) w.rotation.z = -m.travel / (w.userData.r * size);
    this.flap.rotation.z = 0.35 + Math.abs(Math.sin(t * (moving ? 30 : 12))) * 0.5;
    const bob = Math.abs(Math.sin(t * (moving ? 14 : 3))) * (moving ? 0.05 : 0.02);
    this.driver.position.y = this.driverBase + (this.driverActor.isModel ? bob * 0.4 : bob);
    this.driverActor.update(dt);
    if (this.crown) this.crown.position.y = 0.88 + bob;
    if (this.sirens) {
      const on = Math.floor(t * 4) % 2 === 0;
      this.sirens.red.color.set(on ? '#ff1744' : '#7f0000');
      this.sirens.blue.color.set(on ? '#0d47a1' : '#82b1ff');
    }
    const gy = ground(m.x, m.y);
    const lift = Math.max(0, m.h - gy);
    this.shadow.position.set(m.x, gy + 0.03, m.y);
    const ss = size * 0.95 * Math.max(0.5, 1 - lift * 0.15);
    this.shadow.scale.set(ss, 1, ss * 0.8);
    this.shadow.rotation.y = -m.heading;
    this.shadow.material.opacity = Math.max(0.3, 0.9 - lift * 0.2);
  }

  dispose() {
    disposeTree(this.root);
    disposeTree(this.shadow);
  }
}
