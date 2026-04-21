import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import {
  computeContentHash,
  computeSourceHash,
  findCachedBySourceHash,
  getCachedExtraction,
  setCachedExtraction,
} from './cache';
import type { ExtractionCache, ExtractionMethod } from './schemas';

const execFileAsync = promisify(execFile);

export type ExtractFailStatus = 'extract_failed' | 'vision_api_failed' | 'source_not_found';

export class ExtractionError extends Error {
  readonly status: ExtractFailStatus;
  readonly code?: string;
  constructor(message: string, status: ExtractFailStatus, code?: string) {
    super(message);
    this.name = 'ExtractionError';
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export type ExecFn = (
  bin: string,
  args: readonly string[],
  options?: { maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

export interface ExtractOptions {
  pdftotextBin?: string;
  pdftohtmlBin?: string;
  exec?: ExecFn;
  allowVision?: boolean;
  visionExtract?: (absolutePath: string, page: string | undefined) => Promise<string>;
}

export interface ExtractResult {
  text: string;
  method: ExtractionMethod;
  content_hash: string;
}

export interface ExtractedLink {
  url: string;
  page: number;
  anchor_text?: string;
}

export function parsePageRange(page: string | undefined): { first?: number; last?: number } {
  if (!page) return {};
  const m = /^(\d+)(?:-(\d+))?$/.exec(page.trim());
  if (!m) throw new ExtractionError(`invalid page range: ${page}`, 'extract_failed');
  const first = parseInt(m[1], 10);
  const last = m[2] ? parseInt(m[2], 10) : first;
  if (first < 1) {
    throw new ExtractionError(`invalid page range: ${page} (pages are 1-indexed)`, 'extract_failed');
  }
  if (last < first) {
    throw new ExtractionError(`invalid page range: ${page} (last < first)`, 'extract_failed');
  }
  return { first, last };
}

export async function extractWithPdftotext(
  absolutePath: string,
  page: string | undefined,
  options: ExtractOptions = {},
): Promise<string> {
  if (!existsSync(absolutePath)) {
    throw new ExtractionError(`source not found: ${absolutePath}`, 'source_not_found');
  }
  const bin = options.pdftotextBin ?? 'pdftotext';
  const exec = options.exec ?? (execFileAsync as unknown as ExecFn);
  const { first, last } = parsePageRange(page);
  const args: string[] = ['-layout'];
  if (first !== undefined) args.push('-f', String(first));
  if (last !== undefined) args.push('-l', String(last));
  args.push(absolutePath, '-');
  try {
    const { stdout } = await exec(bin, args, { maxBuffer: 10 * 1024 * 1024 });
    return typeof stdout === 'string' ? stdout : String(stdout);
  } catch (e) {
    const err = e as Error & { stderr?: string | Buffer; code?: string | number };
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const base = err.message ?? 'unknown';
    const msg = stderr ? `${base} — stderr: ${stderr}` : base;
    const code = typeof err.code === 'string' ? err.code : undefined;
    throw new ExtractionError(`pdftotext failed: ${msg}`, 'extract_failed', code);
  }
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&#160;': ' ',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, (m) => HTML_ENTITY_MAP[m] ?? m);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

export function parseLinksFromPdftohtml(html: string, pageNum: number): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const anchorRe = /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const url = m[1];
    if (!url) continue;
    const inner = m[2];
    const anchor_text = decodeHtmlEntities(stripTags(inner)).replace(/\s+/g, ' ').trim();
    const link: ExtractedLink = { url, page: pageNum };
    if (anchor_text.length > 0) link.anchor_text = anchor_text;
    links.push(link);
  }
  return links;
}

export async function extractWithPdftohtml(
  absolutePath: string,
  pageNum: number,
  options: ExtractOptions = {},
): Promise<ExtractedLink[]> {
  if (!existsSync(absolutePath)) {
    throw new ExtractionError(`source not found: ${absolutePath}`, 'source_not_found');
  }
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    throw new ExtractionError(`invalid page number: ${pageNum} (pages are 1-indexed)`, 'extract_failed');
  }
  const bin = options.pdftohtmlBin ?? 'pdftohtml';
  const exec = options.exec ?? (execFileAsync as unknown as ExecFn);
  const args = ['-s', '-i', '-stdout', '-f', String(pageNum), '-l', String(pageNum), absolutePath, '-'];
  try {
    const { stdout } = await exec(bin, args, { maxBuffer: 10 * 1024 * 1024 });
    const html = typeof stdout === 'string' ? stdout : String(stdout);
    return parseLinksFromPdftohtml(html, pageNum);
  } catch (e) {
    const err = e as Error & { stderr?: string | Buffer; code?: string | number };
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const base = err.message ?? 'unknown';
    const msg = stderr ? `${base} — stderr: ${stderr}` : base;
    const code = typeof err.code === 'string' ? err.code : undefined;
    throw new ExtractionError(`pdftohtml failed: ${msg}`, 'extract_failed', code);
  }
}

export async function extractLinks(
  absolutePath: string,
  page: string | undefined,
  options: ExtractOptions = {},
): Promise<ExtractedLink[]> {
  const { first, last } = parsePageRange(page);
  if (first === undefined || last === undefined) {
    throw new ExtractionError('extractLinks requires an explicit page or page range', 'extract_failed');
  }
  const all: ExtractedLink[] = [];
  for (let p = first; p <= last; p++) {
    const pageLinks = await extractWithPdftohtml(absolutePath, p, options);
    all.push(...pageLinks);
  }
  return all;
}

export async function extractWithVision(
  absolutePath: string,
  page: string | undefined,
  options: ExtractOptions = {},
): Promise<string> {
  if (!options.allowVision) {
    throw new ExtractionError(
      'vision fallback disallowed (CI runs pdftotext only)',
      'vision_api_failed',
    );
  }
  if (!options.visionExtract) {
    throw new ExtractionError('vision fallback not configured', 'vision_api_failed');
  }
  if (!existsSync(absolutePath)) {
    throw new ExtractionError(`source not found: ${absolutePath}`, 'source_not_found');
  }
  try {
    return await options.visionExtract(absolutePath, page);
  } catch (e) {
    throw new ExtractionError(`vision extraction failed: ${(e as Error).message}`, 'vision_api_failed');
  }
}

export interface ExtractContext {
  absolutePath: string;
  page: string | undefined;
  cache: ExtractionCache;
  options?: ExtractOptions;
}

export interface ExtractOutcome {
  result: ExtractResult;
  cache: ExtractionCache;
  fromCache: boolean;
}

export async function extract(ctx: ExtractContext): Promise<ExtractOutcome> {
  if (!existsSync(ctx.absolutePath)) {
    throw new ExtractionError(`source not found: ${ctx.absolutePath}`, 'source_not_found');
  }
  const source_hash = await computeSourceHash(ctx.absolutePath);
  const bySource = findCachedBySourceHash(ctx.cache, source_hash, ctx.page);
  if (bySource) {
    const content_hash = computeContentHash(bySource.entry.text);
    return {
      result: { text: bySource.entry.text, method: bySource.entry.method, content_hash },
      cache: ctx.cache,
      fromCache: true,
    };
  }
  const text = await extractWithPdftotext(ctx.absolutePath, ctx.page, ctx.options);
  const content_hash = computeContentHash(text);
  const cached = getCachedExtraction(ctx.cache, content_hash, ctx.page);
  if (cached) {
    const nextCache = cached.source_hash
      ? ctx.cache
      : setCachedExtraction(ctx.cache, content_hash, ctx.page, cached.text, cached.method, source_hash);
    return {
      result: { text: cached.text, method: cached.method, content_hash },
      cache: nextCache,
      fromCache: true,
    };
  }
  const nextCache = setCachedExtraction(
    ctx.cache,
    content_hash,
    ctx.page,
    text,
    'pdftotext',
    source_hash,
  );
  return {
    result: { text, method: 'pdftotext', content_hash },
    cache: nextCache,
    fromCache: false,
  };
}
