// One surprise partway through each lawn: a balloon drops a present,
// sprinklers pop up, a cow comes to help, or stars or candy rain down.
// They never get in the way of mowing.
import { makeBalloon, makePresent, makeSprinkler } from './world3d/props.js';
import { makeEmoji, makeShadow } from './world3d/sprites.js';
import { makeAnimal } from './world3d/animals.js';
import { sfx } from './audio.js';
import { say } from './speech.js';
import { clamp, pick, rand } from './util.js';
import { TALL } from './lawn.js';

const HELPERS = { day: '🐄', sunset: '🐑', night: '🐐', candy: '🦙', moon: '🐄' };
const FLOWERS = { candy: ['🍭', '🍬', '🧁'], moon: ['⭐', '💎'], night: ['🍄', '🌼'] };
const CANDY = ['🍬', '🍭', '🍫', '🍩', '🧁', '🍪'];

// A spot on the lawn a few cells from the mower, so it's easy to reach.
function spotNear(play, min = 4, max = 8) {
  const { lawn, mower } = play;
  for (let i = 0; i < 60; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(min, max);
    const x = clamp(mower.x + Math.cos(a) * d, 1, lawn.cols - 1);
    const y = clamp(mower.y + Math.sin(a) * d, 1, lawn.rows - 1);
    if (lawn.inside(x, y) && !lawn.obstacles.some((o) => (o.gx - x) ** 2 + (o.gy - y) ** 2 < (o.gr + 1.2) ** 2)) return { x, y };
  }
  return { x: lawn.cols / 2, y: lawn.rows / 2 };
}

class Balloon {
  constructor(play) {
    this.play = play;
    const { lawn } = play;
    this.spot = spotNear(play);
    this.obj = makeBalloon(lawn.theme.id);
    this.x = -14;
    this.y = 7.5;
    this.z = this.spot.y - 1;
    this.obj.position.set(this.x, this.y, this.z);
    play.world.add(this.obj);
    this.present = null;
    this.dropped = false;
    this.t = 0;
    say(lawn.theme.id === 'moon' ? 'Look! A flying saucer!' : 'Look! A hot air balloon!', { force: true });
    sfx.whistle();
  }

  update(dt) {
    const { play } = this;
    this.t += dt;
    const speed = this.dropped ? 6 : 5;
    this.x += speed * dt;
    this.obj.position.set(this.x, this.y + Math.sin(this.t * 1.5) * 0.3, this.z);
    this.obj.rotation.y = this.play.lawn.theme.id === 'moon' ? this.t * 2 : Math.sin(this.t) * 0.1;
    if (!this.dropped && this.x >= this.spot.x) {
      this.dropped = true;
      this.present = { obj: makePresent(), x: this.spot.x, y: this.spot.y, h: this.y - 0.5, vh: 0, landed: false, open: false };
      play.world.add(this.present.obj);
      say('A present!');
    }
    const p = this.present;
    if (p && !p.open) {
      const gy = play.lawn.height(p.x, p.y);
      if (!p.landed) {
        p.vh -= 12 * dt;
        p.h += p.vh * dt;
        if (p.h <= gy) {
          p.h = gy;
          if (p.vh < -3) {
            p.vh = -p.vh * 0.35;
            sfx.land();
          } else p.landed = true;
        }
      }
      p.obj.position.set(p.x, p.h, p.y);
      const box = p.obj.userData.box;
      box.rotation.z = p.landed ? Math.sin(this.t * 14) * 0.08 * (Math.sin(this.t * 2) > 0 ? 1 : 0) : 0;
      if (p.landed && Math.random() < dt * 6) play.fx.sparkle(p.x, p.h + 0.8, p.y, '#fff59d', 1.4);
      const { mower } = play;
      if (Math.hypot(mower.x - p.x, mower.y - p.y) < 1.3 + mower.radius * 0.6) this.open();
    }
    return this.x > play.lawn.cols + 16 && (!p || p.open);
  }

