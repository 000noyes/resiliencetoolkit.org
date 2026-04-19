import { describe, it, expect, vi } from 'vitest';

import { main, parseAccuracyCli } from '../../scripts/measure-extraction-accuracy';
import {
  AccuracyError,
  type RunAccuracyOptions,
  type RunAccuracyResult,
} from '../../src/lib/verify/accuracy';

describe('measure-extraction-accuracy: parseAccuracyCli', () => {
  it('parses paired --spec/--template arguments', () => {
    const v = parseAccuracyCli([
      '--spec', 'docs/source-specs/leader-directory-draft.md',
      '--template', 'leader-directory',
      '--spec', 'docs/source-specs/neighbor-directory-draft.md',
      '--template', 'neighbor-directory',
      '--out', 'custom.yaml',
    ]);
    expect(v.inputs).toEqual([
      { template: 'leader-directory', specPath: 'docs/source-specs/leader-directory-draft.md' },
      { template: 'neighbor-directory', specPath: 'docs/source-specs/neighbor-directory-draft.md' },
    ]);
    expect(v.out).toBe('custom.yaml');
  });

  it('throws when --spec is missing', () => {
    expect(() => parseAccuracyCli([])).toThrow(/--spec is required/);
  });

  it('throws when spec/template counts do not match', () => {
    expect(() =>
      parseAccuracyCli([
        '--spec', 'a.md',
        '--spec', 'b.md',
        '--template', 'only-one',
      ]),
    ).toThrow(/paired with a --template/);
  });
});

describe('measure-extraction-accuracy: main', () => {
  const okResult: RunAccuracyResult = {
    outcomes: [
      {
        template: 'leader-directory',
        specPath: 'docs/source-specs/leader-directory-draft.md',
        pdf: 'rt-templates/leader-directory.pdf',
        metrics: {
          precision: 0.8,
          recall: 1.0,
          true_positives: 5,
          false_positives: 1,
          false_negatives: 0,
          expected_field_count: 5,
          extracted_candidate_count: 6,
        },
        measured_at: '2026-04-18T21:30:00.000Z',
      },
    ],
    outAbsolutePath: '/abs/docs/source-specs/_accuracy-baseline.yaml',
    outRelPath: 'docs/source-specs/_accuracy-baseline.yaml',
    yaml: '# baseline\nbaselines:\n  leader-directory:\n    recall: 1.0\n',
    cacheSaved: true,
    meetsThreshold: true,
  };

  function mockRunner(result: RunAccuracyResult | Error) {
    if (result instanceof Error) {
      return vi.fn<(opts: RunAccuracyOptions) => Promise<RunAccuracyResult>>(async () => {
        throw result;
      });
    }
    return vi.fn<(opts: RunAccuracyOptions) => Promise<RunAccuracyResult>>(async () => result);
  }

  it('returns 0 on threshold-passing measurement, forwards spec pairs', async () => {
    const runner = mockRunner(okResult);
    const code = await main({
      argv: [
        '--spec', 'docs/source-specs/leader-directory-draft.md',
        '--template', 'leader-directory',
      ],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(0);
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/abs',
        inputs: [
          {
            template: 'leader-directory',
            specPath: 'docs/source-specs/leader-directory-draft.md',
          },
        ],
      }),
    );
  });

  it('returns 1 when any template falls below the recall threshold', async () => {
    const belowThreshold: RunAccuracyResult = { ...okResult, meetsThreshold: false };
    const runner = mockRunner(belowThreshold);
    const code = await main({
      argv: [
        '--spec', 'docs/source-specs/low.md',
        '--template', 'low-recall',
      ],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(1);
  });

  it('returns 2 when CLI args are malformed', async () => {
    const runner = mockRunner(okResult);
    const code = await main({ argv: [], cwd: '/abs', runner });
    expect(code).toBe(2);
    expect(runner).not.toHaveBeenCalled();
  });

  it('returns 1 on AccuracyError with non-infra status', async () => {
    const err = new AccuracyError('missing pdf', 'source_not_found');
    const runner = mockRunner(err);
    const code = await main({
      argv: [
        '--spec', 'a.md',
        '--template', 'x',
      ],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(1);
  });

  it('returns 2 on AccuracyError(cache_corrupted)', async () => {
    const err = new AccuracyError('quarantined', 'cache_corrupted');
    const runner = mockRunner(err);
    const code = await main({
      argv: [
        '--spec', 'a.md',
        '--template', 'x',
      ],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(2);
  });

  it('returns 2 on unexpected exceptions', async () => {
    const runner = mockRunner(new Error('boom'));
    const code = await main({
      argv: [
        '--spec', 'a.md',
        '--template', 'x',
      ],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(2);
  });

  it('M5: returns 2 on AccuracyError(extract_failed) with ENOENT (pdftotext missing)', async () => {
    const err = new AccuracyError('pdftotext failed: ENOENT', 'extract_failed', 'ENOENT');
    const runner = mockRunner(err);
    const code = await main({
      argv: ['--spec', 'a.md', '--template', 'x'],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(2);
  });

  it('M5: returns 1 on AccuracyError(extract_failed) without infra code', async () => {
    const err = new AccuracyError('pdftotext exited nonzero on bad pdf', 'extract_failed');
    const runner = mockRunner(err);
    const code = await main({
      argv: ['--spec', 'a.md', '--template', 'x'],
      cwd: '/abs',
      runner,
    });
    expect(code).toBe(1);
  });

  it('passes --out through to the runner as outRelPath', async () => {
    const runner = mockRunner(okResult);
    await main({
      argv: [
        '--spec', 'a.md',
        '--template', 'x',
        '--out', 'custom/baseline.yaml',
      ],
      cwd: '/abs',
      runner,
    });
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ outRelPath: 'custom/baseline.yaml' }),
    );
  });
});
