// 3D particles from fixed-size instanced pools (same idea as monster-truck's
// effects.js): grass clippings, bursts, sparkles, puffs, confetti, fireworks,
// water drops and floating emoji.
import { THREE } from './renderer.js';
import { makeEmoji, setEmoji } from './sprites.js';
import { pick, rand } from '../util.js';

const CONFETTI = ['#f44336', '#ffeb3b', '#4caf50', '#2196f3', '#e91e63', '#ff9800', '#9c27b0', '#00bcd4'];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class Pool {
  constructor(parent, geometry, material, max) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.f = new Float32Array(max * 16); // pos3 vel3 rot3 spin3 life maxLife size flags
    this.g = new Float32Array(max * 4); // gravity drag grow flutter
    this.next = 0;
    this.live = 0;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.set(0xffffff));
    }
    parent.add(this.mesh);
  }

  // flags: 1 = lands on the ground
  spawn(x, y, z, vx, vy, vz, color, size, life, { g = 18, drag = 1, grow = 0, flutter = 0, ground = false } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    const f = this.f;
    const o = i * 16;
    f[o] = x; f[o + 1] = y; f[o + 2] = z;
    f[o + 3] = vx; f[o + 4] = vy; f[o + 5] = vz;
    f[o + 6] = rand(0, 6); f[o + 7] = rand(0, 6); f[o + 8] = rand(0, 6);
    f[o + 9] = rand(-12, 12); f[o + 10] = rand(-12, 12); f[o + 11] = rand(-12, 12);
    f[o + 12] = life; f[o + 13] = life; f[o + 14] = size; f[o + 15] = ground ? 1 : 0;
    this.g.set([g, drag, grow, flutter], i * 4);
    this.mesh.setColorAt(i, _c.set(color));
    this.mesh.instanceColor.needsUpdate = true;
    this.live = this.max;
  }

  update(dt, groundAt) {
    if (!this.live) return;
    let any = false;
    const f = this.f;
    for (let i = 0; i < this.max; i++) {
      const o = i * 16;
      if (f[o + 12] <= 0) continue;
      any = true;
      f[o + 12] -= dt;
      if (f[o + 12] <= 0) {
        this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        continue;
      }
      const G = this.g;
      const g = G[i * 4];
      const drag = G[i * 4 + 1];
      const grow = G[i * 4 + 2];
      const flutter = G[i * 4 + 3];
      const k = Math.exp(-drag * dt);
      f[o + 3] *= k; f[o + 4] *= k; f[o + 5] *= k;
      f[o + 4] -= g * dt;
      if (flutter) f[o + 3] += Math.sin((f[o + 13] - f[o + 12]) * flutter * 2) * 6 * dt;
      f[o] += f[o + 3] * dt; f[o + 1] += f[o + 4] * dt; f[o + 2] += f[o + 5] * dt;
      if (f[o + 15]) {
        const gy = groundAt(f[o], f[o + 2]) + 0.03;
        if (f[o + 1] < gy) {
          f[o + 1] = gy;
          f[o + 3] *= 0.3; f[o + 5] *= 0.3;
          f[o + 4] = Math.abs(f[o + 4]) > 1.5 ? -f[o + 4] * 0.25 : 0;
          f[o + 9] *= 0.3; f[o + 10] *= 0.3; f[o + 11] *= 0.3;
        }
      }
      f[o + 6] += f[o + 9] * dt; f[o + 7] += f[o + 10] * dt; f[o + 8] += f[o + 11] * dt;
      const t = f[o + 12] / f[o + 13];
      const sc = f[o + 14] * (grow ? 1 + (1 - t) * grow : 1) * Math.min(1, t * 4);
      _p.set(f[o], f[o + 1], f[o + 2]);
      _q.setFromEuler(_e.set(f[o + 6], f[o + 7], f[o + 8]));
      _s.set(sc, sc, sc);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!any) this.live = 0;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.f[i * 16 + 12] = 0;
      this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Effects3D {
  constructor(parent, groundAt = () => 0) {
    this.groundAt = groundAt;
    this.solid = new Pool(parent, new THREE.BoxGeometry(1, 0.25, 0.5), new THREE.MeshLambertMaterial(), 700);
    this.glow = new Pool(
      parent,
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
      500,
    );
    this.puffs = new Pool(parent, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), 80);
    this.drops = new Pool(parent, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75 }), 300);
    this.sprites = [];
    this.spriteNext = 0;
    for (let i = 0; i < 40; i++) {
      const s = makeEmoji('✨', 1, { anchorY: 0.5 });
      s.visible = false;
      s.userData.p = { life: 0 };
      parent.add(s);
      this.sprites.push(s);
    }
  }

  clippings(x, y, z, colors, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(1.5, 4);
      this.solid.spawn(x, y + 0.3, z, Math.cos(a) * s, rand(3, 6.5), Math.sin(a) * s, pick(colors), rand(0.14, 0.22), rand(0.7, 1.3), { g: 20, drag: 1.5, ground: true });
    }
  }

  burst(x, y, z, n = 18, colors = CONFETTI, speed = 1) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const s = rand(3, 7) * speed;
      this.glow.spawn(x, y, z, Math.cos(a) * s, rand(3, 8) * speed, Math.sin(a) * s, pick(colors), rand(0.1, 0.18) * speed, rand(0.6, 1.1), { g: 12, drag: 2.5 });
    }
  }

  sparkle(x, y, z, color = '#fff59d', size = 1) {
    this.glow.spawn(x + rand(-0.3, 0.3), y + rand(0, 0.5), z + rand(-0.3, 0.3), 0, rand(0.6, 1.5), 0, color, rand(0.06, 0.13) * size, rand(0.5, 0.9), { g: 0, drag: 1 });
  }

  puff(x, y, z, size = 1) {
    this.puffs.spawn(x, y, z, rand(-0.3, 0.3), rand(0.5, 1.2), rand(-0.3, 0.3), '#eeeeee', rand(0.12, 0.2) * size, 0.8, { g: 0, drag: 1, grow: 2.5 });
  }

  flame(x, y, z, vx, vz) {
    this.glow.spawn(x, y, z, vx + rand(-0.6, 0.6), rand(0.5, 1.5), vz + rand(-0.6, 0.6), pick(['#ff9800', '#ffeb3b', '#ff5722']), rand(0.12, 0.22), 0.35, { g: 0, drag: 2 });
  }

  confetti(cx, cz, spread = 8, n = 120, height = 9) {
    for (let i = 0; i < n; i++)
      this.solid.spawn(cx + rand(-spread, spread), height + rand(0, 4), cz + rand(-spread, spread), rand(-1, 1), rand(-2, 0), rand(-1, 1), pick(CONFETTI), rand(0.2, 0.32), rand(3, 4.5), { g: 3, drag: 1.2, flutter: rand(2, 5), ground: true });
  }

  firework(x, y, z, scale = 1) {
    const c1 = pick(CONFETTI);
    const c2 = pick(CONFETTI);
    for (let i = 0; i < 50; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(5, 8) * scale);
      this.glow.spawn(x, y, z, v.x, v.y, v.z, i % 3 ? c1 : c2, rand(0.12, 0.2) * scale, rand(0.9, 1.4), { g: 4, drag: 1.8 });
    }
  }

  water(x, y, z, vx, vy, vz) {
    this.drops.spawn(x, y, z, vx, vy, vz, pick(['#81d4fa', '#b3e5fc', '#e1f5fe']), rand(0.06, 0.1), 1.2, { g: 14, drag: 0.3, ground: true });
  }

  emoji(e, x, y, z, { size = 0.8, life = 1, vx = 0, vy = 1, vz = 0, spin = 0, g = 0 } = {}) {
    const s = this.sprites[this.spriteNext];
    this.spriteNext = (this.spriteNext + 1) % this.sprites.length;
    setEmoji(s, e);
    s.visible = true;
    s.position.set(x, y, z);
    s.material.opacity = 1;
    s.material.rotation = 0;
    Object.assign(s.userData.p, { life, max: life, vx, vy, vz, spin, g, size });
    s.scale.set(size, size, 1);
  }

  update(dt) {
    const ga = this.groundAt;
    this.solid.update(dt, ga);
    this.glow.update(dt, ga);
    this.puffs.update(dt, ga);
    this.drops.update(dt, ga);
    for (const s of this.sprites) {
      const p = s.userData.p;
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        s.visible = false;
        continue;
      }
      p.vy -= p.g * dt;
      s.position.x += p.vx * dt;
      s.position.y += p.vy * dt;
      s.position.z += p.vz * dt;
      s.material.rotation += p.spin * dt;
      const k = p.life / p.max;
      s.material.opacity = Math.min(1, k * 3);
      const sc = p.size * Math.min(1, (1 - k) * 8);
      s.scale.set(sc, sc, 1);
    }
  }

  clear() {
    for (const p of [this.solid, this.glow, this.puffs, this.drops]) p.clear();
    for (const s of this.sprites) {
      s.userData.p.life = 0;
      s.visible = false;
    }
  }
}
