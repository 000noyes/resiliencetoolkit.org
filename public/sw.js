// Service Worker — Resilience Hub Toolkit
// Cache-first for static assets, network-first for navigation.
// CACHE_VERSION is rewritten by scripts/generate-sw-precache.mjs at build time.
//
// Update policy: a new worker announces itself to the page once its cache
// generation is verified complete; activation is user-initiated (SKIP_WAITING
// from the refresh notice) or idle (SKIP_WAITING_WHEN_HIDDEN when every window
// is hidden). Both are completeness-gated HERE, worker-side, so no page code
// path can activate an incomplete generation. One exception: a one-time forced
// ramp (install-time skipWaiting) for devices still pinned to a pre-May-2026
// worker that never hands off — gated on legacy cache names plus a persistent
// ramp marker so it fires at most once per device.
const CACHE_VERSION = 'v-build-PENDING';
const V2_PREFIX = 'resilience-hub-v2-';
const CACHE_NAME = `resilience-hub-v2-${CACHE_VERSION}`;
// Empty cache whose existence means "a v2 worker already force-activated here".
// Excluded from every prune; deleted only when no legacy-named cache survives.
const RAMP_MARKER_CACHE = 'resilience-hub-v2-ramp';
// Synthetic entry written into a generation when it verifies complete. No real
// route can collide with it and it is never served; it marks a generation as
// whole (and becomes the trust marker for cache-first navigation later).
const SENTINEL_PATH = '/__rt-precache-complete__';
// How many precache fetches run at once during top-up. Small on purpose: a
// wide parallel fan-out is what gets a worker killed on low-memory phones.
const TOPUP_CHUNK_SIZE = 5;
const LEGACY_BUILD_RE = /^resilience-hub-v-build-\d+$/;

// __PRECACHE_ASSETS_START__
const PRECACHE_ASSETS = [/* auto-generated — do not edit manually */];
// __PRECACHE_ASSETS_END__

// Essentials must succeed for install to succeed (Promise.all).
// Routes are nice-to-have — partial failures are tolerated (Promise.allSettled)
// and converge to complete via topUpPrecache retriggers.
const ESSENTIAL_ASSETS = [
  '/',
  '/manifest.json',
  '/RHT_orange.svg',
];

// Runtime cache only writes for these destination types. Excludes XHR/fetch
// JSON, prefetch hints, and other non-document resources.
const CACHEABLE_DESTINATIONS = new Set(['document', 'style', 'script', 'font', 'image']);

// A cache from the pre-v2 naming scheme. Pinned to the two HISTORICAL name
// shapes (resilience-hub-v<digits>-… and resilience-hub-v-build-<digits>) on
// purpose — a broad "anything not current" predicate would classify every
// FUTURE prefix as legacy and re-fire the fleet-wide forced ramp on the next
// naming change. If the prefix scheme ever moves past v2, delete the ramp
// (its cohort will be long healed) rather than widening this regex.
// 'resilience-hub-v25-…' diverges from 'resilience-hub-v2-' at the character
// after "v2", so no historical name is misclassified as current.
function isLegacyCacheName(name) {
  return /^resilience-hub-(v\d+-|v-build-)/.test(name) && !name.startsWith(V2_PREFIX);
}

// Trailing v-build timestamp of a cache name (either prefix), or null.
// Fixed-width digits, so string comparison orders generations correctly.
function buildTsOf(name) {
  const m = name.match(/v-build-(\d+)$/);
  return m ? m[1] : null;
}

// Route HTML, the manifest, and icons are mutable at a fixed URL, so a
// precache fill must revalidate with the server: cache.add's default fetch can
// be satisfied by the HTTP cache, silently filling a NEW generation with the
// PREVIOUS build's pages (updateViaCache:'none' protects sw.js itself, not
// these route fetches). `no-cache` revalidates; an unchanged page is a cheap
// 304. Hashed /_astro/* files are immutable per filename — the HTTP cache is a
// correct source for them and revalidation would be pure overhead.
function precacheRequest(url) {
  return url.startsWith('/_astro/') ? url : new Request(url, { cache: 'no-cache' });
}

// Pathnames present in a cache, counting ONLY query-less entries. The
// runtime navigation handler cache.puts full request URLs, so a visit to
// /route/?utm=x stores a query-carrying key; counting it as /route/ would
// mark the generation complete while a plain offline navigation to /route/
// still misses (Cache.match does not ignore the search string).
async function cleanCachedPaths(cache) {
  const present = new Set();
  for (const req of await cache.keys()) {
    const url = new URL(req.url);
    if (url.search === '') present.add(url.pathname);
  }
  return present;
}

