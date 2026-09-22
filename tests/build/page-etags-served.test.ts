// @vitest-environment node
/**
 * Every built page, run through the middleware's ETag step with the map the
 * build wrote, carries a weak ETag and answers 304 to it.
 *
 * page-hashes.test.ts proves the generator writes a map and page-etag.test.ts
 * proves the step tags a stub map. Neither checks that the map's keys are the
 * paths the built pages are requested at, so a key written as
 * `/modules/1-1/index.html` or without its trailing slash would pass both and
 * tag nothing. This test closes that gap. It skips on a checkout that has not
 * built (CI runs vitest before any build); run `pnpm build` first locally.
 *
 * No test here covers the hop after the Worker. While Email Address
 * Obfuscation, Automatic HTTPS Rewrites or Rocket Loader is on for the domain,
 * Cloudflare rewrites each HTML page on the way out and drops the tag; the
 * pages.dev hostname is left alone. Only scripts/check-page-etags.mjs against
 * the live site catches that.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { originRequest, withPageEtag, type PageHashes } from '../../functions/lib/page-etag';

const ROOT = resolve(__dirname, '../..');
const DIST = join(ROOT, 'dist');
const MAP = join(ROOT, 'functions/lib/page-hashes.generated.js');
const BUILT = existsSync(join(DIST, 'index.html')) && existsSync(MAP);
const ORIGIN = 'https://resiliencetoolkit.org';

function builtRoutes(dir: string): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) routes.push(...builtRoutes(full));
    else if (entry.name === 'index.html') {
      const rel = relative(DIST, full).replace(/\\/g, '/');
      routes.push(rel === 'index.html' ? '/' : '/' + rel.replace(/\/index\.html$/, '/'));
    }
  }
  return routes.sort();
}

function page(): Response {
  return new Response('<!doctype html><title>page</title>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

let hashes: PageHashes = {};
let routes: string[] = [];

beforeAll(async () => {
  if (!BUILT) return;
  const mod = await import(pathToFileURL(MAP).href);
  hashes = mod.PAGE_HASHES;
  routes = builtRoutes(DIST);
});

describe('the built page hash map, served', () => {
  it.skipIf(!BUILT)('has one key per built page, at the path the page is served from', () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(Object.keys(hashes).sort()).toEqual(routes);
  });

  it.skipIf(!BUILT)('tags every built page with a weak ETag on GET and HEAD', () => {
    for (const route of routes) {
      for (const method of ['GET', 'HEAD']) {
        const request = new Request(`${ORIGIN}${route}`, { method });
        const response = withPageEtag(request, page(), hashes);
        expect(response.status, `${method} ${route}`).toBe(200);
        expect(response.headers.get('etag'), `${method} ${route}`).toBe(`W/"${hashes[route]}"`);
      }
    }
  });

  it.skipIf(!BUILT)('answers 304 to its own tag on every built page, and sends the origin no validator', () => {
    for (const route of routes) {
      const etag = `W/"${hashes[route]}"`;
      const request = new Request(`${ORIGIN}${route}`, { headers: { 'if-none-match': etag } });
      expect(originRequest(request, hashes).headers.get('if-none-match'), route).toBeNull();
      const response = withPageEtag(request, page(), hashes);
      expect(response.status, route).toBe(304);
      expect(response.headers.get('etag'), route).toBe(etag);
    }
  });
});
