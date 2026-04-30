# Changelog

All notable changes to ResilienceToolkit.org are documented here.

## [0.0.10] - 2026-04-30

### Source Fidelity restoration across all 17 modules

This release closes the workbook-fidelity sweep. Every module section
page on the site has been walked against the master Resilience Hub
Toolkit workbook PDF and brought back into one-to-one alignment.
Approximately 134 class-c items (drifted titles, reworded prompts,
substituted URLs, dropped sentences, invented links, missing
sub-sections) were either restored verbatim from the workbook or
removed and recorded for audit.

### Added
- `docs/site-inventions-archive.yaml` preserves every removed class-c
  item (~129 entries across 8 categories) with workbook reference,
  inferred source if any, and removal commit. Nothing was deleted
  without an audit trail.
- `docs/toolkit-inventory.yaml` per-module ledger now records
  `class_c_count: 0` and a `structural_fidelity.verdict` for all 17
  modules, with the per-day reconciliation history inline.
- Two new DataTable source specs on 1-9: Neighbor Directory and First
  Responder Directory, both citing the workbook page and Drive folder.
- Source registry (`docs/source-specs/_sources.yaml`) pruned to 26
  content-hash keys, all cited by at least one current spec.
- 1-8 (Populations with specific needs): Seniors+Disabilities IndexedDB
  migration with a real-fixture data-preservation test suite. Existing
  user data on the legacy `senior-citizens` and `people-with-disabilities`
  module keys merges cleanly into the merged `seniors-and-disabilities`
  key with no user-visible loss.
- 1-9 pandemics ExternalLink restored to the workbook folder anchor
  (was substituted with a different Drive file id).
- 14 internal PDF cross-references on 1-9 (Section 1.X / (N.M) anchors)
  now render as site-internal `/modules/...` routes instead of external
  links to GoogleDoc HTML pages.

### Changed
- `pnpm verify` runs in the `prebuild` hook; broken source chains fail
  the build. CI runs verify on every push. Any merge that drifts the
  site away from the workbook is caught before it ships.
- Workbook structural fidelity: KYC restored to the 11-section workbook
  order with the full Bringing People Together agenda + facilitation
  guides + readiness checklist + pod-mapping prose recovered from the
  earlier hardcoded reduction.
- Chapter intros on `baseline-resilience/index.astro` and
  `emergency-preparedness/index.astro` restored to workbook prose +
  cross-link fidelity (closed the chapter-level summary drift surfaced
  during the 2-1 / 2-2 / 2-3 walks).

### Verification
- 486 / 486 unit + integration tests passing.
- `pnpm verify` clean: 25 entries, exit 0.
- `pnpm astro check`: 0 errors, 0 warnings.

### Known follow-up backlog
A targeted spot-check on the three highest-load modules (Knowing Your
Community, 1-8, 1-9) at the close of the sweep surfaced one additional
URL drift on 1-9, which is included in this release, plus four minor
text-level drifts deferred to the follow-up backlog (1-8 title-case +
punctuation; 1-9 bullet split + plain-text internal anchor). None
invalidates the per-module attestation. A full 17-module re-walk is
planned before the next round of verify enforcement ships.

## [0.0.9] - 2026-04-21

### Added
- PlanForm component for single-record forms (title, fields, auto-save, HTML export). Scaffolding for upcoming Phase 2 wiring into the Community Assessment, Shelter Plan, and similar single-record module templates.
- Source-fidelity verification: every user-facing field, label, column header, and option list on the site is now traceable to a page in the Resilience Hub Toolkit PDF or an official template. Drift between the site and the source workbook is caught before merge.
- 1-9 Leader Directory source spec as the reference template for future module wiring.

### Changed
- DataTable internals refactored: save indicator and info callout banner extracted into standalone components (SaveIndicator, InfoCalloutBanner) for reuse by PlanForm and future form components.
- `package.json` version aligned with the authoritative `VERSION` file (was stale at 0.0.5).

### For contributors
- 294 new tests covering verify-skill internals (extract, diff, cache, discover, scaffold, runner) plus PlanForm and storage helpers.
- CI workflow runs verification on every push; broken source chains fail the build.

## [0.0.8] - 2026-04-13

### Added
- Restored Pagefind search on homepage. The search widget was preserved during the cloudflare-minimal simplification but auto-hidden when the pagefind dependency was removed. Now re-enabled with content-scoped indexing (only module section pages are indexed, not nav/footer/homepage).
- Build verification test for pagefind index output.
- Error handling for search failures (try/catch prevents stuck "Searching..." state).

### Removed
- Dead SearchField.astro component from design-system/_deferred/ (homepage uses its own inline search).

## [0.0.7] - 2026-04-13

### Added
- DataTable component (1,346 lines) replaces EditableTable with responsive cards-on-mobile/table-on-desktop layout, save indicator, CSV export, keyboard navigation, and ARIA attributes.
- Journal variant for DataTable: stacked prompt-response layout with auto-resizing textareas, completion counter, and HTML export for printing/sharing at community meetings.
- 3 templates deployed on section 1-9 (Response Plans): Leader Directory, Neighbor Directory, First Responder Directory.
- KYC migration test verifying all 6 existing table column keys are preserved during EditableTable-to-DataTable migration.
- Runtime type guards in storage.ts replacing unsafe `as` type casts on metadata values.
- DESIGN.md documenting the project's visual design system (warm industrial aesthetic, 2-accent system, Outfit font).

### Changed
- Knowing Your Community page migrated from EditableTable to DataTable with journal variant for the 6 KYC tables.
- Section 1-9 (Response Plans) migrated to DataTable with 3 directory templates.

