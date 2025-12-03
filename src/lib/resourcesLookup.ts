import { moduleDownloads } from '@/data/downloads';

/**
 * Find the Google Drive resources URL for a given section number
 * @param sectionNumber - The section number (e.g., "0.1", "1.1", "2.3")
 * @returns The Google Drive folder URL, or null if not found
 */
export function getResourcesUrlForSection(sectionNumber: string): string | null {
  const module = moduleDownloads.find(m => m.number === sectionNumber);

  if (!module) {
    console.warn(`No module found for section ${sectionNumber}`);
    return null;
  }

  return module.resourcesUrl || null;
}
