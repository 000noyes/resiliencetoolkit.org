// Service Worker — Resilience Hub Toolkit
// Cache-first for precached pages and static assets, network-first for any
// route outside the precache. A cache miss offline lands on /offline/, never
// a raw 503. CACHE_VERSION is rewritten by scripts/generate-sw-precache.mjs
// at build time.
//
// Update policy: a new worker announces itself to the page once its cache
// generation is verified complete; activation is user-initiated (SKIP_WAITING
// from the refresh notice) or idle (SKIP_WAITING_WHEN_HIDDEN when every window
// is hidden). Both are completeness-gated HERE, worker-side, so no page code
// path can activate an incomplete generation. Two exceptions, both one-time
// install-time skipWaiting ramps for devices whose page code cannot rotate
// them: the legacy ramp (pinned pre-May-2026 workers; gated on legacy cache
// names plus a persistent ramp marker) and the guarded-activation heal ramp
// (devices wedged on a pre-guard 2026-07 worker whose poisoned caches broke
// the page bundles; gated on a persistent heal marker). Each fires at most
// once per device.
//
// Freshness for cache-first pages comes from the worker update cycle: the
// browser revalidates sw.js on every load (updateViaCache: 'none'), a new
// build warms a complete fresh generation in the background, and rotation is
// completeness-gated as above.
const CACHE_VERSION = 'v-build-PENDING';
const V2_PREFIX = 'resilience-hub-v2-';
const CACHE_NAME = `resilience-hub-v2-${CACHE_VERSION}`;
// Empty cache whose existence means "a v2 worker already force-activated here".
// Excluded from every prune; deleted only when no legacy-named cache survives.
const RAMP_MARKER_CACHE = 'resilience-hub-v2-ramp';
// Empty cache whose existence means "a worker carrying the July-2026 cache
// guards has ACTIVATED here". Absent at install → this build self-promotes
// once (skipWaiting): a device wedged on a pre-guard worker has no working
// page code to rotate it (the 2026-07 CDN poison broke exactly the hashed
// chunks that carry the registration module), so the handoff must live
// worker-side. Created at activate BEFORE clients.claim (a killed install can
// never suppress an unhappened heal, and claim starts reloads so the flag
// must already be durable). Write failure is tolerated — the startup task
// retries, and the worst case is one extra flushed forced rotation. Excluded
// from every prune. Same shape as the legacy ramp marker above.
const HEAL_MARKER_CACHE = 'resilience-hub-v2-heal';
// Synthetic entry written into a generation when it verifies complete. No real
// route can collide with it and it is never served; it marks a generation as
// whole (and becomes the trust marker for cache-first navigation later).
const SENTINEL_PATH = '/__rt-precache-complete__';
// How many precache fetches run at once during top-up. Small on purpose: a
// wide parallel fan-out is what gets a worker killed on low-memory phones.
const TOPUP_CHUNK_SIZE = 5;
const LEGACY_BUILD_RE = /^resilience-hub-v-build-\d+$/;

// __PRECACHE_ASSETS_START__
const PRECACHE_ASSETS = [/* auto-generated, do not edit manually */];
// __PRECACHE_ASSETS_END__

// The minimal shell plus the offline fallback page. Essentials must succeed
// for install to succeed (Promise.all) — install fails, and any previous
// worker keeps serving, unless every one of these caches. The list stays tiny
// on purpose: a small, fast install is what survives mobile browsers that
// terminate a worker mid-install. The full page list arrives right after
// activation via topUpPrecache(), which also retries on every page load and
// via the PRECACHE_WARM/PRECACHE_TOPUP messages until the cache is whole.
//
// These two routes are DELIBERATELY exempt from top-up's "route HTML only
// after all assets" gate: they must exist before anything else so a first
// install has a floor at all, and both degrade acceptably without hashed
// assets. `/offline/` is fully standalone by construction (inline style and
// script, no /_astro/ dependency); `/` renders readable-but-unstyled in the
// seconds-wide first-install window, which beats having nothing offline.
const ESSENTIAL_ASSETS = [
  '/',
  '/offline/',
  '/manifest.json',
  '/RHT_orange.svg',
];

const OFFLINE_PAGE = '/offline/';

// Directory routes from the precache list, used to route navigations.
const PRECACHE_ROUTES = new Set(PRECACHE_ASSETS.filter((p) => p.endsWith('/')));

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

