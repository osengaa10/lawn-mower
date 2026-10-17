import { Lawn, mowerCell } from '../lawn.js';
import { levelDef } from '../levels.js';
import { Mower } from '../mower.js';
import { Ambient, Particles } from '../particles.js';
import { MOWER_BY_ID, STICKERS } from '../catalog.js';
import { sfx, setEngine, startEngine, stopEngine } from '../audio.js';
import { say } from '../speech.js';
import { Button, hitButtons } from '../ui.js';
import { Celebration } from './celebration.js';
import {
  clamp, drawEmoji, drawStar, drawText, easeOutBack, easeOutCubic, lerp, pick, rand, roundRectPath, shuffle, weightedPick,
} from '../util.js';

const PRAISE = ['Great job!', 'You are doing awesome!', 'Keep going!', 'Wow, look at that!', 'Super mowing!', 'Vroom vroom!'];
const ALMOST = ['Almost done!', 'Just a little more!', 'You can do it!'];

export class PlayScreen {
  constructor(game) {
    this.g = game;
    this.lawn = null;
    this.state = 'none';
    this.t = 0;
    this.particles = new Particles();
    this.actors = [];
    this.celebration = new Celebration(game, this);
    this.homeBtn = new Button({ icon: '🏠', color: '#ffb74d', onTap: () => { sfx.tap(); game.go('menu'); } });
    this.dispProgress = 0;
    this.starBump = 0;
    this.bookBump = 0;
  }

  enter() {
    if (!this.lawn || this.state === 'celebrate') this.newLawn();
    else this.layout();
    // the chosen mower might have changed in the garage
    if (this.mower) this.mower.skin = MOWER_BY_ID[this.g.save.mower] || MOWER_BY_ID.red;
  }

  leave() {
    stopEngine();
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
    const top = this.hudTop();
    const pad = this.pad();
    this.lawn = new Lawn(def, g.W - pad * 2, g.H - top - pad, mowerCell(g.W, g.H), this.pickSurprises(def));
    this.mower = null;
    this.layout();
    const s = this.lawn.toPx(this.lawn.start.gx, this.lawn.start.gy);
    this.mower = new Mower(MOWER_BY_ID[g.save.mower] || MOWER_BY_ID.red, s.x, s.y, this.lawn.mowerSize);
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
    this.particles.clear();
    this.ambient = new Ambient(def.theme.ambient, g.W, g.H);
    if (g.save.lawns === 0) say('Touch the grass, and drive the mower!', { force: true });
    else if (def.giant) say(pick(['A giant lawn!', 'Wow, a super big lawn!']), { force: true });
    else say(pick(["Let's mow!", 'Ready, set, mow!', 'Here we go!', 'A new lawn!']), { force: true });
  }

  narrow() {
    return this.g.W < 560;
  }

  pad() {
    const s = this.g.safe;
    return Math.max(14, s.l, s.r, s.b) + 8;
  }

  layout() {
    const { g } = this;
    const lawn = this.lawn;
    let keep = null;
    if (this.mower && lawn.cell) keep = { gx: (this.mower.x - lawn.ox) / lawn.cell, gy: (this.mower.y - lawn.oy) / lawn.cell };
    lawn.layout(g.W, g.H, this.hudTop(), this.pad());
    // a finished lawn (e.g. resized during the celebration) stays fully mowed
    if (lawn.progress >= 1) lawn.clearAllTall();
    if (this.mower) {
      this.mower.size = lawn.mowerSize;
      if (keep) {
        const p = lawn.toPx(keep.gx, keep.gy);
        this.mower.x = p.x;
        this.mower.y = p.y;
      }
    }
    this.ambient?.resize(g.W, g.H);
    const s = g.safe;
    const hy = s.t + 38;
    this.homeBtn.set(s.l + 42, hy, 28);
    this.starPos = { x: g.W - s.r - 62, y: hy };
    this.bookPos = { x: g.W - s.r - 140, y: hy };
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
    if (hitButtons([this.homeBtn], x, y)) this.ignoreTouch = true;
  }

  up() {
    this.ignoreTouch = false;
  }

