import type { Field, SourceSpec, VerifyStatus } from './schemas';

export type DiffStatus = Extract<
  VerifyStatus,
  'pass' | 'field_drift' | 'needs_human_review'
>;

export interface DiffOptions {
  /**
   * Recall threshold — clean-matched fields / total expected fields.
   * Provisional for Session B; final value will be pinned by the accuracy
   * baseline in `docs/source-specs/_accuracy-baseline.yaml` (Step 8).
   */
  recallThreshold?: number;
  /**
   * Minimum per-field similarity for a match to count as "clean".
   * Scores in [driftThreshold, matchConfidenceThreshold) are "drifted":
   * present but lexically changed.
   */
  matchConfidenceThreshold?: number;
  /**
   * Minimum per-field similarity for a match to count at all. Scores below
   * this are treated as missing.
   */
  driftThreshold?: number;
  /** Cap on candidate lines surfaced in `actual_fields` for reviewer context. */
  maxCandidateLines?: number;
}

export interface DiffDrift {
  expected_fields?: string[];
  actual_fields?: string[];
  diff?: string[];
}

export interface DiffResult {
  status: DiffStatus;
  recall: number;
  drift?: DiffDrift;
}

export interface DiffInput {
  spec: SourceSpec;
  text: string;
}

export const DEFAULT_RECALL_THRESHOLD = 0.95;
export const DEFAULT_MATCH_CONFIDENCE = 0.85;
export const DEFAULT_DRIFT_THRESHOLD = 0.6;
export const DEFAULT_MAX_CANDIDATE_LINES = 50;

/** Flatten a spec's fields whether they live directly on the spec or under sections. */
export function collectSpecFields(spec: SourceSpec): Field[] {
  if (spec.fields?.length) return spec.fields;
  if (spec.sections?.length) return spec.sections.flatMap((s) => s.fields);
  return [];
}

/**
 * Lowercase, strip punctuation, collapse whitespace. Unicode-aware.
 * NFC-normalizes first so NFD input (e.g. from pdftotext) matches NFC input
 * (e.g. from a spec typed on a keyboard) — without this, combining marks
 * like U+0303 are treated as standalone non-letter codepoints and split the
 * word in two, producing a 0-score match against an identical NFC string.
 */
export function normalizeLabel(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/** Jaccard similarity on token sets; 1.0 for two empty inputs, 0 if only one is empty. */
function jaccardSim(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Best sliding-window match score of a normalized label against normalized text.
 * Returns 1.0 on a word-boundary-preserving substring match; otherwise max
 * jaccard similarity across token windows of width label-length.
 *
 * The word-boundary guard prevents short labels from scoring 1.0 on unrelated
 * substring hits (e.g. "age" inside "package"). Since normalizeLabel collapses
 * all separators to a single space, a whole-phrase match is equivalent to the
 * padded-with-spaces substring check below.
 */
export function bestMatchScore(labelNorm: string, textNorm: string): number {
  if (!labelNorm) return 0;
  if (!textNorm) return 0;
  if (labelNorm === textNorm) return 1;
  const paddedText = ` ${textNorm} `;
  const paddedLabel = ` ${labelNorm} `;
  if (paddedText.includes(paddedLabel)) return 1;
  const labelTokens = tokenize(labelNorm);
  const textTokens = tokenize(textNorm);
  if (labelTokens.length === 0 || textTokens.length === 0) return 0;
  const win = labelTokens.length;
  let best = 0;
  for (let i = 0; i < textTokens.length; i++) {
    const end = Math.min(i + win, textTokens.length);
    const window = textTokens.slice(i, end);
    const score = jaccardSim(labelTokens, window);
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

/** Deduped list of trimmed non-empty lines that could plausibly be labels. */
export function extractCandidateLines(text: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.length > 120) continue;
    if (!/\p{L}/u.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Fuzzy map a spec's fields against extracted PDF text and emit a verify
 * taxonomy status per Axis 3.
 *
 * Status decision:
 *   - `pass`                 — every field matches cleanly (score ≥ matchThreshold) AND recall ≥ recallThreshold.
 *   - `field_drift`          — every field has at least a drifted match (score ≥ driftThreshold), recall ≥ recallThreshold, but some matches are lexically drifted.
 *   - `needs_human_review`   — any field is below driftThreshold (effectively missing), OR recall is below threshold.
 */
export function diff(input: DiffInput, options: DiffOptions = {}): DiffResult {
  const recallThreshold = options.recallThreshold ?? DEFAULT_RECALL_THRESHOLD;
  const matchThreshold = options.matchConfidenceThreshold ?? DEFAULT_MATCH_CONFIDENCE;
  const driftThreshold = options.driftThreshold ?? DEFAULT_DRIFT_THRESHOLD;
  const maxCandidates = options.maxCandidateLines ?? DEFAULT_MAX_CANDIDATE_LINES;

  if (!(driftThreshold <= matchThreshold && matchThreshold <= 1)) {
    throw new Error(
      `invalid thresholds: drift=${driftThreshold}, match=${matchThreshold}`,
    );
  }

  const fields = collectSpecFields(input.spec);
  const textNorm = normalizeLabel(input.text);

  if (fields.length === 0) {
    return {
      status: 'needs_human_review',
      recall: 0,
      drift: { diff: ['spec defines no fields'] },
    };
  }

  const scored = fields.map((field) => ({
    field,
    score: bestMatchScore(normalizeLabel(field.label), textNorm),
  }));

  const clean: typeof scored = [];
  const drifted: typeof scored = [];
  const missing: typeof scored = [];
  for (const s of scored) {
    if (s.score >= matchThreshold) clean.push(s);
    else if (s.score >= driftThreshold) drifted.push(s);
    else missing.push(s);
  }

  const recall = clean.length / fields.length;
  const expected_fields = fields.map((f) => f.label);

  if (missing.length === 0 && drifted.length === 0 && recall >= recallThreshold) {
    return { status: 'pass', recall };
  }

  const diffLines: string[] = [];
  for (const d of drifted) {
    diffLines.push(
      `field drift: "${d.field.label}" (best score ${d.score.toFixed(2)})`,
    );
  }
  for (const m of missing) {
    diffLines.push(
      `missing: "${m.field.label}" (best score ${m.score.toFixed(2)})`,
    );
  }

  if (missing.length === 0 && recall >= recallThreshold) {
    return {
      status: 'field_drift',
      recall,
      drift: { expected_fields, diff: diffLines },
    };
  }

  return {
    status: 'needs_human_review',
    recall,
    drift: {
      expected_fields,
      actual_fields: extractCandidateLines(input.text, maxCandidates),
      diff: diffLines,
    },
  };
}
