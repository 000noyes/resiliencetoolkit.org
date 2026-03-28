/**
 * Navigation Utility
 *
 * getSectionNavigation removed — all sections are hardcoded .astro pages
 * with inline SectionData. MDX migration deferred to glass-box-expanded branch.
 */
import { getCollection } from 'astro:content';

/**
 * Get all sections for a given module slug, in order.
 * Uses module YAML metadata.
 */
export async function getModuleSections(moduleSlug: string) {
  const allModules = await getCollection('modules');
  const moduleEntry = allModules.find(m => m.data.slug === moduleSlug);
  if (!moduleEntry) return [];

  return moduleEntry.data.sections.map(s => ({
    number: s.number,
    title: s.title,
    slug: s.slug,
  }));
}
