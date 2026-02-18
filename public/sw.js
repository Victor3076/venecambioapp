// Basic Service Worker for PWA installability
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // We can implement caching strategies here later if needed
    event.respondWith(fetch(event.request));
});
