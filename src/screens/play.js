import { CUT, CUT_RADIUS, Lawn, MOWER_CELLS, TALL, stripeShade } from '../lawn.js';
import { levelDef } from '../levels.js';
import { Mower } from '../mower.js';
import { Particles } from '../particles.js';
import { MOWER_BY_ID, STICKERS } from '../catalog.js';
import { PICTURES } from '../pictures.js';
import { sfx, setEngine, startEngine, stopEngine } from '../audio.js';
import { setMusicMood } from '../music.js';
import { say } from '../speech.js';
import { Button, hitButtons } from '../ui.js';
import { Celebration } from './celebration.js';
import { THREE, castAll, isDarkTheme, makeLights, makeSky } from '../world3d/renderer.js';
import { CameraRig } from '../world3d/camera.js';
import { Ground, YARD } from '../world3d/ground.js';
import { Grass } from '../world3d/grass.js';
import { Mower3D } from '../world3d/mower3d.js';
import { Effects3D } from '../world3d/effects3d.js';
import { Ambient3D } from '../world3d/ambient3d.js';
import { makeAnimal } from '../world3d/animals.js';
import { disposeTree, makeEmoji, makeShadow } from '../world3d/sprites.js';
import { makeHintRing, makeRamp } from '../world3d/props.js';
import { makeObstacle, makeYard } from '../world3d/scenery.js';
import { hillHeight } from '../terrain.js';
import { Buddies } from '../buddies.js';
import { POWER, PowerUps } from '../powerups.js';
import { Events } from '../events.js';
import {
  clamp, drawEmoji, drawStar, drawText, easeOutBack, easeOutCubic, lerp, pick, rand, roundRectPath, shuffle, weightedPick,
} from '../util.js';

const ALMOST = ['Almost done!', 'Just a little more!', 'You can do it!'];
const TEASE = ["What's the picture?", 'I see a picture!', 'What could it be?'];
const REVEAL_TIME = 3;
const ADMIRE_TIME = 4;
const _chute = new THREE.Vector3();

export class PlayScreen {
  constructor(game) {
    this.g = game;
    this.uses3D = true;
    this.lawn = null;
    this.state = 'none';
    this.t = 0;
    this.particles = new Particles(); // 2D, for the HUD and the card
    this.actors = []; // 2D stars and stickers flying to the HUD
    this.critters = []; // 3D surprises popping out of the grass
    this.celebration = new Celebration(game, this);
    this.homeBtn = new Button({ icon: '🏠', color: '#ffb74d', onTap: () => { sfx.tap(); game.go('menu'); } });
    this.hornBtn = new Button({ icon: '📣', color: '#ef5350', onTap: () => this.honk() });
    this.dispProgress = 0;
    this.starBump = 0;
    this.bookBump = 0;
    this.pendingStars = 0; // stars already banked but still flying to the counter
    this.saveT = 0;
    this.hornT = 0;

    // the 3D scene; everything for one lawn lives in this.world
    this.scene = new THREE.Scene();
    this.lights = makeLights(this.scene);
    this.sky = makeSky(this.scene);
    this.rig = new CameraRig();
    this.fx = new Effects3D(this.scene);
    this.mower3d = null;
    this.hintRing = makeHintRing();
    this.hintFinger = makeEmoji('👇', 1.6, { depthTest: false });
    this.hintRing.visible = this.hintFinger.visible = false;
    this.hintFinger.renderOrder = 10;
    this.scene.add(this.hintRing, this.hintFinger);
    this.world = null;
  }

  enter() {
    if (!this.lawn && this.g.save.current) this.resumeLawn(this.g.save.current);
    if (!this.lawn || this.state === 'celebrate') this.newLawn();
    else this.layout();
    // the finger that tapped Play shouldn't start steering until it's lifted
    this.ignoreTouch = !!this.g.input?.down;
    setMusicMood(this.state === 'celebrate' ? 'bouncy' : 'calm');
    // the chosen mower might have changed in the garage
    if (this.mower) {
      this.mower.skin = MOWER_BY_ID[this.g.save.mower] || MOWER_BY_ID.red;
      this.mower3d.setSkin(this.mower.skin);
    }
  }

  leave() {
    stopEngine();
    setMusicMood('bouncy');
    this.g.persist();
  }

  // What to save for the lawn in progress: undefined = no lawn loaded yet (keep
  // whatever is saved), null = nothing to resume (between lawns).
  snapshot() {
    if (!this.lawn) return undefined;
    if (this.state !== 'mow' && this.state !== 'finish' && this.state !== 'admire' && this.state !== 'reveal') return null;
    const { lawn, mower } = this;
    return { v: 2, ...lawn.serialize(), mower: { gx: mower.x, gy: mower.y, heading: mower.heading } };
  }

  hudTop() {
    if (this.narrow()) return this.g.safe.t + 112; // progress bar gets its own row
    return this.g.safe.t + (this.g.H < 500 ? 64 : 76);
  }