  open() {
    const p = this.present;
    if (!p || p.open) return;
    const { play } = this;
    p.open = true;
    play.world.remove(p.obj);
    sfx.giftOpen();
    play.fx.burst(p.x, p.h + 0.6, p.y, 30, undefined, 1.3);
    play.fx.confetti(p.x, p.y, 3, 60, p.h + 5);
    for (let i = 0; i < 3; i++) setTimeout(() => play.awardStar(p.x + (i - 1) * 0.6, p.h + 1, p.y), i * 160);
    say('Yay! Three stars!', { force: true });
  }

  finish() {
    if (this.present && !this.present.open) this.open();
  }

  remove() {
    this.play.world.remove(this.obj);
    if (this.present && !this.present.open) this.play.world.remove(this.present.obj);
  }
}

class Sprinklers {
  constructor(play) {
    this.play = play;
    const { lawn } = play;
    this.list = [];
    const n = lawn.cols * lawn.rows > 200 ? 3 : 2;
    for (let tries = 0; tries < 80 && this.list.length < n; tries++) {
      const x = rand(1.5, lawn.cols - 1.5);
      const y = rand(1.5, lawn.rows - 1.5);
      if (!lawn.inside(x, y)) continue;
      if (this.list.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 < 30)) continue;
      if (lawn.obstacles.some((o) => (o.gx - x) ** 2 + (o.gy - y) ** 2 < (o.gr + 1.5) ** 2)) continue;
      const obj = makeSprinkler();
      play.world.add(obj);
      this.list.push({ x, y, obj, flowers: 0, ph: rand(0, 6) });
    }
    this.t = 0;
    this.dur = 8;
    this.splashT = 0;
    sfx.pop();
    say('Sprinklers! Splash splash!', { force: true });
  }

  update(dt) {
    const { play } = this;
    const { lawn, mower, fx } = play;
    this.t += dt;
    const up = clamp(this.t / 0.3, 0, 1) * clamp((this.dur - this.t) / 0.3, 0, 1);
    this.splashT -= dt;
    const flowers = FLOWERS[lawn.theme.id] || ['🌷', '🌼', '🌸', '🌻'];
    for (const s of this.list) {
      const gy = lawn.height(s.x, s.y);
      s.obj.position.set(s.x, gy - 0.6 + up * 0.6, s.y);
      const a = this.t * 2.2 + s.ph;
      s.obj.userData.head.rotation.y = -a;
      if (up >= 1) {
        for (const side of [0, Math.PI]) {
          const aa = a + side + rand(-0.15, 0.15);
          const sp = rand(3, 4.5);
          fx.water(s.x, gy + 0.55, s.y, Math.cos(aa) * sp, rand(3.5, 5), Math.sin(aa) * sp);
        }
        // flowers sprout where the water lands
        if (s.flowers < 5 && Math.random() < dt * 1.4) {
          const d = rand(1.5, 3);
          const fx2 = s.x + Math.cos(a) * d;
          const fy = s.y + Math.sin(a) * d;
          const i = Math.floor(fy) * lawn.cols + Math.floor(fx2);
          if (lawn.inside(fx2, fy) && lawn.grid[i] !== TALL) {
            s.flowers++;
            play.addPlant(pick(flowers), fx2, fy);
            sfx.sparkle();
          }
        }
        if (Math.hypot(mower.x - s.x, mower.y - s.y) < 3 && this.splashT <= 0) {
          this.splashT = 1.1;
          sfx.splash();
          fx.emoji(pick(['🌈', '💦']), mower.x, mower.h + mower.size * mower.scale * 0.8, mower.y, { size: 1.6, life: 1.2, vy: 1.2 });
        }
      }
    }
    return this.t >= this.dur;
  }

  finish() {}

  remove() {
    for (const s of this.list) this.play.world.remove(s.obj);
  }
}

