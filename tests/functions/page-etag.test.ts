/**
 * Page ETag unit suite.
 *
 * The root middleware sets an ETag on every HTML page from the postbuild
 * hash map and answers 304 to a matching If-None-Match. Covers the tag, the
 * 304 shape, the miss cases, and the two "behave as today" cases: a path the
 * map does not know, and no map at all.
 */
import { describe, it, expect, vi } from 'vitest';

import { withPageEtag, pageEtag, etagMatches, originRequest } from '../../functions/lib/page-etag';

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
      'content-encoding': 'br',
      'transfer-encoding': 'chunked',
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
    expect(etagMatches('*', etag)).toBe(false);
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
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('transfer-encoding')).toBeNull();
    expect(await res.text()).toBe('');
  });

  it('releases the upstream body it never reads on a 304', () => {
    const upstream = htmlResponse();
    const cancel = vi.spyOn(upstream.body!, 'cancel');
    withPageEtag(
      pageRequest('/modules/1-1/', { 'if-none-match': 'W/"fedcba9876543210"' }),
      upstream,
      HASHES
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('answers 304 to a HEAD with a matching validator', async () => {
    const res = withPageEtag(
      pageRequest('/', { 'if-none-match': '"0123456789abcdef"' }, 'HEAD'),
      htmlResponse(''),
      HASHES
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe('W/"0123456789abcdef"');
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

describe('the request sent on to the origin', () => {
  it('drops the validators for a page the map knows, so the origin answers 200 and the tag here decides', () => {
    const req = pageRequest('/modules/1-1/', {
      'if-none-match': 'W/"fedcba9876543210"',
      'if-modified-since': 'Mon, 21 Sep 2026 10:00:00 GMT',
      accept: 'text/html',
    });
    const out = originRequest(req, HASHES);
    expect(out).not.toBe(req);
    expect(out.headers.get('if-none-match')).toBeNull();
    expect(out.headers.get('if-modified-since')).toBeNull();
    expect(out.headers.get('accept')).toBe('text/html');
    expect(out.url).toBe(req.url);
    expect(out.method).toBe('GET');
  });

  it('passes a request through untouched for a path the map does not know, and without a map', () => {
    const unknown = pageRequest('/changelog/', { 'if-none-match': 'W/"x"' });
    expect(originRequest(unknown, HASHES)).toBe(unknown);
    const noMap = pageRequest('/', { 'if-none-match': 'W/"x"' });
    expect(originRequest(noMap, undefined)).toBe(noMap);
  });

  it('passes a request with no validators through untouched', () => {
    const req = pageRequest('/modules/1-1/');
    expect(originRequest(req, HASHES)).toBe(req);
  });
});

describe('an upstream 304 for a page the map knows', () => {
  it('gets the HTML content type, so it is counted like any page load, and the tag when the validator matches', async () => {
    const upstream = new Response(null, { status: 304, headers: { 'cache-control': 'public, max-age=0' } });
    const res = withPageEtag(
      pageRequest('/modules/1-1/', { 'if-none-match': 'W/"fedcba9876543210"' }),
      upstream,
      HASHES
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe('W/"fedcba9876543210"');
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('public, max-age=0');
    expect(await res.text()).toBe('');
  });

  it('never claims the current tag for a copy it did not check', () => {
    const upstream = new Response(null, { status: 304, headers: { etag: '"origin-tag"' } });
    const res = withPageEtag(
      pageRequest('/modules/1-1/', { 'if-none-match': 'W/"something-else"' }),
      upstream,
      HASHES
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBeNull();
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('is left alone for a path the map does not know', () => {
    const upstream = new Response(null, { status: 304 });
    expect(withPageEtag(pageRequest('/changelog/'), upstream, HASHES)).toBe(upstream);
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
