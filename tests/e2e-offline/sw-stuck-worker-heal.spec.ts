import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stuck-service-worker heal — the guarded-activation ramp in a real browser.
 *
 * Reproduces the July 2026 field wedge and proves the heal:
 *
 *   A device's ACTIVE worker is the real pre-guard production build
 *   (fixtures/sw-preguard.js, the worker as of 2026-07-15) whose cache holds
 *   fallback HTML under the very /_astro chunk URLs that carry the page's
 *   module scripts — including the registration module. Page code is dead, so
 *   every page-driven rotation path (warm, banner tap, idle, resume) is
 *   unreachable, and a plain reload keeps serving the wedge. Only the
 *   worker-side heal ramp can hand off.
 *
 * A "deploy" is simulated by rewriting dist/sw.js on disk (astro preview
 * serves from disk per request) — browser-initiated SW script update fetches
 * are not reliably interceptable, and the on-disk swap exercises the exact
 * byte-diff path production uses (same technique as sw-update-rotation).
 *
 * Also proven here: convergence never depends on refetching dead URLs (a
 * poisoned entry whose URL the server no longer has — the post-deploy reality
 * — 404s clean and is never re-cached), the healed device returns to the
 * normal completeness-gated lifecycle on the next deploy, and the rotation
 * reload shows the status notice while user data survives.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_DIST_PATH = join(__dirname, '../../dist/sw.js');
const PREGUARD_FIXTURE = join(__dirname, 'fixtures/sw-preguard.js');
const PREGUARD_VERSION = 'v-build-20260715000000000';
const PREGUARD_CACHE = `resilience-hub-v2-${PREGUARD_VERSION}`;
const HEAL_MARKER = 'resilience-hub-v2-heal';
const BUILD_B_VERSION = 'v-build-99999999999999999';
// A poisoned entry whose URL the server does not have (the old-hash chunk a
// later deploy garbage-collected). The heal must converge without it.
const GONE_ASSET = '/_astro/legacy-chunk.deadbeef.js';

let originalSw: string;

test.beforeEach(() => {
  originalSw = readFileSync(SW_DIST_PATH, 'utf-8');
});

test.afterEach(() => {
  writeFileSync(SW_DIST_PATH, originalSw);
});

/** Serve the historical pre-guard worker with the CURRENT precache list. */
function deployPreguardWorker() {
  const listBlock = originalSw.match(
    /\/\/ __PRECACHE_ASSETS_START__[\s\S]*?\/\/ __PRECACHE_ASSETS_END__/
  );
  if (!listBlock) throw new Error('precache sentinels missing from dist/sw.js');
  let preguard = readFileSync(PREGUARD_FIXTURE, 'utf-8');
  preguard = preguard.replace(
    /\/\/ __PRECACHE_ASSETS_START__[\s\S]*?\/\/ __PRECACHE_ASSETS_END__/,
    listBlock[0]
  );
  preguard = preguard.replace(
    /const CACHE_VERSION = '[^']*';/,
    `const CACHE_VERSION = '${PREGUARD_VERSION}';`
  );
  writeFileSync(SW_DIST_PATH, preguard);
}

function deployBuildB() {
  writeFileSync(
    SW_DIST_PATH,
    originalSw.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${BUILD_B_VERSION}';`)
  );
}

// expect.poll, not page.waitForFunction: an async predicate passed to
// waitForFunction resolves on its pending Promise (truthy) under this repo's
// Playwright pin, so the gate can pass before the awaited condition holds.
// expect.poll genuinely awaits page.evaluate's async body (#106).
async function waitForServiceWorker(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return false;
          const reg = await navigator.serviceWorker.ready.catch(() => null);
          return !!(reg && reg.active && navigator.serviceWorker.controller);
        }),
      { timeout: 20_000 }
    )
    .toBe(true);
}