  update(dt) {
    const { g, lawn, mower } = this;
    this.t += dt;
    this.ambient.update(dt);
    this.particles.update(dt);
    this.starBump = Math.max(0, this.starBump - dt * 3);
    this.bookBump = Math.max(0, this.bookBump - dt * 3);
    for (const p of lawn.plants) p.age += dt;
    this.dispProgress = lerp(this.dispProgress, lawn.progress, 1 - Math.exp(-dt * 6));

    if (this.state === 'mow') {
      startEngine();
      const target = g.input.down && !this.ignoreTouch ? { x: g.input.x, y: g.input.y } : null;
      if (target) this.idle = 0;
      else this.idle += dt;
      const px = mower.x;
      const py = mower.y;
      if (mower.update(dt, target, lawn.bounds, lawn.obstacles)) {
        sfx.boing();
        this.particles.burst(mower.x, mower.y, 6, lawn.cell / 30, ['#ffffff', '#fff59d']);
      }
      setEngine(mower.speed01);

      if (Math.hypot(mower.x - px, mower.y - py) > 0.3 || this.t < 0.1) {
        const cut = lawn.mowSegment(px, py, mower.x, mower.y);
        if (cut.length) this.onCut(cut);
      }
      this.trails(dt);

      const prog = lawn.progress;
      while (this.milestones.length && prog >= this.milestones[0]) {
        const m = this.milestones.shift();
        sfx.chime(Math.round(m * 4));
        this.particles.burst(this.bar.x + this.bar.w * m, this.bar.y + this.bar.h / 2, 12, 0.7);
        if (m === 0.5) say(pick(PRAISE));
        if (m === 0.9) say(pick(ALMOST));
      }

      // the last bits sparkle so they're easy to find
      if (prog >= 0.82) {
        this.sparkleT -= dt;
        if (this.sparkleT <= 0) {
          this.sparkleT = 0.09;
          const tall = lawn.tallCells();
          if (tall.length) {
            const c = lawn.cellCenter(pick(tall));
            this.particles.sparkle(c.x, c.y, lawn.cell / 26);
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
      this.finishT += dt;
      const want = Math.ceil((this.finishT / 0.9) * this.finishList.length);
      while (this.finishDone < Math.min(want, this.finishList.length)) {
        const i = this.finishList[this.finishDone++];
        if (lawn.cutCell(i)) {
          const c = lawn.cellCenter(i);
          this.particles.sparkle(c.x, c.y, lawn.cell / 22);
          this.particles.clippings(c.x, c.y, lawn.theme.blades, 2, lawn.cell / 30);
          if (lawn.surprises.has(i)) this.reveal(i);
        }
        sfx.snip(1);
      }
      if (this.finishDone >= this.finishList.length && this.finishT > 1.0) {
        lawn.clearAllTall();
        stopEngine();
        this.state = 'celebrate';
        this.celebration.start();
      }
    } else if (this.state === 'celebrate') {
      this.celebration.update(dt);
    }

    this.updateActors(dt);
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

  onCut(cells) {
    const { lawn, mower } = this;
    if (lawn.cutCount > 12) this.hasMoved = true;
    sfx.snip(lawn.progress);
    const n = Math.min(5, cells.length);
    const back = mower.heading + Math.PI;
    for (let k = 0; k < n; k++) {
      this.particles.clippings(
        mower.x + Math.cos(back) * mower.size * 0.3 + rand(-1, 1) * mower.size * 0.25,
        mower.y + Math.sin(back) * mower.size * 0.3 + rand(-1, 1) * mower.size * 0.25,
        lawn.theme.blades, 1, lawn.cell / 30,
      );
    }
    for (const i of cells) if (lawn.surprises.has(i)) this.reveal(i);
  }

  trails(dt) {
    const { mower, lawn } = this;
    if (mower.speed01 < 0.1) return;
    const back = mower.heading + Math.PI;
    const bx = mower.x + Math.cos(back) * mower.size * 0.5;
    const by = mower.y + Math.sin(back) * mower.size * 0.5;
    const sc = lawn.cell / 30;
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 0.22;
      this.particles.puff(bx, by, sc);
    }
    const trail = mower.skin.trail;
    if (!trail) return;
    this.trailT -= dt;
    if (this.trailT > 0) return;
    this.trailT = trail === 'flame' ? 0.03 : 0.07;
    if (trail === 'sparkle') this.particles.sparkle(bx, by, sc, pick(['#fff59d', '#ffffff', '#e1bee7']));
    else if (trail === 'hearts') this.particles.emoji('💖', bx, by, { size: 18 * sc, life: 0.8, vy: -30, vr: rand(-1, 1) });
    else if (trail === 'rainbow')
      this.particles.add({ type: 'circle', x: bx, y: by, size: 7 * sc, life: 0.7, color: `hsl(${(this.t * 360) % 360},90%,60%)`, grow: -6 * sc });
    else if (trail === 'flame')
      this.particles.add({
        type: 'circle', x: bx, y: by, vx: Math.cos(back) * 120 * sc + rand(-20, 20), vy: Math.sin(back) * 120 * sc + rand(-20, 20),
        size: rand(4, 8) * sc, life: 0.35, color: pick(['#ff9800', '#ffeb3b', '#ff5722']), grow: -10 * sc,
      });
  }

  reveal(i) {
    const { lawn, g } = this;
    const kind = lawn.surprises.get(i);
    lawn.surprises.delete(i);
    const p = lawn.cellCenter(i);
    const sc = lawn.cell / 30;
    if (kind.type === 'star') {
      sfx.pop();
      this.particles.burst(p.x, p.y, 14, sc, ['#ffd54f', '#fff59d', '#ffffff']);
      this.actors.push({ type: 'star', x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0 });
      return;
    }
    const s = kind.s;
    const first = !g.save.stickers[s.id];
    g.save.stickers[s.id] = (g.save.stickers[s.id] || 0) + 1;
    g.persist();
    if (s.rare) {
      sfx.rare();
      this.particles.firework(p.x, p.y, sc * 0.8);
      say(`Wow! A ${s.name}!`, { force: true });
    } else {
      sfx.surprise();
      say(first ? `You found a ${s.name}!` : `${s.name}!`, { force: first });
    }
    this.particles.burst(p.x, p.y, s.rare ? 30 : 16, sc);
    const dir = p.x < this.mower.x ? -1 : 1;
    this.actors.push({ type: 'critter', s, x: p.x, y: p.y, t: 0, dir, rare: s.rare });
    if (s.move === 'plant') {
      const gx = (p.x - lawn.ox) / lawn.cell;
      const gy = (p.y - lawn.oy) / lawn.cell;
      lawn.plants.push({ e: s.e, gx, gy, age: 0, ph: rand(0, 6) });
    }
    this.actors.push({ type: 'book', e: s.e, sx: p.x, sy: p.y, x: p.x, y: p.y, t: -0.7, first });
  }

  updateActors(dt) {
    const { lawn } = this;
    const cell = lawn.cell;
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
            this.g.save.stars += 1;
            this.g.persist();
            this.starBump = 1;
            sfx.coin();
            this.particles.burst(this.starPos.x, this.starPos.y, 10, 0.6, ['#ffd54f', '#ffffff']);
          }
        } else a.y = a.sy - easeOutBack(a.t / 0.45) * cell;
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
      } else if (a.type === 'critter') {
        const tt = a.t - 0.45;
        if (tt > 0) {
          const m = a.s.move;
          if (m === 'hop') a.x += a.dir * cell * 3.2 * dt;
          else if (m === 'fly') {
            a.x += a.dir * cell * 2.4 * dt;
            a.y -= cell * 2 * dt;
          } else if (m === 'crawl') a.x += a.dir * cell * 1.2 * dt;
        }
        a.done = a.t > (a.s.move === 'plant' ? 0.5 : 3.4);
      }
    }
    this.actors = this.actors.filter((a) => !a.done);
  }

  drawActors(ctx, kind) {
    const cell = this.lawn.cell;
    for (const a of this.actors) {
      if (a.type !== kind) continue;
      if (a.type === 'critter') {
        if (a.s.move === 'plant') {
          const k = clamp(a.t / 0.45, 0, 1);
          drawEmoji(ctx, a.s.e, a.x, a.y - cell * 0.8 * k, cell * 2.4 * easeOutBack(k), 0, 1 - k * 0.5);
          continue;
        }
        const k = clamp(a.t / 0.45, 0, 1);
        const tt = Math.max(0, a.t - 0.45);
        let yOff = -cell * 0.6 * easeOutBack(k);
        let rot = 0;
        if (a.s.move === 'hop') yOff -= Math.abs(Math.sin(tt * 7)) * cell * 1.2;
        if (a.s.move === 'fly') yOff += Math.sin(tt * 8) * cell * 0.3;
        if (a.s.move === 'crawl') rot = Math.sin(tt * 10) * 0.12;
        const alpha = a.t > 2.8 ? clamp(1 - (a.t - 2.8) / 0.6, 0, 1) : 1;
        const size = cell * (a.rare ? 2.6 : 2) * easeOutBack(k);
        if (a.rare) {
          ctx.globalAlpha = 0.35 * alpha;
          ctx.fillStyle = '#fff59d';
          ctx.beginPath();
          ctx.arc(a.x, a.y + yOff, size * 0.75 + Math.sin(a.t * 10) * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = `rgba(0,0,0,${0.18 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(a.x, a.y + cell * 0.4, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        drawEmoji(ctx, a.s.e, a.x, a.y + yOff, size, rot, alpha);
      } else if (a.type === 'star') {
        const s = cell * 1.3 * (a.t < 0.45 ? easeOutBack(a.t / 0.45) : 1);
        drawStar(ctx, a.x, a.y, s, '#ffd54f', '#f57f17', a.t * 6);
      } else if (a.type === 'book' && a.t >= 0) {
        drawEmoji(ctx, a.e, a.x, a.y, 34 + Math.sin(a.t * 20) * 3);
      }
    }
  }

  draw(ctx) {
    const { g, lawn, mower, t } = this;
    const { W, H } = g;
    ctx.drawImage(lawn.bgLayer, 0, 0, W, H);
    if (lawn.theme.ambient === 'twinkle') this.ambient.draw(ctx, lawn.bounds);
    lawn.drawPlants(ctx, t);
    ctx.drawImage(lawn.tallLayer, 0, 0, W, H);

    if (this.hint >= 0) {
      const c = lawn.cellCenter(this.hint);
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, lawn.cell * (1.4 + pulse * 0.4), 0, Math.PI * 2);
      ctx.stroke();
    }

    lawn.drawObstacles(ctx, t, 1 / 60);
    this.drawActors(ctx, 'critter');
    mower.draw(ctx, t, lawn.theme.dark);
    this.particles.draw(ctx);
    if (lawn.theme.ambient !== 'twinkle') this.ambient.draw(ctx);

    if (this.hint >= 0) {
      const c = lawn.cellCenter(this.hint);
      drawEmoji(ctx, '👇', c.x, c.y - lawn.cell * 2.2 - Math.abs(Math.sin(t * 5)) * 16, 48);
    }

    // first-ever lawn: show how to play
    if (!this.hasMoved && this.state === 'mow' && g.save.lawns === 0) {
      const k = (t % 2) / 2;
      const hx = mower.x + mower.size * (0.3 + k * 1.6);
      const hy = mower.y + mower.size * 0.5;
      ctx.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.setLineDash([2, 14]);
      ctx.beginPath();
      ctx.moveTo(mower.x + mower.size * 0.3, hy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      drawEmoji(ctx, '👆', hx, hy + 26, 60);
      ctx.globalAlpha = 1;
    }

    this.drawHud(ctx);
    this.drawActors(ctx, 'star');
    this.drawActors(ctx, 'book');
    if (this.state === 'celebrate') this.celebration.draw(ctx);
  }

  drawHud(ctx) {
    const { t, bar } = this;
    this.homeBtn.draw(ctx, t);

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

    // sticker book + star counter
    const bb = 1 + this.bookBump * 0.35;
    drawEmoji(ctx, '📒', this.bookPos.x, this.bookPos.y, 40 * bb, Math.sin(this.bookBump * 12) * 0.2);
    const sp = this.starPos;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRectPath(ctx, sp.x - 30, sp.y - 22, 88, 44, 22);
    ctx.fill();
    const sb = 1 + this.starBump * 0.4;
    drawStar(ctx, sp.x - 8, sp.y, 17 * sb, '#ffd54f', '#f9a825', -Math.PI / 2);
    drawText(ctx, String(this.g.save.stars), sp.x + 30, sp.y + 1, 24 * (1 + this.starBump * 0.2), { color: '#5d4037', stroke: null });
  }
}
