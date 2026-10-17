// Turns touches/mouse into a single "where is the finger" target.
// The newest finger on the screen wins, so a stray palm doesn't confuse things.
import { unlockAudio } from './audio.js';
import { unlockSpeech } from './speech.js';

export function setupInput(canvas, handlers) {
  const pointers = new Map();
  let active = null;
  const state = { down: false, x: 0, y: 0 };

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = pos(e);
    pointers.set(e.pointerId, p);
    active = e.pointerId;
    state.down = true;
    state.x = p.x;
    state.y = p.y;
    handlers.down(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pos(e);
    pointers.set(e.pointerId, p);
    if (e.pointerId === active) {
      state.x = p.x;
      state.y = p.y;
      handlers.move?.(p.x, p.y);
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (e.pointerId !== active) return;
    if (pointers.size > 0) {
      const [id, p] = [...pointers.entries()].pop();
      active = id;
      state.x = p.x;
      state.y = p.y;
    } else {
      active = null;
      state.down = false;
      handlers.up?.(state.x, state.y);
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  // iOS treats touchend/click as the "real" user gesture for audio + speech.
  const unlock = () => {
    unlockAudio();
    unlockSpeech();
  };
  document.addEventListener('touchend', unlock, { passive: true });
  document.addEventListener('pointerup', unlock, { passive: true });
  document.addEventListener('click', unlock, { passive: true });

  // No scrolling, pinch-zoom, double-tap zoom, or long-press menus.
  const stop = (e) => e.preventDefault();
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('contextmenu', stop);

  return state;
}
