/**
 * The one contents model.
 *
 * Single source of truth for the toolkit's reading order: front matter,
 * the three sections with their chapters, and back matter. Every contents
 * render (the homepage list, the /modules cards, the section openers, the
 * /downloads table, prev/next chains, PDF and resources lookups) derives
 * from this tree. No surface holds its own copy of the order.
 *
 * Section pages pass only their section number to ModuleLayout, which
 * resolves title, breadcrumb, prev/next, PDF, and resources from here.
 */

export type Phase = 'Before' | 'During' | 'After';

export interface Chapter {
  /** Printed toolkit section number, e.g. "1.2" */
  number: string;
  /** Reading-surface title, as the page h1 renders it */
  title: string;
  /** Page filename under the section's base path, e.g. "1-2" */
  slug: string;
  /** The /downloads table's shipped label, only where it differs from title */
  downloadName?: string;
  /**
   * The section opener list's shipped label, only where it differs from
   * title (1.5 and 1.12 ship spaced slashes there and compact ones in the
   * page h1). Recorded variance, pending the operator's naming call.
   */
  listTitle?: string;
  /** Per-section PDF filename under /toolkit/sections/ */
  pdfFilename: string;
  /** Google Drive resources folder (optional) */
  resourcesUrl?: string;
  /** Printed 2025 edition page range, e.g. "35-36" (provenance data) */
  sourcePages: string;
}

export interface ContentsSection {
  /** Toolkit section number: 0, 1, or 2 */
  number: 0 | 1 | 2;
  title: string;
  slug: string;
  /** Where this section's chapter pages live */
  basePath: string;
  /** The section opener page, or null (Section 0 has no opener; its crumb goes to 0.1) */
  openerPath: string | null;
  phases: Phase[];
  chapters: Chapter[];
}

/**
 * Front matter. The "0.0" number is the shipped label quirk on 0.1's
 * previous-link ("Previous: 0.0 Introduction"); it renders nowhere else.
 */
export const frontMatter = {
  number: '0.0',
  title: 'Introduction',
  path: '/introduction',
} as const;

/** Back matter: the print and download room. The contents tree ends here. */
export const resourceLibrary = {
  title: 'Resource Library',
  path: '/downloads',
} as const;

/**
 * Back matter that is site chrome, not a reading destination: ordered for
 * the nav and colophon, never rendered as tree rows.
 */
export const siteChrome = [
  { title: 'Map', path: '/map' },
  { title: 'About', path: '/about' },
  { title: 'Changes', path: '/changelog' },
] as const;

