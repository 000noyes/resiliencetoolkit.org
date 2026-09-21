import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

import { SAVED_COPY_HEADER, SAVED_COPY_VALUE } from '../../functions/lib/arrival-counting';
import { etagMatches, pageEtag } from '../../functions/lib/page-etag';

/**
 * The saved-copy check, end to end in Chromium.
 *
 * A precached page is served from the device's copy without asking the
 * origin. After that, the worker sends one conditional GET to the same page:
 * If-None-Match set to the copy's ETag, plus the constant marker header, so
 * the origin can count the visit and answer 304 (about 1 KB) when the page
 * is unchanged. The body is never read and nothing is written to any cache.
 *
 * `astro preview` sets no ETag on pages and logs nothing, so this spec runs
 * its own static server over dist/ (same shape as sw-cdn-poison.spec.ts)
 * that does what the production middleware does for pages: a weak ETag from
 * the file's content hash, a 304 on a matching If-None-Match, and a log line
 * per request. Three shapes:
 *   1. an unchanged page: the navigation is served from the cache, exactly
 *      one request reaches the server for that path, it carries the marker
 *      and the validator, it is answered 304, and nothing else follows;
 *   2. a changed page: the cache still serves the old copy, the check is
 *      answered 200, the worker starts its update at once (a sw.js request
 *      follows), and the changed page is never stored;
 *   3. the server is gone: the navigation still serves and no request is
 *      logged. Nothing is queued for later;
 *   4. the server holds the check open without answering: the navigation
 *      finishes while the check is still pending, so no navigation waits on
 *      the origin. A stopped server refuses at once, which a worker that
 *      awaited the check would survive; only a held response proves it.
 */

// Every test here fills the whole precache from scratch before it can
// exercise the check, and the offline suite is load-sensitive (a full fill
// over the private server runs past a minute on a busy machine), so the
// budget matches the offline-webkit project's rather than the default 30s.
test.describe.configure({ timeout: 180_000 });

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '../../dist');
const PORT = 4325;
const ORIGIN = `http://rt.localhost:${PORT}`;
const ROUTE = '/dashboard/';
const MARKER_HEADER = SAVED_COPY_HEADER;
const MARKER_VALUE = SAVED_COPY_VALUE;

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

interface LogLine {
  at: number;
  method: string;
  path: string;
  status: number;
  marker: string | null;
  ifNoneMatch: string | null;
  headerNames: string[];
}

let server: http.Server;
const log: LogLine[] = [];
// Paths the server currently serves in a "changed" form: a different body
// and therefore a different ETag, without touching dist/ on disk.
const changed = new Set<string>();
// While true, a marked request is logged and its response held open until
// releaseHeld() runs. Only marked requests are held; everything else answers.
let holdChecks = false;
const held: Array<{ res: http.ServerResponse; etag: string }> = [];

function releaseHeld() {
  for (const { res, etag } of held.splice(0)) {
    res.writeHead(304, { etag, 'cache-control': 'public, max-age=0, must-revalidate' });
    res.end();
  }
}

// The hash recipe of scripts/generate-sw-precache.mjs, over the body as
// served here; the tag and the comparison are the middleware's own.
function weakEtag(body: Buffer): string {
  return pageEtag(createHash('sha256').update(body).digest('hex').slice(0, 16));
}

function record(req: http.IncomingMessage, status: number) {
  const marker = req.headers[MARKER_HEADER];
  const inm = req.headers['if-none-match'];
  log.push({
    at: Date.now(),
    method: req.method ?? '',
    path: new URL(req.url ?? '/', ORIGIN).pathname,
    status,
    marker: typeof marker === 'string' ? marker : null,
    ifNoneMatch: typeof inm === 'string' ? inm : null,
    headerNames: Object.keys(req.headers),
  });
}

function servePage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, file: string) {
  let body = readFileSync(file);
  if (changed.has(pathname)) body = Buffer.concat([body, Buffer.from('\n<!-- changed -->\n')]);
  const etag = weakEtag(body);
  const headers = {
    'content-type': CONTENT_TYPES['.html'],
    'cache-control': 'public, max-age=0, must-revalidate',
    etag,
    'x-content-type-options': 'nosniff',
  };
  if (holdChecks && req.headers[MARKER_HEADER] !== undefined) {
    record(req, 0);
    held.push({ res, etag });
    return;
  }
  if (etagMatches(req.headers['if-none-match'] ?? null, etag)) {
    record(req, 304);
    res.writeHead(304, headers);
    return res.end();
  }
  record(req, 200);
  res.writeHead(200, headers);
  res.end(body);
}

