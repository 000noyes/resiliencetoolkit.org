// Service Worker — Resilience Hub Toolkit
// Cache-first for static assets, network-first for navigation.
// CACHE_VERSION is rewritten by scripts/generate-sw-precache.mjs at build time.
const CACHE_VERSION = 'v-build-PENDING';
const CACHE_NAME = `resilience-hub-${CACHE_VERSION}`;

// __PRECACHE_ASSETS_START__
const PRECACHE_ASSETS = [/* auto-generated — do not edit manually */];
// __PRECACHE_ASSETS_END__

// Essentials must succeed for install to succeed (Promise.all).
// Routes are nice-to-have — partial failures are tolerated (Promise.allSettled).
const ESSENTIAL_ASSETS = [
  '/',
  '/manifest.json',
  '/RHT_orange.svg',
];

// Runtime cache only writes for these destination types. Excludes XHR/fetch
// JSON, prefetch hints, and other non-document resources.
const CACHEABLE_DESTINATIONS = new Set(['document', 'style', 'script', 'font', 'image']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const niceToHave = PRECACHE_ASSETS.filter((url) => !ESSENTIAL_ASSETS.includes(url));
      return Promise.all([
        Promise.all(ESSENTIAL_ASSETS.map((url) => cache.add(url))),
        Promise.allSettled(
          niceToHave.map((url) =>
            cache.add(url).catch((e) => {
              console.warn('SW: failed to cache', url, e);
              throw e;
            })
          )
        ),
      ]);
    })
    // Silent-update policy: do NOT call skipWaiting() here. The new worker
    // stays `waiting` until every controlled tab is closed, then the browser
    // promotes it. Users get the update on next visit with no UI prompt.
    // Network-first navigation in the fetch handler keeps in-flight tabs
    // fresh in the meantime.
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
  // Only handle GET — cache.put() rejects POST/PUT/DELETE anyway, and
  // letting them fall through avoids a respondWith() round-trip.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Network-first for navigation requests. Ensures users see a fresh
  // deploy on first nav after CACHE_VERSION bumps; falls back to cache
  // when offline. Also resolves the redirected-response cache pollution
  // problem because navigation responses go through the redirect-aware
  // branch every time.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreVary: true }).then((cached) => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Cache-first for static assets in the destination whitelist.
  // `ignoreVary: true` is load-bearing for offline: precached `/_astro/*`
  // bundles are stored via cache.add (no Origin header), but a dynamic ES-module
  // import() is a CORS request that DOES send Origin. A server that returns
  // `Vary: Origin` on those assets (astro preview's sirv does; a CDN may) would
  // otherwise make caches.match(event.request) miss and 503 the module offline,
  // silently breaking every precached-but-unvisited route. The assets are
  // immutable + same-origin, so there is only ever one variant per URL — safe.
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      if (cached && !cached.redirected) return cached;
      return fetch(event.request).then((response) => {
        if (
          response.ok &&
          !response.redirected &&
          CACHEABLE_DESTINATIONS.has(event.request.destination)
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

