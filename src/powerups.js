// Glowing pickups on the lawn. Drive into one for a few seconds of fun:
// a GIANT mower, a turbo boost, or a bubble trail. They never run out at a
// bad moment or do anything bad.
import { makePowerup } from './world3d/props.js';
import { sfx } from './audio.js';
import { say } from './speech.js';
import { pick, rand } from './util.js';

export const POWER = {
  giant: { icon: '🍄', dur: 6.5, cut: 2, words: ['Giant mower!', 'Wow, a giant mower!'] },
  turbo: { icon: '⚡', dur: 5.5, cut: 1.15, words: ['Turbo! Zoom zoom!', 'Super speed!'] },
  bubbles: { icon: '🫧', dur: 6.5, cut: 1.5, words: ['Bubbles!', 'Bubble power!'] },
};

export class PowerUps {
  constructor(play) {
    this.play = play;
    this.items = [];
    this.active = null;
    this.stepAt = 0;
    for (const p of play.lawn.powerups) if (!p.taken) this.addItem(p);
  }

  addItem(p) {
    const obj = makePowerup(p.kind);
    obj.position.set(p.gx, this.play.lawn.height(p.gx, p.gy), p.gy);
    this.play.world.add(obj);
    this.items.push({ p, obj, ph: rand(0, 6) });
  }

  get cutMul() {
    return this.active ? POWER[this.active.kind].cut : 1;
  }

  start(kind) {
    const { mower, rig } = this.play;
    if (this.active) this.reset();
    this.active = { kind, t: 0, dur: POWER[kind].dur };
    sfx.powerup();
    say(pick(POWER[kind].words), { force: true });
    if (kind === 'giant') {
      mower.scaleTarget = 1.7;
      rig.zoomTarget = 1.35;
    } else if (kind === 'turbo') {
      mower.speedMul = 1.8;
      sfx.boost();
    }
  }

  reset() {
    const { mower, rig } = this.play;
    mower.scaleTarget = 1;
    mower.speedMul = 1;
    rig.zoomTarget = 1;
    this.active = null;
  }

  end() {
    if (!this.active) return;
    const { mower, fx } = this.play;
    this.reset();
    sfx.powerdown();
    for (let i = 0; i < 16; i++) fx.sparkle(mower.x + rand(-1, 1), mower.h + 0.8, mower.y + rand(-1, 1), pick(['#fff59d', '#ffffff', '#80d8ff']), 1.6);
  }

  update(dt, t) {
    const { mower, fx, lawn } = this.play;
    for (const it of this.items) {
      const item = it.obj.userData.item;
      item.rotation.y = t * 2 + it.ph;
      item.position.y = 0.5 + Math.sin(t * 3 + it.ph) * 0.18;
      const d = Math.hypot(mower.x - it.p.gx, mower.y - it.p.gy);
      if (d < 1.2 + mower.radius * 0.6 && !mower.airborne) {
        it.p.taken = true;
        it.done = true;
        this.play.world.remove(it.obj);
        fx.burst(it.p.gx, lawn.height(it.p.gx, it.p.gy) + 0.8, it.p.gy, 26, undefined, 1.2);
        this.start(it.p.kind);
        this.play.g.persist();
      }
    }
    this.items = this.items.filter((it) => !it.done);

    const a = this.active;
    if (!a) return;
    a.t += dt;
    const back = mower.heading + Math.PI;
    const size = mower.size * mower.scale;
    const bx = mower.x + Math.cos(back) * size * 0.45;
    const bz = mower.y + Math.sin(back) * size * 0.45;
    if (a.kind === 'giant') {
      // big stompy footsteps
      if (mower.travel - this.stepAt > 1.4 && !mower.airborne) {
        this.stepAt = mower.travel;
        sfx.stomp();
        this.play.rig.shake(0.12);
        for (let i = 0; i < 3; i++) fx.puff(bx + rand(-1, 1), mower.h + 0.2, bz + rand(-1, 1), 2);
      }
    } else if (a.kind === 'turbo') {
      if (mower.speed01 > 0.1) for (let i = 0; i < 2; i++) fx.flame(bx, mower.h + 0.5, bz, Math.cos(back) * 4, Math.sin(back) * 4);
    } else if (a.kind === 'bubbles') {
      if (Math.random() < dt * 14) {
        fx.emoji('🫧', bx + rand(-0.6, 0.6), mower.h + 0.6, bz + rand(-0.6, 0.6), { size: rand(0.5, 1), life: rand(1.2, 2), vy: rand(0.8, 1.6), vx: rand(-0.3, 0.3) });
        if (Math.random() < 0.3) sfx.bubble();
      }
    }
    if (a.t >= a.dur) this.end();
  }

  // the lawn is done: put away anything he didn't pick up
  clear() {
    for (const it of this.items) this.play.world.remove(it.obj);
    this.items = [];
    this.end();
  }

  // 0..1 of the active power-up left, for the HUD
  get left() {
    return this.active ? 1 - this.active.t / this.active.dur : 0;
  }
}
