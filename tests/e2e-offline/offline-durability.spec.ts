import { test, expect } from '@playwright/test';

/**
 * Offline durability — the product's headline promise ("works with the power
 * and internet out") enforced as a real-browser test.
 *
 * The break this guards (see scripts/generate-sw-precache.mjs): the service
 * worker precaches page HTML but, before the fix, NOT the `/_astro/*` CSS/JS
 * bundles. Those entered the cache only lazily, when fetched online. So a
 * precached-but-never-visited route, opened offline, rendered unstyled and
 * non-interactive (its bundles 503'd from the SW offline fallback).
 *
 * The crux of a HONEST test (a naive version false-passes):
 *  - Run against the built artifact via `astro preview` (real generated sw.js),
 *    not `astro dev`. Handled by playwright.offline.config.ts.
 *  - Bootstrap the SW on one page, then hard-navigate to a DIFFERENT, never-
 *    visited route while offline. The lazy runtime cache only holds assets for
 *    pages fetched online, so the target route must be cold — otherwise the bug
 *    hides. We bootstrap on `/` and target a deep module page whose React island
 *    chunk `/` never loads.
 */

const BOOTSTRAP_ROUTE = '/';
// Cold route: a module page with `<Todo client:load>` islands, never visited
// online in this session, so its island JS chunk is not in the runtime cache.
const COLD_ROUTE = '/modules/baseline-resilience/2-2/';

// Wait for the service worker to install, activate, and claim the page so the
// next navigation is SW-controlled and the precache has settled.
async function waitForServiceWorker(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return !!(reg && reg.active && navigator.serviceWorker.controller);
    },
    null,
    { timeout: 20_000 },
  );
}

test('a cold precached route renders styled + interactive when opened offline', async ({ page, context }) => {
  // 1) Bootstrap the SW online. After this resolves the worker controls the
  //    page and PRECACHE_ASSETS are cached.
  await page.goto(BOOTSTRAP_ROUTE, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  // A controlled reload guarantees the SW is the one serving navigations.
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);

  // Anti-flake guard: the SW becomes active only after install's waitUntil
  // (which includes the /_astro precache) settles, but assert the cache is
  // actually populated before cutting the network so a slow-CI timing miss can
  // never masquerade as the bug this test guards.
  await page.waitForFunction(
    async () => {
      const names = await caches.keys();
      if (!names.length) return false;
      const cache = await caches.open(names[0]);
      const keys = await cache.keys();
      return keys.filter((r) => new URL(r.url).pathname.startsWith('/_astro/')).length > 20;
    },
    null,
    { timeout: 15_000 },
  );

  // 2) Start watching for any `/_astro/*` asset that fails to load. Set this up
  //    BEFORE going offline so we capture the cold-route subresource fetches.
  const astroFailures: string[] = [];
  const isAstro = (url: string) => new URL(url).pathname.startsWith('/_astro/');
  page.on('response', (res) => {
    if (isAstro(res.url()) && res.status() >= 400) {
      astroFailures.push(`${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (isAstro(req.url())) astroFailures.push(`failed ${req.url()}`);
  });

  // 3) Cut the network and hard-navigate to the cold route.
  //    NB: context.setOffline(true) alone does NOT block loopback/localhost in
  //    Chromium, so the preview server stays reachable and the test false-passes
  //    (verified: a cold island chunk still loaded). Aborting every route at the
  //    context level DOES intercept the service worker's own fetch(), so the
  //    only responses that survive are ones the SW already has in cache — a
  //    faithful "internet out". Keep setOffline too so navigator.onLine / the
  //    app's offline event fire as they would in the field.
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort());

  // Harness self-check: prove the network is really cut. A unique query string
  // is never a precache key, so this is a guaranteed cache MISS in every state
  // (before or after the precache fix): online the server serves the HTML (200),
  // truly-offline the SW cache-misses and synthesizes a 503. If this ever
  // returns 200 the harness is secretly online and every assertion below is
  // worthless — fail loud instead.
  const probeStatus = await page.evaluate(async (route) => {
    const res = await fetch(`${route}?_offlineprobe=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    return res ? res.status : 0;
  }, COLD_ROUTE);
  expect(probeStatus, 'harness is not actually offline — a network request succeeded').not.toBe(200);

  await page.goto(COLD_ROUTE, { waitUntil: 'load' });

  // (b) The React island must hydrate. Server-rendered HTML is only a loading
  //     skeleton; the real `input.todo-checkbox` appears only after the island
  //     JS bundle loads and runs. If that bundle 503'd offline, this never
  //     appears — the precise failure the precache fix prevents.
  const checkbox = page.locator('input.todo-checkbox').first();
  await expect(checkbox).toBeVisible({ timeout: 10_000 });

  // ...and it must be interactive: clicking toggles its checked state.
  expect(await checkbox.isChecked()).toBe(false);
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  // (c) No `/_astro/*` asset 503'd / failed while offline.
  expect(astroFailures, `offline /_astro asset failures:\n${astroFailures.join('\n')}`).toEqual([]);

  // (a) The site stylesheet is actually applied (computed style, not just 200).
  //     base.css sets `body { font-family: var(--font-sans) }` → Outfit; the UA
  //     default would not contain Outfit.
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily.toLowerCase()).toContain('outfit');
});
