// The title screen: a little front yard in 3D. The chosen mower cuts stripes
// back and forth with the puppy trotting behind, the owner watches from the
// door, and when it's done the grass springs back up and it starts again.
// The yard is in the world of the next lawn to mow.
import { MOWER_BY_ID, STICKERS } from '../catalog.js';
import { sfx } from '../audio.js';
import { say } from '../speech.js';
import { Button, hitButtons, playTriangle } from '../ui.js';
import { clamp, drawStar, drawText, roundRectPath } from '../util.js';
import { CUT_RADIUS, CUT, Lawn, MOWER_CELLS, STRIPE_NONE, TALL, stripeShade } from '../lawn.js';
import { levelDef } from '../levels.js';
import { Mower } from '../mower.js';
import { THREE, castAll, makeLights, makeSky } from '../world3d/renderer.js';
import { Ground } from '../world3d/ground.js';
import { Grass } from '../world3d/grass.js';
import { Mower3D } from '../world3d/mower3d.js';
import { Effects3D } from '../world3d/effects3d.js';
import { Ambient3D } from '../world3d/ambient3d.js';
import { makeYard } from '../world3d/scenery.js';
import { makeAnimal } from '../world3d/animals.js';
import { disposeTree, makeShadow } from '../world3d/sprites.js';

const TITLE = 'Mighty Mower';
const LETTER_COLORS = ['#ff5252', '#ffab40', '#ffd740', '#69f0ae', '#40c4ff', '#b388ff'];
const COLS = 12;
const ROWS = 8;
const _v = new THREE.Vector3();
const _chute = new THREE.Vector3();

