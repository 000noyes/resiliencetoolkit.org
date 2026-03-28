# Changelog

All notable changes to ResilienceToolkit.org are documented here.

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
