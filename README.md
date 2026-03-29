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