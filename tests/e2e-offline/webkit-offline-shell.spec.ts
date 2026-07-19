import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';

/**
 * WebKit twin of offline-shell-navigation.spec.ts. WebKit is the engine under
 * iOS Safari and the home screen app, where the field failure happened, so
 * the shell behaviors must hold here too, not only in Chromium.
 *
 * Why a private server instead of the shared webServer + route abort:
 * in WebKit, Playwright's context-level route interception catches a
 * top-level navigation BEFORE the service worker sees it, and setOffline
 * kills the provisional load the same way, so with either mechanism an
 * offline navigation never reaches the worker at all (page.goto errors,
 * link clicks silently stay put). A genuinely unreachable server is the
 * only simulation WebKit routes through the worker, and it is also the
 * closest model of the field: the connection is simply gone. So each test
 * boots its own preview of the already-built dist/ on a dedicated port,
 * bootstraps the worker there, then stops the server and navigates.
 */

const PORT = 4323;
const ORIGIN = `http://rt.localhost:${PORT}`;

let server: ChildProcess | undefined;

function waitForServer(up: boolean, timeoutMs = 60_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(`http://localhost:${PORT}/`, (res) => {
        res.resume();
        if (up) return resolve();
        retry();
      });
      req.on('error', () => (up ? retry() : resolve()));
      req.setTimeout(1_000, () => {
        req.destroy();
        up ? retry() : resolve();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`server did not go ${up ? 'up' : 'down'} on :${PORT}`));
      }
      setTimeout(poll, 250);
    };
    poll();
  });
}

async function startServer() {
  // A leftover server from a crashed run would make the "offline" phase
  // secretly online; refuse to start on an occupied port.
  await waitForServer(false, 5_000).catch(() => {
    throw new Error(`port ${PORT} is already in use; kill the leaked preview server first`);
  });
  // detached puts the pnpm wrapper and the astro child in their own process
  // group, so stopServer can kill the whole tree; killing only the wrapper
  // leaves the actual server running and the "offline" phase secretly online.
  server = spawn('pnpm', ['exec', 'astro', 'preview', '--port', String(PORT), '--host'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
  });
  await waitForServer(true);
}

async function stopServer() {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      // Process group already gone.
    }
  }
  server = undefined;
  await waitForServer(false);
}

test.afterEach(async () => {
  await stopServer().catch(() => {});
});

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
      // The worker trusts a generation for cache-first navigation only once
      // its completeness sentinel is written; cutting the server before that
      // demotes every offline navigation to the fallback page. Wait for the
      // sentinel so the offline phase starts from a verified generation.
      const sentinelReady = paths.has('/__rt-precache-complete__');
      return routesReady && astroReady && sentinelReady;
    },
    null,
    { timeout: 30_000 },
  );
}

async function bootstrap(page: import('@playwright/test').Page) {
  await startServer();
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecacheComplete(page);
  // WebKit's CacheStorage view from the page can lag while the worker's
  // chunked fill is still landing: a single true read is not proof the
  // generation is durably visible. Settle, then require the completeness
  // check to hold again before the server dies, so the offline phase never
  // starts against a half-visible cache.
  await page.waitForTimeout(3000);
  await waitForPrecacheComplete(page);
}

// The server is dead; prove the page really cannot reach it before trusting
// any offline assertion. A unique query string is never a cache key, so a
// non-503 answer would mean the harness is secretly online.
async function assertOffline(page: import('@playwright/test').Page) {
  const probeStatus = await page.evaluate(async () => {
    const res = await fetch(`/?_offlineprobe=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    return res ? res.status : 0;
  });
  expect(probeStatus, 'harness is not actually offline, a network request succeeded').not.toBe(200);
}

test('a slashless link-shaped navigation serves the cached page offline', async ({ page }) => {
  await bootstrap(page);
  await stopServer();
  await assertOffline(page);

  const response = await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'load' });
  expect(response, 'navigation returned no response').not.toBeNull();
  expect(response!.status(), 'offline slashless navigation must hit the cached route').toBe(200);

  // The dashboard's answer-first layout has no h1 (the page title is an
  // eyebrow); the stable marker for the real page is the safety card.
  await expect(page.getByTestId('rt-safety-card')).toBeVisible({ timeout: 10_000 });
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily.toLowerCase()).toContain('outfit');
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText, 'raw service worker fallback leaked to the user').not.toBe('Offline');
});

test('an uncached route offline falls back to the styled offline page, not a raw 503', async ({ page }) => {
  await bootstrap(page);
  await stopServer();
  await assertOffline(page);

  await page.goto(`${ORIGIN}/changelog/`, { waitUntil: 'load' });
  await expect(page.getByText(/not saved on this device/i).first()).toBeVisible({ timeout: 10_000 });
  const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(fontFamily.toLowerCase()).toContain('outfit');
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
});

test('a partially filled precache self-heals on the next online page load', async ({ page }) => {
  await bootstrap(page);

  await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      await cache.delete('/dashboard/');
      await cache.delete('/downloads/');
    }
  });

  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecacheComplete(page);
  // The self-heal re-fetches the deleted routes, but WebKit's CacheStorage view
  // from the page lags behind the worker's chunked fill — the same lag bootstrap
  // settles for. Without this, cutting the server here races the heal and the
  // offline navigation intermittently gets the fallback page. Settle, re-verify
  // completeness, then require the healed /dashboard/ to be durably matchable
  // before the server dies.
  await page.waitForTimeout(3000);
  await waitForPrecacheComplete(page);
  await page.waitForFunction(async () => !!(await caches.match('/dashboard/')), null, {
    timeout: 15_000,
  });

  await stopServer();
  await assertOffline(page);
  const response = await page.goto(`${ORIGIN}/dashboard`, { waitUntil: 'load' });
  expect(response!.status()).toBe(200);
  await expect(page.getByTestId('rt-safety-card')).toBeVisible({ timeout: 10_000 });
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText, 'raw service worker fallback leaked to the user').not.toBe('Offline');
});
