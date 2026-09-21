// @vitest-environment node
/**
 * Build-script regression tests for the page hash map that
 * scripts/generate-sw-precache.mjs writes into functions/lib/ at postbuild.
 *
 * The root middleware sets an ETag on every HTML page from this map and
 * answers 304 when a request carries a matching If-None-Match, so the map
 * must hold one hash per built page, including pages the precache leaves
 * out, and a hash must change when, and only when, the page changes.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { pageHash } from '../../scripts/generate-sw-precache.mjs';

const ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = join(ROOT, 'scripts/generate-sw-precache.mjs');
const PUBLIC_SW = join(ROOT, 'public/sw.js');
const MAP_RELATIVE = 'functions/lib/page-hashes.generated.js';

const tmpRoots: string[] = [];

function setupTmpProject(): string {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'page-hashes-test-'));
  tmpRoots.push(tmpRoot);
  const scriptsDir = join(tmpRoot, 'scripts');
  const distDir = join(tmpRoot, 'dist');
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(join(distDir, 'modules/1-1'), { recursive: true });
  mkdirSync(join(distDir, 'changelog'), { recursive: true });
  cpSync(SCRIPT_PATH, join(scriptsDir, 'generate-sw-precache.mjs'));
  cpSync(join(ROOT, 'scripts/pagefind-precache.mjs'), join(scriptsDir, 'pagefind-precache.mjs'));
  cpSync(PUBLIC_SW, join(distDir, 'sw.js'));
  writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>cover</title>');
  writeFileSync(join(distDir, 'modules/1-1/index.html'), '<!doctype html><title>1-1</title>');
  // Excluded from the precache, still a page the origin serves.
  writeFileSync(join(distDir, 'changelog/index.html'), '<!doctype html><title>changelog</title>');
  return tmpRoot;
}

function runGenerator(root: string): void {
  execFileSync('node', [join(root, 'scripts/generate-sw-precache.mjs')], {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // The generator consumes the PENDING template; reset it for the next run.
  cpSync(PUBLIC_SW, join(root, 'dist/sw.js'));
}

async function readMap(root: string): Promise<Record<string, string>> {
  const file = join(root, MAP_RELATIVE);
  expect(existsSync(file), `${MAP_RELATIVE} must be written by the generator`).toBe(true);
  // A cache-busting query so the second import is not served from the module cache.
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}-${Math.random()}`);
  return mod.PAGE_HASHES;
}

afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

// Each case spawns the generator once or twice; on a loaded machine one spawn
// can take several seconds, so the budget is wider than the 5s default.
describe('generate-sw-precache.mjs writes the page hash map', { timeout: 30_000 }, () => {
  it('holds one hash per built page, precache exclusions included', async () => {
    const root = setupTmpProject();
    runGenerator(root);
    const map = await readMap(root);
    expect(Object.keys(map).sort()).toEqual(['/', '/changelog/', '/modules/1-1/']);
    for (const hash of Object.values(map)) expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes a hash when its page changes and keeps the others', async () => {
    const root = setupTmpProject();
    runGenerator(root);
    const before = await readMap(root);
    writeFileSync(join(root, 'dist/modules/1-1/index.html'), '<!doctype html><title>1-1 edited</title>');
    runGenerator(root);
    const after = await readMap(root);
    expect(after['/modules/1-1/']).not.toBe(before['/modules/1-1/']);
    expect(after['/']).toBe(before['/']);
    expect(after['/changelog/']).toBe(before['/changelog/']);
  });

  it('ignores the footer build stamp, so a rebuild on a new day keeps the hash', () => {
    const monday = '<!doctype html><p>Last updated <time datetime="2026-09-21">2026-09-21</time></p>';
    const tuesday = '<!doctype html><p>Last updated <time datetime="2026-09-22">2026-09-22</time></p>';
    const edited = '<!doctype html><p>Edited. Last updated <time datetime="2026-09-22">2026-09-22</time></p>';
    expect(pageHash(monday)).toBe(pageHash(tuesday));
    expect(pageHash(edited)).not.toBe(pageHash(monday));
    // Other dates still count.
    expect(pageHash('<time datetime="2026-01-01">2026-01-01</time>')).not.toBe(
      pageHash('<time datetime="2026-01-02">2026-01-02</time>')
    );
  });

  it('is a plain module the functions bundle can import', () => {
    const root = setupTmpProject();
    runGenerator(root);
    const source = readFileSync(join(root, MAP_RELATIVE), 'utf-8');
    expect(source).toMatch(/^export const PAGE_HASHES = /m);
  });
});
