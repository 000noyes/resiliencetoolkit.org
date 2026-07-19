import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

/**
 * CDN-poison defense — the 2026-07-16 update flash, reproduced end to end.
 *
 * Production is Cloudflare Pages. With no 404.html deployed it runs in
 * single-page-app fallback mode: ANY unknown path — including an /_astro/*
 * asset URL that the serving deployment does not have, which happens in the
 * window around every deploy — is answered with the homepage as 200
 * text/html, with `cache-control: public, max-age=14400` (verified live
 * 2026-07-16). The browser MIME-refuses HTML where CSS/JS belongs, and any
 * cache layer that stores it (the worker's runtime cache, a precache fill,
 * the HTTP cache) turns a one-request skew into a persistent broken page.
 *
 * `astro preview` answers unknown paths with a plain 404, so it cannot
 * reproduce any of this. This spec runs its own static server over dist/
 * with Cloudflare Pages' semantics (same shape as the private server in
 * webkit-offline-shell.spec.ts), pinned to SPA-fallback mode — the worker's
 * guards must hold even while production still lacks (or loses) a 404 page.
 *
 * Deploy skew is simulated by renaming a real /_astro/ file on disk, the
 * same way sw-update-rotation.spec.ts simulates deploys by rewriting
 * dist/sw.js (context.route cannot intercept worker-initiated fetches).
 */

// Every test here primes a full precache fill (and one waits out a 10s
// banner-withheld window) before it can exercise the skew, which does not
// fit the project's default 30s budget — same reasoning as the offline-webkit
// project's timeout override.
test.describe.configure({ timeout: 120_000 });

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '../../dist');
const SW_DIST_PATH = join(DIST_DIR, 'sw.js');
const PORT = 4324;
const ORIGIN = `http://rt.localhost:${PORT}`;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json',
};

let server: http.Server;

function serveFile(res: http.ServerResponse, filePath: string, status: number, cacheControl: string) {
  const body = readFileSync(filePath);
  res.writeHead(status, {
    'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', ORIGIN).pathname);
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const asFile = join(DIST_DIR, safePath);
    const asIndex = join(DIST_DIR, safePath, 'index.html');

    if (pathname.endsWith('/') && existsSync(asIndex)) {
      // Route HTML mirrors production: always revalidated.
      return serveFile(res, asIndex, 200, 'public, max-age=0, must-revalidate');
    }
    if (!pathname.endsWith('/') && extname(safePath) !== '' && existsSync(asFile)) {
      return serveFile(res, asFile, 200, 'public, max-age=14400, must-revalidate');
    }
    if (!pathname.endsWith('/') && existsSync(asIndex)) {
      // Slashless directory route: Cloudflare normalizes with a redirect.
      res.writeHead(308, { location: pathname + '/' });
      return res.end();
    }
    // Unknown path: Cloudflare Pages SPA fallback — the homepage as 200
    // text/html, browser-cacheable. This is the poison source under test;
    // the mode is pinned ON regardless of dist/404.html so the worker's
    // own guards are what carry the test.
    return serveFile(res, join(DIST_DIR, 'index.html'), 200, 'public, max-age=14400, must-revalidate');
  });
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

let originalSw: string;
const renamedAway: string[] = [];

test.beforeEach(() => {
  originalSw = readFileSync(SW_DIST_PATH, 'utf-8');
});

test.afterEach(() => {
  writeFileSync(SW_DIST_PATH, originalSw);
  for (const p of renamedAway.splice(0)) {
    if (existsSync(p + '.skew')) renameSync(p + '.skew', p);
  }
});

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

async function waitForPrecachePopulated(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          for (const name of names) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            if (keys.filter((r) => new URL(r.url).pathname.startsWith('/_astro/')).length > 20) {
              return true;
            }
          }
          return false;
        }),
      { timeout: 30_000 }
    )
    .toBe(true);
}

/**
 * Kill the renderer's memory + HTTP cache for this page (chromium CDP; this
 * project is chromium-only). Without this, a stylesheet loaded seconds
 * earlier is reused straight from the memory cache and the service worker
 * never even sees the request — the assertions below need every request to
 * reach the worker. The worker's own caches are unaffected.
 */
async function disableBrowserCache(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  return cdp;
}

/** The pathname of the homepage's stylesheet — the asset the incident broke on. */
async function homepageCssPath(page: Page): Promise<string> {
  const href = await page.evaluate(
    () => document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')?.href ?? null
  );
  expect(href, 'homepage must reference a stylesheet').not.toBeNull();
  return new URL(href!).pathname;
}

