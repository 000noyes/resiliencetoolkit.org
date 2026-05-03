/**
 * Day-5 runner checks (part of Step 1a — see checkpoint
 * ~/.gstack/projects/000noyes-resiliencetoolkit.org/checkpoints/
 *   step1a-inventory-walk-complete-20260424.md).
 *
 * Each check is a pure function: given a spec, the wired component's source,
 * and the source file path, return zero or more VerifyReportEntry. The runner
 * appends these after the existing spec+pdftotext diff pass. Checks never
 * mutate shared state and never throw — an unparseable site artifact returns
 * `needs_human_review` rather than aborting the run.
 *
 * Included in day-5a:
 *   - `linksMatch`   — external_url + internal_route, normalized comparison.
 *                      Emits link_drift / link_missing / link_type_mismatch.
 *   - `titleMatches` — section title + h2/h3 subheadings verbatim.
 *                      Emits title_drift.
 *   - `keysMatch`    — DataTable column key/label alignment with spec fields.
 *                      Emits key_drift.
 *
 * Added in day-5b:
 *   - `structuralFidelityMatches` — N workbook tables → N site components
 *                                   (DataTable + PlanForm sum).
 *                                   Emits structural_fidelity_failed.
 *   - `proseMatches`              — site <p>/<li> text must be grounded in
 *                                   pdftotext extraction (precision-first).
 *                                   Emits prose_drift.
 */

import { moduleDownloads } from '@/data/downloads';
import type {
  SourceSpec,
  SpecLink,
  VerifyReportEntry,
  VerifyStatus,
} from './schemas';
import { bestMatchScore, collectSpecFields, normalizeLabel } from './diff';
import { normalizeUrl } from './normalize-url';
import {
  extractDataTables,
  extractHeadings,
  extractLinks,
  extractParagraphs,
  extractPlanForms,
  extractSectionNumber,
  type SiteColumn,
  type SiteLink,
} from './site-parse';

export interface CheckContext {
  spec: SourceSpec;
  /** Path (relative to project root, forward slashes) of the wired component file. */
  file: string;
  /** 1-indexed line of the citation in the wired file (for stable report line numbers). */
  citationLine: number;
  /** Full source text of the wired file. */
  siteContent: string;
  /** Source path (e.g. docs/source-specs/foo.md) — passed through to report entries. */
  source: string;
  /**
   * pdftotext extraction of the cited workbook page(s), if already resolved
   * by the runner. `proseMatches` needs this; every other check ignores it.
   * Absent → `proseMatches` no-ops (can't compare against nothing).
   */
  extractedText?: string;
}

function entry(
  ctx: CheckContext,
  status: VerifyStatus,
  message: string,
  line?: number,
): VerifyReportEntry {
  return {
    file: ctx.file,
    line: line ?? ctx.citationLine,
    source: ctx.source,
    status,
    message,
  };
}

// ---------------------------------------------------------------------------
// linksMatch
// ---------------------------------------------------------------------------

/**
 * For each `spec.links[]` entry, determine whether the wired component emits
 * a matching `<a href>` / `<ExternalLink href>`.
 *
 * Failure modes (Step 1a walk evidence in parens):
 *   - link_missing       — spec URL is absent from the site and no heuristic
 *                          anchor-text match exists
 *                          (1-7 public-bathrooms-directory drop).
 *   - link_drift         — a link with matching anchor_text but a different
 *                          normalized URL is present
 *                          (2-1 Drift Dusters URL substitution).
 *   - link_type_mismatch — spec is `internal_route`, but the site emits an
 *                          external URL that aliases the workbook's
 *                          `*.html#N` anchor instead of the `/modules/...` route
 *                          (1-5 14BP-QH2d class-c link-type substitution).
 *
 * A spec link with `kind` absent is treated as `external_url` — preserves
 * day-1.5 behavior for links already shipped.
 */
