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
 * Deferred to day-5b:
 *   - `structuralFidelityMatches` — 1 workbook table → 1 site component.
 *   - `proseMatches`              — verbatim <p>/<li> vs pdftotext via Myers.
 */

import type {
  SourceSpec,
  SpecLink,
  VerifyReportEntry,
  VerifyStatus,
} from './schemas';
import { collectSpecFields } from './diff';
import { normalizeUrl } from './normalize-url';
import {
  extractHeadings,
  extractLinks,
  extractDataTables,
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
  return [
    entry(
      ctx,
      'link_missing',
      `spec link "${specLink.url}"${specLink.label ? ` ("${specLink.label}")` : ''} not present in ${ctx.file}`,
    ),
  ];
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
 *   - Matches any DataTable in the file whose column count equals the spec
 *     field count. If multiple candidates match, emits key_drift with a
 *     disambiguation message (ambiguous mapping = reviewer signal).
 *   - Compares column.label (or .key when label is absent) against
 *     field.label, case-insensitively and whitespace-collapsed. Order-strict.
 *
 * A non-matching column emits `key_drift`; a missing DataTable is silent
 * (may be a spec that feeds a PlanForm rather than a DataTable — handled
 * by other checks).
 */
export function keysMatch(ctx: CheckContext): VerifyReportEntry[] {
  const fields = collectSpecFields(ctx.spec);
  if (fields.length === 0) return [];
  // Section-grouped specs → defer (see docstring).
  if (ctx.spec.sections?.length) return [];

  const tables = extractDataTables(ctx.siteContent);
  if (tables.length === 0) return [];

  const matches = tables.filter((t) => t.columns.length === fields.length);
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
// Ordering helper — wired into runner.ts
// ---------------------------------------------------------------------------

/**
 * Run every day-5a check in order and return a flat entry list. Runner uses
 * this to append to the post-extract report; callers who want to cherry-pick
 * one check can still import them individually.
 */
export function runDay5aChecks(ctx: CheckContext): VerifyReportEntry[] {
  return [
    ...linksMatch(ctx),
    ...titleMatches(ctx),
    ...keysMatch(ctx),
  ];
}

export function collectSiteColumnsForSpec(
  spec: SourceSpec,
  siteContent: string,
): SiteColumn[] {
  const fields = collectSpecFields(spec);
  if (fields.length === 0) return [];
  const tables = extractDataTables(siteContent);
  const match = tables.find((t) => t.columns.length === fields.length);
  return match?.columns ?? [];
}
