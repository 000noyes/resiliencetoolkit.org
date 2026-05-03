import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  ExtractionCache,
  SourceRegistry,
  SourceSpec,
  VerifyReportEntry,
  VerifyStatus,
} from './schemas';
import { registryPageKey } from './schemas';
import { runDay5aChecks } from './runner-checks';
import {
  CacheCorruptedError,
  checkSourceFreshness,
  loadExtractionCache,
  loadSourceRegistry,
  saveExtractionCache,
  type SourceFreshness,
} from './cache';
import { discover, type DiscoveredCitation } from './discover';
import { extract, ExtractionError, type ExtractOptions } from './extract';
import { diff } from './diff';
import { loadSpec, SpecParseError } from './load-spec';

const execFileAsync = promisify(execFile);

export type TargetSelector =
  | { kind: 'all' }
  | { kind: 'target'; pattern: string }
  | { kind: 'since'; ref: string };

export type GitSinceFn = (ref: string, projectRoot: string) => Promise<string[]>;

export interface RunVerifyOptions {
  projectRoot: string;
  selector: TargetSelector;
  failOnNeedsReview?: boolean;
  extractOptions?: ExtractOptions;
  gitSinceFn?: GitSinceFn;
  /** Default true. Set false in tests to skip disk writes of the cache file. */
  saveCache?: boolean;
}

export interface RunVerifyResult {
  entries: VerifyReportEntry[];
  exitCode: 0 | 1 | 2;
  cacheSaved: boolean;
}

/**
 * Statuses that raise the exit code to 2 (infra / hard error). The CLI
 * continues past other statuses and keeps collecting report entries; an
 * infra error is terminal.
 */
const INFRA_STATUSES: ReadonlySet<VerifyStatus> = new Set(['cache_corrupted']);

/**
 * Statuses that always fail the verify run (exit code 1). needs_human_review
 * and source_drift are intentionally excluded — they are soft statuses that
 * only fail the run under --fail-on-needs-review (see SOFT_FAIL_STATUSES).
 *
 * Why source_drift is soft: per the ResilienceToolkit constitution, raw-byte
 * drift alone (same normalized text) is an advisory — the operator should
 * re-scaffold or update the registry, but the rendered content is unchanged.
 * Only content_drift (normalized text moved) is a hard fail.
 */
const FAIL_STATUSES: ReadonlySet<VerifyStatus> = new Set([
  'missing_citation',
  'source_not_found',
  'source_unregistered',
  'content_drift',
  'field_drift',
  'extract_failed',
  'vision_api_failed',
  'spec_parse_error',
  'drive_id_not_allowed',
  // Day-5 additions — all hard fails (no --fail-on-needs-review opt-in).
  // Walk evidence shows these represent real fidelity breaks that block
  // 1a class-a status, so they must count toward exit code 1.
  'link_drift',
  'link_missing',
  'link_type_mismatch',
  'title_drift',
  'structural_fidelity_failed',
  'key_drift',
  'prose_drift',
]);

/**
 * Statuses that are soft by default and fail only when the operator opts in
 * via --fail-on-needs-review. source_drift sits alongside needs_human_review
 * because both are "human should look at this, but the build is not broken".
 */
const SOFT_FAIL_STATUSES: ReadonlySet<VerifyStatus> = new Set([
  'needs_human_review',
  'source_drift',
]);

/**
 * Convert a glob pattern to a regex. Supports `*` (any non-separator chars)
 * and `**` (any chars including separators). Escapes regex metacharacters so
 * patterns like `src/pages/*.astro` work as expected.
 */
export function globToRegex(glob: string): RegExp {
  let pat = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    const next = glob[i + 1];
    if (c === '*' && next === '*') {
      pat += '.*';
      i++;
    } else if (c === '*') {
      pat += '[^/]*';
    } else if (/[.+?^${}()|[\]\\]/.test(c)) {
      pat += '\\' + c;
    } else {
      pat += c;
    }
  }
  return new RegExp('^' + pat + '$');
}

export function matchesSelector(
  file: string,
  selector: TargetSelector,
  changedFiles: ReadonlySet<string>,
): boolean {
  switch (selector.kind) {
    case 'all':
      return true;
    case 'target':
      return globToRegex(selector.pattern).test(file);
    case 'since':
      return changedFiles.has(file);
  }
}

