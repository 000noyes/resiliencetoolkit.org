/**
 * Navigation Utility - Auto-computes prev/next section links
 *
 * Replaces the hand-coded SectionData prev/next in each .astro page.
 * Reads module YAML data to determine section order and metadata,
 * then computes navigation links for any given section.
 *
 * Uses section metadata from module YAML (not the content collection)
 * so navigation works even during phased migration when not all sections
 * have been converted to MDX yet.
 */
import { getCollection } from 'astro:content';
import type { SectionData, SectionLink } from '@/types/section-navigation';

/**
 * Build complete SectionData for a given section slug.
 *
 * Looks up the section's parent module, finds the section's position
 * in the module's section order, and computes prev/next links.
 */
export async function getSectionNavigation(sectionSlug: string): Promise<SectionData | null> {
  const allSections = await getCollection('sections');
  const section = allSections.find(s => s.data.slug === sectionSlug);

  if (!section) return null;

  // Find the parent module
  const allModules = await getCollection('modules');
  const moduleEntry = allModules.find(m => m.data.slug === section.data.module);
  if (!moduleEntry) return null;

  const { data: moduleData } = moduleEntry;

  // Find index of this section in the module's section order
  const sectionOrder = moduleData.sections;
  const currentIndex = sectionOrder.findIndex(s => s.slug === sectionSlug);
  if (currentIndex === -1) return null;

  // Build prev/next from module YAML metadata (works even for non-migrated sections)
  let prevSection: SectionLink = null;
  let nextSection: SectionLink = null;

  if (currentIndex > 0) {
    const prev = sectionOrder[currentIndex - 1];
    prevSection = {
      number: prev.number,
      title: prev.title,
      slug: prev.slug,
    };
  }

  if (currentIndex < sectionOrder.length - 1) {
    const next = sectionOrder[currentIndex + 1];
    nextSection = {
      number: next.number,
      title: next.title,
      slug: next.slug,
    };
  }

  // Handle cross-module navigation for first section of emergency-preparedness
  if (currentIndex === 0 && moduleData.slug === 'emergency-preparedness' && sectionOrder[0]?.slug === '1-1') {
    prevSection = {
      number: '0.1',
      title: 'Knowing your community',
      slug: '../knowing-your-community',
    };
  }

  // Handle cross-module navigation for last section of emergency-preparedness → baseline-resilience
  if (currentIndex === sectionOrder.length - 1 && moduleData.slug === 'emergency-preparedness' && sectionOrder[currentIndex]?.slug === '1-13') {
    nextSection = {
      number: '2.1',
      title: 'Basic needs',
      slug: '../baseline-resilience/2-1',
    };
  }

  return {
    number: section.data.number,
    title: section.data.title,
    moduleTitle: moduleData.title,
    modulePath: moduleData.basePath,
    prevSection,
    nextSection,
  };
}

/**
 * Get all sections for a given module slug, in order.
 * Uses module YAML metadata — works even for non-migrated sections.
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
