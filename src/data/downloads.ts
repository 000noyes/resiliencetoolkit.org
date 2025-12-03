/**
 * Downloads Page Data
 *
 * Centralized data file for all downloadable resources including
 * featured downloads and module-specific PDFs and resources.
 */

import { getFormattedFileSize } from '@/lib/fileSize';

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
  onlineUrl: string;        // "/modules/emergency-preparedness/1-1-kits"
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
    downloadUrl: 'https://docs.google.com/spreadsheets/d/1_s3vjiE-GYXAz9CMtDdodjmShBY1vMI0mDeSjxhjWPc/edit?gid=921360703#gid=921360703',
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
  }
];

/**
 * Module Downloads - Individual section PDFs and resources
 */
export const moduleDownloads: ModuleDownload[] = [
  // Section 0: Knowing Your Community
  {
    number: '0.1',
    name: 'Knowing Your Community',
    section: 'Section 0',
    onlineUrl: '/modules/knowing-your-community',
    pdfFilename: 'Section 0_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/161QG8b0iAJ4yv6O3uGmVyzWMaGrkqkI8'
  },

  // Section 1: Emergency Preparedness and Response
  {
    number: '1.1',
    name: 'Emergency preparedness kits',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-1-kits',
    pdfFilename: 'Section 1.1_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/13eSjal-yx4cU18VV8aK78w6oqy5GKz8F?usp=drive_link'
  },
  {
    number: '1.2',
    name: 'Food and water',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-2-food-water',
    pdfFilename: 'Section 1.2_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu?usp=drive_link'
  },
  {
    number: '1.3',
    name: 'First aid and medical',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-3-medical',
    pdfFilename: 'Section 1.3_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1HI-sf3QQdYHHr7g3w4OCi1zFTQ6HBMkH?usp=drive_link'
  },
  {
    number: '1.4',
    name: 'Power supply',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-4-power',
    pdfFilename: 'Section 1.4_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1Bl9xBYaeC8ysbQZDP0C01eI_CFwQUlPU?usp=drive_link'
  },
  {
    number: '1.5',
    name: 'Warming/cooling/emergency shelter',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-5-shelter',
    pdfFilename: 'Section 1.5_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1GAq4V6yx2Pn83y-l6rbauGbzQlv46CCF?usp=drive_link'
  },
  {
    number: '1.6',
    name: 'Vehicles and equipment',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-6-vehicles',
    pdfFilename: 'Section 1.6_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1KYOLws3XyfnWG622Zv5UpgeEKAqb2mJ5?usp=drive_link'
  },
  {
    number: '1.7',
    name: 'Sanitation and hygiene',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-7-sanitation',
    pdfFilename: 'Section 1.7_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1b1h7aUHjcx3LudPM6kFB7-ypshucSGOL?usp=drive_link'
  },
  {
    number: '1.8',
    name: 'Populations with specific needs',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-8-special-populations',
    pdfFilename: 'Section 1.8_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1pVuxTqRsFs2ZprmP6qJKCekvJubQ_YKi'
  },
  {
    number: '1.9',
    name: 'Community emergency response plans',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-9-response-plans',
    pdfFilename: 'Section 1.9_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1ZP8p1LZ9F5tOJ3Yo-sLllSWd22ydXzNQ?usp=drive_link'
  },
  {
    number: '1.10',
    name: 'Volunteer Management',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-10-volunteers',
    pdfFilename: 'Section 1.10_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1QGrMJ_mv5LSGZ4ECDOuuOs9OJtcOfZY3?usp=drive_link'
  },
  {
    number: '1.11',
    name: 'Flood recovery supplies and work',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-11-flood-recovery',
    pdfFilename: 'Section 1.11_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1vszckjW-VEMEx1Qec-LgLVXt-bBFYj7r?usp=drive_link'
  },
  {
    number: '1.12',
    name: 'Mutual Aid',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-12-mutual-aid',
    pdfFilename: 'Section 1.12_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1lgAo_M6Jq3i4AR9xbtpxDpFLv5MAAVyg?usp=drive_link'
  },
  {
    number: '1.13',
    name: 'Financial resources',
    section: 'Section 1',
    onlineUrl: '/modules/emergency-preparedness/1-13-financial-resources',
    pdfFilename: 'Section 1.13_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1fAFOW-sh7Rls6bckXHub4gN9PX_1je9N?usp=drive_link'
  },

  // Section 2: Baseline Community Resilience
  {
    number: '2.1',
    name: 'Basic needs',
    section: 'Section 2',
    onlineUrl: '/modules/baseline-resilience/2-1-basic-needs',
    pdfFilename: 'Section 2.1_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1ANzQP2YD_PgkS69TxgaUwnUYX-AOsy8I?usp=drive_link'
  },
  {
    number: '2.2',
    name: 'Shared tools',
    section: 'Section 2',
    onlineUrl: '/modules/baseline-resilience/2-2-shared-tools',
    pdfFilename: 'Section 2.2_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/1vd2qaanne9Wq_zeYnVMbqWXNONe2vG0C?usp=drive_link'
  },
  {
    number: '2.3',
    name: 'Community building',
    section: 'Section 2',
    onlineUrl: '/modules/baseline-resilience/2-3-community-building',
    pdfFilename: 'Section 2.3_2025 Resilience Hub Toolkit.pdf',
    resourcesUrl: 'https://drive.google.com/drive/folders/106ukXkOgMqpIDDVS_mAim3n0QWYJx4_4?usp=drive_link'
  }
];

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
