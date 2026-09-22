#!/usr/bin/env node
/**
 * check-page-etags.mjs
 *
 * Checks a live site for page ETags. Every HTML page should carry a weak
 * ETag and answer 304 to a request that sends it back. The tag is set by
 * functions/_middleware.ts from the map the build writes. While Email
 * Address Obfuscation, Automatic HTTPS Rewrites or Rocket Loader is on for
 * the domain, Cloudflare rewrites each HTML page on the way out and drops
 * the ETag, and no build or test covers that hop. CONTRIBUTING.md names the
 * settings.
 *
 * Run it after a deploy and after any change to those settings:
 *   node scripts/check-page-etags.mjs https://resiliencetoolkit.org
 *   node scripts/check-page-etags.mjs https://resiliencetoolkit.org / /introduction/
 *
 * Exit 0 when every page passes, 1 when any page fails or cannot be read.
 */

const DEFAULT_PATHS = ['/', '/introduction/'];

const [origin, ...paths] = process.argv.slice(2);
if (!origin || !/^https?:\/\//.test(origin)) {
  console.error('Usage: node scripts/check-page-etags.mjs <origin> [<path> ...]');
  process.exit(1);
}

const base = origin.replace(/\/+$/, '');
const pages = paths.length > 0 ? paths : DEFAULT_PATHS;
let failed = 0;

function fail(path, reason) {
  failed += 1;
  console.log(`FAIL ${path}: ${reason}`);
}

for (const path of pages) {
  const url = base + path;
  let first;
  try {
    first = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  } catch (error) {
    fail(path, `could not be read (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }
  const contentType = (first.headers.get('content-type') ?? '').toLowerCase();
  if (first.status !== 200 || !contentType.startsWith('text/html')) {
    fail(path, `expected an HTML page with status 200, got ${first.status} ${contentType || '(no content type)'}`);
    continue;
  }
  const etag = first.headers.get('etag');
  if (!etag) {
    fail(
      path,
      'no ETag on the page. Cloudflare drops it while Email Address Obfuscation, ' +
        'Automatic HTTPS Rewrites or Rocket Loader is on for this domain. See CONTRIBUTING.md.'
    );
    continue;
  }
  if (!etag.startsWith('W/"')) {
    fail(path, `ETag is not weak: ${etag}`);
    continue;
  }
  const second = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: { 'if-none-match': etag },
  });
  if (second.status !== 304) {
    fail(path, `expected 304 to If-None-Match ${etag}, got ${second.status}`);
    continue;
  }
  console.log(`ok   ${path}: ${etag}, 304 on a matching If-None-Match`);
}

if (failed > 0) {
  console.log(`${failed} of ${pages.length} pages failed.`);
  process.exit(1);
}
console.log(`${pages.length} of ${pages.length} pages carry a weak ETag and answer 304.`);
