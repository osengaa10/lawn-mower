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
