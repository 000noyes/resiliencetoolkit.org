# Design System — Resilience Hub Toolkit

## Product Context
- **What this is:** A local-first, offline-capable digital workbook for community disaster preparedness
- **Who it's for:** Community organizers, neighborhood groups, and individuals working through the Resilience Hub Toolkit PDF
- **Space/industry:** Civic tech, emergency preparedness, community resilience
- **Project type:** Interactive web app (Astro 5 + React islands)

## Aesthetic Direction
- **Direction:** Warm Industrial
- **Decoration level:** Intentional (subtle texture through borders and surface hierarchy, not decorative)
- **Mood:** Trustworthy and approachable, like a well-organized community center. Warm enough to feel human, structured enough to feel reliable. Not government, not corporate, not cute.
- **Reference sites:** Ready.gov (institutional baseline), USWDS (accessibility standards), Preparewise.com (modern prep), MyPlan app (interactive safety tools)

## Typography
- **Display/Hero:** Outfit (600 weight) — geometric but warm, strong at large sizes, already established in the codebase
- **Body:** Outfit (400 weight) — clean readability at body sizes, optical sizing helps at small sizes
- **UI/Labels:** Outfit (500 weight) — medium weight for interactive element labels, badges, nav
- **Data/Tables:** Outfit (400 weight, tabular-nums via font-feature-settings) — Outfit supports tabular figures for data alignment
- **Code:** System monospace (no code blocks in this product)
- **Loading:** `@fontsource/outfit` (self-hosted, weights 400/500/600)
- **Scale (px / rem at 16px base):**
  - display: 56px / 3.5rem (hero headings, landing page)
  - h1: 36px / 2.25rem
  - h2: 24px / 1.5rem
  - h3: 18px / 1.125rem
  - body: 16px / 1rem
  - small: 14px / 0.875rem
  - caption: 12px / 0.75rem
  - uppercase-accent: 11px / 0.6875rem (letter-spacing 0.05em)

## Color
- **Approach:** Restrained with 2 accents — color is rare and meaningful
- **Primary (Orange):** `oklch(0.5756 0.1368 42.8)` — warmth, action, community energy. Used for CTAs, active states, progress indicators. Differentiates from government blue.
- **Secondary (Green):** `oklch(0.4365 0.1044 156.7)` — growth, nature, resilience. Used for sidebar accents, ring/focus states, table headers, secondary actions. Consolidates the previous teal table-accent (hue 168.9, only 12 degrees from green) into one secondary.
- **Neutrals:** Warm grays via oklch, no chroma:
  - background: `oklch(0.9911 0 0)` (near-white)
  - foreground: `oklch(0.2046 0 0)` (near-black)
  - muted: `oklch(0.9608 0 0)` (light gray surface)
  - muted-foreground: `oklch(0.556 0 0)` (medium gray text)
  - border: `oklch(0.897 0 0)` (subtle dividers)
  - card: `oklch(0.9911 0 0)` (same as bg, elevated via border/shadow)
- **Semantic:**
  - success: green secondary (same hue, adjusted lightness)
  - warning: `oklch(0.7768 0.1514 66.07)` (amber)
  - error: `oklch(0.5654 0.2034 22.71)` (warm red)
  - info: `oklch(0.5432 0.1211 231.5)` (cool blue, used sparingly)
- **Dark mode:** CSS class strategy (`.dark` on `<html>`). Surfaces darken, text lightens, accents reduce saturation ~15%. FOUC prevented via inline `<script>` in BaseLayout.astro checking localStorage before paint.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (not cramped, not wasteful — workbook tool, not a dashboard)
- **Scale:**
  - xxs: 4px
  - xs: 8px
  - sm: 12px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - section: 80px

