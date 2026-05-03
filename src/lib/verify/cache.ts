import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { load, dump } from 'js-yaml';
import {
  registryPageKey,
  sourceRegistrySchema,
  extractionCacheSchema,
  type SourceRegistry,
  type SourceRegistryEntry,
  type ExtractionCache,
  type ExtractionCacheEntry,
  type ExtractionMethod,
} from './schemas';

export const SPEC_DIR = 'docs/source-specs';
export const SOURCES_YAML = `${SPEC_DIR}/_sources.yaml`;
export const CACHE_YAML = `${SPEC_DIR}/_extraction-cache.yaml`;

export function sha256(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeForHash(text: string): string {
  return text
    .replace(/\f/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export function computeContentHash(extractedText: string): string {
  return sha256(normalizeForHash(extractedText));
}

export async function computeSourceHash(absolutePath: string): Promise<string> {
  const buf = await readFile(absolutePath);
  return sha256(buf);
}

function canonicalJSON(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonicalJSON(v)).join(',') + '}';
}

export function computeMetaHash(payload: unknown): string {
  return sha256(canonicalJSON(payload));
}

export class CacheCorruptedError extends Error {
  readonly quarantinePath: string;
  constructor(message: string, quarantinePath: string) {
    super(message);
    this.name = 'CacheCorruptedError';
    this.quarantinePath = quarantinePath;
  }
}

async function quarantineFile(path: string): Promise<string> {
  const quarantinePath = `${path}.corrupt-${Date.now()}`;
  if (existsSync(path)) await rename(path, quarantinePath);
  return quarantinePath;
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function resolvePath(basePath: string, relative: string): string {
  return resolve(basePath, relative);
}

export async function loadSourceRegistry(basePath = '.'): Promise<SourceRegistry> {
  const path = resolvePath(basePath, SOURCES_YAML);
  if (!existsSync(path)) return { sources: {} };
  const raw = await readFile(path, 'utf-8');
  let parsed: unknown;
  try {
    parsed = load(raw);
  } catch {
    const q = await quarantineFile(path);
    throw new CacheCorruptedError(`${SOURCES_YAML}: YAML parse error`, q);
  }
  const result = sourceRegistrySchema.safeParse(parsed);
  if (!result.success) {
    const q = await quarantineFile(path);
    throw new CacheCorruptedError(
      `${SOURCES_YAML}: zod validation failed: ${result.error.message}`,
      q,
    );
  }
  const expected = computeMetaHash(result.data.sources);
  if (result.data.meta_hash && result.data.meta_hash !== expected) {
    const q = await quarantineFile(path);
    throw new CacheCorruptedError(`${SOURCES_YAML}: meta_hash mismatch (tamper?)`, q);
  }
  return result.data;
}

export async function saveSourceRegistry(registry: SourceRegistry, basePath = '.'): Promise<void> {
  const path = resolvePath(basePath, SOURCES_YAML);
  await ensureDir(path);
  const meta_hash = computeMetaHash(registry.sources);
  const toWrite: SourceRegistry = { sources: registry.sources, meta_hash };
  await writeFile(path, dump(toWrite, { sortKeys: true, noRefs: true }), 'utf-8');
}

export async function loadExtractionCache(basePath = '.'): Promise<ExtractionCache> {
  const path = resolvePath(basePath, CACHE_YAML);
  if (!existsSync(path)) return { cache: {} };
  const raw = await readFile(path, 'utf-8');
  let parsed: unknown;
  try {
    parsed = load(raw);
  } catch {
    const q = await quarantineFile(path);
    throw new CacheCorruptedError(`${CACHE_YAML}: YAML parse error`, q);
  }
  const result = extractionCacheSchema.safeParse(parsed);
  if (!result.success) {
    const q = await quarantineFile(path);
    throw new CacheCorruptedError(
      `${CACHE_YAML}: zod validation failed: ${result.error.message}`,
      q,
    );
  }
  const expected = computeMetaHash(result.data.cache);
  if (result.data.meta_hash && result.data.meta_hash !== expected) {
    const q = await quarantineFile(path);
    throw new CacheCorruptedError(`${CACHE_YAML}: meta_hash mismatch (tamper?)`, q);
  }
  return result.data;
}

export async function saveExtractionCache(cache: ExtractionCache, basePath = '.'): Promise<void> {
  const path = resolvePath(basePath, CACHE_YAML);
  await ensureDir(path);
  const meta_hash = computeMetaHash(cache.cache);
  const toWrite: ExtractionCache = { cache: cache.cache, meta_hash };
  await writeFile(path, dump(toWrite, { sortKeys: true, noRefs: true }), 'utf-8');
}

export function cacheKey(content_hash: string, page: string | undefined): string {
  return page ? `${content_hash}:${page}` : content_hash;
}

export function getCachedExtraction(
  cache: ExtractionCache,
  content_hash: string,
  page: string | undefined,
): ExtractionCacheEntry | null {
  return cache.cache[cacheKey(content_hash, page)] ?? null;
}

export function setCachedExtraction(
  cache: ExtractionCache,
  content_hash: string,
  page: string | undefined,
  text: string,
  method: ExtractionMethod,
  source_hash?: string,
): ExtractionCache {
  return {
    cache: {
      ...cache.cache,
      [cacheKey(content_hash, page)]: {
        text,
        extracted_at: new Date().toISOString(),
        method,
        ...(source_hash ? { source_hash } : {}),
      },
    },
  };
}

/**
 * Why: extract() shells out to pdftotext before consulting the cache; that
 * breaks deploy environments (e.g. Cloudflare Pages) that don't have
 * poppler-utils installed. Looking up by source_hash of raw PDF bytes lets
 * us skip the binary entirely when the same PDF has been extracted before.
 * Scan is linear but the cache has O(tens) of entries; acceptable.
 */
export function findCachedBySourceHash(
  cache: ExtractionCache,
  source_hash: string,
  page: string | undefined,
): { key: string; entry: ExtractionCacheEntry } | null {
  const pageSuffix = page ? `:${page}` : '';
  for (const [key, entry] of Object.entries(cache.cache)) {
    if (entry.source_hash !== source_hash) continue;
    const keyPageSuffix = key.slice(64);
    if (keyPageSuffix !== pageSuffix) continue;
    return { key, entry };
  }
  return null;
}

export function getSourceEntry(
  registry: SourceRegistry,
  repoRelativePath: string,
): SourceRegistryEntry | null {
  return registry.sources[repoRelativePath] ?? null;
}

export function setSourceEntry(
  registry: SourceRegistry,
  repoRelativePath: string,
  entry: SourceRegistryEntry,
): SourceRegistry {
  return {
    sources: {
      ...registry.sources,
      [repoRelativePath]: entry,
    },
  };
}

/**
 * Merge a single (page, content_hash) measurement into the registry without
 * disturbing other pages already registered for the same PDF.
 *
 * If the entry is absent OR the source_hash has changed since last
 * registration, the previous content_hashes record is dropped — those hashes
 * are stale because the underlying PDF bytes moved. The caller (scaffold) is
 * responsible for re-extracting any other still-cited pages after a
 * source-bytes change.
 */
export function setSourceContentHash(
  registry: SourceRegistry,
  repoRelativePath: string,
  page: string | undefined,
  source_hash: string,
  content_hash: string,
  last_verified: string,
): SourceRegistry {
  const key = registryPageKey(page);
  const prior = registry.sources[repoRelativePath];
  const carryHashes =
    prior && prior.source_hash === source_hash ? prior.content_hashes : {};
  const nextEntry: SourceRegistryEntry = {
    source_hash,
    content_hashes: { ...carryHashes, [key]: content_hash },
    last_verified,
    ...(prior?.drive_file_id ? { drive_file_id: prior.drive_file_id } : {}),
  };
  return {
    sources: {
      ...registry.sources,
      [repoRelativePath]: nextEntry,
    },
  };
}

export type SourceFreshness =
  | { state: 'source_not_found' }
  | { state: 'unregistered'; currentSourceHash: string }
  | { state: 'fresh'; currentSourceHash: string; entry: SourceRegistryEntry; pageContentHash: string }
  | { state: 'source_drift'; currentSourceHash: string; entry: SourceRegistryEntry };

/**
 * Look up freshness for a (PDF, page) pair. `page` matches the spec's
 * citation.page (or undefined for whole-PDF and raw-PDF citations); the
 * registry is keyed by registryPageKey(page) under the PDF entry's
 * content_hashes record. A registered PDF without a content_hash for the
 * requested page is treated as `unregistered` — the operator must run
 * scaffold-spec on that page before verify can drift-check it.
 *
 * When `page` is not provided (raw-PDF citation, no spec), the lookup
 * falls back to ANY content_hash on the entry: raw citations only care
 * about source_hash freshness, not page-level granularity. The first
 * available hash is returned for downstream content-drift comparison
 * (effectively a no-op since raw citations don't extract text again).
 */
export async function checkSourceFreshness(
  registry: SourceRegistry,
  absolutePath: string,
  repoRelativePath: string,
  page?: string,
): Promise<SourceFreshness> {
  if (!existsSync(absolutePath)) return { state: 'source_not_found' };
  const currentSourceHash = await computeSourceHash(absolutePath);
  const entry = getSourceEntry(registry, repoRelativePath);
  if (!entry) return { state: 'unregistered', currentSourceHash };
  const key = registryPageKey(page);
  let pageContentHash = entry.content_hashes[key];
  if (!pageContentHash && (page === undefined || page.length === 0)) {
    // No page requested → tolerate ANY registered page's hash. This is the
    // raw-PDF-citation path; the caller does not run a content-drift diff.
    const anyKey = Object.keys(entry.content_hashes)[0];
    if (anyKey) pageContentHash = entry.content_hashes[anyKey];
  }
  if (entry.source_hash === currentSourceHash) {
    if (!pageContentHash) return { state: 'unregistered', currentSourceHash };
    return { state: 'fresh', currentSourceHash, entry, pageContentHash };
  }
  return { state: 'source_drift', currentSourceHash, entry };
}
