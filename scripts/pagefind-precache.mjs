/**
 * pagefind-precache.mjs
 *
 * Collects the Pagefind CORE subset from dist/pagefind/ as precache URLs so
 * search works offline. Core = what the homepage search script actually loads:
 * pagefind.js, pagefind-entry.json, the *.pf_meta manifest, the wasm engines,
 * and the index/ + fragment/ chunks (~230KB total). The UI bundles
 * (pagefind-ui*, pagefind-modular-ui*, pagefind-component-ui*,
 * pagefind-highlight.js, pagefind-worker.js) are never loaded by this site and
 * would push the set past 500KB, so they are excluded.
 *
 * Globbed from dist AFTER pagefind runs, every build: the hashed chunk names
 * can never go stale (hardcoded pagefind filenames in the pre-generator
 * service worker rotted on every reindex and were torn out in 4a97cb9).
 *
 * Imported by generate-sw-precache.mjs (postbuild) and unit-tested directly.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const EXCLUDED_UI_PREFIXES = [
  'pagefind-ui',
  'pagefind-modular-ui',
  'pagefind-component-ui',
  'pagefind-highlight.js',
  'pagefind-worker.js',
];

export function findPagefindAssets(distDir) {
  const pagefindDir = join(distDir, 'pagefind');
  if (!existsSync(pagefindDir)) {
    console.warn('SW generator: dist/pagefind not found, skipping pagefind precache (search will need a connection offline).');
    return [];
  }
  const results = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      const rel = relative(pagefindDir, fullPath).replace(/\\/g, '/');
      if (EXCLUDED_UI_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
      results.push('/pagefind/' + rel);
    }
  };
  walk(pagefindDir);
  results.sort();
  return results;
}
