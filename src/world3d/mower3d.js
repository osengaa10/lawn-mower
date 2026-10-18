// The ride-on mower, built from simple shapes so every skin in catalog.js
// works. It's modelled 1 unit long facing +x and scaled to the mower's size.
// The animal driver is an emoji cutout, like the 2D drawing.
import { THREE } from './renderer.js';
import { makeEmoji, makeShadow, disposeTree } from './sprites.js';

const RAINBOW = ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'];

function rainbowTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d');
  RAINBOW.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, (i * 64) / RAINBOW.length, 8, 64 / RAINBOW.length + 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const plastic = (color, extra = {}) => new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x333333, ...extra });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export class Mower3D {
  constructor(skin) {
    this.root = new THREE.Group();
    this.root.rotation.order = 'YZX';
    this.shadow = makeShadow(1, 1, 0.9);
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 0, 0.7, 0.6, 1);
    this.headlight.position.set(0.45, 0.4, 0);
    this.headlight.target.position.set(3, 0, 0);
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
    const bodyMat = skin.rainbow ? plastic('#ffffff', { map: rainbowTexture() }) : plastic(skin.body);
    const trimMat = plastic(skin.trim);
    const dark = new THREE.MeshLambertMaterial({ color: '#263238' });
    const tire = new THREE.MeshLambertMaterial({ color: '#212121' });
    const hub = new THREE.MeshLambertMaterial({ color: '#cfd8dc' });

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.07, 24), new THREE.MeshLambertMaterial({ color: '#607d8b' }));
    deck.scale.set(1.05, 1, 1.25);
    deck.position.set(0.05, 0.08, 0);
    B.add(deck);

    this.wheels = [];
    const wheel = (r, w, x, z) => {
      const g = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18).rotateX(Math.PI / 2), tire);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.01, 10).rotateX(Math.PI / 2), hub);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 0.25, w + 0.02), tire);
      g.add(t, h, spoke);
      g.position.set(x, r, z);
      g.userData.r = r;
      B.add(g);
      this.wheels.push(g);
    };
    wheel(0.16, 0.13, -0.28, 0.36);
    wheel(0.16, 0.13, -0.28, -0.36);
    wheel(0.11, 0.1, 0.32, 0.31);
    wheel(0.11, 0.1, 0.32, -0.31);

    B.add(box(0.92, 0.18, 0.54, bodyMat, 0, 0.3, 0));
    B.add(box(0.38, 0.14, 0.46, bodyMat, 0.27, 0.45, 0));
    B.add(box(0.38, 0.02, 0.12, trimMat, 0.27, 0.53, 0));
    B.add(box(0.03, 0.12, 0.36, dark, 0.47, 0.38, 0));
    const lamp = new THREE.MeshBasicMaterial({ color: '#fff9c4' });
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lamp);
      l.position.set(0.47, 0.46, s * 0.15);
      B.add(l);
    }
    // seat, steering wheel, exhaust
    B.add(box(0.22, 0.06, 0.34, new THREE.MeshLambertMaterial({ color: '#3e2723' }), -0.2, 0.42, 0));
    B.add(box(0.05, 0.22, 0.34, new THREE.MeshLambertMaterial({ color: '#3e2723' }), -0.31, 0.52, 0));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), dark);
    col.position.set(0.06, 0.55, 0);
    col.rotation.z = 0.5;
    B.add(col);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 16), dark);
    sw.position.set(0.02, 0.64, 0);
    sw.rotation.y = Math.PI / 2;
    sw.rotation.x = -0.6;
    B.add(sw);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), dark);
    pipe.position.set(0.12, 0.5, 0.22);
    B.add(pipe);

    if (skin.fins) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(-0.28, 0.32);
      shape.lineTo(-0.2, 0);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
      const red = plastic('#e53935');
      for (const s of [-1, 1]) {
        const f = new THREE.Mesh(geo, red);
        f.position.set(-0.36, 0.3, s * 0.27 - 0.015);
        B.add(f);
      }
      const top = new THREE.Mesh(geo, red);
      top.rotation.x = -Math.PI / 2;
      top.position.set(-0.36, 0.39, 0);
      B.add(top);
    }
    if (skin.spikes) {
      const g = new THREE.ConeGeometry(0.05, 0.13, 6);
      const m = plastic('#558b2f');
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
        const c = new THREE.Mesh(g, m);
        c.position.set(-0.42 + i * 0.14, 0.42, s * 0.24);
        B.add(c);
      }
    }
    this.sirens = null;
    if (skin.siren) {
      const red = new THREE.MeshBasicMaterial({ color: '#ff1744' });
      const blue = new THREE.MeshBasicMaterial({ color: '#2979ff' });
      B.add(box(0.04, 0.12, 0.04, dark, -0.31, 0.68, 0));
      const r = box(0.09, 0.07, 0.11, red, -0.31, 0.77, 0.07);
      const b = box(0.09, 0.07, 0.11, blue, -0.31, 0.77, -0.07);
      B.add(r, b);
      this.sirens = { red, blue };
    }

    this.driver = makeEmoji(skin.driver, 0.55);
    this.driver.position.set(-0.18, 0.4, 0);
    B.add(this.driver);
    if (skin.crown) {
      this.crown = makeEmoji('👑', 0.28);
      this.crown.position.set(-0.18, 0.86, 0);
      B.add(this.crown);
    } else this.crown = null;

    B.add(this.headlight, this.headlight.target);
    this.root.add(B);
  }

  setLights(on) {
    this.headlight.intensity = on ? 9 : 0;
  }

  // m: the Mower (physics). ground(x, z): ground height under a point.
  update(m, ground, t) {
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
    const sq = m.squash;
    const shake = m.speed01 > 0.05 && !m.airborne ? Math.sin(t * 60) * 0.012 * m.speed01 : 0;
    this.body.scale.set(size * (1 + sq * 0.12), size * (1 - sq * 0.28), size * (1 + sq * 0.12));
    this.body.position.y = shake * size;
    for (const w of this.wheels) w.rotation.z = -m.travel / (w.userData.r * size);
    const bob = Math.abs(Math.sin(t * (m.speed01 > 0.05 ? 14 : 3))) * (m.speed01 > 0.05 ? 0.05 : 0.02);
    this.driver.position.y = 0.4 + bob;
    if (this.crown) this.crown.position.y = 0.86 + bob;
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
