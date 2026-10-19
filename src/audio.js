// All sound is synthesized with the Web Audio API - no audio files needed.
import { rand } from './util.js';

let ac = null;
let master, sfxBus, musicBus, noiseBuf;
let muted = false;
let musicOn = true;
let engine = null;
const lastPlayed = {};

export function audioCtx() {
  return ac;
}
export function musicDest() {
  return musicBus;
}

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = musicOn ? 0.55 : 0;
    musicBus.connect(master);
    master.gain.value = muted ? 0 : 1;

    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // iOS: playing a silent buffer inside the gesture fully unlocks output.
    const s = ac.createBufferSource();
    s.buffer = ac.createBuffer(1, 1, 22050);
    s.connect(ac.destination);
    s.start(0);
  }
  if (ac.state === 'suspended' || ac.state === 'interrupted') ac.resume().catch(() => {});
}

export function suspendAudio() {
  if (ac && ac.state === 'running') ac.suspend().catch(() => {});
}
export function resumeAudio() {
  if (ac && ac.state !== 'running') ac.resume().catch(() => {});
}

export function setMuted(m) {
  muted = m;
  if (ac) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
}
export function setMusicOn(on) {
  musicOn = on;
  if (ac) musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.1);
}

function throttle(name, ms) {
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < ms) return false;
  lastPlayed[name] = now;
  return true;
}

export function tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, slide = null, attack = 0.005, dest } = {}) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest || sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.2, freq = 2000, q = 1, type = 'bandpass', when = 0, sweepTo = null } = {}) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = rand(0.8, 1.2);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  s.start(t, rand(0, 0.5));
  s.stop(t + dur + 0.05);
}

// C major pentatonic, two octaves - everything sounds nice together.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];

