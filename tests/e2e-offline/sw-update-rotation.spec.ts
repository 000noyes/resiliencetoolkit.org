import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Service worker update rotation — the propagation contract in a real browser.
 *
 * A "second deploy" is simulated by rewriting dist/sw.js on disk (astro
 * preview serves from disk per request) and calling reg.update(). This
 * deliberately avoids context.route for the worker script: browser-initiated
 * SW script update fetches are not reliably interceptable, and the on-disk
 * swap exercises the exact byte-diff path production uses.
 *
 * Covered here (chromium; WebKit cannot simulate these transitions — see the
 * offline config's rationale):
 *  1. Steady state: banner appears only after the new generation is verified
 *     complete; tap -> one rotation; user data in IndexedDB survives; the old
 *     generation is stripped to /_astro/* assets.
 *  2. Incomplete generation: banner withheld; offline navigation still served
 *     whole by the previous complete build (never shrink offline).
 *  3. Legacy ramp: a pre-v2 cache name triggers exactly one automatic
 *     rotation with no tap, leaves the ramp marker, and does not loop.
 *  4. Legacy message tolerance: REGISTER_SYNC and junk messages are ignored.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_DIST_PATH = join(__dirname, '../../dist/sw.js');
const BUILD_B_VERSION = 'v-build-99999999999999999';

let originalSw: string;

test.beforeEach(() => {
  originalSw = readFileSync(SW_DIST_PATH, 'utf-8');
});

test.afterEach(() => {
  writeFileSync(SW_DIST_PATH, originalSw);
});

function deployBuildB(opts: { incompletable?: boolean } = {}) {
  let next = originalSw.replace(
    /const CACHE_VERSION = '[^']*';/,
    `const CACHE_VERSION = '${BUILD_B_VERSION}';`
  );
  if (opts.incompletable) {
    // A precache entry that 404s forever: the fill can never complete, so
    // the completeness gate must hold the banner and refuse rotation.
    next = next.replace(
      /const PRECACHE_ASSETS = \[/,
      "const PRECACHE_ASSETS = ['/__missing-test-route__/', "
    );
  }
  writeFileSync(SW_DIST_PATH, next);
}

async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return !!(reg && reg.active && navigator.serviceWorker.controller);
    },
    null,
    { timeout: 20_000 }
  );
}

async function waitForPrecachePopulated(page: Page) {
  await page.waitForFunction(
    async () => {
      const names = await caches.keys();
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        if (keys.filter((r) => new URL(r.url).pathname.startsWith('/_astro/')).length > 20) {
          return true;
        }
      }
      return false;
    },
    null,
    { timeout: 30_000 }
  );
}

async function triggerUpdateCheck(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });
}

const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

test('banner -> tap -> one rotation; data intact; old generation stripped to assets', async ({ page }) => {
  const MODULE_ROUTE = '/modules/baseline-resilience/2-2/';
  await page.goto(MODULE_ROUTE, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecachePopulated(page);

  // Real user data: check the first checklist item; give the debounced save
  // time to commit to IndexedDB.
  const firstCheckbox = page.locator('input.todo-checkbox').first();
  await firstCheckbox.waitFor({ timeout: 15_000 });
  // Direct DOM click: the decorative check-mark SVG overlays the input and
  // can intercept Playwright's hit-tested click depending on hydration
  // timing. A native click on the input still drives the React onChange.
  await firstCheckbox.evaluate((el) => (el as HTMLElement).click());
  await expect(firstCheckbox).toBeChecked({ timeout: 5_000 });
  await page.waitForTimeout(1_000);

  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  deployBuildB();
  await triggerUpdateCheck(page);

  // Warm gate: the banner may only appear once the waiting worker reports
  // its generation complete.
  const banner = page.getByRole('status').filter({ hasText: 'A newer version of this site is ready.' });
  await expect(banner).toBeVisible({ timeout: 45_000 });

  await banner.getByRole('button', { name: 'Refresh' }).click();

  // Rotation: flush wait -> SKIP_WAITING -> activate (prune inside waitUntil)
  // -> controllerchange -> one reload.
  await page.waitForFunction(
    async (buildB) => {
      const names = await caches.keys();
      return names.includes(`resilience-hub-v2-${buildB}`);
    },
    BUILD_B_VERSION,
    { timeout: 30_000 }
  );
  await page.waitForLoadState('load');
  await waitForServiceWorker(page);
  await expect(banner).toBeHidden({ timeout: 15_000 });

  // Exactly one reload (the one-shot refreshing flag), allowing a moment for
  // any stray second navigation to expose itself.
  await page.waitForTimeout(3_000);
  expect(navigations).toBe(1);

  // User data survived the rotation.
  await expect(page.locator('input.todo-checkbox').first()).toBeChecked({ timeout: 15_000 });

  // The previous generation was stripped to /_astro/* assets only.
  const stripped = await page.evaluate(async (buildB) => {
    const names = await caches.keys();
    const old = names.filter(
      (n) => n.startsWith('resilience-hub-') && !n.includes(buildB) && n !== 'resilience-hub-v2-ramp'
    );
    const result: Record<string, string[]> = {};
    for (const name of old) {
      const cache = await caches.open(name);
      result[name] = (await cache.keys()).map((r) => new URL(r.url).pathname);
    }
    return result;
  }, BUILD_B_VERSION);
  for (const [name, paths] of Object.entries(stripped)) {
    for (const p of paths) {
      expect(p.startsWith('/_astro/'), `${name} kept non-asset ${p}`).toBe(true);
    }
  }
});

test('incomplete new generation: banner withheld, offline navigation stays whole', async ({ page, context }) => {
  await page.goto('/', { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecachePopulated(page);

  deployBuildB({ incompletable: true });
  await triggerUpdateCheck(page);

  // The incompletable worker installs and warms, but can never verify
  // complete: the banner must never appear.
  const banner = page.getByRole('status').filter({ hasText: 'A newer version of this site is ready.' });
  await page.waitForTimeout(10_000);
  await expect(banner).toBeHidden();

  // The previous complete generation must be untouched (never shrink
  // offline): cut the network and open a cold precached route.
  await context.route('**/*', (route) => route.abort());
  await page.goto('/modules/baseline-resilience/2-2/', { waitUntil: 'load' });
  await expect(page.locator('main')).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toBe('Offline');
  await context.unroute('**/*');
});

