// The neighborhood: a street with one house for every lawn mowed, plus the
// next one waiting with tall grass. The mower drives up the road, the owner
// asks for help, and the camera dives into the lawn. No taps needed, but he
// can swipe back along the street to see every picture he's uncovered.
import { THREE, LIGHTS, makeLights } from '../world3d/renderer.js';
import { Mower3D } from '../world3d/mower3d.js';
import { Effects3D } from '../world3d/effects3d.js';
import { disposeTree, makeEmoji } from '../world3d/sprites.js';
import { makeHouse, makePine, makeTree } from '../world3d/props.js';
import { paintLawn } from '../world3d/ground.js';
import { fitPictureBox, shapePath } from '../lawn.js';
import { levelDef } from '../levels.js';
import { Mower } from '../mower.js';
import { MOWER_BY_ID } from '../catalog.js';
import { PICTURES } from '../pictures.js';
import { sfx, setEngine, startEngine, stopEngine } from '../audio.js';
import { say } from '../speech.js';
import { Button, hitButtons, playTriangle } from '../ui.js';
import { clamp, easeOutCubic, lerp, pick, rand } from '../util.js';

const LOT = 16; // street width of one house + lawn
const KEEP = 8; // how many houses to build
const ROAD_Z = 8.5;
const _c = new THREE.Color();

