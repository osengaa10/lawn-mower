import { MOWERS } from '../catalog.js';
import { drawMower3D } from '../world3d/thumbs.js';
import { sfx } from '../audio.js';
import { say } from '../speech.js';
import { Particles } from '../particles.js';
import { Button, hitButtons } from '../ui.js';
import { drawEmoji, drawStar, drawText, roundRectPath } from '../util.js';

const LOCKED = { body: '#9e9e9e', trim: '#bdbdbd', driver: '❓' };

export class GarageScreen {
  constructor(game) {
    this.g = game;
    this.t = 0;
    this.particles = new Particles();
    this.backBtn = new Button({ icon: '⬅️', color: '#ffb74d', onTap: () => { sfx.tap(); game.go('menu'); } });
    this.spin = {};
    this.shake = {};
  }

  enter() {
    this.layout();
  }

  resize() {
    this.layout();
  }

  layout() {
    const { W, H, safe } = this.g;
    this.backBtn.set(safe.l + 42, safe.t + 40, 30);
    const landscape = W >= H;
    const cols = landscape ? 6 : 3;
    const rows = Math.ceil(MOWERS.length / cols);
    const top = safe.t + 86;
    const pad = Math.max(16, safe.l, safe.r) + 6;
    const gap = 12;
    const size = Math.min((W - pad * 2 - gap * (cols - 1)) / cols, (H - top - safe.b - 16 - gap * (rows - 1)) / rows);
    const gw = cols * size + (cols - 1) * gap;
    const gh = rows * size + (rows - 1) * gap;
    const x0 = (W - gw) / 2;
    const y0 = top + (H - top - safe.b - 16 - gh) / 2;
    this.cards = MOWERS.map((m, i) => ({
      m, x: x0 + (i % cols) * (size + gap), y: y0 + Math.floor(i / cols) * (size + gap), s: size,
    }));
  }

  down(x, y) {
    if (hitButtons([this.backBtn], x, y)) return;
    const { save } = this.g;
    for (const c of this.cards) {
      if (x < c.x || x > c.x + c.s || y < c.y || y > c.y + c.s) continue;
      if (save.unlocked.includes(c.m.id)) {
        save.mower = c.m.id;
        this.g.persist();
        this.spin[c.m.id] = 1;
        sfx.chime(2);
        this.particles.burst(c.x + c.s / 2, c.y + c.s / 2, 20, 0.9);
        say(`${c.m.name}! Vroom!`, { force: true });
      } else {
        this.shake[c.m.id] = 1;
        sfx.nope();
        say('Mow more lawns to get this one!', { force: true });
      }
      return;
    }
  }

  update(dt) {
    this.t += dt;
    this.particles.update(dt);
    for (const k in this.spin) this.spin[k] = Math.max(0, this.spin[k] - dt * 1.2);
    for (const k in this.shake) this.shake[k] = Math.max(0, this.shake[k] - dt * 2.5);
  }

  draw(ctx) {
    const { W, H, save, safe } = this.g;
    const t = this.t;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#90caf9');
    bg.addColorStop(1, '#e3f2fd');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.backBtn.draw(ctx, t);
    drawText(ctx, 'My Mowers', W / 2, safe.t + 42, Math.min(44, W / 12), { color: '#1565c0', stroke: '#ffffff' });

    for (const c of this.cards) {
      const unlocked = save.unlocked.includes(c.m.id);
      const selected = save.mower === c.m.id;
      const sh = (this.shake[c.m.id] || 0) * Math.sin(t * 40) * 8;
      const x = c.x + sh;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      roundRectPath(ctx, x, c.y + 5, c.s, c.s, c.s * 0.16);
      ctx.fill();
      ctx.fillStyle = unlocked ? '#ffffff' : '#eceff1';
      roundRectPath(ctx, x, c.y, c.s, c.s, c.s * 0.16);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 7 + Math.sin(t * 5) * 2;
        ctx.stroke();
      }
      const cx = x + c.s / 2;
      const cy = c.y + c.s * 0.47;
      if (unlocked) {
        const spin = this.spin[c.m.id] || 0;
        const heading = -Math.PI / 4 + (selected ? Math.sin(t * 1.5) * 0.25 : 0) + spin * Math.PI * 4;
        drawMower3D(ctx, c.m, cx, cy, c.s * 0.52, heading, t, { moving: selected ? 0.4 : 0 });
        if (selected) drawEmoji(ctx, '✅', x + c.s * 0.84, c.y + c.s * 0.16, c.s * 0.2);
      } else {
        ctx.globalAlpha = 0.6;
        drawMower3D(ctx, LOCKED, cx, cy, c.s * 0.5, -Math.PI / 4, t, { bob: false });
        ctx.globalAlpha = 1;
        drawEmoji(ctx, '🔒', x + c.s * 0.82, c.y + c.s * 0.18, c.s * 0.2);
        drawStar(ctx, cx - c.s * 0.14, c.y + c.s * 0.86, c.s * 0.08, '#ffd54f', '#f9a825');
        drawText(ctx, String(c.m.cost), cx + c.s * 0.08, c.y + c.s * 0.87, c.s * 0.14, { color: '#5d4037', stroke: null });
      }
    }
    this.particles.draw(ctx);
  }
}
