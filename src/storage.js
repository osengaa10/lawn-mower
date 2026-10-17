const KEY = 'mighty-mower-save-v1';

const DEFAULTS = {
  stars: 0, // total stars ever earned (never spent)
  lawns: 0, // lawns finished
  mower: 'red',
  unlocked: ['red'],
  stickers: {}, // sticker id -> times found
  muted: false,
  music: true,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...DEFAULTS, ...data, stickers: { ...(data.stickers || {}) } };
    }
  } catch {
    // storage blocked or corrupt - just start fresh
  }
  return { ...DEFAULTS, unlocked: [...DEFAULTS.unlocked], stickers: {} };
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore - game still works without saving
  }
}
