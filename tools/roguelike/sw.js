const CACHE_NAME = 'roguelike-v6';

const ASSETS = [
  './',
  './index.html',
  './play.html',
  './rogue.css',
  './manifest.webmanifest',
  './src/game.js',
  './src/constants.js',
  './src/entities.js',
  './src/fov.js',
  './src/mapgen.js',
  './src/render.js',
  './src/util.js',
  './src/audio.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache same-origin static files opportunistically.
          try {
            const url = new URL(req.url);
            if (url.origin === self.location.origin && res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
          } catch {
            // ignore
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

