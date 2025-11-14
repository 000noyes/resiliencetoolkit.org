# Resilience Hub Toolkit

**Local-first tools to organize people, places, and plans before, during, and after disasters.**

An offline-capable resilience dashboard and workspace for towns and grassroots groups to map assets, coordinate response, and track recovery.

## Features

- **Offline-First**: Works completely offline with local data storage and cloud sync
- **Progressive Web App**: Install on any device - phones, tablets, computers
- **Interactive Modules**: Checklists, editable tables, and progress tracking
- **Role-Based Access**: Three role types with clear permissions (via Supabase)
  - **Stewards**: Hub administrators (manage settings, members, governance)
  - **Doers**: Active contributors (create/edit content, participate in activities)
  - **Viewers**: Read-only observers (view shared content only)
  - See [docs/role-permissions.md](docs/role-permissions.md) for detailed permission matrix
  - See [docs/roles-expansion-roadmap.md](docs/roles-expansion-roadmap.md) for planned enhancements
- **Print-Friendly**: Export and print modules for offline distribution
- **Modular Design**: Use only the modules your community needs
- **Open Source**: MIT License + Creative Commons content

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/) v8 or higher
- **Supabase account** (required for authentication) - [supabase.com](https://supabase.com)
- **Flagsmith account** (required for feature flags) - [flagsmith.com](https://flagsmith.com)
- **Optional**: Umami account for analytics (already configured)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/resilience-toolkit.git
cd resilience-toolkit/resiliencetoolkit.org
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy the environment file and configure required variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys (see Environment Variables section below)

4. Start the development server:
```bash
pnpm dev
```

5. Open [http://localhost:4321](http://localhost:4321) in your browser

## Project Structure

```
resiliencetoolkit.org/
├── .storybook/                # Storybook configuration
│   ├── main.ts
│   ├── preview.ts
│   └── vitest.setup.ts
├── docs/                      # Setup and implementation documentation
│   ├── SUPABASE_SETUP.md
│   ├── feature-flags.md
│   ├── flagsmith-early-access-setup.md
│   ├── migration-to-optional-auth.md
│   └── supabase-schema.sql
├── public/                    # Static assets
│   ├── favicon.svg
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker for offline support
├── src/
│   ├── components/            # Astro and React UI components
│   │   ├── ActionButton.astro
│   │   ├── AuthForm.tsx       # Login/signup form
│   │   ├── AuthGuard.astro    # Protected route wrapper
│   │   ├── Badge.astro
│   │   ├── Card.astro
│   │   ├── EmptyState.astro
│   │   ├── FeedbackWidget.tsx # User feedback component
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   ├── IconButton.astro
│   │   ├── MetricCard.astro
│   │   ├── Modal.astro
│   │   ├── SearchField.astro
│   │   ├── SegmentedControl.astro
│   │   ├── Sidebar.astro
│   │   ├── SidebarItem.astro
│   │   ├── StatusBanner.astro
│   │   └── UserMenu.tsx       # User account menu
│   ├── design-system/         # Interactive React components with persistence
│   │   └── blocks/
│   │       ├── ChecklistRow.tsx
│   │       ├── ChecklistSection.tsx
│   │       ├── EditableTable.tsx       # Editable table with local storage
│   │       ├── InteractiveChecklist.tsx
│   │       ├── Todo.tsx                # Checkbox with persistence
│   │       └── index.ts
│   ├── layouts/               # Page layouts
│   │   ├── BaseLayout.astro   # Base HTML structure with head, analytics
│   │   └── ModuleLayout.astro # Module-specific layout with navigation
│   ├── lib/                   # Core utilities and services
│   │   ├── createPersonalHub.ts    # User onboarding and hub creation
│   │   ├── featureFlags.ts         # Flagsmith feature flag client
│   │   ├── icons.ts                # Lucide icon utilities
│   │   ├── mdx-components.tsx      # MDX component mappings
│   │   ├── storage.ts              # IndexedDB wrapper for offline-first
│   │   ├── supabase-server.ts      # Server-side Supabase client (SSR)
│   │   ├── supabase.ts             # Client-side Supabase client
│   │   ├── sync.ts                 # Background sync service
│   │   └── validateRedirect.ts     # Security: safe redirect validation
│   ├── middleware/            # Auth and security middleware
│   │   └── index.ts           # Session validation, early access, headers
│   ├── pages/                 # Routes (file-based routing)
│   │   ├── auth/
│   │   │   ├── login.astro
│   │   │   └── signup.astro
│   │   ├── modules/           # Module content pages
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
│   │   ├── dashboard.astro             # User dashboard
│   │   ├── downloads-and-templates.astro
│   │   ├── early-access-pending.astro  # Early access waiting page
│   │   ├── index.astro                 # Home page
│   │   ├── introduction.astro
│   │   ├── library.astro
│   │   ├── map.astro
│   │   ├── about.astro
│   │   ├── offline.astro               # Offline status page
│   │   └── support.astro
│   ├── stories/               # Storybook component stories
│   │   ├── InteractiveChecklist.stories.tsx
│   │   └── ...
│   ├── styles/
│   │   └── base.css           # Global styles and design tokens
│   ├── types/                 # TypeScript type definitions
│   │   ├── section-navigation.ts
│   │   └── storybook.d.ts
│   └── env.d.ts               # Astro type definitions
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── astro.config.mjs           # Astro configuration (SSR, adapters)
├── package.json               # Dependencies and scripts
├── pnpm-lock.yaml            # Lockfile
├── tailwind.config.mjs        # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── vitest.config.ts           # Vitest test configuration
├── vitest.shims.d.ts          # Vitest type shims
├── LICENSE                    # MIT License
└── README.md                  # This file
```

## Available Scripts

- `pnpm dev` - Start development server at localhost:4321
- `pnpm build` - Build for production (includes TypeScript checking)
- `pnpm preview` - Preview production build locally
- `pnpm astro` - Run Astro CLI commands
- `pnpm astro check` - Run TypeScript type checking
- `pnpm storybook` - Start Storybook for component development
- `pnpm build-storybook` - Build Storybook for deployment

## Environment Variables

Copy `.env.example` to `.env.local` and configure the following:

### Required Variables

- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key (safe for client)
- `PUBLIC_FLAGSMITH_ENVIRONMENT_KEY` - Flagsmith client environment key (safe for client)
- `FLAGSMITH_SERVER_KEY` - Flagsmith server-side key ⚠️ **Keep secret! Server-only**

### Optional Variables

- `DEBUG` - Enable debug logging (development only)

### Setup Documentation

- **Supabase**: See [docs/supabase_setup.md](docs/supabase_setup.md) for database schema and configuration
- **Flagsmith**: See [docs/flagsmith-early-access-setup.md](docs/flagsmith-early-access-setup.md) for early access configuration
- **Role Permissions**: See [docs/role-permissions.md](docs/role-permissions.md) for current permission model
- **Roles Roadmap**: See [docs/roles-expansion-roadmap.md](docs/roles-expansion-roadmap.md) for planned enhancements
- **Environment Security**: Never commit `.env.local` to version control

### Development Documentation

- **Pre-commit Testing**: See [docs/pre-commit-testing.md](docs/pre-commit-testing.md) for testing workflow
- **Interactive Checklist Schema**: See [docs/interactive-checklist-schema.md](docs/interactive-checklist-schema.md) for checklist data structure

## Technology Stack

- **Framework**: [Astro](https://astro.build/) v5 - Static site generation
- **UI Library**: [React](https://react.dev/) v18 - For interactive components only
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3 - Utility-first CSS
- **Content**: [MDX](https://mdxjs.com/) - Markdown with React components
- **Local Storage**: [idb](https://github.com/jakearchibald/idb) - IndexedDB wrapper for offline-first
- **Authentication**: [Supabase](https://supabase.com/) - User auth and database
- **Feature Flags**: [Flagsmith](https://flagsmith.com/) - Early access control and feature management
- **Analytics**: [Umami](https://umami.is/) - Privacy-focused, GDPR-compliant analytics
- **TypeScript**: Strict type checking enabled

## Architecture

### Offline-First Design

The toolkit uses a **local-first architecture**:

1. **IndexedDB** stores all user data locally (todos, table edits, progress)
2. **Service Worker** caches pages and assets for offline access (enabled in production)
3. **Supabase** syncs data to the cloud when online for authenticated users
4. **Conflict resolution** ensures data consistency across devices

### Data Flow

```
User Interaction
    ↓
React Component (Todo, EditableTable)
    ↓
IndexedDB (local storage)
    ↓
Sync Queue (when online)
    ↓
Supabase (cloud storage)
```

## Module Content

Modules are written in **MDX** (Markdown + JSX) with frontmatter metadata:

```mdx
---
title: "Emergency Preparedness Kits"
order: 3
phase: "Before"
tags: ["supplies", "household", "checklist"]
summary: "Essential supplies for disaster preparedness"
---

# Emergency Preparedness Kits

<Todo id="household-kit" moduleKey="emergency-preparedness">
  Assemble a 72-hour emergency kit for your household
</Todo>

<EditableTable
  moduleKey="emergency-preparedness"
  tableId="supply-inventory"
  columns={["Item", "Quantity", "Location", "Status"]}
/>
```

## Early Access (Phase 1)

This toolkit is currently in **Phase 1 Early Access** (5-10 users).

### Current Access Model

Users must:
1. **Create an account** via Supabase authentication (`/auth/signup`)
2. **Be granted early access** via Flagsmith feature flags

Without early access approval, users are redirected to `/early-access-pending`.

### Granting Early Access

Admins can grant access via the Flagsmith dashboard:

1. Log in to [Flagsmith](https://flagsmith.com)
2. Navigate to your project
3. Go to **Identities**
4. Add user email as identity
5. Enable the `early-access-enabled` flag for that identity

See [docs/flagsmith-early-access-setup.md](docs/flagsmith-early-access-setup.md) for detailed instructions.

### Future: Phase 2 (Optional Auth)

In **4-6 weeks** after launch, authentication will become optional. Users will be able to:
- Use the toolkit without an account (local-only mode)
- Optionally sign in for cloud sync and cross-device access

See [docs/migration-to-optional-auth.md](docs/migration-to-optional-auth.md) for the migration roadmap.

## Security

The application includes comprehensive security measures:

### Authentication Middleware

- Server-side session validation on every request
- Protected routes: `/modules/*`, `/dashboard`, `/library`, `/map`
- Automatic redirect to `/auth/login` for unauthenticated users
- Early access check via Flagsmith for approved users only

### Security Headers

Automatically added to all responses:
- **Content-Security-Policy** - Prevents XSS and injection attacks
- **X-Frame-Options: DENY** - Prevents clickjacking
- **X-Content-Type-Options: nosniff** - Prevents MIME sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** - Controls referrer information
- **Permissions-Policy** - Restricts browser features
- **Strict-Transport-Security** - HTTPS enforcement (production only)

### Data Protection

**Application Security:**
- Environment variables for sensitive keys (never committed to version control)
- Server-side feature flag validation (cannot be bypassed client-side)
- Cookie-based session management with SameSite protection
- All sensitive operations validated server-side (defense-in-depth)

**User Data Protection:**
- **Local-first storage**: All user data stored in IndexedDB on device by default
- **No tracking**: Zero tracking cookies, no user behavior surveillance
- **Privacy-focused analytics**: Umami collects only anonymous pageviews (no personal data)
- **Row Level Security (RLS)**: Supabase database policies ensure users can only access their own data
- **Hub isolation**: Data is scoped to hubs, users can only see data for hubs they belong to
- **Optional cloud sync**: Users control if/when data is synced to Supabase
- **Data ownership**: Users can export their data, delete their account
- **No data selling**: User data is never sold or shared with third parties
- **GDPR compliant**: Right to access, right to deletion, data portability

**Offline Operation:**
- App works fully offline without sending any data
- User can choose to remain local-only (Phase 2 feature)
- Network status displayed to user (transparent about connectivity)

## Customization

### Adding New Modules

1. Create a new `.astro` file in `src/pages/modules/` (or a subdirectory like `emergency-preparedness/`)
2. Use `ModuleLayout` with either:
   - **Frontmatter mode**: Add frontmatter with metadata (title, order, phase, tags)
   - **SectionData mode**: Pass section navigation data programmatically
3. Use interactive components like `<Todo>` and `<EditableTable>` in the content
4. The module will automatically appear in file-based routing

### Custom Components

Add new interactive components in `src/design-system/blocks/` and register them in `src/lib/mdx-components.tsx`.

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

#### Environment Variables (Build-Time)

Configure these environment variables in your hosting platform's dashboard. They are embedded into the static files during build:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_FLAGSMITH_ENVIRONMENT_KEY`

**Note:** All variables must start with `PUBLIC_` to be accessible in the browser.

#### Deployment Steps (Render Example)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed Render deployment guide.

**Quick steps:**
1. Push your code to GitHub
2. Create a new **Static Site** on Render (not Web Service)
3. Connect your GitHub repository
4. Configure build command and publish directory (above)
5. Add environment variables
6. Deploy!

Your app will be live at `https://your-app-name.onrender.com`

#### Static Site Benefits

- **Free hosting** - Most platforms offer generous free tiers for static sites
- **Global CDN** - Fast loading worldwide
- **No cold starts** - Always available instantly
- **Offline-first** - Works completely offline with service worker caching
- **Client-side auth** - Supabase handles authentication in the browser

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

**Need help?** Visit `/support` or open an issue on GitHub.