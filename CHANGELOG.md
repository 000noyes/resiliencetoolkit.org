# Changelog

All notable changes to ResilienceToolkit.org are documented here.

## [0.0.15.0] - 2026-07-24

### Added
- The corner button now opens a small panel of doors. Questions holds the
  same message form as before. Fund this work shows the two ways to support
  the toolkit: donate online, or mail a check with Toolkit in the memo. The
  "Have Questions?" pill became a plus icon in the same corner.
- The site can build a workshop copy of itself for review sessions: every
  page there carries a plain strip naming what it is, search engines are told
  to skip it, and the offline features stay off there so the copy is always
  served fresh. The finished site keeps every offline feature.
- Review rounds: a page reached only by a direct link where a group can tap
  a spot, leave a numbered note with or without a name, read each other's
  notes, and pick the conversation up at their next meeting. Notes are kept
  even when saving fails: the words stay on screen with a retry and a copy
  button. The round page prints cleanly.

### Changed
- Nothing on the finished site changes except the corner button.

## [0.0.14.0] - 2026-07-18

### Added
- The dashboard now answers one question first: whether the work on this
  device is backed up, in one sentence, with the count of changes ready to
  back up when there are any. Below the answer, a small table shows what is
  saved on this device, module by module, with sizes.
- Restoring from a backup shows a preview first: the file's name, the date it
  was made, and what it holds. Nothing changes until you say so. When the
  file may be missing newer work on this device, the dashboard offers to back
  this device up first and the replace choice steps back. A file holding
  fewer modules than the device says exactly what replacing would remove.
- Backup files now carry the date and time they were made, the name of the
  device that made them when one is set, and a plain sentence inside telling
  whoever finds the file where it goes.
- On phones that support it, a "Send a copy to a device you own" option
  shares the backup file directly, with a one-time reminder to send it only
  somewhere private that you own.
- A printable recovery card at /recovery-card with the restore steps in words
  that can be read aloud over a phone.
- Every backup file this site has ever made keeps restoring, and test files
  from each format are now checked on every change to keep it that way.
- A brief "Updating to the latest version." note now appears at the bottom of
  the page in the moment before the site refreshes to apply an update, so the
  refresh reads as an update instead of a glitch. Edits in progress are still
  saved before any refresh.
- A quiet "A newer version of this site is ready" notice with a Refresh
  button appears when an update has fully downloaded. Refreshing is always
  optional: ignored updates apply on their own the next time the site is not
  being looked at, and edits in progress are saved before any refresh.

### Changed
- One set of words everywhere: you back up your work and you restore it from
  a backup file. The dashboard, module pages, downloads page, questions and
  answers, and the offline page all tell the same story the same way.
- The storage reminder is now based on your work, not the calendar: it
  appears only when unprotected work exists on a device at risk, and never
  for a visitor who has not saved anything. Backing up quiets it immediately.
- The streak and goal card is retired. Keeping work safe is not a game, and
  a broken streak should never greet someone coming back after a hard week.
- Top-of-page notices now show one at a time. When more than one would apply
  (for example an offline indicator, an update prompt, and a storage reminder),
  the single most important message shows instead of a stack of bars above the
  page. The storage reminders were rewritten to be calmer and clearer, and both
  the soft reminder and the out-of-space warning now link straight to the
  one-tap backup on the dashboard. The "you're back online" flash is now a
  quiet green.

### Fixed
- The dashboard no longer treats an untouched module as started. Opening a
  community module lays out its workbook prompts as blank rows to fill in;
  previously those empty prompts — and older backups made of them — could count
  toward "Modules Started" and show recent activity before anything was
  entered. Modules started and the last-activity time now reflect only rows
  where you have written a response. Your saved answers are unchanged.
- Devices still stuck on a broken mid-July copy of the site now recover on
  their own within a visit or two. The rare cache problem fixed on July 16
  could leave an already-affected device serving pages whose own scripts would
  not load, even after a reload, because the code that applies updates rides
  in those same scripts. The service worker itself now hands off to the
  current version once, with no action needed. Saved answers are never
  touched.
- A rare unstyled-page flash around site updates. While a deploy is settling,
  a request for a stylesheet or script could be answered with a copy of the
  home page instead of the file, and that wrong answer could be kept and
  replayed. The site now refuses to keep or serve such responses, holds back
  the update notice until the downloaded update is verified sound, and repairs
  itself automatically on the next load (previously a manual hard refresh was
  needed). Saved answers were never affected.
- Unknown addresses now show a proper "page not found" message instead of a
  copy of the home page.
