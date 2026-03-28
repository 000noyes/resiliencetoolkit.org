// Service Worker — Resilience Hub Toolkit
// Cache-first offline strategy. Bump CACHE_VERSION on every deploy.
const CACHE_VERSION = 'v29-cf-pages';
const CACHE_NAME = `resilience-hub-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/modules/',
  '/downloads/',
  '/about/',
  '/dashboard/',
  '/introduction/',
  '/map/',
  '/downloads-and-templates/',
  '/LICENSE/',
  '/modules/emergency-preparedness/',
  '/modules/baseline-resilience/',
  '/modules/knowing-your-community/',
  '/modules/emergency-preparedness/1-1-kits/',
  '/modules/emergency-preparedness/1-2-food-water/',
  '/modules/emergency-preparedness/1-3-medical/',
  '/modules/emergency-preparedness/1-4-power/',
  '/modules/emergency-preparedness/1-5-shelter/',
  '/modules/emergency-preparedness/1-6-vehicles/',
  '/modules/emergency-preparedness/1-7-sanitation/',
  '/modules/emergency-preparedness/1-8-special-populations/',
  '/modules/emergency-preparedness/1-9-response-plans/',
  '/modules/emergency-preparedness/1-10-volunteers/',
  '/modules/emergency-preparedness/1-11-flood-recovery/',
  '/modules/emergency-preparedness/1-12-mutual-aid/',
  '/modules/emergency-preparedness/1-13-financial-resources/',
  '/modules/baseline-resilience/2-1-basic-needs/',
  '/modules/baseline-resilience/2-2-shared-tools/',
  '/modules/baseline-resilience/2-3-community-building/',
  '/manifest.json',
  '/RHT_orange.svg',
  '/RHT_text.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // allSettled: one failed URL won't abort the whole precache
      Promise.allSettled(PRECACHE_ASSETS.map(url => cache.add(url)))
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
        // Clone before returning — body can only be consumed once
        if (response.ok && !response.redirected) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
