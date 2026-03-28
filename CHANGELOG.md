# Changelog

All notable changes to ResilienceToolkit.org are documented here.

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
