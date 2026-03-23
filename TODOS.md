# TODOS

## Storage & Data Safety

### Non-atomic batch operations in storage.ts
**Priority:** P2
**Description:** `batchUpdateChecklistItems` (lines 384-399) and `clearCompletedItems` (lines 404-416) each open separate IndexedDB transactions per item. A crash mid-batch leaves data in an inconsistent state. Should use a single IDB transaction for atomicity.
**Context:** Found by adversarial review on `migration-first-foundation` branch (2026-03-23). Pre-existing pattern, not introduced by the MDX migration. Risk is low for typical usage but matters during disaster scenarios (low battery, offline, spotty power).
**Depends on:** None

### Unsafe `as` type casts on metadata values
**Priority:** P3
**Description:** storage.ts uses `as number`, `as string[]` etc. on `getMetadata()` returns without runtime validation. If stored data has wrong type (from a bug or version mismatch), arithmetic silently produces NaN. Consider adding runtime type guards.
**Context:** Introduced by type safety improvements in this branch. The `any` type was replaced with `MetadataValue` union, but casts bypass the union's safety guarantees at runtime.
**Depends on:** None

## Routing & Navigation

### Duplicate pages for knowing-your-community
**Priority:** P1
**Description:** Both `/modules/knowing-your-community` (static .astro) and `/modules/knowing-your-community/0-1` (MDX dynamic) serve the same content. The static page should redirect to the MDX version, or be removed with the route handled by the MDX dynamic route only.
**Context:** The static page was preserved during migration for backwards compatibility. It should be converted to a redirect in the next branch.
**Depends on:** None

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

## Completed
