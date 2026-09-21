/**
 * Page ETag unit suite.
 *
 * The root middleware sets an ETag on every HTML page from the postbuild
 * hash map and answers 304 to a matching If-None-Match. Covers the tag, the
 * 304 shape, the miss cases, and the two "behave as today" cases: a path the
 * map does not know, and no map at all.
 */
import { describe, it, expect } from 'vitest';

import { withPageEtag, pageEtag, etagMatches } from '../../functions/lib/page-etag';

const ORIGIN = 'https://resiliencetoolkit.org';
const HASHES = { '/': '0123456789abcdef', '/modules/1-1/': 'fedcba9876543210' };

function pageRequest(path: string, headers: Record<string, string> = {}, method = 'GET'): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers });
}

function htmlResponse(body = '<!doctype html><title>page</title>', status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'content-length': String(body.length),
    },
  });
}

describe('the tag', () => {
  it('is a weak ETag built from the page hash', () => {
    expect(pageEtag('0123456789abcdef')).toBe('W/"0123456789abcdef"');
  });

  it('matches its own strong and weak forms, alone or in a list', () => {
    const etag = pageEtag('0123456789abcdef');
    expect(etagMatches('W/"0123456789abcdef"', etag)).toBe(true);
    expect(etagMatches('"0123456789abcdef"', etag)).toBe(true);
    expect(etagMatches('"other", W/"0123456789abcdef"', etag)).toBe(true);
    expect(etagMatches('*', etag)).toBe(true);
    expect(etagMatches('"other"', etag)).toBe(false);
    expect(etagMatches(null, etag)).toBe(false);
    expect(etagMatches('', etag)).toBe(false);
  });
});

describe('a page the map knows', () => {
  it('carries the ETag on a 200', async () => {
    const res = withPageEtag(pageRequest('/modules/1-1/'), htmlResponse(), HASHES);
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('W/"fedcba9876543210"');
    expect(await res.text()).toContain('<title>page</title>');
  });

  it('answers 304 with the ETag and no body when If-None-Match matches', async () => {
    const res = withPageEtag(
      pageRequest('/modules/1-1/', { 'if-none-match': 'W/"fedcba9876543210"' }),
      htmlResponse(),
      HASHES
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe('W/"fedcba9876543210"');
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-length')).toBeNull();
    expect(await res.text()).toBe('');
  });

  it('answers 200 with the ETag when If-None-Match does not match', async () => {
    const res = withPageEtag(
      pageRequest('/modules/1-1/', { 'if-none-match': 'W/"0000000000000000"' }),
      htmlResponse(),
      HASHES
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('W/"fedcba9876543210"');
    expect(await res.text()).toContain('<title>page</title>');
  });

  it('tags a HEAD the same way, so a HEAD and a GET agree', () => {
    const res = withPageEtag(pageRequest('/', {}, 'HEAD'), htmlResponse(''), HASHES);
    expect(res.headers.get('etag')).toBe('W/"0123456789abcdef"');
  });

  it('ignores the query string when looking the page up', () => {
    const res = withPageEtag(pageRequest('/?utm=x'), htmlResponse(), HASHES);
    expect(res.headers.get('etag')).toBe('W/"0123456789abcdef"');
  });
});

describe('behaves as today', () => {
  it('for a path the map does not know', () => {
    const upstream = htmlResponse();
    const res = withPageEtag(pageRequest('/changelog/'), upstream, HASHES);
    expect(res).toBe(upstream);
    expect(res.headers.get('etag')).toBeNull();
  });

  it('when there is no map at all', () => {
    const upstream = htmlResponse();
    expect(withPageEtag(pageRequest('/'), upstream, undefined)).toBe(upstream);
    expect(withPageEtag(pageRequest('/'), upstream, {})).toBe(upstream);
  });

  it('for a non-HTML response and for a non-200', () => {
    const asset = new Response('body{}', { status: 200, headers: { 'content-type': 'text/css' } });
    expect(withPageEtag(pageRequest('/'), asset, HASHES)).toBe(asset);
    const missing = htmlResponse('gone', 404);
    expect(withPageEtag(pageRequest('/'), missing, HASHES)).toBe(missing);
  });

  it('for a request that is not a GET or HEAD', () => {
    const upstream = htmlResponse();
    expect(withPageEtag(pageRequest('/', {}, 'POST'), upstream, HASHES)).toBe(upstream);
  });
});
