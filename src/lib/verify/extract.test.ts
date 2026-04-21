import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parsePageRange,
  extractWithPdftotext,
  extractWithPdftohtml,
  extractLinks,
  extractWithVision,
  extract,
  ExtractionError,
  parseLinksFromPdftohtml,
  type ExecFn,
  type ExtractedLink,
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

describe('extract: parseLinksFromPdftohtml (pure parser)', () => {
  it('extracts anchor href + decoded text from a simple link', () => {
    const html = '<p><a href="https://drive.google.com/drive/folders/ABC">&#160;Create&#160;a&#160;directory&#160;</a></p>';
    const links = parseLinksFromPdftohtml(html, 32);
    expect(links).toEqual([
      { url: 'https://drive.google.com/drive/folders/ABC', page: 32, anchor_text: 'Create a directory' },
    ]);
  });

  it('skips empty-href anchors (e.g., <a name="1">, <a href="">)', () => {
    const html =
      '<a name="1"></a>' +
      '<a href="">&#160;Section&#160;1.8&#160;</a>' +
      '<a href="https://x.test/">x</a>';
    const links = parseLinksFromPdftohtml(html, 1);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://x.test/');
  });

  it('handles multiple links on one page, preserving order', () => {
    const html =
      '<a href="https://a.test/">first</a><a href="https://b.test/">second</a><a href="https://c.test/">third</a>';
    const links = parseLinksFromPdftohtml(html, 5);
    expect(links.map((l) => l.url)).toEqual(['https://a.test/', 'https://b.test/', 'https://c.test/']);
    expect(links.every((l) => l.page === 5)).toBe(true);
  });

  it('strips nested tags from anchor_text and collapses whitespace', () => {
    const html = '<a href="https://docs.test/"><b>&#160;situation&#160;</b><br/>reports</a>';
    const links = parseLinksFromPdftohtml(html, 1);
    expect(links[0].anchor_text).toBe('situation reports');
  });

  it('omits anchor_text field when inner text is empty (e.g., nbsp-only)', () => {
    const html = '<a href="https://drive.test/folder">&#160;</a>';
    const links = parseLinksFromPdftohtml(html, 1);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://drive.test/folder');
    expect(links[0].anchor_text).toBeUndefined();
  });

  it('handles multi-line anchors (dotall across <br/> and newlines)', () => {
    const html =
      '<a href="https://drive.test/preparedness">&#160;information&#160;<br/>\n&#160;about&#160;preparedness</a>';
    const links = parseLinksFromPdftohtml(html, 1);
    expect(links).toHaveLength(1);
    expect(links[0].anchor_text).toBe('information about preparedness');
  });

  it('decodes numeric entities and common named entities', () => {
    const html = '<a href="https://x.test/q?a=1&amp;b=2">Tools &amp; Resources</a>';
    const links = parseLinksFromPdftohtml(html, 1);
    expect(links[0].anchor_text).toBe('Tools & Resources');
    expect(links[0].url).toBe('https://x.test/q?a=1&amp;b=2');
  });
});

