#!/usr/bin/env node
/**
 * generate-sw-precache.mjs
 *
 * Postbuild script. Reads all dist/**\/index.html files, converts them to URL
 * routes, and writes the generated PRECACHE_ASSETS list into dist/sw.js
 * between the __PRECACHE_ASSETS_START__ / __PRECACHE_ASSETS_END__ sentinels.
 * Also auto-bumps CACHE_VERSION to a build timestamp.
 *
 * Writes to dist/sw.js (the deployed artifact) — never modifies public/sw.js.
 * Run via: "postbuild": "node scripts/generate-sw-precache.mjs" in package.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPagefindAssets } from './pagefind-precache.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const swPath = join(distDir, 'sw.js');

const SENTINEL_START = '// __PRECACHE_ASSETS_START__';
const SENTINEL_END = '// __PRECACHE_ASSETS_END__';

// Routes to exclude from precache (not needed offline, not in nav).
// NB: /_astro/ assets are not index.html files so they never appear in the
// route list anyway — they are precached explicitly via findAstroAssets()
// below so precached-but-unvisited routes render styled + interactive offline.
const EXCLUDE_PREFIXES = [
  '/changelog/',
  '/replicate/',
  '/access/',
  '/other/',
];

// Static assets to always include (checked for existence in dist/)
const STATIC_ASSETS = [
  '/manifest.json',
  '/RHT_orange.svg',
  '/RHT_text.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

function findIndexHtmlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findIndexHtmlFiles(fullPath));
    } else if (entry.name === 'index.html') {
      results.push(fullPath);
    }
  }
  return results;
}

// Recursively collect every built /_astro asset (CSS/JS/font/etc.) as a URL.
// These are the page bundles. Without them in the precache, a precached-but-
// never-visited route opened offline renders unstyled + non-interactive (the
// bundles only entered the cache lazily, when fetched online). The whole pool
// is small (~0.8 MB / ~40 files; Astro dedupes shared chunks) so precaching all
// of it costs ~nothing and removes the per-route subset bookkeeping. They land
// in the nice-to-have tier (not ESSENTIAL_ASSETS) so one stale hash can't brick
// the SW install.
function findAstroAssets(dir) {
  const astroDir = join(dir, '_astro');
  if (!existsSync(astroDir)) return [];
  const results = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        results.push('/' + relative(distDir, fullPath).replace(/\\/g, '/'));
      }
    }
  };
  walk(astroDir);
  return results;
}

function distPathToRoute(htmlPath) {
  // Use forward slashes regardless of OS (Windows uses backslashes in path.relative)
  const rel = relative(distDir, htmlPath).replace(/\\/g, '/');
  // dist/index.html → /
  if (rel === 'index.html') return '/';
  // dist/modules/1-1/index.html → /modules/1-1/
  return '/' + rel.replace(/\/index\.html$/, '/');
}

// --- Validation ---

if (!existsSync(distDir)) {
  console.error('SW generator: dist/ does not exist. Run astro build first.');
  process.exit(1);
}

if (!existsSync(swPath)) {
  console.error('SW generator: dist/sw.js not found. Was public/sw.js present during build?');
  process.exit(1);
}

const swContent = readFileSync(swPath, 'utf-8');

if (!swContent.includes(SENTINEL_START) || !swContent.includes(SENTINEL_END)) {
  console.error(
    'SW generator: __PRECACHE_ASSETS_START__ sentinel missing from dist/sw.js.\n' +
    'public/sw.js must contain the sentinel comments. Do not remove them.'
  );
  process.exit(1);
}

// --- Collect routes ---

const htmlFiles = findIndexHtmlFiles(distDir);
const routes = [];

for (const htmlPath of htmlFiles) {
  const route = distPathToRoute(htmlPath);
  if (EXCLUDE_PREFIXES.some(prefix => route.startsWith(prefix))) continue;
  routes.push(route);
}

routes.sort();

// --- Add static assets (check they exist) ---

const staticAssets = [];
for (const asset of STATIC_ASSETS) {
  const assetPath = join(distDir, asset);
  if (existsSync(assetPath)) {
    staticAssets.push(asset);
  } else {
    console.warn(`SW generator: static asset not found in dist/, omitting: ${asset}`);
  }
}

// --- Collect /_astro bundles (the offline-durability fix) ---

const astroAssets = findAstroAssets(distDir);
astroAssets.sort();

// --- Collect the Pagefind core subset (offline search) ---
// Nice-to-have tier like the /_astro pool: a miss degrades search, never the
// SW install. See scripts/pagefind-precache.mjs for the core/UI split.

const pagefindAssets = findPagefindAssets(distDir);

const allAssets = [...routes, ...staticAssets, ...astroAssets, ...pagefindAssets];

if (allAssets.length === 0) {
  console.error('SW generator: PRECACHE_ASSETS list is empty after filtering. Something is wrong.');
  process.exit(1);
}

// --- Build replacement block ---

const assetLines = allAssets.map(a => `  '${a}',`).join('\n');
const arrayBlock = `const PRECACHE_ASSETS = [\n${assetLines}\n];`;

const replacement = `${SENTINEL_START}\n${arrayBlock}\n${SENTINEL_END}`;

// --- Bump CACHE_VERSION ---
// ms precision so two rapid-succession invocations (CI retry, hot-reload
// rebuilds) always produce distinct CACHE_VERSION values. Without this,
// a same-second double-build would let stale caches survive.

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const buildTs =
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
  `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
  String(now.getUTCMilliseconds()).padStart(3, '0');
const cacheVersion = `v-build-${buildTs}`;

// Replace PRECACHE_ASSETS block between sentinels
const startIdx = swContent.indexOf(SENTINEL_START);
const endIdx = swContent.indexOf(SENTINEL_END) + SENTINEL_END.length;
const updated = swContent.slice(0, startIdx) + replacement + swContent.slice(endIdx);

// Replace CACHE_VERSION value
const final = updated.replace(
  /const CACHE_VERSION = '[^']*';/,
  `const CACHE_VERSION = '${cacheVersion}';`
);

// Assert CACHE_VERSION was actually replaced (guards against regex mismatch)
if (!final.includes(`const CACHE_VERSION = '${cacheVersion}';`)) {
  console.error('SW generator: CACHE_VERSION replacement failed — dist/sw.js not updated.');
  process.exit(1);
}

// Assert v-build-PENDING is gone. A surviving sentinel would mean every
// client thinks the cache is named `resilience-hub-v-build-PENDING` and
// nothing ever rotates.
if (final.includes('v-build-PENDING')) {
  console.error('SW generator: v-build-PENDING still present in dist/sw.js after rewrite.');
  process.exit(1);
}

writeFileSync(swPath, final, 'utf-8');

console.log(
  `SW generator: ${routes.length} routes + ${staticAssets.length} static assets + ` +
  `${astroAssets.length} /_astro bundles + ${pagefindAssets.length} pagefind assets → dist/sw.js (${cacheVersion})`
);
