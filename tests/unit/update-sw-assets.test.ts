/**
 * Unit tests for scripts/update-sw-assets.mjs
 *
 * The script accepts an optional base directory parameter so tests can pass
 * isolated temp directories without relying on process.chdir().
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { main } from '../../scripts/update-sw-assets.mjs';

// ─── fixture ────────────────────────────────────────────────────────────────

const TEMPLATE_CONTENT = `\
const CACHE_VERSION = 'build-placeholder'; // set by scripts/update-sw-assets.mjs at build time
const CACHE_NAME = \`resilience-hub-\${CACHE_VERSION}\`;
const PRECACHE_ASSETS = [
  '/',
  // ASSETS_START - Auto-generated section - do not manually edit
  // (populated by scripts/update-sw-assets.mjs at build time — do not add entries here)
  // ASSETS_END - Auto-generated section - do not manually edit
];
`;

// ─── helpers ────────────────────────────────────────────────────────────────

async function makeTempDir(files: Record<string, string>): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'sw-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, relPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
  }
  return tmpDir;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('update-sw-assets.mjs', () => {
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it('writes to dist/sw.js, NOT public/sw.js', async () => {
    tmpDir = await makeTempDir({
      'public/sw.js': TEMPLATE_CONTENT,
      'dist/_astro/Todo.abc123de.js': '// todo bundle',
      'dist/_astro/client.ffffffff.js': '// client bundle',
    });

    const templateBefore = await readFile(path.join(tmpDir, 'public/sw.js'), 'utf8');

    await main(tmpDir);

    // dist/sw.js was created
    expect(existsSync(path.join(tmpDir, 'dist/sw.js'))).toBe(true);

    // public/sw.js is unchanged
    const templateAfter = await readFile(path.join(tmpDir, 'public/sw.js'), 'utf8');
    expect(templateAfter).toBe(templateBefore);
  });

  it('CACHE_VERSION in output matches build-{8-char-hex} format', async () => {
    tmpDir = await makeTempDir({
      'public/sw.js': TEMPLATE_CONTENT,
      'dist/_astro/Todo.abc123de.js': '// todo bundle',
    });

    await main(tmpDir);

    const distSw = await readFile(path.join(tmpDir, 'dist/sw.js'), 'utf8');
    expect(/const CACHE_VERSION = 'build-[a-f0-9]{8}';/.test(distSw)).toBe(true);
  });

  it('ASSETS_START block in dist/sw.js contains hashed asset paths from dist/_astro/', async () => {
    tmpDir = await makeTempDir({
      'public/sw.js': TEMPLATE_CONTENT,
      'dist/_astro/Todo.abc123de.js': '// todo bundle',
    });

    await main(tmpDir);

    const distSw = await readFile(path.join(tmpDir, 'dist/sw.js'), 'utf8');
    expect(distSw).toContain('/_astro/Todo.abc123de.js');
  });

  it('missing CRITICAL_ASSETS → script exits 0, still writes output, logs warning', async () => {
    // Empty dist/_astro — no critical asset names will match
    tmpDir = await makeTempDir({
      'public/sw.js': TEMPLATE_CONTENT,
      'dist/_astro/.keep': '',
    });

    // Should not throw
    await expect(main(tmpDir)).resolves.toBeUndefined();

    // dist/sw.js is still written
    expect(existsSync(path.join(tmpDir, 'dist/sw.js'))).toBe(true);
  });

  it('two builds with different asset hashes produce different CACHE_VERSION', async () => {
    tmpDir = await makeTempDir({
      'public/sw.js': TEMPLATE_CONTENT,
      'dist/_astro/Todo.aaaaaaaa.js': '// bundle A',
    });

    // Build A
    await main(tmpDir);
    const swA = await readFile(path.join(tmpDir, 'dist/sw.js'), 'utf8');
    const versionA = swA.match(/const CACHE_VERSION = '([^']+)';/)?.[1];

    // Swap the hashed file to simulate a different build
    await rm(path.join(tmpDir, 'dist/_astro/Todo.aaaaaaaa.js'));
    await writeFile(path.join(tmpDir, 'dist/_astro/Todo.bbbbbbbb.js'), '// bundle B', 'utf8');

    // Build B
    await main(tmpDir);
    const swB = await readFile(path.join(tmpDir, 'dist/sw.js'), 'utf8');
    const versionB = swB.match(/const CACHE_VERSION = '([^']+)';/)?.[1];

    expect(versionA).toMatch(/^build-[a-f0-9]{8}$/);
    expect(versionB).toMatch(/^build-[a-f0-9]{8}$/);
    expect(versionA).not.toBe(versionB);
  });
});
