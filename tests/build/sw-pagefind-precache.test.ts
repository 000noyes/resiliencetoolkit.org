import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// findPagefindAssets collects the Pagefind CORE subset (what the homepage
// search script actually loads: pagefind.js + entry + meta + wasm + index/ +
// fragment/) for the SW precache nice-to-have tier, excluding the UI bundles
// this site never ships. The list is globbed from dist/pagefind AFTER pagefind
// runs, every build — hashed fragment names can never go stale (the failure
// mode that killed the old hardcoded pagefind precache).
// @ts-expect-error plain .mjs module without type declarations
import { findPagefindAssets } from '../../scripts/pagefind-precache.mjs';

const distDir = path.resolve(__dirname, '../../dist');
const swPath = path.join(distDir, 'sw.js');
const SW_PRESENT = existsSync(swPath) && existsSync(path.join(distDir, 'pagefind'));

const CORE_FILES = [
  'pagefind.js',
  'pagefind-entry.json',
  'pagefind.en_abc123.pf_meta',
  'wasm.en.pagefind',
  'wasm.unknown.pagefind',
  'index/en_deadbee.pf_index',
  'fragment/en_cafe123.pf_fragment',
];

const UI_FILES = [
  'pagefind-ui.js',
  'pagefind-ui.css',
  'pagefind-modular-ui.js',
  'pagefind-modular-ui.css',
  'pagefind-component-ui.js',
  'pagefind-component-ui.css',
  'pagefind-highlight.js',
  'pagefind-worker.js',
];

describe('findPagefindAssets', () => {
  let fixtureDir: string | null = null;

  afterEach(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
    fixtureDir = null;
    vi.restoreAllMocks();
  });

  it('returns [] and warns when dist/pagefind is absent (never fails the build)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fixtureDir = mkdtempSync(path.join(tmpdir(), 'pf-missing-'));
    const assets = findPagefindAssets(fixtureDir);
    expect(assets).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('collects the core subset and excludes every UI bundle', () => {
    fixtureDir = mkdtempSync(path.join(tmpdir(), 'pf-fixture-'));
    const pagefindDir = path.join(fixtureDir, 'pagefind');
    mkdirSync(path.join(pagefindDir, 'index'), { recursive: true });
    mkdirSync(path.join(pagefindDir, 'fragment'), { recursive: true });
    for (const file of [...CORE_FILES, ...UI_FILES]) {
      writeFileSync(path.join(pagefindDir, file), 'x');
    }

    const assets = findPagefindAssets(fixtureDir);

    for (const file of CORE_FILES) {
      expect(assets).toContain(`/pagefind/${file}`);
    }
    for (const file of UI_FILES) {
      expect(assets).not.toContain(`/pagefind/${file}`);
    }
    expect(assets).toHaveLength(CORE_FILES.length);
  });
});

describe('dist/sw.js pagefind precache', () => {
  it.skipIf(!SW_PRESENT)('precaches the pagefind core and none of the UI bundles', () => {
    const sw = readFileSync(swPath, 'utf-8');
    expect(sw).toContain("'/pagefind/pagefind.js',");
    expect(sw).toContain("'/pagefind/pagefind-entry.json',");
    expect(sw).toMatch(/'\/pagefind\/index\/[^']+\.pf_index',/);
    expect(sw).toMatch(/'\/pagefind\/fragment\/[^']+\.pf_fragment',/);
    expect(sw).toMatch(/'\/pagefind\/wasm\.en\.pagefind',/);
    expect(sw).not.toContain('/pagefind/pagefind-ui.js');
    expect(sw).not.toContain('/pagefind/pagefind-modular-ui');
    expect(sw).not.toContain('/pagefind/pagefind-component-ui');
    expect(sw).not.toContain('/pagefind/pagefind-highlight.js');
    expect(sw).not.toContain('/pagefind/pagefind-worker.js');
  });
});