// CDN-poison defense. This origin (Cloudflare Pages) answers ANY unknown
// path — including an /_astro/* URL the serving deployment does not have,
// which happens in the window around every deploy — with the homepage as
// 200 text/html (SPA fallback), and that response is browser-cacheable.
// Stored under an asset URL it becomes a persistent MIME refusal: every
// page referencing the asset renders unstyled with dead islands (the
// 2026-07-16 update flash). HTML is only ever legitimate for a document,
// so these guards keep it out of every asset slot: the fill leaves a hole
// (the completeness gate then refuses to rotate onto the generation), the
// runtime path retries once past the HTTP cache and never caches HTML for
// an asset destination, and a poisoned entry found at serve time is purged.
function isHtmlResponse(response) {
  const contentType =
    response && response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('content-type')
      : null;
  return typeof contentType === 'string' && contentType.toLowerCase().includes('text/html');
}

// Destinations for which text/html can only be poison. 'document' is exempt
// (HTML is its job), as is '' (bare fetch() calls may legitimately load HTML).
const HTML_POISONABLE_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

function isPoisonedAssetResponse(response, destination) {
  return HTML_POISONABLE_DESTINATIONS.has(destination) && isHtmlResponse(response);
}

// Purge a poisoned entry wherever it lives: runtime writes land in the
// writing worker's own generation, and the prune-retained previous build
// cache keeps its /_astro/* entries, so every cache must be swept.
async function deleteFromAllCaches(request) {
  for (const name of await caches.keys()) {
    await (await caches.open(name)).delete(request, { ignoreVary: true });
  }
}

