import { drawEmoji, drawStar, pick, rand } from './util.js';

const CONFETTI = ['#f44336', '#ffeb3b', '#4caf50', '#2196f3', '#e91e63', '#ff9800', '#9c27b0', '#00bcd4'];
const MAX = 900;

export class Particles {
  constructor() {
    this.list = [];
  }

  add(p) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0, life: 1, age: 0, size: 6, alpha: 1, ...p });
  }

  clear() {
    this.list.length = 0;
  }

  clippings(x, y, colors, n, scale) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 200) * scale;
      this.add({
        type: 'rect', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80 * scale, g: 500 * scale, drag: 2.5,
        life: rand(0.35, 0.7), size: rand(3, 6) * scale, w: 0.35, color: pick(colors), rot: rand(0, 6), vr: rand(-12, 12),
      });
    }
  }

  puff(x, y, scale) {
    this.add({
      type: 'circle', x, y, vx: rand(-10, 10), vy: rand(-30, -10), drag: 1, life: 0.8, size: rand(4, 8) * scale,
      grow: 14 * scale, color: 'rgba(230,230,230,0.6)',
    });
  }

  sparkle(x, y, scale = 1, color = '#fff59d') {
    this.add({
      type: 'star', x: x + rand(-8, 8) * scale, y: y + rand(-8, 8) * scale, vy: -20 * scale, life: rand(0.5, 0.9),
      size: rand(5, 10) * scale, color, rot: rand(0, 6), vr: rand(-3, 3), twinkle: true,
    });
  }

  burst(x, y, n = 18, scale = 1, colors = CONFETTI) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const s = rand(120, 320) * scale;
      this.add({
        type: Math.random() < 0.5 ? 'star' : 'circle', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3,
        g: 120 * scale, life: rand(0.6, 1.1), size: rand(4, 9) * scale, color: pick(colors), rot: rand(0, 6), vr: rand(-6, 6),
      });
    }
  }

  firework(x, y, scale = 1) {
    const color = pick(CONFETTI);
    const color2 = pick(CONFETTI);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = rand(180, 380) * scale;
      this.add({
        type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.2, g: 90 * scale,
        life: rand(0.9, 1.5), size: rand(3, 5) * scale, color: i % 3 ? color : color2,
      });
    }
  }

  confetti(W, n = 120) {
    for (let i = 0; i < n; i++) {
      this.add({
        type: 'rect', x: rand(0, W), y: rand(-200, -10), vx: rand(-60, 60), vy: rand(80, 260), g: 60, drag: 0.4,
        life: rand(2.5, 4.5), size: rand(7, 13), w: 0.5, color: pick(CONFETTI), rot: rand(0, 6), vr: rand(-8, 8),
        flutter: rand(2, 5),
      });
    }
  }

  emoji(e, x, y, opts = {}) {
    this.add({ type: 'emoji', e, x, y, size: 30, life: 1, ...opts });
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) {
        L.splice(i, 1);
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.g * dt;
      if (p.flutter) p.vx += Math.sin(p.age * p.flutter * 2) * 120 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = p.age / p.life;
      let a = p.alpha * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
      if (p.twinkle) a *= 0.6 + 0.4 * Math.sin(p.age * 25);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      if (p.type === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, (-p.size * p.w) / 2, p.size, p.size * p.w);
        ctx.restore();
      } else if (p.type === 'circle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star') {
        drawStar(ctx, p.x, p.y, p.size, p.color, 'rgba(255,255,255,0.7)', p.rot);
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'emoji') {
        drawEmoji(ctx, p.e, p.x, p.y, p.size, p.rot);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Background critters that make each world feel alive.
export class Ambient {
  constructor(kind, W, H) {
    this.kind = kind;
    this.items = [];
    this.resize(W, H);
  }

  resize(W, H) {
    this.W = W;
    this.H = H;
    const n = { butterflies: 3, leaves: 8, fireflies: 22, sparkles: 14, twinkle: 40 }[this.kind] || 0;
    this.items = [];
    for (let i = 0; i < n; i++) this.items.push(this.spawn(true));
  }

  spawn(initial) {
    const { W, H } = this;
    return {
      x: rand(0, W),
      y: initial ? rand(0, H) : -20,
      vx: rand(-20, 20),
      vy: this.kind === 'leaves' ? rand(25, 60) : rand(-15, 15),
      ph: rand(0, 10),
      s: rand(0.6, 1.2),
    };
  }

  update(dt) {
    for (const it of this.items) {
      it.ph += dt;
      if (this.kind === 'butterflies') {
        it.vx += Math.sin(it.ph * 0.9) * 30 * dt;
        it.vy += Math.cos(it.ph * 0.7) * 30 * dt;
        it.vx = Math.max(-50, Math.min(50, it.vx));
        it.vy = Math.max(-50, Math.min(50, it.vy));
      }
      if (this.kind === 'fireflies' || this.kind === 'sparkles') {
        it.vx += Math.sin(it.ph * 1.3) * 12 * dt;
        it.vy += Math.cos(it.ph * 1.1) * 12 * dt;
      }
      if (this.kind !== 'twinkle') {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
      }
      if (this.kind === 'leaves' && it.y > this.H + 20) Object.assign(it, this.spawn(false));
      if (it.x < -40) it.x = this.W + 30;
      if (it.x > this.W + 40) it.x = -30;
      if (it.y < -40) it.y = this.H + 30;
      if (it.y > this.H + 40 && this.kind !== 'leaves') it.y = -30;
    }
  }

  draw(ctx, avoid) {
    for (const it of this.items) {
      if (avoid && this.kind === 'twinkle' && it.x > avoid.x && it.x < avoid.x + avoid.w && it.y > avoid.y && it.y < avoid.y + avoid.h) continue;
      switch (this.kind) {
        case 'butterflies': {
          const flap = 0.6 + 0.4 * Math.abs(Math.sin(it.ph * 9));
          ctx.save();
          ctx.translate(it.x, it.y);
          ctx.scale(flap, 1);
          drawEmoji(ctx, '🦋', 0, 0, 26 * it.s);
          ctx.restore();
          break;
        }
        case 'leaves':
          drawEmoji(ctx, '🍂', it.x + Math.sin(it.ph * 2) * 14, it.y, 18 * it.s, Math.sin(it.ph * 1.5));
          break;
        case 'fireflies': {
          const a = 0.35 + 0.65 * Math.max(0, Math.sin(it.ph * 2.2));
          ctx.globalAlpha = a * 0.35;
          ctx.fillStyle = '#fff59d';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 9 * it.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(it.x, it.y, 2.6 * it.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'sparkles': {
          const a = 0.3 + 0.7 * Math.abs(Math.sin(it.ph * 1.7));
          ctx.globalAlpha = a;
          drawStar(ctx, it.x, it.y, 5 * it.s, '#ffffff', 'rgba(255,64,129,0.5)', it.ph);
          ctx.globalAlpha = 1;
          break;
        }
        case 'twinkle': {
          const a = 0.25 + 0.75 * Math.abs(Math.sin(it.ph * 1.3));
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(it.x, it.y, 1.6 * it.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
  }
}
