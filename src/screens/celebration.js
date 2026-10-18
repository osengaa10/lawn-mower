import { MOWERS } from '../catalog.js';
import { drawMower3D } from '../world3d/thumbs.js';
import { sfx } from '../audio.js';
import { say } from '../speech.js';
import { Button, hitButtons, playTriangle } from '../ui.js';
import { clamp, drawEmoji, drawStar, drawText, easeOutBack, pick, rand, roundRectPath } from '../util.js';

const CHEERS = ['Hooray! You did it!', 'Great job! The lawn looks amazing!', 'Wow! All done! Super mowing!', 'Yay! You mowed the whole lawn!'];
const STAR_TIMES = [0.9, 1.3, 1.7];
const LOCKED = { body: '#9e9e9e', trim: '#bdbdbd', driver: '❓' };

export class Celebration {
  constructor(game, play) {
    this.g = game;
    this.play = play;
    this.nextBtn = new Button({
      color: '#43a047', pulse: true, draw: playTriangle,
      onTap: () => { sfx.tap(); game.streetIntro = 'thanks'; game.go('street'); },
    });
    this.homeBtn = new Button({ icon: '🏠', color: '#ffb74d', onTap: () => { sfx.tap(); game.go('menu'); } });
  }

  start() {
    const { save } = this.g;
    this.t = 0;
    this.fwT = 0;
    this.starsShown = 0;
    this.prevStars = save.stars;
    save.stars += 3;
    save.lawns += 1;
    const fresh = MOWERS.filter((m) => m.cost <= save.stars && !save.unlocked.includes(m.id));
    for (const m of fresh) save.unlocked.push(m.id);
    this.unlock = fresh.length ? fresh[fresh.length - 1] : null;
    if (this.unlock) save.mower = this.unlock.id;
    this.next = MOWERS.find((m) => !save.unlocked.includes(m.id)) || null;
    this.giftOpen = false;
    this.giftOpenAt = this.unlock ? 3.4 : Infinity;
    this.buttonsAt = this.unlock ? 4.6 : 2.6;
    this.g.persist();
    sfx.cheer();
    say(pick(CHEERS), { force: true });
    this.play.particles.confetti(this.g.W, 140);
    this.layout();
  }

  layout() {
    const { W, H, safe } = this.g;
    const cw = Math.min(W - 40, 560);
    const ch = Math.min(H - safe.t - safe.b - 30, 440);
    this.card = { x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch };
    const br = clamp(ch * 0.14, 34, 56);
    this.nextBtn.set(W / 2 + br * 0.6, this.card.y + ch - br * 0.75, br);
    this.homeBtn.set(W / 2 - br * 1.6, this.card.y + ch - br * 0.75, br * 0.62);
  }

  openGift() {
    if (this.giftOpen || !this.unlock) return;
    this.giftOpen = true;
    this.giftT = this.t;
    sfx.fanfare();
    const c = this.card;
    this.play.particles.burst(c.x + c.w / 2, c.y + c.h * 0.6, 40, 1.2);
    this.play.particles.firework(c.x + c.w / 2, c.y + c.h * 0.6, 1);
    say('Wow! You got a new mower!', { force: true });
    this.buttonsAt = Math.max(this.buttonsAt, this.t + 1.2);
  }

  update(dt) {
    this.t += dt;
    const { W, H } = this.g;
    const P = this.play.particles;
    if (this.t < 4) {
      this.fwT -= dt;
      if (this.fwT <= 0) {
        this.fwT = rand(0.25, 0.5);
        P.firework(rand(W * 0.1, W * 0.9), rand(H * 0.1, H * 0.5));
        sfx.bang();
      }
    }
    if (this.t > 1.6 && this.t - dt <= 1.6) P.confetti(W, 80);
    while (this.starsShown < 3 && this.t >= STAR_TIMES[this.starsShown]) {
      sfx.chime(this.starsShown + 2);
      const c = this.card;
      P.burst(c.x + c.w / 2 + (this.starsShown - 1) * c.h * 0.22, c.y + c.h * 0.33, 14, 0.8, ['#ffd54f', '#ffffff']);
      this.starsShown++;
    }
    if (this.t >= this.giftOpenAt) this.openGift();
    const show = this.t >= this.buttonsAt;
    this.nextBtn.visible = show;
    this.homeBtn.visible = show;
  }