  pickSurprises(def) {
    const save = this.g.save;
    const out = [];
    const pool = STICKERS.filter((s) => !s.rare && (!s.theme || s.theme === def.theme.id));
    const rares = STICKERS.filter((s) => s.rare);
    for (let i = 0; i < def.surprises; i++) {
      if (def.n >= 2 && Math.random() < 0.08 && rares.length) {
        const s = weightedPick(rares, (r) => (save.stickers[r.id] ? 1 : 3));
        rares.splice(rares.indexOf(s), 1);
        out.push({ type: 'sticker', s });
      } else if (pool.length) {
        // prefer things not found yet, and this world's special critters
        const s = weightedPick(pool, (p) => (save.stickers[p.id] ? 1 : 4) * (p.theme ? 2.5 : 1));
        pool.splice(pool.indexOf(s), 1);
        out.push({ type: 'sticker', s });
      }
    }
    for (let i = 0; i < def.coins; i++) out.push({ type: 'star' });
    return shuffle(out);
  }

  newLawn() {
    const { g } = this;
    const def = levelDef(g.save.lawns);
    const portrait = g.H > g.W * 1.05;
    this.begin(new Lawn(def, portrait, this.pickSurprises(def)));
    this.fade = 1; // fade in from the street's white flash
    if (g.save.lawns === 0) say('Touch the grass, and drive the mower!', { force: true });
    else if (def.giant) say(pick(['A giant lawn!', 'Wow, a super big lawn!']), { force: true });
    else say(pick(["Let's mow!", 'Ready, set, mow!', 'Here we go!', `Let's mow ${def.owner.name}'s lawn!`]), { force: true });
    g.persist();
  }

  // Pick up the lawn that was in progress when the app was closed.
  resumeLawn(data) {
    const lawn = Lawn.restore(levelDef(this.g.save.lawns), data);
    if (!lawn) return;
    this.begin(lawn, data.mower);
    this.hasMoved = true;
    this.milestones = this.milestones.filter((m) => m > lawn.progress);
    this.dispProgress = lawn.progress;
    // surprises that were waiting their turn when the app closed
    for (const i of lawn.surprises.keys()) if (lawn.grid[i] === CUT) this.revealQueue.push(i);
    say("Let's keep mowing!", { force: true });
  }

  disposeWorld() {
    if (!this.world) return;
    this.scene.remove(this.world);
    this.ground.dispose();
    this.grass.dispose();
    disposeTree(this.world);
    this.world = null;
    this.fx.clear();
  }

  begin(lawn, at = null) {
    const { g } = this;
    const def = lawn.def;
    const theme = def.theme;
    this.disposeWorld();
    this.lawn = lawn;
    const world = (this.world = new THREE.Group());
    this.scene.add(world);
    this.ground = new Ground(lawn);
    this.grass = new Grass(lawn);
    world.add(this.ground.group, this.grass.mesh);
    const yard = castAll(makeYard(lawn));
    world.add(yard);
    this.house = yard.userData.house;
    this.obstacleObjs = lawn.obstacles.map((o) => {
      const obj = castAll(makeObstacle(o, theme));
      obj.position.set(o.gx, hillHeight(lawn.hills, o.gx, o.gy), o.gy);
      world.add(obj);
      return { o, obj };
    });
    for (const r of lawn.ramps) world.add(castAll(makeRamp(r, lawn.hills)));
    this.plantSprites = [];
    for (const p of lawn.plants) this.addPlantSprite(p);

    const skin = MOWER_BY_ID[g.save.mower] || MOWER_BY_ID.red;
    const sx = at ? at.gx : lawn.start.gx;
    const sy = at ? at.gy : lawn.start.gy;
    this.mower = new Mower(skin, sx, sy, MOWER_CELLS);
    this.mower.heading = at ? at.heading || 0 : 0;
    this.mower.h = lawn.height(sx, sy);
    if (!this.mower3d) {
      this.mower3d = new Mower3D(skin);
      this.scene.add(this.mower3d.root, this.mower3d.shadow);
    }
    this.mower3d.setSkin(skin);
    this.mower3d.setLights(isDarkTheme(theme.id));
    this.fx.groundAt = (x, z) => lawn.height(x, z);

    this.lights.apply(theme.id, { x: lawn.cols / 2, z: lawn.rows / 2 }, Math.max(lawn.cols, lawn.rows) / 2 + YARD);
    this.sky.blend(theme.id);
    this.scene.fog = new THREE.Fog(theme.bg[1], 40, 120);

    this.state = 'mow';
    this.t = 0;
    this.idle = 0;
    this.milestones = [0.25, 0.5, 0.75, 0.9];
    this.sparkleT = 0;
    this.puffT = 0;
    this.trailT = 0;
    this.hint = -1;
    this.hintT = 0;
    this.dispProgress = 0;
    this.hasMoved = false;
    this.actors = [];
    this.critters = [];
    this.revealQueue = [];
    this.revealGap = 0;
    this.cutLevel = 0;
    this.countRows();
    setMusicMood('calm');
    this.particles.clear();
    this.pendingStars = 0;
    this.rig.release();
    this.rig.zoom = this.rig.zoomTarget = 1;
    this.powerups = new PowerUps(this);
    this.buddies = new Buddies(this);
    this.events = new Events(this);
    this.ambient = new Ambient3D(world, theme.ambient, lawn);
    this.layout();
    this.rig.snap(this.focus());
  }