/**
 * NOTE: async predicates inside page.waitForFunction are a trap here — the
 * poll can see the pending Promise as a truthy value and resolve without the
 * condition holding (observed in this repo's Playwright pin). Every gate in
 * this spec therefore uses expect.poll, which genuinely awaits the result.
 */
async function waitForSentinel(page: Page, cacheName: string) {
  await expect
    .poll(
      () =>
        page.evaluate(async (name) => {
          const cache = await caches.open(name);
          return !!(await cache.match('/__rt-precache-complete__'));
        }, cacheName),
      { timeout: 90_000 }
    )
    .toBe(true);
}

async function triggerUpdateCheck(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });
}

/** The page's own module chunk URLs — the ones whose poisoning kills page JS. */
async function pageChunkPaths(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('script[src^="/_astro/"]')].map(
      (s) => new URL((s as HTMLScriptElement).src).pathname
    )
  );
}

/**
 * Load a chunk THE WAY THE PAGE DOES (request destination "script"): the
 * runtime poison purge is destination-gated, so a bare fetch() probe would
 * not exercise it. Resolves true when the browser accepted the response as
 * JavaScript, false on a MIME refusal.
 */
async function scriptLoads(page: Page, path: string): Promise<boolean> {
  return page.evaluate(
    (src) =>
      new Promise<boolean>((resolve) => {
        const el = document.createElement('script');
        el.type = 'module';
        el.src = src;
        el.onload = () => resolve(true);
        el.onerror = () => resolve(false);
        document.head.appendChild(el);
        setTimeout(() => resolve(false), 10_000);
      }),
    path
  );
}

test.describe.configure({ timeout: 240_000 });

