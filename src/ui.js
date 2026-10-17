import { drawEmoji, shade } from './util.js';

// Big, round, candy-like buttons. They fire on touch-down so little fingers
// get an instant response.
export class Button {
  constructor({ icon, color = '#4caf50', onTap, pulse = false, draw = null }) {
    this.icon = icon;
    this.color = color;
    this.onTap = onTap;
    this.pulse = pulse;
    this.customDraw = draw;
    this.x = 0;
    this.y = 0;
    this.r = 30;
    this.press = 0;
    this.visible = true;
  }

  set(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    return this;
  }

  hit(px, py) {
    return this.visible && (px - this.x) ** 2 + (py - this.y) ** 2 <= (this.r * 1.15) ** 2;
  }

  tap() {
    this.press = 1;
    this.onTap?.();
  }

  draw(ctx, t, dt = 0.016) {
    if (!this.visible) return;
    this.press = Math.max(0, this.press - dt * 5);
    const pulse = this.pulse ? 1 + Math.sin(t * 4) * 0.06 : 1;
    const r = this.r * pulse * (1 - this.press * 0.12);
    const { x, y } = this;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.12, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, shade(this.color, 0.25));
    g.addColorStop(1, shade(this.color, -0.15));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.42, r * 0.55, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.customDraw) this.customDraw(ctx, x, y, r, t);
    else if (this.icon) drawEmoji(ctx, this.icon, x, y + r * 0.02, r * 0.95);
  }
}

export function playTriangle(ctx, x, y, r) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = r * 0.06;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.28, y - r * 0.42);
  ctx.lineTo(x + r * 0.46, y);
  ctx.lineTo(x - r * 0.28, y + r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function hitButtons(buttons, x, y) {
  for (const b of buttons) {
    if (b.hit(x, y)) {
      b.tap();
      return true;
    }
  }
  return false;
}
