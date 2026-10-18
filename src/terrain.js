// Hills, ramps and other seeded bits of a lawn that don't need the DOM
// (so they can be tested in Node and rebuilt exactly when a lawn is resumed).

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gentle round bumps, kept inside the lawn so the edges stay flat.
export function makeHills(seed, cols, rows, count) {
  const rng = mulberry32(seed + 101);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: cols * (0.2 + rng() * 0.6),
      z: rows * (0.2 + rng() * 0.6),
      r: Math.min(cols, rows) * (0.22 + rng() * 0.16),
      h: 0.5 + rng() * 0.9,
    });
  }
  return out;
}

export function hillHeight(hills, x, z) {
  let h = 0;
  for (const b of hills) h += b.h * Math.exp(-((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r));
  return h;
}

// A wooden kicker ramp: rises along its direction, then drops at the lip.
export const RAMP = { len: 3.2, wid: 2.6, h: 0.85 };

export function rampLocal(r, x, z) {
  const c = Math.cos(r.a);
  const s = Math.sin(r.a);
  const dx = x - r.gx;
  const dz = z - r.gy;
  return { u: dx * c + dz * s + RAMP.len / 2, v: -dx * s + dz * c };
}

export function rampHeight(r, x, z) {
  const { u, v } = rampLocal(r, x, z);
  if (u < 0 || u > RAMP.len || Math.abs(v) > RAMP.wid / 2) return 0;
  return RAMP.h * (u / RAMP.len);
}

export function groundHeight(hills, ramps, x, z) {
  let h = hillHeight(hills, x, z);
  for (const r of ramps) {
    const rh = rampHeight(r, x, z);
    if (rh > 0) h = Math.max(h, hillHeight(hills, r.gx, r.gy) + rh);
  }
  return h;
}

// How far through the lawn (0..1) the mid-lawn surprise shows up.
export function eventTrigger(seed) {
  return 0.35 + mulberry32(seed + 202)() * 0.3;
}