function serveAsset(req: http.IncomingMessage, res: http.ServerResponse, file: string) {
  const body = readFileSync(file);
  record(req, 200);
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'public, max-age=14400, must-revalidate',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function portFree(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
      res.resume();
      resolve(false);
    });
    req.on('error', () => resolve(true));
    req.setTimeout(1_000, () => {
      req.destroy();
      resolve(true);
    });
  });
}

async function startServer() {
  if (!(await portFree())) {
    throw new Error(`port ${PORT} is already in use; kill the leaked server first`);
  }
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', ORIGIN).pathname);
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const asFile = join(DIST_DIR, safePath);
    const asIndex = join(DIST_DIR, safePath, 'index.html');

    if (pathname.endsWith('/') && existsSync(asIndex)) {
      return servePage(req, res, pathname, asIndex);
    }
    if (!pathname.endsWith('/') && extname(safePath) !== '' && existsSync(asFile)) {
      return serveAsset(req, res, asFile);
    }
    if (!pathname.endsWith('/') && existsSync(asIndex)) {
      record(req, 308);
      res.writeHead(308, { location: pathname + '/' });
      return res.end();
    }
    record(req, 404);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  // Node closes an idle keep-alive socket after 5s by default. A chunked
  // precache fill on a busy machine can leave a socket idle that long, and a
  // fetch on a socket the server just closed fails, leaving a hole in the
  // fill. Keep sockets open for the whole test instead.
  server.keepAliveTimeout = 120_000;
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
}

async function stopServer() {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await expect.poll(portFree, { timeout: 10_000 }).toBe(true);
}

test.beforeEach(async () => {
  log.length = 0;
  changed.clear();
  holdChecks = false;
  await startServer();
});

test.afterEach(async () => {
  releaseHeld();
  await stopServer().catch(() => {});
});

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

const PRECACHE_ASSETS: string[] = [
  ...readFileSync(join(DIST_DIR, 'sw.js'), 'utf-8')
    .split('// __PRECACHE_ASSETS_START__')[1]
    .split('// __PRECACHE_ASSETS_END__')[0]
    .matchAll(/'([^']+)'/g),
].map((m) => m[1]);

/** Precache paths not yet present in any cache. */
function missingPrecachePaths(page: Page): Promise<string[]> {
  return page.evaluate(async (assets) => {
    const present = new Set<string>();
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) present.add(new URL(req.url).pathname);
    }
    return assets.filter((p) => !present.has(p));
  }, PRECACHE_ASSETS);
}

// The worker writes its completeness sentinel only once every precache path
// is present; cache-first navigation is trusted from that point. A fetch
// that failed mid-fill leaves a hole the worker fills on its next trigger,
// so the page nudges it the way a page load does (PRECACHE_TOPUP), rarely:
// each nudge starts a whole top-up pass, and passes started every second
// pile up and starve each other. A timeout names the paths still missing.
async function waitForPrecacheComplete(page: Page) {
  const deadline = Date.now() + 90_000;
  let nextNudge = Date.now() + 20_000;
  for (;;) {
    const nudge = Date.now() >= nextNudge;
    if (nudge) nextNudge = Date.now() + 20_000;
    const complete = await page.evaluate(async (nudge) => {
      for (const name of await caches.keys()) {
        if (await (await caches.open(name)).match('/__rt-precache-complete__')) return true;
      }
      if (nudge) navigator.serviceWorker.controller?.postMessage('PRECACHE_TOPUP');
      return false;
    }, nudge);
    if (complete) return;
    if (Date.now() > deadline) {
      const missing = await missingPrecachePaths(page);
      throw new Error(`precache did not complete within 90s; missing: ${missing.join(', ') || '(none, sentinel absent)'}`);
    }
    await page.waitForTimeout(1_000);
  }
}

async function bootstrap(page: Page) {
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await waitForServiceWorker(page);
  await page.reload({ waitUntil: 'load' });
  await waitForServiceWorker(page);
  await waitForPrecacheComplete(page);
  log.length = 0;
}

/** The stored copy of a route: its ETag and whether its body carries the changed marker. */
function storedCopy(page: Page, route: string) {
  return page.evaluate(async (r) => {
    for (const name of await caches.keys()) {
      const hit = await (await caches.open(name)).match(r, { ignoreVary: true });
      if (hit) return { etag: hit.headers.get('etag'), changed: (await hit.text()).includes('<!-- changed -->') };
    }
    return null;
  }, route);
}

