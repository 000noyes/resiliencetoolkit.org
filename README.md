# Resilience Hub Toolkit

**Local-first tools to organize systems, stuff, and people before, during, and after disasters.**

An offline-capable resilience dashboard and workspace for towns and grassroots groups to map assets, coordinate response, and track recovery.

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
├── dist/                          # Production build output
├── docs/                          # Documentation files
├── node_modules/                  # Dependencies (pnpm)
├── public/                        # Static assets
│   ├── favicon.svg
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   ├── RHT_orange.svg            # Logo assets
│   ├── RHT_text.png
│   ├── icons/                    # PWA icons (16x16 to 512x512)
│   └── toolkit/                  # Toolkit resources
├── scripts/                       # Build and utility scripts
├── src/
│   ├── assets/                   # Images and media
│   ├── components/               # Astro and React UI components
│   │   ├── ActionButton.astro
│   │   ├── Badge.astro
│   │   ├── Card.astro
│   │   ├── EmptyState.astro
│   │   ├── ExternalLink.astro
│   │   ├── ExternalLink.tsx
│   │   ├── ExternalLinkModal.tsx
│   │   ├── FeedbackWidget.tsx
│   │   ├── FeedbackWidgetWrapper.tsx
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   ├── IconButton.astro
│   │   ├── InfoCallout.astro
│   │   ├── LogoHoverCard.tsx
│   │   ├── MetricCard.astro
│   │   ├── Modal.astro
│   │   ├── OfflineReadyBanner.astro
│   │   ├── SearchField.astro
│   │   ├── SegmentedControl.astro
│   │   ├── Sidebar.astro
│   │   ├── SidebarItem.astro
│   │   ├── StatusBanner.astro
│   │   └── UserMenuWrapper.tsx
│   ├── data/                     # Data files and configuration
│   ├── design-system/            # Interactive React components
│   │   └── blocks/
│   │       ├── ChecklistRow.tsx
│   │       ├── ChecklistSection.tsx
│   │       ├── EditableTable.tsx
│   │       ├── InteractiveChecklist.tsx
│   │       ├── Todo.tsx
│   │       └── index.ts
│   ├── layouts/                  # Page layouts
│   │   ├── BaseLayout.astro      # Base HTML with head, analytics
│   │   └── ModuleLayout.astro    # Module layout with navigation
│   ├── lib/                      # Core utilities and services
│   │   ├── externalLinkPreferences.ts
│   │   ├── fileSize.ts
│   │   ├── icons.ts
│   │   ├── mdx-components.tsx
│   │   ├── pdfLookup.ts
│   │   ├── resourcesLookup.ts
│   │   ├── storage.ts            # IndexedDB wrapper
│   │   └── validateRedirect.ts
│   ├── pages/                    # Routes (file-based routing)
│   │   ├── modules/
│   │   │   ├── baseline-resilience/
│   │   │   │   ├── index.astro
│   │   │   │   ├── 2-1-basic-needs.astro
│   │   │   │   ├── 2-2-shared-tools.astro
│   │   │   │   └── 2-3-community-building.astro
│   │   │   ├── emergency-preparedness/
│   │   │   │   ├── index.astro
│   │   │   │   ├── 1-1-kits.astro
│   │   │   │   ├── 1-2-food-water.astro
│   │   │   │   ├── 1-3-medical.astro
│   │   │   │   ├── 1-4-power.astro
│   │   │   │   ├── 1-5-shelter.astro
│   │   │   │   ├── 1-6-vehicles.astro
│   │   │   │   ├── 1-7-sanitation.astro
│   │   │   │   ├── 1-8-special-populations.astro
│   │   │   │   ├── 1-9-response-plans.astro
│   │   │   │   ├── 1-10-volunteers.astro
│   │   │   │   ├── 1-11-flood-recovery.astro
│   │   │   │   ├── 1-12-mutual-aid.astro
│   │   │   │   └── 1-13-financial-resources.astro
│   │   │   ├── index.astro
│   │   │   └── knowing-your-community.astro
│   │   ├── about.astro
│   │   ├── dashboard.astro
│   │   ├── downloads.astro
│   │   ├── downloads-and-templates.astro
│   │   ├── index.astro
│   │   ├── introduction.astro
│   │   ├── LICENSE.astro
│   │   └── map.astro
│   ├── styles/
│   │   └── base.css              # Global styles and design tokens
│   ├── types/                    # TypeScript type definitions
│   │   ├── section-navigation.ts
│   │   └── storybook.d.ts
│   └── env.d.ts
├── astro.config.mjs              # Astro configuration
├── LICENSE_MIT                   # MIT License
├── package.json                  # Dependencies and scripts
├── pnpm-lock.yaml               # Lockfile
├── README.md                     # This file
├── render.yaml                   # Render deployment config
├── tailwind.config.mjs           # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.ts              # Vitest test configuration
└── vitest.shims.d.ts            # Vitest type shims
```

## Available Scripts

- `pnpm dev` - Start development server at localhost:4321
- `pnpm build` - Build for production (includes TypeScript checking)
- `pnpm preview` - Preview production build locally
- `pnpm astro` - Run Astro CLI commands
- `pnpm astro check` - Run TypeScript type checking

## Documentation

- **Design Specification**: Coming soon
- **Git Workflow**: Coming soon
- **Deployment Guide**: See deployment section below

## Technology Stack

- **Framework**: [Astro](https://astro.build/) v5.16.4 - Static site generation
- **UI Library**: [React](https://react.dev/) v18.3.1 - For interactive components only
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3.4.18 - Utility-first CSS
- **Content**: Astro pages (.astro files) - Component-based content with frontmatter
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

## Module Content

Modules are written as **Astro pages** (.astro files) with TypeScript frontmatter and component imports:

```astro
---
import ModuleLayout from '@/layouts/ModuleLayout.astro';
import Todo from '@/design-system/blocks/Todo';
import type { SectionData } from '@/types/section-navigation';

