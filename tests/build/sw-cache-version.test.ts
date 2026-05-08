/**
 * Build-script regression tests for scripts/generate-sw-precache.mjs
 *
 * D6: CACHE_VERSION must include ms precision (or some other entropy) so two
 * rapid-succession invocations produce different values. Without this, a
 * same-second double-build can leave stale clients pinned to the old cache.
 *
 * D7-#2: After rewrite, dist/sw.js must NOT contain `v-build-PENDING`. A
 * surviving sentinel means CACHE_VERSION never bumps and clients are stuck.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = join(ROOT, 'scripts/generate-sw-precache.mjs');
const PUBLIC_SW = join(ROOT, 'public/sw.js');

// Each test runs the script against a temporary "dist" tree so we don't pollute
// the real build output. We use cwd-relative paths and pass via env where
// needed; the script itself derives its dist path from __dirname (..).
//
// Since the script hardcodes `dirname(__file__)/../dist`, we can't redirect
// it without copying. So: copy the project skeleton into a tmpdir, copy
// public/sw.js into tmpdir/dist/sw.js, and run the script via node from
// tmpdir as cwd. The script's own __dirname still resolves to its source
// location, so we instead create a stub script that imports the real one
// after overriding the resolved root.
//
// Simpler: build a minimal fake project tree under tmpdir/, copy the script
// + public/sw.js to it, and run from there. The script uses
// `dirname(fileURLToPath(import.meta.url))` so a copy is enough.

let tmpRoot: string;

function setupTmpProject(): string {
  tmpRoot = mkdtempSync(join(tmpdir(), 'sw-cache-version-test-'));
  const scriptsDir = join(tmpRoot, 'scripts');
  const distDir = join(tmpRoot, 'dist');
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(SCRIPT_PATH, join(scriptsDir, 'generate-sw-precache.mjs'));
  cpSync(PUBLIC_SW, join(distDir, 'sw.js'));
  // Need at least one index.html so PRECACHE_ASSETS isn't empty
  writeFileSync(join(distDir, 'index.html'), '<!doctype html><html></html>');
  return tmpRoot;
}

function runGenerator(root: string): string {
  return execFileSync('node', [join(root, 'scripts/generate-sw-precache.mjs')], {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readGeneratedSw(root: string): string {
  return readFileSync(join(root, 'dist/sw.js'), 'utf-8');
}

function extractCacheVersion(swContent: string): string {
  const match = swContent.match(/const CACHE_VERSION = '([^']+)';/);
  if (!match) throw new Error('CACHE_VERSION not found in sw.js');
  return match[1];
}

afterAll(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

describe('generate-sw-precache.mjs — D6 ms precision', () => {
  it('two rapid-succession invocations produce different CACHE_VERSION values', () => {
    const root = setupTmpProject();
    runGenerator(root);
    const v1 = extractCacheVersion(readGeneratedSw(root));
    // Reset dist/sw.js to the PENDING template so the second run has work to do
    cpSync(PUBLIC_SW, join(root, 'dist/sw.js'));
    runGenerator(root);
    const v2 = extractCacheVersion(readGeneratedSw(root));
    expect(v1).not.toBe(v2);
  });
});

describe('generate-sw-precache.mjs — D7-#2 PENDING assertion', () => {
  it('removes v-build-PENDING from output', () => {
    const root = setupTmpProject();
    runGenerator(root);
    const out = readGeneratedSw(root);
    expect(out).not.toContain('v-build-PENDING');
    expect(out).toMatch(/const CACHE_VERSION = 'v-build-\d+';/);
  });
});
