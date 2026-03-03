const CACHE = 'madakop-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/register.html',
  '/login.html',
  '/members.html',
  '/rewards.html',
  '/strain-finder.html',
  '/tutorials.html',
  '/style.css',
  '/script.js'
];

// Install — cache all pages
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
