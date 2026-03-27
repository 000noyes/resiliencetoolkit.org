// Service Worker for Resilience Hub Toolkit
// Provides offline functionality through caching strategies

// IMPORTANT: Increment this version whenever you update CSS, JS, or design system
const CACHE_VERSION = 'build-placeholder'; // set by scripts/update-sw-assets.mjs at build time
const CACHE_NAME = `resilience-hub-${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  // Core pages
  '/',
  '/modules',
  '/downloads',
  '/about',
  '/dashboard',
  '/introduction',
  '/map',
  '/downloads-and-templates',
  '/LICENSE',

  // Module hub pages
  '/modules/emergency-preparedness/',
  '/modules/baseline-resilience/',
  '/modules/knowing-your-community',

  // Emergency Preparedness sections (dynamic MDX routes)
  '/modules/emergency-preparedness/1-1',
  '/modules/emergency-preparedness/1-2',
  '/modules/emergency-preparedness/1-3',
  '/modules/emergency-preparedness/1-4',
  '/modules/emergency-preparedness/1-5',
  '/modules/emergency-preparedness/1-6',
  '/modules/emergency-preparedness/1-7',
  '/modules/emergency-preparedness/1-8',
  '/modules/emergency-preparedness/1-9',
  '/modules/emergency-preparedness/1-10',
  '/modules/emergency-preparedness/1-11',
  '/modules/emergency-preparedness/1-12',
  '/modules/emergency-preparedness/1-13',

  // Baseline Resilience sections (dynamic MDX routes)
  '/modules/baseline-resilience/2-1',
  '/modules/baseline-resilience/2-2',
  '/modules/baseline-resilience/2-3',

  // Knowing Your Community section
  '/modules/knowing-your-community/0-1',

  // PWA Icons (all sizes for proper installation)
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',

  // Branding assets
  '/RHT_orange.svg',
  '/RHT_text.png',

  // PWA Configuration
  '/manifest.json',

  // ASSETS_START - Auto-generated section - do not manually edit
  // (populated by scripts/update-sw-assets.mjs at build time — do not add entries here)
  // ASSETS_END - Auto-generated section - do not manually edit
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
];

/**
 * Install event - cache core assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).catch((error) => {
      // Log which asset(s) failed to cache
      console.error('[SW] Precache failed:', error);

      // Attempt to cache individual assets to identify the problem
      return caches.open(CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.error(`[SW] Failed to cache: ${url}`, err);
              return null;
            })
          )
        );
      });
    }).then(() => {
      // Notify all clients that caching is complete
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'CACHE_COMPLETE',
            timestamp: new Date().toISOString(),
            cachedCount: PRECACHE_ASSETS.length
          });
        });
      });
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
