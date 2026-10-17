import { THEMES } from './themes.js';

// The first lawns are small open rectangles. After that the shapes rotate,
// the world changes every two lawns, and lawns grow a little at a time.
const SHAPES = ['rect', 'rect', 'roundrect', 'oval', 'heart', 'cloud', 'star', 'rect', 'diamond', 'plus', 'heart', 'oval', 'cloud', 'star', 'roundrect'];

export function levelDef(n) {
  const shape = n < SHAPES.length ? SHAPES[n] : SHAPES[2 + ((n - SHAPES.length) % (SHAPES.length - 2))];
  // every third lawn is a giant one that fills the whole screen
  const giant = n % 3 === 2;
  const obstacles = n < 2 ? 0 : n < 5 ? 1 : Math.min(1 + Math.floor((n - 2) / 3), 4);
  return {
    n,
    theme: THEMES[Math.floor(n / 2) % THEMES.length],
    shape,
    giant,
    fill: giant ? 1 : Math.min(0.5 + n * 0.04, 0.8), // fraction of the screen the lawn covers
    obstacles: giant ? obstacles + 1 : obstacles,
    surprises: Math.min(3 + Math.floor(n / 2), 7) + (giant ? 2 : 0),
    coins: giant ? 3 : n === 0 ? 1 : 1 + (n % 2),
  };
}
