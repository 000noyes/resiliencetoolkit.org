import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'js-yaml';

import {
  AccuracyError,
  RECALL_THRESHOLD,
  measureAccuracy,
  runAccuracyMeasurement,
} from './accuracy';
import { accuracyBaselineSchema, type SourceSpec } from './schemas';
import type { ExecFn } from './extract';

function specWithFields(labels: readonly string[]): SourceSpec {
  return {
    module: '1-9',
    template: 'leader-directory',
    title: 'Leader Directory',
    citation: { source: 'rt-templates/leader-directory.pdf', page: '1' },
    fields: labels.map((label, i) => ({
      key: `f-${i + 1}`,
      label,
      type: 'text' as const,
    })),
  } as SourceSpec;
}

function mockExec(stdout: string): ExecFn {
  return vi.fn(async () => ({ stdout, stderr: '' }));
}

describe('measureAccuracy: recall', () => {
  it('recall=1 when every expected label is present in the text', () => {
    const spec = specWithFields(['Name', 'Age', 'Phone']);
    const text = 'Name: Alice\nAge: 30\nPhone: 555-0100';
    const m = measureAccuracy(spec, text);
    expect(m.recall).toBe(1);
    expect(m.true_positives).toBe(3);
    expect(m.false_negatives).toBe(0);
    expect(m.expected_field_count).toBe(3);
  });

  it('recall scales linearly with how many fields appear', () => {
    const spec = specWithFields(['Name', 'Age', 'Phone', 'Email']);
    const text = 'Name: Alice\nAge: 30'; // 2/4 present
    const m = measureAccuracy(spec, text);
    expect(m.recall).toBe(0.5);
    expect(m.true_positives).toBe(2);
    expect(m.false_negatives).toBe(2);
  });

  it('recall=0 when no field labels appear', () => {
    const spec = specWithFields(['Name', 'Age']);
    const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit.';
    const m = measureAccuracy(spec, text);
    expect(m.recall).toBe(0);
    expect(m.true_positives).toBe(0);
  });

  it('recall=0 for empty spec (guards divide-by-zero)', () => {
    const spec = {
      module: '1-9',
      template: 'x',
      title: 'X',
      citation: { source: 'a.pdf' },
      fields: [{ key: 'a', label: 'A', type: 'text' }],
    } as SourceSpec;
    // Directly verify the zero-fields guard by forcing an empty fields array
    // through the flattener path — collectSpecFields returns [] when neither
    // sections nor fields are populated.
    const empty = { ...spec, fields: [] } as unknown as SourceSpec;
    const m = measureAccuracy(empty, 'any text');
    expect(m.recall).toBe(0);
    expect(m.expected_field_count).toBe(0);
  });

  it('recall respects matchThreshold override', () => {
    const spec = specWithFields(['Emergency Contact Name']);
    const text = 'Emergency Contact'; // partial match
    const strict = measureAccuracy(spec, text, { matchThreshold: 0.99 });
    const lenient = measureAccuracy(spec, text, { matchThreshold: 0.4 });
    expect(strict.recall).toBeLessThan(lenient.recall);
  });

  it('collects fields from sections when spec uses sections instead of fields', () => {
    const spec = {
      module: '1-9',
      template: 'leader-directory',
      title: 'Leader Directory',
      citation: { source: 'rt-templates/leader-directory.pdf', page: '1' },
      sections: [
        {
          key: 'contact',
          label: 'Contact',
          fields: [
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'phone', label: 'Phone', type: 'text' },
          ],
        },
      ],
    } as SourceSpec;
    const m = measureAccuracy(spec, 'Name: x\nPhone: 1');
    expect(m.expected_field_count).toBe(2);
    expect(m.recall).toBe(1);
  });
});

describe('measureAccuracy: precision', () => {
  it('precision=1 when every candidate line matches some expected field', () => {
    const spec = specWithFields(['Name', 'Age', 'Phone']);
    const text = 'Name\nAge\nPhone';
    const m = measureAccuracy(spec, text);
    expect(m.precision).toBe(1);
    expect(m.extracted_candidate_count).toBe(3);
  });

  it('precision decreases when candidate lines are dominated by boilerplate', () => {
    const spec = specWithFields(['Name']);
    const text = [
      'Resilience Hub Toolkit Template',
      'Instructions: fill out the form',
      'Community preparedness leader directory',
      'Name',
      'Rev. 2.0 — 2025 edition',
      'Page 1 of 4',
    ].join('\n');
    const m = measureAccuracy(spec, text);
    expect(m.precision).toBeLessThanOrEqual(1 / m.extracted_candidate_count + 1e-9);
    expect(m.false_positives).toBeGreaterThan(0);
  });

  it('precision=0 when candidate list is empty (e.g. all whitespace)', () => {
    const spec = specWithFields(['Name']);
    const m = measureAccuracy(spec, '   \n   \n');
    expect(m.precision).toBe(0);
    expect(m.extracted_candidate_count).toBe(0);
  });

  it('L3: candidate containing a label as substring does NOT count as a match (symmetric guard)', () => {
    // Prior asymmetric logic: bestMatchScore('phone', 'home phone fax required') → 1.0
    // Candidate counted as a match because the label was substring-inside-word-free.
    // Symmetric fix: bestMatchScore('home phone fax required', 'phone') is low, so the
    // candidate fails the reverse direction and is no longer a false positive.
    const spec = specWithFields(['Phone']);
    const m = measureAccuracy(spec, 'Home Phone Fax required');
    expect(m.precision).toBe(0);
    expect(m.false_positives).toBe(1);
  });

  it('L3: exact-label candidates still match symmetrically', () => {
    const spec = specWithFields(['Phone']);
    const m = measureAccuracy(spec, 'Phone');
    expect(m.precision).toBe(1);
    expect(m.false_positives).toBe(0);
  });
});