class Helper {
  constructor(play) {
    this.play = play;
    const { lawn } = play;
    const e = HELPERS[lawn.theme.id] || '🐄';
    this.actor = makeAnimal(e, 2.2);
    this.shadow = makeShadow(1.8, 1, 0.7, this.actor.isModel);
    play.world.add(this.actor.root, this.shadow);
    const left = play.mower.x > lawn.cols / 2;
    this.x = left ? -3 : lawn.cols + 3;
    this.y = lawn.rows * rand(0.3, 0.7);
    this.dest = null;
    this.t = 0;
    this.munchT = 0;
    this.mooT = 0;
    this.hop = 0;
    this.leaving = false;
    this.pickDest();
    sfx.moo();
    say(`Moo! A ${e === '🐑' ? 'sheep' : e === '🐐' ? 'goat' : e === '🦙' ? 'llama' : 'cow'} came to help!`, { force: true });
  }

  pickDest() {
    const { lawn } = this.play;
    const tall = lawn.tallCells();
    if (!tall.length || this.t > 14) {
      this.leaving = true;
      this.dest = { x: this.x < lawn.cols / 2 ? -5 : lawn.cols + 5, y: this.y };
      return;
    }
    // the closest patch of tall grass
    let best = null;
    let bd = Infinity;
    for (const i of tall) {
      const c = lawn.cellCenter(i);
      const d = (c.x - this.x) ** 2 + (c.y - this.y) ** 2 + Math.random() * 4;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    this.dest = best;
  }

  update(dt) {
    const { play } = this;
    const { lawn, mower, fx } = play;
    this.t += dt;
    this.mooT -= dt;
    this.hop = Math.max(0, this.hop - dt * 3);
    const dx = this.dest.x - this.x;
    const dy = this.dest.y - this.y;
    const d = Math.hypot(dx, dy);
    let walking = false;
    if (d > 0.4) {
      const sp = this.leaving ? 3 : 2.2;
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      walking = true;
    } else if (this.leaving) {
      return true;
    } else {
      this.munchT -= dt;
      if (this.munchT <= 0) {
        this.munchT = 0.5;
        const cells = lawn.cutCircle(this.x, this.y, 1.3);
        if (cells.length) {
          sfx.munch();
          fx.clippings(this.x, lawn.height(this.x, this.y), this.y, lawn.theme.blades, 4);
          play.applyCut(cells);
        } else this.pickDest();
      }
    }
    if (!this.leaving && this.t > 14) this.pickDest();
    // say hello if he bumps into it
    const dm = Math.hypot(mower.x - this.x, mower.y - this.y);
    if (dm < mower.radius + 1.2 && this.mooT <= 0) {
      this.mooT = 2;
      this.hop = 1;
      sfx.moo();
      fx.emoji('💕', this.x, lawn.height(this.x, this.y) + 2.4, this.y, { size: 1, life: 1.2, vy: 1.2 });
    }
    const gy = lawn.height(this.x, this.y);
    const a = this.actor;
    const bob = a.isModel ? 0 : walking ? Math.abs(Math.sin(this.t * 6)) * 0.2 : Math.abs(Math.sin(this.t * 10)) * 0.06;
    a.root.position.set(this.x, gy + bob + Math.sin(this.hop * Math.PI) * 1.2, this.y);
    if (a.isModel) {
      if (walking) {
        a.face(dx, dy);
        a.setMotion(this.leaving ? 3 : 2.2);
      } else a.play('eat');
    } else a.setTilt(walking ? Math.sin(this.t * 6) * 0.06 : 0);
    a.update(dt);
    this.shadow.position.set(this.x, gy + 0.04, this.y);
    return false;
  }

  finish() {}

  remove() {
    this.play.world.remove(this.actor.root, this.shadow);
    this.actor.dispose();
  }
}

// Stars or candy fall from the sky and bounce. Drive into them to catch them.
class Shower {
  constructor(play, kind) {
    this.play = play;
    this.kind = kind;
    this.items = [];
    this.toSpawn = 6;
    this.spawnT = 0;
    this.caught = 0;
    this.t = 0;
    say(kind === 'stars' ? 'Falling stars! Catch them!' : 'Candy rain! Yummy!', { force: true });
    sfx.whistle();
  }