// Fetch-and-store one precache entry, refusing HTML in a non-route slot.
// On poison the entry is retried once with cache:'reload' (a poisoned HTTP
// cache heals; see the SPA-fallback note above); if the origin still
// answers HTML the entry is dropped and the error propagates, leaving a
// hole the completeness law converts into a refused rotation — the user
// stays on the previous whole generation instead of flashing.
async function fillOne(cache, url) {
  await cache.add(precacheRequest(url));
  if (url.endsWith('/')) return;
  let stored = await cache.match(url);
  if (!stored || !isHtmlResponse(stored)) return;
  await cache.delete(url);
  await cache.add(new Request(url, { cache: 'reload' }));
  stored = await cache.match(url);
  if (stored && isHtmlResponse(stored)) {
    await cache.delete(url);
    throw new Error(`precache fetch for ${url} answered text/html`);
  }
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
    if (name === CACHE_NAME || name === RAMP_MARKER_CACHE || name === HEAL_MARKER_CACHE) return false;
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
        fillOne(cache, url).catch((e) => {
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
// vintage of page is being served, and an interrupted update never shrinks
// what already opens offline (old generations survive until this one is
// complete). The sentinel doubles as the steady-state fast path: once the
// generation verified complete, re-triggers cost one keyed lookup instead of
// full cache enumerations.
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

      // Install caches ONLY the essential shell (atomic: install fails
      // without them). The full page list fills after activation through
      // topUpPrecache, the one warm mechanism, so install stays small and
      // fast, and the completeness gate still governs rotation and pruning.
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(ESSENTIAL_ASSETS.map((url) => fillOne(cache, url)));

      // One-time forced ramps, a single skipWaiting call for either arm:
      // (1) legacy ramp — devices pinned to a pre-v2 worker have no page code
      //     that can rotate them; markers are created at activate (not here)
      //     so a killed install can never suppress a ramp that hasn't
      //     actually happened;
      // (2) guarded-activation heal ramp — no guarded worker has ever
      //     activated on this device, so the active worker may be a wedged
      //     pre-guard generation whose rotation paths are all dead (see
      //     HEAL_MARKER_CACHE). After the first guarded activation the heal
      //     marker exists and every later deploy uses the normal
      //     completeness-gated lifecycle.
      const healRan = names.includes(HEAL_MARKER_CACHE);
      if ((hasLegacy && !rampRan) || !healRan) self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Heal marker BEFORE claim: claim dispatches controllerchange and pages
      // begin their flush-and-reload, so the "a guarded worker activated
      // here" flag must already be durable by then. Tolerated on failure —
      // activation must never fail or loop over a marker write.
      await caches.open(HEAL_MARKER_CACHE).catch(() => {});
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

// Match a navigation against the cache the way links are actually written.
// Built pages are directory routes with a trailing slash (`/dashboard/`),
// while in-page links are slashless (`/dashboard`); online the CDN
// normalizes that difference with a redirect, offline this match has to.
// Matching by pathname string also drops any query, which is correct for a
// fully static site.
//
// The lookup is GLOBAL across cache generations ON PURPOSE. While a new
// build's cache is still filling, the previous complete generation keeps
// serving: its HTML references its own hashed assets, which it still holds,
// so every page it serves is whole. Old generations are pruned only once the
// new one is complete. Scoping this match to the current cache would serve
// new HTML whose hashed assets may not be cached yet, breaking pages offline
// exactly during an interrupted update.
async function matchNavigation(request) {
  const pathname = new URL(request.url).pathname;
  const candidates = [pathname];
  if (pathname.endsWith('/index.html')) {
    candidates.push(pathname.slice(0, -'index.html'.length));
  }
  const lastSegment = pathname.split('/').pop();
  if (!pathname.endsWith('/') && lastSegment && !lastSegment.includes('.')) {
    candidates.push(pathname + '/');
  }
  for (const candidate of candidates) {
    const hit = await caches.match(candidate, { ignoreVary: true });
    if (hit && !hit.redirected) return hit;
  }
  return undefined;
}

// Cache-first for precached pages: on a dying connection, network-first
// makes every tap wait for the network to fail before the saved page
// appears, and this app's job is to work when the weather does not. The
// staleness cost is bounded: a deploy ships a new sw.js, which the browser
// revalidates on the next online load (updateViaCache: 'none') and swaps in
// only once its generation verifies complete. Routes outside the precache
// stay network-first so they are always current, with the runtime cache and
// then the offline page as fallbacks. Precached routes are never runtime
// cached here; their entries come from the revalidating precache fill, so
// the completeness accounting stays clean.
async function handleNavigation(event) {
  const url = new URL(event.request.url);
  // Normalize the explicit-file form so `/dashboard/index.html` gets the
  // same cache-first treatment as `/dashboard/` (matchNavigation already
  // normalizes it for the lookup; this keeps the ROUTING decision in step).
  let path = url.pathname;
  if (path.endsWith('/index.html')) {
    path = path.slice(0, -'index.html'.length);
  }
  const isPrecachedRoute =
    PRECACHE_ROUTES.has(path) ||
    (!path.endsWith('/') && PRECACHE_ROUTES.has(path + '/'));

  if (isPrecachedRoute) {
    const cached = await matchNavigation(event.request);
    if (cached) return cached;
  }

  try {
    const response = await fetch(event.request);
    if (response.ok && !response.redirected && !isPrecachedRoute) {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
    }
    return response;
  } catch {
    const cached = await matchNavigation(event.request);
    if (cached) return cached;
    const offlinePage = await caches.match(OFFLINE_PAGE, { ignoreVary: true });
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

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
        // Heal-marker insurance: an activate killed between claim and the
        // marker write would re-arm the one-time heal ramp on the next
        // install. A worker serving fetch events IS active, so the marker is
        // legitimately owed — write it here, tolerated on failure.
        if (
          !names.includes(HEAL_MARKER_CACHE) &&
          self.registration && self.registration.active
        ) {
          await caches.open(HEAL_MARKER_CACHE).catch(() => {});
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
          if (!name.startsWith(V2_PREFIX) || name === CACHE_NAME || name === RAMP_MARKER_CACHE || name === HEAL_MARKER_CACHE) continue;
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

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Cache-first for static assets in the destination whitelist.
  // `ignoreVary: true` is load-bearing for offline: precached `/_astro/*`
  // bundles are stored via cache.add (no Origin header), but a dynamic ES-module
  // import() is a CORS request that DOES send Origin. A server that returns
  // `Vary: Origin` on those assets (astro preview's sirv does; a CDN may) would
  // otherwise make caches.match(event.request) miss and 503 the module offline,
  // silently breaking every precached-but-unvisited route. The assets are
  // immutable + same-origin, so there is only ever one variant per URL. Safe.
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      // A worker (this one or an earlier generation) may have stored
      // fallback HTML under this asset URL. Purge it everywhere BEFORE the
      // refetch (a concurrent purge would race the clean re-cache) and
      // treat the lookup as a miss — this self-heals devices poisoned
      // before this worker deployed, instead of MIME-refusing on every
      // page that needs the asset until the caches are cleared by hand.
      const poisoned = !!cached && isPoisonedAssetResponse(cached, event.request.destination);
      if (cached && !poisoned && !cached.redirected) return cached;
      const offlineFallback = poisoned ? undefined : cached;
      const purge = poisoned
        ? deleteFromAllCaches(event.request).catch(() => {})
        : Promise.resolve();
      return purge.then(() =>
        fetch(event.request)
          .then((response) =>
            // The HTTP cache (poisoned for up to 4h by the CDN's cacheable
            // SPA fallback) or a mid-deploy origin answered an asset request
            // with HTML: retry once straight past the HTTP cache.
            isPoisonedAssetResponse(response, event.request.destination)
              ? fetch(event.request.url, { cache: 'reload' })
              : response
          )
          .then((response) => {
            if (
              response.ok &&
              !response.redirected &&
              CACHEABLE_DESTINATIONS.has(event.request.destination) &&
              !isPoisonedAssetResponse(response, event.request.destination)
            ) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            }
            return response;
          })
          .catch(() => offlineFallback || new Response('Offline', { status: 503 }))
      );
    })
  );
});
