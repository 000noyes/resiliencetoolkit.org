# TODOS

## Storage & Data Safety

### ~~Non-atomic batch operations in storage.ts~~ RESOLVED
**Priority:** P2
**Status:** Fixed in `glass-box-expanded` branch (Phase 7). Both `batchUpdateChecklistItems` and `clearCompletedItems` now use single IDB transactions.

### Unsafe `as` type casts on metadata values
**Priority:** P3
**Description:** storage.ts uses `as number`, `as string[]` etc. on `getMetadata()` returns without runtime validation. If stored data has wrong type (from a bug or version mismatch), arithmetic silently produces NaN. Consider adding runtime type guards.
**Context:** Introduced by type safety improvements in this branch. The `any` type was replaced with `MetadataValue` union, but casts bypass the union's safety guarantees at runtime.
**Depends on:** None

## Routing & Navigation

### ~~Duplicate pages for knowing-your-community~~ RESOLVED
**Priority:** P1
**Status:** Fixed in `glass-box-expanded` branch (Phase 1). Static page now redirects 301 to `/modules/knowing-your-community/0-1`.

### Null sectionData produces blank page
**Priority:** P2
**Description:** All three `[slug].astro` files conditionally render `{sectionData && (...)}`. If `getSectionNavigation()` returns null (slug mismatch, YAML misconfiguration), the page renders blank with HTTP 200 — no error, no 404. Should show a 404 or error message.
**Context:** Pre-existing pattern. Affects all dynamic section routes.
**Depends on:** None

## Content Schema

### No enum validation for `module` field in content schema
**Priority:** P3
**Description:** The sections content collection schema uses `z.string()` for the `module` field. A typo like `emergancy-preparedness` would build fine but the section would be invisible — not matched by any `[slug].astro` `getStaticPaths()`. Should use `z.enum()` with valid module slugs.
**Context:** Pre-existing. Low risk while edits go through code review, but becomes important when Keystatic CMS is enabled for external contributors.
**Depends on:** None

### Keystatic has no guard against moduleKey changes
**Priority:** P2
**Description:** The `moduleKey` field in Keystatic is a plain text input. An editor could rename it, silently orphaning all user data in IndexedDB. The data preservation test catches this in CI, but CMS editors may not run tests locally.
**Context:** Pre-existing architectural concern. Blocked by Keystatic's lack of read-only field support. Mitigated by the data preservation regression test.
**Depends on:** Keystatic feature: read-only fields or validation hooks

## Dashboard & Reporting

### Community Readiness Score
**Priority:** P3
**Description:** Aggregate metric on the dashboard that combines todo completion, modules started, and table rows filled to produce a single "readiness" percentage. Gives users a motivational at-a-glance number.
**Context:** Proposed during CEO review of glass-box-expanded plan (2026-03-23). Deferred from this branch — good metric but needs design work on weighting formula.
**Depends on:** None

### Printable community report
**Priority:** P3
**Description:** "Generate Report" button on the dashboard that produces a print-optimized summary of all completed items, table entries, and progress stats. Useful for sharing with town officials or at community meetings.
**Context:** Proposed during CEO review of glass-box-expanded plan (2026-03-23). Deferred — print styling is fiddly and can follow as a separate PR.
**Depends on:** None

## Design System

### Create DESIGN.md
**Priority:** P2
**Description:** Run `/design-consultation` to create a DESIGN.md file that documents the project's design system: color tokens, typography, spacing, shadows, motion, and component patterns. Currently spread across base.css and ad-hoc component styles.
**Context:** Identified during glass-box-expanded planning. The project has a design system in base.css but no single-source-of-truth design doc.
**Depends on:** None

## Completed
