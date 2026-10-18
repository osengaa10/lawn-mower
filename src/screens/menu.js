import { MOWER_BY_ID, STICKERS } from '../catalog.js';
import { drawMower } from '../mower.js';
import { sfx } from '../audio.js';
import { say } from '../speech.js';
import { Button, hitButtons, playTriangle } from '../ui.js';
import { DPR, drawEmoji, drawStar, drawText, roundRectPath } from '../util.js';

const TITLE = 'Mighty Mower';
const LETTER_COLORS = ['#ff5252', '#ffab40', '#ffd740', '#69f0ae', '#40c4ff', '#b388ff'];

export class MenuScreen {
  constructor(game) {
    this.g = game;
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
    this.grass = document.createElement('canvas');
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
    this.layout();
    this.demo = { x: -80, lane: 0, dir: 1 };
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
    this.groundY = H * 0.72;
    this.renderGrass();
  }

  renderGrass() {
    const { W, H } = this.g;
    const h = H - this.groundY;
    const c = this.grass;
    c.width = Math.round(W * DPR);
    c.height = Math.round(h * DPR);
    const g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = '#3d9a3a';
    g.fillRect(0, 0, W, h);
    const colors = ['#2f8a2e', '#47a83f', '#55b84a', '#61c255'];
    g.lineCap = 'round';
    g.lineWidth = 3;
    for (let i = 0; i < W * h * 0.012; i++) {
      const x = Math.random() * W;
      const y = Math.random() * h + 8;
      g.strokeStyle = colors[i % colors.length];
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 2, y - 8, x + (Math.random() - 0.5) * 10, y - 14 - Math.random() * 8);
      g.stroke();
    }
  }

  down(x, y) {
    hitButtons(this.buttons, x, y);
  }

  update(dt) {
    this.t += dt;
    const { W, H } = this.g;
    const d = this.demo;
    const spd = Math.max(120, W * 0.18);
    d.x += d.dir * spd * dt;
    if ((d.dir > 0 && d.x > W + 80) || (d.dir < 0 && d.x < -80)) {
      d.lane = (d.lane + 1) % 3;
      d.dir *= -1;
      if (d.lane === 0) {
        d.x = -80;
        d.dir = 1;
        this.renderGrass();
      }
    }
    this.laneH = (H - this.groundY) / 3;
  }

  draw(ctx) {
    const { W, H, save } = this.g;
    const t = this.t;
    const sky = ctx.createLinearGradient(0, 0, 0, this.groundY);
    sky.addColorStop(0, '#6ec6ff');
    sky.addColorStop(1, '#d6f1ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, this.groundY);

    // sun with turning rays
    const sx = W * 0.85;
    const sy = H * 0.16;
    const sr = Math.min(W, H) * 0.08;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.3);
    ctx.fillStyle = 'rgba(255,235,59,0.5)';
    for (let i = 0; i < 10; i++) {
      ctx.rotate((Math.PI * 2) / 10);
      ctx.beginPath();
      ctx.moveTo(sr * 0.9, -sr * 0.2);
      ctx.lineTo(sr * 1.7, 0);
      ctx.lineTo(sr * 0.9, sr * 0.2);
      ctx.fill();
    }
    ctx.restore();
    drawEmoji(ctx, '🌞', sx, sy, sr * 2);

    for (let i = 0; i < 4; i++) {
      const cx = ((t * (14 + i * 6) + i * W * 0.3) % (W + 240)) - 120;
      drawEmoji(ctx, '☁️', cx, H * (0.1 + i * 0.07), 60 + i * 14);
    }

    // rolling hills
    ctx.fillStyle = '#9ccc65';
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, this.groundY - 30 - Math.sin(x / 140) * 22);
    ctx.lineTo(W, this.groundY);
    ctx.fill();
    drawEmoji(ctx, '🏡', W * 0.12, this.groundY - 50, 80);
    drawEmoji(ctx, '🌳', W * 0.25, this.groundY - 50, 70);
    drawEmoji(ctx, '🌳', W * 0.7, this.groundY - 46, 60);

    // tall grass strip with a demo mower cutting stripes
    ctx.drawImage(this.grass, 0, this.groundY, W, H - this.groundY);
    const d = this.demo;
    const lh = this.laneH;
    for (let l = 0; l <= d.lane; l++) {
      const y = this.groundY + l * lh;
      ctx.fillStyle = l % 2 ? '#8fd870' : '#a5e887';
      if (l < d.lane) ctx.fillRect(0, y, W, lh + 1);
      else if (d.dir > 0) ctx.fillRect(0, y, Math.max(0, d.x), lh + 1);
      else ctx.fillRect(d.x, y, W - d.x, lh + 1);
    }
    const skin = MOWER_BY_ID[save.mower] || MOWER_BY_ID.red;
    drawMower(ctx, skin, d.x, this.groundY + d.lane * lh + lh / 2, Math.min(lh * 1.3, 90), d.dir > 0 ? 0 : Math.PI, t, { moving: 0.8 });

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