  update(dt) {
    const { play } = this;
    const { lawn, mower, fx } = play;
    this.t += dt;
    this.spawnT -= dt;
    if (this.toSpawn > 0 && this.spawnT <= 0) {
      this.spawnT = 0.7;
      this.toSpawn--;
      const s = spotNear(play, 2.5, 8);
      const e = this.kind === 'stars' ? '⭐' : pick(CANDY);
      const sprite = makeEmoji(e, 1.2);
      const shadow = makeShadow(1, 1, 0.6);
      play.world.add(sprite, shadow);
      this.items.push({ x: s.x, y: s.y, h: 11, vh: 0, sprite, shadow, landed: false, t: 0 });
    }
    for (const it of this.items) {
      it.t += dt;
      const gy = lawn.height(it.x, it.y);
      if (!it.landed) {
        it.vh -= 14 * dt;
        it.h += it.vh * dt;
        if (it.h <= gy + 0.3) {
          it.h = gy + 0.3;
          if (it.vh < -3) it.vh = -it.vh * 0.4;
          else it.landed = true;
        }
      }
      const bob = it.landed ? Math.sin(it.t * 4) * 0.12 + 0.15 : 0;
      it.sprite.position.set(it.x, it.h + bob, it.y);
      it.sprite.material.rotation = Math.sin(it.t * 3) * 0.2;
      it.shadow.position.set(it.x, gy + 0.04, it.y);
      if (this.kind === 'stars' && Math.random() < dt * 4) fx.sparkle(it.x, it.h + 0.6, it.y, '#fff59d', 1.2);
      if (Math.hypot(mower.x - it.x, mower.y - it.y) < 1.2 + mower.radius * 0.6) this.catch(it);
    }
    this.items = this.items.filter((it) => !it.done);
    return this.toSpawn === 0 && this.items.length === 0;
  }

  catch(it) {
    const { play } = this;
    it.done = true;
    play.world.remove(it.sprite, it.shadow);
    play.fx.burst(it.x, it.h + 0.5, it.y, 16, this.kind === 'stars' ? ['#ffd54f', '#fff59d', '#ffffff'] : undefined);
    this.caught++;
    if (this.kind === 'stars') play.awardStar(it.x, it.h + 0.5, it.y);
    else {
      sfx.candy(this.caught * 2);
      if (this.caught === 6) {
        say('Yum yum! Two stars!', { force: true });
        play.awardStar(it.x, it.h + 1, it.y);
        setTimeout(() => play.awardStar(it.x, it.h + 1, it.y), 180);
      } else if (this.caught === 1) say('Yummy!');
    }
  }

  finish() {
    // anything still lying around gets caught for him
    this.toSpawn = 0;
    for (const it of this.items) this.catch(it);
    this.items = [];
  }

  remove() {
    for (const it of this.items) this.play.world.remove(it.sprite, it.shadow);
  }
}

export class Events {
  constructor(play) {
    this.play = play;
    this.list = [];
  }

  start(kind) {
    const p = this.play;
    const ev = kind === 'balloon' ? new Balloon(p) : kind === 'sprinklers' ? new Sprinklers(p) : kind === 'cow' ? new Helper(p)
      : kind === 'stars' || kind === 'candy' ? new Shower(p, kind) : null;
    if (ev) this.list.push(ev);
  }

  update(dt) {
    for (const ev of this.list) {
      if (ev.update(dt)) {
        ev.done = true;
        ev.remove();
      }
    }
    this.list = this.list.filter((e) => !e.done);
  }

  // the lawn is finished: hand over anything he didn't get to
  finish() {
    for (const ev of this.list) ev.finish();
  }
}
