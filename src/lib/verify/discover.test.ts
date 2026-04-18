import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DRIVE_ID_ERROR_MESSAGE,
  DEFAULT_ATTRIBUTE_ALLOWLIST,
  discover,
  isDriveIdCitation,
} from './discover';

// Known Drive folder ID from the RT inventory (see eng-review-verify-skill-v2).
const KNOWN_DRIVE_ID = '1JVGObcMxDX_5WxMLrVeWxR5nsIfGGwXz';

describe('discover: isDriveIdCitation', () => {
  it('flags bare Drive folder IDs', () => {
    expect(isDriveIdCitation(KNOWN_DRIVE_ID)).toBe(true);
  });

  it('flags drive.google.com URLs', () => {
    expect(isDriveIdCitation('https://drive.google.com/drive/folders/xyz')).toBe(true);
    expect(isDriveIdCitation('DRIVE.GOOGLE.COM/file/d/abc')).toBe(true);
  });

  it('allows local PDF paths', () => {
    expect(isDriveIdCitation('public/toolkit/2025 Resilience Hub.pdf')).toBe(false);
    expect(isDriveIdCitation('rt-templates/leader-directory.pdf')).toBe(false);
  });

  it('allows local YAML and MD spec paths', () => {
    expect(isDriveIdCitation('docs/source-specs/1-9-leader-directory.md')).toBe(false);
    expect(isDriveIdCitation('docs/source-specs/1-9-leader-directory.yaml')).toBe(false);
    expect(isDriveIdCitation('docs/source-specs/x.yml')).toBe(false);
  });

  it('allows any value containing a slash (path-like)', () => {
    expect(isDriveIdCitation('some/thing/that/might/not/have/extension')).toBe(false);
  });

  it('ignores empty and whitespace strings', () => {
    expect(isDriveIdCitation('')).toBe(false);
    expect(isDriveIdCitation('   ')).toBe(false);
  });

  it('does not flag strings below the Drive ID length range', () => {
    expect(isDriveIdCitation('abc123')).toBe(false);
    expect(isDriveIdCitation('a'.repeat(24))).toBe(false);
  });

  it('does not flag strings above the Drive ID length range', () => {
    expect(isDriveIdCitation('a'.repeat(45))).toBe(false);
  });

  it('flags a bare Drive file ID with mixed case (realistic shape)', () => {
    expect(isDriveIdCitation('1JVGObcMxDX_5WxMLrVeWxR5nsIfGGwXz')).toBe(true);
  });

  it('flags a 25-char id that contains an underscore', () => {
    expect(isDriveIdCitation('a'.repeat(12) + '_' + 'a'.repeat(12))).toBe(true);
  });

  it('does not flag a 40-char git commit SHA (all-lowercase hex, no underscore)', () => {
    expect(isDriveIdCitation('a1b2c3d4e5f67890abcdef1234567890abcdef12')).toBe(false);
  });

  it('does not flag a 36-char lowercase UUID with dashes', () => {
    expect(isDriveIdCitation('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('does not flag a monocase run without underscore', () => {
    expect(isDriveIdCitation('a'.repeat(30))).toBe(false);
    expect(isDriveIdCitation('A'.repeat(30))).toBe(false);
  });
});

describe('discover: end-to-end against a temp project', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'verify-discover-'));
    await mkdir(join(root, 'src', 'pages'), { recursive: true });
    await mkdir(join(root, 'src', 'components'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('discovers no citations in an empty project', async () => {
    const { citations, violations } = await discover({ projectRoot: root });
    expect(citations).toEqual([]);
    expect(violations).toEqual([]);
  });

  it('extracts a source attribute citation from a wired component in pages', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      [
        '---',
        'const spec = await loadSpec("1-9-leader-directory");',
        '---',
        '<PlanForm',
        '  moduleKey="1-9"',
        '  source="docs/source-specs/1-9-leader-directory.md"',
        '/>',
      ].join('\n'),
    );
    const { citations, violations } = await discover({ projectRoot: root });
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      file: 'src/pages/1-9.astro',
      source: 'docs/source-specs/1-9-leader-directory.md',
      kind: 'attr',
    });
    expect(citations[0].line).toBeGreaterThan(0);
    // The JSX text lint pass flags the hardcoded "1-9" moduleKey attribute? No — attributes
    // are NOT flagged in Phase 1; only JSX text between tags. So violations should reflect
    // only the lint pass output, which on this file is empty (no JSX text between tags).
    expect(violations).toEqual([]);
  });

  it('extracts an expression-form literal citation', async () => {
    await writeFile(
      join(root, 'src', 'components', 'Card.tsx'),
      [
        'export function Card() {',
        '  return <Foo source={"rt-templates/leader-directory.pdf"} page={"14-15"} />;',
        '}',
      ].join('\n'),
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      source: 'rt-templates/leader-directory.pdf',
      page: '14-15',
      kind: 'attr-expr',
    });
  });

  it('extracts a JSX comment citation', async () => {
    await writeFile(
      join(root, 'src', 'components', 'Form.tsx'),
      [
        'export function Form() {',
        '  return (',
        '    <div>',
        '      {/* source: docs/source-specs/1-1-household.md page: 8-10 */}',
        '      <PlanForm />',
        '    </div>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      source: 'docs/source-specs/1-1-household.md',
      page: '8-10',
      kind: 'jsx-comment',
    });
  });

  it('extracts an HTML comment citation from an astro file', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-1.astro'),
      [
        '<!-- source: docs/source-specs/1-1-household.md page: 8 -->',
        '<article>Body</article>',
      ].join('\n'),
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      source: 'docs/source-specs/1-1-household.md',
      page: '8',
      kind: 'html-comment',
    });
  });

  it('flags a Drive-ID citation with the locked error message and taxonomy status', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-9.astro'),
      [
        '---',
        'const x = 1;',
        '---',
        `<PlanForm source="${KNOWN_DRIVE_ID}" />`,
      ].join('\n'),
    );
    const { citations, violations } = await discover({ projectRoot: root });
    expect(citations).toEqual([]);
    expect(violations).toHaveLength(1);
    expect(violations[0].status).toBe('drive_id_not_allowed');
    expect(violations[0].source).toBe(KNOWN_DRIVE_ID);
    expect(violations[0].message).toBe(DRIVE_ID_ERROR_MESSAGE);
    expect(violations[0].file).toBe('src/pages/1-9.astro');
  });

  it('flags a drive.google.com URL citation', async () => {
    await writeFile(
      join(root, 'src', 'components', 'X.tsx'),
      `export const X = () => <Foo source="https://drive.google.com/drive/folders/abc" />;`,
    );
    const { violations } = await discover({ projectRoot: root });
    expect(violations).toHaveLength(1);
    expect(violations[0].status).toBe('drive_id_not_allowed');
  });

  it('emits Phase 1 lint: JSX text in a loadSpec-importing file', async () => {
    await writeFile(
      join(root, 'src', 'components', 'Wired.tsx'),
      [
        'import { loadSpec } from "@/lib/verify/schemas";',
        'export function Wired() {',
        '  const spec = loadSpec("x");',
        '  return (',
        '    <section>',
        '      <h1>Emergency Kit</h1>',
        '      <label>Full Name</label>',
        '    </section>',
        '  );',
        '}',
      ].join('\n'),
    );
    const { violations } = await discover({ projectRoot: root });
    const msgs = violations.map((v) => v.message ?? '');
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(msgs.some((m) => /Emergency Kit/.test(m))).toBe(true);
    expect(msgs.some((m) => /Full Name/.test(m))).toBe(true);
    for (const v of violations) {
      expect(v.status).toBe('needs_human_review');
    }
  });

  it('does NOT emit lint in a file that does not import loadSpec', async () => {
    await writeFile(
      join(root, 'src', 'components', 'Static.tsx'),
      [
        'export function Static() {',
        '  return <h1>Static Title</h1>;',
        '}',
      ].join('\n'),
    );
    const { violations } = await discover({ projectRoot: root });
    expect(violations).toEqual([]);
  });

  it('lint allowlist is exposed and matches locked spec', () => {
    expect(DEFAULT_ATTRIBUTE_ALLOWLIST.has('aria-label')).toBe(true);
    expect(DEFAULT_ATTRIBUTE_ALLOWLIST.has('placeholder')).toBe(true);
    expect(DEFAULT_ATTRIBUTE_ALLOWLIST.has('data-testid')).toBe(true);
    expect(DEFAULT_ATTRIBUTE_ALLOWLIST.has('title')).toBe(true);
    expect(DEFAULT_ATTRIBUTE_ALLOWLIST.size).toBe(4);
  });

  it('skips test files, .d.ts, node_modules, and dot-directories', async () => {
    await writeFile(
      join(root, 'src', 'components', 'Real.tsx'),
      `export const R = () => <Foo source="${KNOWN_DRIVE_ID}" />;`,
    );
    await writeFile(
      join(root, 'src', 'components', 'Real.test.tsx'),
      `it("t", () => { const x = "${KNOWN_DRIVE_ID}"; return <Foo source={x} />; });`,
    );
    await writeFile(
      join(root, 'src', 'components', 'types.d.ts'),
      `export type Q = { source: "${KNOWN_DRIVE_ID}" };`,
    );
    await mkdir(join(root, 'src', 'components', 'node_modules'), { recursive: true });
    await writeFile(
      join(root, 'src', 'components', 'node_modules', 'foo.tsx'),
      `export const F = () => <Foo source="${KNOWN_DRIVE_ID}" />;`,
    );
    await mkdir(join(root, 'src', 'components', '.cache'), { recursive: true });
    await writeFile(
      join(root, 'src', 'components', '.cache', 'inner.tsx'),
      `export const I = () => <Foo source="${KNOWN_DRIVE_ID}" />;`,
    );
    const { violations } = await discover({ projectRoot: root });
    // Only Real.tsx should be scanned.
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('src/components/Real.tsx');
  });

  it('scans both src/pages and src/components by default', async () => {
    await writeFile(
      join(root, 'src', 'pages', 'p.astro'),
      `<PlanForm source="docs/source-specs/a.md" />`,
    );
    await writeFile(
      join(root, 'src', 'components', 'C.tsx'),
      `export const C = () => <PlanForm source="docs/source-specs/b.md" />;`,
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations.map((c) => c.file).sort()).toEqual([
      'src/components/C.tsx',
      'src/pages/p.astro',
    ]);
  });

  it('respects a custom includeDirs override', async () => {
    await mkdir(join(root, 'custom'), { recursive: true });
    await writeFile(
      join(root, 'custom', 'x.tsx'),
      `export const X = () => <Foo source="docs/source-specs/x.md" />;`,
    );
    const { citations } = await discover({
      projectRoot: root,
      includeDirs: ['custom'],
    });
    expect(citations).toHaveLength(1);
    expect(citations[0].file).toBe('custom/x.tsx');
  });

  it('skips silently when a configured include dir does not exist', async () => {
    const { citations, violations } = await discover({
      projectRoot: root,
      includeDirs: ['src/pages', 'does-not-exist'],
    });
    expect(citations).toEqual([]);
    expect(violations).toEqual([]);
  });

  it('rejects includeDirs entries that resolve above projectRoot (path escape)', async () => {
    // Relative-path escape.
    await expect(
      discover({ projectRoot: root, includeDirs: ['../escape'] }),
    ).rejects.toThrow(/outside projectRoot/);
    // Double-dot deep escape.
    await expect(
      discover({ projectRoot: root, includeDirs: ['../../escape'] }),
    ).rejects.toThrow(/outside projectRoot/);
  });

  it('rejects includeDirs entries with absolute paths outside projectRoot', async () => {
    // Absolute path that is not projectRoot.
    await expect(
      discover({ projectRoot: root, includeDirs: ['/etc'] }),
    ).rejects.toThrow(/outside projectRoot/);
  });

  it('returns deterministic, sorted file ordering for multiple hits', async () => {
    await writeFile(
      join(root, 'src', 'pages', 'b.astro'),
      `<Foo source="docs/source-specs/b.md" />`,
    );
    await writeFile(
      join(root, 'src', 'pages', 'a.astro'),
      `<Foo source="docs/source-specs/a.md" />`,
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations.map((c) => c.file)).toEqual([
      'src/pages/a.astro',
      'src/pages/b.astro',
    ]);
  });

  it('reports 1-indexed line numbers', async () => {
    await writeFile(
      join(root, 'src', 'pages', 'x.astro'),
      '\n\n\n<PlanForm source="docs/source-specs/x.md" />',
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations[0].line).toBe(4);
  });

  it('discover result violations carry only taxonomy statuses', async () => {
    const allowedStatuses = new Set([
      'pass',
      'missing_citation',
      'source_not_found',
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
      [
        'import { loadSpec } from "@/lib/verify/schemas";',
        `<PlanForm source="${KNOWN_DRIVE_ID}" />`,
        '<h1>Hardcoded Heading</h1>',
      ].join('\n'),
    );
    const { violations } = await discover({ projectRoot: root });
    expect(violations.length).toBeGreaterThanOrEqual(2);
    for (const v of violations) {
      expect(allowedStatuses.has(v.status)).toBe(true);
    }
  });

  it('dedupes identical citations emitted by overlapping regexes', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-1.astro'),
      '<PlanForm source="docs/source-specs/x.md" />',
    );
    const { citations } = await discover({ projectRoot: root });
    expect(citations).toHaveLength(1);
  });

  it('emits missing_citation when a component has page= without source=', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-5.astro'),
      '<PlanForm page="14-15" />',
    );
    const { citations, violations } = await discover({ projectRoot: root });
    expect(citations).toHaveLength(0);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: 'src/pages/1-5.astro',
      status: 'missing_citation',
    });
    expect(violations[0].message).toMatch(/page=/);
  });

  it('does not synthesize a missing_citation when the tag has neither source nor page', async () => {
    await writeFile(
      join(root, 'src', 'pages', '1-6.astro'),
      '<Header title="Welcome" />',
    );
    const { violations } = await discover({ projectRoot: root });
    expect(violations).toHaveLength(0);
  });
});

describe('discover: readdir error handling (fail-closed)', () => {
  it('silently skips ENOENT (missing include dir) but propagates other codes', async () => {
    // This exercises the ENOENT-only catch by pointing discover at a path that
    // does not exist on disk; discover should return {citations:[], violations:[]}
    // without throwing.
    const missing = join(tmpdir(), `verify-discover-missing-${Date.now()}`);
    const { citations, violations } = await discover({
      projectRoot: missing,
      includeDirs: ['src/pages', 'src/components'],
    });
    expect(citations).toEqual([]);
    expect(violations).toEqual([]);
  });
});
