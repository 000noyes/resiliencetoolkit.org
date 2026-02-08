/**
 * Changelog Data
 *
 * Structured changelog entries following the Eden-style format.
 * Each entry has an ID, date, title, summary bullets, and detailed sections.
 *
 * ── Writing Guidelines ──────────────────────────────────────────────
 *
 * Audience:  Non-technical. Includes older rural residents who may not
 *            be familiar with web or technology terms.
 *
 * Tone:      Warm, clear, and direct — like a community newsletter.
 *
 * DO:
 *   - Lead with the benefit to the reader, not how it works.
 *   - Use everyday language ("works without an internet connection").
 *   - Keep sentences short and scannable.
 *
 * AVOID:
 *   - Developer jargon: client-side, service worker, API, cache,
 *     build time, index, render, component, deploy, etc.
 *   - Performance metrics: file-size reductions, percentages,
 *     optimization details.
 *   - Implementation details: library names (Pagefind, React, etc.),
 *     technical architecture, or how something is built.
 *
 * Example:
 *   ✗  "Search index is cached by the service worker for offline use."
 *   ✓  "Search works even without an internet connection."
 *
 * ────────────────────────────────────────────────────────────────────
 */

export interface ChangelogSection {
  heading?: string;
  content: string;
  image?: {
    src: string;
    alt: string;
    caption?: string;
  };
}

export interface ChangelogEntry {
  id: string;
  date: string;
  isoDate: string;
  title: string;
  summary: string[];
  sections: ChangelogSection[];
  tags?: string[];
}

export const changelogEntries: ChangelogEntry[] = [
  {
    id: '0001',
    date: 'Feb 7, 2026',
    isoDate: '2026-02-07',
    title: 'Dashboard, Search, Navigation & More',
    summary: [
      'New personal dashboard tracks your progress, recent activity, and streaks across all modules',
      'Browse and filter modules by disaster phase on the homepage, with a built-in keyword search',
      '"On this page" sidebar on module pages helps you see what\'s covered and jump to any section',
      'Community Resilience Map added to the /map page',
      'Homepage photo gallery featuring real flood response work',
    ],
    sections: [
      {
        heading: 'Personal Dashboard',
        content: `
          <p>A new dashboard gives you a personal overview of your preparedness journey. As you work through the toolkit's checklists, the dashboard tracks your progress across all modules—showing items completed, modules started, and your most recent activity.</p>
          <p>Expand any module in "Progress by Module" to see a per-section breakdown (e.g., how many Emergency Kits items you've checked off vs. Food & Water). The sidebar on each module page also reflects your progress in real time, so you always know where you left off.</p>
          <p>Set a weekly goal and build a streak to stay motivated. All data is stored locally on your device—nothing is sent to any server.</p>
          <p><a href="/dashboard">Go to your Dashboard</a></p>
        `,
        image: {
          src: '/changelog/001-dashboard.png',
          alt: 'Personal dashboard showing items completed, modules started, recent activity, and progress by module',
          caption: 'The new personal dashboard with progress tracking and streaks',
        },
      },
      {
        heading: 'Interactive Module Explorer',
        content: `
          <p>The homepage now features an "Explore the toolkit yourself" section with phase filters. Click Before, During, or After to see which modules apply to each stage of a disaster. General modules like the Introduction and Resource Library always stay visible so new visitors can find their way around.</p>
          <p>Each module appears as a button with its icon and colored phase dots. Hover or tap on any module to see a short description.</p>
          <p>The explorer also includes a keyword search — just start typing to find content across the entire toolkit. Results appear as you type, with your search terms highlighted. This search works even without an internet connection.</p>
          <p><a href="/">Try it on the homepage</a></p>
        `,
        image: {
          src: '/changelog/001-search-module.png',
          alt: 'Interactive module explorer with phase filter pills and keyword search field',
          caption: 'Filter modules by phase and search by keyword',
        },
      },
      {
        heading: 'Table of Contents Sidebar',
        content: `
          <p>Module pages now feature a Wikipedia-style "On this page" sidebar that makes it easy to see what's on the page and jump to any section. It tracks your scroll position, highlights the current section, and shows checklist completion progress (e.g., "5/11").</p>
          <p>On smaller screens, tap the floating button in the bottom-right corner to open the table of contents as a slide-in drawer.</p>
          <p><a href="/modules/emergency-preparedness/1-1">See it in action on Emergency Kits</a></p>
        `,
        image: {
          src: '/changelog/001-toc-sidebar.png',
          alt: 'Table of Contents sidebar showing section navigation with progress indicators',
          caption: 'The "On this page" sidebar on a module page',
        },
      },
      {
        heading: 'Community Resilience Map',
        content: `
          <p>The Find Your Town page now features a map, showing regional service areas across Vermont.</p>
          <p>Click the map to open it full-size in a new browser tab—especially helpful on mobile devices where you can pinch to zoom. Interactive features coming soon.</p>
          <p><a href="/map">View the Community Asset Map</a></p>
        `,
        image: {
          src: '/changelog/001-community-asset-map.png',
          alt: 'Community Asset Map showing CRO service areas across Vermont counties',
          caption: 'Community Resilience Map on the /map page',
        },
      },
      {
        heading: 'Homepage Photo Gallery',
        content: `
          <p>A new Field Snapshots section appears on the homepage, highlighting real flood response work. The photos rotate on each visit, and you can click "View gallery" to browse all photos with full-size views and captions.</p>
          <p>Photos load quickly, even on slower connections.</p>
        `,
        image: {
          src: '/changelog/001-gallery.png',
          alt: 'Field Snapshots gallery modal showing flood response photos with captions',
          caption: 'Browse flood response photos in the Field Snapshots gallery',
        },
      },
      {
        heading: 'Changelog',
        content: `
          <p>We're introducing this changelog to keep you informed about updates to the Resilience Hub Toolkit. As we continue to improve the site and add new features, you'll be able to find all the details here.</p>
        `,
      },
    ],
    tags: ['feature', 'design', 'search', 'navigation'],
  },
];

/**
 * Get entries sorted by date (newest first)
 */
export function getSortedEntries(): ChangelogEntry[] {
  return [...changelogEntries].sort(
    (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()
  );
}

/**
 * Get a single entry by ID
 */
export function getEntryById(id: string): ChangelogEntry | undefined {
  return changelogEntries.find(entry => entry.id === id);
}
