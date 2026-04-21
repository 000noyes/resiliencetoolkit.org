import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parsePageRange,
  extractWithPdftotext,
  extractWithVision,
  extract,
  ExtractionError,
  type ExecFn,
} from './extract';
import type { ExtractionCache } from './schemas';

function mockExec(stdout: string): ExecFn {
  return vi.fn(async () => ({ stdout, stderr: '' }));
}

function failingExec(message: string): ExecFn {
  return vi.fn(async () => {
    throw new Error(message);
  });
}

describe('extract: parsePageRange', () => {
  it('undefined → empty', () => {
    expect(parsePageRange(undefined)).toEqual({});
  });

  it('single page "14" → first=14, last=14', () => {
    expect(parsePageRange('14')).toEqual({ first: 14, last: 14 });
  });

  it('range "14-15" → first=14, last=15', () => {
    expect(parsePageRange('14-15')).toEqual({ first: 14, last: 15 });
  });

  it('whitespace tolerated', () => {
    expect(parsePageRange('  14-15  ')).toEqual({ first: 14, last: 15 });
  });

  it('invalid format throws ExtractionError(extract_failed)', () => {
    expect(() => parsePageRange('abc')).toThrow(ExtractionError);
    expect(() => parsePageRange('14-')).toThrow(ExtractionError);
    try { parsePageRange('abc'); } catch (e) {
      expect((e as ExtractionError).status).toBe('extract_failed');
    }
  });

  it('reversed range throws', () => {
    expect(() => parsePageRange('15-14')).toThrow(ExtractionError);
  });

  it('"0" rejected — pdftotext pages are 1-indexed', () => {
    expect(() => parsePageRange('0')).toThrow(ExtractionError);
    try { parsePageRange('0'); } catch (e) {
      expect((e as ExtractionError).status).toBe('extract_failed');
      expect((e as Error).message).toMatch(/1-indexed/);
    }
  });

  it('"0-5" rejected', () => {
    expect(() => parsePageRange('0-5')).toThrow(ExtractionError);
  });
});

describe('extract: extractWithPdftotext', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-extract-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('missing source → ExtractionError(source_not_found)', async () => {
    await expect(
      extractWithPdftotext(join(tmp, 'nope.pdf'), '1', { exec: mockExec('ignored') }),
    ).rejects.toMatchObject({ status: 'source_not_found' });
  });

  it('calls exec with correct args for single page', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec('extracted text');
    await extractWithPdftotext(path, '14', { exec });
    expect(exec).toHaveBeenCalledWith(
      'pdftotext',
      ['-layout', '-f', '14', '-l', '14', path, '-'],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  });

  it('calls exec with correct args for range', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec('out');
    await extractWithPdftotext(path, '14-15', { exec });
    expect(exec).toHaveBeenCalledWith(
      'pdftotext',
      ['-layout', '-f', '14', '-l', '15', path, '-'],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  });

  it('no page → no -f/-l flags', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec('out');
    await extractWithPdftotext(path, undefined, { exec });
    expect(exec).toHaveBeenCalledWith(
      'pdftotext',
      ['-layout', path, '-'],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  });

  it('exec failure → ExtractionError(extract_failed)', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    await expect(
      extractWithPdftotext(path, '1', { exec: failingExec('command not found') }),
    ).rejects.toMatchObject({ status: 'extract_failed' });
  });

  it('exec failure preserves stderr in error message', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const execWithStderr: ExecFn = vi.fn(async () => {
      const err = new Error('Command failed: pdftotext') as Error & { stderr: string };
      err.stderr = 'Syntax Error: Couldn\'t find trailer dictionary';
      throw err;
    });
    try {
      await extractWithPdftotext(path, '1', { exec: execWithStderr });
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('stderr');
      expect((e as Error).message).toContain('trailer dictionary');
    }
  });

  it('respects custom pdftotextBin', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec('out');
    await extractWithPdftotext(path, '1', { exec, pdftotextBin: '/custom/pdftotext' });
    expect(exec).toHaveBeenCalledWith('/custom/pdftotext', expect.any(Array), expect.any(Object));
  });
});

describe('extract: extractWithVision', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-extract-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('allowVision=false → vision_api_failed (CI safety)', async () => {
    await expect(
      extractWithVision('/any', undefined, { allowVision: false }),
    ).rejects.toMatchObject({ status: 'vision_api_failed' });
  });

  it('allowVision=true without handler → vision_api_failed', async () => {
    await expect(
      extractWithVision('/any', undefined, { allowVision: true }),
    ).rejects.toMatchObject({ status: 'vision_api_failed' });
  });

  it('missing source → source_not_found', async () => {
    await expect(
      extractWithVision(join(tmp, 'nope.pdf'), undefined, {
        allowVision: true,
        visionExtract: async () => 'ignored',
      }),
    ).rejects.toMatchObject({ status: 'source_not_found' });
  });

  it('happy path returns handler output', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    const handler = vi.fn(async () => 'vision result');
    const out = await extractWithVision(path, '14', {
      allowVision: true,
      visionExtract: handler,
    });
    expect(out).toBe('vision result');
    expect(handler).toHaveBeenCalledWith(path, '14');
  });

  it('handler throwing → vision_api_failed', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    await expect(
      extractWithVision(path, '1', {
        allowVision: true,
        visionExtract: async () => { throw new Error('timeout'); },
      }),
    ).rejects.toMatchObject({ status: 'vision_api_failed' });
  });
});