  narrow() {
    return this.g.W < 560;
  }

  focus() {
    const m = this.mower;
    return { x: m.x, y: m.y, h: m.h };
  }

  layout() {
    const { g } = this;
    const lawn = this.lawn;
    this.rig.setView(g.W, g.H, this.hudTop());
    this.rig.fitLawn(lawn.cols, lawn.rows, lawn.maxHeight, MOWER_CELLS);
    const far = this.rig.baseDist * 3;
    if (this.scene.fog) {
      this.scene.fog.near = far * 0.5;
      this.scene.fog.far = far * 1.6;
    }
    const s = g.safe;
    const hy = s.t + 38;
    this.homeBtn.set(s.l + 42, hy, 28);
    this.hornBtn.set(g.W - s.r - 58, g.H - s.b - 58, 42);
    this.starPos = { x: g.W - s.r - 62, y: hy };
    this.bookPos = { x: g.W - s.r - 140, y: hy };
    this.powerPos = { x: s.l + 54, y: g.H - s.b - 54 };
    if (this.narrow()) this.bar = { x: s.l + 18, y: hy + 36, w: g.W - s.l - s.r - 60, h: 30 };
    else this.bar = { x: s.l + 86, y: hy - 16, w: g.W - s.r - 190 - (s.l + 86), h: 32 };
    this.celebration.layout();
  }

  resize() {
    if (this.lawn) this.layout();
  }

  down(x, y) {
    if (this.state === 'celebrate') {
      this.celebration.down(x, y);
      return;
    }
    if (hitButtons([this.homeBtn, this.hornBtn], x, y)) this.ignoreTouch = true;
  }

  up() {
    this.ignoreTouch = false;
    // save after each drag; the mower glides to a stop, so save again once it has
    this.g.persist();
    clearTimeout(this.stopSave);
    this.stopSave = setTimeout(() => this.g.persist(), 700);
  }

  honk() {
    if (this.hornT > 0) return;
    this.hornT = 0.45;
    sfx.honk();
    this.mower.hop(4.5);
    this.buddies?.honk();
    this.rig.shake(0.15);
    const m = this.mower;
    this.fx.emoji(pick(['🎵', '🎶']), m.x, m.h + m.size * m.scale * 0.9, m.y, { size: 1.1, life: 1, vy: 1.6, vx: rand(-0.5, 0.5) });
  }

  groundAt = (x, z) => this.lawn.height(x, z);

