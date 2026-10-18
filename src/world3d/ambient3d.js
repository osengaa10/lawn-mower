// A few critters and bits that drift around each world to make it feel
// alive: butterflies, falling leaves, fireflies and candy sparkles. They live
// in the 3D world (not on top of the screen) and there are only a handful.
import { THREE } from './renderer.js';
import { rand } from '../util.js';

const COUNT = { butterflies: 3, leaves: 5, fireflies: 10, sparkles: 7 };

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glowTexture = () =>
  canvasTexture(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,230,1)');
    gr.addColorStop(0.18, 'rgba(255,245,157,0.9)');
    gr.addColorStop(1, 'rgba(255,235,59,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });

const sparkleTexture = () =>
  canvasTexture(64, (g, s) => {
    g.translate(s / 2, s / 2);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 4 : 30;
      const a = (i / 8) * Math.PI * 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.fill();
  });

const wingTexture = (color) =>
  canvasTexture(64, (g) => {
    g.fillStyle = color;
    g.strokeStyle = '#3e2723';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(30, 22, 26, 18, -0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(24, 46, 17, 13, 0.4, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    for (const [x, y, r] of [[38, 18, 5], [24, 48, 4]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });

const leafTexture = (color) =>
  canvasTexture(64, (g) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(32, 4);
    g.quadraticCurveTo(62, 30, 32, 60);
    g.quadraticCurveTo(2, 30, 32, 4);
    g.fill();
    g.strokeStyle = 'rgba(80,40,10,0.5)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(32, 8);
    g.lineTo(32, 58);
    g.stroke();
  });

export class Ambient3D {
  constructor(parent, kind, lawn) {
    this.kind = kind;
    this.lawn = lawn;
    this.group = new THREE.Group();
    parent.add(this.group);
    this.items = [];
    const n = COUNT[kind] || 0;
    let tex = null;
    if (kind === 'fireflies') tex = glowTexture();
    if (kind === 'sparkles') tex = sparkleTexture();
    for (let i = 0; i < n; i++) {
      let obj;
      if (kind === 'fireflies' || kind === 'sparkles') {
        obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: kind === 'sparkles' ? ['#ffffff', '#ff80ab', '#80d8ff'][i % 3] : '#ffffff' }));
      } else if (kind === 'butterflies') {
        obj = this.butterfly(['#ffb74d', '#4fc3f7', '#f48fb1'][i % 3]);
      } else {
        obj = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 0.4),
          new THREE.MeshLambertMaterial({ map: leafTexture(['#e65100', '#f9a825', '#c62828'][i % 3]), side: THREE.DoubleSide, alphaTest: 0.4, transparent: true }),
        );
      }
      this.group.add(obj);
      const it = { obj, ph: rand(0, 10), x: 0, y: 0, z: 0, vx: 0, vz: 0, rest: 0 };
      this.place(it, true);
      this.items.push(it);
    }
  }

  butterfly(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ map: wingTexture(color), side: THREE.DoubleSide, alphaTest: 0.4 });
    const geo = new THREE.PlaneGeometry(0.42, 0.42).rotateX(-Math.PI / 2).translate(0.21, 0, 0);
    const wings = [];
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(geo, mat);
      w.scale.x = s;
      g.add(w);
      wings.push(w);
    }
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 3, 6).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#3e2723' }));
    g.add(body);
    g.userData.wings = wings;
    return g;
  }

  place(it, initial) {
    const { cols, rows } = this.lawn;
    it.x = rand(-2, cols + 2);
    it.z = rand(-2, rows + 2);
    it.y = this.kind === 'leaves' ? (initial ? rand(1, 9) : rand(7, 10)) : rand(0.6, 2.2);
    it.vx = rand(-1, 1);
    it.vz = rand(-1, 1);
    it.rest = 0;
    it.obj.material && (it.obj.material.opacity = 1);
  }

  update(dt, t) {
    const { cols, rows } = this.lawn;
    for (const it of this.items) {
      it.ph += dt;
      const o = it.obj;
      if (this.kind === 'leaves') {
        if (it.rest > 0) {
          it.rest -= dt;
          o.material.opacity = Math.min(1, it.rest);
          if (it.rest <= 0) this.place(it, false);
          continue;
        }
        it.y -= dt * 1.1;
        it.x += (Math.sin(it.ph * 1.7) * 1.2 + 0.4) * dt;
        it.z += Math.cos(it.ph * 1.3) * 0.5 * dt;
        const gy = this.lawn.height(it.x, it.z) + 0.03;
        if (it.y <= gy) {
          it.y = gy;
          it.rest = 2;
          o.rotation.set(-Math.PI / 2, 0, it.ph);
        } else o.rotation.set(it.ph * 2.1, it.ph * 1.3, it.ph * 0.7);
      } else {
        // drift about over the lawn, turning back at the edges
        const sp = this.kind === 'butterflies' ? 1.6 : 0.6;
        it.vx += Math.sin(it.ph * 0.9 + it.z) * sp * dt * 2;
        it.vz += Math.cos(it.ph * 0.7 + it.x) * sp * dt * 2;
        if (it.x < -2) it.vx += dt * 2;
        if (it.x > cols + 2) it.vx -= dt * 2;
        if (it.z < -2) it.vz += dt * 2;
        if (it.z > rows + 2) it.vz -= dt * 2;
        const v = Math.hypot(it.vx, it.vz);
        if (v > sp) {
          it.vx *= sp / v;
          it.vz *= sp / v;
        }
        it.x += it.vx * dt;
        it.z += it.vz * dt;
        const base = this.lawn.height(it.x, it.z);
        if (this.kind === 'butterflies') {
          const flap = Math.sin(it.ph * 16) * 0.9;
          o.userData.wings[0].rotation.z = flap;
          o.userData.wings[1].rotation.z = -flap;
          o.rotation.y = Math.atan2(it.vx, it.vz);
          it.y = base + 1.6 + Math.sin(it.ph * 2) * 0.4;
        } else {
          const glow = this.kind === 'fireflies' ? 0.25 + 0.75 * Math.max(0, Math.sin(it.ph * 2.2)) : 0.3 + 0.7 * Math.abs(Math.sin(it.ph * 1.7));
          o.material.opacity = glow;
          const s = this.kind === 'fireflies' ? 0.55 : 0.35 + glow * 0.25;
          o.scale.set(s, s, 1);
          if (this.kind === 'sparkles') o.material.rotation = t * 0.8 + it.ph;
          it.y = base + 0.8 + Math.sin(it.ph * 0.8) * 0.6;
        }
      }
      o.position.set(it.x, it.y, it.z);
    }
  }
}