- Returning visitors no longer see weeks-old pages. Devices pinned to an old
  service worker that never handed off now pick up the current site on their
  next visit, with no action needed and no effect on saved answers (all user
  data lives in on-device storage that updates never touch). `sw.js` is now
  served uncacheable so future updates reach devices promptly.
- Offline durability: the service worker now precaches the full built asset
  manifest, so a precached-but-unvisited page opened offline renders fully
  styled and interactive instead of unstyled. Service-worker cache matching now
  ignores the `Vary` header so cross-origin-imported module bundles resolve
  offline.

### Removed
- Third-party analytics and trackers (Umami + Cloudflare Web Analytics),
  including their Content Security Policy entries. The site now makes zero
  cross-origin requests — nothing leaves the device. Enforced by a
  network-purity test in CI.

## [0.0.13.0] - 2026-05-25

### Changed
- Restore 3-slot structure on the "Mapping your community" exercise
  (knowing-your-community module) per workbook p10. Existing
  responses migrate into Slot 1; Slots 2-3 start empty.

## [0.0.12.0] - 2026-05-25

### Changed
- Restore checkbox-per-action progress on 2-1 carpooling initiatives
  (split into parent + 3 sub-action todos per workbook p81 structure).

## [0.0.11.2] - 2026-05-25

### Changed
- Source-fidelity verifier now recognizes SlotCollection components
  alongside DataTable and PlanForm when checking structural fidelity,
  supports a `table_count: 0` assertion for pages whose authored
  components are entirely Todo-based, and scopes its component count
  via a new `structural_fidelity.scope_id` field (decoupled from the
  top-level `spec.tableId` so PlanForm- or SlotCollection-only specs
  can scope without triggering key-alignment checks). Prop-name
  parsing in the site extractors also tightened to reject hyphenated
  suffix matches like `data-count`. No user-facing change; tightens
  the regression net around module pages.

## [0.0.11.1] - 2026-05-18

### Removed
- Knowing Your Community no longer renders the "Pods and Pod Mapping
  Worksheet" appendix prose inline. The Mia Mingus essay and the BATJC
  POD MAPPING WORKSHEET section (workbook pages 19–23) are now reached
  exclusively via the existing "Download Pod Mapping Worksheet" callout
  on the page, which links to a standalone PDF containing the full
  essay, the worksheet instructions, and the graphical pod-mapping
  diagrams together. The prose and the diagrams are designed to be read
  together; the inline duplication was retired in favor of the linked
  download as the single canonical surface for the appendix. The Pod
  Mapping Worksheet callout itself, the workbook page-17 instructions
  introducing the activity, and all other module content are unchanged.

## [0.0.11.0] - 2026-05-10

### Added
- Knowing Your Community now includes the BATJC Pod Mapping Worksheet
  reproduced verbatim from the workbook (pages 22–23). Readers see the
  short pod-mapping setup AND the longer worksheet — including the
  BATJC framing about prisons, sexual violence, and resource networks
  like domestic violence services, nursing-school cohorts, and
  transformative-justice groups. Previously only the workbook's short
  page-17 instructions were rendered, omitting content that the
  Bay Area Transformative Justice Collective specifically authored
  for transformative-justice work.
- Source verifier now recognizes a `structural_flatten` family: places
  where the workbook authors a structured sub-collection (numbered
  slots, sub-bullets, or sub-columns) but the site renders a single
  flattened field. Three live entries land in this release —
  place-characteristics row-0 (workbook p10, three numbered slots
  rendered as one free-text cell), carpooling-initiatives Todo
  (workbook p81, three sub-bullets concatenated into one Todo body),
  and the Skill building "Other" subcolumn (workbook p88, a two-column
  print layout rendered as one flat list of nine Todos).
- Source specs can now declare a paired `structural_flatten` block
  pointing at one of those archive entries. The runner emits
  `structural_flatten_unarchived` (hard failure) when a spec asserts a
  flatten with no matching archive entry, and
  `structural_flatten_pending` (soft, needs-human-review class) for
  entries the archive marks `pending_restore` — a deliberate bridge
  state between archiving a divergence and restoring the structured
  shape on the site. Entries marked `accepted_decorative` pass cleanly
  when an archive entry exists; the subcolumn entry takes this
  resolution. Specs that mark a flatten as `restored` must also declare
  a paired `structural_fidelity` block so the runner can enforce the
  restored shape; the runner emits `needs_human_review` when that
  pairing is missing.