  down(x, y) {
    if (hitButtons([this.nextBtn, this.homeBtn], x, y)) return;
    if (this.unlock && !this.giftOpen && this.t > 2.4) this.openGift();
  }

  draw(ctx) {
    const { W, H } = this.g;
    const t = this.t;
    const fade = clamp(t / 0.5, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * fade})`;
    ctx.fillRect(0, 0, W, H);

    const c = this.card;
    const k = easeOutBack(clamp((t - 0.2) / 0.5, 0, 1));
    if (k <= 0) return;
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.scale(k, k);
    ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRectPath(ctx, c.x, c.y + 8, c.w, c.h, 32);
    ctx.fill();
    ctx.fillStyle = '#fffdf5';
    roundRectPath(ctx, c.x, c.y, c.w, c.h, 32);
    ctx.fill();
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 8;
    ctx.stroke();

    const cx = c.x + c.w / 2;
    const ts = clamp(c.h * 0.12, 30, 56);
    drawText(ctx, 'Hooray!', cx, c.y + ts * 0.95, ts + Math.sin(t * 6) * 2, { color: '#ff7043', stroke: '#ffffff' });

    // three stars, popping in one by one
    const sr = c.h * 0.085;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * c.h * 0.22;
      const sy = c.y + c.h * 0.33 - (i === 1 ? sr * 0.3 : 0);
      if (i < this.starsShown) {
        const sk = easeOutBack(clamp((t - STAR_TIMES[i]) / 0.35, 0, 1));
        drawStar(ctx, sx, sy, sr * 1.25 * sk, '#ffd54f', '#f9a825', -Math.PI / 2 + Math.sin(t * 3 + i) * 0.1);
      } else {
        drawStar(ctx, sx, sy, sr * 1.25, '#eeeeee', '#dddddd', -Math.PI / 2);
      }
    }

    const midY = c.y + c.h * 0.6;
    const ms = Math.min(c.h * 0.26, c.w * 0.3);
    if (this.unlock) {
      if (!this.giftOpen) {
        if (t > 2.4) {
          const gk = easeOutBack(clamp((t - 2.4) / 0.4, 0, 1));
          const shake = Math.sin(t * 30) * 0.12 * clamp((t - 2.6) * 2, 0, 1);
          drawEmoji(ctx, '🎁', cx, midY, ms * 1.1 * gk, shake);
        }
      } else {
        const gk = easeOutBack(clamp((t - this.giftT) / 0.5, 0, 1));
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.translate(cx, midY);
        ctx.rotate(t * 0.8);
        ctx.fillStyle = '#fff59d';
        for (let i = 0; i < 12; i++) {
          ctx.rotate(Math.PI / 6);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(ms * 1.1, -ms * 0.14);
          ctx.lineTo(ms * 1.1, ms * 0.14);
          ctx.fill();
        }
        ctx.restore();
        drawMower3D(ctx, this.unlock, cx, midY, ms * gk, Math.sin(t * 2) * 0.3, t, { moving: 0.3 });
      }
    } else if (this.next) {
      // a teaser of the next mower, so there's always something to work toward
      const nk = clamp((t - 2) / 0.4, 0, 1);
      ctx.globalAlpha = nk;
      drawMower3D(ctx, LOCKED, cx - ms * 0.55, midY, ms * 0.8, 0, t, { bob: false });
      const bx = cx + ms * 0.1;
      const bw = Math.min(c.w * 0.38, ms * 1.6);
      const bh = 22;
      const have = this.g.save.stars;
      const prev = MOWERS.filter((m) => m.cost <= have).pop()?.cost || 0;
      const frac = clamp((have - prev) / (this.next.cost - prev), 0, 1);
      ctx.fillStyle = '#e0e0e0';
      roundRectPath(ctx, bx, midY - bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = '#ffca28';
      roundRectPath(ctx, bx, midY - bh / 2, Math.max(bh, bw * frac * clamp((t - 2.2) / 0.8, 0, 1)), bh, bh / 2);
      ctx.fill();
      drawStar(ctx, bx + bw + 16, midY, 14, '#ffd54f', '#f9a825');
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (k >= 1) {
      this.nextBtn.draw(ctx, t);
      this.homeBtn.draw(ctx, t);
    }
  }
}
