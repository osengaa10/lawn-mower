import { loadSave, writeSave } from './storage.js';
import { setupInput } from './input.js';
import { resumeAudio, setMusicOn, setMuted, suspendAudio } from './audio.js';
import { startMusic } from './music.js';
import { setSpeechEnabled } from './speech.js';
import { DPR } from './util.js';
import { MenuScreen } from './screens/menu.js';
import { PlayScreen } from './screens/play.js';
import { GarageScreen } from './screens/garage.js';
import { StickerScreen } from './screens/stickers.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const safeEl = document.getElementById('safe');

const game = {
  W: 0,
  H: 0,
  safe: { t: 0, r: 0, b: 0, l: 0 },
  save: loadSave(),
  input: null,
  screen: null,
  screens: {},
  persist() {
    writeSave(this.save);
  },
  go(name) {
    this.screen?.leave?.();
    this.screen = this.screens[name];
    this.screen.enter?.();
  },
  setMuted(m) {
    this.save.muted = m;
    setMuted(m);
    setSpeechEnabled(!m);
    this.persist();
  },
  setMusic(on) {
    this.save.music = on;
    setMusicOn(on);
    this.persist();
  },
};

function readSafe() {
  const cs = getComputedStyle(safeEl);
  game.safe = {
    t: parseFloat(cs.paddingTop) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
    l: parseFloat(cs.paddingLeft) || 0,
  };
}

function resize() {
  game.W = window.innerWidth;
  game.H = window.innerHeight;
  canvas.width = Math.round(game.W * DPR);
  canvas.height = Math.round(game.H * DPR);
  readSafe();
  game.screen?.resize?.();
}

let resizeTimer = null;
const onResize = () => {
  resize();
  // iOS reports the final size a moment after rotating
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 250);
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspendAudio();
  else resumeAudio();
});

resize();
setMuted(game.save.muted);
setMusicOn(game.save.music);
setSpeechEnabled(!game.save.muted);

game.input = setupInput(canvas, {
  down: (x, y) => game.screen?.down?.(x, y),
  move: (x, y) => game.screen?.move?.(x, y),
  up: (x, y) => game.screen?.up?.(x, y),
});

game.screens = {
  menu: new MenuScreen(game),
  play: new PlayScreen(game),
  garage: new GarageScreen(game),
  stickers: new StickerScreen(game),
};
game.go('menu');
startMusic();

// handy for testing in the browser console
window.__game = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.screen.update(dt);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  game.screen.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
