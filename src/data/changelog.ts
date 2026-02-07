/**
 * Changelog Data
 *
 * Structured changelog entries following the Eden-style format.
 * Each entry has an ID, date, title, summary bullets, and detailed sections.
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
      'Full-text search indexes all toolkit content and works offline',
      'Interactive module explorer with phase filtering on the homepage',
      '"On this page" sidebar for module pages with scroll tracking and checklist progress',
      'Community Resilience Map added to the /map page',
      'Homepage Field Snapshot photo gallery with optimized images',
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
        heading: 'Full-Text Search',
        content: `
          <p>Powered by Pagefind, search now indexes all toolkit pages at build time and works entirely client-side. Type at least two characters to see results appear inline with highlighted keyword matches. The search index is cached by the service worker for offline use.</p>
        `,
      },
      {
        heading: 'Interactive Module Explorer',
        content: `
          <p>The homepage now features an "Explore the toolkit yourself" card with phase filter pills. Click Before, During, or After to see which modules apply to each disaster phase. Modules without a specific phase (Introduction and Resource Library) always remain visible so new visitors can orient themselves.</p>
          <p>Each module appears as a pill-shaped button with its icon and colored phase dots. Hover or focus on any pill to see its summary in a detail panel on the right (desktop) or below (mobile).</p>
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
          <p>The Community Assets & Resources page now features the CROs (Community Resilience Organizations) Map, showing regional service areas across Vermont.</p>
          <p>Click the map to open it full-size in a new browser tab—especially helpful on mobile devices where you can pinch to zoom. Interactive features coming soon.</p>
          <p><a href="/map">View the Community Asset Map</a></p>
        `,
        image: {
          src: '/changelog/001-community-asset-map.png',
          alt: 'Community Asset Map showing CRO service areas across Vermont counties',
          caption: 'The CROs Community Resilience Map on the /map page',
        },
      },
      {
        heading: 'Homepage Photo Gallery',
        content: `
          <p>A new Field Snapshot section appears on the homepage, highlighting real flood response work. The photos rotate on each visit, and you can click "View gallery" to browse all photos in a modal with full-size detail views.</p>
          <p>Homepage photos have been optimized, reducing file sizes by over 90% without losing quality.</p>
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
    tags: ['feature', 'design', 'search', 'performance'],
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
