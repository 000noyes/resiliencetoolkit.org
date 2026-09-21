/**
 * Page ETags: one weak validator per HTML page, from the hash map that
 * scripts/generate-sw-precache.mjs writes at postbuild, and a 304 when the
 * request already holds the current one.
 *
 * Why this exists: the service worker serves precached pages from the
 * device's copy and never asks the origin, so a returning reader was never
 * counted. The worker now sends one conditional GET per page it served from
 * the cache. With an ETag on the page that check costs about 1 KB when the
 * page is unchanged, and the same 304 makes the precache refill after a
 * deploy cheap for every page that did not change.
 *
 * The tag is weak (W/"…") from the start. Cloudflare weakens strong tags
 * when it re-encodes a response, and a tag that changes shape in transit
 * never matches. Comparison strips the weak prefix, as If-None-Match's weak
 * comparison does.
 *
 * Without a map, or for a path the map does not know, the response is
 * returned untouched. Nothing here reads a body or writes anything.
 */

export type PageHashes = Readonly<Record<string, string>>;

export function pageEtag(hash: string): string {
  return `W/"${hash}"`;
}

function opaqueTag(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed;
}

/** Weak comparison of an If-None-Match header value against one ETag. */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) return false;
  const value = ifNoneMatch.trim();
  if (value.length === 0) return false;
  if (value === '*') return true;
  const wanted = opaqueTag(etag);
  return value.split(',').some((candidate) => opaqueTag(candidate) === wanted);
}

// Headers that describe the body a 304 does not carry.
const BODY_HEADERS = ['content-length', 'content-encoding', 'transfer-encoding'];

/**
 * The response to send for a page request: the upstream response with an
 * ETag, a 304 when the request's If-None-Match matches, or the upstream
 * response untouched when there is nothing to do.
 */
export function withPageEtag(
  request: Request,
  response: Response,
  hashes: PageHashes | undefined
): Response {
  if (!hashes) return response;
  if (request.method !== 'GET' && request.method !== 'HEAD') return response;
  if (response.status !== 200) return response;

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('text/html')) return response;

  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return response;
  }
  const hash = hashes[pathname];
  if (typeof hash !== 'string' || hash.length === 0) return response;

  const etag = pageEtag(hash);
  const headers = new Headers(response.headers);
  headers.set('etag', etag);

  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    for (const name of BODY_HEADERS) headers.delete(name);
    const notModified = new Response(null, { status: 304, headers });
    // The upstream body is never read. Release it.
    if (response.body) response.body.cancel().catch(() => {});
    return notModified;
  }

  return new Response(response.body, { status: 200, statusText: response.statusText, headers });
}
