# Resilience Hub Toolkit

**Local-first tools to organize systems, stuff, and people before, during, and after disasters.**

A living resource built as a local-first, offline-capable workflow tool. Unlike other disaster preparedness resources that publish content for people to read, the Resilience Toolkit gives people interactive checklists that persist on their device — turning "read about preparedness" into "do preparedness and track your progress."

All 17 section pages are managed through Keystatic CMS with MDX content collections, enabling governed content contributions from community resilience organizations.

## Features

- **100% Local & Offline**: Works completely offline with all data stored on your device
- **No Account Required**: No signup, no login, no cloud services needed
- **Progressive Web App**: Install on any device - phones, tablets, computers
- **Interactive Modules**: Checklists, editable tables, and progress tracking
- **Persistent Storage**: All your data stays in your browser's IndexedDB
- **Print-Friendly**: Export and print modules for offline distribution
- **Modular Design**: Use only the modules your community needs
- **Privacy-First**: Your data never leaves your device
- **Open Source**: MIT License + Creative Commons content

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher (for development only)
- [pnpm](https://pnpm.io/) v8 or higher

### Installation

1. Clone the repository:
```bash
git clone https://github.com/000noyes/resiliencetoolkit.org.git
cd resiliencetoolkit.org/resiliencetoolkit.org
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Open [http://localhost:4321](http://localhost:4321) in your browser

## Project Structure

```
resiliencetoolkit.org/
├── src/
│   ├── content/                   # CMS-managed content (Keystatic)
│   │   ├── modules/              # Module metadata (YAML)
│   │   │   ├── emergency-preparedness.yaml
│   │   │   ├── baseline-resilience.yaml
│   │   │   └── knowing-your-community.yaml
│   │   └── sections/             # Section content (MDX)
│   │       ├── 1-1-emergency-preparedness-kits.mdx
│   │       ├── 1-2-food-water.mdx
│   │       ├── ...               # 17 section files total
│   │       └── 2-3-community-building.mdx
│   ├── pages/modules/            # Dynamic routes
│   │   ├── emergency-preparedness/
│   │   │   ├── [slug].astro      # Renders MDX sections
│   │   │   └── index.astro       # Module overview
│   │   ├── baseline-resilience/
│   │   │   ├── [slug].astro
│   │   │   └── index.astro
│   │   └── knowing-your-community/
│   │       └── [slug].astro
│   ├── components/               # Astro + React UI components
│   ├── design-system/blocks/     # Interactive components (Todo, EditableTable, GuideTable)
│   ├── layouts/                  # BaseLayout.astro → ModuleLayout.astro
│   ├── lib/
│   │   ├── storage.ts            # IndexedDB wrapper (typed, no `any`)
│   │   ├── navigation.ts         # Auto-computes prev/next from module YAML
│   │   └── data-preservation.test.ts  # Regression test for IndexedDB keys
│   └── styles/base.css           # oklch design tokens
├── tests/e2e/                    # Playwright E2E tests
├── public/                       # Static assets, SW, PWA manifest
├── scripts/                      # Build scripts (icon gen, SW update)
└── (config files)
```

## Available Scripts

- `pnpm dev` - Start development server at localhost:4321 (Keystatic admin at /keystatic)
- `pnpm build` - Build for production (astro check → astro build → pagefind → update-sw-assets)
- `pnpm preview` - Preview production build locally
- `pnpm vitest run` - Run unit tests (31 tests: 28 storage + 3 data preservation)
- `pnpm run astro check` - TypeScript type checking
- `npx playwright test` - E2E tests (requires dev server running)

## Documentation

- **Design Specification**: Coming soon
- **Git Workflow**: Coming soon
- **Deployment Guide**: See deployment section below

## Technology Stack

- **Framework**: [Astro](https://astro.build/) v5.16.4 - Static site generation
- **UI Library**: [React](https://react.dev/) v18.3.1 - For interactive components only
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3.4.18 - Utility-first CSS
- **Content**: MDX via Astro Content Collections + [Keystatic](https://keystatic.com/) CMS
- **Local Storage**: [idb](https://github.com/jakearchibald/idb) v8.0.3 - IndexedDB wrapper for persistent local data
- **TypeScript**: v5.9.3 - Strict type checking enabled

## Architecture

### Local-Only Design

The toolkit uses a **100% local architecture** with no external dependencies:

1. **IndexedDB** stores all user data locally (todos, table edits, progress)
2. **Service Worker** caches pages and assets for offline access
3. **No cloud services** - all data stays on your device
4. **Privacy-first** - no tracking, no data collection

### Data Flow

```
User Interaction
    ↓
React Component (Todo, EditableTable)
    ↓
IndexedDB (persistent local storage)
    ↓
Data stays on device forever
```

## Content Architecture

All 17 section pages are managed as **MDX content collections** via Keystatic CMS. Each section is an MDX file with YAML frontmatter:

```mdx
---
number: "1.1"
title: "Emergency preparedness kits"
module: emergency-preparedness
slug: "1-1"
moduleKey: "emergency-preparedness-kits"
contentType: guide-table
---
import Todo from '@/design-system/blocks/Todo';
import GuideTable from '@/design-system/blocks/GuideTable.astro';

<GuideTable>
  <tr>
    <td>
      <Todo id="household-kit" moduleKey="emergency-preparedness-kits" client:idle>
        Assemble a 72-hour emergency kit for your household
      </Todo>
    </td>
  </tr>
</GuideTable>
```

### Module YAML metadata

Module metadata (section order, titles, slugs) lives in `src/content/modules/*.yaml`. Navigation is auto-computed from this data — never hand-code prev/next links.

### Keystatic CMS

Keystatic provides a web-based editing interface at `/keystatic` during development. The target architecture for governed contributions:

1. Contributors authenticate via GitHub OAuth
2. Edit content in the Keystatic web UI
3. Changes create pull requests automatically
4. Admin reviews and merges
5. Render auto-deploys on merge

Production contributor access is a future deployment step.

## Using the Toolkit

1. **Install as PWA**: Click install when prompted to add the toolkit to your device
2. **Explore Modules**: Browse emergency preparedness, baseline resilience, and community modules
3. **Track Progress**: Check items off as you complete them - automatically saved
4. **Work Offline**: Everything works without internet - data is stored locally
5. **Print Resources**: Use browser print to create offline reference materials
6. **Export Data**: Access your data anytime via browser DevTools → Application → IndexedDB

## Security & Privacy

### Your Data Stays Private

- **100% Local**: All data stored in your browser's IndexedDB
- **No Accounts**: No signup, no login, no user tracking
- **No Cloud Sync**: Data never leaves your device
- **No Analytics Tracking**: Optional anonymous page views only (Umami)
- **Open Source**: Audit the code yourself

### Security Headers

Security headers are configured via `public/_headers` (Render static site hosting):
- **Content-Security-Policy** — Restricts script/style/image sources; blocks framing
- **X-Frame-Options: DENY** — Prevents clickjacking
- **X-Content-Type-Options: nosniff** — Prevents MIME sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** — Controls referrer information
- **Permissions-Policy** — Disables camera, microphone, geolocation
- **Strict-Transport-Security** — HTTPS enforcement with `includeSubDomains`

## Data Preservation

Users have filled out checklists on real devices. IndexedDB keys are composites of `moduleKey` and `todoId` (e.g., `food-and-water-backup-food-community`). **Changing these keys destroys real user data.**

### moduleKey Conventions

- Each section has a `moduleKey` in its frontmatter (e.g., `food-and-water`, `mutual-aid`)
- Todo components reference their section's moduleKey: `<Todo id="..." moduleKey="food-and-water">`
- The canonical set of 19 moduleKeys is enforced by `src/lib/data-preservation.test.ts`
- **Adding** new moduleKeys is safe. **Renaming or removing** moduleKeys is NOT.
- Run `pnpm vitest run` before any content change to verify keys are preserved

### Adding New Sections

1. Create an MDX file in `src/content/sections/` with proper frontmatter
2. Add the section to the appropriate `src/content/modules/*.yaml`
3. Choose a unique `moduleKey` for any interactive components
4. Add the new moduleKey to the canonical set in `data-preservation.test.ts`
5. Run tests: `pnpm vitest run`

## Customization

### Styling

Design tokens are defined in `src/styles/base.css` using oklch color space. Modify CSS variables to customize colors, spacing, typography, and shadows.

## Deployment

### Static Site Hosting

This application is a **static site** built with Astro. All logic runs client-side in the browser with offline-first local storage.

#### Recommended Hosting Platforms

- **[Render](https://render.com/)** - Free static site hosting with CDN (recommended)
- **[Netlify](https://netlify.com/)** - Git-based deployment with generous free tier
- **[Vercel](https://vercel.com/)** - Zero-config deployment
- **[Cloudflare Pages](https://pages.cloudflare.com/)** - Global edge network

#### Build Configuration

- **Build Command**: `npm install -g pnpm && pnpm install && pnpm build`
- **Publish Directory**: `dist`
- **Node Version**: 18 or higher (build-time only)
- **Environment Variables**: None required!

#### Deployment Steps (Render Example)

**Quick steps:**
1. Push your code to GitHub
2. Create a new **Static Site** on Render (not Web Service)
3. Connect your GitHub repository
4. Set build command: `npm install -g pnpm && pnpm install && pnpm build`
5. Set publish directory: `dist`
6. Deploy!

Your app will be live at `https://your-app-name.onrender.com`

#### Static Site Benefits

- **Free hosting** - Most platforms offer generous free tiers for static sites
- **Global CDN** - Fast loading worldwide
- **No cold starts** - Always available instantly
- **No configuration** - No environment variables or secrets needed
- **Complete offline** - Works 100% offline with service worker caching

### Progressive Web App

The site includes PWA functionality:
- Manifest file (`public/manifest.json`)
- Service worker for offline caching (enabled in production)
- Network status detection
- Local data persistence via IndexedDB
- Install prompt for mobile devices

## Analytics

The toolkit uses [Umami Analytics](https://umami.is/) for privacy-focused, GDPR-compliant analytics.

### Features

- **No cookies** - No tracking cookies required
- **No personal data** - Only anonymous pageview data collected
- **Privacy-first** - Fully GDPR, CCPA, and PECR compliant
- **No tracking across sites** - Data stays within the toolkit
- **Transparent** - Users can see what's collected

### Implementation

Analytics are automatically included in production builds via `BaseLayout.astro`. The script loads asynchronously and does not block page rendering.

**Website ID**: `0270ad49-8b3f-407f-9245-d666a62e5e8c`

If you want to use your own Umami instance, update the script tag in [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro#L68).

## Contributing

We welcome contributions! This is an open source project built with and for community organizers.

### For CRO staff and content contributors

The toolkit uses Keystatic CMS for content management. The governed contribution process:

1. **Propose**: Edit content through the Keystatic web interface (creates a PR automatically)
2. **Review**: Admin reviews the PR for accuracy and alignment with the canonical PDF
3. **Merge**: Approved changes are merged and auto-deployed

### For developers

- Report bugs or request features via GitHub Issues
- All work happens on feature branches — never commit directly to main
- Run `pnpm vitest run` and `pnpm run astro check` before submitting PRs
- The data preservation test must pass — it protects real user data

## License

- **Code**: [MIT License](LICENSE) - Free to use, modify, and distribute
- **Content**: Creative Commons - Free for community use

## Credits

Built with frontline organizers in Vermont and beyond. This toolkit emerged from real-world community response efforts and combines practical wisdom from mutual aid networks, local government resilience initiatives, and grassroots organizing.

---

**Need help?** Open an issue on GitHub at [github.com/000noyes/resiliencetoolkit.org](https://github.com/000noyes/resiliencetoolkit.org/issues).