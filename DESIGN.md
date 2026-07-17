# Design System — Resilience Hub Toolkit

## Product Context
- **What this is:** A local-first, offline-capable digital workbook for disaster preparedness and community resilience
- **Who it's for:** Community organizers, neighborhood groups, and individuals building resilience using the Resilience Hub Toolkit PDF
- **Space/industry:** Civic tech, community resilience, emergency preparedness
- **Project type:** Interactive web app (Astro 5 + React islands)

## Aesthetic Direction
- **Direction:** Warm Industrial — the warmth of a place where neighbors grow capacity together; the industrial of tools that hold up under stress.
- **Decoration level:** Intentional (subtle texture through borders and surface hierarchy, not decorative)
- **Mood:** Trustworthy and approachable, like a well-organized community center where people build capacity together. Warm enough to feel human, structured enough to feel reliable. Centered on capacity, not threat-avoidance — the workbook is something you build with, not protection you hide behind. Not government, not corporate, not cute.
- **Reference sites:** Ready.gov (institutional baseline), USWDS (accessibility standards), Preparewise.com (modern prep), MyPlan app (interactive safety tools). These calibrate against preparedness institutions; resilience is the destination the design moves toward, not a reference to inherit from.

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
- **Approach:** Restrained with 2 accents — color is rare and meaningful. The split is temporal: **orange = the work of preparing right now; green = the resilience that work builds toward.** Immediate action is warm; durable capacity is grown.
- **Primary (Orange):** `oklch(0.5756 0.1368 42.8)` — the work of preparing right now: warmth, action, community energy. Used for CTAs, active states, progress indicators. Differentiates from government blue.
- **Secondary (Green):** `oklch(0.4365 0.1044 156.7)` — resilience as the durable outcome; also growth, nature. Used for sidebar accents, ring/focus states, table headers, secondary actions. Consolidates the previous teal table-accent (hue 168.9, only 12 degrees from green) into one secondary.
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
- **Full radius (9999px) is reserved for true circles:** phase/step nodes, dots, spinners, circular icon buttons, and progress tracks. Text surfaces — chips, badges, labels, and buttons of every size — always use the sm/md/lg/xl scale (full-radius capsules on text are default-AI styling, not this system). Floating action buttons (FeedbackWidget trigger, mobile TOC trigger) sit at the top of the scale (xl), never beyond it.
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
- **BetaBanner.tsx** (the contact strip) — Top-of-every-page contact notice. Neutral chrome (`bg-card border-b border-border`), copy "Contact us for support at resiliencetoolkit@gocros.org", mailto link in `text-primary`, no leading icon. Versioned localStorage dismissal (`betaBanner.dismissed.v1`). React island `client:idle`. Participates in the single-slot notice system as the lowest-priority `contact` claim (see Notice strips below). Mounts in BaseLayout above StatusBanner.
- **Footer "Last updated" stamp** — Small muted line in Footer (`text-xs text-muted-foreground/80`) showing the build date as `<time datetime="YYYY-MM-DD">`. Quiet transparency that the site is being maintained, in lieu of a public changelog or update prompt.
- **TableOfContents** (4 files) — Well-structured, no issues
- **EditableTable** (226 lines) — Being replaced by DataTable in Template Kit v2. Row ID strategy (`rowId < 1000` = initial) is fragile. Storage split across localStorage + IndexedDB.
- **Todo.tsx** (305 lines) — ~70 lines inline print CSS should be extracted. 5-second timeout after save has unclear intent.
- **ChecklistRow.tsx** (173 lines) — Duplicates Todo logic. Not DRY. Missing print styles.
- **ExternalLink chain** (~378 lines) — Over-engineered modal for "leaving this site" confirmation. Intent unclear. Flagged P3 in CLAUDE.md.
- **UserProgressDashboard** (570 lines) — Hardcoded module names/URLs. Event cascade risk on storage changes.

### Notice strips (single-slot system)
The four top-of-page strips (storage-health, offline/online status, update, contact) never
stack: they share one slot by priority (storage-acute > status > update > storage-soft >
contact) and at most one renders at a time. Each island claims the slot on its own condition
via a presence-only `documentElement` dataset key plus the `rt:notice-changed` event, and
renders only while it is the winner. This is the house pattern for cross-island coordination:
the islands stay separate (a hydration failure in one never silences the others, including
the acute data-loss warning) and share a thin dataset + event convention rather than merging
into one component. A dismissal damps the slot so the next-lower strip waits for the next
navigation instead of popping in.

Visual treatment (Variant C, "whisper tint"): no icons — severity is carried by a 500-weight
lead phrase + ARIA role (acute = `alert`/assertive; others = `status`/polite; contact keeps
`region`), never by color. Storage strips carry a barely-there tint (~1.05-1.08:1 vs the page)
hue-aligned to the system tokens:
- soft (warning hue 66): bg `oklch(0.976 0.016 66)` / border `oklch(0.92 0.022 66)`; dark bg `oklch(0.225 0.014 66)` / border `oklch(0.3 0.016 66)`
- acute (destructive hue 32.7): bg `oklch(0.965 0.014 32.7)` / border `oklch(0.91 0.02 32.7)`; dark bg `oklch(0.222 0.014 32.7)` / border `oklch(0.3 0.018 32.7)`. Lead phrase in `--destructive`.
- back-online flash: quiet green `oklch(0.94 0.035 157)` text `oklch(0.31 0.07 157)` (dark `oklch(0.27 0.045 157)` / `oklch(0.87 0.06 157)`), replacing the former primary-orange flash.

