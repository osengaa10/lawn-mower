// Animal friends that live on each lawn and react to the mower: a puppy that
// follows along, bunnies that hop out of the way, birds that fly up when
// he gets close. The horn makes all of them jump.
import { makeShadow } from './world3d/sprites.js';
import { makeAnimal } from './world3d/animals.js';
import { sfx } from './audio.js';
import { clamp, pick, rand } from './util.js';

// follow: trots behind the mower. chain: follows the buddy before it (ducklings).
// shy: hops away when the mower comes close. flyer: flies off and lands somewhere else.
const BUDDIES = {
  day: [{ e: '🐶', kind: 'follow', bark: true }, { e: '🐰', kind: 'shy' }, { e: '🐸', kind: 'shy' }],
  sunset: [{ e: '🦆', kind: 'chain' }, { e: '🐤', kind: 'chain' }, { e: '🐤', kind: 'chain' }, { e: '🐤', kind: 'chain' }],
  night: [{ e: '🦉', kind: 'flyer' }, { e: '🦔', kind: 'shy' }, { e: '🐱', kind: 'follow' }],
  candy: [{ e: '🧸', kind: 'follow' }, { e: '🐹', kind: 'shy' }, { e: '🦋', kind: 'flyer' }],
  moon: [{ e: '🤖', kind: 'follow' }, { e: '👽', kind: 'shy' }, { e: '👾', kind: 'shy' }],
};

const G = 22;

export class Buddies {
  constructor(play) {
    this.play = play;
    const { lawn } = play;
    const list = BUDDIES[lawn.theme.id] || BUDDIES.day;
    // two friends at most, so the lawn stays calm
    const n = Math.min(2, list.length);
    this.list = [];
    const tall = lawn.tallCells();
    let leader = null;
    for (const b of list.slice(0, n)) {
      let x;
      let y;
      if (b.kind === 'shy' && tall.length) {
        const c = lawn.cellCenter(pick(tall));
        x = c.x;
        y = c.y;
      } else if (b.kind === 'flyer') {
        x = rand(0, lawn.cols);
        y = -1.2;
      } else {
        x = lawn.start.gx - 2 - this.list.length * 1.2;
        y = lawn.start.gy + 1;
      }
      const size = b.kind === 'chain' && leader ? 0.9 : 1.3;
      const actor = makeAnimal(b.e, size);
      const shadow = makeShadow(size * 0.7, size * 0.45, 0.7, actor.isModel);
      play.world.add(actor.root, shadow);
      const bud = { ...b, x, y, h: 0, vh: 0, vx: 0, vy: 0, spin: 0, size, actor, shadow, t: rand(0, 3), flee: 0, flying: false, dest: null, leader };
      if (b.kind === 'chain') leader = bud;
      this.list.push(bud);
    }
  }

  // Beep beep! Everybody jumps and spins.
  honk() {
    for (const b of this.list) {
      if (b.h < 0.3) b.vh = rand(5.5, 7);
      b.spin = 1;
      if (b.kind === 'flyer') this.takeOff(b);
      if (b.bark) setTimeout(() => sfx.bark(), 250);
    }
  }

  takeOff(b) {
    const { lawn, mower } = this.play;
    b.flying = true;
    for (let i = 0; i < 10; i++) {
      const x = rand(-2, lawn.cols + 2);
      const y = rand(-2, lawn.rows + 1);
      if ((x - mower.x) ** 2 + (y - mower.y) ** 2 > 36 || i === 9) {
        b.dest = { x, y };
        break;
      }
    }
  }

