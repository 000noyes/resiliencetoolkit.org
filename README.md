# Resilience Hub Toolkit

When disasters hit, internet access goes first. Communities that prepared offline — who know their neighbors, have their supplies, have walked through the plans — do better. This toolkit gives community members a way to work through disaster preparedness together, on-device, without needing an internet connection after the first visit. All data stays on the device via IndexedDB. No accounts, no cloud sync, no server, no analytics, and no third-party trackers — nothing leaves the device.

**Live site:** https://resiliencetoolkit.org
**Hosting:** Cloudflare Pages (auto-deploys on push to main)

---

## How to run locally

```bash
# From resiliencetoolkit.org/
pnpm install
pnpm dev          # Dev server at localhost:4321
pnpm build        # astro check && astro build (postbuild generates SW precache)
pnpm preview      # Preview the build output
pnpm vitest run   # Unit tests
pnpm test:offline # Offline durability + privacy tests (builds dist/, serves via astro preview)
npx playwright test  # E2E tests — needs a dev or preview server running in another terminal
```

> The `npx playwright test` e2e suite expects a server you start yourself
> (`pnpm dev` or `pnpm preview`) in a separate terminal. The offline suite
> (`pnpm test:offline`) is self-contained: it builds `dist/` and serves it via
> `astro preview` so it exercises the real, generated service worker.

---

## Project structure

```
src/
  pages/                    # File-based routing — all routes are hardcoded .astro files
    index.astro             # Homepage
    dashboard.astro         # Progress tracking dashboard
    modules/
      emergency-preparedness/
        index.astro         # Module overview
        1-1.astro           # Section pages (1-1 through 1-13, hardcoded)
        ...
      baseline-resilience/
        index.astro
        2-1.astro through 2-3.astro
      knowing-your-community.astro
  components/               # Astro + React UI components (DataTable, ExternalLink, …)
  design-system/blocks/     # Interactive blocks: Todo, SlotCollection
  layouts/
    BaseLayout.astro        # Global layout
    ModuleLayout.astro      # Module page layout (TOC sidebar + prev/next nav)
  lib/
    storage.ts              # IndexedDB wrapper (singleton)
  data/
    modules.ts              # Module list, phase filtering
  styles/base.css           # CSS variables (oklch color space, dark mode tokens)

public/
  sw.js                     # Service worker source template (sentinels replaced at build time)
  manifest.json             # PWA manifest

scripts/
  generate-sw-precache.mjs  # Postbuild: generates PRECACHE_ASSETS in dist/sw.js from dist/ routes

tests/e2e/                  # Playwright tests
```

**Source of truth:** The [Resilience Hub Toolkit PDF](public/toolkit/) is the authoritative content. The site is a digital interface to that content — local-first interactive checklists that mirror the workbook. When content decisions conflict, the PDF wins.

---

## Tech stack

- **Astro 5** — static output, no server rendering
- **React 18** — interactive islands only (checkboxes, tables, dashboard)
- **Tailwind CSS 3** — utility classes + CSS variable design tokens
- **IndexedDB via `idb`** — all user data stored locally, nothing leaves the device
- **TypeScript** — strict mode
- **pnpm** — package manager
- **Vitest** — unit tests (storage layer + data preservation)
- **Playwright** — E2E tests

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to fork, add sections, and contribute back.
