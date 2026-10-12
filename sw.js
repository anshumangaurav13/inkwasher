// sw.js - Service Worker for Inkwasher Offline Drawing & PWA Cache
const CACHE_NAME = 'inkwasher-v5';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './js/app.js',
  './js/gl-core.js',
  './js/shaders.js',
  './js/fluid-sim.js',
  './js/brushes.js',
  './js/viewport.js',
  './js/history.js',
  './js/ui.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key === CACHE_NAME ? null : caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-First strategy: always fetch fresh from network when online; fall back to cache when offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'));
      })
  );
});
