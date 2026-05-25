import { z } from 'zod';

export const citationSchema = z.object({
  source: z.string().min(1),
  page: z.string().optional(),
});
export type Citation = z.infer<typeof citationSchema>;

export const fieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9-]+$/, 'field key must be kebab-case'),
  label: z.string().min(1),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'date',
    'time',
    'checkbox',
    'select',
    'tel',
    'email',
    'url',
  ]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const sectionSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9-]+$/, 'section key must be kebab-case'),
  label: z.string().min(1),
  description: z.string().optional(),
  repeat: z.number().int().positive().optional(),
  fields: z.array(fieldSchema).min(1),
});
export type Section = z.infer<typeof sectionSchema>;

/**
 * Per-spec opt-out hooks for the runner's content-extraction matchers.
 * Defaults are tuned for single-page citations whose template column
 * headers cluster within the first 50 extracted lines of the cited page.
 * See `docs/source-specs/README.md` for the spec-author guide on when
 * each field needs to be set.
 *
 * `require_cluster` (day-15-k LOCKED documentation):
 *   When `false`, the runner skips the short-label cluster heuristic for
 *   this spec. Set it ONLY when the citation covers a page range that
 *   includes BOTH prose pages and a template page — short column labels
 *   ("Name", "Phone", "Email") then fall past the 50-line
 *   `extractCandidateLines` cap and would false-fail. The spec's `notes`
 *   block MUST include a one-liner explaining why the cluster check is
 *   bypassed for that spec (e.g. "page range covers Section 1.9 prose
 *   pp. 62-63 + Leader template p. 66").
 *
 *   Do NOT raise `extractCandidateLines` globally as a workaround — it
 *   inflates verify runtime and masks real bugs in other specs. Per-spec
 *   opt-out is the surgical fix.
 */
export const matchingConfigSchema = z.object({
  require_cluster: z.boolean().optional(),
  cluster_min_labels: z.number().int().min(1).max(10).optional(),
  short_label_max_tokens: z.number().int().min(1).max(5).optional(),
  short_label_max_chars: z.number().int().min(1).max(20).optional(),
});
export type MatchingConfig = z.infer<typeof matchingConfigSchema>;

/**
 * A single workbook-authoritative link discovered during 1a inventory.
 *
 * `kind` captures the Step 1a finding that the workbook sometimes uses an
 * internal PDF anchor (`*.html#N`) which MUST be rendered as a site-internal
 * route (e.g. `/modules/emergency-preparedness/1-5`), not as an external
 * link back to the Drive-hosted PDF. Violating that mapping is a
 * `link_type_mismatch`. See memory `feedback_internal_anchor_to_site_route.md`.
 */
export const specLinkSchema = z.object({
  url: z.string().min(1),
  label: z.string().optional(),
  page: z.string().optional(),
  /**
   * `external_url` — expected to appear in site output as an absolute URL;
   *                  compared via normalizeUrl.
   * `internal_route` — expected to appear as a site-internal `/modules/...`
   *                    path; compared as a prefix match on the href.
   * Defaults to `external_url` when absent (preserves day-1.5 behavior).
   */
  kind: z.enum(['external_url', 'internal_route']).optional(),
});
export type SpecLink = z.infer<typeof specLinkSchema>;

/**
 * Expected headings the workbook authors at this location — section title(s)
 * and any h2/h3 sub-headings rendered on the site. Compared against h1/h2/h3
 * tag contents in the wired .astro/.tsx component by `titleMatches`.
 *
 * The top-level `title` field remains the primary (h1/section heading).
 * `subheadings` holds workbook h2/h3 in document order; `titleMatches` fails
 * as `title_drift` when the site emits an invented heading that is not in
 * either list (walk-observed: 1-5, 1-12, 1-13, 2-1).
 */
export const specSubheadingSchema = z.object({
  text: z.string().min(1),
  level: z.number().int().min(2).max(4).optional(),
});
export type SpecSubheading = z.infer<typeof specSubheadingSchema>;

/**
 * Structural-fidelity assertion: the workbook authors N tables/forms at this
 * location; the site MUST render exactly N matching components. Violating
 * this is `structural_fidelity_failed` (walk-observed: 1-8 Seniors+Disabilities
 * section split — 1 workbook table rendered as 2 site sections).
 */
