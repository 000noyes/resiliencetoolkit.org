import { moduleDownloads } from '@/data/downloads';

/**
 * Find the PDF URL for a given section number
 * @param sectionNumber - The section number (e.g., "0.1", "1.1", "2.3")
 * @returns The public URL to the PDF, or null if not found
 */
export function getPdfUrlForSection(sectionNumber: string): string | null {
  const module = moduleDownloads.find(m => m.number === sectionNumber);

  if (!module) {
    console.warn(`No PDF found for section ${sectionNumber}`);
    return null;
  }

  return `/toolkit/sections/${module.pdfFilename}`;
}