export class MenuScreen {
  constructor(game) {
    this.g = game;
    this.uses3D = true;
    this.t = 0;
    this.playBtn = new Button({ color: '#43a047', pulse: true, draw: playTriangle, onTap: () => { sfx.tap(); game.go('street'); } });
    this.garageBtn = new Button({
      icon: '🚜', color: '#42a5f5',
      onTap: () => { sfx.tap(); say('My mowers!', { force: true }); game.go('garage'); },
    });
    this.bookBtn = new Button({
      icon: '📒', color: '#ec407a',
      onTap: () => { sfx.tap(); say('My stickers!', { force: true }); game.go('stickers'); },
    });
    this.soundBtn = new Button({ icon: '🔊', color: '#90a4ae', onTap: () => this.toggleSound() });
    this.musicBtn = new Button({ icon: '🎵', color: '#90a4ae', onTap: () => this.toggleMusic() });
    this.buttons = [this.playBtn, this.garageBtn, this.bookBtn, this.soundBtn, this.musicBtn];

    this.scene = new THREE.Scene();
    this.lights = makeLights(this.scene);
    this.sky = makeSky(this.scene);
    this.scene.fog = new THREE.Fog('#bfe9ff', 40, 110);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 400);
    this.fx = new Effects3D(this.scene);
    this.world = null;
    this.key = null;
  }

  toggleSound() {
    const s = this.g.save;
    this.g.setMuted(!s.muted);
    if (!s.muted) sfx.tap();
  }

  toggleMusic() {
    const s = this.g.save;
    this.g.setMusic(!s.music);
    sfx.tap();
  }

  enter() {
    const { save } = this.g;
    const key = `${save.lawns}`;
    if (key !== this.key) this.build();
    this.key = key;
    const skin = MOWER_BY_ID[save.mower] || MOWER_BY_ID.red;
    this.mower.skin = skin;
    this.mower3d.setSkin(skin);
    this.layout();
  }

  // The yard for the world of the next lawn.
  build() {
    if (this.world) {
      this.scene.remove(this.world);
      this.ground.dispose();
      this.grass.dispose();
      disposeTree(this.world);
      this.fx.clear();
    }
    const next = levelDef(this.g.save.lawns);
    const def = { ...next, shape: 'roundrect', long: COLS, short: ROWS, obstacles: 0, ramps: 0, hills: 0, powerups: [], picture: null, event: null };
    const lawn = (this.lawn = new Lawn(def, false, []));
    const theme = def.theme;
    const world = (this.world = new THREE.Group());
    this.ground = new Ground(lawn);
    this.grass = new Grass(lawn);
    const yard = castAll(makeYard(lawn));
    this.house = yard.userData.house;
    world.add(this.ground.group, this.grass.mesh, yard);
    this.ambient = new Ambient3D(world, theme.ambient, lawn);
    this.scene.add(world);

    const skin = MOWER_BY_ID[this.g.save.mower] || MOWER_BY_ID.red;
    if (!this.mower3d) {
      this.mower3d = new Mower3D(skin);
      this.scene.add(this.mower3d.root, this.mower3d.shadow);
    }
    this.mower = new Mower(skin, -1.5, 1.2, MOWER_CELLS);
    this.mower.speedMul = 0.32;
    this.mower3d.setLights(theme.dark);
    this.fx.groundAt = (x, z) => lawn.height(x, z);

    // a puppy trots along behind
    this.pup = { actor: makeAnimal('🐶', 1.2), x: -4, y: 1.5, vx: 0, vy: 0 };
    this.pupShadow = makeShadow(0.9, 0.55, 0.7, this.pup.actor.isModel);
    world.add(this.pup.actor.root, this.pupShadow);

    this.lights.apply(theme.id, { x: COLS / 2, z: ROWS / 2 - 3 }, 22);
    this.sky.blend(theme.id);
    this.scene.fog.color.set(this.sky.horizon);
    this.planRoute();
    this.regrowT = 0;
  }

  // Back and forth in stripes, then park by the edge.
  planRoute() {
    const lanes = [];
    for (let y = 0.9; y < ROWS; y += CUT_RADIUS * 1.25) lanes.push(Math.min(y, ROWS - 0.8));
    this.route = [];
    lanes.forEach((y, i) => {
      const a = i % 2 ? COLS + 0.6 : -0.6;
      const b = i % 2 ? -0.6 : COLS + 0.6;
      this.route.push({ x: a, y }, { x: b, y });
    });
    this.route.push({ x: -2, y: ROWS + 1.5 }, { x: -2.2, y: 0.9 });
    this.leg = 0;
  }

  resize() {
    this.layout();
  }

  layout() {
    const { W, H, safe } = this.g;
    const m = Math.min(W, H);
    const r = Math.max(56, m * 0.15);
    const cy = H * 0.5;
    this.playBtn.set(W / 2, cy, r);
    this.garageBtn.set(W / 2 - r * 2.3, cy + r * 0.25, r * 0.62);
    this.bookBtn.set(W / 2 + r * 2.3, cy + r * 0.25, r * 0.62);
    this.soundBtn.set(safe.l + 38, safe.t + 38, 26);
    this.musicBtn.set(safe.l + 100, safe.t + 38, 26);
    // fit the lawn and a bit of yard across the screen, house up top
    const cam = this.camera;
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    const fovH = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
    // held upright the lawn can run off the sides; look down more so it fills the screen
    const tall = cam.aspect < 1;
    this.camDist = clamp((COLS + (tall ? 1 : 7)) / 2 / Math.tan(fovH / 2), 20, 46);
    this.pitch = tall ? 0.6 : 0.5;
    this.lookZ = tall ? -1.5 : ROWS / 2 - 2.2;
  }

  down(x, y) {
    if (hitButtons(this.buttons, x, y)) return;
    // tap the puppy or the owner to say hi
    const pick = (obj, h) => {
      obj.getWorldPosition(_v);
      _v.y += h;
      _v.project(this.camera);
      const sx = ((_v.x + 1) / 2) * this.g.W;
      const sy = ((1 - _v.y) / 2) * this.g.H;
      return Math.hypot(sx - x, sy - y) < 70;
    };
    if (pick(this.pup.actor.root, 0.6)) {
      sfx.bark();
      this.pup.actor.react('hop');
      this.pupHop = 1;
    }
    const owner = this.house.userData.owner;
    if (owner && pick(owner.root, 0.8)) {
      sfx.surprise();
      owner.react('happy');
      this.ownerHop = 1;
      say(`Hi! I'm ${this.lawn.def.owner.name}!`, { force: true });
    }
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const { lawn, mower } = this;

    // drive the route; cut as we go
    const wp = this.route[this.leg];
    if (wp) {
      const px = mower.x;
      const py = mower.y;
      mower.update(dt, wp, { x: -3, y: -1, w: COLS + 6, h: ROWS + 4 }, []);
      if (Math.hypot(wp.x - mower.x, wp.y - mower.y) < 0.7) this.leg++;
      const cut = lawn.mowSegment(px, py, mower.x, mower.y, CUT_RADIUS);
      if (cut.length) {
        for (const i of cut) {
          this.grass.cut(i);
          this.ground.setTall(i, false);
        }
        const p = this.mower3d.chutePos(_chute);
        this.fx.clippings(p.x, p.y, p.z, lawn.theme.blades, 1, mower.heading + Math.PI * 0.6);
      }
      for (const i of lawn.stripeAt(mower.x, mower.y, CUT_RADIUS * 0.85, stripeShade(mower.heading))) this.ground.setStripe(i, lawn.shade[i]);
    } else {
      // parked: the grass springs back up, then off we go again
      mower.update(dt, null, { x: -3, y: -1, w: COLS + 6, h: ROWS + 4 }, []);
      this.regrowT += dt;
      if (this.regrowT > 1 && !this.regrown) {
        this.regrown = true;
        for (let i = 0; i < lawn.grid.length; i++)
          if (lawn.grid[i] === CUT) {
            lawn.grid[i] = TALL;
            this.ground.setTall(i, true);
          }
        lawn.cutCount = 0;
        lawn.shade.fill(STRIPE_NONE);
        this.ground.clearStripes();
        this.grass.regrowAll();
        for (let k = 0; k < 6; k++) this.fx.sparkle(Math.random() * COLS, 0.4, Math.random() * ROWS, '#fff59d', 1.6);
      }
      if (this.regrowT > 3) {
        this.regrowT = 0;
        this.regrown = false;
        this.planRoute();
      }
    }
    mower.updateHeight(dt, 0);

    // the puppy follows a little way behind
    const pup = this.pup;
    const tx = mower.x - Math.cos(mower.heading) * 2.6;
    const ty = mower.y - Math.sin(mower.heading) * 2.6;
    const ex = tx - pup.x;
    const ey = ty - pup.y;
    const d = Math.hypot(ex, ey);
    const want = d > 0.5 ? Math.min(6, (d - 0.5) * 3) : 0;
    const k = 1 - Math.exp(-dt * 6);
    pup.vx += ((d > 0.01 ? ex / d : 0) * want - pup.vx) * k;
    pup.vy += ((d > 0.01 ? ey / d : 0) * want - pup.vy) * k;
    pup.x += pup.vx * dt;
    pup.y += pup.vy * dt;
    const sp = Math.hypot(pup.vx, pup.vy);
    this.pupHop = Math.max(0, (this.pupHop || 0) - dt * 2.5);
    const ph = Math.sin(this.pupHop * Math.PI) * 1.2;
    pup.actor.root.position.set(pup.x, ph + (pup.actor.isModel ? 0 : Math.abs(Math.sin(t * 9)) * 0.15 * Math.min(1, sp)), pup.y);
    if (sp > 0.3) pup.actor.face(pup.vx, pup.vy);
    else pup.actor.face(mower.x - pup.x, mower.y - pup.y);
    pup.actor.setMotion(sp);
    pup.actor.update(dt);
    this.pupShadow.position.set(pup.x, 0.04, pup.y);

    const owner = this.house.userData.owner;
    if (owner) {
      this.ownerHop = Math.max(0, (this.ownerHop || 0) - dt * 2);
      owner.root.position.y = Math.sin(this.ownerHop * Math.PI) * 0.8;
      owner.face(mower.x - this.house.position.x - owner.root.position.x, mower.y - this.house.position.z - owner.root.position.z);
      owner.update(dt);
    }

    this.mower3d.update(mower, () => 0, t);
    this.grass.update(dt, t);
    this.ground.update();
    this.ambient.update(dt, t);
    this.fx.update(dt);
    this.sky.update(dt);

    // a slow drift so the scene feels alive
    const cam = this.camera;
    const a = Math.sin(t * 0.12) * 0.12;
    const pitch = this.pitch;
    const tx2 = COLS / 2 + Math.sin(t * 0.17) * 0.6;
    const tz = this.lookZ;
    cam.position.set(tx2 + Math.sin(a) * this.camDist * Math.cos(pitch), Math.sin(pitch) * this.camDist, tz + Math.cos(a) * this.camDist * Math.cos(pitch));
    cam.lookAt(tx2, 0, tz);
  }

  render3d(renderer) {
    renderer.render(this.scene, this.camera);
  }

  draw(ctx) {
    const { W, H, save } = this.g;
    const t = this.t;

    // bouncy title
    const ts = Math.min(W / 9, H / 7.5, 84);
    ctx.save();
    ctx.font = `900 ${ts}px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
    const widths = [...TITLE].map((ch) => ctx.measureText(ch).width);
    ctx.restore();
    const total = widths.reduce((a, b) => a + b, 0);
    let x = W / 2 - total / 2;
    const ty = Math.max(this.g.safe.t + ts * 0.8, H * 0.2);
    [...TITLE].forEach((ch, i) => {
      const y = ty + Math.sin(t * 3 + i * 0.5) * ts * 0.08;
      drawText(ctx, ch, x + widths[i] / 2, y, ts, { color: LETTER_COLORS[i % LETTER_COLORS.length], stroke: '#ffffff' });
      x += widths[i];
    });

    for (const b of this.buttons) b.draw(ctx, t);
    if (save.muted) this.slash(ctx, this.soundBtn);
    if (!save.music) this.slash(ctx, this.musicBtn);

    // stars + sticker count
    const px = W - this.g.safe.r - 70;
    const py = this.g.safe.t + 38;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRectPath(ctx, px - 36, py - 22, 100, 44, 22);
    ctx.fill();
    drawStar(ctx, px - 12, py, 17, '#ffd54f', '#f9a825');
    drawText(ctx, String(save.stars), px + 28, py + 1, 24, { color: '#5d4037', stroke: null });
    const found = STICKERS.filter((s) => save.stickers[s.id]).length;
    drawText(ctx, `${found}`, this.bookBtn.x, this.bookBtn.y + this.bookBtn.r + 16, 20, { color: '#ffffff', stroke: 'rgba(0,0,0,0.4)' });
  }

  slash(ctx, b) {
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x - b.r * 0.6, b.y - b.r * 0.6);
    ctx.lineTo(b.x + b.r * 0.6, b.y + b.r * 0.6);
    ctx.stroke();
  }
}
