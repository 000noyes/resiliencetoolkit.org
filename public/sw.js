// Service Worker — Resilience Hub Toolkit
// Cache-first offline strategy. Bump CACHE_VERSION on every deploy.
const CACHE_VERSION = 'v-build-PENDING';
const CACHE_NAME = `resilience-hub-${CACHE_VERSION}`;

// __PRECACHE_ASSETS_START__
const PRECACHE_ASSETS = [/* auto-generated — do not edit manually */];
// __PRECACHE_ASSETS_END__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_ASSETS.map(url => cache.add(url).catch(e => console.warn('SW: failed to cache', url, e))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Don't serve cached redirected responses — let the browser follow them natively
      if (cached && !cached.redirected) return cached;
      return fetch(event.request).then((response) => {
        // Don't cache redirected responses under the original URL
        if (response.ok && !response.redirected) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
