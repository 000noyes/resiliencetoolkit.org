import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';

import {
  sha256,
  normalizeForHash,
  computeContentHash,
  computeSourceHash,
  computeMetaHash,
  loadSourceRegistry,
  saveSourceRegistry,
  loadExtractionCache,
  saveExtractionCache,
  cacheKey,
  getCachedExtraction,
  setCachedExtraction,
  getSourceEntry,
  setSourceEntry,
  setSourceContentHash,
  checkSourceFreshness,
  CacheCorruptedError,
  SOURCES_YAML,
  CACHE_YAML,
} from './cache';
import { SOURCE_REGISTRY_ALL_PAGES_KEY } from './schemas';

describe('cache: hashing', () => {
  it('sha256 is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
    expect(sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('sha256 differs across inputs', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });

  it('normalizeForHash collapses whitespace, strips form feeds, filters empty lines', () => {
    const input = 'foo\f  bar   baz\n\n\n   \nqux\t\there';
    const out = normalizeForHash(input);
    expect(out).toBe('foo\nbar baz\nqux here');
  });

  it('computeContentHash is stable across whitespace variants', () => {
    const a = computeContentHash('Name: John\nAge: 30');
    const b = computeContentHash('Name:  John\n\n\n  Age:  30\n');
    const c = computeContentHash('Name:\tJohn\fAge:  30');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('computeContentHash differs when actual content differs', () => {
    expect(computeContentHash('foo')).not.toBe(computeContentHash('bar'));
  });
});

describe('cache: computeSourceHash', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-cache-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('hashes raw file bytes', async () => {
    const path = join(tmp, 'a.txt');
    await writeFile(path, 'hello');
    expect(await computeSourceHash(path)).toBe(sha256('hello'));
  });

  it('different bytes → different hash', async () => {
    const a = join(tmp, 'a.txt');
    const b = join(tmp, 'b.txt');
    await writeFile(a, 'hello');
    await writeFile(b, 'world');
    expect(await computeSourceHash(a)).not.toBe(await computeSourceHash(b));
  });
});

describe('cache: computeMetaHash', () => {
  it('is deterministic across key order', () => {
    const a = { foo: 1, bar: 2, baz: { x: 1, y: 2 } };
    const b = { baz: { y: 2, x: 1 }, bar: 2, foo: 1 };
    expect(computeMetaHash(a)).toBe(computeMetaHash(b));
  });

  it('changes when content changes', () => {
    expect(computeMetaHash({ foo: 1 })).not.toBe(computeMetaHash({ foo: 2 }));
  });

  it('distinguishes nested differences', () => {
    expect(computeMetaHash({ a: [1, 2] })).not.toBe(computeMetaHash({ a: [2, 1] }));
  });
});

describe('cache: source registry', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-cache-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('load missing file returns empty registry', async () => {
    const reg = await loadSourceRegistry(tmp);
    expect(reg).toEqual({ sources: {} });
  });

  it('save + load roundtrip', async () => {
    const entry = {
      source_hash: 'a'.repeat(64),
      content_hashes: { '14-15': 'b'.repeat(64) },
      last_verified: '2026-04-16T00:00:00.000Z',
    };
    const reg = { sources: { 'public/toolkit/x.pdf': entry } };
    await saveSourceRegistry(reg, tmp);
    const loaded = await loadSourceRegistry(tmp);
    expect(loaded.sources['public/toolkit/x.pdf']).toEqual(entry);
    expect(loaded.meta_hash).toBeDefined();
  });

  it('save + load tolerates explicit undefined optional field (no false quarantine)', async () => {
    const entry = {
      source_hash: 'a'.repeat(64),
      content_hashes: { [SOURCE_REGISTRY_ALL_PAGES_KEY]: 'b'.repeat(64) },
      drive_file_id: undefined,
      last_verified: '2026-04-16T00:00:00.000Z',
    };
    const reg = { sources: { 'x.pdf': entry } };
    await saveSourceRegistry(reg, tmp);
    await expect(loadSourceRegistry(tmp)).resolves.toBeDefined();
  });

  it('save → load → save → load meta_hash stable across cycles', async () => {
    const entry = {
      source_hash: 'a'.repeat(64),
      content_hashes: { '1': 'b'.repeat(64) },
      last_verified: '2026-04-16T00:00:00.000Z',
    };
    await saveSourceRegistry({ sources: { 'x.pdf': entry } }, tmp);
    const first = await loadSourceRegistry(tmp);
    await saveSourceRegistry(first, tmp);
    const second = await loadSourceRegistry(tmp);
    expect(second.meta_hash).toBe(first.meta_hash);
    expect(second.sources).toEqual(first.sources);
  });

  it('save writes meta_hash matching sources', async () => {
    const reg = { sources: {} };
    await saveSourceRegistry(reg, tmp);
    const raw = await readFile(join(tmp, SOURCES_YAML), 'utf-8');
    expect(raw).toContain('meta_hash:');
  });

  it('malformed YAML → CacheCorruptedError + quarantine', async () => {
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await writeFile(join(tmp, SOURCES_YAML), 'not: valid: yaml: [\n');
    await expect(loadSourceRegistry(tmp)).rejects.toThrow(CacheCorruptedError);
    const files = await readdir(join(tmp, 'docs/source-specs'));
    expect(files.some((f) => f.includes('corrupt-'))).toBe(true);
  });

  it('zod-invalid content → CacheCorruptedError', async () => {
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await writeFile(join(tmp, SOURCES_YAML), dump({ sources: { 'x.pdf': { source_hash: 'not-sha256' } } }));
    await expect(loadSourceRegistry(tmp)).rejects.toThrow(CacheCorruptedError);
  });

  it('meta_hash mismatch → CacheCorruptedError', async () => {
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    const entry = {
      source_hash: 'a'.repeat(64),
      content_hashes: { '1': 'b'.repeat(64) },
      last_verified: '2026-04-16T00:00:00.000Z',
    };
    await writeFile(
      join(tmp, SOURCES_YAML),
      dump({ sources: { 'x.pdf': entry }, meta_hash: 'f'.repeat(64) }),
    );
    await expect(loadSourceRegistry(tmp)).rejects.toThrow(CacheCorruptedError);
  });

  it('getSourceEntry returns null for missing, entry for present', () => {
    const entry = {
      source_hash: 'a'.repeat(64),
      content_hashes: { '1': 'b'.repeat(64) },
      last_verified: '2026-04-16T00:00:00.000Z',
    };
    const reg = { sources: { 'x.pdf': entry } };
    expect(getSourceEntry(reg, 'x.pdf')).toEqual(entry);
    expect(getSourceEntry(reg, 'missing.pdf')).toBeNull();
  });

  it('setSourceEntry is immutable add', () => {
    const entry = {
      source_hash: 'a'.repeat(64),
      content_hashes: { '1': 'b'.repeat(64) },
      last_verified: '2026-04-16T00:00:00.000Z',
    };
    const reg = { sources: {} };
    const next = setSourceEntry(reg, 'x.pdf', entry);
    expect(next.sources['x.pdf']).toEqual(entry);
    expect(reg.sources).toEqual({});
  });

  describe('setSourceContentHash', () => {
    const ts = '2026-04-24T00:00:00.000Z';

    it('creates entry when PDF is absent', () => {
      const next = setSourceContentHash({ sources: {} }, 'x.pdf', '66', 'a'.repeat(64), 'b'.repeat(64), ts);
      expect(next.sources['x.pdf']).toEqual({
        source_hash: 'a'.repeat(64),
        content_hashes: { '66': 'b'.repeat(64) },
        last_verified: ts,
      });
    });

    it('uses __all__ key when page is undefined', () => {
      const next = setSourceContentHash({ sources: {} }, 'x.pdf', undefined, 'a'.repeat(64), 'b'.repeat(64), ts);
      expect(next.sources['x.pdf'].content_hashes).toEqual({
        [SOURCE_REGISTRY_ALL_PAGES_KEY]: 'b'.repeat(64),
      });
    });

    it('merges new page hash into existing entry when source_hash unchanged', () => {
      const reg = setSourceContentHash({ sources: {} }, 'x.pdf', '66', 'a'.repeat(64), 'b'.repeat(64), ts);
      const next = setSourceContentHash(reg, 'x.pdf', '35-36', 'a'.repeat(64), 'c'.repeat(64), ts);
      expect(next.sources['x.pdf'].content_hashes).toEqual({
        '66': 'b'.repeat(64),
        '35-36': 'c'.repeat(64),
      });
    });

    it('overwrites the same page hash on re-scaffold', () => {
      const reg = setSourceContentHash({ sources: {} }, 'x.pdf', '66', 'a'.repeat(64), 'b'.repeat(64), ts);
      const next = setSourceContentHash(reg, 'x.pdf', '66', 'a'.repeat(64), 'd'.repeat(64), ts);
      expect(next.sources['x.pdf'].content_hashes).toEqual({ '66': 'd'.repeat(64) });
    });

    it('drops stale content_hashes when source_hash changes', () => {
      const reg = setSourceContentHash({ sources: {} }, 'x.pdf', '66', 'a'.repeat(64), 'b'.repeat(64), ts);
      const next = setSourceContentHash(reg, 'x.pdf', '66', 'e'.repeat(64), 'f'.repeat(64), ts);
      expect(next.sources['x.pdf']).toEqual({
        source_hash: 'e'.repeat(64),
        content_hashes: { '66': 'f'.repeat(64) },
        last_verified: ts,
      });
    });

    it('preserves drive_file_id across merges', () => {
      const reg: { sources: Record<string, unknown> } = {
        sources: {
          'x.pdf': {
            source_hash: 'a'.repeat(64),
            content_hashes: { '66': 'b'.repeat(64) },
            drive_file_id: 'abc123',
            last_verified: ts,
          },
        },
      };
      const next = setSourceContentHash(reg as never, 'x.pdf', '35-36', 'a'.repeat(64), 'c'.repeat(64), ts);
      expect(next.sources['x.pdf'].drive_file_id).toBe('abc123');
      expect(next.sources['x.pdf'].content_hashes).toEqual({
        '66': 'b'.repeat(64),
        '35-36': 'c'.repeat(64),
      });
    });

    it('immutable — returns new registry, leaves original untouched', () => {
      const reg = { sources: {} };
      const next = setSourceContentHash(reg, 'x.pdf', '66', 'a'.repeat(64), 'b'.repeat(64), ts);
      expect(reg.sources).toEqual({});
      expect(next).not.toBe(reg);
    });
  });
});

describe('cache: extraction cache', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-cache-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('load missing file returns empty cache', async () => {
    expect(await loadExtractionCache(tmp)).toEqual({ cache: {} });
  });

  it('save + load roundtrip', async () => {
    const entry = {
      text: 'Name: John',
      extracted_at: '2026-04-16T00:00:00.000Z',
      method: 'pdftotext' as const,
    };
    const cache = { cache: { [`${'a'.repeat(64)}:14-15`]: entry } };
    await saveExtractionCache(cache, tmp);
    const loaded = await loadExtractionCache(tmp);
    expect(loaded.cache[`${'a'.repeat(64)}:14-15`]).toEqual(entry);
  });

  it('malformed YAML → CacheCorruptedError + quarantine', async () => {
    await mkdir(join(tmp, 'docs/source-specs'), { recursive: true });
    await writeFile(join(tmp, CACHE_YAML), 'garbage: [\n');
    await expect(loadExtractionCache(tmp)).rejects.toThrow(CacheCorruptedError);
  });

  it('cacheKey with and without page', () => {
    expect(cacheKey('aaa', '14-15')).toBe('aaa:14-15');
    expect(cacheKey('aaa', undefined)).toBe('aaa');
  });

  it('getCachedExtraction returns null for miss, entry for hit', () => {
    const entry = {
      text: 't',
      extracted_at: '2026-04-16T00:00:00.000Z',
      method: 'pdftotext' as const,
    };
    const cache = { cache: { 'aaa:1': entry } };
    expect(getCachedExtraction(cache, 'aaa', '1')).toEqual(entry);
    expect(getCachedExtraction(cache, 'aaa', '2')).toBeNull();
    expect(getCachedExtraction(cache, 'bbb', '1')).toBeNull();
  });

  it('setCachedExtraction immutably adds entry', () => {
    const cache = { cache: {} };
    const next = setCachedExtraction(cache, 'aaa', '1', 'hello', 'pdftotext');
    expect(next.cache['aaa:1'].text).toBe('hello');
    expect(next.cache['aaa:1'].method).toBe('pdftotext');
    expect(cache.cache).toEqual({});
  });
});