/**
 * Whether the site's stylesheet actually applied, read from computed style
 * (base.css sets the Outfit font on body). This is the only honest probe: a
 * fallback-HTML answer for a CSS request is refused by the browser (nosniff
 * + ORB), Playwright sees no response event for it at all, and Chromium
 * still attaches an (unreadable) sheet object to the refused link — so
 * neither waitForResponse nor link.sheet can tell styled from flashed.
 */
function stylesheetApplied(page: Page): Promise<boolean> {
  return page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Outfit'));
}

/** Every cache name holding a text/html response under the given path. */
function poisonedCachesFor(page: Page, path: string): Promise<string[]> {
  return page.evaluate(async (p) => {
    const hits: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      const hit = await cache.match(p, { ignoreVary: true });
      if (hit && (hit.headers.get('content-type') ?? '').includes('text/html')) hits.push(name);
    }
    return hits;
  }, path);
}

test('deploy-skew fallback HTML for an asset is never persisted, and the page heals once the asset is back', async ({ page }) => {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecachePopulated(page);

  const cssPath = await homepageCssPath(page);
  const cdp = await disableBrowserCache(page);

  // Deploy skew: the CSS vanishes from the origin (rotated away by another
  // deploy) while pages still reference it. Evict it from every worker cache
  // AND the browser HTTP cache (the worker's own fetch consults the latter),
  // so the next request truly reaches the origin — the incident's URL was a
  // new build's asset no cache layer had ever seen.
  const cssFile = join(DIST_DIR, cssPath);
  renameSync(cssFile, cssFile + '.skew');
  renamedAway.push(cssFile);
  await cdp.send('Network.clearBrowserCache');
  await page.evaluate(async (p) => {
    for (const name of await caches.keys()) {
      await (await caches.open(name)).delete(p, { ignoreVary: true });
    }
  }, cssPath);

  // The reload's stylesheet request reaches the SPA-fallback origin. The
  // browser refuses the HTML that comes back — the unstyled flash — but no
  // cache may keep it.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1_000);
  expect(await stylesheetApplied(page), 'skew load should reproduce the unstyled flash').toBe(false);
  expect(await poisonedCachesFor(page, cssPath), 'fallback HTML persisted under the asset URL').toEqual([]);

  // The deploy settles (the asset is back). The very next load must be
  // styled again with no manual hard refresh (the incident needed one). The
  // browser-HTTP-cache flavor of the poison and its cache:'reload' retry are
  // pinned at the unit level; here the cache is CDP-disabled so the request
  // deterministically exercises the worker path.
  renameSync(cssFile + '.skew', cssFile);
  renamedAway.splice(0);
  await page.reload({ waitUntil: 'load' });
  expect(await stylesheetApplied(page), 'page must heal without a hard refresh').toBe(true);
  expect(await poisonedCachesFor(page, cssPath)).toEqual([]);
});

test('a warming generation that is fed fallback HTML never verifies complete: banner withheld', async ({ page }) => {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecachePopulated(page);

  // A second deploy whose precache list carries an asset URL the origin no
  // longer serves (mid-skew warm): the fill gets 200 text/html for it. A
  // generation holding HTML in an asset slot must never be announced.
  const next = originalSw
    .replace(/const CACHE_VERSION = '[^']*';/, "const CACHE_VERSION = 'v-build-99999999999999998';")
    .replace(/const PRECACHE_ASSETS = \[/, "const PRECACHE_ASSETS = ['/_astro/rotated-away.TEST01.css', ");
  writeFileSync(SW_DIST_PATH, next);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });

  const banner = page.getByRole('status').filter({ hasText: 'A newer version of this site is ready.' });
  await page.waitForTimeout(10_000);
  await expect(banner).toBeHidden();
  expect(await poisonedCachesFor(page, '/_astro/rotated-away.TEST01.css')).toEqual([]);
});

test('a device already poisoned by an earlier worker self-heals on the next request', async ({ page }) => {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecachePopulated(page);

  const cssPath = await homepageCssPath(page);
  await disableBrowserCache(page);

  // What a pre-guard worker generation left behind: fallback HTML stored
  // under the stylesheet URL in the serving cache.
  await page.evaluate(async (p) => {
    for (const name of await caches.keys()) {
      if (name === 'resilience-hub-v2-ramp') continue;
      const cache = await caches.open(name);
      if (await cache.match(p, { ignoreVary: true })) {
        await cache.put(
          p,
          new Response('<!doctype html><html><body>fallback</body></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        );
      }
    }
  }, cssPath);

  await page.reload({ waitUntil: 'load' });
  expect(await stylesheetApplied(page), 'poisoned entry must not be served').toBe(true);
  await page.waitForTimeout(1_000);
  expect(await poisonedCachesFor(page, cssPath)).toEqual([]);
});
