// Tall grass: a few instanced tufts per cell that sway in the wind and
// squash flat when they're cut.
import { THREE } from './renderer.js';
import { hillHeight, mulberry32 } from '../terrain.js';

const TUFTS = 4;
const BLADES = 7;
const CUT_TIME = 0.16;
const GROW_TIME = 0.9;

function tuftGeometry() {
  const rng = mulberry32(42);
  const pos = [];
  const col = [];
  for (let b = 0; b < BLADES; b++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.26;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.42 + rng() * 0.3;
    const w = 0.07 + rng() * 0.04;
    const ta = rng() * Math.PI;
    // each blade tapers to a point and bends over a little
    const lean = (rng() - 0.5) * 0.3;
    const lz = (rng() - 0.5) * 0.3;
    const dx = Math.cos(ta) * w;
    const dz = Math.sin(ta) * w;
    const my = h * 0.55;
    const mx = x + lean * 0.3;
    const mz = z + lz * 0.3;
    const bl = [x - dx, 0, z - dz];
    const br = [x + dx, 0, z + dz];
    const ml = [mx - dx * 0.7, my, mz - dz * 0.7];
    const mr = [mx + dx * 0.7, my, mz + dz * 0.7];
    const tip = [x + lean, h, z + lz];
    pos.push(...bl, ...br, ...ml, ...br, ...mr, ...ml, ...ml, ...mr, ...tip);
    const lo = 0.5;
    const mid = 0.85;
    const hi = 1.18;
    col.push(lo, lo, lo, lo, lo, lo, mid, mid, mid, lo, lo, lo, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, hi, hi, hi * 0.95);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // blades should be lit like the ground, not by which way they face
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

export class Grass {
  constructor(lawn) {
    this.lawn = lawn;
    const cells = lawn.tallCells();
    const count = Math.max(1, cells.length * TUFTS);
    this.time = { value: 0 };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const time = this.time;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 wpos = instanceMatrix[3].xyz;
          vec3 ax = instanceMatrix[0].xyz;
          vec3 az = instanceMatrix[2].xyz;
        #else
          vec3 wpos = vec3(0.0);
          vec3 ax = vec3(1.0, 0.0, 0.0);
          vec3 az = vec3(0.0, 0.0, 1.0);
        #endif
        // gusts roll across the lawn; tips bend more than roots
        float gust = 0.5 + 0.5 * sin(uTime * 1.3 - wpos.x * 0.35 - wpos.z * 0.22);
        float sway = gust * gust * 0.16 + sin(uTime * 3.1 + wpos.x * 2.3 + wpos.z * 1.7) * 0.03;
        vec3 wind = vec3(1.0, 0.0, 0.45) * sway * position.y * position.y * 2.2;
        // the wind blows the same way in the world whichever way a tuft is turned
        transformed.x += dot(wind, ax) / dot(ax, ax);
        transformed.z += dot(wind, az) / dot(az, az);`,
      );
    };
    this.mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.receiveShadow = true;
    this.base = new Float32Array(count * 5); // x, y, z, rotation, scale
    this.cellStart = new Int32Array(lawn.grid.length).fill(-1);
    const rng = mulberry32(lawn.seed + 3);
    const offs = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
    let k = 0;
    for (const i of cells) {
      const c = lawn.cellCenter(i);
      this.cellStart[i] = k;
      for (let t = 0; t < TUFTS; t++, k++) {
        const x = c.x + offs[t][0] + (rng() - 0.5) * 0.2;
        const z = c.y + offs[t][1] + (rng() - 0.5) * 0.2;
        this.base.set([x, hillHeight(lawn.hills, x, z), z, rng() * 6.28, 0.85 + rng() * 0.35], k * 5);
        this.setMatrix(k, 1, 0);
        this.mesh.setColorAt(k, _c.set(lawn.theme.blades[(rng() * lawn.theme.blades.length) | 0]));
      }
    }
    if (!cells.length) this.mesh.setMatrixAt(0, _m.makeScale(0, 0, 0));
    this.cutting = [];
    this.growing = [];
  }

  // Every tuft springs back up (the home screen's lawn grows back after a mow).
  regrowAll() {
    this.cutting.length = 0;
    this.growing = [];
    for (let i = 0; i < this.cellStart.length; i++) if (this.cellStart[i] >= 0) this.growing.push({ k: this.cellStart[i], t: -Math.random() * 0.6 });
  }

  setMatrix(k, sy, squash) {
    const b = this.base;
    const o = k * 5;
    const s = b[o + 4];
    _p.set(b[o], b[o + 1], b[o + 2]);
    _q.setFromAxisAngle(_up, b[o + 3]);
    _s.set(s * (1 + squash * 0.5), s * sy, s * (1 + squash * 0.5));
    this.mesh.setMatrixAt(k, _m.compose(_p, _q, _s));
  }

  cut(i) {
    const k = this.cellStart[i];
    if (k >= 0) this.cutting.push({ k, t: 0 });
  }

  clearAll() {
    _m.makeScale(0, 0, 0);
    for (let k = 0; k < this.mesh.count; k++) this.mesh.setMatrixAt(k, _m);
    this.cutting.length = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, t) {
    this.time.value = t;
    if (this.growing.length) {
      for (const g of this.growing) {
        g.t += dt;
        const f = Math.max(0, Math.min(1, g.t / GROW_TIME));
        // overshoot a little, like it's springing up
        const s = f < 1 ? 1 - (1 - f) ** 3 + Math.sin(f * Math.PI) * 0.15 : 1;
        for (let j = 0; j < TUFTS; j++) this.setMatrix(g.k + j, Math.max(0.001, s), 0);
      }
      this.growing = this.growing.filter((g) => g.t < GROW_TIME);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (!this.cutting.length) return;
    for (const c of this.cutting) {
      c.t += dt;
      const f = Math.min(1, c.t / CUT_TIME);
      for (let j = 0; j < TUFTS; j++) {
        if (f >= 1) this.mesh.setMatrixAt(c.k + j, _m.makeScale(0, 0, 0));
        else this.setMatrix(c.k + j, 1 - f, f);
      }
    }
    this.cutting = this.cutting.filter((c) => c.t < CUT_TIME);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
