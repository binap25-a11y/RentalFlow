/**
 * 🛠️ Standard PWA Service Worker
 * This worker enables basic offline caching and meets the 'fetch' handler
 * requirement for Google Play Store (Trusted Web Activity) installability.
 */

const CACHE_NAME = 'rentalflow-v1';
const OFFLINE_URL = '/';

// 1. Install Phase: Cache the essential root entry point
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL]);
    })
  );
  self.skipWaiting();
});

// 2. Activation Phase: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Phase: Mandatory handler for PWA installability
// Simply passes through while allowing for future offline intercept logic
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
  }
});