export const contents: ContentsSection[] = [
  {
    number: 0,
    title: 'Knowing Your Community',
    slug: 'knowing-your-community',
    basePath: '/modules',
    openerPath: null,
    phases: ['Before', 'After'],
    chapters: [
      {
        number: '0.1',
        title: 'Knowing Your Community',
        slug: 'knowing-your-community',
        pdfFilename: 'Section 0_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/161QG8b0iAJ4yv6O3uGmVyzWMaGrkqkI8',
        sourcePages: '10-23',
      },
    ],
  },
  {
    number: 1,
    title: 'Emergency Preparedness and Response',
    slug: 'emergency-preparedness',
    basePath: '/modules/emergency-preparedness',
    openerPath: '/modules/emergency-preparedness',
    phases: ['Before', 'During', 'After'],
    chapters: [
      {
        number: '1.1',
        title: 'Emergency preparedness kits',
        slug: '1-1',
        pdfFilename: 'Section 1.1_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/13eSjal-yx4cU18VV8aK78w6oqy5GKz8F?usp=drive_link',
        sourcePages: '30',
      },
      {
        number: '1.2',
        title: 'Food and water',
        slug: '1-2',
        pdfFilename: 'Section 1.2_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu?usp=drive_link',
        sourcePages: '35-36',
      },
      {
        number: '1.3',
        title: 'First aid and medical',
        slug: '1-3',
        pdfFilename: 'Section 1.3_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1HI-sf3QQdYHHr7g3w4OCi1zFTQ6HBMkH?usp=drive_link',
        sourcePages: '42',
      },
      {
        number: '1.4',
        title: 'Power supply',
        slug: '1-4',
        pdfFilename: 'Section 1.4_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1Bl9xBYaeC8ysbQZDP0C01eI_CFwQUlPU?usp=drive_link',
        sourcePages: '45',
      },
      {
        number: '1.5',
        title: 'Warming/Cooling/Emergency Shelter',
        slug: '1-5',
        listTitle: 'Warming / Cooling / Emergency Shelter',
        downloadName: 'Warming/cooling/emergency shelter',
        pdfFilename: 'Section 1.5_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1GAq4V6yx2Pn83y-l6rbauGbzQlv46CCF?usp=drive_link',
        sourcePages: '45',
      },
      {
        number: '1.6',
        title: 'Vehicles and Equipment',
        slug: '1-6',
        downloadName: 'Vehicles and equipment',
        pdfFilename: 'Section 1.6_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1KYOLws3XyfnWG622Zv5UpgeEKAqb2mJ5?usp=drive_link',
        sourcePages: '49',
      },
      {
        number: '1.7',
        title: 'Sanitation and Hygiene',
        slug: '1-7',
        downloadName: 'Sanitation and hygiene',
        pdfFilename: 'Section 1.7_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1b1h7aUHjcx3LudPM6kFB7-ypshucSGOL?usp=drive_link',
        sourcePages: '52',
      },
      {
        number: '1.8',
        title: 'Populations with Specific Needs',
        slug: '1-8',
        downloadName: 'Populations with specific needs',
        pdfFilename: 'Section 1.8_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1pVuxTqRsFs2ZprmP6qJKCekvJubQ_YKi',
        sourcePages: '54-59',
      },
      {
        number: '1.9',
        title: 'Community Emergency Response Plans',
        slug: '1-9',
        downloadName: 'Community emergency response plans',
        pdfFilename: 'Section 1.9_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1ZP8p1LZ9F5tOJ3Yo-sLllSWd22ydXzNQ?usp=drive_link',
        sourcePages: '62-66',
      },
      {
        number: '1.10',
        title: 'Volunteer Management',
        slug: '1-10',
        pdfFilename: 'Section 1.10_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1QGrMJ_mv5LSGZ4ECDOuuOs9OJtcOfZY3?usp=drive_link',
        sourcePages: '69-70',
      },
      {
        number: '1.11',
        title: 'Flood Recovery Supplies and Work',
        slug: '1-11',
        downloadName: 'Flood recovery supplies and work',
        pdfFilename: 'Section 1.11_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1vszckjW-VEMEx1Qec-LgLVXt-bBFYj7r?usp=drive_link',
        sourcePages: '73-77',
      },
      {
        number: '1.12',
        title: 'Mutual Aid/Neighbor to Neighbor (N2N)',
        slug: '1-12',
        listTitle: 'Mutual Aid / Neighbor to Neighbor (N2N)',
        downloadName: 'Mutual Aid',
        pdfFilename: 'Section 1.12_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1lgAo_M6Jq3i4AR9xbtpxDpFLv5MAAVyg?usp=drive_link',
        sourcePages: '78',
      },
      {
        number: '1.13',
        title: 'Financial Resources',
        slug: '1-13',
        downloadName: 'Financial resources',
        pdfFilename: 'Section 1.13_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1fAFOW-sh7Rls6bckXHub4gN9PX_1je9N?usp=drive_link',
        sourcePages: '78',
      },
    ],
  },
  {
    number: 2,
    title: 'Baseline Resilience',
    slug: 'baseline-resilience',
    basePath: '/modules/baseline-resilience',
    openerPath: '/modules/baseline-resilience',
    phases: ['Before', 'After'],
    chapters: [
      {
        number: '2.1',
        title: 'Basic Needs',
        slug: '2-1',
        downloadName: 'Basic needs',
        pdfFilename: 'Section 2.1_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1ANzQP2YD_PgkS69TxgaUwnUYX-AOsy8I?usp=drive_link',
        sourcePages: '80',
      },
      {
        number: '2.2',
        title: 'Shared Tools',
        slug: '2-2',
        downloadName: 'Shared tools',
        pdfFilename: 'Section 2.2_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/1vd2qaanne9Wq_zeYnVMbqWXNONe2vG0C?usp=drive_link',
        sourcePages: '86',
      },
      {
        number: '2.3',
        title: 'Community Building',
        slug: '2-3',
        downloadName: 'Community building',
        pdfFilename: 'Section 2.3_2025 Resilience Hub Toolkit.pdf',
        resourcesUrl: 'https://drive.google.com/drive/folders/106ukXkOgMqpIDDVS_mAim3n0QWYJx4_4?usp=drive_link',
        sourcePages: '88',
      },
    ],
  },
];

/** All chapters in reading order, each with its section. */
export function allChapters(): { chapter: Chapter; section: ContentsSection }[] {
  return contents.flatMap((section) =>
    section.chapters.map((chapter) => ({ chapter, section }))
  );
}

/** Find a chapter and its section by printed section number, e.g. "1.2". */
export function findChapter(
  number: string
): { chapter: Chapter; section: ContentsSection } | null {
  for (const section of contents) {
    const chapter = section.chapters.find((c) => c.number === number);
    if (chapter) return { chapter, section };
  }
  return null;
}

