// The tilted "toy diorama" camera. It never rotates, so left is always left.
// It frames the whole lawn when it can and follows the mower when the lawn
// would otherwise make the mower too small to see.
import { THREE } from './renderer.js';
import { clamp, lerp } from '../util.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();

export class CameraRig {
  constructor(fov = 38) {
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.3, 500);
    this.W = 1;
    this.H = 1;
    this.hud = 0;
    this.pitch = 55 * DEG;
    this.pitchTarget = this.pitch;
    this.target = new THREE.Vector3();
    this.dist = 30;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.shakeAmt = 0;
    this.override = null; // { target, dist, pitch } for swoops and fly-bys
  }

  // hud: pixels at the top that are covered by buttons, so the view centers below them
  setView(W, H, hud = 0) {
    this.W = W;
    this.H = H;
    this.hud = hud;
    const cam = this.camera;
    cam.aspect = W / (H + hud);
    cam.setViewOffset(W, H + hud, 0, 0, W, H);
    cam.updateProjectionMatrix();
  }

  place(target, dist, pitch) {
    const cam = this.camera;
    cam.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  }

  // Smallest distance at which all the points fit on screen.
  fitDistance(center, pts, pitch, margin = 14) {
    const mx = (margin * 2) / this.W;
    const my = (margin * 2) / this.H;
    const top = 1 - (2 * this.hud) / this.H - my;
    const fits = (d) => {
      this.place(center, d, pitch);
      for (const p of pts) {
        _v.copy(p).project(this.camera);
        if (_v.z > 1 || Math.abs(_v.x) > 1 - mx || _v.y > top || _v.y < -1 + my) return false;
      }
      return true;
    };
    let lo = 2;
    let hi = 400;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  // The farthest the camera can be while a thing `size` cells long still looks `minPx` big.
  maxDistFor(size, minPx) {
    const fullH = this.H + this.hud;
    return (size * fullH) / 2 / (Math.tan((this.camera.fov * DEG) / 2) * minPx);
  }

  boxPoints(x0, z0, x1, z1, y1 = 0) {
    const pts = [];
    for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, y1]) pts.push(new THREE.Vector3(x, y, z));
    return pts;
  }

  // Frame a lawn of cols x rows cells. mowerLen is how long the mower is, in cells.
  fitLawn(cols, rows, maxH, mowerLen) {
    this.center = new THREE.Vector3(cols / 2, 0, rows / 2);
    this.bounds = { cols, rows };
    const pts = this.boxPoints(-0.6, -0.6, cols + 0.6, rows + 0.6, maxH + 0.8);
    const fit = this.fitDistance(this.center, pts, 55 * DEG);
    const minPx = clamp(Math.min(this.W, this.H) * 0.16, 80, 150);
    const maxD = this.maxDistFor(mowerLen, minPx);
    this.baseDist = Math.min(fit, maxD);
    this.follow = fit > maxD * 1.02;
    this.topDownDist = this.fitDistance(this.center, pts, 82 * DEG, 30);
  }

  snap(focus) {
    this.update(0, focus, true);
  }

  shake(amt = 0.3) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
  }

  update(dt, focus, snap = false) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 3);
    this.zoom = lerp(this.zoom, this.zoomTarget, snap ? 1 : 1 - Math.exp(-dt * 2.5));
    let want;
    let dist;
    let pitch;
    if (this.override) {
      ({ target: want, dist, pitch } = this.override);
    } else {
      const c = this.center;
      want = _v.set(c.x, focus.h || 0, c.z);
      if (this.follow) {
        want.x = lerp(c.x, clamp(focus.x, 0, this.bounds.cols), 0.8);
        want.z = lerp(c.z, clamp(focus.y, 0, this.bounds.rows), 0.8);
      } else {
        want.x = lerp(c.x, focus.x, 0.18);
        want.z = lerp(c.z, focus.y, 0.18);
      }
      want.y *= 0.3;
      dist = this.baseDist * this.zoom;
      pitch = this.pitchTarget;
    }
    this.target.lerp(want, k);
    this.dist = lerp(this.dist, dist, k);
    this.pitch = lerp(this.pitch, pitch, k);
    this.place(this.target, this.dist, this.pitch);
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shakeAmt *= Math.exp(-dt * 8);
      this.camera.updateMatrixWorld();
    }
  }

  // Swoop up to look almost straight down at the whole lawn.
  swoopTopDown() {
    this.override = { target: this.center.clone(), dist: this.topDownDist, pitch: 82 * DEG };
  }

  release() {
    this.override = null;
  }

  // Where on the ground (in cells) a screen point lands. heightAt(x, z) gives the ground height.
  screenToGround(sx, sy, heightAt, maxH = 0) {
    _ndc.set((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    const o = _ray.ray.origin;
    const d = _ray.ray.direction;
    if (d.y > -0.02) return { x: o.x + d.x * 200, y: o.z + d.z * 200 };
    let lo = Math.max(0, (o.y - maxH - 0.1) / -d.y);
    let hi = o.y / -d.y;
    for (let i = 0; i < 14; i++) {
      const t = (lo + hi) / 2;
      const y = o.y + d.y * t;
      if (y > heightAt(o.x + d.x * t, o.z + d.z * t)) lo = t;
      else hi = t;
    }
    return { x: o.x + d.x * hi, y: o.z + d.z * hi };
  }

  toScreen(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return { x: ((_v.x + 1) / 2) * this.W, y: ((1 - _v.y) / 2) * this.H };
  }

  // How many screen pixels one cell covers near a point.
  pxPerCell(x, y, z) {
    const a = this.toScreen(x, y, z);
    const b = this.toScreen(x + 1, y, z);
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
}
