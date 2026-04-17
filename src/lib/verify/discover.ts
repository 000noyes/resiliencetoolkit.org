import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { VerifyReportEntry } from './schemas';

const DRIVE_ID_RE = /^[A-Za-z0-9_-]{25,44}$/;
const DRIVE_URL_RE = /drive\.google\.com/i;
const LOCAL_EXT_RE = /\.(pdf|ya?ml|md)$/i;

export const DRIVE_ID_ERROR_MESSAGE =
  'Drive-ID citation found in wired component. Mirror the Drive file to a local path ' +
  '(e.g., rt-templates/ or docs/source-specs/) and cite the local path. ' +
  'Drive file IDs are permitted only in docs/toolkit-inventory.yaml as audit-trail pointers.';

export const DEFAULT_ATTRIBUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  'aria-label',
  'placeholder',
  'data-testid',
  'title',
]);

export const DEFAULT_INCLUDE_DIRS: readonly string[] = [
  'src/pages',
  'src/components',
];

const SCAN_EXTS = new Set(['.astro', '.tsx', '.ts', '.jsx']);
const SKIP_EXT_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.d.ts'];

export type CitationKind = 'attr' | 'attr-expr' | 'jsx-comment' | 'html-comment';

export interface DiscoveredCitation {
  /** Path relative to projectRoot, using forward slashes. */
  file: string;
  /** 1-indexed line number of the citation site. */
  line: number;
  source: string;
  page?: string;
  kind: CitationKind;
}

export interface DiscoverOptions {
  projectRoot: string;
  /** Relative directories under projectRoot to scan. Defaults to src/pages + src/components. */
  includeDirs?: readonly string[];
  /** Attribute names whose literal string values do NOT trip the lint pass. */
  attributeAllowlist?: ReadonlySet<string>;
}

export interface DiscoverResult {
  citations: DiscoveredCitation[];
  violations: VerifyReportEntry[];
}

/**
 * A source string is a banned Drive citation if it is either a `drive.google.com` URL
 * OR looks like a bare Drive file/folder ID: 25-44 chars of `[A-Za-z0-9_-]` with no
 * PDF/YAML/MD extension. Inventory-style audit pointers may still reference these in
 * `docs/toolkit-inventory.yaml`, which this discover pass does not scan.
 */
export function isDriveIdCitation(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (DRIVE_URL_RE.test(trimmed)) return true;
  if (LOCAL_EXT_RE.test(trimmed)) return false;
  if (trimmed.includes('/') || trimmed.includes('\\')) return false;
  return DRIVE_ID_RE.test(trimmed);
}

function shouldScanFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (SKIP_EXT_SUFFIXES.some((s) => lower.endsWith(s))) return false;
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return false;
  return SCAN_EXTS.has(lower.slice(dot));
}

async function walk(dir: string, acc: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory missing — skip rather than throw
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      await walk(full, acc);
    } else if (ent.isFile() && shouldScanFile(full)) {
      acc.push(full);
    }
  }
}

