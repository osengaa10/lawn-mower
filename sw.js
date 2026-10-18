// Offline support: serve from cache, refresh the cache in the background.
// A new version of the game shows up on the next launch after an update.
// Bump CACHE when files are added or removed (npm test checks FILES is complete).
const CACHE = 'mighty-mower-v6';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/main.js',
  'src/audio.js',
  'src/buddies.js',
  'src/catalog.js',
  'src/events.js',
  'src/input.js',
  'src/lawn.js',
  'src/levels.js',
  'src/mower.js',
  'src/music.js',
  'src/particles.js',
  'src/pictures.js',
  'src/powerups.js',
  'src/speech.js',
  'src/storage.js',
  'src/terrain.js',
  'src/themes.js',
  'src/ui.js',
  'src/util.js',
  'src/screens/celebration.js',
  'src/screens/garage.js',
  'src/screens/menu.js',
  'src/screens/play.js',
  'src/screens/stickers.js',
  'src/screens/street.js',
  'src/world3d/camera.js',
  'src/world3d/effects3d.js',
  'src/world3d/grass.js',
  'src/world3d/ground.js',
  'src/world3d/mower3d.js',
  'src/world3d/props.js',
  'src/world3d/scenery.js',
  'src/world3d/animals.js',
  'src/world3d/models.js',
  'src/world3d/houses.js',
  'src/world3d/thumbs.js',
  'src/world3d/ambient3d.js',
  'src/world3d/renderer.js',
  'src/world3d/sprites.js',
  'assets/CREDITS.md',
  'assets/models/alien.glb',
  'assets/models/alpaca.glb',
  'assets/models/cat.glb',
  'assets/models/chick.glb',
  'assets/models/cow.glb',
  'assets/models/fox.glb',
  'assets/models/panda.glb',
  'assets/models/pig.glb',
  'assets/models/rabbit.glb',
  'assets/models/raccoon.glb',
  'assets/models/robot.glb',
  'assets/models/sheep.glb',
  'assets/models/shiba.glb',
  'assets/models/whitehorse.glb',
  'vendor/addons/environments/RoomEnvironment.js',
  'vendor/addons/geometries/RoundedBoxGeometry.js',
  'vendor/addons/libs/meshopt_decoder.module.js',
  'vendor/addons/loaders/GLTFLoader.js',
  'vendor/addons/utils/BufferGeometryUtils.js',
  'vendor/addons/utils/SkeletonUtils.js',
  'vendor/three.module.min.js',
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
