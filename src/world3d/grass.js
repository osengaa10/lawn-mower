// Tall grass: a few instanced tufts per cell that sway in the wind and
// squash flat when they're cut.
import { THREE } from './renderer.js';
import { hillHeight, mulberry32 } from '../terrain.js';

const TUFTS = 4;
const BLADES = 7;
const CUT_TIME = 0.16;

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
    const lean = (rng() - 0.5) * 0.25;
    const dx = Math.cos(ta) * w;
    const dz = Math.sin(ta) * w;
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lean, h, z + lean * 0.5);
    col.push(0.55, 0.55, 0.55, 0.6, 0.6, 0.6, 1.15, 1.15, 1.1);
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
          float ph = instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.6;
        #else
          float ph = 0.0;
        #endif
        float sway = sin(uTime * 2.2 + ph) * 0.08 + sin(uTime * 3.7 + ph * 1.3) * 0.03;
        transformed.x += sway * position.y * 1.5;
        transformed.z += sway * 0.5 * position.y * 1.5;`,
      );
    };
    this.mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