## Layout
- **Approach:** Grid-disciplined
- **Grid:** Single column on mobile (<1024px), 220px sidebar + fluid content on desktop
- **Max content width:** 1200px (module pages), 1280px (container), 4xl/56rem (standalone content)
- **Border radius:** Hierarchical: sm=4px, md=6px, lg=8px, xl=12px (matches base.css CSS variables)
- **Mobile spacing fix (KNOWN ISSUE):** On mobile (<1024px), the `.module-layout` grid collapses to `1fr` but retains `padding: 0 var(--spacing-md)` (16px each side). Combined with parent container padding, this wastes horizontal space on narrow screens (especially 375px). Fix: reduce mobile horizontal padding to `--spacing-sm` (12px) or `--spacing-xs` (8px) on module pages below 640px. The `.module-content` should also reset `grid-column` to `1 / -1` on mobile to prevent layout artifacts from the 2-column desktop grid.

## Motion
- **Approach:** Minimal-functional (transitions that aid comprehension, nothing decorative)
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - fast: 120ms (hover states, toggles)
  - medium: 200ms (panel open/close, accordion)
  - slow: 260ms (page transitions, large layout shifts)

## Component Notes (for implementation)

### Active Components — Quality Assessment
- **TableOfContents** (4 files) — Well-structured, no issues
- **EditableTable** (226 lines) — Being replaced by DataTable in Template Kit v2. Row ID strategy (`rowId < 1000` = initial) is fragile. Storage split across localStorage + IndexedDB.
- **Todo.tsx** (305 lines) — ~70 lines inline print CSS should be extracted. 5-second timeout after save has unclear intent.
- **ChecklistRow.tsx** (173 lines) — Duplicates Todo logic. Not DRY. Missing print styles.
- **ExternalLink chain** (~378 lines) — Over-engineered modal for "leaving this site" confirmation. Intent unclear. Flagged P3 in CLAUDE.md.
- **UserProgressDashboard** (570 lines) — Hardcoded module names/URLs. Event cascade risk on storage changes.

### Deferred Components (safe to delete)
- WhatsNewBanner, SearchField, EmptyState, SegmentedControl, OfflineReadyBanner — all in `src/design-system/_deferred/`, zero imports

### Textarea
- Border: `1px solid var(--border)`, `border-radius: var(--radius-sm)` (4px)
- Padding: `var(--spacing-sm)` (12px)
- Focus: `outline: 2px solid var(--ring)`, `outline-offset: 2px`
- Font: Outfit 400, 16px/body, `var(--foreground)`
- Min height: 80px, max height: 400px with `overflow-y: auto`, `resize: none`
- Placeholder: `var(--muted-foreground)`, "Write your response..."
- Background states: empty = `var(--muted)` (tinted), filled = `var(--background)` (white), transition `200ms ease-out`

### DataTable (Template Kit v2)
- Replaces EditableTable with consistent API
- Must respect this design system: green secondary for headers, orange primary for save/action states
- **Table variant** (default): Card layout on mobile (<640px), table layout on desktop. CSV export.
- **Journal variant** (`variant="journal"`): Stacked prompt+textarea at all widths, no green header bar, label-above pattern, HTML export, print stylesheet. Counter shows "X of Y questions answered". Completion checkmark on label when all answered.
- IndexedDB persistence, keyboard navigation

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-06 | Initial design system created | Codified from existing base.css + tailwind.config.mjs via /design-consultation |
| 2026-04-06 | Collapsed teal table-accent into green secondary | Teal (hue 168.9) and green (hue 156.7) only 12 degrees apart in oklch — barely distinguishable. One secondary color is cleaner. |
| 2026-04-06 | Keep Outfit as sole typeface | Already loaded, well-suited, supports tabular figures. No reason to add font weight. |
| 2026-04-06 | Warm Industrial aesthetic (not government blue) | RT is a community tool, not a government portal. Orange warmth differentiates from Ready.gov/FEMA institutional blue. |
| 2026-04-06 | Mobile spacing fix flagged | Left margin too large on mobile module pages — padding compounds across layout layers |
