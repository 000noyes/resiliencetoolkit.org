import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';

import {
  globToRegex,
  matchesSelector,
  runVerify,
  type TargetSelector,
} from './runner';
import type { ExecFn } from './extract';
import { computeMetaHash, computeSourceHash } from './cache';

/**
 * Seed _sources.yaml so checkSourceFreshness returns "fresh" for the given
 * PDF. Computes the raw-byte source_hash of whatever was just written to
 * disk; content_hash is a deterministic stub (only matters for content_drift
 * tests, which seed their own).
 */
async function seedRegistry(
  root: string,
  pdfRelPath: string,
  contentHash = 'b'.repeat(64),
): Promise<void> {
  const source_hash = await computeSourceHash(join(root, pdfRelPath));
  const sources = {
    [pdfRelPath]: {
      source_hash,
      content_hash: contentHash,
      last_verified: new Date().toISOString(),
    },
  };
  const payload = { sources, meta_hash: computeMetaHash(sources) };
  await writeFile(
    join(root, 'docs', 'source-specs', '_sources.yaml'),
    dump(payload, { sortKeys: true, noRefs: true }),
  );
}

/** Build a mock exec that returns the given stdout for pdftotext. */
function mockExec(stdout: string): ExecFn {
  return async () => ({ stdout, stderr: '' });
}

/** Build a mock exec that throws. */
function failingExec(message: string, stderr = ''): ExecFn {
  return async () => {
    const err = new Error(message) as Error & { stderr?: string };
    err.stderr = stderr;
    throw err;
  };
}

function buildSpecMd(frontmatter: string, body = '') {
  return `---${frontmatter}\n---${body ? '\n' + body : ''}`;
}

const LEADER_SPEC = `
module: "1-9"
template: "leader-directory"
title: "Leader Directory"
citation:
  source: "rt-templates/leader-directory.pdf"
  page: "1"
fields:
  - key: "full-name"
    label: "Full Name"
    type: "text"
  - key: "phone"
    label: "Phone"
    type: "tel"
`;

describe('runner: globToRegex', () => {
  it('matches exact paths', () => {
    expect(globToRegex('src/pages/1-9.astro').test('src/pages/1-9.astro')).toBe(true);
    expect(globToRegex('src/pages/1-9.astro').test('src/pages/1-1.astro')).toBe(false);
  });

  it('single star does not cross slash', () => {
    const re = globToRegex('src/pages/*.astro');
    expect(re.test('src/pages/1-9.astro')).toBe(true);
    expect(re.test('src/pages/sub/1-9.astro')).toBe(false);
  });

  it('double star crosses slashes', () => {
    const re = globToRegex('src/**/*.astro');
    expect(re.test('src/pages/1-9.astro')).toBe(true);
    expect(re.test('src/pages/sub/1-9.astro')).toBe(true);
    expect(re.test('src/pages/1-9.tsx')).toBe(false);
  });

  it('escapes regex metacharacters', () => {
    expect(globToRegex('a.b').test('a.b')).toBe(true);
    expect(globToRegex('a.b').test('aXb')).toBe(false);
  });
});

describe('runner: matchesSelector', () => {
  const s = new Set<string>();
  it('all returns true for anything', () => {
    expect(matchesSelector('x.astro', { kind: 'all' }, s)).toBe(true);
  });
  it('target glob-matches', () => {
    expect(matchesSelector('src/pages/1-9.astro', { kind: 'target', pattern: 'src/pages/*.astro' }, s)).toBe(true);
    expect(matchesSelector('src/components/X.tsx', { kind: 'target', pattern: 'src/pages/*.astro' }, s)).toBe(false);
  });
  it('since membership', () => {
    const changed = new Set(['src/pages/1-9.astro']);
    expect(matchesSelector('src/pages/1-9.astro', { kind: 'since', ref: 'main' }, changed)).toBe(true);
    expect(matchesSelector('src/pages/1-1.astro', { kind: 'since', ref: 'main' }, changed)).toBe(false);
  });
});

