# TODOS

## Source Fidelity (1-9 QA findings — Step 1a scope)

Discovered during live preview review of https://feat-phase2-planform.resiliencetoolkit-org.pages.dev on 2026-04-21. PlanForm wiring was reverted on this branch; the underlying fidelity gaps below need to be fixed before Phase 2 re-wires 1-9.

### P0: Source-of-truth architecture — scrap rt-templates/, upgrade extractor to see link annotations
**Priority:** P0
**Description:** Earlier analysis claimed the master workbook PDF was also lossy (zero URI annotations). That was wrong — the detection used raw-bytes regex which can't decompress Adobe's FlateDecode streams. `pdftohtml -s` decompresses properly: the workbook has **258 hyperlinks, 41 unique Drive file IDs**. Corrected source hierarchy:

| Source | Status | Hyperlinks |
|---|---|---|
| `rt-templates/leader-directory.pdf` | Chrome Print-to-PDF of a Google Sheet. Lossy derivative. | 0 (the Sheet had none) |
| `public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf` | Adobe Acrobat, 97 pages. **Usable source of truth.** | 258 hrefs, 41 Drive IDs |

Cross-check: the site references 24 unique Drive IDs from `src/pages/**`. **22 of those 24 are present in the workbook.** Two site IDs aren't in the workbook (audit them — either drift or intentional additions). Nineteen workbook IDs aren't yet wired on the site (un-rendered toolkit content).

**The real gap is the extractor, not the source.** `src/lib/verify/extract.ts` uses `pdftotext -layout`, which extracts visible text but not link annotations. So the verify skill currently CAN'T see the workbook's 258 hyperlinks even though they're authentically there.

**Fix (Step 1a scope):**
1. **Scrap `rt-templates/`.** It's a redundant Print-to-PDF derivative. Source specs cite page ranges of the master workbook directly (e.g. `citation: { source: public/toolkit/2025..., page: "37-38" }`).
2. **Re-measure the 1-9 Leader Directory golden fixture against the workbook** at whatever page range the Leader Directory template lives. Current accuracy baseline (recall 1.000, precision 0.800 against `rt-templates/leader-directory.pdf`) stays as a valid unit test of the diff matcher but is not a valid proof of toolkit fidelity — the source was a different artifact.
3. **Extend `extract.ts` with link-annotation extraction.** Use `pdftohtml -s` (already installed via poppler-utils) to get decompressed HTML per page, parse `<a href>` tags, and include them in the extract output. Alternative: bundle `pypdf` or `pdf-lib` for annotation-only extraction. Store extracted links in the cache alongside text.
4. **Extend `sourceSpecSchema`** with a `links[]` field. Checker: every href in the spec's page range must appear as a rendered link target somewhere in the cited component or page.
5. **Drive MCP stays in Step 1a scope** for: fetching updated workbook versions, accessing the per-template Drive files for richer extraction (live editable content, not a flattened page), and resolving Drive IDs to current titles for citation.
6. **Audit the 2 site-only Drive IDs** that aren't in the workbook — either drift to remove or additions to promote via scaffolded source specs.

**Depends on:** Drive MCP install (Days 1-3 of Step 1a) for (5) and (6). Extractor upgrade for (3) and (4) is independent — can start immediately.

### Keep public/toolkit/sections/ PDFs in sync with canonical workbook
**Priority:** P2
**Description:** The 17 per-module PDFs in `public/toolkit/sections/` are surfaced to users as module-level downloads via `downloads.astro` and `pdfLookup.ts`. They were last exported 2025-11-20 (Chrome Print-to-PDF from Google Docs). The canonical `2025 Resilience Hub Toolkit w Templates_V1 final.pdf` was exported 2025-12-01 (Adobe Acrobat). That 11-day gap means section PDFs may serve stale content to users even though Step 1a keeps them out of the citation graph (citation anchor is the workbook only). If Rhizome edits the source Google Doc between workbook exports, the sections silently drift.
**Fix:** (a) Define the regeneration workflow — currently manual Chrome Print-to-PDF per section. Document the workflow in `docs/toolkit-export-workflow.md`. (b) After every workbook re-export, re-export all 17 section PDFs from the same source revision. (c) Consider a build-time staleness check: compare each section PDF's text content against the corresponding page range of the workbook; warn if divergent. Candidate for post-Step-1a automation once Drive integration supports reading Doc revisions. (d) Flag in CI: if `public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf` mtime is newer than any `public/toolkit/sections/*.pdf`, warn.
**Depends on:** Drive integration tooling (enables automated regeneration). Minimum viable fix (documented workflow + mtime CI warning) is independent.