/** Collect lines offsets so we can convert byte-index positions to 1-indexed line numbers. */
function lineAtIndex(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Walk a JSX/Astro opening tag and return its string-literal attributes. */
function parseStringAttrs(tag: string): Record<string, { value: string; kind: CitationKind }> {
  const out: Record<string, { value: string; kind: CitationKind }> = {};
  // attr="..." or attr='...'
  const attrRe = /([A-Za-z_][\w-]*)\s*=\s*(['"])((?:(?!\2).)*)\2/g;
  for (const m of tag.matchAll(attrRe)) {
    out[m[1]] = { value: m[3], kind: 'attr' };
  }
  // attr={"..."} or attr={'...'}
  const exprRe = /([A-Za-z_][\w-]*)\s*=\s*\{\s*(['"])((?:(?!\2).)*)\2\s*\}/g;
  for (const m of tag.matchAll(exprRe)) {
    // Expression form wins: same attribute in both forms shouldn't really happen,
    // but if it does, the expression form is the more recent spec form.
    out[m[1]] = { value: m[3], kind: 'attr-expr' };
  }
  return out;
}

/** Find all opening tags `<Tag ...>` (component names start with uppercase) with attributes. */
function* openingTagsWithAttrs(
  content: string,
): IterableIterator<{ tag: string; index: number }> {
  // Matches Pascal-case component OR lowercase (for HTML); we'll match both and
  // parseStringAttrs extracts only attribute names we care about.
  const re = /<([A-Za-z][\w.]*)\b([^>]*)\/?>/g;
  for (const m of content.matchAll(re)) {
    yield { tag: m[0], index: m.index ?? 0 };
  }
}

function extractCitationsFromContent(
  content: string,
  relFile: string,
): DiscoveredCitation[] {
  const found: DiscoveredCitation[] = [];
  const seen = new Set<string>();

  const pushIfNew = (cit: DiscoveredCitation) => {
    const key = `${cit.file}:${cit.line}:${cit.kind}:${cit.source}:${cit.page ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(cit);
  };

  for (const { tag, index } of openingTagsWithAttrs(content)) {
    const attrs = parseStringAttrs(tag);
    const src = attrs.source;
    if (!src) continue;
    const line = lineAtIndex(content, index);
    pushIfNew({
      file: relFile,
      line,
      source: src.value,
      page: attrs.page?.value,
      kind: src.kind,
    });
  }

  // JSX comment: {/* source: ... (page: ...) */}
  const jsxCommentRe = /\{\s*\/\*\s*source\s*:\s*([^*]+?)\s*\*\/\s*\}/g;
  for (const m of content.matchAll(jsxCommentRe)) {
    const body = m[1].trim();
    const parsed = parseCommentCitation(body);
    if (!parsed) continue;
    pushIfNew({
      file: relFile,
      line: lineAtIndex(content, m.index ?? 0),
      source: parsed.source,
      page: parsed.page,
      kind: 'jsx-comment',
    });
  }

  // HTML comment: <!-- source: ... (page: ...) -->
  const htmlCommentRe = /<!--\s*source\s*:\s*([\s\S]*?)\s*-->/g;
  for (const m of content.matchAll(htmlCommentRe)) {
    const body = m[1].trim();
    const parsed = parseCommentCitation(body);
    if (!parsed) continue;
    pushIfNew({
      file: relFile,
      line: lineAtIndex(content, m.index ?? 0),
      source: parsed.source,
      page: parsed.page,
      kind: 'html-comment',
    });
  }

  return found;
}

/** Parse a comment body: "some/path.pdf" or "some/path.pdf page: 14-15". */
function parseCommentCitation(body: string): { source: string; page?: string } | null {
  if (!body) return null;
  const pageRe = /\bpage\s*:\s*([0-9]+(?:-[0-9]+)?)\b/i;
  const pageMatch = body.match(pageRe);
  let page: string | undefined;
  let source = body;
  if (pageMatch) {
    page = pageMatch[1];
    source = body.replace(pageMatch[0], '').trim();
    // drop a trailing comma/semicolon the author may have used as a separator
    source = source.replace(/[,;]\s*$/, '').trim();
  }
  if (!source) return null;
  return { source, page };
}

function importsLoadSpec(content: string): boolean {
  // Match any occurrence of the identifier. False-positive risk (e.g. a comment mentioning
  // loadSpec) is acceptable since it just triggers lint which surfaces review-worthy items.
  return /\bloadSpec\b/.test(content);
}

/**
 * Phase 1 lint: in files that use loadSpec, surface JSX text nodes that contain any
 * letters. These are hardcoded user-facing strings which should be driven by the spec's
 * field labels instead. Attribute allowlist applies to ATTRIBUTE values, not JSX text;
 * JSX text is flagged unconditionally.
 *
 * Known Phase 1 false-negatives (documented as P1 ts-morph TODO in eng-review spec):
 *   - i18n helpers: t("...") is not flagged because we don't resolve helper calls.
 *   - Template-literal labels: `Hello ${name}` is not flagged.
 *   - Allowlist attribute handling is attribute-name-only; a hardcoded string in a
 *     non-allowlisted attribute is NOT flagged in Phase 1 (future ts-morph check).
 */
function lintJsxText(
  content: string,
  relFile: string,
): VerifyReportEntry[] {
  if (!importsLoadSpec(content)) return [];
  const violations: VerifyReportEntry[] = [];
  const seenOnLine = new Set<string>();
  const re = />([^<>{}]+)</g;
  for (const m of content.matchAll(re)) {
    const text = m[1];
    if (!/\p{L}/u.test(text)) continue;
    const trimmed = text.trim();
    if (trimmed.length < 2) continue;
    // Skip common non-content patterns: numbers-only, whitespace only, punctuation-only.
    if (!/\p{L}{2,}/u.test(trimmed)) continue;
    const line = lineAtIndex(content, m.index ?? 0);
    const dedupeKey = `${line}:${trimmed}`;
    if (seenOnLine.has(dedupeKey)) continue;
    seenOnLine.add(dedupeKey);
    violations.push({
      file: relFile,
      line,
      status: 'needs_human_review',
      message:
        `literal JSX text "${trimmed.slice(0, 60)}" in loadSpec-importing component — ` +
        `promote to spec field label or move to an allowlisted attribute ` +
        `(${[...DEFAULT_ATTRIBUTE_ALLOWLIST].join(', ')}).`,
    });
  }
  return violations;
}

function driveIdViolation(
  cit: DiscoveredCitation,
): VerifyReportEntry {
  return {
    file: cit.file,
    line: cit.line,
    source: cit.source,
    status: 'drive_id_not_allowed',
    message: DRIVE_ID_ERROR_MESSAGE,
  };
}

function toRelForward(projectRoot: string, abs: string): string {
  const rel = relative(projectRoot, abs);
  return rel.split(/[/\\]/).join('/');
}

/**
 * Recursively discover wired content citations under `projectRoot` and run the Phase 1
 * lint + Drive-ID ban passes. Returns clean citations for downstream verify + a list of
 * policy violations typed as VerifyReportEntry (taxonomy statuses only, fail-closed).
 */
export async function discover(options: DiscoverOptions): Promise<DiscoverResult> {
  const projectRoot = resolve(options.projectRoot);
  const includeDirs = options.includeDirs ?? DEFAULT_INCLUDE_DIRS;

  const citations: DiscoveredCitation[] = [];
  const violations: VerifyReportEntry[] = [];

  const files: string[] = [];
  for (const dir of includeDirs) {
    await walk(join(projectRoot, dir), files);
  }
  files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const abs of files) {
    const relFile = toRelForward(projectRoot, abs);
    let content: string;
    try {
      content = await readFile(abs, 'utf8');
    } catch (err) {
      violations.push({
        file: relFile,
        status: 'extract_failed',
        message: `failed to read file: ${(err as Error).message}`,
      });
      continue;
    }

    const fileCitations = extractCitationsFromContent(content, relFile);
    for (const cit of fileCitations) {
      if (isDriveIdCitation(cit.source)) {
        violations.push(driveIdViolation(cit));
      } else {
        citations.push(cit);
      }
    }

    for (const v of lintJsxText(content, relFile)) {
      violations.push(v);
    }
  }

  return { citations, violations };
}
