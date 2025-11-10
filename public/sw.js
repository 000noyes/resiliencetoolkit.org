// Service Worker for Resilience Hub Toolkit
// Provides offline functionality through caching strategies

// IMPORTANT: Increment this version whenever you update CSS, JS, or design system
const CACHE_VERSION = 'v3-dark-mode-fix';
const CACHE_NAME = `resilience-hub-${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/modules',
  '/offline',
  '/about',
];

// Cache strategies
const CACHE_FIRST_PATTERNS = [
  /\.(css|js|woff|woff2|ttf|eot)$/,
  /\/fonts\//,
];

const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /supabase/,
];

/**
 * Install event - cache core assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - serve from cache or network based on strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Determine strategy
  const isCacheFirst = CACHE_FIRST_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );

  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );

  if (isCacheFirst) {
    event.respondWith(cacheFirst(request));
  } else if (isNetworkFirst) {
    event.respondWith(networkFirst(request));
  } else {
    // Default: Network first, fallback to cache
    event.respondWith(networkFirst(request));
  }
});

/**
 * Cache-first strategy
 * Try cache, fallback to network, then cache the response
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline page if available
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network-first strategy
 * Try network, fallback to cache
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Background sync for offline changes
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

/**
 * Sync data when connection is restored
 */
async function syncData() {
  // This will trigger the sync in the main app
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_DATA',
    });
  });
}