  update(dt) {
    const { g, lawn, mower } = this;
    this.t += dt;
    this.fade = Math.max(0, (this.fade || 0) - dt * 2.5);
    this.hornT = Math.max(0, this.hornT - dt);
    this.particles.update(dt);
    this.starBump = Math.max(0, this.starBump - dt * 3);
    this.bookBump = Math.max(0, this.bookBump - dt * 3);
    this.dispProgress = lerp(this.dispProgress, lawn.progress, 1 - Math.exp(-dt * 6));

    if (this.state === 'mow') {
      startEngine();
      let target = null;
      if (g.input.down && !this.ignoreTouch) target = this.rig.screenToGround(g.input.x, g.input.y, this.groundAt, lawn.maxHeight + 1);
      if (target) this.idle = 0;
      else this.idle += dt;
      const px = mower.x;
      const py = mower.y;
      if (mower.update(dt, target, lawn.bounds, lawn.obstacles)) {
        sfx.boing();
        this.fx.burst(mower.x, mower.h + 0.6, mower.y, 8, ['#ffffff', '#fff59d'], 0.7);
      }
      this.moveHeight(dt);
      this.cutLevel = Math.max(0, this.cutLevel - dt * 2.5);
      setEngine(Math.min(1.6, mower.speed01 * mower.speedMul), this.cutLevel);

      if (!mower.airborne && (Math.hypot(mower.x - px, mower.y - py) > 0.01 || this.t < 0.1)) {
        const R = CUT_RADIUS * this.powerups.cutMul * Math.max(1, mower.scale * 0.9);
        const cut = lawn.mowSegment(px, py, mower.x, mower.y, R);
        if (cut.length) this.onCut(cut);
        // lay a stripe the way we're driving (over fresh cuts and old ones alike)
        if (mower.speed01 > 0.08) for (const i of lawn.stripeAt(mower.x, mower.y, R * 0.85, stripeShade(mower.heading))) this.ground.setStripe(i, lawn.shade[i]);
      }
      this.trails(dt);
      this.saveT += dt;
      if (this.saveT > 2) {
        this.saveT = 0;
        g.persist();
      }

      const prog = lawn.progress;
      while (this.milestones.length && prog >= this.milestones[0]) {
        const m = this.milestones.shift();
        sfx.chime(Math.round(m * 4));
        this.particles.burst(this.bar.x + this.bar.w * m, this.bar.y + this.bar.h / 2, 12, 0.7);
        if (m === 0.5) say(pick(TEASE));
        if (m === 0.9) say(pick(ALMOST));
      }

      // the mid-lawn surprise
      if (lawn.def.event && !lawn.eventDone && prog >= lawn.eventAt) {
        lawn.eventDone = true;
        this.events.start(lawn.def.event);
        g.persist();
      }

      // the last bits sparkle so they're easy to find
      if (prog >= 0.82) {
        this.sparkleT -= dt;
        if (this.sparkleT <= 0) {
          this.sparkleT = 0.28;
          const tall = lawn.tallCells();
          if (tall.length) {
            const c = lawn.cellCenter(pick(tall));
            this.fx.sparkle(c.x, lawn.height(c.x, c.y) + 0.5, c.y, '#fff59d', 1.4);
          }
        }
      }

      // gentle hint: point to the nearest grass if nothing is happening
      if (this.idle > 4 && this.hasMoved) {
        this.hintT -= dt;
        if (this.hintT <= 0) {
          this.hintT = 0.5;
          this.hint = lawn.nearestTall(mower.x, mower.y);
        }
      } else this.hint = -1;

      // never make a little one hunt for the last blade of grass
      const remaining = lawn.total - lawn.cutCount;
      if (prog >= 0.96 || remaining <= 3) this.startFinish();
    } else if (this.state === 'finish') {
      setEngine(0);
      this.moveHeight(dt);
      this.finishT += dt;
      const want = Math.ceil((this.finishT / 0.9) * this.finishList.length);
      while (this.finishDone < Math.min(want, this.finishList.length)) {
        const i = this.finishList[this.finishDone++];
        if (lawn.cutCell(i)) {
          const c = lawn.cellCenter(i);
          const h = lawn.height(c.x, c.y);
          if (this.finishDone % 2) this.fx.sparkle(c.x, h + 0.4, c.y, '#fff59d', 1.2);
          this.fx.clippings(c.x, h, c.y, lawn.theme.blades, 1);
          lawn.shade[i] = stripeShade(this.mower.heading);
          this.ground.setStripe(i, lawn.shade[i]);
          this.applyCut([i]);
        }
        sfx.snip(1);
      }
      if (this.finishDone >= this.finishList.length && this.finishT > 1.0) this.startAdmire();
    } else if (this.state === 'admire') {
      // a quiet moment: glide slowly over the fresh stripes
      this.mower.update(dt, null, lawn.bounds, lawn.obstacles);
      this.moveHeight(dt);
      this.admireT += dt;
      const k = clamp(this.admireT / ADMIRE_TIME, 0, 1);
      const e = k * k * (3 - 2 * k);
      const o = this.rig.override;
      if (lawn.cols >= lawn.rows) o.target.set(lerp(lawn.cols * 0.15, lawn.cols * 0.85, e), 0, lawn.rows * 0.55);
      else o.target.set(lawn.cols * 0.5, 0, lerp(lawn.rows * 0.85, lawn.rows * 0.15, e));
      if (this.admireT >= ADMIRE_TIME) this.startReveal();
    } else if (this.state === 'reveal') {
      // drive aside to show off the picture
      if (this.mower.update(dt, this.revealT < 1.6 ? this.parkSpot : null, lawn.bounds, lawn.obstacles)) sfx.boing();
      this.moveHeight(dt);
      this.revealT += dt;
      if (this.revealT > 0.5 && !this.said) {
        this.said = true;
        const pic = PICTURES[lawn.def.picture];
        say(pic ? `Look! It's ${pic.name}!` : 'Look at that!', { force: true });
        sfx.fanfare();
      }
      this.fwT -= dt;
      if (this.revealT > 0.8 && this.fwT <= 0) {
        this.fwT = rand(0.8, 1.2);
        this.fx.firework(rand(0, lawn.cols), rand(5, 8), rand(0, lawn.rows), 1);
        sfx.bang();
      }
      if (this.revealT >= REVEAL_TIME) {
        this.state = 'celebrate';
        setMusicMood('bouncy');
        this.celebration.start();
      }
    } else if (this.state === 'celebrate') {
      this.moveHeight(dt);
      this.celebration.update(dt);
    }

    this.updateWorld(dt);
    this.updateActors(dt);
  }

  // Ride over hills, fly off ramps.
  moveHeight(dt) {
    const { mower, lawn } = this;
    const r = mower.updateHeight(dt, lawn.height(mower.x, mower.y));
    if (r === 'launch') {
      sfx.wheee();
      say(pick(['Wheee!', 'Whoa!', 'Up up and away!']));
    } else if (r === 'land') {
      sfx.land();
      this.rig.shake(0.25);
      const s = mower.size * mower.scale;
      for (let i = 0; i < 5; i++) this.fx.puff(mower.x + rand(-s, s) * 0.4, mower.h + 0.2, mower.y + rand(-s, s) * 0.4, 1.6);
    }
  }

