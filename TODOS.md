# TODOS

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

### Investigate ExternalLink abstraction
**Priority:** P3
**Description:** `ExternalLink.tsx` → `ExternalLinkModal.tsx` → `externalLinkPreferences.ts` — ~300 lines to show a "you're leaving this site" modal before opening external links. Used in 16 pages. Investigate why this abstraction was added before removing — there may be a deliberate reason (accessibility, community trust, hosted-in-contexts-without-internet). If no good reason, replace with plain `<a target="_blank" rel="noopener noreferrer">` and a CSS external-link icon.
**Fix:** Audit usage, understand original intent, decide: keep (document why) or replace (simpler `<a>`).
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
