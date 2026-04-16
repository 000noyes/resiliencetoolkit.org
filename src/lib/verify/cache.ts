import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { load, dump } from 'js-yaml';
import {
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
  if (value === null || value === undefined) return JSON.stringify(value ?? null);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
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
): ExtractionCache {
  return {
    cache: {
      ...cache.cache,
      [cacheKey(content_hash, page)]: {
        text,
        extracted_at: new Date().toISOString(),
        method,
      },
    },
  };
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

export type SourceFreshness =
  | { state: 'unregistered'; currentSourceHash: string }
  | { state: 'fresh'; currentSourceHash: string; entry: SourceRegistryEntry }
  | { state: 'source_drift'; currentSourceHash: string; entry: SourceRegistryEntry };

export async function checkSourceFreshness(
  registry: SourceRegistry,
  absolutePath: string,
  repoRelativePath: string,
): Promise<SourceFreshness> {
  const currentSourceHash = await computeSourceHash(absolutePath);
  const entry = getSourceEntry(registry, repoRelativePath);
  if (!entry) return { state: 'unregistered', currentSourceHash };
  if (entry.source_hash === currentSourceHash) {
    return { state: 'fresh', currentSourceHash, entry };
  }
  return { state: 'source_drift', currentSourceHash, entry };
}
