// Service Worker for Resilience Hub Toolkit
// Provides offline functionality through caching strategies

// IMPORTANT: Increment this version whenever you update CSS, JS, or design system
const CACHE_VERSION = 'v4-full-precache';
const CACHE_NAME = `resilience-hub-${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  // Core pages
  '/',
  '/modules',
  '/offline',
  '/about',
  '/dashboard',
  '/introduction',
  '/library',
  '/map',
  '/downloads-and-templates',
  '/support',
  '/LICENSE',

  // Module hub pages
  '/modules/emergency-preparedness/',
  '/modules/baseline-resilience/',
  '/modules/knowing-your-community',

  // Emergency Preparedness sub-modules (1-1 through 1-13)
  '/modules/emergency-preparedness/1-1-kits',
  '/modules/emergency-preparedness/1-2-food-water',
  '/modules/emergency-preparedness/1-3-medical',
  '/modules/emergency-preparedness/1-4-power',
  '/modules/emergency-preparedness/1-5-shelter',
  '/modules/emergency-preparedness/1-6-vehicles',
  '/modules/emergency-preparedness/1-7-sanitation',
  '/modules/emergency-preparedness/1-8-special-populations',
  '/modules/emergency-preparedness/1-9-response-plans',
  '/modules/emergency-preparedness/1-10-volunteers',
  '/modules/emergency-preparedness/1-11-flood-recovery',
  '/modules/emergency-preparedness/1-12-mutual-aid',
  '/modules/emergency-preparedness/1-13-financial-resources',

  // Baseline Resilience sub-modules (2-1 through 2-3)
  '/modules/baseline-resilience/2-1-basic-needs',
  '/modules/baseline-resilience/2-2-shared-tools',
  '/modules/baseline-resilience/2-3-community-building',
];

// Cache strategies
const CACHE_FIRST_PATTERNS = [
  /\.(css|js|woff|woff2|ttf|eot)$/,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
  /\/fonts\//,
  /\/icons\//,
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
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Listen for messages from the main app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLAIM_CLIENTS') {
    self.clients.claim();
  }

  if (event.data && event.data.type === 'REGISTER_SYNC') {
    // Register a background sync when the app goes offline
    if ('sync' in self.registration) {
      self.registration.sync.register('sync-data').catch((error) => {
        console.error('Background sync registration failed:', error);
      });
    }
  }
});