describe('cache: checkSourceFreshness', () => {
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'verify-cache-')); });
  afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

  it('source_not_found when file absent (no raw ENOENT)', async () => {
    const result = await checkSourceFreshness({ sources: {} }, join(tmp, 'missing.pdf'), 'missing.pdf');
    expect(result.state).toBe('source_not_found');
  });

  it('unregistered when source not in registry', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'hello');
    const result = await checkSourceFreshness({ sources: {} }, path, 'a.pdf');
    expect(result.state).toBe('unregistered');
    if (result.state === 'unregistered') {
      expect(result.currentSourceHash).toBe(sha256('hello'));
    }
  });

  it('fresh when source_hash and per-page content_hash both registered', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'hello');
    const reg = {
      sources: {
        'a.pdf': {
          source_hash: sha256('hello'),
          content_hashes: { '66': 'c'.repeat(64) },
          last_verified: '2026-04-16T00:00:00.000Z',
        },
      },
    };
    const result = await checkSourceFreshness(reg, path, 'a.pdf', '66');
    expect(result.state).toBe('fresh');
    if (result.state === 'fresh') {
      expect(result.pageContentHash).toBe('c'.repeat(64));
    }
  });

  it('unregistered when source_hash matches but page is unknown', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'hello');
    const reg = {
      sources: {
        'a.pdf': {
          source_hash: sha256('hello'),
          content_hashes: { '66': 'c'.repeat(64) },
          last_verified: '2026-04-16T00:00:00.000Z',
        },
      },
    };
    const result = await checkSourceFreshness(reg, path, 'a.pdf', '35-36');
    expect(result.state).toBe('unregistered');
  });

  it('uses __all__ key when no page is provided', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'hello');
    const reg = {
      sources: {
        'a.pdf': {
          source_hash: sha256('hello'),
          content_hashes: { [SOURCE_REGISTRY_ALL_PAGES_KEY]: 'c'.repeat(64) },
          last_verified: '2026-04-16T00:00:00.000Z',
        },
      },
    };
    const result = await checkSourceFreshness(reg, path, 'a.pdf');
    expect(result.state).toBe('fresh');
    if (result.state === 'fresh') {
      expect(result.pageContentHash).toBe('c'.repeat(64));
    }
  });

  it('source_drift when bytes changed', async () => {
    const path = join(tmp, 'a.pdf');
    await writeFile(path, 'new bytes');
    const reg = {
      sources: {
        'a.pdf': {
          source_hash: sha256('old bytes'),
          content_hashes: { '66': 'c'.repeat(64) },
          last_verified: '2026-04-16T00:00:00.000Z',
        },
      },
    };
    const result = await checkSourceFreshness(reg, path, 'a.pdf', '66');
    expect(result.state).toBe('source_drift');
  });
});