// The completeness law: every rotation and every prune is gated on this.
// The length guard makes a generator regression fail SAFE (never prune on an
// empty list).
async function precacheComplete() {
  if (PRECACHE_ASSETS.length === 0) return false;
  const cache = await caches.open(CACHE_NAME);
  const present = await cleanCachedPaths(cache);
  return PRECACHE_ASSETS.every((url) => present.has(url));
}

// The prune law. Runs ONLY when the current generation is complete:
// - delete legacy-prefix and unrelated caches, and v2 caches STRICTLY OLDER
//   than this build — never newer/equal (a waiting worker's warming cache
//   must survive the active worker's page-triggered top-ups);
// - retain the single newest previous BUILD cache STRIPPED to /_astro/*
//   entries, so still-open old pages (including never-reloaded legacy pages)
//   keep their hashed chunks for one generation of depth, while their stale
//   route HTML becomes unservable;
// - the ramp marker is deleted only when no legacy-named cache survives the
//   pass (the stripped cache may carry a legacy name; deleting the marker
//   while it exists would re-arm the ramp gate on the next deploy).
async function pruneOldCaches() {
  const names = await caches.keys();
  const ownTs = buildTsOf(CACHE_NAME);
  const prunable = names.filter((name) => {
    if (name === CACHE_NAME || name === RAMP_MARKER_CACHE) return false;
    if (name.startsWith(V2_PREFIX)) {
      const ts = buildTsOf(name);
      return ts !== null && ownTs !== null && ts < ownTs;
    }
    return true;
  });

  let keepAssets = null;
  for (const name of prunable) {
    const isBuild = name.startsWith(V2_PREFIX) ? buildTsOf(name) !== null : LEGACY_BUILD_RE.test(name);
    if (!isBuild) continue;
    if (!keepAssets || (buildTsOf(name) || '') > (buildTsOf(keepAssets) || '')) keepAssets = name;
  }

  await Promise.all(prunable.filter((n) => n !== keepAssets).map((n) => caches.delete(n)));

  if (keepAssets) {
    const kept = await caches.open(keepAssets);
    const keys = await kept.keys();
    await Promise.all(
      keys
        .filter((req) => !new URL(req.url).pathname.startsWith('/_astro/'))
        .map((req) => kept.delete(req))
    );
  }

  const after = await caches.keys();
  if (!after.some(isLegacyCacheName)) {
    await caches.delete(RAMP_MARKER_CACHE);
  }
}

// Chunked precache fill: a few fetches at a time (a wide parallel fan-out is
// what gets a worker killed on low-memory phones), failures tolerated and
// logged — holes converge via the retriggers below.
async function fillChunked(cache, urls) {
  for (let i = 0; i < urls.length; i += TOPUP_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + TOPUP_CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map((url) =>
        cache.add(precacheRequest(url)).catch((e) => {
          console.warn('SW: failed to cache', url, e);
          throw e;
        })
      )
    );
  }
}

// Fill whatever the precache is still missing. Assets before route HTML, and
// route HTML only once EVERY non-route file is present, so a route this
// generation serves always renders whole. Writes the completeness sentinel
// and (optionally) prunes when the generation is whole. Retriggered from
// activate (detached), the first fetch per startup, the PRECACHE_TOPUP page
// message, and PRECACHE_WARM — so an interrupted fill resumes no matter what
// vintage of page is being served. The sentinel doubles as the steady-state
// fast path: once the generation verified complete, re-triggers cost one
// keyed lookup instead of full cache enumerations.
async function topUpPrecache({ prune = true } = {}) {
  const cache = await caches.open(CACHE_NAME);
  if (await cache.match(SENTINEL_PATH)) return;
  const isRoute = (url) => url.endsWith('/');

  const present = await cleanCachedPaths(cache);
  await fillChunked(
    cache,
    PRECACHE_ASSETS.filter((url) => !isRoute(url) && !present.has(url))
  );

  const midway = await cleanCachedPaths(cache);
  const assetsComplete = PRECACHE_ASSETS.filter((url) => !isRoute(url)).every((url) =>
    midway.has(url)
  );
  if (assetsComplete) {
    await fillChunked(
      cache,
      PRECACHE_ASSETS.filter((url) => isRoute(url) && !midway.has(url))
    );
  }

  if (await precacheComplete()) {
    await cache.put(SENTINEL_PATH, new Response('complete'));
    if (prune) await pruneOldCaches();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Read the ramp state BEFORE this install creates the v2 cache.
      const names = await caches.keys();
      const hasLegacy = names.some(isLegacyCacheName);
      const rampRan = names.includes(RAMP_MARKER_CACHE);

      const cache = await caches.open(CACHE_NAME);
      const niceToHave = PRECACHE_ASSETS.filter((url) => !ESSENTIAL_ASSETS.includes(url));
      // Essentials are atomic (install fails without them); the rest fills
      // through the same chunked, failure-tolerant path the top-up uses —
      // first install is the largest fetch burst of all, so it must not be
      // the one place that fans out unchunked.
      await Promise.all(ESSENTIAL_ASSETS.map((url) => cache.add(precacheRequest(url))));
      await fillChunked(cache, niceToHave);

      // One-time legacy ramp: devices pinned to a pre-v2 worker have no page
      // code that can rotate them, so the worker self-promotes ONCE. The
      // marker is created at activate (not here) so a killed install can
      // never suppress a ramp that hasn't actually happened.
      if (hasLegacy && !rampRan) self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      if ((await caches.keys()).some(isLegacyCacheName)) {
        await caches.open(RAMP_MARKER_CACHE);
      }
      if (await precacheComplete()) await pruneOldCaches();
    })()
  );
  // Detached ON PURPOSE: fetch events queue until activate's waitUntil
  // settles, so a user-triggered rotation must never wait on a full precache
  // fill over a mobile connection. The fill self-heals via the startup task,
  // the per-pageload PRECACHE_TOPUP message, and the 'online' re-post.
  topUpPrecache().catch(() => {});
});

