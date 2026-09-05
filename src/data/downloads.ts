/**
 * Downloads Page Data
 *
 * Featured downloads plus the download render of the one contents model
 * (src/data/contents.ts): the module table's order, names, and URLs derive
 * from the model; featured downloads are this page's own data.
 */

import { getFormattedFileSize } from '@/lib/fileSize';
import { allChapters } from './contents';

export interface FeaturedDownload {
  title: string;
  description: string;
  downloadUrl: string;
  fileSize?: string;
  icon: 'pdf' | 'spreadsheet' | 'document';
  isExternal?: boolean;  // If true, opens as external link instead of download
}

export interface ModuleDownload {
  number: string;           // "0", "1.1", "2.3"
  name: string;             // "Emergency preparedness kits"
  section: string;          // "Section 0", "Section 1", "Section 2"
  onlineUrl: string;        // "/modules/emergency-preparedness/1-1"
  pdfFilename: string;      // "Section 1.1_2025 Resilience Hub Toolkit.pdf"
  resourcesUrl?: string;    // Google Drive folder URL (optional, TBD)
}

/**
 * Featured Downloads - Prominent toolkit downloads
 * File sizes are read dynamically at build time
 */

// Read file sizes at build time using top-level await
const toolkit1Size = await getFormattedFileSize('public/toolkit/2025 Resilience Hub Toolkit_V1 final.pdf');
const toolkit2Size = await getFormattedFileSize('public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf');

export const featuredDownloads: FeaturedDownload[] = [
  // Download Group
  {
    title: '2025 Resilience Hub Toolkit',
    description: 'Complete resilience hub toolkit without templates',
    downloadUrl: '/toolkit/2025 Resilience Hub Toolkit_V1 final.pdf',
    fileSize: toolkit1Size,
    icon: 'pdf'
  },
  {
    title: '2025 Resilience Hub Toolkit with Templates',
    description: 'Complete toolkit including all templates and worksheets',
    downloadUrl: '/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf',
    fileSize: toolkit2Size,
    icon: 'pdf'
  },

  // View Online Group
  {
    title: 'View Toolkit in Document Format',
    description: 'Browse the complete toolkit online in Google Docs',
    downloadUrl: 'https://docs.google.com/document/d/14BP-QH2db38sJuVMp2Rs2AxfepnuEIUcJASnewGmioU/edit?tab=t.0#heading=h.hlgifqj3ns1e',
    icon: 'document',
    isExternal: true
  },
  {
    title: 'Vermont Town Directory',
    description: 'Directory of Vermont towns with jurisdictions, RPCs, LTRGs, and resilience hub contacts',
    // Live Vermont Town Directory sheet, shared by the coalition 2026-06-29.
    // Linked as /preview (read-only) since the sheet is shared anyone-can-edit.
    downloadUrl: 'https://docs.google.com/spreadsheets/d/17SYNgwm49HYJ2YZm_hskr9mrPq7NcxofVJ9OSsph2ls/preview',
    icon: 'spreadsheet',
    isExternal: true
  },
  {
    title: 'Templates Directory',
    description: 'Spreadsheet directory of all templates and resources',
    downloadUrl: 'https://docs.google.com/spreadsheets/d/1sJ-inMiVKj5SWsCukg_IimgWcA4oQLVWkbg6lAxcI3E/edit?gid=458153177#gid=458153177',
    icon: 'spreadsheet',
    isExternal: true
  },
  {
    title: 'Community Needs Assessment',
    description: 'Interactive community needs assessment tool',
    downloadUrl: 'https://drive.google.com/file/d/18Agz8LA23sPxxqChrdKujppBaqLgwk69/view',
    icon: 'document',
    isExternal: true
  },
  {
    title: 'Interactive Toolkit Activity',
    description: 'Interactive toolkit activity guide',
    downloadUrl: 'https://drive.google.com/file/d/10PfAqefQWzjC_BwJvK1PySATl3W4t843/view',
    icon: 'document',
    isExternal: true
  }
];

/**
 * Module Downloads - Individual section PDFs and resources,
 * derived from the one contents model in reading order.
 */
export const moduleDownloads: ModuleDownload[] = allChapters().map(({ chapter, section }) => ({
  number: chapter.number,
  name: chapter.downloadName ?? chapter.title,
  section: `Section ${section.number}`,
  onlineUrl: `${section.basePath}/${chapter.slug}`,
  pdfFilename: chapter.pdfFilename,
  ...(chapter.resourcesUrl ? { resourcesUrl: chapter.resourcesUrl } : {}),
}));

/**
 * Helper function to group modules by section
 * @returns Map of section names to their modules
 */
export function getModulesBySection(): Map<string, ModuleDownload[]> {
  const sections = new Map<string, ModuleDownload[]>();

  for (const module of moduleDownloads) {
    if (!sections.has(module.section)) {
      sections.set(module.section, []);
    }
    sections.get(module.section)!.push(module);
  }

  return sections;
}
