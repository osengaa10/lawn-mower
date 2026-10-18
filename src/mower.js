import { angleDiff, clamp, drawEmoji, roundRectPath, shade } from './util.js';

// Mower drawn top-down; the animal driver always stays upright so it reads clearly.
export function drawMower(ctx, skin, x, y, size, heading, t, opts = {}) {
  const { moving = 0, lights = false, bob = true } = opts;
  const L = size * 0.95;
  const Wd = size * 0.78;

  ctx.save();
  ctx.translate(x, y);

  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(size * 0.06, size * 0.1, L * 0.55, Wd * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(heading);
  const shake = moving > 0.05 ? Math.sin(t * 60) * size * 0.012 * moving : 0;
  ctx.translate(0, shake);

  if (lights) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(L * 0.5, 0, 0, L * 0.5, 0, L * 2.4);
    g.addColorStop(0, 'rgba(255,245,180,0.45)');
    g.addColorStop(1, 'rgba(255,245,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L * 0.45, -Wd * 0.25);
    ctx.lineTo(L * 2.6, -Wd * 1.2);
    ctx.lineTo(L * 2.6, Wd * 1.2);
    ctx.lineTo(L * 0.45, Wd * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // cutting deck
  ctx.fillStyle = '#607d8b';
  ctx.beginPath();
  ctx.ellipse(L * 0.08, 0, L * 0.36, Wd * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#455a64';
  ctx.beginPath();
  ctx.ellipse(L * 0.08, 0, L * 0.3, Wd * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // wheels
  const wheel = (wx, wy, ww, wh) => {
    ctx.fillStyle = '#212121';
    roundRectPath(ctx, wx - ww / 2, wy - wh / 2, ww, wh, wh * 0.4);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = Math.max(1, size * 0.015);
    const off = ((t * 8 * (moving + 0.001)) % 1) * (ww / 3);
    for (let i = -1; i <= 2; i++) {
      const lx = wx - ww / 2 + off + (i * ww) / 3;
      if (lx > wx - ww / 2 + 1 && lx < wx + ww / 2 - 1) {
        ctx.beginPath();
        ctx.moveTo(lx, wy - wh / 2 + 2);
        ctx.lineTo(lx, wy + wh / 2 - 2);
        ctx.stroke();
      }
    }
  };
  wheel(-L * 0.3, -Wd * 0.47, L * 0.3, Wd * 0.22);
  wheel(-L * 0.3, Wd * 0.47, L * 0.3, Wd * 0.22);
  wheel(L * 0.32, -Wd * 0.42, L * 0.2, Wd * 0.16);
  wheel(L * 0.32, Wd * 0.42, L * 0.2, Wd * 0.16);

  if (skin.fins) {
    ctx.fillStyle = '#e53935';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.35, s * Wd * 0.2);
      ctx.lineTo(-L * 0.62, s * Wd * 0.62);
      ctx.lineTo(-L * 0.5, s * Wd * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // body
  let bodyFill = skin.body;
  if (skin.rainbow) {
    const g = ctx.createLinearGradient(0, -Wd * 0.4, 0, Wd * 0.4);
    ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3', '#9c27b0'].forEach((c, i) => g.addColorStop(i / 5, c));
    bodyFill = g;
  }
  roundRectPath(ctx, -L * 0.5, -Wd * 0.36, L, Wd * 0.72, Wd * 0.3);
  ctx.fillStyle = bodyFill;
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.03);
  ctx.strokeStyle = skin.rainbow ? '#ffffff' : shade(skin.body, -0.35);
  ctx.stroke();

  // shiny highlight
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRectPath(ctx, -L * 0.42, -Wd * 0.3, L * 0.84, Wd * 0.18, Wd * 0.09);
  ctx.fill();

  // hood stripe
  ctx.fillStyle = skin.trim;
  roundRectPath(ctx, L * 0.12, -Wd * 0.08, L * 0.32, Wd * 0.16, Wd * 0.08);
  ctx.fill();

  if (skin.spikes) {
    ctx.fillStyle = '#558b2f';
    for (let i = 0; i < 4; i++) {
      const sx = -L * 0.45 + i * L * 0.15;
      ctx.beginPath();
      ctx.moveTo(sx, -Wd * 0.36);
      ctx.lineTo(sx + L * 0.07, -Wd * 0.56);
      ctx.lineTo(sx + L * 0.14, -Wd * 0.36);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx, Wd * 0.36);
      ctx.lineTo(sx + L * 0.07, Wd * 0.56);
      ctx.lineTo(sx + L * 0.14, Wd * 0.36);
      ctx.fill();
    }
  }

  // headlights
  ctx.fillStyle = '#fff9c4';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(L * 0.46, s * Wd * 0.2, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // seat + steering wheel
  ctx.fillStyle = '#3e2723';
  roundRectPath(ctx, -L * 0.36, -Wd * 0.22, L * 0.3, Wd * 0.44, Wd * 0.14);
  ctx.fill();
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.beginPath();
  ctx.arc(L * 0.02, 0, Wd * 0.13, 0, Math.PI * 2);
  ctx.stroke();

  if (skin.siren) {
    const on = Math.floor(t * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff1744' : '#b71c1c';
    ctx.beginPath();
    ctx.arc(-L * 0.05, -Wd * 0.26, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? '#0d47a1' : '#2979ff';
    ctx.beginPath();
    ctx.arc(-L * 0.05, Wd * 0.26, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // driver
  const sx = x + Math.cos(heading) * -L * 0.2;
  const sy = y + Math.sin(heading) * -L * 0.2;
  const b = bob ? Math.abs(Math.sin(t * (moving > 0.05 ? 14 : 3))) * size * (moving > 0.05 ? 0.05 : 0.02) : 0;
  drawEmoji(ctx, skin.driver, sx, sy - size * 0.12 - b, size * 0.5);
  if (skin.crown) drawEmoji(ctx, '👑', sx, sy - size * 0.45 - b, size * 0.26);
}

// Mower movement in grid cells. The body is drawn by world3d/mower3d.js.
export class Mower {
  constructor(skin, x, y, size) {
    this.skin = skin;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.size = size; // normal length in cells
    this.scale = 1; // grows during the giant power-up
    this.scaleTarget = 1;
    this.speedMul = 1;
    this.speed01 = 0;
    // height off the ground, for hills and ramp jumps
    this.h = 0;
    this.vh = 0;
    this.airborne = false;
    this.rise = 0;
    this.squash = 0;
    this.travel = 0;
  }

  get radius() {
    return this.size * this.scale * 0.36;
  }

  // Glide toward the finger. Returns true if it bumped an obstacle this frame.
  update(dt, target, bounds, obstacles) {
    this.scale += (this.scaleTarget - this.scale) * (1 - Math.exp(-dt * 6));
    const maxSpd = this.size * 3.4 * this.speedMul;
    let dvx = 0;
    let dvy = 0;
    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > this.size * 0.12) {
        const spd = Math.min(maxSpd, d * 3.2 * Math.max(1, this.speedMul * 0.8));
        dvx = (dx / d) * spd;
        dvy = (dy / d) * spd;
      }
    }
    // no steering in mid-air, it just sails along
    const k = this.airborne ? 0 : 1 - Math.exp(-dt * 7);
    this.vx += (dvx - this.vx) * k;
    this.vy += (dvy - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const spd = Math.hypot(this.vx, this.vy);
    this.travel += spd * dt;
    if (spd > this.size * 0.3 && !this.airborne) {
      const h = Math.atan2(this.vy, this.vx);
      this.heading += angleDiff(this.heading, h) * Math.min(1, dt * 9);
    }

    let bumped = false;
    for (const o of obstacles) {
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const min = o.r + this.radius * 0.8;
      if (d < min) {
        const nx = dx / d;
        const ny = dy / d;
        this.x = o.x + nx * min;
        this.y = o.y + ny * min;
        const vn = this.vx * nx + this.vy * ny;
        if (vn < 0) {
          this.vx -= vn * nx;
          this.vy -= vn * ny;
        }
        if (spd > this.size * 0.8) bumped = true;
        o.wobble = 1;
      }
    }

    this.x = clamp(this.x, bounds.x, bounds.x + bounds.w);
    this.y = clamp(this.y, bounds.y, bounds.y + bounds.h);
    this.speed01 = clamp(spd / (this.size * 3.4), 0, 1);
    return bumped;
  }

  // Follow the ground, and fly off the end of a ramp. Returns 'launch', 'land' or null.
  updateHeight(dt, ground) {
    this.squash = Math.max(0, this.squash - dt * 4);
    if (this.airborne) {
      this.vh -= 22 * dt;
      this.h += this.vh * dt;
      if (this.h <= ground) {
        this.h = ground;
        this.airborne = false;
        this.squash = 1;
        return 'land';
      }
      return null;
    }
    const drop = this.h - ground;
    if (drop > 0.25 && this.rise > 1.2) {
      // went over the lip of a ramp
      this.airborne = true;
      this.vh = clamp(this.rise * 2.2, 4.5, 8);
      return 'launch';
    }
    const prev = this.h;
    // climb quickly but smoothly onto anything higher, settle down hills
    this.h = ground > this.h ? this.h + (ground - this.h) * (1 - Math.exp(-dt * 30)) : ground;
    const r = (this.h - prev) / Math.max(dt, 1e-3);
    this.rise = r > 0 ? r : this.rise * Math.exp(-dt * 20);
    return null;
  }

  // a little hop, for the horn
  hop(v = 4) {
    if (this.airborne) return;
    this.airborne = true;
    this.vh = v;
  }
}