export const sfx = {
  // a soft swish of grass (the mower's own swish comes from the engine)
  snip() {
    if (!throttle('snip', 90)) return;
    noise(0.14, { vol: 0.035, freq: 1600, q: 0.6, type: 'lowpass' });
  },
  // a gentle bell when a whole row is mowed, rising up the scale
  rowChime(step = 0) {
    if (!throttle('rowChime', 220)) return;
    const f = PENTA[step % PENTA.length] / 2;
    tone(f, 1.4, { type: 'sine', vol: 0.07, attack: 0.02 });
    tone(f * 2, 0.9, { type: 'sine', vol: 0.025, attack: 0.02, when: 0.01 });
    tone(f * 3, 0.6, { type: 'sine', vol: 0.012, attack: 0.02, when: 0.02 });
  },
  // a soft, warm chord for the quiet moment at the end of a lawn
  calm() {
    [261.63, 329.63, 392.0, 523.25].forEach((f, i) => tone(f, 3.2, { type: 'sine', vol: 0.05, attack: 0.4, when: i * 0.18 }));
    tone(130.81, 3.5, { type: 'sine', vol: 0.06, attack: 0.6 });
  },
  pop() {
    if (!throttle('pop', 40)) return;
    tone(rand(380, 520), 0.12, { type: 'sine', vol: 0.3, slide: 1200 });
  },
  chime(step = 0) {
    const base = PENTA[(step * 2) % PENTA.length];
    tone(base, 0.25, { type: 'triangle', vol: 0.18 });
    tone(base * 1.5, 0.35, { type: 'sine', vol: 0.12, when: 0.07 });
  },
  coin() {
    tone(988, 0.08, { type: 'square', vol: 0.08 });
    tone(1319, 0.3, { type: 'square', vol: 0.08, when: 0.08 });
  },
  sparkle() {
    if (!throttle('sparkle', 60)) return;
    for (let i = 0; i < 3; i++) tone(PENTA[5 + i * 2] || 2000, 0.15, { type: 'sine', vol: 0.06, when: i * 0.05 });
  },
  boing() {
    if (!throttle('boing', 350)) return;
    tone(180, 0.35, { type: 'sine', vol: 0.3, slide: 520 });
    tone(90, 0.25, { type: 'triangle', vol: 0.15, slide: 260 });
  },
  tap() {
    tone(660, 0.08, { type: 'triangle', vol: 0.2 });
    tone(990, 0.1, { type: 'sine', vol: 0.12, when: 0.04 });
  },
  nope() {
    tone(300, 0.15, { type: 'triangle', vol: 0.18, slide: 220 });
  },
  surprise() {
    tone(523, 0.12, { type: 'triangle', vol: 0.2 });
    tone(784, 0.12, { type: 'triangle', vol: 0.2, when: 0.08 });
    tone(1047, 0.25, { type: 'triangle', vol: 0.2, when: 0.16 });
  },
  rare() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      tone(f, 0.3, { type: 'triangle', vol: 0.16, when: i * 0.07 }),
    );
  },
  whoosh() {
    noise(0.5, { vol: 0.12, freq: 400, sweepTo: 3000, q: 2 });
  },
  bang() {
    if (!throttle('bang', 80)) return;
    noise(0.6, { vol: 0.22, freq: 900, sweepTo: 150, q: 0.7, type: 'lowpass' });
    tone(rand(70, 110), 0.3, { type: 'sine', vol: 0.2, slide: 40 });
  },
  cheer() {
    // a crowd-ish "yaaay" from filtered noise + a fanfare
    noise(1.6, { vol: 0.14, freq: 1200, q: 0.6, sweepTo: 1800 });
    noise(1.4, { vol: 0.1, freq: 2600, q: 1.5, when: 0.1 });
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'square', vol: 0.07, when: i * 0.12 }));
    tone(1047, 0.9, { type: 'triangle', vol: 0.14, when: 0.5 });
    tone(1319, 0.9, { type: 'triangle', vol: 0.1, when: 0.5 });
  },
  fanfare() {
    const seq = [
      [523, 0],
      [523, 0.12],
      [523, 0.24],
      [659, 0.36],
      [784, 0.6],
      [659, 0.78],
      [784, 0.9],
      [1047, 1.1],
    ];
    seq.forEach(([f, w]) => tone(f, w === 1.1 ? 0.8 : 0.2, { type: 'square', vol: 0.08, when: w }));
    seq.forEach(([f, w]) => tone(f / 2, 0.2, { type: 'triangle', vol: 0.1, when: w }));
  },
  // beep beep!
  honk() {
    if (!throttle('honk', 300)) return;
    for (const w of [0, 0.22]) {
      tone(415, 0.18, { type: 'square', vol: 0.12, when: w });
      tone(523, 0.18, { type: 'square', vol: 0.1, when: w });
    }
  },
  bark() {
    for (const w of [0, 0.2]) {
      noise(0.07, { vol: 0.15, freq: 900, q: 1.5, when: w });
      tone(620, 0.12, { type: 'sawtooth', vol: 0.08, slide: 330, when: w });
    }
  },
  squeak() {
    if (!throttle('squeak', 150)) return;
    tone(rand(1100, 1400), 0.1, { type: 'sine', vol: 0.12, slide: rand(1700, 2100) });
  },
  stomp() {
    if (!throttle('stomp', 200)) return;
    tone(70, 0.25, { type: 'sine', vol: 0.35, slide: 40 });
    noise(0.2, { vol: 0.15, freq: 300, type: 'lowpass', q: 0.7 });
  },
  wheee() {
    tone(380, 0.55, { type: 'triangle', vol: 0.16, slide: 1250 });
    tone(760, 0.45, { type: 'sine', vol: 0.06, slide: 2000, when: 0.05 });
  },
  land() {
    if (!throttle('land', 200)) return;
    noise(0.25, { vol: 0.2, freq: 500, type: 'lowpass', q: 0.8 });
    tone(130, 0.2, { type: 'sine', vol: 0.25, slide: 60 });
  },
  powerup() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.07, when: i * 0.06 }));
    tone(1568, 0.5, { type: 'triangle', vol: 0.12, when: 0.3 });
  },
  powerdown() {
    tone(900, 0.25, { type: 'triangle', vol: 0.14, slide: 400 });
    tone(rand(380, 520), 0.12, { type: 'sine', vol: 0.2, slide: 1200, when: 0.25 });
  },
  boost() {
    noise(0.6, { vol: 0.14, freq: 500, sweepTo: 4000, q: 1.5 });
    tone(300, 0.5, { type: 'sawtooth', vol: 0.06, slide: 1100 });
  },
  bubble() {
    if (!throttle('bubble', 70)) return;
    tone(rand(700, 1000), 0.07, { type: 'sine', vol: 0.12, slide: rand(1400, 2000) });
  },
  moo() {
    tone(190, 0.9, { type: 'sawtooth', vol: 0.06, slide: 140, attack: 0.15 });
    tone(95, 0.9, { type: 'triangle', vol: 0.14, slide: 72, attack: 0.15 });
  },
  munch() {
    if (!throttle('munch', 180)) return;
    noise(0.06, { vol: 0.1, freq: 1800, q: 2 });
    noise(0.06, { vol: 0.08, freq: 1400, q: 2, when: 0.08 });
  },
  splash() {
    if (!throttle('splash', 250)) return;
    noise(0.45, { vol: 0.12, freq: 3500, type: 'highpass', q: 0.7 });
    tone(rand(900, 1200), 0.1, { type: 'sine', vol: 0.06, slide: 500 });
  },
  whistle() {
    tone(1200, 0.9, { type: 'sine', vol: 0.09, slide: 500 });
  },
  giftOpen() {
    noise(0.3, { vol: 0.12, freq: 2500, q: 0.8 });
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.14, when: 0.05 + i * 0.07 }));
  },
  candy(step = 0) {
    const f = PENTA[step % PENTA.length];
    tone(f, 0.2, { type: 'triangle', vol: 0.15 });
    tone(f * 2, 0.15, { type: 'sine', vol: 0.06, when: 0.05 });
  },
};