const forRoute = () => log.filter((line) => line.path === ROUTE);
const checks = () => forRoute().filter((line) => line.marker !== null);

test('an unchanged page: served from the cache, one marked conditional request, answered 304', async ({ page }) => {
  await bootstrap(page);
  const before = await storedCopy(page, ROUTE);
  expect(before?.etag, 'the fill must have stored the page with its ETag').toMatch(/^W\/"[0-9a-f]{16}"$/);

  const response = await page.goto(`${ORIGIN}${ROUTE}`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('rt-safety-card')).toBeVisible({ timeout: 10_000 });

  await expect.poll(() => checks().length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  // Nothing else follows: no retry, no second request, no navigation fetch.
  await page.waitForTimeout(1_500);

  expect(forRoute(), 'the only request for the page is the saved-copy check').toHaveLength(1);
  const check = checks()[0];
  expect(check.method).toBe('GET');
  expect(check.marker).toBe(MARKER_VALUE);
  expect(check.ifNoneMatch).toBe(before!.etag);
  expect(check.status).toBe(304);
  expect(check.headerNames).not.toContain('cookie');
  expect(check.headerNames).not.toContain('authorization');

  // A 304 starts no worker update.
  expect(log.filter((line) => line.path === '/sw.js' && line.at >= check.at)).toHaveLength(0);
  expect(await storedCopy(page, ROUTE)).toEqual(before);
});

test('a changed page: the old copy still serves, the check is answered 200, the update starts, nothing is stored', async ({ page }) => {
  await bootstrap(page);
  const before = await storedCopy(page, ROUTE);
  changed.add(ROUTE);

  await page.goto(`${ORIGIN}${ROUTE}`, { waitUntil: 'load' });
  await expect(page.getByTestId('rt-safety-card')).toBeVisible({ timeout: 10_000 });
  expect(await page.content()).not.toContain('<!-- changed -->');

  await expect.poll(() => checks().length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  const check = checks()[0];
  expect(check.status).toBe(200);
  expect(check.ifNoneMatch).toBe(before!.etag);

  // registration.update() fetches sw.js.
  await expect
    .poll(() => log.filter((line) => line.path === '/sw.js' && line.at >= check.at).length, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(1);

  await page.waitForTimeout(1_500);
  expect(checks(), 'one check, no retry').toHaveLength(1);
  const after = await storedCopy(page, ROUTE);
  expect(after, 'the changed page must never be written into the saved copy').toEqual(before);
  expect(after?.changed).toBe(false);
});

test('the server is gone: the navigation still serves and no request is logged', async ({ page }) => {
  await bootstrap(page);
  await stopServer();

  const response = await page.goto(`${ORIGIN}${ROUTE}`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('rt-safety-card')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  expect(log).toHaveLength(0);

  // Back online, the next page opened is checked. Nothing was queued from
  // the offline read, so the first check is for this page, not the last one.
  await startServer();
  await page.goto(`${ORIGIN}/downloads/`, { waitUntil: 'load' });
  await expect.poll(() => log.filter((line) => line.marker !== null).length, { timeout: 10_000 }).toBe(1);
  expect(log.filter((line) => line.marker !== null)[0].path).toBe('/downloads/');
  await page.waitForTimeout(1_000);
  expect(log.filter((line) => line.marker !== null && line.path === ROUTE)).toHaveLength(0);
});

test('the server holds the check open: the navigation finishes without waiting on it', async ({ page }) => {
  await bootstrap(page);
  holdChecks = true;

  const response = await page.goto(`${ORIGIN}${ROUTE}`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('rt-safety-card')).toBeVisible({ timeout: 10_000 });

  // The check reached the server and is still unanswered while the page is
  // already on screen.
  await expect.poll(() => held.length, { timeout: 10_000 }).toBe(1);
  expect(checks()).toHaveLength(1);
  expect(checks()[0].status).toBe(0);
  expect(forRoute(), 'the page itself was never fetched from the origin').toHaveLength(1);

  // A second page opens the same way while the first check is still held.
  await page.goto(`${ORIGIN}/downloads/`, { waitUntil: 'load' });
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => held.length, { timeout: 10_000 }).toBe(2);

  releaseHeld();
  await page.waitForTimeout(1_000);
  expect(await storedCopy(page, ROUTE)).not.toBeNull();
});