Tokens live in `base.css` as `.notice-soft` / `.notice-acute` / `.notice-online-flash`. Links
on tinted strips use the strip foreground color + underline + 500 weight (primary orange fails
contrast on the tint); neutral strips keep the `text-primary` link. Dismiss targets are 44x44px
via logical inset (`end-0`); copy uses `text-wrap: balance` and left-aligns below 400px. Strips
swap instantly — no height or fade animation.

### Deferred Components
- **Reference templates (DO NOT delete):** WhatsNewBanner, OfflineReadyBanner — in `src/design-system/_deferred/`, zero imports. Kept as canonical templates for BetaBanner (top-banner pattern + localStorage dismissal) and the bottom-right fixed-toast pattern should it ever return.
- **Safe to delete:** SearchField, EmptyState, SegmentedControl — in `src/design-system/_deferred/`, zero imports, no downstream consumers.

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
| 2026-05-07 | BetaBanner + UpdatePromptToast added | Site-meta announcement banner + SW lifecycle prompt toast — first surfaces to extend the design vocabulary into stage-based attention escalation. Reference templates (WhatsNewBanner, OfflineReadyBanner) kept in `_deferred/` for future reuse. |
| 2026-05-07 | Added `pulse` motion duration (1200ms ease-in-out) | UpdatePromptToast stage 3 needed a continuous-attention token outside the existing fast/medium/slow scale. Gated by `prefers-reduced-motion`. |
| 2026-05-08 | Reversed UpdatePromptToast — removed component, removed `pulse` motion token, switched SW to silent-update policy | Daily update cadence + no public changelog meant the toast would fire on nearly every visit while saying nothing about what changed — pure friction with no signal. Replaced with: silent SW lifecycle (new worker waits for natural tab close, then promotes on next visit; network-first navigation already keeps in-flight tabs fresh) + a small "Last updated YYYY-MM-DD" line in the Footer for quiet transparency. The escalation stage vocabulary is no longer in active use; the templates remain in `_deferred/` if a future component needs it. |
| 2026-05-07 | Reframed product description: "community disaster preparedness" → "disaster preparedness and community resilience" | Recenters resilience as a coordinate purpose alongside preparedness, not a subset of it. Aligns the design system's framing with the brand name (Resilience Toolkit). |
| 2026-07-14 | Superseded the silent-update policy — added UpdateBanner (static in-flow notice strip) | The silent policy's premise failed in the field: on phones and home-screen apps "every tab closed" never happens, so devices stayed pinned to workers from months earlier and showed weeks-old content. UpdateBanner differs from the removed toast on every axis that made the toast noise: deploys are infrequent now, it appears only once an update is fully downloaded and verified complete, it reuses the calm BetaBanner notice-strip pattern (no toast, no animation, no new tokens), and dismissal is per-version with a 24h cap. Ignored updates self-apply only when no window is visible or at an app-resume boundary, with pending edits flushed first. The Footer "Last updated" stamp stays. |
| 2026-07-16 | Retired full-radius pills from all text surfaces; full radius reserved for true circles | Capsule chips and buttons on text surfaces read as default styling with no relationship to the hierarchical radius scale. Badge and the phase/meta chips move to md (6px), form and action buttons to lg (8px), floating triggers (FeedbackWidget, mobile TOC) to xl (12px). True circles keep 9999px: PhaseSlider nodes, numbered step circles, spinners, the header icon buttons, progress tracks, and the new chip phase dots. The unused ActionButton `pill` prop is deleted. |
| 2026-07-16 | Phase chips aligned to the PhaseSlider continuum; Before=blue maps removed | The /modules index and module-page phase badges still carried the older Before=blue / During=orange / After=green mapping that inverts the brand (blue is not in the 2-accent system). Chips are now quiet muted `.meta-chip`s whose phase dot echoes the PhaseSlider node exactly — Before = primary orange, During = the continuum midpoint (promoted to the shared `--phase-during` token so the two surfaces cannot drift), After = the open green ring. `phaseColors`/`phaseDotColors` deleted from modules.ts; one phase color system across homepage, /workflows, /modules, and module pages. |
| 2026-07-16 | Homepage explore island replaced by the unboxed "Find your path" section | The boxed module explorer (filter pills, hover detail panels, inline script) fronted five modules with heavyweight browse machinery and repeated the before/during/after model in a Before=blue mapping that inverts the brand continuum. The PhaseSlider phase cards (shared with /workflows) become the primary entry, with one-sentence descriptions folded in, module titles as quiet underlined text links, and the labeled Pagefind search row beneath. One expression of the phase model, one color system. |
| 2026-07-16 | "Explore All Modules" demoted to the outline button variant on the homepage | Filled orange on the homepage is reserved for the hero CTA and the phase cards' rail; a second filled button diluted the action hierarchy. |
| 2026-07-16 | Origin-story photos return as still captioned figures via astro:assets derivatives | The two 2023 field photographs ground the origin story in real documentation. Optimized responsive derivatives (~hundreds of KB) land in /_astro and are auto-precached, instead of the 6.9MB raw PNGs; 3:2 crop, hairline border, 12px muted captions. |
| 2026-07-16 | Pagefind core subset joins the SW precache | "Everything works offline." now covers search: the core (~230KB) passes the 500KB size gate that the whole pagefind directory (756KB, including unused UI bundles) fails. Globbed post-build so hashed chunk names cannot go stale. |
| 2026-05-07 | Restated 2-accent system as a temporal split | Orange = the work of preparing right now (immediate action, warmth). Green = the resilience that work builds toward (durable capacity, growth). The accent system now carries a meaningful design rationale beyond decorative differentiation, and reinforces the resilience-coordinate reframe at the token level. Cascades into Aesthetic Direction (Warm Industrial rationale), Mood (capacity not threat-avoidance), Reference sites (preparedness as calibration anchor, resilience as destination). |
