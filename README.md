# Resilience Hub Toolkit

When disasters hit, internet access is often one of the first things to go. Communities that prepared ahead do better: they know their neighbors, have their supplies, and have walked through the plans. This toolkit gives community members a way to work through disaster preparedness together. After the first visit it works without an internet connection. Your saved work stays on your device, and the site has no accounts. The section [What leaves your device](#what-leaves-your-device) states exactly what the site sends.

**Live site:** https://resiliencetoolkit.org
**Hosting:** Cloudflare Pages (auto-deploys on push to main)
**Changes:** each release is listed at [resiliencetoolkit.org/changelog](https://resiliencetoolkit.org/changelog/) and in [CHANGELOG.md](CHANGELOG.md).

---

## What leaves your device

Work you save on the site stays in your browser's storage on your device, and the site never sends it anywhere. Backups and exports are files saved to your device.

Opening a page while online sends an ordinary page request to the site, which Cloudflare hosts and handles under its own privacy policy. For each page load the server records the page's path, the time, and one label for the kind of request: a browser, a browser opening its saved copy, a declared crawler, or unknown. The site sets no cookie, and the server stores no IP address, no browser details, no referrer and no identifier, so one page load is never linked to another.

When you open a page from the copy saved on your device while online, your browser sends one check to the server with that page's address and nothing about you, and offline it sends nothing and saves nothing to send later.

Search runs on your device, but pressing Enter without choosing a result opens the /search page with your words in its address, and if that page is not yet saved on your device the address reaches the server, which keeps only the path.

Pages request nothing from any other website, and a test in the offline suite checks this in a real browser. The Questions form opens your own email app and sends nothing through the site.

A workshop copy of the site, built separately for review sessions, stores the notes people leave in a review round on its own server, and the public site has no review rounds.

The code for the count is in [functions/lib/arrival-counting.ts](functions/lib/arrival-counting.ts) and the service worker's check is in [public/sw.js](public/sw.js).

---

## How to run locally

```bash
# From resiliencetoolkit.org/
pnpm install
pnpm dev          # Dev server at localhost:4321
pnpm build        # Checks pages against the source, type-checks, builds dist/, then builds the search index and the service worker precache
pnpm preview      # Serves the build output at localhost:4321
```

`pnpm build` runs `pnpm verify` first, which compares the chapter pages with the toolkit source and stops the build on a mismatch.

Local servers serve the static pages only. The files in `functions/` (the page ETag and the page count) run on Cloudflare Pages and are covered by the unit tests.

---

## Tests

```bash
pnpm vitest run      # Unit tests, including the functions/ code
pnpm test:offline    # Offline, service worker and network tests, in Chromium and WebKit
pnpm test:search     # Search, desktop and phone
pnpm test:layout     # Layout at phone and desktop widths
pnpm test:workshop   # The workshop copy's review round pages
npx playwright test  # Page rendering and saved data, against the dev server
```

Each Playwright suite starts its own server. `test:offline`, `test:search` and `test:layout` build `dist/` and serve it with `astro preview` on port 4321, so they exercise the generated service worker. `npx playwright test` starts `pnpm dev` on port 4321, or reuses one already running there. `test:workshop` starts a dev server on port 4322. Run the suites one at a time, since most of them use port 4321.

---

## Project structure

```
src/
  pages/                    # File-based routing: each route is an .astro file
    index.astro             # Home page and toolkit contents
    introduction.astro
    dashboard.astro         # Backup status and the work saved on this device
    downloads.astro         # The toolkit PDFs and templates
    search.astro            # Full search results
    changelog.astro         # Release notes
    modules/
      emergency-preparedness/
        index.astro         # Module overview
        1-1.astro           # Chapter pages, 1-1 through 1-13
        ...
      baseline-resilience/
        index.astro
        2-1.astro through 2-3.astro
      knowing-your-community.astro
    workflows/              # Before, response and recovery pages
    rounds/                 # Review rounds, built only for the workshop copy
  components/               # Astro and React UI components
  design-system/blocks/     # Interactive blocks: Todo, SlotCollection
  layouts/
    BaseLayout.astro        # Global layout
    ModuleLayout.astro      # Chapter layout: contents, On this page, footnotes
  lib/
    storage.ts              # IndexedDB wrapper (singleton)
    backup.ts               # Backup files and restore
    search/                 # Search client (Pagefind)
  data/
    contents.ts             # The toolkit contents model
    modules.ts              # Module list and phase filtering
  styles/base.css           # CSS variables (oklch color space, dark mode tokens)

functions/                  # Cloudflare Pages Functions
  _middleware.ts            # Page ETag, then the page count
  lib/arrival-counting.ts   # What the count stores, and the keyed report
  lib/page-etag.ts          # ETag and 304 for HTML pages
  api/arrivals.ts           # The report route
  api/rounds/[id]/notes.ts  # Review round notes (workshop copy only)

migrations/                 # D1 schema: 0001 review notes, 0002 and 0003 the page count

public/
  sw.js                     # Service worker source template (sentinels replaced at build time)
  _headers                  # Security headers and the content security policy
  manifest.json             # PWA manifest
  toolkit/                  # The toolkit PDFs

scripts/
  generate-sw-precache.mjs  # Postbuild: writes the precache list into dist/sw.js and the page hash map
  verify-against-source.ts  # Prebuild: checks chapter pages against the toolkit source
  check-page-etags.mjs      # Checks a live site for page ETags

tests/                      # Unit (functions, lib, build, scripts) and Playwright (e2e-*) suites
```

**Source of truth:** The [Resilience Hub Toolkit PDF](public/toolkit/) is the authoritative content. The site is a digital interface to that content, with checklists and tables that mirror the workbook and save on the device. When content decisions conflict, the PDF wins.

---

## Tech stack

- **Astro 5.18**: static pages (`output: 'static'`)
- **React 18.3**: interactive islands only (checkboxes, tables, dashboard)
- **Tailwind CSS 3.4**: utility classes and CSS variable design tokens
- **IndexedDB via `idb` 8**: saved work, on the reader's device
- **Pagefind 1.4**: the search index, built at build time and searched in the browser
- **Cloudflare Pages Functions and D1**: the page ETag and the page count
- **TypeScript 5.9**: Astro's strict preset
- **pnpm 10.30.3**: pinned in `package.json`
- **Vitest 4**: unit tests
- **Playwright 1.58**: browser tests, Chromium and WebKit

---

## Deploying

Cloudflare Pages builds with `pnpm build` and serves `dist/`. [CONTRIBUTING.md](CONTRIBUTING.md) has the full steps. Two points matter for a fork:

- Turn off Email Address Obfuscation and Automatic HTTPS Rewrites on the custom domain, and leave Rocket Loader off. While any of them is on, Cloudflare drops the page ETag. After a deploy, `node scripts/check-page-etags.mjs https://your-domain` confirms the tag.
- The page count needs a D1 database bound as `ARRIVALS_DB` and a report key set as `ARRIVALS_KEY`. Without them the site counts nothing and serves normally. The steps are in [migrations/0002_arrivals.sql](migrations/0002_arrivals.sql).

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to fork, add sections, and contribute back.
