# TODOS

## Storage & Data Safety

### ~~Non-atomic batch operations in storage.ts~~ RESOLVED
**Priority:** P2
**Status:** Fixed in `cloudflare-minimal` (cherry-picked from `glass-box-expanded` Phase 7). Both `batchUpdateChecklistItems` and `clearCompletedItems` now use single IDB transactions.

### Unsafe `as` type casts on metadata values
**Priority:** P3
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

### Remove 11 unused components + dead lib files
**Priority:** P2
**Description:** 11 components with zero imports anywhere in pages or layouts — artifacts from speculative design system work: `GuestModeBanner.tsx`, `LogoHoverCard.tsx`, `WhatsNewBanner.tsx`, `EmptyState.astro`, `IconButton.astro`, `MetricCard.astro`, `OfflineReadyBanner.astro`, `SearchField.astro`, `SegmentedControl.astro`, `Sidebar.astro`, `SidebarItem.astro`. Also: `validateRedirect.ts` (auth redirect logic, no callers, no auth system), `mdx-components.tsx` (MDX removed).
**Fix:** Delete all of the above. Confirm no imports missed with a grep before deleting.
**Depends on:** None

### Investigate ExternalLink abstraction
**Priority:** P3
**Description:** `ExternalLink.tsx` → `ExternalLinkModal.tsx` → `externalLinkPreferences.ts` — ~300 lines to show a "you're leaving this site" modal before opening external links. Used in 16 pages. Investigate why this abstraction was added before removing — there may be a deliberate reason (accessibility, community trust, hosted-in-contexts-without-internet). If no good reason, replace with plain `<a target="_blank" rel="noopener noreferrer">` and a CSS external-link icon.
**Fix:** Audit usage, understand original intent, decide: keep (document why) or replace (simpler `<a>`).
**Depends on:** None

## Search

### Homepage search hidden — add back or rethink approach
**Priority:** P3
**Description:** Pagefind was removed in `cloudflare-minimal` (simplification goal: remove build complexity). The homepage search widget now auto-hides itself via JS when `/pagefind/pagefind.js` is absent. Re-evaluate for July LAOB deployment: pagefind is lightweight and the search UX is good. Options: (a) restore pagefind to build script, (b) replace with a simpler client-side search over a static JSON manifest, (c) remove the search UI entirely.
**Context:** Search hidden is better than search broken. The widget code is preserved — re-enabling pagefind in `package.json` + build script restores it immediately.
**Depends on:** July deployment feedback
