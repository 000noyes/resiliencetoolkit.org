import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parseCli,
  makeSelector,
  defaultReportPath,
  main,
} from '../../scripts/verify-against-source';
import type { RunVerifyResult } from '../../src/lib/verify/runner';

describe('cli: parseCli', () => {
  it('parses --target', () => {
    expect(parseCli(['--target', 'src/pages/1-9.astro'])).toEqual({
      target: 'src/pages/1-9.astro',
    });
  });

  it('parses --all', () => {
    expect(parseCli(['--all'])).toEqual({ all: true });
  });

  it('parses --since main', () => {
    expect(parseCli(['--since', 'main'])).toEqual({ since: 'main' });
  });

  it('parses --report and --fail-on-needs-review together', () => {
    const v = parseCli([
      '--all',
      '--report',
      '/tmp/r.jsonl',
      '--fail-on-needs-review',
    ]);
    expect(v.all).toBe(true);
    expect(v.report).toBe('/tmp/r.jsonl');
    expect(v['fail-on-needs-review']).toBe(true);
  });
});

describe('cli: makeSelector', () => {
  it('defaults to all when nothing specified', () => {
    expect(makeSelector({})).toEqual({ kind: 'all' });
  });

  it('builds a target selector from --target', () => {
    expect(makeSelector({ target: 'src/pages/x.astro' })).toEqual({
      kind: 'target',
      pattern: 'src/pages/x.astro',
    });
  });

  it('builds a since selector from --since', () => {
    expect(makeSelector({ since: 'main' })).toEqual({
      kind: 'since',
      ref: 'main',
    });
  });

  it('builds an all selector when --all is set explicitly', () => {
    expect(makeSelector({ all: true })).toEqual({ kind: 'all' });
  });

  it('rejects combined selectors (target + all)', () => {
    expect(() =>
      makeSelector({ target: 'x', all: true }),
    ).toThrow(/exactly one of/);
  });

  it('rejects combined selectors (target + since)', () => {
    expect(() =>
      makeSelector({ target: 'x', since: 'main' }),
    ).toThrow(/exactly one of/);
  });

  it('rejects all three selectors', () => {
    expect(() =>
      makeSelector({ target: 'x', all: true, since: 'main' }),
    ).toThrow(/exactly one of/);
  });
});

describe('cli: defaultReportPath', () => {
  it('points into ~/.gstack/projects/resiliencetoolkit-org/verify-reports with an ISO stamp', () => {
    const p = defaultReportPath();
    expect(p).toMatch(
      /\.gstack\/projects\/resiliencetoolkit-org\/verify-reports\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jsonl$/,
    );
  });
});

describe('cli: main (with mocked runner)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'verify-cli-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  function mockRunner(result: RunVerifyResult) {
    return vi.fn(async () => result);
  }

  it('writes JSONL report and returns exit code 0 for a passing run', async () => {
    const reportPath = join(tmp, 'r.jsonl');
    const runner = mockRunner({
      entries: [
        { file: 'src/pages/x.astro', line: 1, source: 'a.md', status: 'pass' },
      ],
      exitCode: 0,
      cacheSaved: true,
    });
    const code = await main({
      argv: ['--all', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    expect(code).toBe(0);
    const body = await readFile(reportPath, 'utf-8');
    expect(body.trim().split('\n')).toHaveLength(1);
    const parsed = JSON.parse(body.trim().split('\n')[0]);
    expect(parsed.status).toBe('pass');
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ selector: { kind: 'all' } }),
    );
  });

  it('returns exit 1 when runner reports failure', async () => {
    const reportPath = join(tmp, 'fail.jsonl');
    const runner = mockRunner({
      entries: [
        {
          file: 'src/pages/x.astro',
          status: 'drive_id_not_allowed',
          message: 'bad',
        },
      ],
      exitCode: 1,
      cacheSaved: false,
    });
    const code = await main({
      argv: ['--all', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    expect(code).toBe(1);
  });

  it('returns exit 2 when runner reports cache_corrupted', async () => {
    const reportPath = join(tmp, 'infra.jsonl');
    const runner = mockRunner({
      entries: [
        {
          file: '_extraction-cache.yaml',
          status: 'cache_corrupted',
          message: 'bad',
        },
      ],
      exitCode: 2,
      cacheSaved: false,
    });
    const code = await main({
      argv: ['--all', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    expect(code).toBe(2);
  });

  it('passes --fail-on-needs-review through to the runner', async () => {
    const reportPath = join(tmp, 'fnrr.jsonl');
    const runner = mockRunner({
      entries: [],
      exitCode: 0,
      cacheSaved: false,
    });
    await main({
      argv: ['--all', '--fail-on-needs-review', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ failOnNeedsReview: true }),
    );
  });

  it('passes --target pattern through as a target selector', async () => {
    const reportPath = join(tmp, 't.jsonl');
    const runner = mockRunner({ entries: [], exitCode: 0, cacheSaved: false });
    await main({
      argv: ['--target', 'src/pages/1-9.astro', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        selector: { kind: 'target', pattern: 'src/pages/1-9.astro' },
      }),
    );
  });

  it('returns exit 2 when selector validation fails', async () => {
    const runner = mockRunner({ entries: [], exitCode: 0, cacheSaved: false });
    const code = await main({
      argv: ['--all', '--target', 'x'],
      cwd: tmp,
      runner,
    });
    expect(code).toBe(2);
    expect(runner).not.toHaveBeenCalled();
  });

  it('writes an empty file (no trailing newline) when there are no entries', async () => {
    const reportPath = join(tmp, 'empty.jsonl');
    const runner = mockRunner({ entries: [], exitCode: 0, cacheSaved: false });
    await main({
      argv: ['--all', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    const body = await readFile(reportPath, 'utf-8');
    expect(body).toBe('');
  });

  it('creates the report directory if it does not exist', async () => {
    const reportPath = join(tmp, 'deep', 'nested', 'r.jsonl');
    const runner = mockRunner({ entries: [], exitCode: 0, cacheSaved: false });
    const code = await main({
      argv: ['--all', '--report', reportPath],
      cwd: tmp,
      runner,
    });
    expect(code).toBe(0);
    const body = await readFile(reportPath, 'utf-8');
    expect(body).toBe('');
  });
});
