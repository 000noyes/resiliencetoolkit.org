/**
 * Modules Data
 *
 * The card-index render of the one contents model (src/data/contents.ts):
 * order and identity derive from the model; icons, card summaries, and tags
 * are this render's own presentation. Used by the homepage explorer and the
 * modules index page.
 */

import { BookOpen, Users, Siren, HeartPulse, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { contents, frontMatter, resourceLibrary, chapterUrl } from './contents';
import type { Phase } from './contents';

export type { Phase };

export interface ModuleFrontmatter {
  title: string;
  order: number;
  phases?: Phase[];
  summary: string;
  tags: string[];
}

export interface Module {
  slug: string;
  url: string;
  icon: LucideIcon;
  frontmatter: ModuleFrontmatter;
}

/** Card presentation per model entry: icon, summary, and tags live with this render */
const cardPresentation: Record<string, { icon: LucideIcon; summary: string; tags: string[] }> = {
  introduction: {
    icon: BookOpen,
    summary: 'Understanding what this toolkit is for, how to use it, and what resilience means for your community.',
    tags: ['introduction', 'getting-started'],
  },
  'knowing-your-community': {
    icon: Users,
    summary: 'Map your community, identify resources, and build relationships.',
    tags: ['community', 'assessment'],
  },
  'emergency-preparedness': {
    icon: Siren,
    summary: 'Essential supplies, plans, and systems needed to prepare for and respond to disasters.',
    tags: ['emergency', 'preparedness', 'response'],
  },
  'baseline-resilience': {
    icon: HeartPulse,
    summary: 'Build everyday resilience through shared resources, community building, and mutual aid.',
    tags: ['baseline-resilience', 'community'],
  },
  downloads: {
    icon: Download,
    summary: 'Printable worksheets, checklists, and planning aids that support the guides.',
    tags: ['library', 'downloads', 'templates', 'resources'],
  },
};

function sectionCardUrl(sectionNumber: 0 | 1 | 2): string {
  const section = contents.find((s) => s.number === sectionNumber)!;
  // Section 0 has no opener; its card reads at its single chapter
  return section.openerPath ?? chapterUrl(section.chapters[0].number)!;
}

/**
 * All toolkit modules with their metadata, in the model's order:
 * front matter, the three sections, back matter.
 */
export const modules: Module[] = [
  {
    slug: 'introduction',
    url: frontMatter.path,
    icon: cardPresentation.introduction.icon,
    frontmatter: {
      title: frontMatter.title,
      order: 0,
      summary: cardPresentation.introduction.summary,
      tags: cardPresentation.introduction.tags,
    },
  },
  ...contents.map((section) => ({
    slug: section.slug,
    url: sectionCardUrl(section.number),
    icon: cardPresentation[section.slug].icon,
    frontmatter: {
      title: section.title,
      // Shipped card ordering: 0.1, 1, 2
      order: section.number === 0 ? 0.1 : section.number,
      phases: section.phases,
      summary: cardPresentation[section.slug].summary,
      tags: cardPresentation[section.slug].tags,
    },
  })),
  {
    slug: 'downloads',
    url: resourceLibrary.path,
    icon: cardPresentation.downloads.icon,
    frontmatter: {
      title: resourceLibrary.title,
      order: 5,
      summary: cardPresentation.downloads.summary,
      tags: cardPresentation.downloads.tags,
    },
  },
];

/**
 * Get modules filtered by phase
 * Note: Phaseless modules (Introduction, Resource Library) are always included
 */
export function getModulesByPhase(phase: Phase | 'All'): Module[] {
  if (phase === 'All') return modules;
  return modules.filter(m =>
    !m.frontmatter.phases || m.frontmatter.phases.includes(phase)
  );
}

/**
 * Get count of modules per phase (for filter pill badges)
 */
export function getPhaseCounts(): Record<Phase | 'All', number> {
  return {
    All: modules.length,
    Before: modules.filter(m => !m.frontmatter.phases || m.frontmatter.phases.includes('Before')).length,
    During: modules.filter(m => !m.frontmatter.phases || m.frontmatter.phases.includes('During')).length,
    After: modules.filter(m => !m.frontmatter.phases || m.frontmatter.phases.includes('After')).length,
  };
}

/**
 * Get modules sorted by order
 */
export function getSortedModules(): Module[] {
  return [...modules].sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}
