#!/usr/bin/env node
/**
 * The per-block annotation id registry (ER4): the ids the built reading
 * pages carry, recorded at src/data/annot-registry.json so they are
 * write-once. Run after a build to record new ids; the build test
 * (tests/build/annot-registry.test.ts) fails when a recorded id is gone
 * or a built id is unrecorded.
 *
 *   node scripts/annot-registry.mjs          write the registry from dist
 *   node scripts/annot-registry.mjs --check  exit 1 if dist and registry differ
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const registryPath = path.join(root, 'src', 'data', 'annot-registry.json');

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function routeOf(file) {
  const rel = path.relative(distDir, file).replace(/\\/g, '/');
  return `/${rel.replace(/(^|\/)index\.html$/, '')}`.replace(/\/$/, '') || '/';
}

/** Ids inside the article body of every built page, by route */
export function collectBlockIds() {
  const pages = {};
  for (const file of htmlFiles(distDir)) {
    const html = readFileSync(file, 'utf-8');
    const start = html.indexOf('data-pagefind-body');
    if (start < 0) continue;
    const article = html.slice(start, html.indexOf('</article>', start));
    const ids = [...article.matchAll(/\sdata-annot="([^"]+)"/g)].map((m) => m[1]);
    if (ids.length > 0) pages[routeOf(file)] = ids;
  }
  return Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!existsSync(distDir)) {
    console.error('annot-registry: no dist/ (run pnpm build first)');
    process.exit(1);
  }
  const built = collectBlockIds();
  const json = JSON.stringify(built, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const current = existsSync(registryPath) ? readFileSync(registryPath, 'utf-8') : '';
    if (current !== json) {
      console.error('annot-registry: dist and src/data/annot-registry.json differ; run node scripts/annot-registry.mjs');
      process.exit(1);
    }
    console.log('annot-registry: in sync');
  } else {
    writeFileSync(registryPath, json);
    const count = Object.values(built).reduce((n, ids) => n + ids.length, 0);
    console.log(`annot-registry: ${Object.keys(built).length} pages, ${count} ids → src/data/annot-registry.json`);
  }
}
