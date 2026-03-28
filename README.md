# Resilience Hub Toolkit

Local-first interactive checklists for community disaster preparedness. Community members use the toolkit to track what they've done, what they still need, and how their group is prepared — before, during, and after disasters. All data stays on-device via IndexedDB. No accounts, no cloud sync, no server.

**Live site:** https://resiliencetoolkit.org
**Hosting:** Cloudflare Pages (auto-deploys on push to main)
**Version:** 0.0.3

---

## Tech stack

- **Astro 5** — static output, no server rendering
- **React 18** — used only for interactive islands (checkboxes, tables, dashboard, export/import)
- **Tailwind CSS 3** — utility classes + CSS variable design tokens
- **IndexedDB via `idb`** — all user data stored locally, nothing leaves the device
- **TypeScript** — strict mode
- **pnpm** — package manager
- **Vitest** — unit tests (storage layer + data preservation)
- **Playwright** — E2E tests

Keystatic CMS and Pagefind were removed. They are not present in this codebase.

---

## How to run locally

```bash
# From resiliencetoolkit.org/
pnpm install
pnpm dev          # Dev server at localhost:4321
pnpm build        # astro check && astro build
pnpm preview      # Preview the build output
pnpm vitest run   # Unit tests (31 tests)
npx playwright test  # E2E tests (requires dev server running in another terminal)
```

---

## Project structure

```
src/
  pages/                    # File-based routing — all routes are hardcoded .astro files
    index.astro             # Homepage
    dashboard.astro         # Progress tracking dashboard
    changelog.astro         # Changelog (not linked from nav — in development)
    modules/
      emergency-preparedness/
        index.astro         # Module overview
        1-1.astro           # Section pages (1-1 through 1-13, hardcoded)
        ...
      baseline-resilience/
        index.astro
        2-1.astro through 2-3.astro
      knowing-your-community.astro
  content/
    modules/                # YAML metadata — section order, titles, slugs, phases
  components/               # Astro + React UI components
  design-system/blocks/     # Interactive blocks: Todo, EditableTable, InteractiveChecklist
  layouts/
    BaseLayout.astro        # Global layout
    ModuleLayout.astro      # Module page layout (TOC sidebar + prev/next nav)
  lib/
    storage.ts              # IndexedDB wrapper (singleton, 884 lines)
    navigation.ts           # Computes prev/next links from YAML metadata
    data-preservation.test.ts  # Regression test protecting IndexedDB keys
  data/
    modules.ts              # Module list, phase filtering
    changelog.ts            # Changelog entries
    downloads.ts            # Download links
  styles/base.css           # CSS variables (oklch color space, dark mode tokens)

public/
  sw.js                     # Service worker (cache-first, minimal)
  manifest.json             # PWA manifest
  images/                   # Field snapshot photos (disabled on homepage, preserved)
  toolkit/                  # PDF downloads

tests/e2e/                  # Playwright tests
```

---

## Content model

All 17 section pages are **hardcoded `.astro` files**, not dynamic routes. Each page contains its own inline `SectionData` with prev/next navigation pre-computed. Module metadata (section order, titles, slugs) lives in `src/content/modules/*.yaml` and is used by the navigation utilities and module index pages.

**Interactive components** persist data to IndexedDB using composite keys: `${moduleKey}-${todoId}`. The canonical set of 21 moduleKeys is enforced by `src/lib/data-preservation.test.ts`. **Renaming or removing a moduleKey destroys user data.** Adding new keys is safe.

---

## What was attempted and why it was reverted

The previous architecture used:
- **Keystatic CMS** — a web-based editing interface at `/keystatic` for managing MDX content
- **MDX content collections** — section content in `.mdx` files under `src/content/sections/`
- **Dynamic `[slug].astro` routes** — rendering MDX sections at build time
- **Pagefind** — client-side search built from the static output

The MDX migration was attempted on the `glass-box-expanded` branch. It failed in deployment: multiple section pages became unloadable, the site was broken in production for more than a week before the decision was made to revert. The root cause was that MDX compilation and dynamic routing added build-time fragility without a tested rollback path — pages that worked locally failed in the Cloudflare Pages build environment.

The current approach (hardcoded `.astro` pages) is less elegant but more resilient. Every page is a concrete file. If one breaks, the others don't.

---

## Current status by section

| Feature | Status |
|---|---|
| All 17 module section pages | Working |
| Interactive checkboxes (Todo) | Working — persists to IndexedDB |
| Editable tables (EditableTable) | Working — persists to IndexedDB |
| Dashboard (progress, activity, export/import) | Working |
| Streak + weekly goal tracking | Working |
| Dark mode | Working |
| Offline / PWA | Partial — service worker precache URLs have a known mismatch with actual routes (see below) |
| Homepage field snapshot photos | Disabled 2026-03-28 — HTML preserved, images in `public/images/` |
| Changelog page | Exists at `/changelog`, not linked from navigation — in development |
| Search (Pagefind) | Removed — search UI hides gracefully when not present |
| Keystatic CMS | Removed |

**Known issue — service worker precache:** `public/sw.js` contains a `PRECACHE_ASSETS` list with old URL slugs (e.g., `/1-1-kits/`) that don't match the actual built routes (`/1-1/`). This causes the SW install to fail silently, breaking offline mode. Fix requires auditing the list against actual `dist/` output after build.

---

## What not to do

**Don't migrate content formats or add abstraction layers without a rollback plan and without verifying every page loads in the actual deploy environment.**

Specifically: the MDX migration worked locally, passed local tests, and still broke production. The lesson is that build-time content processing (MDX compilation, CMS integration, dynamic route generation) can fail in ways that only appear in the target environment. If you're adding a layer like this:

1. Prove it works in a staging deploy before touching production
2. Have a concrete rollback: a commit hash, a branch, a tested revert procedure
3. Verify every page URL loads — not just the index, not just a sample

The current codebase is deliberately simple. A section page is a `.astro` file. You can read it, you can test it, you can see exactly what it does. That's the standard to maintain.