### Verify skill: extend coverage beyond field labels

### Verify skill: extend coverage beyond field labels
**Priority:** P1
**Description:** `/verify-against-source` currently checks field labels against normalized PDF text via fuzzy cluster matching. It does NOT check: (a) component titles (e.g. `title="Leader Directory — town context"` passed for the 1-9 golden fixture despite being invented content — a class-(c) firewall violation per SCOPE.md clause 10), (b) structural fidelity (a single PDF table rendered as two components with two exports still passes), (c) body-text fidelity around interactive elements, (d) key-to-spec alignment (spec declares `key: title-role`, code uses `key: 'role'` — diverging IndexedDB keys pass verify silently), (e) PDF link annotations (Drive URLs in source PDFs aren't preserved or checked on site).
**Fix:** Extend `sourceSpecSchema` in `src/lib/verify/schemas.ts` with `title` and `links[]` fields. Add a `titleMatches` check to `runner.ts` that normalizes the component's `title` prop against the spec's `title`. Add a `linksMatch` check that extracts `/URI` annotations from the PDF (see `pdfinfo` or raw regex on uncompressed streams — confirmed working) and requires every annotation's destination to appear somewhere in the cited component's rendered HTML. Add a key-alignment test in CI.
**Depends on:** Step 1a sub-branch scope.

### Structural fidelity: one PDF table must not split into multiple components
**Priority:** P1
**Description:** The leader-directory.pdf has one logical table (town-name blank + link row + column headers + data). The initial Phase 2 wiring split this into a `PlanForm` (the link row) plus a `DataTable` (the grid). Two export buttons, two HTML files, two IndexedDB stores for one logical record. The PDF is one artifact; the web should be one artifact.
**Fix:** Design a unified component (or a composition pattern) that renders a single logical PDF table as a single export, single save boundary. Likely a `DataTable` variant with a `headerFields` prop for pre-data rows, OR a generalized `SourceBackedForm` that subsumes both. Decide in Step 1a engineering review.
**Depends on:** Step 1a `/plan-eng-review`.

### Title drift: component titles must trace to PDF (or Drive file name) verbatim
**Priority:** P1
**Description:** Stripped on this branch. The invented suffix `" — town context"` on the Leader Directory PlanForm was class-(c) content wired into `src/pages/**`. The canonical title per the source Drive file is "Local leaders for emergency management template"; the PDF's extracted title is "Directory of local leaders for emergency management coordination in __________". Neither was used.
**Fix:** When the verify skill gains title coverage (see above), every component title prop must match the spec's `title` field, which must trace to the source Drive file name or the PDF's literal title text. No simplification or branding without explicit scaffold-time approval.
**Depends on:** Verify skill title coverage (above).

### PDF hyperlink preservation as a fidelity axis
**Priority:** P1
**Description:** The workbook PDF (primary source of truth) contains Drive-hosted links throughout — section pages link to template PDFs, reference docs, external resources. The site currently renders the same visible text but doesn't consistently preserve the linked destination. Where the PDF says "[phone tree systems](drive link)", the site should render a link to the same destination. Currently no enforcement.
**Fix:** Extract PDF link annotations at scaffold time (`pdfinfo`, `mutool`, or raw `/URI` regex — all confirmed working on this toolchain). Store in `sourceSpec.links[]`. Verify at build time that every annotation's destination URL appears in the rendered HTML of the cited component or page. Class-(c) firewall should also cover missing links, not just invented text.
**Depends on:** Verify skill schema extension.

### Town-name blank field not captured anywhere
**Priority:** P2
**Description:** The leader-directory.pdf header reads "Directory of local leaders for emergency management coordination in __________". The blank expects the user's town name. The current 1-9.astro section heading is "Directory of Local Leaders" with no town field. When Phase 2 re-wires this, the town name needs a dedicated field (either at the module level to scope all sections, or per-form).
**Fix:** Add a single `moduleContext` storage helper that captures town name once per hub, read by all citation-backed components. Spec-tag with a new `context` field tied to the PDF's `in __` blank.
**Depends on:** Step 1a architecture.

### Visual affordance drift: bullets should be checkboxes where the PDF uses checkmarks
**Priority:** P2
**Description:** The toolkit PDF renders actionable items with checkmark glyphs (the workbook is a fillable checklist). The site renders them with `list-disc` bullets. Semantic mismatch — users should be able to check items off and have that state persist per module.
**Fix:** Extend existing todos storage (already keyed `${moduleKey}-${todoId}`) with a ChecklistList component that renders `<input type="checkbox">` + label, persists state in IDB, and matches the PDF's visual affordance. Roll out section-by-section as Phase 2 lands.
**Depends on:** None (can start independently).

### Field key drift: IndexedDB keys must match spec keys
**Priority:** P2
**Description:** Leader Directory spec declares `key: title-role`. The DataTable uses `{ key: 'role' }` for the same column. User IDB data persists under column `role`, spec registry expects `title-role`. Currently harmless (single source of truth is the DataTable), but a future rename or a cross-spec rollup would break.
**Fix:** When verify skill gains key-alignment checking, migrate either the spec or the DataTable to a single canonical key. If the DataTable changes, use the moduleKey contract (data-preservation test) to guarantee no data loss for existing users.
**Depends on:** Verify skill key-alignment check.

### Neighbor Directory and First Responder Directory are uncited
**Priority:** P2
**Description:** Lines 95-106 and 111-123 of `src/pages/modules/emergency-preparedness/1-9.astro` render `DataTable` components with no `source=` / `page=` props. Either these are class-(c) invented content (hard fail per SCOPE.md clause 10) or they need source specs. Pre-existing from PR #13 / v0.0.7, not introduced by this branch, but `/verify-against-source` discover step should have flagged them.
**Fix:** During Step 1a audit of modules 1-2, 1-3, 1-4, 1-5, also revisit 1-9's two uncited DataTables. Either promote them via scaffolded source specs OR reclassify and remove from `src/pages/**`.
**Depends on:** Step 1a audit methodology.

## Tooling

### Playwright Chromium system libs in devcontainer
**Priority:** P2
**Description:** `~/.cache/ms-playwright/chromium-*/chrome-linux/chrome` was missing runtime system libs (libpango, libnss3, libgbm1, libatk1.0-0t64, and more) until 2026-04-21. Without them, every browser-daemon skill (`/qa`, `/qa-only`, `/browse`, `/canary`, `/design-review`, `/make-pdf`) failed silently or refused to launch. This blocks the entire live-QA workflow.
**Fix:** Added the apt packages to `.devcontainer/devcontainer.json` postCreateCommand so rebuilds stay functional. Verified by launching headless Chromium against the preview URL successfully.
**Status:** Fixed 2026-04-21 in feat/phase2-planform branch (this PR).

## Storage & Data Safety

### ~~Non-atomic batch operations in storage.ts~~ RESOLVED
**Priority:** P2
**Status:** Fixed in `cloudflare-minimal` (cherry-picked from `glass-box-expanded` Phase 7). Both `batchUpdateChecklistItems` and `clearCompletedItems` now use single IDB transactions.

### ~~Unsafe `as` type casts on metadata values~~ RESOLVED
**Priority:** P2
**Status:** Fixed in v0.0.7 (2026-04-13). Runtime type guards added to `storage.ts` replacing all unsafe `as` casts.

## Service Worker

### ~~SW precache is all-or-nothing — no per-asset resilience~~ RESOLVED
**Priority:** P3
**Status:** Fixed in `sw-precache-generator`. Switched `cache.addAll()` to `Promise.allSettled()` in `public/sw.js` — a single 404 now logs a warning instead of aborting the entire SW install.

### ~~PRECACHE_ASSETS URLs don't match actual page routes~~ RESOLVED
**Priority:** P3
**Status:** Fixed in `sw-precache-generator`. `scripts/generate-sw-precache.mjs` runs as `postbuild` and generates PRECACHE_ASSETS from `dist/**/index.html`. List is now auto-computed and can never drift.

### Build verification test for SW precache generator
**Priority:** P2
**Description:** Post-build Vitest test that reads `dist/sw.js` after build and asserts PRECACHE_ASSETS matches the actual routes in `dist/` minus excluded paths. The `generate-sw-precache.mjs` generator's exit-nonzero check handles empty-list failures; this test would catch partial route exclusions and regression in the exclusion filter logic.
**Fix:** Write a Vitest test that runs `astro build` (or reads a pre-built dist/), then imports and runs the generator logic against a known fixture, asserting the output matches expected routes.
**Depends on:** sw-precache-generator merged

## Dead Code

### ~~Remove dead components + dead lib files~~ RESOLVED
**Priority:** P2
**Completed:** v0.0.6 (2026-04-05)
**Status:** 8 components deleted outright, 5 moved to `src/design-system/_deferred/`. Zero remaining imports verified via grep.

### Remove orphaned modules content collection
**Priority:** P3
**Description:** `src/content/modules/{baseline-resilience,emergency-preparedness}.yaml`, the `modules` collection in `src/content.config.ts`, and `getModuleSections()` in `src/lib/navigation.ts` are zero-reference leftovers from the dynamic-routing era. All 16 section pages now carry their own inline `sectionData`, so the YAMLs are parsed and zod-validated at build time but never read. `navigation.ts` already documents this in a header comment ("getSectionNavigation removed — all sections are hardcoded"). Same metadata now lives in two places; only the inline copy is authoritative.
**Fix:** In one commit, delete in this order to keep each intermediate state buildable: (1) `src/lib/navigation.ts` (only exports the unused helper), (2) the `modules` collection definition + its zod schema block in `src/content.config.ts` (leave `sourceSpecs`), (3) the two YAML files under `src/content/modules/`, (4) the `src/content/modules/` directory if empty. Run `pnpm astro check && pnpm build && pnpm vitest run` to confirm no regressions.
**Depends on:** None

### Investigate ExternalLink abstraction
**Priority:** P3
**Description:** `ExternalLink.tsx` → `ExternalLinkModal.tsx` → `externalLinkPreferences.ts` — ~300 lines to show a "you're leaving this site" modal before opening external links. Used in 16 pages. Investigate why this abstraction was added before removing — there may be a deliberate reason (accessibility, community trust, hosted-in-contexts-without-internet). If no good reason, replace with plain `<a target="_blank" rel="noopener noreferrer">` and a CSS external-link icon.
**Fix:** Audit usage, understand original intent, decide: keep (document why) or replace (simpler `<a>`).
**Depends on:** None

## DataTable — UX Gaps

### Undo toast is opaque after row deletion
**Priority:** P2
**Description:** The post-deletion toast reads only "Row deleted" with no indication of which row was removed or what data it contained. On a directory with dozens of rows, an accidental delete is effectively unrecoverable-by-inspection — the user has to undo blindly within the 5-second window and hope it was the right row. Matters most for long directories (volunteer signup, food access) where rows are visually similar.
**Fix:** Include a short row descriptor in the toast (first non-empty column value, truncated to ~40 chars) — e.g., "Deleted: Maple St. Food Shelf". On pre-populated readonly rows, use the prompt text. Fall back to "Row deleted" only when all cells are empty.
**Depends on:** None

### No clipboard / bulk import into DataTable
**Priority:** P2
**Description:** A user migrating a directory from a Google Sheet or existing document must enter every cell by hand. No paste-from-clipboard support, no TSV/CSV bulk import, no multi-row paste. This is the single largest friction for first-time hub onboarding — the whole point of the directory templates is to capture existing community knowledge that already lives in spreadsheets elsewhere.
**Fix:** (a) Cell-level paste that splits on tab/newline and fills adjacent cells (spreadsheet-parity). (b) A "Paste from clipboard" button on the table header that parses TSV/CSV and appends rows. (c) Later: file-picker CSV import mirroring the existing export format (RFC 4180 + BOM).
**Depends on:** None

### Fixed column widths truncate long text without horizontal scroll on desktop
**Priority:** P2
**Description:** On desktop, long cell values are clipped by fixed column widths with no horizontal scroll affordance and no cell-expand-on-hover. Users don't know content is hidden. On mobile the progressive-disclosure mode masks this; on desktop it silently loses visibility of data the user entered.
**Fix:** Either (a) make columns user-resizable with persisted widths per table, or (b) add horizontal scroll when content overflows with a visible scroll affordance, or (c) expand rows to fit on focus/hover. Option (b) is the smallest change; option (a) is the most correct.
**Depends on:** None

### No virtualization — all rows render in memory
**Priority:** P3
**Description:** Every row in a DataTable is in the DOM on mount. Fine for the current 5–30 row templates. Will become a real performance problem once a hub lands a directory of a few hundred entries (realistic scale for food access, volunteer rosters, contact trees). Render cost and autosave churn both scale linearly with row count.
**Fix:** Add windowed rendering (react-window or TanStack Virtual) once any table crosses ~100 rows in production use, or proactively before Phase 3 directory work. Gate on measured scroll/input latency — don't pre-optimize without evidence.
**Depends on:** None (watch for the scale trigger)

### Focus returns to table header after row deletion
**Priority:** P3
**Description:** After a row is deleted, keyboard focus jumps to the table header rather than to an adjacent row. Keyboard-only users lose their place mid-task and must re-navigate to continue. Compounds with the existing P2 DataTable keyboard-navigation gap.
**Fix:** On deletion, move focus to the next row's first editable cell. If the deleted row was last, move to the previous row. If it was the only row, move to the "Add row" affordance.
**Depends on:** Keyboard navigation for DataTable (P2)

### Empty state only appears on initial load
**Priority:** P3
**Description:** The empty-state prompt is shown when a user first opens a DataTable with no rows. If the user adds rows and then manually deletes all of them, the empty state does not reappear — they see a blank table with no guidance on how to start over. Minor, but noticed by users who reset a practice table.
**Fix:** Render the empty state whenever `rows.length === 0`, not only on initial mount. One-line change in the render condition.
**Depends on:** None

## Accessibility

### Keyboard navigation for DataTable
**Priority:** P2
**Description:** DataTable cells require click/tap to edit. Adding `tabIndex` on cells, Enter-to-edit, Escape-to-cancel, and Tab-to-next-cell would make the component usable for keyboard-only and screen reader users. Important for a community tool serving diverse populations.
**Fix:** Add keyboard event handlers to DataTable: Tab moves between cells, Enter opens edit mode, Escape cancels. Add `aria-label` attributes to cells. Test with VoiceOver (macOS/iOS) and screen reader.
**Depends on:** DataTable evolution (Phase 1 of Step 1 Template Kit)

## Template Kit — Data Safety

### ~~KYC migration column-key test~~ RESOLVED
**Priority:** P1
**Status:** Fixed in v0.0.7 (2026-04-13). `kyc-migration.test.ts` seeds IndexedDB with mock data using exact EditableTable column key strings, then verifies DataTable reads them correctly. 4 tests covering all 6 KYC tables.

### Expand data-preservation.test.ts per phase
**Priority:** P2 (per-phase, starting Phase 1)
**Description:** The test currently only checks for `<EditableTable` and `<Todo` components. It needs to also check for `<DataTable` and `<PlanForm`. The canonical moduleKey set count (currently 21) must increase as new pages get interactive content. `financial-resilience` (for page 1-13) is a NEW moduleKey not yet in the canonical set.
**Fix:** Update `CANONICAL_MODULE_KEYS` set and component grep patterns at the start of each phase. Phase 1: add DataTable grep. Phase 2: add PlanForm grep + `financial-resilience` key. Phase 3+: increment expected count as pages gain first interactive content.
**Depends on:** Phase 1 start

### Document isInitialRow convention
**Priority:** P2 (Phase 1)
**Description:** EditableTable uses `rowId < 1000` to distinguish pre-populated rows (readonly prompts) from user-added rows. This convention is undocumented but load-bearing: pre-populated rows show their content as readonly text, user-added rows are fully editable. DataTable must replicate this heuristic exactly or pre-populated KYC prompts become editable (confusing) or user-added rows become readonly (data loss).
**Fix:** Document the convention in a code comment on DataTable's row rendering logic. Add a Vitest test asserting pre-populated rows (id < 1000) render as readonly and user-added rows (id >= 1000) render as editable.
**Depends on:** DataTable component design (Phase 1)

## Template Kit — Pre-Phase 2

### PlanForm storage contract definition
**Priority:** P2 (blocker before Phase 2 starts)
**Description:** PlanForm is a vertical key-value form (label above, input below). The current storage layer has `getTableRows()`/`saveTableRow()` for tabular multi-row data but no equivalent for single-record key-value forms. How PlanForm fields map to IndexedDB records needs to be defined: one record per field? One record per form with all fields as properties? This affects 2 Phase 2 templates (SITREP, Household Info).
**Fix:** Design the storage contract during `/plan-eng-review` for Phase 2. Options: (a) store as a single-row table where each column is a field, (b) store as metadata key-value pairs, (c) add a new `getFormData()`/`saveFormData()` API to storage.ts.
**Depends on:** Phase 1 shipped, `/plan-eng-review` for Phase 2

### Pre-Phase 2 column verification
**Priority:** P2 (blocker before Phase 2 starts)
**Description:** The field spec approximated column headers for 3 templates from Drive link text rather than reading the actual Google Sheets tabs. Before Phase 2 implementation, verify exact column headers by opening 3 tabs: "1.10 Volunteer Signup Sheet", "1.2 Food and Water Sources", "1.1 Kits and Resources" in the master Google Sheets workbook. If they differ from the spec, update the ColumnDef definitions for those templates before building.
**Templates:** 1-10 Volunteer signup, 1-2 Food Access directory, 1-1 Household Info PlanForm
**Fix:** Read the 3 tabs, compare to field spec column lists, update spec or ColumnDefs as needed.
**Depends on:** Phase 1 (DataTable exists before these are needed)

## Template Kit — Mobile UX

### ~~Annotate field spec with column priorities for mobile progressive disclosure~~ RESOLVED
**Priority:** P2 (pre-Phase 1)
**Status:** Completed 2026-04-06. All 32 DataTable templates annotated with priority-1 columns in `step1-template-field-spec.md` > "Mobile Column Priorities" section. Rule: tables with 4 or fewer columns show all; 5+ columns use progressive disclosure with designated priority-1 fields.

## Journal Variant — Deferred Enhancements

### Progressive reveal for journal questions
**Priority:** P3 (CEO-accepted scope expansion, deferred to P3 per outside voice + user decision during eng review)
**Description:** Questions appear one at a time on first visit. After typing in a textarea and blurring, the next question appears. All questions visible on return visits (if any response has content). Deferred because: only provides value on first visit within a single session, tables have 3-8 questions (not overwhelming without it), and it adds disproportionate complexity (state management, blur handlers, stale closure risk, aria-live announcements, layout shift from async hydration). The visual improvements in the base journal variant (textarea, stacked layout, HTML export) already deliver the core UX fix.
**Fix:** Add `revealedCount` React state, initialize from IndexedDB data on mount (return-visit detection), increment on blur with functional updater `setRevealedCount(prev => Math.min(prev + 1, total))`, use `display: none` on unrevealed entries, add `aria-live="polite"` region with table-name-scoped announcements. ~80 LOC.
**Depends on:** Journal variant shipped (feat/journal-variant)

### Section progress arc
**Priority:** P3
**Description:** Replace the text counter ("3 of 6 questions answered") in journal-variant DataTables with a small circular SVG progress ring. The ring fills as questions are answered, turns green on completion. Visual polish, not functional — the text counter already works. Defer until journal variant is validated with real users.
**Fix:** Add an inline SVG `<circle>` with `stroke-dasharray` based on answered/total ratio. ~25 LOC.
**Depends on:** Journal variant shipped (feat/journal-variant)

### Focus mode for journal entries
**Priority:** P3
**Description:** Toggle button that dims completed journal questions (opacity 0.4) and spotlights the current unanswered one. Potentially conflicts with progressive reveal on first visit (progressive reveal already hides unanswered questions). Reconsider only if user testing shows return visitors struggle to find where they left off.
**Fix:** Add a `focusMode` boolean state, apply opacity CSS conditionally. ~20 LOC.
**Depends on:** Journal variant shipped, progressive reveal validated

### Auto-save contextual toast
**Priority:** P3
**Description:** Per-textarea inline "Saved" indicator that appears near the textarea on blur and fades after 2 seconds. The footer save indicator is sufficient now, but this would provide reassurance exactly where the user is looking. Revisit if user testing reveals save anxiety.
**Fix:** Add a `showSavedAt` map state, render a small "Saved" label below each textarea on save, CSS transition to fade. ~25 LOC.
**Depends on:** Journal variant shipped

### HTML-to-PDF export
**Priority:** P3
**Description:** The HTML export opens in a browser and looks good, but a future iteration could generate a styled PDF directly for offline sharing at community meetings. Options: (a) use browser `window.print()` to trigger save-as-PDF, (b) use a lightweight PDF library. The print stylesheet already handles the formatting.
**Fix:** Evaluate whether a "Save as PDF" button that triggers `window.print()` with print-to-PDF guidance is sufficient, or whether a library-based approach is needed.
**Depends on:** Journal variant shipped, HTML export validated

## E2E Test Maintenance

### Fix stale E2E test selectors (26 failures across 3 specs)
**Priority:** P2
**Description:** 26 E2E tests fail on main due to selectors that haven't kept up with layout changes. Three root causes:
1. **render-verification.spec.ts** (17 failures): `page.locator('h1, h2').first()` matches the TOC sidebar's "On this page" `<h2>` before the actual content heading. Fix: scope selector to main content area (e.g., `main h1, main h2` or `[data-content] h1`).
2. **module-hydration.spec.ts** (6 failures): (a) 1.9 + 1.10 todo checkbox tests expect `input.todo-checkbox` but those pages may use DataTable instead of Todo. (b) ExternalLink modal tests use `[role="dialog"]` which matches the TOC mobile drawer. Fix: use a more specific selector like `[role="dialog"]:not(.toc-mobile-drawer)` or scope to ExternalLinkModal's container. (c) Cross-module nav tests expect `a[href*="baseline-resilience/2-1"]` footer link on 1-13 — verify the link exists on the page or remove the test.
3. **indexeddb-verification.spec.ts** (3 failures): DB initialization tests for pages that may have changed interactive component types.
**Fix:** Update selectors to match current DOM structure. Run `npx playwright test --workers=1` to verify all 47 tests pass.
**Depends on:** None

## Search

### ~~Homepage search hidden — add back or rethink approach~~ RESOLVED
**Priority:** P3
**Status:** Fixed in v0.0.8 (2026-04-13). Pagefind restored as devDependency with build script step. Content-scoped indexing via `data-pagefind-body` on ModuleLayout article element (17 section pages indexed, nav/footer/homepage excluded). Try/catch error handling added. Dead SearchField.astro removed.

### Offline search via SW pre-cache
**Priority:** P3
**Description:** Extend the SW precache generator (`scripts/generate-sw-precache.mjs`) to include pagefind index chunks so search works offline. The generator currently only scans for `index.html` files, so pagefind's `.pf` chunks and `pagefind.js` are not cached. Aligns with the site's local-first mission (pages work offline, search does not yet).
**Fix:** Add a pagefind glob to the generator's asset collection, or add a separate pagefind precache step. Measure total chunk size first (may be 50-200KB for 17 pages). Test cache invalidation on reindex.
**Depends on:** Pagefind restored (v0.0.8)

### Search analytics via Umami events
**Priority:** P3
**Description:** Add custom Umami event tracking to the homepage search handler. Fire an event on search submission (after debounce) with the query text. Shows what users search for, helping identify content gaps or confusing terminology. Umami is already loaded on every page via BaseLayout.astro.
**Fix:** Add ~5 lines to the search handler in `src/pages/index.astro`: `window.umami?.track('search', { query })` after the debounced search fires.
**Depends on:** Pagefind restored (v0.0.8)

### Automated search E2E test
**Priority:** P2
**Description:** Playwright E2E test that visits the homepage, types a known query (e.g., "mutual aid"), and verifies search results appear with correct links to module pages. Build verification test exists (Vitest), but no test exercises the actual search UX in a browser.
**Fix:** Add a spec to `tests/e2e/` that runs against `pnpm preview` output.
**Depends on:** 26 existing E2E failures fixed (render-verification, module-hydration, indexeddb specs)

## Analytics & CSP

### Umami client calls api-gateway.umami.dev but CSP only allows cloud.umami.is
**Priority:** P2
**Description:** Surfaced in browser DevTools console on 2026-05-08. The Umami analytics client (`script.js`) is calling `https://api-gateway.umami.dev/api/send` for every event/pageview, but the site's Content Security Policy `connect-src` directive only permits `'self'` and `https://cloud.umami.is`. Every analytics request is blocked at the CSP layer:
```
Connecting to 'https://api-gateway.umami.dev/api/send' violates the following Content Security Policy directive: "connect-src 'self' https://cloud.umami.is".
Fetch API cannot load https://api-gateway.umami.dev/api/send. Refused to connect because it violates the document's Content Security Policy.
```
Net effect: zero pageview/event tracking is currently being captured. The "Search analytics via Umami events" item below depends on this being fixed first.

**Fix:** Verify which endpoint Umami's hosted instance actually expects (could be a recent endpoint migration or a configuration mismatch). Then either (a) update CSP to allow `https://api-gateway.umami.dev` in `connect-src`, or (b) reconfigure the Umami client to point at the allowed `cloud.umami.is` endpoint, or (c) self-host Umami and point at our own domain. Check current CSP source in `astro.config.mjs` / `_headers` / wherever it's defined.
**Depends on:** None — investigate first, then small CSP edit or client-config change.

### Cloudflare Web Analytics beacon failing on DNS-blocked clients
**Priority:** P2
**Description:** Cloudflare Pages auto-injects a Cloudflare Web Analytics beacon (`static.cloudflareinsights.com/beacon.min.js/v{hash}`) on every page. On any client with network-level domain blocking (NextDNS, pi-hole, AdGuard DNS, Brave Shields, uBlock at network layer), the beacon fails with `net::ERR_NAME_NOT_RESOLVED`. Surfaced in console captures on 2026-05-08. Benign for site rendering but produces console noise on every load and double-counts analytics with Umami.

The dormant `fix/csp-cloudflare-insights` branch on origin appears to have been started for this and never finished.

**Fix:** Either (a) turn off Cloudflare Web Analytics in the Cloudflare Pages dashboard (Settings → Web Analytics → disable; we already use Umami so this is duplicative), or (b) finish the `fix/csp-cloudflare-insights` branch with whatever CSP/inline approach it was attempting. Option (a) is one click and removes the noise outright. Option (b) preserves it as a fallback analytics source.
**Depends on:** Decision on whether to keep Cloudflare Web Analytics alongside Umami at all.

### Verify: placeholder-anchor pattern in `keysMatch`
**Priority:** P3
**Description:** Several source specs intentionally declare fewer fields than the rendered DataTable has columns (typically 1 spec field vs 2 site columns). The 1-column spec field is a "placeholder anchor" — the workbook's authored prompt for a row, while the DataTable's second column is the user's response affordance with no workbook authority. Today `keysMatch` treats this shape as `key_drift`, so the affected specs intentionally OMIT their `tableId:` field to silence the check and skip per-component structural assertions.

Net effect: ~8 specs across the 17-module set cannot use `structural_fidelity: { table_count: N }` per-component scoping because adopting it would surface the deliberately-suppressed drift signal.

**Fix:** Extend `keysMatch` (src/lib/verify/runner-checks.ts) to recognize the `spec_field_count < site_column_count` shape as a placeholder-anchor pattern rather than drift, gated on a new spec-side opt-in (e.g., `keys_match: { placeholder_anchor: true }`). Then in a follow-up sweep, add `tableId:` + `structural_fidelity: { table_count: 1 }` to all ~8 affected specs at once for uniform per-component coverage. Audit each spec individually before adding the opt-in to confirm the column-count mismatch is intentional placeholder-anchor and not actual drift.

**Motivated trigger:** A future regression on any of the placeholder-anchor specs (DataTable dropped, duplicated, or split) that current `keysMatch` + `proseMatches` + inventory yaml coverage wouldn't catch as cleanly as per-component `structural_fidelity` would. Until then, the existing coverage layers are sufficient.

**Depends on:** Nothing. Self-contained verifier improvement plus a spec-sweep PR.

### Verify: structural_fidelity can't detect component-type swaps
**Priority:** P3
**Description:** `structuralFidelityMatches` sums DataTable + PlanForm + SlotCollection counts and compares against `table_count`. A spec intending "1 SlotCollection at scope_id X" passes equally if the site renders "1 DataTable at scope_id X" instead — the type identity is invisible to the check. Silent-pass risk for any future split or migration where one component class gets swapped for another at the same scope_id.

**Fix:** Extend `structuralFidelitySchema` with an optional `component_type` enum (`'DataTable' | 'PlanForm' | 'SlotCollection'`) OR with per-type count fields (`{ data_tables?: N, plan_forms?: N, slot_collections?: N }`). When set, the runner asserts not just the total but the per-class counts. Existing `table_count`-only specs continue to work.

**Motivated trigger:** A future spec that legitimately needs to distinguish "1 DataTable" from "1 SlotCollection" at the same scope_id — e.g. a migration that intentionally changes the component class for an existing scope. Today no spec has that shape; the gap is latent.

**Depends on:** Nothing. Self-contained verifier extension.

### Verify: `table_count: 0` + scope_id weakens the Todo-only guarantee
**Priority:** P3
**Description:** The schema currently allows both `table_count: 0` and `scope_id` on the same `structural_fidelity` block. When combined, the runner asserts "zero components with this scope_id" rather than the intended "zero data-bearing components on this page." A regression that introduces a DataTable with a different tableId would silently pass.

**Fix:** Either (a) refine `structuralFidelitySchema` to reject the combination (`table_count: 0` requires `scope_id` to be absent), or (b) carve out the scoped filter when `table_count === 0` so the check always runs file-globally for the Todo-only assertion. Option (a) is the cleaner contract; option (b) lets author intent ("zero of class X") still be expressible but documents the semantic in the docstring. Add tests for both branches.

**Motivated trigger:** A future spec author who pairs the two fields without intending to. Today no spec exists with that shape; if it ever ships, the verifier silently under-asserts.

**Depends on:** Nothing. Self-contained verifier refinement.

### Verify: scoped counting silently skips unparseable component identity
**Priority:** P3
**Description:** `extractStringProp` returns `undefined` for any tableId/formId authored as a computed expression (`tableId={dynamicId}`), template literal, or missing prop. The scoped filter `s.tableId === scope` then drops those components from the count. A page with one correctly scoped component plus a duplicate authored with a computed identity still passes `table_count: 1`. Robustness gap for any site authoring that uses computed identities — which today is zero, but the verifier doesn't enforce that authoring convention.

**Fix:** When `scope_id` filtering is active and any counted component class has at least one entry with an unparseable identity (`undefined` after extraction), emit a `needs_review` soft entry citing the line. Authors can either annotate the spec to acknowledge the dynamic identity or convert the component to a literal string prop. Alternatively, surface a build-time lint that forbids computed identity props on data-bearing components in `src/pages/**` (firmer but more invasive).

**Motivated trigger:** A future authoring pattern that uses computed tableIds (e.g. row-templating). Today all sites author literal string tableIds; the gap is latent until convention changes.

**Depends on:** Nothing. Self-contained verifier refinement.
