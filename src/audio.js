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
  // grass snip; the little musical blip climbs as the lawn gets finished
  snip(progress = 0) {
    if (!throttle('snip', 55)) return;
    noise(0.05, { vol: 0.12, freq: 4200, q: 0.8, type: 'highpass' });
    const n = PENTA[Math.min(PENTA.length - 1, Math.floor(progress * PENTA.length))];
    tone(n, 0.09, { type: 'triangle', vol: 0.05 });
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
};

// Putt-putt engine: a low sawtooth with a fast tremolo, louder/faster with speed.
export function startEngine() {
  if (!ac || engine) return;
  const o1 = ac.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = 48;
  const o2 = ac.createOscillator();
  o2.type = 'square';
  o2.frequency.value = 97;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  const trem = ac.createGain();
  trem.gain.value = 0.6;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 14;
  const lfoAmt = ac.createGain();
  lfoAmt.gain.value = 0.4;
  lfo.connect(lfoAmt);
  lfoAmt.connect(trem.gain);
  const out = ac.createGain();
  out.gain.value = 0;
  const o2g = ac.createGain();
  o2g.gain.value = 0.3;
  o1.connect(lp);
  o2.connect(o2g);
  o2g.connect(lp);
  lp.connect(trem);
  trem.connect(out);
  out.connect(sfxBus);
  o1.start();
  o2.start();
  lfo.start();
  engine = { o1, o2, lfo, lp, out };
}

export function setEngine(speed01) {
  if (!engine) return;
  const t = ac.currentTime;
  engine.out.gain.setTargetAtTime(0.035 + speed01 * 0.09, t, 0.08);
  engine.o1.frequency.setTargetAtTime(46 + speed01 * 30, t, 0.1);
  engine.o2.frequency.setTargetAtTime(93 + speed01 * 60, t, 0.1);
  engine.lfo.frequency.setTargetAtTime(12 + speed01 * 14, t, 0.1);
  engine.lp.frequency.setTargetAtTime(320 + speed01 * 500, t, 0.1);
}

export function stopEngine() {
  if (!engine) return;
  const e = engine;
  engine = null;
  const t = ac.currentTime;
  e.out.gain.setTargetAtTime(0, t, 0.05);
  setTimeout(() => {
    try {
      e.o1.stop();
      e.o2.stop();
      e.lfo.stop();
    } catch {
      /* already stopped */
    }
  }, 400);
}