export function linksMatch(ctx: CheckContext): VerifyReportEntry[] {
  const specLinks = ctx.spec.links ?? [];
  if (specLinks.length === 0) return [];

  const siteLinks = extractLinks(ctx.siteContent);

  const out: VerifyReportEntry[] = [];
  for (const specLink of specLinks) {
    const kind = specLink.kind ?? 'external_url';
    if (kind === 'internal_route') {
      out.push(...checkInternalRouteLink(ctx, specLink, siteLinks));
    } else {
      out.push(...checkExternalUrlLink(ctx, specLink, siteLinks));
    }
  }
  return out;
}

function checkInternalRouteLink(
  ctx: CheckContext,
  specLink: SpecLink,
  siteLinks: readonly SiteLink[],
): VerifyReportEntry[] {
  // internal_route spec URL is the authoritative site-internal route
  // (e.g. "/modules/emergency-preparedness/1-5"). The site must emit an
  // href that equals or prefix-matches it. An href that looks like the
  // workbook's Drive-hosted `*.html#N` anchor — meaning http(s)://
  // whose path ends in `.html` or whose hostname is a Drive host — is a
  // link-type substitution: class-c per the walk, emit link_type_mismatch.
  const route = specLink.url;
  for (const s of siteLinks) {
    if (s.href === route) return [];
    if (s.href.startsWith(route + '/') || s.href.startsWith(route + '#')) return [];
  }
  // No matching internal route. Look for an external Drive-style anchor as
  // a likely class-c substitution.
  const substitute = siteLinks.find((s) => looksLikeDriveHtmlAnchor(s.href));
  if (substitute) {
    return [
      entry(
        ctx,
        'link_type_mismatch',
        `spec expects internal_route "${route}" but site emits external anchor "${substitute.href}"` +
          (specLink.label ? ` (label: "${specLink.label}")` : ''),
        substitute.line,
      ),
    ];
  }
  return [
    entry(
      ctx,
      'link_missing',
      `spec expects internal_route "${route}" — no matching href found in ${ctx.file}`,
    ),
  ];
}

function checkExternalUrlLink(
  ctx: CheckContext,
  specLink: SpecLink,
  siteLinks: readonly SiteLink[],
): VerifyReportEntry[] {
  const expected = normalizeUrl(specLink.url);
  // Clean match: any site link with the same normalized URL.
  if (siteLinks.some((s) => normalizeUrl(s.href) === expected)) return [];

  // Drift heuristic: a site link with matching anchor_text but different URL.
  // The walk's 2-1 Drift Dusters finding is exactly this shape — the site
  // chose SAMHSA vs workbook's VTSOS, same intent, different destination.
  if (specLink.label) {
    const labelNorm = specLink.label.trim().toLowerCase();
    const drifted = siteLinks.find(
      (s) => (s.anchor_text ?? '').trim().toLowerCase() === labelNorm,
    );
    if (drifted) {
      return [
        entry(
          ctx,
          'link_drift',
          `spec label "${specLink.label}" points to "${specLink.url}"; site renders different href "${drifted.href}"`,
          drifted.line,
        ),
      ];
    }
  }

  if (matchesModuleResourcesUrl(ctx, expected)) return [];

  return [
    entry(
      ctx,
      'link_missing',
      `spec link "${specLink.url}"${specLink.label ? ` ("${specLink.label}")` : ''} not present in ${ctx.file}`,
    ),
  ];
}

function matchesModuleResourcesUrl(ctx: CheckContext, expected: string): boolean {
  const sectionNumber = extractSectionNumber(ctx.siteContent);
  if (!sectionNumber) return false;

  const module = moduleDownloads.find((m) => m.number === sectionNumber);
  const resourcesUrl = module?.resourcesUrl;
  if (!resourcesUrl) return false;

  return normalizeUrl(resourcesUrl) === expected;
}