### Removed
- EditableTable component deleted (zero callers remain after KYC migration).
- useAutoResizeTextarea hook deleted (sole caller was EditableTable).

### Fixed
- Resolved `effectiveVariant` temporal dead zone error in DataTable by reordering variable declarations above hooks.
- Fixed Rules of Hooks violation where journal-specific useEffect hooks were placed after conditional early returns.
- Removed nested anchor tag in webinar announcement bar.

## [0.0.6] - 2026-04-05

### Removed
- 8 dead components deleted: `GuestModeBanner`, `LogoHoverCard`, `IconButton`, `MetricCard`, `Sidebar`, `SidebarItem`, `validateRedirect`, `mdx-components`. All had zero imports across the codebase.
- Commented-out `LogoHoverCard` reference in `Header.astro` and `OfflineReadyBanner` reference in `BaseLayout.astro`.

### Changed
- 5 components moved to `src/design-system/_deferred/` for potential future use: `WhatsNewBanner`, `EmptyState`, `OfflineReadyBanner`, `SearchField`, `SegmentedControl`.

## [0.0.5] - 2026-03-29

### Fixed
- Offline mode was silently broken for all users. `public/sw.js` PRECACHE_ASSETS listed old slug formats (`/1-1-kits/`, `/1-2-food-water/`, etc.) that don't match actual built routes (`/1-1/`, `/1-2/`, etc.). Since `cache.addAll()` is atomic, any 404 aborts the entire SW install. Every user who visited the site believed they had offline access. They didn't.
- `scripts/generate-sw-precache.mjs` added as a `postbuild` hook. Reads all `dist/**/index.html` files after each build, generates the correct PRECACHE_ASSETS list, and writes it into `dist/sw.js`. The list can no longer drift — it's computed from the actual built output on every deploy.
- SW install handler switched from `cache.addAll()` (all-or-nothing) to `Promise.allSettled()` with per-URL error logging. A single transient 404 now logs a warning instead of aborting the entire SW install.
- `CACHE_VERSION` auto-bumped to a build timestamp (`v-build-YYYYMMDDHHmmss`) on every deploy. No more manual version bumps required.

### Changed
- README rewritten mission-first: leads with the offline disaster-preparedness use case, drops version string and internal history, points to CONTRIBUTING.md for contributor details.
- CONTRIBUTING.md updated: adds `> [!WARNING]` block for the moduleKey rename contract, documents how to add a new section, and updates the CACHE_VERSION step to note the build handles it automatically.

## [0.0.4] - 2026-03-28

### Changed
- Homepage field snapshot photos disabled (kept in codebase, not rendered) to reduce page weight and visual noise pending a content review.
- Dashboard "Module 1" quick-link now points to the correct module landing page (`/modules/knowing-your-community`) instead of a broken subsection URL.

### Removed
- Changelog link removed from site footer. The `/changelog` page still exists but is not linked from navigation until content is current.

## [0.0.3] - 2026-03-28

### Added
- `/replicate` page — step-by-step guide for other communities to fork and deploy their own Resilience Hub on Cloudflare Pages.
- Data import/export on the dashboard now uses a single atomic IndexedDB transaction — a mid-import crash no longer leaves data in a partially-written state.
- Dashboard empty state shows a CTA linking to Module 1 when no progress has been recorded yet.
- Export button shows the timestamp of the last export.
- CONTRIBUTING.md with fork-and-deploy instructions for Cloudflare Pages.

### Changed
- Service worker replaced with a minimal 65-line cache-first SW (down from 309 lines). Removes dead background-sync code and eliminates the build-time hash-update step that caused cache staleness on deploys.
- Build script simplified to `astro check && astro build` — pagefind and the SW asset updater are no longer build dependencies.
- Homepage search widget gracefully hides itself when pagefind is not built (instead of showing a broken search UI).
- Deployment target updated from Render to Cloudflare Pages (`astro.config.mjs` site URL, `replicate.astro` instructions).

### Fixed
- WCAG AA: skip-to-content link added for keyboard and screen reader users.
- Todo checkmark animation uses opacity transitions instead of conditional rendering — no layout shift on toggle.
- Minimum 44px tap targets on interactive elements per WCAG touch target guidelines.
- `importAllData()` no longer references an undefined TypeScript type (`MetadataValue`) on this branch.

### Removed
- Keystatic CMS integration and MDX content pipeline (simplification — content lives in `.astro` files).
- `pagefind` dependency and post-build search index generation.
- `scripts/update-sw-assets.mjs` and `render.yaml` (no longer needed).

## [0.0.2] - 2026-03-27

### Added
- Sections 1.9 (Community Emergency Response Plans) and 1.10 (Volunteer Management) now have interactive Todo checkboxes — previously these were informational-only pages with no checkable items.
- Navigation from the last section of Module 1 (section 1.13) now links forward to Module 2, section 2.1. You can now page through the full toolkit without manually jumping between modules.
- E2E tests for Todo checkbox interactivity, ExternalLink confirmation modal, and cross-module navigation.

### Fixed
- External links (the ones that open a confirmation modal before leaving the site) no longer cause a hydration error when the page first loads. They now render as plain links until the React island is ready, then activate — no console errors, no broken links.
- Cross-module navigation guards now verify the actual section slug (not just position), making them resilient to future content reordering.

### For contributors
- `CANONICAL_MODULE_KEYS` in `data-preservation.test.ts` updated to include `community-emergency-response` and `volunteer-management` (bumped count: 19 → 21).
- Playwright test artifacts (`test-results/`, `playwright-report/`) added to `.gitignore`.