describe('runner: runVerify end-to-end', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'verify-runner-'));
    await mkdir(join(root, 'src', 'pages'), { recursive: true });
    await mkdir(join(root, 'src', 'components'), { recursive: true });
    await mkdir(join(root, 'docs', 'source-specs'), { recursive: true });
    await mkdir(join(root, 'rt-templates'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('exit 0 on an empty project (no citations)', async () => {
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it('exit 1 when a wired component cites a Drive ID', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="1JVGObcMxDX_5WxMLrVeWxR5nsIfGGwXz" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries.some((e) => e.status === 'drive_id_not_allowed')).toBe(true);
  });

  it('passes a well-formed spec/citation/PDF (pdftotext mocked)', async () => {
    // Spec citing a fake local PDF.
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    // Fake PDF bytes — extract's exec is mocked, bytes just need to exist.
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake-bytes');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    // Wired component referencing the spec.
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: {
        exec: mockExec('LEADER DIRECTORY\nFull Name\nPhone'),
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].status).toBe('pass');
    expect(result.entries[0].file).toBe('src/pages/1-9.astro');
  });

  it('field_drift when one of many fields drifts', async () => {
    const spec20 = `
module: "1-9"
template: "leader-directory"
title: "X"
citation:
  source: "rt-templates/leader-directory.pdf"
  page: "1"
fields:
${Array.from({ length: 19 }, (_, i) => `  - key: "f-${i}"\n    label: "Field ${i}"\n    type: "text"`).join('\n')}
  - key: "drift-field"
    label: "Emergency Contact Name"
    type: "text"
`;
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(spec20),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake-bytes');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const allFields = Array.from({ length: 19 }, (_, i) => `Field ${i}`).join('\n');
    const text = `LEADER DIRECTORY\n${allFields}\nemergency contact`; // last is drifted

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(text) },
    });

    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('field_drift');
    expect(result.entries[0].drift?.diff?.some((d) => /Emergency Contact Name/.test(d))).toBe(true);
  });

  it('needs_human_review without --fail-on-needs-review is exit 0', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake-bytes');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec('irrelevant text with no matches') },
    });

    expect(result.entries[0].status).toBe('needs_human_review');
    expect(result.exitCode).toBe(0);
  });

  it('needs_human_review with --fail-on-needs-review is exit 1', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake-bytes');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      failOnNeedsReview: true,
      saveCache: false,
      extractOptions: { exec: mockExec('irrelevant') },
    });

    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('needs_human_review');
  });

  it('spec file missing → source_not_found for the .md citation', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/missing.md" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_not_found');
  });

  it('spec parse error → spec_parse_error', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', 'bad.md'),
      '---\nmodule: [\n---',
    );
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/bad.md" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('spec_parse_error');
  });

  it('spec references PDF that does not exist → source_not_found', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    // note: no PDF on disk
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_not_found');
    expect(result.entries[0].message).toMatch(/rt-templates\/leader-directory\.pdf/);
  });

  it('extract failure surfaces as extract_failed', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: {
        exec: failingExec('pdftotext: boom', 'specific stderr line'),
      },
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('extract_failed');
    expect(result.entries[0].message).toMatch(/stderr: specific stderr line/);
  });

  it('raw PDF citation passes when file exists (no diff)', async () => {
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="rt-templates/leader-directory.pdf" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.entries[0].status).toBe('pass');
  });

  it('raw PDF citation source_not_found when file missing', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="rt-templates/nope.pdf" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_not_found');
  });

  it('source_drift is soft (exit 0) by default with a remediation hint', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    const wrongHash = 'f'.repeat(64);
    const sources = {
      'rt-templates/leader-directory.pdf': {
        source_hash: wrongHash,
        content_hash: 'a'.repeat(64),
        last_verified: new Date().toISOString(),
      },
    };
    const payload = { sources, meta_hash: computeMetaHash(sources) };
    await writeFile(
      join(root, 'docs', 'source-specs', '_sources.yaml'),
      dump(payload, { sortKeys: true, noRefs: true }),
    );
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec('Full Name\nPhone') },
    });
    expect(result.exitCode).toBe(0);
    expect(result.entries[0].status).toBe('source_drift');
    expect(result.entries[0].message).toMatch(/re-scaffold or update registry/);
  });

  it('source_drift escalates to exit 1 with --fail-on-needs-review', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    const wrongHash = 'f'.repeat(64);
    const sources = {
      'rt-templates/leader-directory.pdf': {
        source_hash: wrongHash,
        content_hash: 'a'.repeat(64),
        last_verified: new Date().toISOString(),
      },
    };
    const payload = { sources, meta_hash: computeMetaHash(sources) };
    await writeFile(
      join(root, 'docs', 'source-specs', '_sources.yaml'),
      dump(payload, { sortKeys: true, noRefs: true }),
    );
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      failOnNeedsReview: true,
      extractOptions: { exec: mockExec('Full Name\nPhone') },
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_drift');
  });

  it('source_unregistered when PDF exists but is missing from _sources.yaml', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    // No _sources.yaml written — registry is empty.
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec('Full Name\nPhone') },
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_unregistered');
    expect(result.entries[0].message).toMatch(/run scaffold-spec to register/);
  });

  it('verifyRawSource emits source_unregistered for raw PDF not in registry', async () => {
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    // No _sources.yaml — the raw-source path should also fail closed.
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="rt-templates/leader-directory.pdf" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_unregistered');
  });

  it('CacheCorruptedError surfaces as cache_corrupted, exit 2', async () => {
    // Write an _extraction-cache.yaml that is malformed YAML.
    await writeFile(
      join(root, 'docs', 'source-specs', '_extraction-cache.yaml'),
      'cache: [\n',
    );
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="rt-templates/x.pdf" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.exitCode).toBe(2);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].status).toBe('cache_corrupted');
  });

  it('--target selector filters citations by glob', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="rt-templates/a.pdf" />`,
    );
    await writeFile(
      join(root, 'src', 'pages', '1-1.astro'),
      `<PlanForm source="rt-templates/b.pdf" />`,
    );
    await writeFile(join(root, 'rt-templates', 'a.pdf'), 'x');
    await writeFile(join(root, 'rt-templates', 'b.pdf'), 'y');

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'target', pattern: 'src/pages/1-9.astro' },
      saveCache: false,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].file).toBe('src/pages/1-9.astro');
  });

  it('--since selector uses the injected gitSinceFn', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="rt-templates/a.pdf" />`,
    );
    await writeFile(
      join(root, 'src', 'pages', '1-1.astro'),
      `<PlanForm source="rt-templates/b.pdf" />`,
    );
    await writeFile(join(root, 'rt-templates', 'a.pdf'), 'x');
    await writeFile(join(root, 'rt-templates', 'b.pdf'), 'y');

    const gitMock = vi.fn(async () => ['src/pages/1-1.astro']);
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'since', ref: 'main' },
      gitSinceFn: gitMock,
      saveCache: false,
    });
    expect(gitMock).toHaveBeenCalledWith('main', expect.any(String));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].file).toBe('src/pages/1-1.astro');
  });

  it('drive-id violations are filtered by selector too', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="1JVGObcMxDX_5WxMLrVeWxR5nsIfGGwXz" />`,
    );
    await writeFile(
      join(root, 'src', 'pages', '1-1.astro'),
      `<PlanForm source="docs/source-specs/x.md" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'target', pattern: 'src/pages/1-1.astro' },
      saveCache: false,
    });
    // Only the 1-1 citation is reported; Drive-ID violation on 1-9 is excluded.
    expect(result.entries.every((e) => e.file === 'src/pages/1-1.astro')).toBe(true);
  });

  it('saveCache defaults to true and persists to disk', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake');
    await seedRegistry(root, 'rt-templates/leader-directory.pdf');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      extractOptions: { exec: mockExec('Full Name\nPhone') },
    });

    expect(result.cacheSaved).toBe(true);
    const { readFile } = await import('node:fs/promises');
    const cacheContent = await readFile(
      join(root, 'docs', 'source-specs', '_extraction-cache.yaml'),
      'utf-8',
    );
    expect(cacheContent).toContain('meta_hash');
  });

  it('report entries only carry taxonomy statuses', async () => {
    const allowed = new Set([
      'pass',
      'missing_citation',
      'source_not_found',
      'source_unregistered',
      'source_drift',
      'content_drift',
      'field_drift',
      'needs_human_review',
      'extract_failed',
      'vision_api_failed',
      'spec_parse_error',
      'cache_corrupted',
      'drive_id_not_allowed',
    ]);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="1JVGObcMxDX_5WxMLrVeWxR5nsIfGGwXz" />`,
    );
    await writeFile(
      join(root, 'src', 'pages', '1-1.astro'),
      `<PlanForm source="rt-templates/nope.pdf" />`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    for (const e of result.entries) {
      expect(allowed.has(e.status)).toBe(true);
    }
  });
});