export const structuralFidelitySchema = z.object({
  /**
   * Expected count of primary data-bearing components (DataTable, PlanForm,
   * SlotCollection, directory tables) that descend from the cited workbook
   * location. The runner checks this as a hard-equality:
   * count(site components) === table_count.
   *
   * `table_count: 0` is the canonical assertion for Todo-only pages whose
   * `structural_flatten:` resolution is `restored` via the parent + ml-6
   * children Todo pattern — the workbook's structured sub-collection now
   * renders as a Todo group with no data-bearing component on the page,
   * and the spec asserts that absence to keep regressions from silently
   * re-introducing a DataTable / PlanForm / SlotCollection here.
   */
  table_count: z.number().int().min(0),
  /**
   * Optional component-identity key used to scope `table_count` to a single
   * authoring identity instead of summing every data-bearing component in
   * the file. Matched against `DataTable.tableId`, `SlotCollection.tableId`,
   * and `PlanForm.formId` — so any of the three component classes can be
   * scoped with one field. Decoupled from the top-level `spec.tableId`
   * (which is keysMatch's DataTable identity contract) so PlanForm- or
   * SlotCollection-only specs can scope structural_fidelity without
   * triggering a spurious keysMatch `key_drift` against a missing
   * DataTable. When `scope_id` is undefined, the runner falls back to
   * `spec.tableId` for backward compatibility with day-15-i DataTable
   * specs that already use it as the structural scope. When both are
   * undefined, structural_fidelity sums file-globally.
   */
  scope_id: z.string().optional(),
  /**
   * Human-readable note on what the tables correspond to (optional audit trail).
   */
  description: z.string().optional(),
});
export type StructuralFidelity = z.infer<typeof structuralFidelitySchema>;

/**
 * Structural-flatten assertion: the workbook authors a structured
 * sub-collection at this location (numbered slots, sub-bullets, sub-columns);
 * the site renders a single flattened field. Pairs with an archive entry in
 * docs/site-inventions-archive.yaml (`structural_flatten` category) referenced
 * by `archive_id`.
 *
 * Resolution states drive the verifier's behavior in `structuralFlattenMatches`
 * (src/lib/verify/runner-checks.ts):
 *   - `pending_restore`     — soft `structural_flatten_pending` fail; the bridge
 *                              state between archiving the entry and restoring
 *                              the structured shape on the site.
 *   - `restored`            — site now renders the structured form; the runner
 *                              defers component-count assertion to the paired
 *                              `structural_fidelity` declaration on the spec.
 *   - `accepted_decorative` — workbook structure is print-page presentation
 *                              with no semantic loss; PASS when the archive
 *                              entry exists, HARD `structural_flatten_unarchived`
 *                              when it does not.
 */
export const structuralFlattenSchema = z.object({
  variant: z.enum(['slot_flatten', 'bullet_flatten', 'subcolumn_flatten']),
  resolution: z.enum(['pending_restore', 'restored', 'accepted_decorative']),
  archive_id: z.string().min(1),
  expected_component_count: z.number().int().min(1).optional(),
});
export type StructuralFlatten = z.infer<typeof structuralFlattenSchema>;

/**
 * Day-15-j: spec-local scoping window for `proseMatches`.
 *
 * Multi-citation files (e.g. 1-9.astro carries Leader + Neighbor + First
 * Responder specs, each citing a slightly different page range) used to
 * triple-count the same drifted paragraph because `proseMatches` ran
 * against every paragraph in the file for every spec. `prose_scope`
 * narrows the check to a 1-indexed line range in the wired component
 * file — paragraphs outside the window are skipped for that spec.
 *
 * When absent (the day-1.5 default for 1-2/1-3/1-4/1-5/single-citation
 * files), `proseMatches` runs file-global as before.
 */
export const proseScopeSchema = z
  .object({
    start_line: z.number().int().min(1).optional(),
    end_line: z.number().int().min(1).optional(),
  })
  .refine(
    (s) =>
      s.start_line === undefined ||
      s.end_line === undefined ||
      s.end_line >= s.start_line,
    { message: 'prose_scope.end_line must be >= start_line when both set' },
  );
export type ProseScope = z.infer<typeof proseScopeSchema>;

export const sourceSpecSchema = z
  .object({
    module: z.string().regex(/^[0-9]+-[0-9]+$/, 'module must be like "1-9"'),
    template: z.string().regex(/^[a-z0-9-]+$/, 'template must be kebab-case'),
    title: z.string().min(1),
    citation: citationSchema,
    /**
     * Disambiguator for files that render multiple DataTables with the same
     * column count (e.g. 1-9.astro renders 4-col Leader + 4-col Neighbor
     * directories). When set, `keysMatch` filters site DataTables to the one
     * whose authored `tableId` prop equals this value — the existing IDB
     * scope key already authored on every shipped DataTable, no new
     * authoring cost. When absent, `keysMatch` falls back to column-count-
     * only matching (preserves day-1.5 behavior for the 5 shipped specs
     * that don't carry a tableId field).
     */
    tableId: z.string().min(1).optional(),
    /**
     * 1-indexed line-range window in the wired component file. When set,
     * `proseMatches` only checks paragraphs whose opening tag falls inside
     * the window. Multi-citation files (e.g. 1-9.astro) declare a different
     * window per spec so a single drifted paragraph counts once, not N
     * times. When absent (default), proseMatches runs file-global.
     */
    prose_scope: proseScopeSchema.optional(),
    sections: z.array(sectionSchema).optional(),
    fields: z.array(fieldSchema).optional(),
    links: z.array(specLinkSchema).optional(),
    subheadings: z.array(specSubheadingSchema).optional(),
    structural_fidelity: structuralFidelitySchema.optional(),
    structural_flatten: structuralFlattenSchema.optional(),
    notes: z.string().optional(),
    last_verified: z.string().datetime().optional(),
    matching: matchingConfigSchema.optional(),
  })
  .refine((spec) => Boolean(spec.sections?.length || spec.fields?.length), {
    message: 'spec must define either sections or fields',
  })
  .refine((spec) => !(spec.sections?.length && spec.fields?.length), {
    message: 'spec cannot define both sections and fields',
  });
