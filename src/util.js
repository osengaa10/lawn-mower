export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function weightedPick(items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const DPR = Math.min(window.devicePixelRatio || 1, 2);

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
export const TEXT_FONT = 'ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Nunito","Trebuchet MS",system-ui,sans-serif';

// Emoji are rendered once per size bucket into small canvases, then blitted.
const emojiCache = new Map();
function emojiSprite(ch, bucket) {
  const key = ch + '|' + bucket;
  let c = emojiCache.get(key);
  if (c) return c;
  const px = Math.ceil(bucket * 1.3 * DPR);
  c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${bucket * DPR}px ${EMOJI_FONT}`;
  g.fillText(ch, px / 2, px / 2 + bucket * DPR * 0.06);
  emojiCache.set(key, c);
  return c;
}

export function drawEmoji(ctx, ch, x, y, size, rot = 0, alpha = 1, flipX = false) {
  if (size <= 0.5 || alpha <= 0) return;
  const bucket = size <= 24 ? 24 : size <= 48 ? 48 : size <= 96 ? 96 : size <= 160 ? 160 : 256;
  const s = emojiSprite(ch, bucket);
  const w = size * 1.3;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(s, -w / 2, -w / 2, w, w);
  ctx.restore();
}

export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function starPath(ctx, x, y, r, inner = 0.5, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawStar(ctx, x, y, r, fill = '#ffd54f', stroke = '#f9a825', rot) {
  starPath(ctx, x, y, r, 0.5, 5, rot);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export function drawText(ctx, text, x, y, size, opts = {}) {
  const { color = '#fff', stroke = 'rgba(0,0,0,0.35)', align = 'center', baseline = 'middle', weight = 900 } = opts;
  ctx.save();
  ctx.font = `${weight} ${size}px ${TEXT_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (stroke) {
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function shade(hex, amt) {
  // amt in -1..1 : darken (<0) or lighten (>0)
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt < 0) {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