  startFinish() {
    const { lawn, mower } = this;
    this.state = 'finish';
    this.finishT = 0;
    this.finishDone = 0;
    this.hint = -1;
    this.finishList = lawn.tallCells().sort((a, b) => {
      const pa = lawn.cellCenter(a);
      const pb = lawn.cellCenter(b);
      return (pa.x - mower.x) ** 2 + (pa.y - mower.y) ** 2 - ((pb.x - mower.x) ** 2 + (pb.y - mower.y) ** 2);
    });
    sfx.whoosh();
  }

  // The lawn is done: swoop up to show off the picture before the stars.
  startReveal() {
    this.lawn.cutCount = this.lawn.total;
    this.grass.clearAll();
    this.ground.clearAll();
    stopEngine();
    this.events.finish();
    this.powerups.clear();
    this.parkSpot = this.spotBesidePicture();
    this.state = 'reveal';
    this.revealT = 0;
    this.fwT = 0;
    this.said = false;
    this.rig.swoopTopDown();
    this.fx.confetti(this.lawn.cols / 2, this.lawn.rows / 2, Math.max(this.lawn.cols, this.lawn.rows) / 2, 70, 12);
    this.g.persist();
  }

  // The last blade is cut: everything goes quiet and the camera drifts low
  // over the new stripes before the picture is shown.
  startAdmire() {
    const { lawn } = this;
    stopEngine();
    this.state = 'admire';
    this.admireT = 0;
    this.hint = -1;
    this.grass.clearAll();
    this.ground.clearAll();
    this.rig.override = { target: new THREE.Vector3(lawn.cols * 0.15, 0, lawn.rows * 0.55), dist: Math.max(lawn.cols, lawn.rows) * 0.75 + 5, pitch: 0.55 };
    sfx.calm();
    this.g.persist();
  }

  // Somewhere just off the picture, so the mower doesn't hide it.
  spotBesidePicture() {
    const { lawn, mower } = this;
    const b = lawn.pictureBox;
    const r = mower.radius + 0.3;
    const spots = [
      { x: b.x - r, y: mower.y }, { x: b.x + b.w + r, y: mower.y },
      { x: mower.x, y: b.y + b.h + r }, { x: mower.x, y: b.y - r },
    ].map((p) => ({ x: clamp(p.x, 0, lawn.cols), y: clamp(p.y, 0, lawn.rows) }));
    spots.sort((p, q) => (p.x - mower.x) ** 2 + (p.y - mower.y) ** 2 - ((q.x - mower.x) ** 2 + (q.y - mower.y) ** 2));
    return spots[0];
  }

  // How much grass is in each row and column, so finishing one can chime.
  countRows() {
    const { lawn } = this;
    this.rowLeft = new Int16Array(lawn.rows);
    this.colLeft = new Int16Array(lawn.cols);
    this.rowsDone = 0;
    for (let i = 0; i < lawn.grid.length; i++)
      if (lawn.grid[i] === TALL) {
        this.rowLeft[(i / lawn.cols) | 0]++;
        this.colLeft[i % lawn.cols]++;
      }
  }

  applyCut(cells) {
    const { lawn } = this;
    for (const i of cells) {
      this.grass.cut(i);
      this.ground.setTall(i, false);
      if (lawn.surprises.has(i) && !this.revealQueue.includes(i)) this.revealQueue.push(i);
      // a soft chime, a little higher each time, when a whole row or column is done
      const r = (i / lawn.cols) | 0;
      const c = i % lawn.cols;
      const rowDone = --this.rowLeft[r] === 0;
      const colDone = --this.colLeft[c] === 0;
      if (rowDone || colDone) {
        if (this.state === 'mow') sfx.rowChime(this.rowsDone);
        this.rowsDone++;
      }
      if (this.rowLeft[r] < 0) this.rowLeft[r] = 0;
      if (this.colLeft[c] < 0) this.colLeft[c] = 0;
    }
  }

  onCut(cells) {
    const { lawn, mower } = this;
    if (lawn.cutCount > 12) this.hasMoved = true;
    this.cutLevel = Math.min(1, this.cutLevel + cells.length * 0.12);
    // clippings fly out of the chute on the mower's side
    const n = Math.min(2, cells.length);
    const p = this.mower3d.chutePos(_chute);
    for (let k = 0; k < n; k++) this.fx.clippings(p.x, p.y, p.z, lawn.theme.blades, 2, mower.heading + Math.PI * 0.6);
    this.applyCut(cells);
  }