async function defaultGitSince(ref: string, projectRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', projectRoot, 'diff', '--name-only', `${ref}...HEAD`],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

interface VerifyStepResult {
  entry: VerifyReportEntry;
  nextCache: ExtractionCache;
  /**
   * The parsed spec when load-spec succeeded. Absent when the early
   * parse/freshness path emitted the entry — in that case the day-5 checks
   * are skipped (we don't have a spec to compare against).
   */
  spec?: SourceSpec;
  /**
   * pdftotext extraction of the cited page(s). Populated only on the clean
   * diff path — source_not_found, unregistered, content_drift, source_drift,
   * and extract_failed all return BEFORE this is filled. `proseMatches`
   * consumes this when present; absent means prose check silently skips,
   * which is the correct behavior (no ground truth to compare against).
   */
  extractedText?: string;
}

/**
 * Collapse the two terminal pre-extract freshness states (source_not_found
 * and unregistered) into a single VerifyReportEntry, or return null if
 * verifySpecMd should continue to extract — this includes both the 'fresh'
 * state and 'source_drift'. Why source_drift passes through: the
 * ResilienceToolkit constitution says raw-byte drift ALONE is a soft
 * advisory, but drift accompanied by content change is a hard content_drift
 * fail. Deciding that requires extracting the PDF and comparing hashes, so
 * this helper punts source_drift to the caller.
 */
function evaluateFreshness(
  citation: DiscoveredCitation,
  freshness: SourceFreshness,
  pdfRel: string,
): VerifyReportEntry | null {
  if (freshness.state === 'source_not_found') {
    return {
      file: citation.file,
      line: citation.line,
      source: citation.source,
      status: 'source_not_found',
      message: `source file not found: ${pdfRel}`,
    };
  }
  if (freshness.state === 'unregistered') {
    return {
      file: citation.file,
      line: citation.line,
      source: citation.source,
      status: 'source_unregistered',
      message: `${pdfRel}: not registered in docs/source-specs/_sources.yaml — run scaffold-spec to register`,
    };
  }
  return null;
}

async function verifySpecMd(
  citation: DiscoveredCitation,
  projectRoot: string,
  cache: ExtractionCache,
  registry: SourceRegistry,
  extractOptions: ExtractOptions | undefined,
): Promise<VerifyStepResult> {
  const specAbsolute = resolve(projectRoot, citation.source);

  let loaded;
  try {
    loaded = await loadSpec(specAbsolute);
  } catch (e) {
    const err = e as SpecParseError;
    return {
      entry: {
        file: citation.file,
        line: citation.line,
        source: citation.source,
        status: err.status ?? 'spec_parse_error',
        message: err.message,
      },
      nextCache: cache,
    };
  }

  const pdfRel = loaded.spec.citation.source;
  const pdfAbsolute = resolve(projectRoot, pdfRel);
  const pageFromSpec = loaded.spec.citation.page;

  const freshness = await checkSourceFreshness(registry, pdfAbsolute, pdfRel, pageFromSpec);
  const freshnessEntry = evaluateFreshness(citation, freshness, pdfRel);
  if (freshnessEntry) {
    return { entry: freshnessEntry, nextCache: cache };
  }

  let outcome;
  try {
    outcome = await extract({
      absolutePath: pdfAbsolute,
      page: pageFromSpec,
      cache,
      options: extractOptions,
    });
  } catch (e) {
    const err = e as ExtractionError;
    return {
      entry: {
        file: citation.file,
        line: citation.line,
        source: citation.source,
        status: err.status ?? 'extract_failed',
        message: err.message,
      },
      nextCache: cache,
    };
  }

  // Post-extract hash comparison, per the RT constitution:
  //   content_hash drift = hard fail (text moved — diff would lie).
  //   source_hash drift alone (content_hash unchanged) = soft advisory.
  // Both 'fresh' and 'source_drift' reach here; they branch on the
  // content_hash comparison. 'source_drift' + matching content_hash degrades
  // to needs-review (the operator should re-register, but rendered content
  // is unchanged). 'source_drift' + drifted content_hash escalates to
  // content_drift — the source_drift alone rule does NOT apply.
  if (freshness.state === 'fresh' || freshness.state === 'source_drift') {
    // Resolve the registered hash for this page. For 'fresh' the lookup
    // already happened. For 'source_drift' (raw bytes moved) we still
    // consult entry.content_hashes so a content move that LANDS on
    // top of a source-bytes change escalates to content_drift (the
    // hard fail), not the soft source_drift advisory.
    const registeredPageHash =
      freshness.state === 'fresh'
        ? freshness.pageContentHash
        : freshness.entry.content_hashes[registryPageKey(pageFromSpec)];
    const contentDrifted =
      registeredPageHash !== undefined &&
      outcome.result.content_hash !== registeredPageHash;
    if (contentDrifted) {
      return {
        entry: {
          file: citation.file,
          line: citation.line,
          source: citation.source,
          status: 'content_drift',
          message: `${pdfRel}: extracted content hash differs from registered hash — PDF text has moved; re-scaffold after reviewing`,
        },
        nextCache: outcome.cache,
        spec: loaded.spec,
      };
    }
    if (freshness.state === 'source_drift') {
      return {
        entry: {
          file: citation.file,
          line: citation.line,
          source: citation.source,
          status: 'source_drift',
          message: `${pdfRel}: source bytes changed since last registration but normalized text is unchanged — re-scaffold or update registry`,
        },
        nextCache: outcome.cache,
        spec: loaded.spec,
      };
    }
  }

  const result = diff({ spec: loaded.spec, text: outcome.result.text });
  return {
    entry: {
      file: citation.file,
      line: citation.line,
      source: citation.source,
      status: result.status,
      message:
        result.status === 'pass' ? undefined : `recall=${result.recall.toFixed(2)}`,
      drift: result.drift,
    },
    nextCache: outcome.cache,
    spec: loaded.spec,
    extractedText: outcome.result.text,
  };
}

async function verifyRawSource(
  citation: DiscoveredCitation,
  projectRoot: string,
  registry: SourceRegistry,
): Promise<VerifyReportEntry> {
  const absolute = resolve(projectRoot, citation.source);
  const freshness = await checkSourceFreshness(registry, absolute, citation.source);
  const freshnessEntry = evaluateFreshness(citation, freshness, citation.source);
  if (freshnessEntry) return freshnessEntry;
  return {
    file: citation.file,
    line: citation.line,
    source: citation.source,
    status: 'pass',
  };
}

function computeExitCode(
  entries: readonly VerifyReportEntry[],
  failOnNeedsReview: boolean,
): 0 | 1 | 2 {
  let code: 0 | 1 | 2 = 0;
  for (const e of entries) {
    if (INFRA_STATUSES.has(e.status)) return 2;
    if (FAIL_STATUSES.has(e.status)) code = 1;
    else if (SOFT_FAIL_STATUSES.has(e.status) && failOnNeedsReview) code = 1;
  }
  return code;
}

/**
 * Compose cache → discover → (per-citation) load-spec → extract → diff into
 * an ordered list of VerifyReportEntry. Fail-closed throughout:
 * CacheCorruptedError short-circuits to a single `cache_corrupted` entry with
 * exit code 2; SpecParseError / ExtractionError map to their taxonomy status
 * without aborting the run (other citations still get checked).
 */
export async function runVerify(options: RunVerifyOptions): Promise<RunVerifyResult> {
  const projectRoot = resolve(options.projectRoot);
  const failOnNeedsReview = Boolean(options.failOnNeedsReview);
  const saveCache = options.saveCache !== false;

  let registry: SourceRegistry;
  let cache: ExtractionCache;
  try {
    registry = await loadSourceRegistry(projectRoot);
    cache = await loadExtractionCache(projectRoot);
  } catch (e) {
    if (e instanceof CacheCorruptedError) {
      return {
        entries: [
          {
            file: '_sources.yaml | _extraction-cache.yaml',
            status: 'cache_corrupted',
            message: `${e.message} (quarantined to ${e.quarantinePath})`,
          },
        ],
        exitCode: 2,
        cacheSaved: false,
      };
    }
    throw e;
  }

  const { citations, violations } = await discover({ projectRoot });

  let changedFiles: ReadonlySet<string> = new Set();
  if (options.selector.kind === 'since') {
    const gitFn = options.gitSinceFn ?? defaultGitSince;
    const changed = await gitFn(options.selector.ref, projectRoot);
    changedFiles = new Set(changed);
  }

  const selectedCitations = citations.filter((c) =>
    matchesSelector(c.file, options.selector, changedFiles),
  );
  const selectedViolations = violations.filter((v) =>
    matchesSelector(v.file ?? '', options.selector, changedFiles),
  );

  const entries: VerifyReportEntry[] = [...selectedViolations];

  // Memoize wired-file reads so multiple citations in one file don't re-open
  // the source on disk. Keyed by relative file path (citation.file).
  const siteContentCache = new Map<string, string | null>();
  async function readSiteContent(relFile: string): Promise<string | null> {
    if (siteContentCache.has(relFile)) return siteContentCache.get(relFile) ?? null;
    try {
      const text = await readFile(resolve(projectRoot, relFile), 'utf-8');
      siteContentCache.set(relFile, text);
      return text;
    } catch {
      siteContentCache.set(relFile, null);
      return null;
    }
  }

  for (const cit of selectedCitations) {
    if (cit.source.toLowerCase().endsWith('.md')) {
      const { entry, nextCache, spec, extractedText } = await verifySpecMd(
        cit,
        projectRoot,
        cache,
        registry,
        options.extractOptions,
      );
      entries.push(entry);
      cache = nextCache;
      // Day-5 site-side checks run whenever load-spec succeeded, independent
      // of the diff result — an invented heading is an invented heading even
      // if the fields diff passes. See runner-checks.ts for per-check rationale.
      // proseMatches additionally requires extractedText (populated on the
      // clean diff path only); absent → the check silently no-ops.
      if (spec) {
        const siteContent = await readSiteContent(cit.file);
        if (siteContent !== null) {
          const checkEntries = runDay5aChecks({
            spec,
            file: cit.file,
            citationLine: cit.line,
            siteContent,
            source: cit.source,
            extractedText,
          });
          entries.push(...checkEntries);
        }
      }
    } else {
      entries.push(await verifyRawSource(cit, projectRoot, registry));
    }
  }

  let cacheSaved = false;
  if (saveCache) {
    await saveExtractionCache(cache, projectRoot);
    cacheSaved = true;
  }

  return {
    entries,
    exitCode: computeExitCode(entries, failOnNeedsReview),
    cacheSaved,
  };
}
