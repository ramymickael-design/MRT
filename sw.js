const CACHE = 'mrt-v1';
const ASSETS = ['/MRT.html', '/'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Clean up old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only intercept navigation requests (page loads/tab switches)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Serve cached version instantly
        // Simultaneously fetch fresh version and update cache in background
        const network = fetch(e.request).then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => cached); // If network fails, fall back to cache
        return cached || network;
      })
    );
    return;
  }

  // For API calls (/api/*) — never cache, always network
  if (e.request.url.includes('/api/')) {
    return;
  }
});
