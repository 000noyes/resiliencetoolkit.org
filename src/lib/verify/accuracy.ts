import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { dump } from 'js-yaml';
import {
  CacheCorruptedError,
  loadExtractionCache,
  loadSourceRegistry,
  saveExtractionCache,
} from './cache';
import {
  DEFAULT_MATCH_CONFIDENCE,
  bestMatchScore,
  collectSpecFields,
  extractCandidateLines,
  normalizeLabel,
} from './diff';
import { extract, ExtractionError, type ExtractOptions } from './extract';
import { loadSpec, SpecParseError } from './load-spec';
import { accuracyBaselineSchema, type SourceSpec } from './schemas';

export const RECALL_THRESHOLD = 0.95;

export const DEFAULT_MAX_CANDIDATE_LINES = 200;

export interface AccuracyMetrics {
  precision: number;
  recall: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  expected_field_count: number;
  extracted_candidate_count: number;
}

export interface AccuracyOptions {
  matchThreshold?: number;
  maxCandidateLines?: number;
}

/**
 * Score a human-authored ground-truth spec against extracted PDF text.
 *
 *   recall    = fraction of expected fields (ground truth) whose label matches
 *               the extracted text at or above `matchThreshold`.
 *   precision = fraction of extracted candidate lines (non-empty, non-boilerplate
 *               trimmed lines) that correspond to an expected field.
 *
 * Low recall = extraction is losing field labels (bad for the verify pipeline).
 * Low precision = PDF has lots of boilerplate relative to field labels, which
 *                 tells you how noisy the matcher's input is but does not itself
 *                 fail a verify run.
 */
export function measureAccuracy(
  spec: SourceSpec,
  extractedText: string,
  options: AccuracyOptions = {},
): AccuracyMetrics {
  const matchThreshold = options.matchThreshold ?? DEFAULT_MATCH_CONFIDENCE;
  const maxCandidates = options.maxCandidateLines ?? DEFAULT_MAX_CANDIDATE_LINES;
  const fields = collectSpecFields(spec);
  const textNorm = normalizeLabel(extractedText);

  let tp = 0;
  for (const f of fields) {
    if (bestMatchScore(normalizeLabel(f.label), textNorm) >= matchThreshold) tp++;
  }
  const fn = fields.length - tp;
  const recall = fields.length > 0 ? tp / fields.length : 0;

  const candidates = extractCandidateLines(extractedText, maxCandidates);
  const expectedLabels = fields.map((f) => normalizeLabel(f.label));
  let candidateMatches = 0;
  for (const cand of candidates) {
    const candNorm = normalizeLabel(cand);
    if (candNorm === '') continue;
    if (expectedLabels.some((lbl) => bestMatchScore(lbl, candNorm) >= matchThreshold)) {
      candidateMatches++;
    }
  }
  const fp = candidates.length - candidateMatches;
  const precision = candidates.length > 0 ? candidateMatches / candidates.length : 0;

  return {
    precision,
    recall,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    expected_field_count: fields.length,
    extracted_candidate_count: candidates.length,
  };
}

