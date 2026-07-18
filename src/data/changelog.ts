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
  draft?: boolean;
}

export const changelogEntries: ChangelogEntry[] = [
  {
    id: '0003',
    date: 'Jul 18, 2026',
    isoDate: '2026-07-18',
    title: 'Your dashboard now answers one question first',
    summary: [
      'The dashboard opens by telling you whether your work is backed up, in one sentence',
      'One set of words everywhere: you back up your work, and you restore it from a backup file',
      'Restoring shows you what a backup file holds before anything on your device changes',
      'Backup files now carry the date and time they were made, and the name of the device that made them if you set one',
      'A printable recovery card you can keep with your emergency papers',
    ],
    sections: [
      {
        heading: 'Is my work safe?',
        content: `
          <p>The dashboard now leads with the answer to the question that matters most: is the work on this device backed up? When there are changes ready to back up it says how many, and one tap makes the backup file. When everything is backed up, it says so plainly.</p>
          <p>Below the answer, a small table shows what is saved on this device, module by module, so you always know what a backup would hold.</p>
          <p><a href="/dashboard">Go to your dashboard</a></p>
        `,
      },
      {
        heading: 'Bringing work back',
        content: `
          <p>Restoring from a backup now shows a preview first: the file's name, the date it was made, and what it holds. Nothing on your device changes until you say so, and if the file may be missing newer work on your device, the dashboard offers to back this device up first.</p>
          <p>Every backup file this site has ever made still restores, including files from before this change.</p>
        `,
      },
    ],
  },
  {
    id: '0002',
    draft: true,
    date: 'Feb 8, 2026',
    isoDate: '2026-02-08',
    title: 'It also works offline*',
    summary: [
      'Every checklist, note, and table in the toolkit is saved directly to your device.',
      'It is never sent to a server or shared with anyone else; no account or sign-in required',
      'Visiting the site once is enough: all 17 module pages are automatically saved for offline use',
      'The toolkit is ready to store your data the moment any page loads (no setup, no account, no sign-in)',
    ],
    sections: [
      {
        heading: 'Your data stays on your device',
        content: `
          <p>The Resilience Hub Toolkit stores everything (read: checked boxes, typed notes, filled-in tables) directly on the device being used. A phone, laptop, or tablet. Nothing is uploaded. Nothing is shared. No account is needed.</p>
          <p>That means no one else can see what's been entered. Not the site operators, not a cloud service, not anyone. The data belongs to the person using the device, and it stays there.</p>
        `,
      },
      {
        heading: 'So what\'s the asterisk?',
        content: `
          <p>*The site needs to be loaded once with an internet connection before it can work offline. After that first visit, every page and all the tools are available without Wi-Fi or cell service.</p>
          <p>There's no need to visit each module page individually. The entire toolkit is saved automatically after the first visit.</p>
          <p>A few things that can clear the saved site data:</p>
          <ul>
            <li>Clearing browser history or site data</li>
            <li>Using a private or incognito browser window (data may not survive after closing it)</li>
            <li>Switching to a different browser or device</li>
          </ul>
        `,
      },
      {
        heading: 'Verified across every page',
        content: `
          <p>I tested every page. The results:</p>
          <ul>
            <li>Data saves immediately when a checklist or table is used</li>
            <li>Data survives page refreshes, navigating between sections, and closing the browser</li>
            <li>Pages without checklists (like Volunteer Management and Financial Resources) are still ready to save data the moment they load</li>
          </ul>
          <p>Automated checks re-verify all of this regularly to catch any problems early.</p>
        `,
      },
      {
        heading: 'How it works under the hood',
        content: `
          <p>For the curious: the toolkit uses two built-in browser features to work offline.</p>
          <p><strong>For saving your data:</strong> Every checklist item, note, and table entry is stored in a small database built into the browser itself, called IndexedDB. It works like a filing cabinet inside the browser—organized, private, and accessible only from this site on this device. Nothing is ever sent over the internet.</p>
          <p><strong>For saving the site itself:</strong> The first time the site loads, a background helper called a Service Worker quietly downloads and stores every page, image, and tool the toolkit uses. After that, the entire site can load and run without any internet connection at all—just like an app installed on a phone.</p>
          <p>Both of these are standard features available in every modern browser. No plugins, extensions, or special software needed.</p>
        `,
      },
      {
        heading: 'One thing to know',
        content: `
          <p>Because data lives on the device, it stays on that device. Checklists filled out on a phone won't appear on a laptop, and vice versa.</p>
          <p>A future update may add the ability to export and back up data.</p>
        `,
      },
    ],
    tags: ['feature', 'security'],
  },
  {
    id: '0001',
    date: 'Feb 7, 2026',
    isoDate: '2026-02-07',
    title: 'Dashboard, Search, Navigation & More',
    summary: [
      'New personal dashboard tracks your progress and recent activity across all modules',
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
          <p>All data is stored locally on your device—nothing is sent to any server.</p>
          <p><a href="/dashboard">Go to your Dashboard</a></p>
        `,
        image: {
          src: '/changelog/001-dashboard.png',
          alt: 'Personal dashboard showing items completed, modules started, recent activity, and progress by module',
          caption: 'The new personal dashboard with progress tracking',
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
          <p><a href="/map">View the Community Resilience Map</a></p>
        `,
        image: {
          src: '/changelog/001-cros-map.png',
          alt: 'Community Resilience Map showing CRO service areas across Vermont counties',
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
  return [...changelogEntries].filter(e => !e.draft).sort(
    (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()
  );
}

/**
 * Get a single entry by ID
 */
export function getEntryById(id: string): ChangelogEntry | undefined {
  return changelogEntries.find(entry => entry.id === id);
}
