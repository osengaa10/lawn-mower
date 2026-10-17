// Things hiding in the grass. Each kind found goes into the sticker book.
// move: how it leaves after popping out - hop, fly, crawl, or plant (stays on the lawn)
export const STICKERS = [
  { id: 'bunny', e: '🐰', name: 'Bunny', move: 'hop' },
  { id: 'butterfly', e: '🦋', name: 'Butterfly', move: 'fly' },
  { id: 'ladybug', e: '🐞', name: 'Ladybug', move: 'crawl' },
  { id: 'frog', e: '🐸', name: 'Froggy', move: 'hop' },
  { id: 'daisy', e: '🌼', name: 'Flower', move: 'plant' },
  { id: 'snail', e: '🐌', name: 'Snail', move: 'crawl' },
  { id: 'bird', e: '🐦', name: 'Birdie', move: 'fly' },
  { id: 'mushroom', e: '🍄', name: 'Mushroom', move: 'plant' },
  { id: 'turtle', e: '🐢', name: 'Turtle', move: 'crawl' },
  { id: 'hedgehog', e: '🦔', name: 'Hedgehog', move: 'crawl' },
  { id: 'squirrel', e: '🐿️', name: 'Squirrel', move: 'hop' },
  { id: 'chick', e: '🐥', name: 'Baby chick', move: 'hop' },
  { id: 'puppy', e: '🐶', name: 'Puppy', move: 'hop' },
  { id: 'kitty', e: '🐱', name: 'Kitty', move: 'hop' },
  { id: 'mouse', e: '🐭', name: 'Mouse', move: 'hop' },
  { id: 'ball', e: '⚽', name: 'Ball', move: 'hop' },

  { id: 'bee', e: '🐝', name: 'Bumble bee', move: 'fly', theme: 'day' },
  { id: 'tulip', e: '🌷', name: 'Tulip', move: 'plant', theme: 'day' },
  { id: 'fox', e: '🦊', name: 'Fox', move: 'hop', theme: 'sunset' },
  { id: 'duck', e: '🦆', name: 'Duck', move: 'crawl', theme: 'sunset' },
  { id: 'pumpkin', e: '🎃', name: 'Pumpkin', move: 'plant', theme: 'sunset' },
  { id: 'owl', e: '🦉', name: 'Owl', move: 'fly', theme: 'night' },
  { id: 'bat', e: '🦇', name: 'Bat', move: 'fly', theme: 'night' },
  { id: 'raccoon', e: '🦝', name: 'Raccoon', move: 'hop', theme: 'night' },
  { id: 'cupcake', e: '🧁', name: 'Cupcake', move: 'plant', theme: 'candy' },
  { id: 'lollipop', e: '🍭', name: 'Lollipop', move: 'plant', theme: 'candy' },
  { id: 'donut', e: '🍩', name: 'Donut', move: 'plant', theme: 'candy' },
  { id: 'alien', e: '👽', name: 'Alien', move: 'hop', theme: 'moon' },
  { id: 'ufo', e: '🛸', name: 'U F O', move: 'fly', theme: 'moon' },
  { id: 'rocket', e: '🚀', name: 'Rocket', move: 'fly', theme: 'moon' },

  { id: 'unicorn', e: '🦄', name: 'Unicorn', move: 'hop', rare: true },
  { id: 'rainbow', e: '🌈', name: 'Rainbow', move: 'plant', rare: true },
  { id: 'dragon', e: '🐉', name: 'Dragon', move: 'fly', rare: true },
  { id: 'dino', e: '🦕', name: 'Dinosaur', move: 'crawl', rare: true },
  { id: 'gem', e: '💎', name: 'Treasure', move: 'plant', rare: true },
  { id: 'crown', e: '👑', name: 'Crown', move: 'plant', rare: true },
];

export const STICKER_BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s]));

// Mowers unlock by total stars ever earned (stars are never spent).
// Early unlocks come quickly to hook the player, later ones spread out.
export const MOWERS = [
  { id: 'red', name: 'Red mower', body: '#e53935', trim: '#ffcdd2', driver: '🐶', cost: 0 },
  { id: 'green', name: 'Green tractor', body: '#43a047', trim: '#fff59d', driver: '🐸', cost: 3 },
  { id: 'blue', name: 'Blue racer', body: '#1e88e5', trim: '#bbdefb', driver: '🐱', cost: 7 },
  { id: 'orange', name: 'Orange zoomer', body: '#fb8c00', trim: '#ffe0b2', driver: '🦊', cost: 12 },
  { id: 'purple', name: 'Magic mower', body: '#8e24aa', trim: '#e1bee7', driver: '🦄', cost: 18, trail: 'sparkle' },
  { id: 'police', name: 'Police mower', body: '#263238', trim: '#eceff1', driver: '🐼', cost: 25, siren: true },
  { id: 'pink', name: 'Love mower', body: '#ec407a', trim: '#f8bbd0', driver: '🐷', cost: 33, trail: 'hearts' },
  { id: 'dino', name: 'Dino mower', body: '#7cb342', trim: '#dcedc8', driver: '🦖', cost: 42, spikes: true },
  { id: 'fire', name: 'Fire truck', body: '#d32f2f', trim: '#ffeb3b', driver: '🐵', cost: 52, siren: true },
  { id: 'rocket', name: 'Rocket mower', body: '#b0bec5', trim: '#eceff1', driver: '👽', cost: 64, trail: 'flame', fins: true },
  { id: 'rainbow', name: 'Rainbow mower', body: '#ffffff', trim: '#ffffff', driver: '🐯', cost: 78, rainbow: true, trail: 'rainbow' },
  { id: 'gold', name: 'Golden mower', body: '#ffc107', trim: '#fff8e1', driver: '🦁', cost: 95, trail: 'sparkle', crown: true },
];

export const MOWER_BY_ID = Object.fromEntries(MOWERS.map((m) => [m.id, m]));