// RESERVED MESSAGE TYPES — never post 'SW_UPDATED' or 'SYNC_DATA' from this
// worker: pages cached March–June 2026 hold live listeners that reload or
// dispatch on those. Unknown inbound shapes (REGISTER_SYNC and anything
// legacy pages send) are silently ignored.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'PRECACHE_TOPUP') {
    event.waitUntil(topUpPrecache());
    return;
  }
  const type = data && data.type;
  if (type === 'SKIP_WAITING') {
    // Worker-authoritative gate: a stacked newer deploy that has not finished
    // warming is refused and re-warmed instead of rotating unwarmed.
    event.waitUntil(
      precacheComplete().then((ok) => (ok ? self.skipWaiting() : topUpPrecache({ prune: false })))
    );
  } else if (type === 'SKIP_WAITING_WHEN_HIDDEN') {
    // Rotate only when NOBODY is looking: the page cannot see sibling tabs,
    // but the worker can. A client without visibilityState counts as
    // not-hidden, so unsupported engines degrade to tap-only.
    event.waitUntil(
      Promise.all([
        precacheComplete(),
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
      ]).then(([ok, clients]) => {
        if (ok && clients.every((c) => c.visibilityState === 'hidden')) self.skipWaiting();
      })
    );
  } else if (type === 'PRECACHE_WARM') {
    // A WAITING worker fills its own generation without pruning (the active
    // generation keeps serving untouched) and reports readiness to the page.
    event.waitUntil(
      topUpPrecache({ prune: false }).then(async () => {
        if ((await precacheComplete()) && event.source) {
          event.source.postMessage({ type: 'PRECACHE_READY', version: CACHE_VERSION });
        }
      })
    );
  }
});

// One-shot per SW startup: ensure the ramp marker exists when legacy caches
// do, and converge an incomplete fill — works even when every page being
// served is a 2025-era page that posts nothing.
let startupTaskRan = false;

self.addEventListener('fetch', (event) => {
  if (!startupTaskRan) {
    startupTaskRan = true;
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        if (
          names.some(isLegacyCacheName) &&
          !names.includes(RAMP_MARKER_CACHE) &&
          self.registration && self.registration.active
        ) {
          await caches.open(RAMP_MARKER_CACHE);
        }
        // Bounded cleanup for the never-complete path: the prune law only
        // runs on a complete generation, so a device where some URL
        // persistently fails would otherwise stack one near-full generation
        // per deploy until quota eviction (which takes IndexedDB with it).
        // Delete all but the newest sentinel-less STALE v2 generation — the
        // newest is usually the assets-stripped skew shield and stays.
        const ownTs = buildTsOf(CACHE_NAME);
        const staleIncomplete = [];
        for (const name of names) {
          if (!name.startsWith(V2_PREFIX) || name === CACHE_NAME || name === RAMP_MARKER_CACHE) continue;
          const ts = buildTsOf(name);
          if (ts === null || ownTs === null || ts >= ownTs) continue;
          const stale = await caches.open(name);
          if (!(await stale.match(SENTINEL_PATH))) staleIncomplete.push(name);
        }
        staleIncomplete.sort();
        await Promise.all(staleIncomplete.slice(0, -1).map((name) => caches.delete(name)));

        const cache = await caches.open(CACHE_NAME);
        if (!(await cache.match(SENTINEL_PATH))) await topUpPrecache();
      })().catch(() => {})
    );
  }

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
