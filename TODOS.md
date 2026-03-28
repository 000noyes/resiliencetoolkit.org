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

### SW precache is all-or-nothing — no per-asset resilience
**Priority:** P3
**Description:** `cache.addAll(PRECACHE_ASSETS)` is atomic — if any single URL returns non-200, the entire SW install fails and offline mode is unavailable. The old SW used `Promise.allSettled` with per-asset error logging so a single dead URL wouldn't block the rest. The current minimal SW trades this resilience for simplicity.
**Context:** Flagged in code review of `cloudflare-minimal`. All current precache URLs are verified valid, so risk is low. Becomes more important if pages are added or removed without updating the list.
**Depends on:** None

### PRECACHE_ASSETS URLs don't match actual page routes
**Priority:** P3
**Description:** `public/sw.js` PRECACHE_ASSETS lists slugs like `/modules/emergency-preparedness/1-1-kits/`, `/1-2-food-water/` etc. but the actual built routes are `/modules/emergency-preparedness/1-1/`, `/1-2/` etc. Since `cache.addAll()` is atomic, any 404 aborts the entire SW install and offline mode is unavailable.
**Context:** Flagged in PR #7 code review. Pre-existing before this PR. Compounds the all-or-nothing risk above — wrong URLs are guaranteed 404s, not just possible ones.
**Fix:** Audit PRECACHE_ASSETS against `dist/` output after each build, or generate the list from the build manifest automatically.
**Depends on:** None

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
