const CACHE = 'mrt-v2';
const ASSETS = ['/MRT.html', '/'];
 
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});
 
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
 
self.addEventListener('fetch', e => {
  // Never cache API calls
  if (e.request.url.includes('/api/')) return;
 
  // For navigation (tab switches, page loads) — cache first, network in background
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        // Fire network request in background to keep cache fresh
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => {});
        // If we have a cached version, return it IMMEDIATELY — no waiting
        if (cached) return cached;
        // First ever visit — must wait for network
        return networkFetch;
      })
    );
    return;
  }
});