- Per-archive forward-pointers (`proposed_canonical_field`) seed a
  future canonical-fields registry with two substrate-shape proposals:
  `structured_collection_3_slot` (counted enumeration) and
  `checklist_3_action` (fixed-N action list with per-child completion).

### Changed
- Service worker updates now land silently. A new worker installs in the
  background and takes over on the next visit (after every site tab is
  closed). Network-first navigation keeps in-flight tabs fresh in the
  meantime. The earlier "Toolkit update available" toast has been removed
  along with its visit-counter escalation logic — the prompt fired on
  nearly every visit during active development, while saying nothing
  about what changed, and felt like noise rather than signal.
- Footer now shows a small "Last updated YYYY-MM-DD" stamp built from the
  deploy date — quiet transparency that the site is being maintained,
  without committing to a public changelog cadence.

### Removed
- `UpdatePromptToast` component, its `update-prompt` visit-counter state
  machine, and the `pulse-soft` motion token that animated its
  highest-urgency stage. The bottom-right toast pattern reference
  template remains in `src/design-system/_deferred/` for future reuse.
- Service worker `SKIP_WAITING` message handler and the client-side
  `controllerchange → reload` handler — neither has a caller now that
  the toast is gone.

## [0.0.10] - 2026-05-03

### Source Fidelity restoration across all 17 modules

This release closes the workbook-fidelity sweep. Every module section
page on the site has been walked against the master Resilience Hub
Toolkit workbook PDF. Approximately 134 class-c items (drifted titles,
reworded prompts, substituted URLs, dropped sentences, invented links,
missing sub-sections) were either restored verbatim from the workbook
or removed and recorded for audit. Four minor text-level drifts
surfaced in a final spot-check are deferred to a follow-up backlog
(see "Known follow-up backlog" below) — none invalidates the
per-module attestation.

### Added
- `docs/site-inventions-archive.yaml` preserves every removed class-c
  item (129 entries across 9 categories) with workbook reference,
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
- Internal PDF cross-references on 1-9 (Section 1.X / (N.M) anchors)
  now render as site-internal `/modules/...` routes instead of external
  links to GoogleDoc HTML pages.
- Layout-aware link check in the source-fidelity verifier
  (`src/lib/verify/runner-checks.ts` + `src/lib/verify/site-parse.ts`).
  When a spec links entry's URL matches the section's
  `getResourcesUrlForSection(sectionData.number)` lookup in
  `src/data/downloads.ts`, the URL is treated as present on the page
  via the `ModuleLayout` "See Additional Resources" button affordance.
  Adds an `extractSectionNumber()` extractor and 8 new unit tests.
- Fallback Table-of-Contents entry on pages with no semantic headers
  and no table section headers. Pages 1-3, 1-5, 1-12, and 1-13 now
  render a "Top of page" sidebar entry instead of collapsing the
  layout column.
- `pnpm vitest run` and `pnpm astro check` jobs added to the
  GitHub Actions `verify-against-source` workflow so CI matches the
  full gate set the project ships against.

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
- Outdated April 15 webinar announcement removed from the homepage.
- Six module pages no longer carry a redundant
  `<p>Folder with resources and templates: ...</p>` body line
  (knowing-your-community, 1-1, 1-2, 1-3, 1-4, 1-5). The folder URL
  remains reachable via the `ModuleLayout` "See Additional Resources"
  button on every section page that has a `resourcesUrl` entry in
  `src/data/downloads.ts`. Removing the body line also retired the
  upstream-workbook-typo labels "1.4 First aid and medical" (previously
  rendered on the 1.3 page) and "1.3 Power supply" (previously
  rendered on the 1.4 page).
- Source-spec narratives, inventory entries, and archive entry
  rationales for the six cleaned-up pages updated to describe the
  folder URL's layout-button surface and the verifier's layout-aware
  exemption.

### Fixed
- TOC sidebar no longer collapses the layout column on module pages
  with no semantic headers (1-3, 1-5, 1-12, 1-13).
- Build-output and skill-file tests skip cleanly when their
  prerequisite files are absent, so CI passes without a build step or
  installed skill files.
- TODO entry for "Keep public/toolkit/sections/ PDFs in sync with
  canonical workbook" reworded in product-maintenance terms.

### Verification
- 494 / 494 unit + integration tests passing locally; 488 + 6 skipped
  in CI (build-output and skill-file tests skip when their prerequisite
  files are absent).
- `pnpm verify` clean: 25 entries, exit 0.
- `pnpm astro check`: 0 errors, 0 warnings, 10 pre-existing hints.

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