describe('measureAccuracy: threshold semantics', () => {
  it('a template meeting recall=1.0 clears the 0.95 locked threshold', () => {
    const spec = specWithFields(['Name', 'Phone']);
    const m = measureAccuracy(spec, 'Name\nPhone');
    expect(m.recall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
  });

  it('RECALL_THRESHOLD is pinned at 0.95 per eng-review spec', () => {
    expect(RECALL_THRESHOLD).toBe(0.95);
  });
});

describe('runAccuracyMeasurement', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'verify-accuracy-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function setupFakeSpec(template: string, fields: readonly string[]): Promise<string> {
    const specRel = `docs/source-specs/${template}-draft.md`;
    const specAbs = join(tmp, specRel);
    const spec = {
      module: '1-9',
      template,
      title: template,
      citation: { source: `rt-templates/${template}.pdf`, page: '1' },
      fields: fields.map((label, i) => ({
        key: `f-${i + 1}`,
        label,
        type: 'text',
      })),
    };
    const fm = Object.entries(spec)
      .map(([k, v]) =>
        typeof v === 'object'
          ? `${k}:\n${JSON.stringify(v, null, 2)
              .split('\n')
              .map((line) => '  ' + line)
              .join('\n')}`
          : `${k}: ${JSON.stringify(v)}`,
      )
      .join('\n');
    // Simpler YAML-via-js-yaml dump for test fidelity.
    const { dump } = await import('js-yaml');
    const content = `---\n${dump(spec)}---\n`;
    await writeFile(specAbs, content, 'utf-8');
    await writeFile(join(tmp, `rt-templates/${template}.pdf`), 'FAKE PDF BYTES');
    return specRel;
  }

  it('emits baseline YAML with precision/recall per template', async () => {
    await (async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
      await mkdir(join(tmp, 'rt-templates'), { recursive: true });
    })();
    const specPath = await setupFakeSpec('leader-directory', ['Name', 'Phone', 'Role']);

    const result = await runAccuracyMeasurement({
      projectRoot: tmp,
      inputs: [{ template: 'leader-directory', specPath }],
      extractOptions: { exec: mockExec('Name: Alice\nPhone: 555\nRole: Lead') },
      saveCache: false,
      now: () => new Date('2026-04-18T21:30:00Z'),
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].template).toBe('leader-directory');
    expect(result.outcomes[0].metrics.recall).toBe(1);
    expect(result.meetsThreshold).toBe(true);
    const written = await readFile(join(tmp, 'docs/source-specs/_accuracy-baseline.yaml'), 'utf-8');
    const parsed = accuracyBaselineSchema.parse(load(written));
    expect(parsed.baselines['leader-directory'].recall).toBe(1);
    expect(parsed.baselines['leader-directory'].measured_at).toBe('2026-04-18T21:30:00.000Z');
  });

  it('aggregates multiple templates into one baseline file', async () => {
    await (async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
      await mkdir(join(tmp, 'rt-templates'), { recursive: true });
    })();
    const leaderSpec = await setupFakeSpec('leader-directory', ['Name']);
    const neighborSpec = await setupFakeSpec('neighbor-directory', ['Address']);

    const result = await runAccuracyMeasurement({
      projectRoot: tmp,
      inputs: [
        { template: 'leader-directory', specPath: leaderSpec },
        { template: 'neighbor-directory', specPath: neighborSpec },
      ],
      extractOptions: { exec: mockExec('Name\nAddress') },
      saveCache: false,
    });

    expect(result.outcomes).toHaveLength(2);
    const templates = result.outcomes.map((o) => o.template).sort();
    expect(templates).toEqual(['leader-directory', 'neighbor-directory']);
  });

  it('throws AccuracyError(source_not_found) when cited PDF is missing', async () => {
    await (async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    })();
    // create a spec that points to a pdf that will not exist
    const specRel = 'docs/source-specs/x-draft.md';
    const { dump } = await import('js-yaml');
    await writeFile(
      join(tmp, specRel),
      `---\n${dump({
        module: '1-9',
        template: 'x',
        title: 'x',
        citation: { source: 'rt-templates/missing.pdf' },
        fields: [{ key: 'a', label: 'A', type: 'text' }],
      })}---\n`,
      'utf-8',
    );

    await expect(
      runAccuracyMeasurement({
        projectRoot: tmp,
        inputs: [{ template: 'x', specPath: specRel }],
        extractOptions: { exec: mockExec('ignored') },
        saveCache: false,
      }),
    ).rejects.toMatchObject({
      name: 'AccuracyError',
      status: 'source_not_found',
    });
  });

  it('throws AccuracyError(spec_parse_error) when spec file is malformed', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    const specRel = 'docs/source-specs/bad.md';
    await writeFile(join(tmp, specRel), 'no frontmatter here', 'utf-8');
    await expect(
      runAccuracyMeasurement({
        projectRoot: tmp,
        inputs: [{ template: 'bad', specPath: specRel }],
        extractOptions: { exec: mockExec('ignored') },
        saveCache: false,
      }),
    ).rejects.toMatchObject({
      name: 'AccuracyError',
      status: 'spec_parse_error',
    });
  });

  it('meetsThreshold=false when any template falls below 0.95 recall', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await mkdir(join(tmp, 'rt-templates'), { recursive: true });
    // spec with 5 fields — extracted text contains only 2 -> recall 0.4
    const specPath = await setupFakeSpec('low-recall-template', ['A', 'B', 'C', 'D', 'E']);
    const result = await runAccuracyMeasurement({
      projectRoot: tmp,
      inputs: [{ template: 'low-recall-template', specPath }],
      extractOptions: { exec: mockExec('A\nB\n(irrelevant)') },
      saveCache: false,
    });
    expect(result.outcomes[0].metrics.recall).toBeLessThan(RECALL_THRESHOLD);
    expect(result.meetsThreshold).toBe(false);
  });

  it('maps cache corruption to AccuracyError(cache_corrupted)', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await writeFile(
      join(tmp, 'docs/source-specs/_sources.yaml'),
      ': not valid yaml :::',
      'utf-8',
    );
    await expect(
      runAccuracyMeasurement({
        projectRoot: tmp,
        inputs: [],
        extractOptions: { exec: mockExec('ignored') },
        saveCache: false,
      }),
    ).rejects.toMatchObject({
      name: 'AccuracyError',
      status: 'cache_corrupted',
    });
  });

  it('persists extraction cache by default and skips when saveCache:false', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await mkdir(join(tmp, 'rt-templates'), { recursive: true });
    const specPath = await setupFakeSpec('leader-directory', ['Name']);

    const resultNoSave = await runAccuracyMeasurement({
      projectRoot: tmp,
      inputs: [{ template: 'leader-directory', specPath }],
      extractOptions: { exec: mockExec('Name') },
      saveCache: false,
    });
    expect(resultNoSave.cacheSaved).toBe(false);

    const resultSaved = await runAccuracyMeasurement({
      projectRoot: tmp,
      inputs: [{ template: 'leader-directory', specPath }],
      extractOptions: { exec: mockExec('Name') },
      saveCache: true,
    });
    expect(resultSaved.cacheSaved).toBe(true);
    const cachePath = join(tmp, 'docs/source-specs/_extraction-cache.yaml');
    const { access } = await import('node:fs/promises');
    await expect(access(cachePath)).resolves.toBeUndefined();
  });
});

