// Offline support: serve from cache, refresh the cache in the background.
// A new version of the game shows up on the next launch after an update.
// Bump CACHE when files are added or removed (npm test checks FILES is complete).
const CACHE = 'mighty-mower-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/main.js',
  'src/audio.js',
  'src/catalog.js',
  'src/input.js',
  'src/lawn.js',
  'src/levels.js',
  'src/mower.js',
  'src/music.js',
  'src/particles.js',
  'src/speech.js',
  'src/storage.js',
  'src/themes.js',
  'src/ui.js',
  'src/util.js',
  'src/screens/celebration.js',
  'src/screens/garage.js',
  'src/screens/menu.js',
  'src/screens/play.js',
  'src/screens/stickers.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const fresh = caches.open(CACHE).then((cache) =>
    fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }),
  );
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => cached || fresh),
  );
});
