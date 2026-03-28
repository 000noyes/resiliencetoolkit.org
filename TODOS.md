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

## Search

### Homepage search hidden — add back or rethink approach
**Priority:** P3
**Description:** Pagefind was removed in `cloudflare-minimal` (simplification goal: remove build complexity). The homepage search widget now auto-hides itself via JS when `/pagefind/pagefind.js` is absent. Re-evaluate for July LAOB deployment: pagefind is lightweight and the search UX is good. Options: (a) restore pagefind to build script, (b) replace with a simpler client-side search over a static JSON manifest, (c) remove the search UI entirely.
**Context:** Search hidden is better than search broken. The widget code is preserved — re-enabling pagefind in `package.json` + build script restores it immediately.
**Depends on:** July deployment feedback