export type SourceSpec = z.infer<typeof sourceSpecSchema>;

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, 'sha256 hex string required');

/**
 * Per-PDF registry entry. `content_hashes` is a record keyed by page string
 * (as it appears in spec.citation.page, e.g. "66" or "35-36") to the
 * normalized content hash for that page extraction. Whole-PDF extractions
 * (no spec page) use the sentinel key `__all__`.
 *
 * Why a record instead of a single `content_hash`: multiple specs commonly
 * cite different pages of the same workbook PDF (e.g. 1-2 page 35-36 and
 * 1-9 page 66). A single content_hash field forces the most-recently-
 * scaffolded spec to overwrite all others' content hashes, which makes the
 * post-extract content_drift check fire spuriously on every spec but the
 * latest. Per-page hashes let each spec own its own freshness state.
 */
export const SOURCE_REGISTRY_ALL_PAGES_KEY = '__all__';
export const sourceRegistryEntrySchema = z.object({
  source_hash: sha256Hex,
  content_hashes: z.record(z.string().min(1), sha256Hex),
  drive_file_id: z.string().optional(),
  last_verified: z.string().datetime(),
});
export type SourceRegistryEntry = z.infer<typeof sourceRegistryEntrySchema>;

/** Normalize a citation.page (possibly undefined) to a registry pageKey. */
export function registryPageKey(page: string | undefined): string {
  return page && page.length > 0 ? page : SOURCE_REGISTRY_ALL_PAGES_KEY;
}

export const sourceRegistrySchema = z.object({
  sources: z.record(z.string(), sourceRegistryEntrySchema),
  meta_hash: sha256Hex.optional(),
});
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;

export const extractionMethodSchema = z.enum(['pdftotext', 'vision']);
export type ExtractionMethod = z.infer<typeof extractionMethodSchema>;

export const extractionCacheEntrySchema = z.object({
  text: z.string(),
  extracted_at: z.string().datetime(),
  method: extractionMethodSchema,
  source_hash: sha256Hex.optional(),
});
export type ExtractionCacheEntry = z.infer<typeof extractionCacheEntrySchema>;

export const extractionCacheSchema = z.object({
  cache: z.record(z.string(), extractionCacheEntrySchema),
  meta_hash: sha256Hex.optional(),
});
export type ExtractionCache = z.infer<typeof extractionCacheSchema>;

export const accuracyBaselineEntrySchema = z.object({
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  measured_at: z.string().datetime(),
});
export type AccuracyBaselineEntry = z.infer<typeof accuracyBaselineEntrySchema>;

export const accuracyBaselineSchema = z.object({
  baselines: z.record(z.string(), accuracyBaselineEntrySchema),
});
export type AccuracyBaseline = z.infer<typeof accuracyBaselineSchema>;

export const verifyStatusSchema = z.enum([
  'pass',
  'missing_citation',
  'source_not_found',
  'source_unregistered',
  'source_drift',
  'content_drift',
  'field_drift',
  'needs_human_review',
  'extract_failed',
  'vision_api_failed',
  'spec_parse_error',
  'cache_corrupted',
  'drive_id_not_allowed',
  // Day-5 additions — Step 1a walk-observed failure modes.
  // See ~/.gstack/projects/000noyes-resiliencetoolkit.org/checkpoints/
  //     step1a-inventory-walk-complete-20260424.md for the evidence set.
  'link_drift',              // workbook URL normalizes differently than site URL (same intent)
  'link_missing',            // workbook link absent on site (no substitution)
  'link_type_mismatch',      // workbook internal_route rendered as external (or vice versa)
  'title_drift',             // site h1/h2/h3 diverges from workbook title/subheading
  'structural_fidelity_failed', // N workbook tables rendered as ≠ N site components
  'key_drift',               // DataTable column key diverges from spec field key
  'prose_drift',             // verbatim <p>/<li> text diverges from pdftotext extraction
  // Case 8 — structural-flatten enforcement (paired with the
  // `structural_flatten` category in docs/site-inventions-archive.yaml).
  'structural_flatten_unarchived', // spec asserts a flatten but no archive entry resolves
  'structural_flatten_pending',    // archive marks pending_restore — soft fail (bridge state)
]);
export type VerifyStatus = z.infer<typeof verifyStatusSchema>;

export const verifyReportEntrySchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative().optional(),
  source: z.string().optional(),
  status: verifyStatusSchema,
  message: z.string().optional(),
  drift: z
    .object({
      expected_fields: z.array(z.string()).optional(),
      actual_fields: z.array(z.string()).optional(),
      diff: z.array(z.string()).optional(),
    })
    .optional(),
});
export type VerifyReportEntry = z.infer<typeof verifyReportEntrySchema>;
