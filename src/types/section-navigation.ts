/**
 * Type Definitions for Module Section Navigation
 *
 * These types define the structure for navigating between sections within modules.
 * Used by ModuleLayout.astro to render prev/next navigation links.
 */

/**
 * Link to a module section (or null if no link)
 *
 * Used for "Previous" and "Next" navigation buttons between sections.
 * Null indicates no previous/next section (first/last section).
 */
export type SectionLink = {
  /** Section number (e.g., "1.1", "2.3") */
  number: string;
  /** Human-readable section title */
  title: string;
  /** URL slug for the section */
  slug: string;
} | null;

/**
 * Complete navigation data for a module section
 *
 * Passed to ModuleLayout.astro to render breadcrumbs and prev/next navigation.
 */
export interface SectionData {
  /** Section number (e.g., "1.1") */
  number: string;
  /** Section title */
  title: string;
  /** Parent module title (e.g., "Emergency Preparedness") */
  moduleTitle: string;
  /** URL path to parent module index (e.g., "/modules/emergency-preparedness") */
  modulePath: string;
  /** Link to previous section (null if first section) */
  prevSection: SectionLink;
  /** Link to next section (null if last section) */
  nextSection: SectionLink;
}
