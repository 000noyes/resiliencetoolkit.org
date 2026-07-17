import { test, expect } from '@playwright/test';

/**
 * Offline search — the homepage's "Everything works offline." now includes
 * Pagefind search: the SW precaches the pagefind core subset (pagefind.js,
 * entry, meta, wasm, index/ + fragment/ chunks; see
 * scripts/pagefind-precache.mjs), so a first visit followed by a dead network
 * still returns real results.
 *
 * Harness rules match offline-durability.spec.ts (Chromium only): run against
 * the built artifact via astro preview; wait for the worker's own precache
 * completeness sentinel; cut the network with context.route abort (setOffline
 * alone does not block loopback in Chromium) and prove the cut with a
 * guaranteed-cache-miss probe. Never unify this with the WebKit spec — WebKit
 * cannot simulate offline in front of a service worker via route interception.
 */

// Pagefind lazy-loads its index only when a query runs, so the whole search
// path below happens strictly AFTER the network is cut: import + init + index
// chunks must all come from the SW cache.
const SEARCH_QUERY = 'mutual aid';

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

test('homepage search returns real results while offline', async ({ page, context }) => {
  // 1) Bootstrap the SW online; a controlled reload guarantees SW-served
  //    navigations from here on.
  await page.goto('/', { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);

  // 2) Wait for the precache completeness sentinel (the fill runs detached
  //    from activation; SW-active does not mean the pagefind chunks landed).
  //    Polled via evaluate — an async waitForFunction predicate is not awaited.
  const sentinelDeadline = Date.now() + 15_000;
  for (;;) {
    const complete = await page.evaluate(async () => {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        if (await cache.match('/__rt-precache-complete__')) return true;
      }
      return false;
    });
    if (complete) break;
    if (Date.now() > sentinelDeadline) {
      throw new Error('precache did not write its completeness sentinel within 15s');
    }
    await page.waitForTimeout(250);
  }

  // 3) Cut the network. Route-abort is REQUIRED in Chromium (setOffline does
  //    not block loopback); keep setOffline so navigator.onLine behaves.
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort());

  // Harness self-check: a unique query string is never a precache key, so this
  // must NOT return 200. If it does, the harness is secretly online.
  const probeStatus = await page.evaluate(async () => {
    const res = await fetch(`/?_offlineprobe=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    return res ? res.status : 0;
  });
  expect(probeStatus, 'harness is not actually offline — a network request succeeded').not.toBe(200);

  // 4) Search. The row ships hidden and is revealed by the init script.
  const input = page.locator('#pagefind-search');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(SEARCH_QUERY);

  // 5) Real results must render: pagefind.js + wasm + index + fragment chunks
  //    all served from the SW cache. A result is an anchor into the hits list.
  const hits = page.locator('[data-search-hits] a');
  await expect(hits.first()).toBeVisible({ timeout: 15_000 });
  expect(await hits.count()).toBeGreaterThan(0);

  // The status element must not be stuck on an error/unavailable message.
  const status = page.locator('[data-search-status]');
  await expect(status).not.toContainText('unavailable');
  await expect(status).not.toContainText('requires a production build');
});
