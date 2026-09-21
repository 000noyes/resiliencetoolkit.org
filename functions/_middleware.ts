/**
 * Root middleware: sets an ETag on every HTML page and answers 304 to a
 * matching If-None-Match, then counts one arrival per page load.
 *
 * There is no client script anywhere in this. The page request itself is the
 * arrival, which is why the count lives here rather than in a route a page
 * would have to call. All behavior is in functions/lib/page-etag.ts and
 * functions/lib/arrival-counting.ts, which the unit suite covers directly.
 * The page hash map is written by scripts/generate-sw-precache.mjs at
 * postbuild; Cloudflare bundles this file after the build, so it is present.
 *
 * Delivery comes first, always. The response is produced before anything is
 * counted, the write is handed to waitUntil so it never delays the reader, and
 * every failure path here is swallowed. A site that cannot count is fine; a
 * site that cannot serve is not.
 *
 * Without the ARRIVALS_DB binding this records nothing and passes every
 * request straight through, which is what the workshop project does
 * permanently. The ETag needs no binding.
 *
 * Note for whoever tunes this later: with a middleware at the functions root,
 * Cloudflare Pages routes every request through the Worker, including static
 * assets that are then passed straight back. That is well inside the free
 * invocation allowance at this site's traffic. If it ever stops being, a
 * _routes.json in public/ can exclude the asset directories, taking care not
 * to exclude any path that is also a page.
 */
import { recordArrival, type D1Database } from './lib/arrival-counting';
import { originRequest, withPageEtag } from './lib/page-etag';
import { PAGE_HASHES } from './lib/page-hashes.generated';

interface MiddlewareContext {
  request: Request;
  env: { ARRIVALS_DB?: D1Database };
  next: (request?: Request) => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  // For a page the map knows, the origin is asked for the page itself, never
  // to validate: the comparison happens below, against the map.
  let forward = context.request;
  try {
    forward = originRequest(context.request, PAGE_HASHES);
  } catch {
    forward = context.request;
  }
  const upstream = forward === context.request ? await context.next() : await context.next(forward);

  let response = upstream;
  try {
    response = withPageEtag(context.request, upstream, PAGE_HASHES);
  } catch {
    response = upstream;
  }

  try {
    const write = recordArrival(context.env.ARRIVALS_DB, context.request, response);
    if (write) context.waitUntil(write);
  } catch {
    // Counting never affects delivery.
  }

  return response;
}