  trails(dt) {
    const { mower } = this;
    if (mower.speed01 < 0.1 || mower.airborne) return;
    const back = mower.heading + Math.PI;
    const s = mower.size * mower.scale;
    const bx = mower.x + Math.cos(back) * s * 0.5;
    const bz = mower.y + Math.sin(back) * s * 0.5;
    const by = mower.h + 0.3 * mower.scale;
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 0.4;
      this.fx.puff(bx, by + 0.6 * mower.scale, bz, mower.scale);
    }
    const trail = mower.skin.trail;
    if (!trail) return;
    this.trailT -= dt;
    if (this.trailT > 0) return;
    this.trailT = trail === 'flame' ? 0.05 : 0.12;
    if (trail === 'sparkle') this.fx.sparkle(bx, by, bz, pick(['#fff59d', '#ffffff', '#e1bee7']), 1.4);
    else if (trail === 'hearts') this.fx.emoji('💖', bx, by + 0.4, bz, { size: 0.7, life: 0.9, vy: 1.2, spin: rand(-1, 1) });
    else if (trail === 'rainbow') this.fx.sparkle(bx, by, bz, `hsl(${Math.round((this.t * 360) % 360)}, 90%, 60%)`, 2);
    else if (trail === 'flame') this.fx.flame(bx, by, bz, Math.cos(back) * 3, Math.sin(back) * 3);
  }

  // A star pops out of the world and flies up to the counter.
  awardStar(x, y, z) {
    const { g } = this;
    sfx.pop();
    this.fx.burst(x, y, z, 8, ['#ffd54f', '#fff59d', '#ffffff'], 0.7);
    const p = this.rig.toScreen(x, y, z);
    this.actors.push({ type: 'star', x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0, cell: clamp(this.rig.pxPerCell(x, y, z), 16, 60) });
    g.save.stars += 1;
    this.pendingStars++;
    g.persist();
  }

  addPlant(e, gx, gy) {
    const p = { e, gx, gy, age: 0, ph: rand(0, 6) };
    this.lawn.plants.push(p);
    this.addPlantSprite(p);
  }

  addPlantSprite(p) {
    const s = makeEmoji(p.e, 1.4);
    s.position.set(p.gx, this.lawn.height(p.gx, p.gy), p.gy);
    s.userData.plant = p;
    this.world.add(s);
    this.plantSprites.push(s);
  }

  reveal(i) {
    const { lawn, g, mower } = this;
    const kind = lawn.surprises.get(i);
    lawn.surprises.delete(i);
    const c = lawn.cellCenter(i);
    const h = lawn.height(c.x, c.y);
    if (kind.type === 'star') {
      this.awardStar(c.x, h + 0.5, c.y);
      return;
    }
    const s = kind.s;
    const first = !g.save.stickers[s.id];
    g.save.stickers[s.id] = (g.save.stickers[s.id] || 0) + 1;
    g.persist();
    if (s.rare) {
      sfx.rare();
      this.fx.firework(c.x, h + 2, c.y, 0.8);
      say(`Wow! A ${s.name}!`, { force: true });
    } else {
      sfx.surprise();
      say(first ? `You found a ${s.name}!` : `${s.name}!`, { force: first });
    }
    this.fx.burst(c.x, h + 0.5, c.y, s.rare ? 16 : 8, undefined, 0.8);
    // run away from the mower
    let dx = c.x - mower.x;
    let dy = c.y - mower.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const actor = makeAnimal(s.e, s.rare ? 2.6 : 2);
    actor.faceNow(dx, dy);
    const shadow = makeShadow(1.2, 0.7, 0.7);
    this.world.add(actor.root, shadow);
    this.critters.push({ s, x: c.x, y: c.y, t: 0, dx, dy, actor, shadow, rare: s.rare });
    if (s.move === 'plant') this.addPlant(s.e, c.x, c.y);
    const p = this.rig.toScreen(c.x, h + 1, c.y);
    this.actors.push({ type: 'book', e: s.e, sx: p.x, sy: p.y, x: p.x, y: p.y, t: -0.7, first });
  }

  updateWorld(dt) {
    const { lawn, mower, t } = this;
    this.grass.update(dt, t);
    this.ambient.update(dt, t);
    this.ground.update();
    this.fx.update(dt);
    this.buddies.update(dt);
    this.powerups.update(dt, t);
    this.events.update(dt);
    this.mower3d.update(mower, this.groundAt, t);

    for (const { o, obj } of this.obstacleObjs) {
      o.wobble = Math.max(0, (o.wobble || 0) - dt * 2.5);
      const w = Math.sin(t * 30) * o.wobble * 0.15;
      const wob = obj.userData.wobbler;
      if (wob?.isSprite) wob.material.rotation = w;
      else if (wob) wob.rotation.z = w;
      const duck = obj.userData.duck;
      if (duck) {
        duck.root.position.set(Math.sin(t * 0.8) * o.gr * 0.4, (duck.isModel ? -0.1 : 0.05) + Math.sin(t * 3) * 0.05, Math.cos(t * 0.6) * o.gr * 0.3);
        duck.face(Math.cos(t * 0.8), -Math.sin(t * 0.6) * 0.6);
        duck.update(dt);
      }
      obj.userData.actor?.update(dt);
      if (obj.userData.zzz) obj.userData.zzz.position.y = o.gr * 1.6 + Math.sin(t * 2) * 0.15;
    }

    for (const s of this.plantSprites) {
      const p = s.userData.plant;
      p.age += dt;
      const k = Math.min(1, p.age / 0.4);
      const sc = 1.4 * (k < 1 ? easeOutBack(k) : 1 + Math.sin(t * 3 + p.ph) * 0.04);
      s.scale.set(sc, sc, 1);
    }

    // the owner comes out to watch, and cheers at the end
    const owner = this.house?.userData.owner;
    if (owner) {
      const party = this.state === 'reveal' || this.state === 'celebrate';
      owner.root.position.y = party ? Math.abs(Math.sin(t * 7)) * 0.8 : owner.isModel ? 0 : Math.abs(Math.sin(t * 2)) * 0.1;
      owner.setTilt(party && !owner.isModel ? Math.sin(t * 7) * 0.2 : 0);
      // watch the mower
      owner.face(mower.x - this.house.position.x - owner.root.position.x, mower.y - this.house.position.z - owner.root.position.z);
      owner.update(dt);
    }

    const showHint = this.hint >= 0;
    this.hintRing.visible = this.hintFinger.visible = showHint;
    if (showHint) {
      const c = lawn.cellCenter(this.hint);
      const h = lawn.height(c.x, c.y);
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      this.hintRing.position.set(c.x, h + 0.08, c.y);
      this.hintRing.scale.setScalar(1 + pulse * 0.3);
      this.hintRing.material.opacity = 0.5 + pulse * 0.5;
      this.hintFinger.position.set(c.x, h + 1.4 + Math.abs(Math.sin(t * 5)) * 0.6, c.y);
    }

    this.rig.update(dt, this.focus());
  }

  updateActors(dt) {
    // surprises come out one at a time
    this.revealGap = Math.max(0, this.revealGap - dt);
    if (this.revealQueue.length && this.revealGap <= 0 && this.state !== 'celebrate') {
      this.revealGap = 0.9;
      const i = this.revealQueue.shift();
      if (this.lawn.surprises.has(i)) this.reveal(i);
    }
    for (const a of this.actors) {
      a.t += dt;
      if (a.type === 'star') {
        if (a.t > 0.45) {
          const k = easeOutCubic(clamp((a.t - 0.45) / 0.6, 0, 1));
          const mx = (a.sx + this.starPos.x) / 2;
          const my = Math.min(a.sy, this.starPos.y) - 120;
          a.x = (1 - k) ** 2 * a.sx + 2 * (1 - k) * k * mx + k * k * this.starPos.x;
          a.y = (1 - k) ** 2 * a.sy + 2 * (1 - k) * k * my + k * k * this.starPos.y;
          if (k >= 1 && !a.done) {
            a.done = true;
            this.pendingStars = Math.max(0, this.pendingStars - 1);
            this.starBump = 1;
            sfx.coin();
            this.particles.burst(this.starPos.x, this.starPos.y, 10, 0.6, ['#ffd54f', '#ffffff']);
          }
        } else a.y = a.sy - easeOutBack(a.t / 0.45) * a.cell * 1.5;
      } else if (a.type === 'book') {
        if (a.t < 0) continue;
        const k = easeOutCubic(clamp(a.t / 0.7, 0, 1));
        a.x = lerp(a.sx, this.bookPos.x, k);
        a.y = lerp(a.sy, this.bookPos.y, k) - Math.sin(k * Math.PI) * 80;
        if (k >= 1 && !a.done) {
          a.done = true;
          this.bookBump = 1;
          sfx.sparkle();
        }
      }
    }
    this.actors = this.actors.filter((a) => !a.done);

    // surprises leap out of the grass and leave the way they move
    const { lawn } = this;
    for (const c of this.critters) {
      c.t += dt;
      const k = clamp(c.t / 0.45, 0, 1);
      const tt = Math.max(0, c.t - 0.45);
      const m = c.s.move;
      let h = 0.6 * easeOutBack(k);
      let rot = 0;
      if (tt > 0) {
        const sp = m === 'hop' ? 3.2 : m === 'fly' ? 2.4 : m === 'crawl' ? 1.2 : 0;
        c.x += c.dx * sp * dt;
        c.y += c.dy * sp * dt;
      }
      if (m === 'hop') h += Math.abs(Math.sin(tt * 7)) * 1.2;
      if (m === 'fly') h += tt * 2 + Math.sin(tt * 8) * 0.3;
      if (m === 'crawl') rot = Math.sin(tt * 10) * 0.12;
      const gy = lawn.height(c.x, c.y);
      let alpha = c.t > 2.8 ? clamp(1 - (c.t - 2.8) / 0.6, 0, 1) : 1;
      if (m === 'plant') alpha = 1 - k * 0.6;
      const a = c.actor;
      if (a.isModel && m !== 'fly') h = 0.6 * easeOutBack(k) * (tt > 0 ? 0 : 1) + (m === 'hop' ? Math.abs(Math.sin(tt * 7)) * 0.5 : 0);
      a.root.position.set(c.x, gy + h, c.y);
      a.root.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      a.setTilt(a.isModel ? 0 : rot);
      a.setOpacity(alpha);
      if (tt > 0) a.setMotion(m === 'hop' ? 3.5 : m === 'fly' ? 2 : m === 'crawl' ? 1.2 : 0, { air: m === 'fly' });
      a.update(dt);
      c.shadow.position.set(c.x, gy + 0.04, c.y);
      c.shadow.material.opacity = 0.7 * alpha * (m === 'plant' ? 0 : 1);
      if (c.rare && Math.random() < dt * 20) this.fx.sparkle(c.x + rand(-1, 1), gy + h + rand(0, 2), c.y + rand(-1, 1), pick(['#fff59d', '#ffffff', '#f8bbd0']), 1.6);
      if (c.t > (m === 'plant' ? 0.5 : 3.4)) {
        c.done = true;
        this.world.remove(c.actor.root, c.shadow);
        c.actor.dispose();
        c.shadow.material.dispose();
      }
    }
    this.critters = this.critters.filter((c) => !c.done);
  }

  render3d(renderer) {
    renderer.render(this.scene, this.rig.camera);
  }

  drawActors(ctx, kind) {
    for (const a of this.actors) {
      if (a.type !== kind) continue;
      if (a.type === 'star') {
        const s = a.cell * 1.6 * (a.t < 0.45 ? easeOutBack(a.t / 0.45) : 1);
        drawStar(ctx, a.x, a.y, Math.max(12, s), '#ffd54f', '#f57f17', a.t * 6);
      } else if (a.type === 'book' && a.t >= 0) {
        drawEmoji(ctx, a.e, a.x, a.y, 34 + Math.sin(a.t * 20) * 3);
      }
    }
  }

  draw(ctx) {
    const { g, mower, t } = this;

    // first-ever lawn: show how to play
    if (!this.hasMoved && this.state === 'mow' && g.save.lawns === 0) {
      const m = this.rig.toScreen(mower.x, mower.h, mower.y);
      const size = this.rig.pxPerCell(mower.x, mower.h, mower.y) * mower.size;
      const k = (t % 2) / 2;
      const hx = m.x + size * (0.3 + k * 1.6);
      const hy = m.y + size * 0.3;
      ctx.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 14]);
      ctx.beginPath();
      ctx.moveTo(m.x + size * 0.3, hy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      drawEmoji(ctx, '👆', hx, hy + 26, 60);
      ctx.globalAlpha = 1;
    }

    if (this.state === 'admire' || this.state === 'reveal' || this.state === 'celebrate') {
      this.particles.draw(ctx);
      this.drawActors(ctx, 'star');
      this.drawActors(ctx, 'book');
      if (this.state === 'celebrate') this.celebration.draw(ctx);
      else this.drawStarCounter(ctx);
      return;
    }
    this.particles.draw(ctx);
    this.drawHud(ctx);
    this.drawActors(ctx, 'star');
    this.drawActors(ctx, 'book');
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.fade})`;
      ctx.fillRect(0, 0, g.W, g.H);
    }
  }

  drawStarCounter(ctx) {
    const sp = this.starPos;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRectPath(ctx, sp.x - 30, sp.y - 22, 88, 44, 22);
    ctx.fill();
    const sb = 1 + this.starBump * 0.4;
    drawStar(ctx, sp.x - 8, sp.y, 17 * sb, '#ffd54f', '#f9a825', -Math.PI / 2);
    drawText(ctx, String(this.g.save.stars - this.pendingStars), sp.x + 30, sp.y + 1, 24 * (1 + this.starBump * 0.2), { color: '#5d4037', stroke: null });
  }

  drawHud(ctx) {
    const { t, bar } = this;
    this.homeBtn.draw(ctx, t);
    this.hornBtn.draw(ctx, t);

    // progress bar - no numbers, just a filling track with a flower at the end
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRectPath(ctx, bar.x, bar.y + 3, bar.w, bar.h, bar.h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRectPath(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2);
    ctx.fill();
    const fw = Math.max(bar.h, (bar.w - 6) * this.dispProgress);
    const gr = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
    gr.addColorStop(0, '#66bb6a');
    gr.addColorStop(1, '#c6ff00');
    ctx.fillStyle = gr;
    roundRectPath(ctx, bar.x + 3, bar.y + 3, fw, bar.h - 6, (bar.h - 6) / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRectPath(ctx, bar.x + 8, bar.y + 6, Math.max(0, fw - 10), (bar.h - 6) * 0.3, 4);
    ctx.fill();
    const fl = 30 + this.dispProgress * 22 + (this.state !== 'mow' ? Math.sin(t * 8) * 6 : 0);
    drawEmoji(ctx, '🌻', bar.x + bar.w - 2, bar.y + bar.h / 2, fl, Math.sin(t * 2) * 0.15);
    if (this.mower) drawEmoji(ctx, this.mower.skin.driver, bar.x + 3 + fw - 4, bar.y + bar.h / 2 - Math.abs(Math.sin(t * 8)) * 3, 30);

    // the power-up in use, with a ring that runs down
    const pw = this.powerups?.active;
    if (pw) {
      const p = this.powerPos;
      const r = 34;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.powerups.left);
      ctx.stroke();
      drawEmoji(ctx, POWER[pw.kind].icon, p.x, p.y, 38 + Math.sin(t * 8) * 3);
    }

    // sticker book + star counter
    const bb = 1 + this.bookBump * 0.35;
    drawEmoji(ctx, '📒', this.bookPos.x, this.bookPos.y, 40 * bb, Math.sin(this.bookBump * 12) * 0.2);
    this.drawStarCounter(ctx);
  }
}
