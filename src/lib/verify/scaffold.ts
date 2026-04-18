import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { dump } from 'js-yaml';
import {
  CacheCorruptedError,
  loadExtractionCache,
  saveExtractionCache,
} from './cache';
import { extract, type ExtractOptions } from './extract';
import type { SourceSpec } from './schemas';

export class ScaffoldError extends Error {
  readonly status: 'spec_parse_error' | 'extract_failed' | 'cache_corrupted' | 'exists';
  constructor(
    message: string,
    status: ScaffoldError['status'] = 'spec_parse_error',
  ) {
    super(message);
    this.name = 'ScaffoldError';
    this.status = status;
  }
}

export interface ScaffoldOptions {
  projectRoot: string;
  /** Repo-relative path to the PDF, e.g. "rt-templates/leader-directory.pdf". */
  pdf: string;
  /** Page range like "14" or "14-15"; optional. */
  page?: string;
  /** Module in "N-N" form, e.g. "1-9". */
  module: string;
  /** Template slug in kebab-case, e.g. "leader-directory". */
  template: string;
  /** Human-readable title; defaults to Title-cased template. */
  title?: string;
  /** Override output path. Defaults to docs/source-specs/<module>-<template>.md. */
  outRelPath?: string;
  /** Overwrite an existing spec file. Default false. */
  force?: boolean;
  extractOptions?: ExtractOptions;
  /** Save the extraction cache to disk after running. Default true. */
  saveCache?: boolean;
}

export interface ScaffoldResult {
  outAbsolutePath: string;
  outRelPath: string;
  content: string;
  extractedText: string;
  cacheSaved: boolean;
}

const MODULE_RE = /^[0-9]+-[0-9]+$/;
const TEMPLATE_RE = /^[a-z0-9-]+$/;

function defaultTitle(template: string): string {
  return template
    .split('-')
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(' ');
}

function buildStubContent(opts: {
  module: string;
  template: string;
  title: string;
  pdf: string;
  page: string | undefined;
  extractedText: string;
}): string {
  const citation: { source: string; page?: string } = { source: opts.pdf };
  if (opts.page !== undefined) citation.page = opts.page;

  const spec: SourceSpec = {
    module: opts.module,
    template: opts.template,
    title: opts.title,
    citation,
    fields: [
      {
        key: 'placeholder',
        label: 'TODO: replace with real field labels from the extracted text below',
        type: 'text',
      },
    ],
    notes:
      'Auto-generated stub from scaffold-spec. Replace placeholder fields ' +
      'with real field labels discovered in the extracted text. Re-run ' +
      'verify-against-source to confirm recall before wiring components.',
  } as SourceSpec;

  const frontmatter = dump(spec, { sortKeys: false, noRefs: true, lineWidth: 1000 });
  const preview = opts.extractedText.slice(0, 2000);
  const body = [
    '## Extracted text (first 2000 chars, for review only)',
    '',
    '```',
    preview,
    '```',
    '',
  ].join('\n');

  return `---\n${frontmatter}---\n\n${body}`;
}

export async function scaffoldSpec(options: ScaffoldOptions): Promise<ScaffoldResult> {
  if (!MODULE_RE.test(options.module)) {
    throw new ScaffoldError(
      `invalid module "${options.module}" (expected N-N, e.g. 1-9)`,
    );
  }
  if (!TEMPLATE_RE.test(options.template)) {
    throw new ScaffoldError(
      `invalid template "${options.template}" (expected kebab-case)`,
    );
  }

  const projectRoot = resolve(options.projectRoot);
  const pdfAbsolute = resolve(projectRoot, options.pdf);
  if (!existsSync(pdfAbsolute)) {
    throw new ScaffoldError(
      `pdf not found at ${pdfAbsolute}`,
      'extract_failed',
    );
  }

  const outRelPath =
    options.outRelPath ?? `docs/source-specs/${options.module}-${options.template}.md`;
  const outAbsolutePath = resolve(projectRoot, outRelPath);

  if (!options.force) {
    try {
      await access(outAbsolutePath, constants.F_OK);
      throw new ScaffoldError(
        `spec already exists at ${outRelPath} (pass force: true to overwrite)`,
        'exists',
      );
    } catch (e) {
      if (e instanceof ScaffoldError) throw e;
      // ENOENT → fine, proceed.
    }
  }

  let cache;
  try {
    cache = await loadExtractionCache(projectRoot);
  } catch (e) {
    if (e instanceof CacheCorruptedError) {
      throw new ScaffoldError(
        `${e.message} (quarantined to ${e.quarantinePath})`,
        'cache_corrupted',
      );
    }
    throw e;
  }

  const outcome = await extract({
    absolutePath: pdfAbsolute,
    page: options.page,
    cache,
    options: options.extractOptions,
  });

  const content = buildStubContent({
    module: options.module,
    template: options.template,
    title: options.title ?? defaultTitle(options.template),
    pdf: options.pdf,
    page: options.page,
    extractedText: outcome.result.text,
  });

  await mkdir(dirname(outAbsolutePath), { recursive: true });
  await writeFile(outAbsolutePath, content, 'utf-8');

  const saveCache = options.saveCache !== false;
  if (saveCache) {
    await saveExtractionCache(outcome.cache, projectRoot);
  }

  return {
    outAbsolutePath,
    outRelPath,
    content,
    extractedText: outcome.result.text,
    cacheSaved: saveCache,
  };
}