describe('AccuracyError', () => {
  it('carries a taxonomy status for downstream exit-code mapping', () => {
    const e = new AccuracyError('boom', 'extract_failed');
    expect(e.status).toBe('extract_failed');
    expect(e.name).toBe('AccuracyError');
  });

  it('M5: carries an optional error code so infra errors can exit 2', () => {
    const e = new AccuracyError('pdftotext missing', 'extract_failed', 'ENOENT');
    expect(e.code).toBe('ENOENT');
  });

  it('M5: omits code when not provided (back-compat)', () => {
    const e = new AccuracyError('bad spec', 'spec_parse_error');
    expect(e.code).toBeUndefined();
  });
});

describe('runAccuracyMeasurement M5 infra-vs-content error boundary', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-accuracy-m5-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('M5: propagates pdftotext ENOENT code through AccuracyError for CLI exit-2 mapping', async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await mkdir(join(tmp, 'rt-templates'), { recursive: true });
    const specRel = 'docs/source-specs/leader-directory-draft.md';
    const { dump } = await import('js-yaml');
    await writeFile(
      join(tmp, specRel),
      `---\n${dump({
        module: '1-9',
        template: 'leader-directory',
        title: 'x',
        citation: { source: 'rt-templates/leader-directory.pdf', page: '1' },
        fields: [{ key: 'a', label: 'A', type: 'text' }],
      })}---\n`,
      'utf-8',
    );
    await writeFile(join(tmp, 'rt-templates/leader-directory.pdf'), 'FAKE PDF');
    const enoentExec = async () => {
      const err = new Error('spawn pdftotext ENOENT') as Error & { code?: string };
      err.code = 'ENOENT';
      throw err;
    };
    let thrown: unknown;
    try {
      await runAccuracyMeasurement({
        projectRoot: tmp,
        inputs: [{ template: 'leader-directory', specPath: specRel }],
        extractOptions: { exec: enoentExec },
        saveCache: false,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AccuracyError);
    expect((thrown as AccuracyError).status).toBe('extract_failed');
    expect((thrown as AccuracyError).code).toBe('ENOENT');
  });
});