// A soft, low hum that rises a little with speed, plus a gentle swish of grass
// that swells while the blades are cutting.
export function startEngine() {
  if (!ac || engine) return;
  const o1 = ac.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ac.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = 110;
  const o2g = ac.createGain();
  o2g.gain.value = 0.22;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  // a slow, gentle pulse rather than a putt-putt
  const trem = ac.createGain();
  trem.gain.value = 0.85;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 6;
  const lfoAmt = ac.createGain();
  lfoAmt.gain.value = 0.12;
  lfo.connect(lfoAmt);
  lfoAmt.connect(trem.gain);
  const out = ac.createGain();
  out.gain.value = 0;
  o1.connect(lp);
  o2.connect(o2g);
  o2g.connect(lp);
  lp.connect(trem);
  trem.connect(out);
  out.connect(sfxBus);

  // the grass: looping soft noise through a gentle band
  const grass = ac.createBufferSource();
  grass.buffer = noiseBuf;
  grass.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1300;
  bp.Q.value = 0.6;
  const glp = ac.createBiquadFilter();
  glp.type = 'lowpass';
  glp.frequency.value = 2600;
  const grassOut = ac.createGain();
  grassOut.gain.value = 0;
  grass.connect(bp);
  bp.connect(glp);
  glp.connect(grassOut);
  grassOut.connect(sfxBus);

  o1.start();
  o2.start();
  lfo.start();
  grass.start();
  engine = { o1, o2, lfo, lp, out, grass, grassOut, bp };
}

// speed01: how fast the mower goes. cut01: how much grass it's cutting right now.
export function setEngine(speed01, cut01 = 0) {
  if (!engine) return;
  const t = ac.currentTime;
  engine.out.gain.setTargetAtTime(0.03 + speed01 * 0.05, t, 0.15);
  engine.o1.frequency.setTargetAtTime(55 + speed01 * 14, t, 0.2);
  engine.o2.frequency.setTargetAtTime(110 + speed01 * 28, t, 0.2);
  engine.lfo.frequency.setTargetAtTime(5 + speed01 * 4, t, 0.2);
  engine.lp.frequency.setTargetAtTime(240 + speed01 * 220, t, 0.2);
  engine.grassOut.gain.setTargetAtTime(cut01 * 0.09, t, 0.12);
  engine.bp.frequency.setTargetAtTime(1100 + cut01 * 500, t, 0.2);
}

export function stopEngine() {
  if (!engine) return;
  const e = engine;
  engine = null;
  const t = ac.currentTime;
  e.out.gain.setTargetAtTime(0, t, 0.15);
  e.grassOut.gain.setTargetAtTime(0, t, 0.1);
  setTimeout(() => {
    try {
      e.o1.stop();
      e.o2.stop();
      e.lfo.stop();
      e.grass.stop();
    } catch {
      /* already stopped */
    }
  }, 900);
}