const sectionData: SectionData = {
  number: "1.1",
  title: "Emergency Preparedness Kits",
  moduleTitle: "Emergency Preparedness",
  modulePath: "/modules/emergency-preparedness",
  prevSection: { number: "1.0", title: "Overview", slug: "index" },
  nextSection: { number: "1.2", title: "Food and Water", slug: "1-2-food-water" }
};
---

<ModuleLayout sectionData={sectionData}>
  <h3>Essential Supplies</h3>

  <Todo id="household-kit" moduleKey="emergency-preparedness" client:load>
    Assemble a 72-hour emergency kit for your household
  </Todo>
</ModuleLayout>
```

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

Security headers are configured at the hosting platform level for protection:
- **Content-Security-Policy** - Prevents XSS attacks
- **X-Frame-Options: DENY** - Prevents clickjacking
- **X-Content-Type-Options: nosniff** - Prevents MIME sniffing
- **Referrer-Policy** - Controls referrer information
- **Strict-Transport-Security** - HTTPS enforcement (production only)

## Customization

### Adding New Modules

1. Create a new `.astro` file in `src/pages/modules/` (or a subdirectory like `emergency-preparedness/`)
2. Import `ModuleLayout` and pass `sectionData` with navigation information
3. Import interactive components like `<Todo>` and `<EditableTable>` from `@/design-system/blocks/`
4. The module will automatically appear in file-based routing

### Custom Components

Add new interactive components in `src/design-system/blocks/` and import them directly in your Astro pages.

### Styling

Design tokens are defined in `src/styles/base.css`. Modify CSS variables to customize colors, spacing, typography, and shadows.

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

- Report bugs or request features via GitHub Issues
- Submit pull requests for code improvements
- Contribute new modules or templates
- Improve documentation
- Share your experience using the toolkit

## License

- **Code**: [MIT License](LICENSE) - Free to use, modify, and distribute
- **Content**: Creative Commons - Free for community use

## Credits

Built with frontline organizers in Vermont and beyond. This toolkit emerged from real-world community response efforts and combines practical wisdom from mutual aid networks, local government resilience initiatives, and grassroots organizing.

---

**Need help?** Open an issue on GitHub at [github.com/000noyes/resiliencetoolkit.org](https://github.com/000noyes/resiliencetoolkit.org/issues).