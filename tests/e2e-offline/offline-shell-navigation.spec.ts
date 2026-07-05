import { test, expect } from '@playwright/test';

/**
 * Offline shell navigation: sub-pages must open offline the way users
 * actually reach them. Chromium project only; the WebKit twin lives in
 * webkit-offline-shell.spec.ts (WebKit needs a genuinely stopped server,
 * because Playwright's route interception and offline simulation both kill
 * a top-level navigation before the service worker sees it there).
 *
 * The field failure this guards (found on a real phone in airplane mode):
 * every internal link on the site is written without a trailing slash
 * (`/dashboard`, `/downloads`, `/modules/...`), while every precache key is
 * the built directory route WITH a trailing slash (`/dashboard/`). Online the
 * CDN normalizes with a redirect, so nobody notices. Offline the navigation
 * fetch fails, `caches.match('/dashboard')` misses `'/dashboard/'`, and the
 * service worker synthesized a raw 503 "Offline" text response. The home page
 * kept working because `href="/"` matches the precached `/` exactly, which is
 * precisely the "home loads, every sub-page dies" symptom.
 *
 * The older offline-durability spec never caught this because it navigates to
 * a hardcoded URL that already carries the trailing slash. These specs follow
 * the link-shaped (slashless) URLs instead, plus the resilience behaviors
 * that keep the shell honest on aggressive mobile browsers:
 *   1. slashless navigation must serve the cached slashed route;
 *   2. a route that is NOT cached must fall back to the styled offline page,
 *      never a raw 503 string;
 *   3. a partially filled precache (a worker can be killed mid-fill) must
 *      self-heal on the next online page load.
 */

const BOOTSTRAP_ROUTE = '/';

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

// The precache is complete when the page routes AND the /_astro bundles are
// present. With the resilient install (essentials first, top-up after
// activation) this settles a beat later than install, so poll the cache
// contents rather than assuming install implies completeness.
async function waitForPrecacheComplete(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    async () => {
      const names = await caches.keys();
      if (!names.length) return false;
      const paths = new Set<string>();
      for (const name of names) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) paths.add(new URL(req.url).pathname);
      }
      const routesReady = ['/dashboard/', '/downloads/', '/about/', '/map/'].every((r) => paths.has(r));
      const astroReady = [...paths].filter((p) => p.startsWith('/_astro/')).length > 20;
      return routesReady && astroReady;
    },
    null,
    { timeout: 30_000 },
  );
}

// Cut the network for real, then prove it with a guaranteed cache-miss probe
// (unique query string): if the probe comes back 200 the harness is secretly
// online and every offline assertion below would be meaningless. See the
// offline-durability spec for why the route abort is required in Chromium:
// setOffline alone does not block loopback there.
async function goOffline(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
) {
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort());
  const probeStatus = await page.evaluate(async () => {
    const res = await fetch(`/?_offlineprobe=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    return res ? res.status : 0;
  });
  expect(probeStatus, 'harness is not actually offline, a network request succeeded').not.toBe(200);
}

async function bootstrap(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
) {
  await page.goto(BOOTSTRAP_ROUTE, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecacheComplete(page);
}

test('a slashless link-shaped navigation serves the cached page offline', async ({ page, context }) => {
  await bootstrap(page, context);
  await goOffline(page, context);

  // Navigate exactly the way the site's own links do: no trailing slash.
  const response = await page.goto('/dashboard', { waitUntil: 'load' });
  expect(response, 'navigation returned no response').not.toBeNull();
  expect(response!.status(), 'offline slashless navigation must hit the cached route').toBe(200);

  // The page must be the real dashboard, styled, not a fallback.
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily.toLowerCase()).toContain('outfit');
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText, 'raw service worker fallback leaked to the user').not.toBe('Offline');
});

test('clicking a real in-page link offline reaches the cached sub-page', async ({ page, context }) => {
  await bootstrap(page, context);
  await goOffline(page, context);

  // The footer "Toolkit" link carries the slashless href="/modules".
  await page.locator('footer a[href="/modules"]').first().click();
  await page.waitForFunction(() => window.location.pathname === '/modules', null, { timeout: 15_000 });
  await page.waitForLoadState('load');
  // The modules index h1, not the home hero: proof the navigation landed.
  await expect(page.locator('h1').first()).toContainText('Resilience Hub Toolkit', { timeout: 10_000 });
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText, 'raw service worker fallback leaked to the user').not.toBe('Offline');
});

test('an uncached route offline falls back to the styled offline page, not a raw 503', async ({ page, context }) => {
  await bootstrap(page, context);
  await goOffline(page, context);

  // /changelog/ is deliberately excluded from the precache, so offline it can
  // only be served by the fallback. It must be the styled offline page.
  await page.goto('/changelog/', { waitUntil: 'load' });
  await expect(page.getByText(/not saved on this device/i).first()).toBeVisible({ timeout: 10_000 });
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily.toLowerCase()).toContain('outfit');
  // It offers a way back to the saved shell.
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
});

test('a partially filled precache self-heals on the next online page load', async ({ page, context }) => {
  await bootstrap(page, context);

  // Simulate what an aggressive mobile browser does: the worker was killed
  // mid-precache and some routes never made it into the cache.
  await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      await cache.delete('/dashboard/');
      await cache.delete('/downloads/');
    }
  });

  // A normal online page load must notice the gap and refill it.
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecacheComplete(page);

  await goOffline(page, context);
  const response = await page.goto('/dashboard', { waitUntil: 'load' });
  expect(response!.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText, 'raw service worker fallback leaked to the user').not.toBe('Offline');
});
