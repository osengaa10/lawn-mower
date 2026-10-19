// A short loop built from oscillators, scheduled slightly ahead of time.
// 'bouncy' for menus and celebrations; 'calm' while mowing: the same tune,
// slower, softer and rounder, with no shaker.
import { audioCtx, musicDest } from './audio.js';

const MOODS = {
  bouncy: { bpm: 112, lead: 'triangle', leadVol: 0.07, leadLen: 1.6, bassVol: 0.12, shaker: true },
  calm: { bpm: 80, lead: 'sine', leadVol: 0.05, leadLen: 3.2, bassVol: 0.09, shaker: false },
};
let mood = MOODS.bouncy;

export function setMusicMood(name) {
  mood = MOODS[name] || MOODS.bouncy;
}

// semitones from C5; null = rest
const MELODY_A = [0, null, 4, null, 7, 9, 7, null, 4, null, 2, 4, 0, null, null, null,
  2, null, 4, null, 7, null, 9, 12, 9, null, 7, 4, 2, null, null, null];
const MELODY_B = [9, null, 7, null, 9, 12, 9, null, 7, null, 4, 7, 4, null, 2, null,
  0, null, 2, 4, 7, null, 4, null, 2, null, 4, 2, 0, null, null, null];
// root notes per half bar (semitones from C3)
const BASS = [0, 0, 5, 5, 7, 7, 0, 0];

let timer = null;
let step = 0;
let nextTime = 0;

const hz = (semis, base) => base * Math.pow(2, semis / 12);

function note(freq, t, dur, type, vol) {
  const ac = audioCtx();
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(musicDest());
  o.start(t);
  o.stop(t + dur + 0.05);
}

function schedule() {
  const ac = audioCtx();
  if (!ac || ac.state !== 'running') return;
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + 0.25) {
    const STEP = 60 / mood.bpm / 2; // eighth notes
    const bar64 = step % 64;
    const mel = bar64 < 32 ? MELODY_A : MELODY_B;
    const m = mel[bar64 % 32];
    if (m !== null) note(hz(m, 523.25), nextTime, STEP * mood.leadLen, mood.lead, mood.leadVol);
    if (step % 4 === 0) {
      const b = BASS[Math.floor(step / 8) % BASS.length];
      note(hz(b, 130.81), nextTime, STEP * (mood.shaker ? 1.8 : 3.6), 'sine', mood.bassVol);
    }
    if (step % 4 === 2) note(hz(BASS[Math.floor(step / 8) % BASS.length] + 7, 261.63), nextTime, STEP * 0.8, 'sine', 0.04);
    // soft shaker on the off beats
    if (mood.shaker && step % 2 === 1) note(6000 + (step % 3) * 300, nextTime, 0.03, 'square', 0.004);
    nextTime += STEP;
    step++;
  }
}

export function startMusic() {
  if (timer) return;
  timer = setInterval(schedule, 60);
}

export function stopMusic() {
  clearInterval(timer);
  timer = null;
}
