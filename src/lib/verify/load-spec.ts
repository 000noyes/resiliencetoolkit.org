import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { load } from 'js-yaml';
import { sourceSpecSchema, type SourceSpec } from './schemas';

export type SpecParseStatus = 'spec_parse_error' | 'source_not_found';

export class SpecParseError extends Error {
  readonly status: SpecParseStatus;
  constructor(message: string, status: SpecParseStatus = 'spec_parse_error') {
    super(message);
    this.name = 'SpecParseError';
    this.status = status;
  }
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

export interface LoadedSpec {
  spec: SourceSpec;
  body: string;
  frontmatter: string;
}

export function parseSpecMarkdown(raw: string): LoadedSpec {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new SpecParseError('no YAML frontmatter delimited by --- found');
  }
  const fm = match[1];
  const body = match[2] ?? '';
  let parsed: unknown;
  try {
    parsed = load(fm);
  } catch (e) {
    throw new SpecParseError(
      `frontmatter YAML parse error: ${(e as Error).message}`,
    );
  }
  const result = sourceSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new SpecParseError(
      `spec schema validation failed: ${result.error.message}`,
    );
  }
  return { spec: result.data, body, frontmatter: fm };
}

export async function loadSpec(absolutePath: string): Promise<LoadedSpec> {
  if (!existsSync(absolutePath)) {
    throw new SpecParseError(
      `spec file not found: ${absolutePath}`,
      'source_not_found',
    );
  }
  let raw: string;
  try {
    raw = await readFile(absolutePath, 'utf-8');
  } catch (e) {
    throw new SpecParseError(
      `failed to read spec ${absolutePath}: ${(e as Error).message}`,
    );
  }
  return parseSpecMarkdown(raw);
}
