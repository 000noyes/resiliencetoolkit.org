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
 * The origin behind the middleware (the Pages asset layer) is not asked to
 * validate: for a page the map knows, the request sent on has its validators
 * removed, so the origin answers 200 and the comparison happens here against
 * the map. Should the origin answer 304 for a known page anyway, that 304 is
 * given the tag and the HTML content type, so the count still sees a page
 * load. Without a map, or for a path the map does not know, both request and
 * response pass through untouched. Nothing here reads a body or writes
 * anything.
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

// Request headers the origin could answer 304 to. Removed for known pages so
// that the origin always sends the page and the tag here decides.
const VALIDATOR_HEADERS = ['if-none-match', 'if-modified-since'];

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

function knownPageHash(request: Request, hashes: PageHashes | undefined): string | null {
  if (!hashes) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }
  const hash = hashes[pathname];
  return typeof hash === 'string' && hash.length > 0 ? hash : null;
}

/**
 * The request to send on to the origin: the same request with its validators
 * removed when the page is one the map knows, otherwise the request itself.
 */
export function originRequest(request: Request, hashes: PageHashes | undefined): Request {
  if (knownPageHash(request, hashes) === null) return request;
  if (!VALIDATOR_HEADERS.some((name) => request.headers.has(name))) return request;
  const headers = new Headers(request.headers);
  for (const name of VALIDATOR_HEADERS) headers.delete(name);
  return new Request(request, { headers });
}

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
  const hash = knownPageHash(request, hashes);
  if (hash === null) return response;
  const etag = pageEtag(hash);

  if (response.status === 304) {
    const headers = new Headers(response.headers);
    headers.set('etag', etag);
    if (!headers.has('content-type')) headers.set('content-type', HTML_CONTENT_TYPE);
    return new Response(null, { status: 304, headers });
  }

  if (response.status !== 200) return response;

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('text/html')) return response;

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
