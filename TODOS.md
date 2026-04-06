# TODOS

## Storage & Data Safety

### ~~Non-atomic batch operations in storage.ts~~ RESOLVED
**Priority:** P2
**Status:** Fixed in `cloudflare-minimal` (cherry-picked from `glass-box-expanded` Phase 7). Both `batchUpdateChecklistItems` and `clearCompletedItems` now use single IDB transactions.

### Unsafe `as` type casts on metadata values
**Priority:** P2 (upgraded from P3 — Step 1 template work adds 14+ DataTable instances, increasing surface area)
**Description:** `storage.ts` uses `as number`, `as string[]` etc. on `getMetadata()` returns without runtime validation. If stored data has the wrong type (from a bug or version mismatch), arithmetic silently produces NaN. Consider adding runtime type guards.
**Context:** Pre-existing. The `any` type was replaced with `MetadataValue` union, but casts bypass the union's safety guarantees at runtime.
**Depends on:** None

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

### KYC migration column-key test
**Priority:** P1 (Phase 1 blocker)
**Description:** EditableTable stores row data keyed by raw column header strings (`'Prompt'`, `'Your Response'`, `'Role'`, `'Name(s)'`, `'Question'`). DataTable must use these identical strings as storage keys for KYC migration. `data-preservation.test.ts` only checks moduleKey existence, not column-level keys. Without a dedicated test, a DataTable that normalizes column keys (e.g., `'prompt'` instead of `'Prompt'`) will pass all tests and silently drop user data.
**Fix:** Write a migration-specific Vitest test that: (1) seeds IndexedDB with mock data using the exact column key strings EditableTable uses, (2) loads DataTable for each of the 6 KYC tables, (3) asserts all seeded data resolves correctly through DataTable's read path.
**Depends on:** DataTable component exists (Phase 1)

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

## Search

### Homepage search hidden — add back or rethink approach
**Priority:** P3
**Description:** Pagefind was removed in `cloudflare-minimal` (simplification goal: remove build complexity). The homepage search widget now auto-hides itself via JS when `/pagefind/pagefind.js` is absent. Re-evaluate for July LAOB deployment: pagefind is lightweight and the search UX is good. Options: (a) restore pagefind to build script, (b) replace with a simpler client-side search over a static JSON manifest, (c) remove the search UI entirely.
**Context:** Search hidden is better than search broken. The widget code is preserved — re-enabling pagefind in `package.json` + build script restores it immediately.
**Depends on:** July deployment feedback