  update(dt) {
    const { lawn, mower } = this.play;
    const mr = mower.radius;
    for (const b of this.list) {
      b.t += dt;
      const dx = b.x - mower.x;
      const dy = b.y - mower.y;
      const dm = Math.hypot(dx, dy) || 0.01;
      let wantVx = 0;
      let wantVy = 0;
      if (b.kind === 'follow' || b.kind === 'chain') {
        const lead = b.kind === 'chain' && b.leader ? b.leader : null;
        const tx = lead ? lead.x : mower.x - Math.cos(mower.heading) * (mr + 1.8);
        const ty = lead ? lead.y : mower.y - Math.sin(mower.heading) * (mr + 1.8);
        const gap = lead ? 1.2 : 0.5;
        const ex = tx - b.x;
        const ey = ty - b.y;
        const d = Math.hypot(ex, ey);
        if (d > gap) {
          const spd = Math.min(11 * mower.speedMul, (d - gap) * 3.5);
          wantVx = (ex / d) * spd;
          wantVy = (ey / d) * spd;
        }
      } else if (b.kind === 'shy') {
        if (dm < mr + 2.6 && b.flee <= 0) {
          b.flee = 0.7;
          const a = Math.atan2(dy, dx) + rand(-0.6, 0.6);
          b.fx = Math.cos(a);
          b.fy = Math.sin(a);
          if (b.h < 0.2) b.vh = 5;
          sfx.squeak();
        }
        if (b.flee > 0) {
          b.flee -= dt;
          wantVx = b.fx * 6.5;
          wantVy = b.fy * 6.5;
        } else if (b.h <= 0 && Math.random() < dt * 0.4) b.vh = 3;
      } else if (b.kind === 'flyer') {
        if (!b.flying && dm < mr + 3) {
          this.takeOff(b);
          sfx.squeak();
        }
        if (b.flying && b.dest) {
          const ex = b.dest.x - b.x;
          const ey = b.dest.y - b.y;
          const d = Math.hypot(ex, ey);
          if (d > 0.3) {
            wantVx = (ex / d) * 5;
            wantVy = (ey / d) * 5;
          } else b.flying = false;
        }
      }
      // never get run over: a gentle shove out of the way
      if (dm < mr + 0.5 && !b.flying) {
        wantVx += (dx / dm) * 8;
        wantVy += (dy / dm) * 8;
        if (b.h <= 0) b.vh = 4;
        b.spin = Math.max(b.spin, 0.6);
        sfx.squeak();
      }
      const k = 1 - Math.exp(-dt * 8);
      b.vx += (wantVx - b.vx) * k;
      b.vy += (wantVy - b.vy) * k;
      b.x = clamp(b.x + b.vx * dt, -3, lawn.cols + 3);
      b.y = clamp(b.y + b.vy * dt, -3, lawn.rows + 3);
      const moving = Math.hypot(b.vx, b.vy) > 0.8;
      if (b.kind === 'flyer') {
        const want = b.flying ? 3.2 : 0;
        b.h += (want - b.h) * (1 - Math.exp(-dt * 3));
      } else {
        // emoji trot along in little hops (models walk instead)
        if (moving && b.h <= 0 && b.vh <= 0 && !b.actor.isModel) b.vh = 3.2;
        b.vh -= G * dt;
        b.h = Math.max(0, b.h + b.vh * dt);
        if (b.h <= 0 && b.vh < 0) b.vh = 0;
      }
      b.spin = Math.max(0, b.spin - dt * 1.6);
      const gy = lawn.height(b.x, b.y);
      const a = b.actor;
      a.root.position.set(b.x, gy + b.h + 0.05, b.y);
      a.setSpin(b.spin > 0 ? 1 - b.spin : 0);
      if (moving) a.face(b.vx, b.vy);
      else if (b.kind === 'follow' || b.kind === 'chain') a.face(mower.x - b.x, mower.y - b.y);
      a.setMotion(Math.hypot(b.vx, b.vy), { air: b.kind === 'flyer' && b.flying });
      a.update(dt);
      b.shadow.position.set(b.x, gy + 0.04, b.y);
      const ss = Math.max(0.4, 1 - b.h * 0.2);
      b.shadow.scale.set(b.size * 0.7 * ss, 1, b.size * 0.45 * ss);
    }
  }
}