const DRIVE_HOST_RE = /\b(?:drive|docs)\.google\.com\b/i;
const HTML_ANCHOR_RE = /\.html(?:#|$)/i;

function looksLikeDriveHtmlAnchor(href: string): boolean {
  try {
    const u = new URL(href);
    if (DRIVE_HOST_RE.test(u.hostname)) return true;
    if (HTML_ANCHOR_RE.test(u.pathname + u.hash)) return true;
  } catch {
    // not a parseable absolute URL — ignore.
  }
  return false;
}

// ---------------------------------------------------------------------------
// titleMatches
// ---------------------------------------------------------------------------

/**
 * Assert that every h1/h2/h3 rendered in the wired component either matches
 * `spec.title` or appears in `spec.subheadings[]`. Anything else is an
 * invented heading — class-c per Step 1a — and emits `title_drift`.
 *
 * Walk-observed cases: 1-5 invented "Activate, staff..." row-header; 1-12
 * invented "Mutual Aid Tenets & Checklist"; 1-13 invented h2; 2-1 invented
 * chapter intro heading.
 *
 * This check is STRICT about the h1 being present but tolerant about
 * subheadings being absent: a missing subheading is caught by other checks
 * (structural_fidelity, prose_drift) or by manual review. It is the
 * invention direction that this check specifically guards.
 */
export function titleMatches(ctx: CheckContext): VerifyReportEntry[] {
  const headings = extractHeadings(ctx.siteContent);
  if (headings.length === 0) return [];

  const expected = new Set<string>();
  expected.add(normalizeHeading(ctx.spec.title));
  for (const sub of ctx.spec.subheadings ?? []) {
    expected.add(normalizeHeading(sub.text));
  }

  const out: VerifyReportEntry[] = [];
  let sawTitle = false;
  for (const h of headings) {
    const norm = normalizeHeading(h.text);
    if (norm === normalizeHeading(ctx.spec.title)) {
      sawTitle = true;
      continue;
    }
    if (expected.has(norm)) continue;
    out.push(
      entry(
        ctx,
        'title_drift',
        `invented h${h.level} "${h.text}" not in spec.title or spec.subheadings`,
        h.line,
      ),
    );
  }
  if (!sawTitle) {
    out.push(
      entry(
        ctx,
        'title_drift',
        `spec.title "${ctx.spec.title}" not found as any heading in ${ctx.file}`,
      ),
    );
  }
  return out;
}

function normalizeHeading(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ---------------------------------------------------------------------------
// keysMatch
// ---------------------------------------------------------------------------

/**
 * Validate DataTable column alignment with the spec's field list.
 *
 * Day-5a policy (keeps the check focused and committable):
 *   - Only runs when the spec has fields (not section-grouped fields — those
 *     need a tableId mapping story that is 5b/day-9 work).
 *   - When `spec.tableId` is set (day-15-i): filter site DataTables to those
 *     whose authored `tableId` prop equals the spec's value. Resolves the
 *     ambiguous case where two same-column-count tables share a file
 *     (1-9 Leader + Neighbor are both 4-col). When absent: fall back to
 *     column-count-only matching, preserving day-1.5 behavior for the 5
 *     shipped specs that ship without a tableId field.
 *   - If the tableId narrows to zero candidates, emit `key_drift` so the
 *     reviewer sees the rename/removal explicitly (silent failure here
 *     would let class-c table renames through the firewall).
 *   - If multiple candidates STILL match after tableId filtering (two site
 *     DataTables with identical tableId — a site authoring bug), emit
 *     `key_drift` with the ambiguous-mapping message.
 *   - Compares column.label (or .key when label is absent) against
 *     field.label, case-insensitively and whitespace-collapsed. Order-strict.
 *
 * A non-matching column emits `key_drift`; a missing DataTable (column-count
 * fallback path with zero matches) is silent — may be a spec that feeds a
 * PlanForm rather than a DataTable, handled by other checks. The tableId
 * path does NOT short-circuit on `tables.length === 0` — a spec that names a
 * tableId is asserting "this file must render a DataTable with this id";
 * deleting every DataTable from the file must surface as `key_drift`, not
 * silently pass (codex-review finding on day-15-i, fixed in follow-up).
 */
export function keysMatch(ctx: CheckContext): VerifyReportEntry[] {
  const fields = collectSpecFields(ctx.spec);
  if (fields.length === 0) return [];
  // Section-grouped specs → defer (see docstring).
  if (ctx.spec.sections?.length) return [];

  const tables = extractDataTables(ctx.siteContent);
  // No `tables.length === 0` short-circuit here — the downstream
  // `matches.length === 0` branches handle the empty case correctly: the
  // tableId path emits `key_drift` (intended firewall), the column-count
  // fallback returns silent (preserves day-1.5 PlanForm-friendly behavior).

  const specTableId = ctx.spec.tableId;
  let matches: ReturnType<typeof extractDataTables>;
  if (specTableId !== undefined) {
    matches = tables.filter((t) => t.tableId === specTableId);
    if (matches.length === 0) {
      return [
        entry(
          ctx,
          'key_drift',
          `spec.tableId "${specTableId}" has no matching DataTable in ${ctx.file}`,
        ),
      ];
    }
    if (matches.length > 1) {
      return [
        entry(
          ctx,
          'key_drift',
          `ambiguous DataTable mapping: ${matches.length} tables in ${ctx.file} share tableId "${specTableId}"`,
        ),
      ];
    }
    if (matches[0].columns.length !== fields.length) {
      return [
        entry(
          ctx,
          'key_drift',
          `DataTable tableId="${specTableId}" has ${matches[0].columns.length} columns but spec defines ${fields.length} fields`,
          matches[0].line,
        ),
      ];
    }
  } else {
    matches = tables.filter((t) => t.columns.length === fields.length);
    if (matches.length === 0) {
      // No table with matching column count — could be a PlanForm or a
      // layout mismatch. `structuralFidelityMatches` (5b) catches this
      // direction; here we stay silent to avoid double-reporting.
      return [];
    }
    if (matches.length > 1) {
      return [
        entry(
          ctx,
          'key_drift',
          `ambiguous DataTable mapping: ${matches.length} tables in ${ctx.file} have ${fields.length} columns; add tableId disambiguation to the spec`,
        ),
      ];
    }
  }
  const table = matches[0];
  const out: VerifyReportEntry[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const col = table.columns[i];
    const siteLabel = (col.label ?? col.key).trim();
    const siteNorm = normalizeHeading(siteLabel);
    const specNorm = normalizeHeading(field.label);
    if (siteNorm !== specNorm) {
      out.push(
        entry(
          ctx,
          'key_drift',
          `DataTable column ${i + 1} "${siteLabel}" does not match spec field label "${field.label}"`,
          table.line,
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// structuralFidelityMatches
// ---------------------------------------------------------------------------

/**
 * Assert that the number of primary data-bearing components rendered on the
 * site equals `spec.structural_fidelity.table_count`. Counts both
 * `<DataTable>` and `<PlanForm>` (the two authored data-bearing components on
 * this site; directory-tables historically used raw `<table>` but are now
 * DataTable-backed so are already covered).
 *
 * Walk case: 1-8 Populations with Specific Needs — the workbook authors ONE
 * Seniors+Disabilities planning table; the site splits it into TWO
 * DataTables. The spec asserts `table_count: 1`; the check observes 2;
 * result: `structural_fidelity_failed` blocking class-a status for 1-8.
 *
 * Silent when `spec.structural_fidelity` is absent — this is a cite-on-demand
 * assertion, not a universal requirement. A future spec that cares about
 * component count must opt in.
 *
 * Non-goal: this check does not verify WHICH tables correspond to which
 * workbook section — `keysMatch` (single-table) and day-9 (multi-table
 * tableId mapping) handle that.
 */
export function structuralFidelityMatches(ctx: CheckContext): VerifyReportEntry[] {
  const sf = ctx.spec.structural_fidelity;
  if (!sf) return [];

  const tables = extractDataTables(ctx.siteContent);
  const forms = extractPlanForms(ctx.siteContent);
  const observed = tables.length + forms.length;
  if (observed === sf.table_count) return [];

  const desc = sf.description ? ` — ${sf.description}` : '';
  return [
    entry(
      ctx,
      'structural_fidelity_failed',
      `spec.structural_fidelity.table_count=${sf.table_count} but ${ctx.file} renders ${observed} data-bearing component(s) (${tables.length} DataTable + ${forms.length} PlanForm)${desc}`,
    ),
  ];
}

// ---------------------------------------------------------------------------
// proseMatches
// ---------------------------------------------------------------------------

/**
 * Assert that every prose paragraph / bullet on the site is grounded in the
 * cited workbook page's pdftotext extraction. Site prose that cannot be
 * located in the workbook text — with tolerance for stylistic variation —
 * is class-c invented content and emits `prose_drift`.
 *
 * Why this check is precision-first (not recall-first):
 *   - The inverse direction (workbook prose → site) is recall-first and
 *     requires the spec to enumerate expected paragraphs; that's a larger
 *     authoring story and is deferred to day-9+.
 *   - False positives (site prose rewrapped by whitespace, minor word
 *     differences) annoy authors and erode trust.
 *   - False negatives (invented content slipping through) silently violate
 *     the class-c firewall — the one direction we cannot tolerate.
 *   - See memory `feedback_inventory_walk_paragraph_diff.md` — paragraph
 *     drift is the walk-exposed failure mode the original plan under-weighted.
 *
 * Walk cases (all direction: site-only, no workbook analogue):
 *   - 1-8 invented "Note: Much of the guidance for seniors..." meta-note.
 *   - 1-12 catastrophic intro replacement (site paragraph replaces workbook
 *     paragraph, so the site's paragraph fails the check).
 *   - 2-1 Mental Health drops — the DROPPED direction is out of scope here;
 *     but any site paragraph that substituted for a dropped workbook
 *     paragraph is caught.
 *
 * Algorithm: for each site paragraph, score it against the normalized
 * pdftotext text with `bestMatchScore`. Pass when the score ≥ GROUNDED
 * threshold. Short paragraphs (below MIN_TOKENS) are skipped — a 2-word
 * line ("See more") cannot be validated reliably without false-positive
 * hits; deferring to manual review is safer.
 *
 * Silent when `extractedText` is absent (freshness short-circuited the
 * runner before extraction) or when the site has no authored prose.
 */
const PROSE_GROUNDED_THRESHOLD = 0.6;
const PROSE_MIN_TOKENS = 6;
/**
 * Token-recall fallback to handle pdftotext column-split typography
 * (e.g. workbook drop-cap "P" emitted on its own line, splitting "Provide"
 * into separate "p" and "rovide" tokens). bestMatchScore's sliding-window
 * jaccard penalizes the fragmentation; tokenRecall instead asks "what
 * fraction of the paragraph's tokens appear anywhere in the workbook
 * text". When recall is high AND there's a non-trivial windowed match
 * (so we don't admit random common-word fluff), the paragraph is treated
 * as grounded.
 *
 * Walk evidence: 1-2 page 35-36 "Provide meals for communities during
 * disaster…" scores 0.55 < 0.6 by bestMatchScore but tokenRecall ≈ 0.94
 * (every token present in workbook except "provide", which exists as
 * fragmented "p"+"rovide"). Class-c invented prose has lower recall —
 * 1-9's "Mutual Aid and/or Neighbor-to-Neighbor Network leader(s)" has
 * tokenRecall ≈ 0.67 because "and"/"or"/"network" are genuinely absent
 * from the workbook, so it stays as prose_drift.
 */
const PROSE_FRAGMENT_MIN_SCORE = 0.4;
const PROSE_FRAGMENT_RECALL_THRESHOLD = 0.9;

function tokenRecall(labelTokens: readonly string[], textTokens: readonly string[]): number {
  if (labelTokens.length === 0) return 0;
  const textSet = new Set(textTokens);
  let hits = 0;
  for (const t of labelTokens) {
    if (textSet.has(t)) hits++;
  }
  return hits / labelTokens.length;
}

export function proseMatches(ctx: CheckContext): VerifyReportEntry[] {
  if (!ctx.extractedText) return [];
  const allParas = extractParagraphs(ctx.siteContent);
  if (allParas.length === 0) return [];

  // Day-15-j: spec-local scoping. When `prose_scope` is set, narrow to
  // paragraphs whose opening-tag line falls inside the [start_line,
  // end_line] window (either bound is independently optional). This stops
  // multi-citation files from triple-counting the same drifted paragraph
  // — file-global behavior is preserved when `prose_scope` is absent so
  // single-citation specs (1-2/1-3/1-4/1-5) keep their semantics.
  const scope = ctx.spec.prose_scope;
  const paras = scope
    ? allParas.filter((p) => {
        if (scope.start_line !== undefined && p.line < scope.start_line) return false;
        if (scope.end_line !== undefined && p.line > scope.end_line) return false;
        return true;
      })
    : allParas;
  if (paras.length === 0) return [];

  const textNorm = normalizeLabel(ctx.extractedText);
  if (!textNorm) return [];
  const textTokens = textNorm.split(/\s+/).filter(Boolean);

  const out: VerifyReportEntry[] = [];
  for (const p of paras) {
    const pNorm = normalizeLabel(p.text);
    if (!pNorm) continue;
    const tokens = pNorm.split(/\s+/).filter(Boolean);
    if (tokens.length < PROSE_MIN_TOKENS) continue;
    const score = bestMatchScore(pNorm, textNorm);
    if (score >= PROSE_GROUNDED_THRESHOLD) continue;
    if (
      score >= PROSE_FRAGMENT_MIN_SCORE &&
      tokenRecall(tokens, textTokens) >= PROSE_FRAGMENT_RECALL_THRESHOLD
    ) {
      continue;
    }
    out.push(
      entry(
        ctx,
        'prose_drift',
        `site <${p.tag}> "${truncate(p.text, 120)}" not grounded in cited workbook text (score ${score.toFixed(2)} < ${PROSE_GROUNDED_THRESHOLD})`,
        p.line,
      ),
    );
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// ---------------------------------------------------------------------------
// Ordering helper — wired into runner.ts
// ---------------------------------------------------------------------------

/**
 * Run every day-5 check in order and return a flat entry list. Runner uses
 * this to append to the post-extract report; callers who want to cherry-pick
 * one check can still import them individually.
 *
 * Name retained as `runDay5aChecks` for import stability; composer now runs
 * the full day-5 set (5a + 5b) in authored order.
 */
export function runDay5aChecks(ctx: CheckContext): VerifyReportEntry[] {
  return [
    ...linksMatch(ctx),
    ...titleMatches(ctx),
    ...keysMatch(ctx),
    ...structuralFidelityMatches(ctx),
    ...proseMatches(ctx),
  ];
}

export function collectSiteColumnsForSpec(
  spec: SourceSpec,
  siteContent: string,
): SiteColumn[] {
  const fields = collectSpecFields(spec);
  if (fields.length === 0) return [];
  const tables = extractDataTables(siteContent);
  if (spec.tableId !== undefined) {
    const match = tables.find((t) => t.tableId === spec.tableId);
    return match?.columns ?? [];
  }
  const match = tables.find((t) => t.columns.length === fields.length);
  return match?.columns ?? [];
}
