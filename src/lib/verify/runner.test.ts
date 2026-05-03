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
import { computeContentHash, computeMetaHash, computeSourceHash } from './cache';

/**
 * Seed _sources.yaml so checkSourceFreshness returns "fresh" for the given
 * (PDF, page) pair. Computes the raw-byte source_hash of whatever was just
 * written to disk. If mockExtractedText is provided, content_hash is
 * derived from it so the content_drift check will pass when pdftotext is
 * mocked to return that same text. Otherwise falls back to a stub hash —
 * useful when the test already expects content_drift (mismatch is the
 * point).
 *
 * Page defaults to '1' to match the leader-directory spec fixtures used
 * throughout this file. Pass an explicit page when seeding for a spec
 * that cites a different page range.
 */
async function seedRegistry(
  root: string,
  pdfRelPath: string,
  mockExtractedText?: string,
  contentHashOverride?: string,
  page = '1',
): Promise<void> {
  const source_hash = await computeSourceHash(join(root, pdfRelPath));
  const content_hash =
    contentHashOverride ??
    (mockExtractedText ? computeContentHash(mockExtractedText) : 'b'.repeat(64));
  const sources = {
    [pdfRelPath]: {
      source_hash,
      content_hashes: { [page]: content_hash },
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
    // Mock text mimics the real leader-directory column-header row so the
    // short-label cluster check has something to corroborate against.
    const mockText = 'LEADER DIRECTORY\nFull Name Phone\n';
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', mockText);
    // Wired component referencing the spec.
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(mockText) },
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
    const allFields = Array.from({ length: 19 }, (_, i) => `Field ${i}`).join('\n');
    const text = `LEADER DIRECTORY\n${allFields}\nemergency contact`; // last is drifted
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', text);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

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
    const mockText = 'irrelevant text with no matches';
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', mockText);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(mockText) },
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
    const mockText = 'irrelevant';
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', mockText);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      failOnNeedsReview: true,
      saveCache: false,
      extractOptions: { exec: mockExec(mockText) },
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

  /**
   * Seed the registry with a deliberately wrong source_hash but the CORRECT
   * content_hash for the mock extract text. This is "source_drift alone" —
   * bytes changed but normalized text didn't — and should degrade to a soft
   * advisory per the RT constitution.
   */
  async function seedDriftedSourceFreshContent(mockText: string): Promise<void> {
    const wrongHash = 'f'.repeat(64);
    const { computeContentHash } = await import('./cache');
    const sources = {
      'rt-templates/leader-directory.pdf': {
        source_hash: wrongHash,
        content_hashes: { '1': computeContentHash(mockText) },
        last_verified: new Date().toISOString(),
      },
    };
    const payload = { sources, meta_hash: computeMetaHash(sources) };
    await writeFile(
      join(root, 'docs', 'source-specs', '_sources.yaml'),
      dump(payload, { sortKeys: true, noRefs: true }),
    );
  }

  it('source_drift alone (content_hash unchanged) is soft — exit 0 by default', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    const mockText = 'Full Name\nPhone';
    await seedDriftedSourceFreshContent(mockText);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(mockText) },
    });
    expect(result.exitCode).toBe(0);
    expect(result.entries[0].status).toBe('source_drift');
    expect(result.entries[0].message).toMatch(/normalized text is unchanged/);
  });

  it('source_drift alone escalates to exit 1 with --fail-on-needs-review', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    const mockText = 'Full Name\nPhone';
    await seedDriftedSourceFreshContent(mockText);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      failOnNeedsReview: true,
      extractOptions: { exec: mockExec(mockText) },
    });
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('source_drift');
  });

  it(
    'REGRESSION: source_drift + content_drift escalates to content_drift (Session D H2 repro)',
    async () => {
      // Session D's H2 scenario: swap the PDF with different bytes that happen
      // to contain the 5 label tokens. Registry still has the old source_hash
      // AND the old content_hash. Both drift — constitution says "source_drift
      // ALONE is soft" → when content also drifts, the hard content_drift
      // status must win, not source_drift. This test specifically guards
      // against the pre-Stage-2 "golden fixture passes illusorily" bug.
      await writeFile(
        join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
        buildSpecMd(LEADER_SPEC),
      );
      await writeFile(
        join(root, 'rt-templates', 'leader-directory.pdf'),
        'bytes-swapped',
      );
      // Registry encodes a different source_hash AND a different
      // content_hash than what extract will produce.
      const wrongSource = 'f'.repeat(64);
      const wrongContent = 'a'.repeat(64);
      const sources = {
        'rt-templates/leader-directory.pdf': {
          source_hash: wrongSource,
          content_hashes: { '1': wrongContent },
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

      // The mock extract returns the H2 repro text — 5 label tokens in prose.
      const h2ReproText =
        'Please fill in your name and contact details. Phone: required. ' +
        'Email: required. Title/Role of person. This is a completely fabricated ' +
        'link to local emergency plan scenario.';
      const result = await runVerify({
        projectRoot: root,
        selector: { kind: 'all' },
        saveCache: false,
        extractOptions: { exec: mockExec(h2ReproText) },
      });

      // Pre-Stage 2: this returned exit 0 / status: pass.
      // Post-Stage 2: content_drift wins — hard fail, no opt-out.
      expect(result.exitCode).toBe(1);
      expect(result.entries[0].status).toBe('content_drift');
      expect(result.entries[0].drift).toBeUndefined();
    },
  );

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

  it('content_drift when registered content_hash mismatches fresh extract', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    // Seed with the correct source_hash but a deliberately wrong
    // content_hash — freshness passes, but extract's content_hash won't
    // match, forcing content_drift to fire.
    await seedRegistry(
      root,
      'rt-templates/leader-directory.pdf',
      undefined,
      'c'.repeat(64),
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
    expect(result.exitCode).toBe(1);
    expect(result.entries[0].status).toBe('content_drift');
    expect(result.entries[0].message).toMatch(/text has moved/);
    // content_drift short-circuits — no drift payload from diff leaks through
    expect(result.entries[0].drift).toBeUndefined();
  });

  it('content_hash match lets diff run and report pass', async () => {
    await writeFile(
      join(root, 'docs', 'source-specs', '1-9-leader-directory.md'),
      buildSpecMd(LEADER_SPEC),
    );
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'bytes-A');
    // Cluster-safe header-row text (short "Phone" co-occurs with "Full Name").
    const extractText = 'Full Name Phone';
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', extractText);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(extractText) },
    });
    expect(result.exitCode).toBe(0);
    expect(result.entries[0].status).toBe('pass');
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
    const mockText = 'Full Name\nPhone';
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', mockText);
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      extractOptions: { exec: mockExec(mockText) },
    });

    expect(result.cacheSaved).toBe(true);
    const { readFile } = await import('node:fs/promises');
    const cacheContent = await readFile(
      join(root, 'docs', 'source-specs', '_extraction-cache.yaml'),
      'utf-8',
    );
    expect(cacheContent).toContain('meta_hash');
  });

  // -------------------------------------------------------------------------
  // Day-5a integration tests — walk-observed failure modes through runVerify.
  // Pure check-level tests live in runner-checks.test.ts; these assert that
  // runVerify actually surfaces the new statuses end-to-end (exit code,
  // ordering alongside the diff-level entry).
  // -------------------------------------------------------------------------

  it('links/titles/keys checks run only when load-spec succeeds', async () => {
    // spec_parse_error path: load-spec throws, no day-5 checks should fire.
    await writeFile(join(root, 'docs', 'source-specs', 'bad.md'), '---\n---');
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      `<PlanForm source="docs/source-specs/bad.md" />\n` +
        `<h1>Anything</h1>\n<h2>Invented</h2>`,
    );
    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
    });
    expect(result.entries.every((e) => e.status !== 'title_drift')).toBe(true);
  });

  it('runVerify surfaces title_drift + link_missing alongside pass', async () => {
    const spec = `
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
links:
  - url: "https://example.org/leader-guide"
    label: "Leader Guide"
`;
    await writeFile(join(root, 'docs', 'source-specs', '1-9-leader-directory.md'), buildSpecMd(spec));
    await writeFile(join(root, 'rt-templates', 'leader-directory.pdf'), 'fake-bytes');
    const mockText = 'LEADER DIRECTORY\nFull Name Phone\n';
    await seedRegistry(root, 'rt-templates/leader-directory.pdf', mockText);
    // Site emits an invented h2 AND does not include the spec's link.
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      [
        `<PlanForm source="docs/source-specs/1-9-leader-directory.md" />`,
        `<h1>Leader Directory</h1>`,
        `<h2>Completely Invented Heading</h2>`,
      ].join('\n'),
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(mockText) },
    });

    // Primary diff entry passes; day-5 checks surface the two fidelity breaks.
    const statuses = result.entries.map((e) => e.status).sort();
    expect(statuses).toContain('pass');
    expect(statuses).toContain('title_drift');
    expect(statuses).toContain('link_missing');
    expect(result.exitCode).toBe(1);
  });

  it('link_type_mismatch escalates to exit 1', async () => {
    const spec = `
module: "1-5"
template: "deployment"
title: "Deployment"
citation:
  source: "rt-templates/deployment.pdf"
  page: "1"
fields:
  - key: "phase"
    label: "Phase"
    type: "text"
links:
  - url: "/modules/emergency-preparedness/1-5"
    kind: "internal_route"
    label: "Module 1-5"
`;
    await writeFile(join(root, 'docs', 'source-specs', '1-5.md'), buildSpecMd(spec));
    await writeFile(join(root, 'rt-templates', 'deployment.pdf'), 'fake');
    const mockText = 'DEPLOYMENT\nPhase\n';
    await seedRegistry(root, 'rt-templates/deployment.pdf', mockText);
    await writeFile(
      join(root, 'src', 'pages', '1-5.astro'),
      [
        `<PlanForm source="docs/source-specs/1-5.md" />`,
        `<h1>Deployment</h1>`,
        `<p><a href="https://drive.google.com/file/d/14BP-QH2d.html#5">1.5</a></p>`,
      ].join('\n'),
    );

    const result = await runVerify({
      projectRoot: root,
      selector: { kind: 'all' },
      saveCache: false,
      extractOptions: { exec: mockExec(mockText) },
    });
    expect(result.entries.some((e) => e.status === 'link_type_mismatch')).toBe(true);
    expect(result.exitCode).toBe(1);
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
      // Day-5 taxonomy additions.
      'link_drift',
      'link_missing',
      'link_type_mismatch',
      'title_drift',
      'structural_fidelity_failed',
      'key_drift',
      'prose_drift',
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
