import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { scaffoldSpec, ScaffoldError } from './scaffold';
import { parseSpecMarkdown } from './load-spec';
import type { ExecFn } from './extract';
import { computeContentHash, computeSourceHash, loadSourceRegistry } from './cache';

function mockExec(stdout: string): ExecFn {
  return async () => ({ stdout, stderr: '' });
}

describe('scaffold: scaffoldSpec', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'verify-scaffold-'));
    await mkdir(join(root, 'rt-templates'), { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('rejects invalid module format', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    await expect(
      scaffoldSpec({
        projectRoot: root,
        pdf: 'rt-templates/x.pdf',
        module: 'module-9',
        template: 'leader-directory',
      }),
    ).rejects.toThrow(/invalid module/);
  });

  it('rejects invalid template format (camelCase)', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    await expect(
      scaffoldSpec({
        projectRoot: root,
        pdf: 'rt-templates/x.pdf',
        module: '1-9',
        template: 'LeaderDirectory',
      }),
    ).rejects.toThrow(/invalid template/);
  });

  it('rejects a missing PDF', async () => {
    try {
      await scaffoldSpec({
        projectRoot: root,
        pdf: 'rt-templates/missing.pdf',
        module: '1-9',
        template: 'leader-directory',
      });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ScaffoldError);
      expect((e as ScaffoldError).status).toBe('extract_failed');
    }
  });

  it('produces a round-trip-parseable spec file', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake-pdf-bytes');
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      page: '14-15',
      module: '1-9',
      template: 'leader-directory',
      saveCache: false,
      extractOptions: { exec: mockExec('LEADER DIRECTORY\nFull Name\nPhone') },
    });

    expect(result.outRelPath).toBe('docs/source-specs/1-9-leader-directory.md');
    const raw = await readFile(result.outAbsolutePath, 'utf-8');
    expect(raw).toBe(result.content);
    // Round-trip: our own loadSpec parser must accept the output.
    const loaded = parseSpecMarkdown(raw);
    expect(loaded.spec.module).toBe('1-9');
    expect(loaded.spec.template).toBe('leader-directory');
    expect(loaded.spec.title).toBe('Leader Directory');
    expect(loaded.spec.citation.source).toBe('rt-templates/x.pdf');
    expect(loaded.spec.citation.page).toBe('14-15');
    expect(loaded.spec.fields?.[0].key).toBe('placeholder');
    expect(loaded.body).toContain('Extracted text');
    expect(loaded.body).toContain('LEADER DIRECTORY');
  });

  it('uses an explicit title when provided', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      title: 'Community Leader Directory',
      saveCache: false,
      extractOptions: { exec: mockExec('x') },
    });
    const loaded = parseSpecMarkdown(await readFile(result.outAbsolutePath, 'utf-8'));
    expect(loaded.spec.title).toBe('Community Leader Directory');
  });

  it('respects an explicit outRelPath override', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      outRelPath: 'docs/source-specs/custom/1-9-leader.md',
      saveCache: false,
      extractOptions: { exec: mockExec('x') },
    });
    expect(result.outRelPath).toBe('docs/source-specs/custom/1-9-leader.md');
    expect(await readFile(result.outAbsolutePath, 'utf-8')).toContain(
      'template: leader-directory',
    );
  });

  it('refuses to overwrite an existing file unless force=true', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    await mkdir(join(root, 'docs', 'source-specs'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      'pre-existing content',
    );
    try {
      await scaffoldSpec({
        projectRoot: root,
        pdf: 'rt-templates/x.pdf',
        module: '1-9',
        template: 'leader-directory',
        saveCache: false,
        extractOptions: { exec: mockExec('x') },
      });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ScaffoldError);
      expect((e as ScaffoldError).status).toBe('exists');
    }
  });

  it('overwrites when force=true', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    await mkdir(join(root, 'docs', 'source-specs'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      'pre-existing',
    );
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      force: true,
      saveCache: false,
      extractOptions: { exec: mockExec('new extracted text') },
    });
    expect(result.content).toContain('new extracted text');
    const raw = await readFile(result.outAbsolutePath, 'utf-8');
    expect(raw).not.toContain('pre-existing');
  });

  it('caps extracted text preview at 2000 chars', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    const bigText = 'x'.repeat(5000);
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      saveCache: false,
      extractOptions: { exec: mockExec(bigText) },
    });
    // Count only preview x's — not frontmatter.
    const previewMatch = result.content.match(/```\n(x+)\n```/);
    expect(previewMatch).toBeTruthy();
    expect(previewMatch![1].length).toBe(2000);
  });

  it('surfaces CacheCorruptedError as ScaffoldError.cache_corrupted', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    await mkdir(join(root, 'docs', 'source-specs'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'source-specs', '_extraction-cache.yaml'),
      'cache: [\n',
    );
    try {
      await scaffoldSpec({
        projectRoot: root,
        pdf: 'rt-templates/x.pdf',
        module: '1-9',
        template: 'leader-directory',
        saveCache: false,
        extractOptions: { exec: mockExec('x') },
      });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ScaffoldError);
      expect((e as ScaffoldError).status).toBe('cache_corrupted');
    }
  });

  it('saves extraction cache by default and skips when saveCache=false', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');

    // First invocation with saveCache=false: no cache file written.
    await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-1',
      template: 'a',
      saveCache: false,
      extractOptions: { exec: mockExec('extracted-a') },
    });
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(root, 'docs', 'source-specs', '_extraction-cache.yaml'))).toBe(false);

    // Second invocation with default saveCache: cache file written.
    await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-2',
      template: 'b',
      extractOptions: { exec: mockExec('extracted-b') },
    });
    expect(existsSync(join(root, 'docs', 'source-specs', '_extraction-cache.yaml'))).toBe(true);
  });

  it('writes a _sources.yaml registry entry on first scaffold', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'pdf-bytes');
    const extractText = 'LEADER DIRECTORY\nFull Name\nPhone';
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      saveCache: false,
      extractOptions: { exec: mockExec(extractText) },
    });
    expect(result.registrySaved).toBe(true);

    const registry = await loadSourceRegistry(root);
    const entry = registry.sources['rt-templates/x.pdf'];
    expect(entry).toBeDefined();
    expect(entry.source_hash).toBe(await computeSourceHash(join(root, 'rt-templates', 'x.pdf')));
    expect(entry.content_hash).toBe(computeContentHash(extractText));
    expect(entry.last_verified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('saveRegistry=false skips the registry write', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'pdf-bytes');
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      saveCache: false,
      saveRegistry: false,
      extractOptions: { exec: mockExec('x') },
    });
    expect(result.registrySaved).toBe(false);
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(root, 'docs', 'source-specs', '_sources.yaml'))).toBe(false);
  });

  it('overwrites the registry entry on force scaffold with fresh hashes', async () => {
    // First scaffold — seeds registry entry with one content_hash.
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'pdf-bytes-v1');
    await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      saveCache: false,
      extractOptions: { exec: mockExec('version-one-text') },
    });
    const before = (await loadSourceRegistry(root)).sources['rt-templates/x.pdf'];

    // Rewrite the PDF bytes and re-scaffold with --force. Registry should
    // reflect the new hashes, not the stale ones.
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'pdf-bytes-v2');
    await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-9',
      template: 'leader-directory',
      force: true,
      saveCache: false,
      extractOptions: { exec: mockExec('version-two-text') },
    });
    const after = (await loadSourceRegistry(root)).sources['rt-templates/x.pdf'];

    expect(after.source_hash).not.toBe(before.source_hash);
    expect(after.content_hash).toBe(computeContentHash('version-two-text'));
    expect(after.last_verified >= before.last_verified).toBe(true);
  });

  it('defaults title to Title-cased template', async () => {
    await writeFile(join(root, 'rt-templates', 'x.pdf'), 'fake');
    const result = await scaffoldSpec({
      projectRoot: root,
      pdf: 'rt-templates/x.pdf',
      module: '1-3',
      template: 'sitrep',
      saveCache: false,
      extractOptions: { exec: mockExec('x') },
    });
    const loaded = parseSpecMarkdown(await readFile(result.outAbsolutePath, 'utf-8'));
    expect(loaded.spec.title).toBe('Sitrep');
  });
});
