// Service Worker for Resilience Hub Toolkit
// Provides offline functionality through caching strategies

// IMPORTANT: Increment this version whenever you update CSS, JS, or design system
const CACHE_VERSION = 'v25-comprehensive-offline';
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
  // Critical JavaScript bundles (Astro-generated)
  '/_astro/client.nc8uITnr.js',
  '/_astro/index.DK-fsZOb.js',
  '/_astro/storage.f_LD3a61.js',
  '/_astro/EditableTable.CvcuhiNG.js',
  '/_astro/ExternalLink.Bl_E_QGY.js',
  '/_astro/FeedbackWidgetWrapper.By8Wbg0d.js',
  '/_astro/Todo.COZM6rx0.js',
  '/_astro/createLucideIcon.Wb5B6754.js',
  '/_astro/BaseLayout.astro_astro_type_script_index_0_lang.Dat3PwEB.js',
  '/_astro/GuestModeBanner.BosJr2tb.js',
  '/_astro/jsx-runtime.ClP7wGfN.js',
  '/_astro/UserMenuWrapper.ChG-6rmU.js',
  '/_astro/x.BqmJGQCg.js',

  // Critical CSS

  // Pagefind search assets (offline search)
  '/pagefind/pagefind-entry.json',
  '/pagefind/pagefind.js',
  '/pagefind/fragment/en_1022667.pf_fragment',
  '/pagefind/fragment/en_1467aac.pf_fragment',
  '/pagefind/fragment/en_1d6d3d4.pf_fragment',
  '/pagefind/fragment/en_1eb8f58.pf_fragment',
  '/pagefind/fragment/en_1f51db2.pf_fragment',
  '/pagefind/fragment/en_38f5263.pf_fragment',
  '/pagefind/fragment/en_40e9d16.pf_fragment',
  '/pagefind/fragment/en_41dad4c.pf_fragment',
  '/pagefind/fragment/en_4fd7aac.pf_fragment',
  '/pagefind/fragment/en_595ed76.pf_fragment',
  '/pagefind/fragment/en_64da879.pf_fragment',
  '/pagefind/fragment/en_6dfac2f.pf_fragment',
  '/pagefind/fragment/en_719bfbe.pf_fragment',
  '/pagefind/fragment/en_755616d.pf_fragment',
  '/pagefind/fragment/en_87d5159.pf_fragment',
  '/pagefind/fragment/en_8c6c72c.pf_fragment',
  '/pagefind/fragment/en_983d969.pf_fragment',
  '/pagefind/fragment/en_9ccf943.pf_fragment',
  '/pagefind/fragment/en_a64d0cb.pf_fragment',
  '/pagefind/fragment/en_aa704b2.pf_fragment',
  '/pagefind/fragment/en_ab479fd.pf_fragment',
  '/pagefind/fragment/en_b76bf09.pf_fragment',
  '/pagefind/fragment/en_c6e24e8.pf_fragment',
  '/pagefind/fragment/en_d82a309.pf_fragment',
  '/pagefind/fragment/en_d88cdb5.pf_fragment',
  '/pagefind/fragment/en_eb7ae58.pf_fragment',
  '/pagefind/fragment/en_f6963ec.pf_fragment',
  '/pagefind/index/en_127789e.pf_index',
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
  /supabase/,
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
