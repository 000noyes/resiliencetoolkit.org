import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import {
  computeContentHash,
  getCachedExtraction,
  setCachedExtraction,
} from './cache';
import type { ExtractionCache, ExtractionMethod } from './schemas';

const execFileAsync = promisify(execFile);

export type ExtractFailStatus = 'extract_failed' | 'vision_api_failed' | 'source_not_found';

export class ExtractionError extends Error {
  readonly status: ExtractFailStatus;
  constructor(message: string, status: ExtractFailStatus) {
    super(message);
    this.name = 'ExtractionError';
    this.status = status;
  }
}

export type ExecFn = (
  bin: string,
  args: readonly string[],
  options?: { maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

export interface ExtractOptions {
  pdftotextBin?: string;
  exec?: ExecFn;
  allowVision?: boolean;
  visionExtract?: (absolutePath: string, page: string | undefined) => Promise<string>;
}

export interface ExtractResult {
  text: string;
  method: ExtractionMethod;
  content_hash: string;
}

export function parsePageRange(page: string | undefined): { first?: number; last?: number } {
  if (!page) return {};
  const m = /^(\d+)(?:-(\d+))?$/.exec(page.trim());
  if (!m) throw new ExtractionError(`invalid page range: ${page}`, 'extract_failed');
  const first = parseInt(m[1], 10);
  const last = m[2] ? parseInt(m[2], 10) : first;
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
  if (first) args.push('-f', String(first));
  if (last) args.push('-l', String(last));
  args.push(absolutePath, '-');
  try {
    const { stdout } = await exec(bin, args, { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (e) {
    const msg = (e as Error).message ?? 'unknown';
    throw new ExtractionError(`pdftotext failed: ${msg}`, 'extract_failed');
  }
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
  const text = await extractWithPdftotext(ctx.absolutePath, ctx.page, ctx.options);
  const content_hash = computeContentHash(text);
  const cached = getCachedExtraction(ctx.cache, content_hash, ctx.page);
  if (cached && cached.method === 'vision') {
    return {
      result: { text: cached.text, method: 'vision', content_hash },
      cache: ctx.cache,
      fromCache: true,
    };
  }
  if (cached && cached.method === 'pdftotext') {
    return {
      result: { text: cached.text, method: 'pdftotext', content_hash },
      cache: ctx.cache,
      fromCache: true,
    };
  }
  const nextCache = setCachedExtraction(ctx.cache, content_hash, ctx.page, text, 'pdftotext');
  return {
    result: { text, method: 'pdftotext', content_hash },
    cache: nextCache,
    fromCache: false,
  };
}
