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
import { StreetScreen } from './screens/street.js';
import { getRenderer, resizeRenderer, showWorld } from './world3d/renderer.js';

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
    // include the lawn in progress so closing the app mid-lawn loses nothing
    const current = this.screens.play?.snapshot();
    if (current !== undefined) this.save.current = current;
    writeSave(this.save);
  },
  go(name) {
    this.screen?.leave?.();
    this.screen = this.screens[name];
    this.screen.enter?.();
    showWorld(!!this.screen.uses3D);
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
  resizeRenderer(game.W, game.H);
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

// iOS may close a backgrounded app without warning, so save the moment it's hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.persist();
    suspendAudio();
  } else resumeAudio();
});
window.addEventListener('pagehide', () => game.persist());

// Ask the browser not to clear saved progress when storage runs low.
navigator.storage?.persist?.().catch(() => {});

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
  street: new StreetScreen(game),
};
game.go('menu');
startMusic();

// ---------- Offline support ----------

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// handy for testing in the browser console, e.g. __game.debug.goto(4)
window.__game = game;
game.debug = {
  // jump to lawn n (fresh)
  goto(n) {
    game.save.lawns = n;
    game.save.current = null;
    game.screens.play.lawn = null;
    game.go('play');
  },
  power(kind = 'giant') {
    game.screens.play.powerups?.start(kind);
  },
  event(kind) {
    const play = game.screens.play;
    play.events?.start(kind || play.lawn.def.event || 'balloon');
  },
  finish() {
    game.screens.play.startFinish();
  },
  street() {
    game.go('street');
  },
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.screen.update(dt);
  if (game.screen.uses3D) game.screen.render3d(getRenderer());
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, game.W, game.H);
  game.screen.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