describe('extract: extractWithPdftohtml', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-extract-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  const FAKE_PDFTOHTML_OUT = `<!DOCTYPE html><html><body>
<!-- Page 32 -->
<a name="32"></a>
<p><a href="https://drive.google.com/drive/folders/1ZP8p">&#160;1.9&#160;Community&#160;response&#160;</a></p>
<p><a href="https://docs.google.com/document/d/1p7E">&#160;situation&#160;reports&#160;</a></p>
</body></html>`;

  it('missing source → ExtractionError(source_not_found)', async () => {
    await expect(
      extractWithPdftohtml(join(tmp, 'nope.pdf'), 1, { exec: mockExec(FAKE_PDFTOHTML_OUT) }),
    ).rejects.toMatchObject({ status: 'source_not_found' });
  });

  it('rejects pageNum < 1 with extract_failed', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    await expect(
      extractWithPdftohtml(path, 0, { exec: mockExec(FAKE_PDFTOHTML_OUT) }),
    ).rejects.toMatchObject({ status: 'extract_failed' });
  });

  it('calls exec with correct args (-s -i -stdout -f N -l N)', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec(FAKE_PDFTOHTML_OUT);
    await extractWithPdftohtml(path, 32, { exec });
    expect(exec).toHaveBeenCalledWith(
      'pdftohtml',
      ['-s', '-i', '-stdout', '-f', '32', '-l', '32', path, '-'],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  });

  it('parses links with correct page number attached', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const links = await extractWithPdftohtml(path, 32, { exec: mockExec(FAKE_PDFTOHTML_OUT) });
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      url: 'https://drive.google.com/drive/folders/1ZP8p',
      page: 32,
      anchor_text: '1.9 Community response',
    });
    expect(links[1].url).toBe('https://docs.google.com/document/d/1p7E');
    expect(links.every((l) => l.page === 32)).toBe(true);
  });

  it('exec failure → ExtractionError(extract_failed)', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    await expect(
      extractWithPdftohtml(path, 1, { exec: failingExec('pdftohtml: command not found') }),
    ).rejects.toMatchObject({ status: 'extract_failed' });
  });

  it('exec failure preserves stderr in error message', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const execWithStderr: ExecFn = vi.fn(async () => {
      const err = new Error('Command failed: pdftohtml') as Error & { stderr: string };
      err.stderr = 'Syntax Error: page range out of bounds';
      throw err;
    });
    try {
      await extractWithPdftohtml(path, 999, { exec: execWithStderr });
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('stderr');
      expect((e as Error).message).toContain('page range');
    }
  });

  it('respects custom pdftohtmlBin', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec(FAKE_PDFTOHTML_OUT);
    await extractWithPdftohtml(path, 1, { exec, pdftohtmlBin: '/custom/pdftohtml' });
    expect(exec).toHaveBeenCalledWith('/custom/pdftohtml', expect.any(Array), expect.any(Object));
  });

  it('empty page returns empty link array, not error', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const emptyHtml = '<!DOCTYPE html><html><body><!-- Page 1 --><a name="1"></a><p>no links here</p></body></html>';
    const links = await extractWithPdftohtml(path, 1, { exec: mockExec(emptyHtml) });
    expect(links).toEqual([]);
  });
});

describe('extract: extractLinks (page-range aware)', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-extract-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('undefined page → rejects with extract_failed', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    await expect(
      extractLinks(path, undefined, { exec: mockExec('<html></html>') }),
    ).rejects.toMatchObject({ status: 'extract_failed' });
  });

  it('single page "14" calls pdftohtml once for page 14', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec = mockExec('<a href="https://x.test/">x</a>');
    const links = await extractLinks(path, '14', { exec });
    expect(exec).toHaveBeenCalledTimes(1);
    expect(links).toHaveLength(1);
    expect(links[0].page).toBe(14);
  });

  it('range "14-16" calls pdftohtml once per page and tags each link with its page', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const exec: ExecFn = vi.fn(async (_bin: string, args: readonly string[]) => {
      const pageIdx = args.findIndex((a: string) => a === '-f');
      const pageNum = Number(args[pageIdx + 1]);
      return { stdout: `<a href="https://p${pageNum}.test/">link on ${pageNum}</a>`, stderr: '' };
    });
    const links = await extractLinks(path, '14-16', { exec });
    expect(exec).toHaveBeenCalledTimes(3);
    expect(links.map((l) => l.page)).toEqual([14, 15, 16]);
    expect(links.map((l) => l.url)).toEqual([
      'https://p14.test/',
      'https://p15.test/',
      'https://p16.test/',
    ]);
  });

  it('propagates ExtractionError from first failing page and does not call subsequent pages', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    let callCount = 0;
    const exec: ExecFn = vi.fn(async () => {
      callCount += 1;
      if (callCount === 2) throw new Error('pdftohtml crashed');
      return { stdout: '<a href="https://x.test/">x</a>', stderr: '' };
    });
    await expect(extractLinks(path, '14-16', { exec })).rejects.toMatchObject({
      status: 'extract_failed',
    });
    expect(callCount).toBe(2);
  });

  it('missing source throws source_not_found without calling exec', async () => {
    const exec = vi.fn(async () => ({ stdout: '', stderr: '' }));
    await expect(
      extractLinks(join(tmp, 'nope.pdf'), '1', { exec }),
    ).rejects.toMatchObject({ status: 'source_not_found' });
    expect(exec).not.toHaveBeenCalled();
  });

  it('ExtractedLink shape is narrow and JSON-safe', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'fake pdf');
    const links = await extractLinks(path, '1', {
      exec: mockExec('<a href="https://x.test/">some text</a>'),
    });
    const roundTripped: ExtractedLink[] = JSON.parse(JSON.stringify(links));
    expect(roundTripped).toEqual(links);
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
