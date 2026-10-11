// sw.js - Service Worker for Inkwasher Offline Drawing & PWA Cache
const CACHE_NAME = 'inkwasher-v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key === CACHE_NAME ? null : caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match('./index.html'))
  );
});