describe('extract: extract (cache-aware)', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-extract-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('fresh extraction populates cache with pdftotext method', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    const cache: ExtractionCache = { cache: {} };
    const outcome = await extract({
      absolutePath: path,
      page: '1',
      cache,
      options: { exec: mockExec('Name: John') },
    });
    expect(outcome.result.method).toBe('pdftotext');
    expect(outcome.result.text).toBe('Name: John');
    expect(outcome.fromCache).toBe(false);
    const keys = Object.keys(outcome.cache.cache);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain(':1');
  });

  it('cache hit (pdftotext) returns cached text, does not mutate cache', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    const exec = mockExec('Name: John');
    const firstCache: ExtractionCache = { cache: {} };
    const first = await extract({ absolutePath: path, page: '1', cache: firstCache, options: { exec } });
    const second = await extract({ absolutePath: path, page: '1', cache: first.cache, options: { exec } });
    expect(second.fromCache).toBe(true);
    expect(second.cache).toBe(first.cache);
    expect(second.result.text).toBe('Name: John');
  });

  it('vision-cached content preferred over pdftotext', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    const exec = mockExec('pdftotext output');
    const seed: ExtractionCache = { cache: {} };
    const firstPass = await extract({ absolutePath: path, page: '1', cache: seed, options: { exec } });
    const hash = firstPass.result.content_hash;
    const primed: ExtractionCache = {
      cache: {
        [`${hash}:1`]: {
          text: 'vision output (higher quality)',
          extracted_at: '2026-04-16T00:00:00.000Z',
          method: 'vision',
        },
      },
    };
    const result = await extract({ absolutePath: path, page: '1', cache: primed, options: { exec } });
    expect(result.result.method).toBe('vision');
    expect(result.result.text).toBe('vision output (higher quality)');
    expect(result.fromCache).toBe(true);
  });

  it('propagates ExtractionError from pdftotext failure', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    await expect(
      extract({
        absolutePath: path,
        page: '1',
        cache: { cache: {} },
        options: { exec: failingExec('pdftotext not found') },
      }),
    ).rejects.toMatchObject({ status: 'extract_failed' });
  });

  it('content_hash stable across whitespace drift in raw pdftotext output', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    const a = await extract({
      absolutePath: path,
      page: '1',
      cache: { cache: {} },
      options: { exec: mockExec('Name: John\n\n\n   \nAge: 30') },
    });
    const b = await extract({
      absolutePath: path,
      page: '1',
      cache: { cache: {} },
      options: { exec: mockExec('Name:  John\nAge: 30\n') },
    });
    expect(a.result.content_hash).toBe(b.result.content_hash);
  });

  it('H4: source_hash cache hit bypasses pdftotext entirely', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf bytes');
    const exec = vi.fn(async () => ({ stdout: 'never called', stderr: '' }));
    const seedCache = await extract({
      absolutePath: path,
      page: '1',
      cache: { cache: {} },
      options: { exec: mockExec('Leader Directory fields') },
    });
    expect(Object.values(seedCache.cache.cache)[0].source_hash).toMatch(/^[a-f0-9]{64}$/);

    const second = await extract({
      absolutePath: path,
      page: '1',
      cache: seedCache.cache,
      options: { exec },
    });
    expect(second.fromCache).toBe(true);
    expect(second.result.text).toBe('Leader Directory fields');
    expect(exec).not.toHaveBeenCalled();
  });

  it('H4: source_hash cache miss (different bytes) still runs pdftotext', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'original bytes');
    const first = await extract({
      absolutePath: path,
      page: '1',
      cache: { cache: {} },
      options: { exec: mockExec('original text') },
    });
    await writeFile(path, 'different bytes');
    const exec = vi.fn(async () => ({ stdout: 'new text', stderr: '' }));
    const second = await extract({
      absolutePath: path,
      page: '1',
      cache: first.cache,
      options: { exec },
    });
    expect(exec).toHaveBeenCalledOnce();
    expect(second.result.text).toBe('new text');
    expect(second.fromCache).toBe(false);
  });

  it('H4: source_not_found raised before source_hash computed (no readFile on missing)', async () => {
    await expect(
      extract({
        absolutePath: join(tmp, 'never-existed.pdf'),
        page: '1',
        cache: { cache: {} },
        options: { exec: failingExec('should never run') },
      }),
    ).rejects.toMatchObject({ status: 'source_not_found' });
  });

  it('H4: legacy entry without source_hash upgraded on next hit (back-compat)', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'x');
    const primed: ExtractionCache = {
      cache: {
        [`${'a'.repeat(64)}:1`]: {
          text: 'stale-keyed content',
          extracted_at: '2026-04-01T00:00:00.000Z',
          method: 'pdftotext',
        },
      },
    };
    const result = await extract({
      absolutePath: path,
      page: '1',
      cache: primed,
      options: { exec: mockExec('fresh pdftotext output') },
    });
    expect(result.result.text).toBe('fresh pdftotext output');
    expect(result.fromCache).toBe(false);
    const added = Object.values(result.cache.cache).find((e) => e.text === 'fresh pdftotext output');
    expect(added?.source_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
