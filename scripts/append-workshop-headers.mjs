#!/usr/bin/env node
/**
 * append-workshop-headers.mjs
 *
 * Postbuild script (runs after generate-sw-precache.mjs). When the build is
 * a workshop-copy build (WORKSHOP=1 in the project's build environment), it
 * appends an X-Robots-Tag: noindex rule for every path to dist/_headers, so
 * search engines never land hub users on the workshop origin. Cloudflare
 * Pages merges all matching _headers blocks, so appending a second /* block
 * is additive and leaves the CSP block untouched.
 *
 * BaseLayout.astro emits the matching meta robots tag under the same flag;
 * the live deploy is verified by content (header AND meta) before any link
 * circulates. Production builds (no WORKSHOP flag) are untouched.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NOINDEX_BLOCK = '\n# Workshop copy: never indexed\n/*\n  X-Robots-Tag: noindex\n';

/**
 * Append the noindex block to <distDir>/_headers when the flag is set.
 * Idempotent: a file already carrying X-Robots-Tag is left alone.
 * Returns what happened so the caller (and the unit test) can assert it.
 */
export function appendWorkshopHeaders(distDir, env) {
  if (env.WORKSHOP !== '1') return 'skipped';
  const headersPath = join(distDir, '_headers');
  const existing = existsSync(headersPath) ? readFileSync(headersPath, 'utf-8') : '';
  if (existing.includes('X-Robots-Tag')) return 'already-present';
  writeFileSync(headersPath, existing + NOINDEX_BLOCK, 'utf-8');
  return 'appended';
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
  const result = appendWorkshopHeaders(join(rootDir, 'dist'), process.env);
  console.log(`workshop headers: ${result}`);
}
