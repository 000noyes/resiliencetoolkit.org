import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Offline search (SR6 as a requirement; ES1/ES2 invariants): the header
 * box on a chapter page returns real results with the network dead,
 * because the service worker precaches the Pagefind core set inside the
 * same atomic per-build generation as the shell (scripts/pagefind-precache.mjs).
 * Three states are proven: after install, with a NEW worker waiting, and
 * after that worker activates.
 *
 * Harness rules match offline-durability.spec.ts (Chromium only): run
 * against the built artifact via astro preview; wait for the worker's own
 * precache completeness sentinel; cut the network with context.route abort
 * (setOffline alone does not block loopback in Chromium) and prove the cut
 * with a guaranteed-cache-miss probe. A second deploy is simulated by
 * rewriting dist/sw.js on disk, as sw-update-rotation.spec.ts does.
 */

const CHAPTER = '/modules/emergency-preparedness/1-2/';
const QUERY = 'mutual aid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_DIST_PATH = join(__dirname, '../../dist/sw.js');
const BUILD_B_VERSION = 'v-build-99999999999999998';

let originalSw: string;
test.beforeEach(() => {
  originalSw = readFileSync(SW_DIST_PATH, 'utf-8');
});
test.afterEach(() => {
  writeFileSync(SW_DIST_PATH, originalSw);
});
test.setTimeout(180_000);

function deployBuildB() {
  writeFileSync(
    SW_DIST_PATH,
    originalSw.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${BUILD_B_VERSION}';`)
  );
}

// expect.poll, not page.waitForFunction: an async predicate passed to
// waitForFunction resolves on its pending Promise (truthy) under this repo's
// Playwright pin, so the gate can pass before the awaited condition holds.
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

async function waitForSentinel(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          for (const name of names) {
            const cache = await caches.open(name);
            if (await cache.match('/__rt-precache-complete__')) return true;
          }
          return false;
        }),
      { timeout: 30_000 }
    )
    .toBe(true);
}

async function bootstrap(page: Page) {
  await page.goto('/', { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForSentinel(page);
}

async function cutNetwork(page: Page, context: import('@playwright/test').BrowserContext) {
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort());
  const probeStatus = await page.evaluate(async () => {
    const res = await fetch(`/?_offlineprobe=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    return res ? res.status : 0;
  });
  expect(probeStatus, 'harness is not actually offline').not.toBe(200);
}

async function restoreNetwork(context: import('@playwright/test').BrowserContext) {
  await context.unroute('**/*');
  await context.setOffline(false);
}

// The whole search path runs strictly AFTER the cut: the module, Pagefind,
// its wasm and index chunks all come from the worker's cache.
async function expectSearchWorks(page: Page) {
  const input = page.locator('#header-search-input');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.click();
  await input.pressSequentially(QUERY, { delay: 30 });
  const rows = page.locator('#header-search [role="option"]');
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(page.locator('#header-search [data-search-status]')).not.toContainText('unavailable');
}

async function triggerUpdateCheck(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });
}

test('search on a chapter page returns real results while offline after install', async ({ page, context }) => {
  await bootstrap(page);
  await page.goto(CHAPTER, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await cutNetwork(page, context);
  await expectSearchWorks(page);
  await restoreNetwork(context);
});

test('with a new worker waiting, offline search still serves from the complete generation', async ({
  page,
  context,
}) => {
  await bootstrap(page);
  await page.goto(CHAPTER, { waitUntil: 'load' });
  await waitForServiceWorker(page);

  deployBuildB();
  await triggerUpdateCheck(page);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return !!reg?.waiting;
        }),
      { timeout: 45_000 }
    )
    .toBe(true);

  await cutNetwork(page, context);
  await expectSearchWorks(page);
  await restoreNetwork(context);
});

test('after the new worker activates, search serves from the new atomic generation', async ({ page, context }) => {
  await bootstrap(page);
  await page.goto(CHAPTER, { waitUntil: 'load' });
  await waitForServiceWorker(page);

  deployBuildB();
  await triggerUpdateCheck(page);
  const banner = page.getByRole('status').filter({ hasText: 'A newer version of this site is ready.' });
  await expect(banner).toBeVisible({ timeout: 60_000 });
  await banner.getByRole('button', { name: 'Refresh' }).click();
  await expect
    .poll(() => page.evaluate(() => caches.keys()).catch(() => [] as string[]), { timeout: 30_000 })
    .toContain(`resilience-hub-v2-${BUILD_B_VERSION}`);
  await page.waitForLoadState('load');
  await waitForServiceWorker(page);

  // ES2: the shell and the search assets live in ONE generation
  const generation = await page.evaluate(async (name) => {
    const cache = await caches.open(name);
    const paths = (await cache.keys()).map((r) => new URL(r.url).pathname);
    return {
      pagefind: paths.some((p) => p === '/pagefind/pagefind.js'),
      index: paths.some((p) => p.startsWith('/pagefind/index/')),
      chapter: paths.some((p) => p.startsWith('/modules/emergency-preparedness/1-2')),
      sentinel: paths.includes('/__rt-precache-complete__'),
    };
  }, `resilience-hub-v2-${BUILD_B_VERSION}`);
  expect(generation).toEqual({ pagefind: true, index: true, chapter: true, sentinel: true });

  await cutNetwork(page, context);
  await expectSearchWorks(page);
  await restoreNetwork(context);
});
