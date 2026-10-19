import { THEMES } from './themes.js';
import { OWNERS } from './catalog.js';
import { THEME_PICTURES } from './pictures.js';

// The first lawns are small open rectangles. After that the shapes rotate,
// the world changes every two lawns, and lawns grow a little at a time.
// Everything here depends only on n, so the street of finished lawns can be
// rebuilt from the number of lawns mowed.
const SHAPES = ['rect', 'rect', 'roundrect', 'oval', 'heart', 'cloud', 'star', 'rect', 'diamond', 'plus', 'heart', 'oval', 'cloud', 'star', 'roundrect'];

// Mid-lawn surprises, in the order each world takes turns with them.
const EVENTS = {
  day: ['balloon', 'sprinklers', 'cow'],
  sunset: ['cow', 'balloon', 'sprinklers'],
  night: ['stars', 'cow', 'balloon'],
  candy: ['candy', 'balloon', 'sprinklers'],
  moon: ['stars', 'balloon', 'candy'],
};

const POWERUPS = ['giant', 'turbo', 'bubbles'];

export function levelDef(n) {
  const shape = n < SHAPES.length ? SHAPES[n] : SHAPES[2 + ((n - SHAPES.length) % (SHAPES.length - 2))];
  const theme = THEMES[Math.floor(n / 2) % THEMES.length];
  // every third lawn is a giant one
  const giant = n % 3 === 2;
  const shaped = shape !== 'rect' && shape !== 'roundrect';
  // round/pointy shapes only fill part of their box, so give them a bigger box
  let long = giant ? Math.min(17 + n * 0.3, 22) : Math.min(10 + n * 0.6, 16);
  if (shaped) long *= 1.15;
  long = Math.round(long);
  const short = Math.round(long * (shaped ? 0.8 : 0.7));
  const visit = Math.floor(n / (THEMES.length * 2)); // how many times we've been round all the worlds
  const pics = THEME_PICTURES[theme.id];
  const owners = OWNERS[theme.id];
  const events = EVENTS[theme.id];
  return {
    n,
    theme,
    shape,
    giant,
    long,
    short,
    // keep the lawn calm: one of each thing at most
    obstacles: n < 2 ? 0 : 1,
    surprises: Math.min(2 + Math.floor(n / 3), 4) + (giant ? 1 : 0),
    coins: giant ? 3 : n === 0 ? 1 : 1 + (n % 2),
    hills: n < 2 ? 0 : 1 + (n % 3),
    ramps: n < 4 ? 0 : 1,
    picture: pics[(n % 2 + visit * 2) % pics.length],
    owner: owners[(n % 2 + visit * 2) % owners.length],
    powerups: n < 3 ? [] : [POWERUPS[n % 3]],
    // a surprise visitor on every other lawn
    event: n % 2 === 0 ? null : events[(Math.floor(n / 2) + visit) % events.length],
  };
}