/** The page URL a chapter reads at. */
export function chapterUrl(number: string): string | null {
  const found = findChapter(number);
  if (!found) return null;
  return `${found.section.basePath}/${found.chapter.slug}`;
}

/**
 * The linear reading chain.
 *
 * 'shipped' reproduces the pre-entry-experience links exactly: chains stay
 * inside each section (1.1 and 2.1 have no previous, 1.13 and 2.3 have no
 * next) and only 0.1 bridges outward, to the introduction and to 1.1.
 *
 * 'dr4' puts the section openers IN the chain (DR4): introduction, 0.1,
 * Section 1 opener, 1.1 through 1.13, Section 2 opener, 2.1 through 2.3.
 * Flipping this constant is the whole DR4 chain fix.
 */
export type ChainMode = 'shipped' | 'dr4';
export const chainMode: ChainMode = 'shipped';

export interface ChainStop {
  /** Chain id: a chapter number, "0.0" for the introduction, or "opener-N" */
  id: string;
  /** The rendered link text after "Previous:"/"Next:", e.g. "1.2 Food and water" */
  label: string;
  href: string;
}

function introStop(): ChainStop {
  return {
    id: frontMatter.number,
    label: `${frontMatter.number} ${frontMatter.title}`,
    href: frontMatter.path,
  };
}

function chapterStop(chapter: Chapter, section: ContentsSection): ChainStop {
  return {
    id: chapter.number,
    label: `${chapter.number} ${chapter.title}`,
    href: `${section.basePath}/${chapter.slug}`,
  };
}

function openerStop(section: ContentsSection): ChainStop | null {
  if (!section.openerPath) return null;
  return {
    id: `opener-${section.number}`,
    label: section.title,
    href: section.openerPath,
  };
}

/** The full ordered chain for the active mode. */
export function readingChain(mode: ChainMode = chainMode): ChainStop[] {
  if (mode === 'dr4') {
    const stops: ChainStop[] = [introStop()];
    for (const section of contents) {
      const opener = openerStop(section);
      if (opener) stops.push(opener);
      for (const chapter of section.chapters) stops.push(chapterStop(chapter, section));
    }
    return stops;
  }
  // shipped: within-section islands; 0.1 bridges to the introduction and 1.1
  return [];
}

/** Previous/next stops for a chain id under the active mode. */
export function chainFor(
  id: string,
  mode: ChainMode = chainMode
): { prev: ChainStop | null; next: ChainStop | null } {
  if (mode === 'dr4') {
    const stops = readingChain('dr4');
    const i = stops.findIndex((s) => s.id === id);
    if (i === -1) return { prev: null, next: null };
    return { prev: stops[i - 1] ?? null, next: stops[i + 1] ?? null };
  }

  // shipped behavior, reproduced exactly
  if (id === '0.1') {
    const next = findChapter('1.1');
    return {
      prev: introStop(),
      next: next ? chapterStop(next.chapter, next.section) : null,
    };
  }
  const found = findChapter(id);
  if (!found) return { prev: null, next: null };
  const { section } = found;
  const i = section.chapters.findIndex((c) => c.number === id);
  const prev = section.chapters[i - 1] ?? null;
  const next = section.chapters[i + 1] ?? null;
  return {
    prev: prev ? chapterStop(prev, section) : null,
    next: next ? chapterStop(next, section) : null,
  };
}

export interface TreeRow {
  kind: 'front-matter' | 'section' | 'chapter' | 'back-matter';
  label: string;
  href: string;
  number?: string;
}

/**
 * The Toolkit Contents render rows: front matter first, each section with
 * its chapters, ending at Resource Library. Map, About, and Changes are
 * site chrome and never render as tree rows.
 */
export function treeRows(): TreeRow[] {
  const rows: TreeRow[] = [
    { kind: 'front-matter', label: frontMatter.title, href: frontMatter.path },
  ];
  for (const section of contents) {
    rows.push({
      kind: 'section',
      label: section.title,
      href: section.openerPath ?? chapterUrl(section.chapters[0].number)!,
    });
    for (const chapter of section.chapters) {
      // Section 0's single chapter is its own section row; no child row repeats it
      if (section.chapters.length === 1 && chapter.title === section.title) continue;
      rows.push({
        kind: 'chapter',
        label: chapter.title,
        href: `${section.basePath}/${chapter.slug}`,
        number: chapter.number,
      });
    }
  }
  rows.push({ kind: 'back-matter', label: resourceLibrary.title, href: resourceLibrary.path });
  return rows;
}
