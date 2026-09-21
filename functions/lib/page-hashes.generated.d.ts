/**
 * Types for the page hash map that scripts/generate-sw-precache.mjs writes
 * next to this file at postbuild (page-hashes.generated.js, gitignored).
 *
 * Route to content hash, one entry per built HTML page, for example
 * `{ "/": "3f9a…", "/modules/1-1/": "b07c…" }`. The root middleware uses it
 * for page ETags. This declaration is tracked so a checkout with no build
 * still type-checks; the runtime module is always present when Cloudflare
 * bundles functions/, because that happens after the build command.
 */
export declare const PAGE_HASHES: Readonly<Record<string, string>>;