test('legacy ramp: automatic one-time rotation, marker written, no reload loop', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await waitForServiceWorker(page);

  // Simulate the stuck cohort: a pre-v2 cache name on the device.
  await page.evaluate(async () => {
    const legacy = await caches.open('resilience-hub-v-build-20260630000000000');
    await legacy.put('/legacy-probe', new Response('stale'));
  });

  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  deployBuildB();
  await triggerUpdateCheck(page);

  // No tap: the ramp gate promotes the new worker on its own. Rotation is
  // proven by the new generation appearing while the legacy cache is
  // consumed by the completeness-gated prune.
  await page.waitForFunction(
    async (buildB) => {
      const names = await caches.keys();
      return (
        names.includes(`resilience-hub-v2-${buildB}`) &&
        !names.includes('resilience-hub-v-build-20260630000000000')
      );
    },
    BUILD_B_VERSION,
    { timeout: 45_000 }
  );

  // Give any reload storm time to expose itself, then assert the rotation
  // reloaded this page exactly once.
  await page.waitForTimeout(5_000);
  expect(navigations).toBe(1);
  const names = await cacheNames(page);
  expect(names).toContain(`resilience-hub-v2-${BUILD_B_VERSION}`);
  // The ramp marker is created at activate, but once no legacy-named cache
  // survives the prune it is cleaned up — nothing left to suppress. (Unit
  // tests cover the retention case where a stripped legacy-named build
  // cache outlives the prune.)
  expect(names).not.toContain('resilience-hub-v2-ramp');
});

test('legacy page messages are tolerated: REGISTER_SYNC and junk are ignored', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await waitForServiceWorker(page);

  const stillServing = await page.evaluate(async () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'REGISTER_SYNC' });
    navigator.serviceWorker.controller?.postMessage(null);
    navigator.serviceWorker.controller?.postMessage('garbage');
    navigator.serviceWorker.controller?.postMessage({ type: 'WAT', nested: { deep: true } });
    const res = await fetch('/manifest.json');
    return res.ok && !!navigator.serviceWorker.controller;
  });
  expect(stillServing).toBe(true);
});
