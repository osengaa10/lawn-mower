import { STICKERS } from '../catalog.js';
import { sfx } from '../audio.js';
import { say } from '../speech.js';
import { Particles } from '../particles.js';
import { Button, hitButtons } from '../ui.js';
import { drawEmoji, drawText, easeOutBack, roundRectPath } from '../util.js';

export class StickerScreen {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.particles = new Particles();
    this.backBtn = new Button({ icon: '⬅️', color: '#ffb74d', onTap: () => { sfx.tap(); game.go('menu'); } });
    this.bounce = {};
  }

  enter() {
    this.t = 0;
    this.layout();
  }

  resize() {
    this.layout();
  }

  layout() {
    const { W, H, safe } = this.g;
    this.backBtn.set(safe.l + 42, safe.t + 40, 30);
    const n = STICKERS.length;
    const top = safe.t + 86;
    const pad = Math.max(14, safe.l, safe.r) + 6;
    const availW = W - pad * 2;
    const availH = H - top - safe.b - 14;
    // pick the column count that makes the biggest cards
    let best = { size: 0 };
    for (let cols = 3; cols <= 12; cols++) {
      const rows = Math.ceil(n / cols);
      const gap = 8;
      const size = Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows);
      if (size > best.size) best = { size, cols, rows, gap };
    }
    const { size, cols, rows, gap } = best;
    const x0 = (W - (cols * size + (cols - 1) * gap)) / 2;
    const y0 = top + (availH - (rows * size + (rows - 1) * gap)) / 2;
    this.cards = STICKERS.map((s, i) => ({ s, x: x0 + (i % cols) * (size + gap), y: y0 + Math.floor(i / cols) * (size + gap), size }));
  }

  down(x, y) {
    if (hitButtons([this.backBtn], x, y)) return;
    for (const c of this.cards) {
      if (x < c.x || x > c.x + c.size || y < c.y || y > c.y + c.size) continue;
      if (this.g.save.stickers[c.s.id]) {
        this.bounce[c.s.id] = 1;
        sfx.pop();
        this.particles.burst(c.x + c.size / 2, c.y + c.size / 2, 12, 0.7);
        say(c.s.name, { force: true });
      } else {
        sfx.nope();
        say('Keep mowing to find it!', { force: true });
      }
      return;
    }
  }

  update(dt) {
    this.t += dt;
    this.particles.update(dt);
    for (const k in this.bounce) this.bounce[k] = Math.max(0, this.bounce[k] - dt * 2);
  }

  draw(ctx) {
    const { W, H, save, safe } = this.g;
    const t = this.t;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f8bbd0');
    bg.addColorStop(1, '#fff3e0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.backBtn.draw(ctx, t);
    const found = STICKERS.filter((s) => save.stickers[s.id]).length;
    drawText(ctx, `My Stickers  ${found} / ${STICKERS.length}`, W / 2, safe.t + 42, Math.min(40, W / 16), { color: '#ad1457', stroke: '#ffffff' });

    this.cards.forEach((c, i) => {
      const count = save.stickers[c.s.id] || 0;
      const appear = easeOutBack(Math.min(1, Math.max(0, (t - i * 0.015) / 0.3)));
      if (appear <= 0) return;
      const b = this.bounce[c.s.id] || 0;
      const scale = appear * (1 + Math.sin(b * Math.PI) * 0.25);
      const cx = c.x + c.size / 2;
      const cy = c.y + c.size / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = count ? (c.s.rare ? '#fff8e1' : '#ffffff') : 'rgba(255,255,255,0.45)';
      roundRectPath(ctx, c.x, c.y, c.size, c.size, c.size * 0.2);
      ctx.fill();
      if (count && c.s.rare) {
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      if (count) {
        drawEmoji(ctx, c.s.e, cx, cy, c.size * 0.62, Math.sin(t * 2 + i) * 0.06);
        if (count > 1) {
          ctx.fillStyle = '#ff7043';
          ctx.beginPath();
          ctx.arc(c.x + c.size * 0.82, c.y + c.size * 0.18, c.size * 0.15, 0, Math.PI * 2);
          ctx.fill();
          drawText(ctx, String(count), c.x + c.size * 0.82, c.y + c.size * 0.19, c.size * 0.17, { color: '#fff', stroke: null });
        }
      } else {
        drawText(ctx, '?', cx, cy + 2, c.size * 0.45, { color: 'rgba(0,0,0,0.18)', stroke: null });
      }
      ctx.restore();
    });
    this.particles.draw(ctx);
  }
}