// A small painting of a lawn for the street: mowed with its picture, or still tall.
function lawnTexture(def, finished) {
  const cols = def.long;
  const rows = def.short;
  const path = shapePath(def.shape, cols, rows);
  const lawn = { cols, rows, path, theme: def.theme, obstacles: [], def, pictureBox: fitPictureBox(path, cols, rows, PICTURES[def.picture]?.aspect || 1) };
  const ppc = 24;
  const c = document.createElement('canvas');
  c.width = (cols + 2) * ppc;
  c.height = (rows + 2) * ppc;
  const g = c.getContext('2d');
  g.setTransform(ppc, 0, 0, ppc, ppc, ppc);
  if (finished) paintLawn(g, lawn);
  else {
    paintLawn(g, lawn, { picture: false });
    g.save();
    g.clip(path);
    g.fillStyle = def.theme.tallBase;
    g.fillRect(0, 0, cols, rows);
    g.lineCap = 'round';
    g.lineWidth = 0.12;
    for (let i = 0; i < cols * rows * 7; i++) {
      const x = Math.random() * cols;
      const y = Math.random() * rows + 0.3;
      g.strokeStyle = pick(def.theme.blades);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 0.05, y - 0.4, x + (Math.random() - 0.5) * 0.4, y - 0.7 - Math.random() * 0.4);
      g.stroke();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, w: cols + 2, h: rows + 2 };
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#8d8d8d';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff176';
  g.fillRect(8, 29, 32, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export class StreetScreen {
  constructor(game) {
    this.g = game;
    this.uses3D = true;
    this.t = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bfe9ff');
    this.lights = makeLights(this.scene);
    this.lights.apply('day');
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
    this.fx = new Effects3D(this.scene);
    this.lots = new Map();
    this.homeBtn = new Button({ icon: '🏠', color: '#ffb74d', onTap: () => { sfx.tap(); game.go('menu'); } });
    this.goBtn = new Button({ color: '#43a047', pulse: true, draw: playTriangle, onTap: () => { sfx.tap(); this.dive(); } });

    const road = roadTexture();
    road.repeat.set(400 / 4, 1);
    this.road = new THREE.Mesh(new THREE.PlaneGeometry(400, 3.6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: road }));
    this.road.position.set(150, 0.02, ROAD_Z);
    this.walk = new THREE.Mesh(new THREE.PlaneGeometry(400, 1.2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e0e0e0' }));
    this.walk.position.set(150, 0.03, ROAD_Z - 2.4);
    this.far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#8fd97a' }));
    this.far.position.set(150, -0.05, 0);
    this.scene.add(this.road, this.walk, this.far);

    // stars over the night and moon houses
    const pts = [];
    for (let i = 0; i < 400; i++) pts.push(rand(-100, 400), rand(8, 60), rand(-80, -20));
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.5, transparent: true, opacity: 0 }));
    this.scene.add(this.stars);

    this.mower = new Mower(MOWER_BY_ID.red, 0, ROAD_Z, 3);
    this.mower3d = new Mower3D(MOWER_BY_ID.red);
    this.scene.add(this.mower3d.root, this.mower3d.shadow);
    this.arrow = makeEmoji('👇', 1.7);
    this.scene.add(this.arrow);
  }

  lotX(i) {
    return i * LOT;
  }

  buildLot(i, finished) {
    const def = levelDef(i);
    const g = new THREE.Group();
    const x = this.lotX(i);
    g.position.x = x;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(LOT, 26).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: def.theme.bg[0] }));
    ground.position.set(0, -0.01, -4);
    g.add(ground);
    const house = makeHouse(def.theme.id, def.owner);
    house.position.set(0, 0, -6.8);
    g.add(house);
    const { tex, w, h } = lawnTexture(def, finished);
    const s = Math.min(12 / w, 7.4 / h);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w * s, h * s).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
    lawn.position.set(0, 0.015, 1.2);
    g.add(lawn);
    // something between the houses
    const tree = def.theme.id === 'night' ? makePine(3) : def.theme.id === 'day' || def.theme.id === 'sunset' ? makeTree(2.6) : null;
    if (tree) {
      tree.position.set(LOT / 2, 0, -3);
      g.add(tree);
    } else {
      const d = makeEmoji(def.theme.decor[i % def.theme.decor.length], 2.4);
      d.position.set(LOT / 2, 0, -3);
      g.add(d);
    }
    const deco = makeEmoji(def.theme.decor[(i + 3) % def.theme.decor.length], 1.6);
    deco.position.set(-LOT / 2 + 1.5, 0, -1);
    g.add(deco);
    this.scene.add(g);
    return { i, def, group: g, finished, owner: house.userData.owner, hop: 0, x };
  }

  syncLots() {
    const next = this.g.save.lawns;
    const first = Math.max(0, next - KEEP + 1);
    for (const [i, lot] of this.lots) {
      const want = i < next;
      if (i < first || i > next || lot.finished !== want) {
        this.scene.remove(lot.group);
        disposeTree(lot.group);
        this.lots.delete(i);
      }
    }
    for (let i = first; i <= next; i++) if (!this.lots.has(i)) this.lots.set(i, this.buildLot(i, i < next));
    this.first = first;
    this.next = next;
  }

  enter() {
    const { g } = this;
    this.syncLots();
    const skin = MOWER_BY_ID[g.save.mower] || MOWER_BY_ID.red;
    this.mower.skin = skin;
    this.mower3d.setSkin(skin);
    this.fx.clear();
    this.t = 0;
    this.diving = null;
    this.browsing = false;
    this.drag = null;
    this.fade = 0;
    const nextX = this.lotX(this.next);
    const thanks = g.streetIntro === 'thanks' && this.next > 0;
    g.streetIntro = null;
    this.phase = thanks ? 'thanks' : 'drive';
    this.phaseT = 0;
    // start at the last house, or just down the road for the very first lawn
    this.fromX = this.next > 0 ? this.lotX(this.next - 1) + 3 : nextX - 16;
    this.toX = nextX + 3.5;
    this.mower.x = this.fromX;
    this.mower.y = ROAD_Z;
    this.mower.heading = 0;
    this.camX = this.next > 0 ? this.lotX(this.next - 1) : nextX - 6;
    if (thanks) {
      const lot = this.lots.get(this.next - 1);
      lot.hop = 2.5;
      this.fx.confetti(lot.x, 0, 6, 120, 10);
      sfx.cheer();
      say(pick([`Thank you! My lawn looks great!`, `Thank you so much!`, 'Hooray! Thank you!']), { force: true });
    }
    this.ignoreTouch = !!g.input?.down;
    this.layout();
    this.updateCamera(0, true);
  }

  leave() {
    stopEngine();
  }

  layout() {
    const { W, H, safe } = this.g;
    this.camera.aspect = W / H;
    // keep about one and a half houses across, whichever way the device is held
    const fovH = 2 * Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    this.camDist = clamp(26 / (2 * Math.tan(fovH / 2)), 20, 52);
    this.camera.updateProjectionMatrix();
    this.homeBtn.set(safe.l + 42, safe.t + 40, 28);
    const r = clamp(Math.min(W, H) * 0.09, 40, 60);
    this.goBtn.set(W - safe.r - r - 20, H - safe.b - r - 20, r);
  }

  resize() {
    this.layout();
  }

  dive() {
    if (this.diving) return;
    stopEngine();
    this.diving = { t: 0 };
    sfx.whoosh();
  }

  down(x, y) {
    if (hitButtons([this.homeBtn, this.goBtn], x, y)) {
      this.ignoreTouch = true;
      return;
    }
    if (this.diving) return;
    this.drag = { x, y, camX: this.camX, moved: false };
  }

  move(x, y) {
    const d = this.drag;
    if (!d || this.ignoreTouch) return;
    if (Math.abs(x - d.x) > 12) d.moved = true;
    if (d.moved) {
      this.browsing = true;
      const perPx = (2 * this.camDist * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect) / this.g.W;
      this.camX = clamp(d.camX - (x - d.x) * perPx, this.lotX(this.first), this.lotX(this.next));
    }
  }

  up(x, y) {
    const d = this.drag;
    this.drag = null;
    if (this.ignoreTouch) {
      this.ignoreTouch = false;
      return;
    }
    if (!d || d.moved || this.diving) return;
    // tapped a house: its owner says hello
    let best = null;
    let bd = Infinity;
    for (const lot of this.lots.values()) {
      const p = new THREE.Vector3(lot.x, 1.5, -2).project(this.camera);
      const sx = ((p.x + 1) / 2) * this.g.W;
      const dd = Math.abs(sx - x);
      if (dd < bd) {
        bd = dd;
        best = lot;
      }
    }
    if (!best || bd > this.g.W * 0.4) return;
    if (best.i === this.next) {
      this.dive();
      return;
    }
    best.hop = 1.2;
    sfx.surprise();
    const pic = PICTURES[best.def.picture];
    say(pick([`Hi! I'm ${best.def.owner.name}!`, `Thank you for mowing my lawn!`, pic ? `Look, ${pic.name}!` : 'Hello!']), { force: true });
    if (this.phase !== 'drive') this.browsing = true;
  }

  updateCamera(dt, snap = false) {
    let tx = this.camX;
    let ty = 0.5;
    let tz = 0;
    let dist = this.camDist;
    let pitch = 0.42;
    if (this.diving) {
      const k = easeOutCubic(clamp(this.diving.t / 0.9, 0, 1));
      const nx = this.lotX(this.next);
      tx = lerp(this.camX, nx, k);
      tz = lerp(0, 1.2, k);
      dist = lerp(this.camDist, 9, k);
      pitch = lerp(0.42, 1.0, k);
    }
    const cam = this.camera;
    const want = new THREE.Vector3(tx, ty + Math.sin(pitch) * dist, tz + Math.cos(pitch) * dist);
    if (snap || this.diving) cam.position.copy(want);
    else cam.position.lerp(want, 1 - Math.exp(-dt * 4));
    cam.lookAt(tx, ty, tz);
  }

  update(dt) {
    const { g } = this;
    this.t += dt;
    this.phaseT += dt;
    const m = this.mower;
    const nextX = this.lotX(this.next);

    if (this.phase === 'thanks') {
      if (this.phaseT > 2.4) {
        this.phase = 'drive';
        this.phaseT = 0;
      }
    } else if (this.phase === 'drive') {
      startEngine();
      const dur = Math.max(1.4, Math.abs(this.toX - this.fromX) / 9);
      const k = clamp(this.phaseT / dur, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const px = m.x;
      m.x = lerp(this.fromX, this.toX, e);
      const v = (m.x - px) / Math.max(dt, 1e-3);
      m.speed01 = clamp(v / 10, 0, 1);
      m.travel += Math.abs(m.x - px);
      setEngine(m.speed01);
      if (!this.browsing) this.camX = lerp(this.camX, m.x - 2, 1 - Math.exp(-dt * 3));
      if (k >= 1) {
        this.phase = 'arrive';
        this.phaseT = 0;
        m.speed01 = 0;
        stopEngine();
        const lot = this.lots.get(this.next);
        lot.hop = 1.5;
        const def = lot.def;
        say(def.n === 0 ? `Hi! I'm ${def.owner.name}. Can you mow my lawn?` : pick([`Hi! I'm ${def.owner.name}. Can you mow my lawn?`, `${def.owner.name} needs help! Let's mow!`, `My grass is so tall! Can you help?`]), { force: true });
      }
    } else if (this.phase === 'arrive') {
      if (!this.browsing) this.camX = lerp(this.camX, nextX, 1 - Math.exp(-dt * 3));
      if (this.phaseT > 3 && !this.browsing) this.dive();
    }

    if (this.diving) {
      this.diving.t += dt;
      this.fade = clamp((this.diving.t - 0.5) / 0.4, 0, 1);
      if (this.diving.t > 0.95) {
        this.diving = null;
        g.go('play');
        return;
      }
    }

    // owners bounce when they're happy
    for (const lot of this.lots.values()) {
      lot.hop = Math.max(0, lot.hop - dt);
      const o = lot.owner;
      if (!o) continue;
      const waiting = lot.i === this.next;
      o.position.y = lot.hop > 0 ? Math.abs(Math.sin(this.t * 8)) * 1 : waiting ? Math.abs(Math.sin(this.t * 3)) * 0.25 : 0;
      o.material.rotation = waiting || lot.hop > 0 ? Math.sin(this.t * 6) * 0.15 : 0;
      if (lot.hop > 0 && Math.random() < dt * 6) this.fx.sparkle(lot.x - 1 + rand(-1, 1), 2.5, -4, '#fff59d', 2);
    }
    this.arrow.position.set(nextX, 0.5 + Math.abs(Math.sin(this.t * 4)) * 0.7, 2.6);

    // the sky and light follow the world we're looking at
    const look = this.lots.get(clamp(Math.round(this.camX / LOT), this.first, this.next));
    const L = LIGHTS[look?.def.theme.id] || LIGHTS.day;
    const k = 1 - Math.exp(-dt * 3);
    this.scene.background.lerp(_c.set(L.sky), k);
    this.lights.hemi.color.lerp(_c.set(L.hemiSky), k);
    this.lights.hemi.groundColor.lerp(_c.set(L.hemiGround), k);
    this.lights.hemi.intensity = lerp(this.lights.hemi.intensity, L.hemi, k);
    this.lights.sun.intensity = lerp(this.lights.sun.intensity, L.sun, k);
    this.lights.sun.position.set(this.camX - 8, 20, 10);
    this.lights.sun.target.position.set(this.camX, 0, 0);
    this.far.material.color.lerp(_c.set(look?.def.theme.bg[1] || '#8fd97a'), k);
    const dark = look && (look.def.theme.id === 'night' || look.def.theme.id === 'moon');
    this.stars.material.opacity = lerp(this.stars.material.opacity, dark ? 0.9 : 0, k);
    this.mower3d.setLights(!!dark);

    this.fx.update(dt);
    this.mower3d.update(m, () => 0, this.t);
    this.updateCamera(dt);
  }

  render3d(renderer) {
    renderer.render(this.scene, this.camera);
  }

  draw(ctx) {
    const { W, H } = this.g;
    this.homeBtn.draw(ctx, this.t);
    if (this.phase !== 'drive' || this.browsing) this.goBtn.draw(ctx, this.t);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