test('wedged pre-guard worker: reload does not fix it; the heal ramp hands off with no page help and converges', async ({
  page,
}) => {
  // ---- Build the stuck device: historical worker, complete generation. ----
  deployPreguardWorker();
  await page.goto('/', { waitUntil: 'load' });
  // Guard against a stale or foreign preview server: what the origin serves
  // MUST be the pre-guard worker this test just wrote to disk.
  const servedSw = await page.evaluate(async () => (await (await fetch('/sw.js')).text()));
  expect(servedSw, 'server must serve the pre-guard fixture just written to dist').toContain(
    `CACHE_VERSION = '${PREGUARD_VERSION}'`
  );
  expect(servedSw, 'pre-guard fixture must not contain the heal marker').not.toContain('v2-heal');
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForSentinel(page, PREGUARD_CACHE);

  // ---- Poison the generation the way the CDN skew window did: fallback ----
  // HTML under the page's own chunk URLs (killing page JS) plus under a
  // URL the server no longer has at all.
  const chunks = await pageChunkPaths(page);
  expect(chunks.length).toBeGreaterThan(0);
  await page.evaluate(
    async ({ cacheName, paths }) => {
      const cache = await caches.open(cacheName);
      for (const p of paths) {
        await cache.put(
          p,
          new Response('<html><body>fallback</body></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        );
      }
    },
    { cacheName: PREGUARD_CACHE, paths: [...chunks, GONE_ASSET] }
  );

  // ---- The wedge: chunks come back as HTML, and a plain reload passes ----
  // straight through the stuck worker (this is what the field devices see).
  await page.reload({ waitUntil: 'load' });
  const wedgedType = await page.evaluate(async (p) => {
    const res = await fetch(p);
    return res.headers.get('content-type');
  }, chunks[0]);
  expect(wedgedType).toContain('text/html');

  // ---- Deploy the guarded build. The stuck page's module scripts are ----
  // dead, so no page code will warm, tap, or rotate anything: activation
  // must come from the worker-side heal ramp alone.
  deployBuildB();
  const servedB = await page.evaluate(async () => (await (await fetch('/sw.js')).text()));
  expect(servedB, 'server must serve the guarded build B').toContain(
    `CACHE_VERSION = '${BUILD_B_VERSION}'`
  );
  await triggerUpdateCheck(page);
  await expect
    .poll(() => page.evaluate(() => caches.keys()).catch(() => [] as string[]), { timeout: 45_000 })
    .toContain(HEAL_MARKER);

  // ---- "Next visit": served by the guarded worker; the serve-time purge ----
  // evicts poison per real script request, so the page comes back alive.
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  for (const chunk of chunks) {
    expect(await scriptLoads(page, chunk), `${chunk} must load as JavaScript`).toBe(true);
  }

  // ---- Convergence never depends on the dead URL. A real script request ----
  // (the purge is destination-gated) evicts the poisoned entry, the origin
  // 404s, nothing is re-cached — the failure is clean, not sticky.
  expect(await scriptLoads(page, GONE_ASSET)).toBe(false);
  const goneCached = await page.evaluate(
    async (p) => (await caches.match(p, { ignoreVary: true })) !== undefined,
    GONE_ASSET
  );
  expect(goneCached).toBe(false);

  // ---- The guarded generation completes and the old one is pruned to ----
  // assets at most; the following navigation serves the new build whole.
  await waitForSentinel(page, `resilience-hub-v2-${BUILD_B_VERSION}`);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('main')).toBeVisible();
  const oldGenPaths = await page.evaluate(async (name) => {
    if (!(await caches.keys()).includes(name)) return [];
    const cache = await caches.open(name);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  }, PREGUARD_CACHE);
  for (const p of oldGenPaths) {
    expect(p.startsWith('/_astro/'), `old generation kept non-asset ${p}`).toBe(true);
  }
});

test('healed device: next deploy waits for the banner again, and the tap rotation shows the notice with data intact', async ({
  page,
}) => {
  const MODULE_ROUTE = '/modules/baseline-resilience/2-2/';
  await page.goto(MODULE_ROUTE, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForSentinel(page, await page.evaluate(async () => {
    const names = await caches.keys();
    return names.find((n) => /^resilience-hub-v2-v-build-\d+$/.test(n))!;
  }));

  // First guarded activation already happened on this fresh profile: the
  // heal marker exists, so the next deploy must NOT force-rotate.
  expect(await page.evaluate(() => caches.keys())).toContain(HEAL_MARKER);

  // Real user data + a notice observer that survives the reload.
  const firstCheckbox = page.locator('input.todo-checkbox').first();
  await firstCheckbox.waitFor({ timeout: 15_000 });
  await firstCheckbox.evaluate((el) => (el as HTMLElement).click());
  await expect(firstCheckbox).toBeChecked({ timeout: 5_000 });
  await page.waitForTimeout(1_000);
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.getElementById('rt-sw-rotation-notice')) {
        localStorage.setItem('rt-test-notice-seen', '1');
      }
    }).observe(document.body, { childList: true });
  });

  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  deployBuildB();
  await triggerUpdateCheck(page);

  // The healed steady state is the polite lifecycle: no forced reload; the
  // banner appears only after the warm verifies complete.
  const banner = page
    .getByRole('status')
    .filter({ hasText: 'A newer version of this site is ready.' });
  await expect(banner).toBeVisible({ timeout: 90_000 });
  expect(navigations).toBe(0);

  await banner.getByRole('button', { name: 'Refresh' }).click();
  await expect
    .poll(() => page.evaluate(() => caches.keys()).catch(() => [] as string[]), { timeout: 30_000 })
    .toContain(`resilience-hub-v2-${BUILD_B_VERSION}`);
  await page.waitForLoadState('load');
  await waitForServiceWorker(page);

  // Exactly one reload; the notice was shown during the flush window; the
  // checked box survived the rotation.
  await page.waitForTimeout(3_000);
  expect(navigations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('rt-test-notice-seen'))).toBe('1');
  await expect(page.locator('input.todo-checkbox').first()).toBeChecked({ timeout: 15_000 });
});