export class AccuracyError extends Error {
  readonly status:
    | 'spec_parse_error'
    | 'source_not_found'
    | 'extract_failed'
    | 'cache_corrupted';
  readonly code?: string;
  constructor(message: string, status: AccuracyError['status'], code?: string) {
    super(message);
    this.name = 'AccuracyError';
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export interface AccuracyRunInput {
  /** Template key for the baseline entry, e.g. "leader-directory". */
  template: string;
  /** Absolute or project-root-relative path to the ground-truth spec .md. */
  specPath: string;
}

export interface AccuracyRunOutcome {
  template: string;
  specPath: string;
  pdf: string;
  metrics: AccuracyMetrics;
  measured_at: string;
}

export interface RunAccuracyOptions {
  projectRoot: string;
  inputs: readonly AccuracyRunInput[];
  /** Emit YAML to this path (repo-relative). Default: docs/source-specs/_accuracy-baseline.yaml. */
  outRelPath?: string;
  /** Persist the extraction cache after the run. Default true. */
  saveCache?: boolean;
  extractOptions?: ExtractOptions;
  accuracyOptions?: AccuracyOptions;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
}

export interface RunAccuracyResult {
  outcomes: AccuracyRunOutcome[];
  outAbsolutePath: string;
  outRelPath: string;
  yaml: string;
  cacheSaved: boolean;
  /** `true` when every template measured recall >= RECALL_THRESHOLD. */
  meetsThreshold: boolean;
}

/**
 * Run the accuracy baseline spike: for each input spec, load the ground-truth
 * fields, extract the cited PDF, compute precision/recall, and emit a
 * committed YAML baseline file keyed by template.
 *
 * One-shot. Not part of the per-request verify pipeline. Intended to validate
 * that the 0.95 recall threshold locked in `DEFAULT_RECALL_THRESHOLD` is
 * achievable against real templates before we require it in CI.
 */
export async function runAccuracyMeasurement(
  options: RunAccuracyOptions,
): Promise<RunAccuracyResult> {
  const projectRoot = resolve(options.projectRoot);
  const outRelPath =
    options.outRelPath ?? 'docs/source-specs/_accuracy-baseline.yaml';
  const outAbsolutePath = resolve(projectRoot, outRelPath);
  const clock = options.now ?? (() => new Date());
  const saveCache = options.saveCache !== false;

  let cache;
  try {
    await loadSourceRegistry(projectRoot);
    cache = await loadExtractionCache(projectRoot);
  } catch (e) {
    if (e instanceof CacheCorruptedError) {
      throw new AccuracyError(
        `${e.message} (quarantined to ${e.quarantinePath})`,
        'cache_corrupted',
      );
    }
    throw e;
  }

  const outcomes: AccuracyRunOutcome[] = [];
  for (const input of options.inputs) {
    const specAbsolute = resolve(projectRoot, input.specPath);
    let loaded;
    try {
      loaded = await loadSpec(specAbsolute);
    } catch (e) {
      if (e instanceof SpecParseError) {
        throw new AccuracyError(`${input.specPath}: ${e.message}`, e.status);
      }
      throw e;
    }

    const pdfRel = loaded.spec.citation.source;
    const pdfAbsolute = resolve(projectRoot, pdfRel);
    if (!existsSync(pdfAbsolute)) {
      throw new AccuracyError(
        `${input.specPath} cites ${pdfRel} which does not exist`,
        'source_not_found',
      );
    }

    let outcome;
    try {
      outcome = await extract({
        absolutePath: pdfAbsolute,
        page: loaded.spec.citation.page,
        cache,
        options: options.extractOptions,
      });
    } catch (e) {
      if (e instanceof ExtractionError) {
        throw new AccuracyError(
          `${input.specPath}: ${e.message}`,
          e.status === 'source_not_found' ? 'source_not_found' : 'extract_failed',
          e.code,
        );
      }
      throw e;
    }
    cache = outcome.cache;

    const metrics = measureAccuracy(
      loaded.spec,
      outcome.result.text,
      options.accuracyOptions,
    );
    outcomes.push({
      template: input.template,
      specPath: input.specPath,
      pdf: pdfRel,
      metrics,
      measured_at: clock().toISOString(),
    });
  }

  const baseline: Record<string, { precision: number; recall: number; measured_at: string }> = {};
  for (const o of outcomes) {
    baseline[o.template] = {
      precision: Number(o.metrics.precision.toFixed(4)),
      recall: Number(o.metrics.recall.toFixed(4)),
      measured_at: o.measured_at,
    };
  }
  const payload = accuracyBaselineSchema.parse({ baselines: baseline });

  const header = [
    '# Accuracy baseline for the /verify-against-source extraction pipeline.',
    '# Emitted by scripts/measure-extraction-accuracy.ts. Per-template precision/recall',
    `# vs. human-authored ground-truth specs. Recall threshold pinned at ${RECALL_THRESHOLD}`,
    '# (see DEFAULT_RECALL_THRESHOLD in src/lib/verify/diff.ts). Re-run when templates change.',
    '',
  ].join('\n');
  const yaml = header + dump(payload, { sortKeys: true, noRefs: true, lineWidth: 1000 });

  await mkdir(dirname(outAbsolutePath), { recursive: true });
  await writeFile(outAbsolutePath, yaml, 'utf-8');

  let cacheSaved = false;
  if (saveCache) {
    await saveExtractionCache(cache, projectRoot);
    cacheSaved = true;
  }

  const meetsThreshold = outcomes.every((o) => o.metrics.recall >= RECALL_THRESHOLD);

  return {
    outcomes,
    outAbsolutePath,
    outRelPath,
    yaml,
    cacheSaved,
    meetsThreshold,
  };
}
