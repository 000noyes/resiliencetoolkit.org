/**
 * Modules Data
 *
 * Centralized data file for all toolkit modules including
 * metadata, phases, and helper functions for filtering.
 * Used by homepage explorer and modules index page.
 */

import { BookOpen, Users, Siren, HeartPulse, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Phase = 'Before' | 'During' | 'After';

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

/**
 * All toolkit modules with their metadata
 */
export const modules: Module[] = [
  {
    slug: 'introduction',
    url: '/introduction',
    icon: BookOpen,
    frontmatter: {
      title: 'Introduction',
      order: 0,
      summary: 'Understanding what this toolkit is for, how to use it, and what resilience means for your community.',
      tags: ['introduction', 'getting-started']
    }
  },
  {
    slug: 'knowing-your-community',
    url: '/modules/knowing-your-community',
    icon: Users,
    frontmatter: {
      title: 'Knowing Your Community',
      order: 0.1,
      phases: ['Before', 'After'],
      summary: 'Map your community, identify resources, and build relationships.',
      tags: ['community', 'assessment']
    }
  },
  {
    slug: 'emergency-preparedness',
    url: '/modules/emergency-preparedness',
    icon: Siren,
    frontmatter: {
      title: 'Emergency Preparedness and Response',
      order: 1,
      phases: ['Before', 'During', 'After'],
      summary: 'Essential supplies, plans, and systems needed to prepare for and respond to disasters.',
      tags: ['emergency', 'preparedness', 'response']
    }
  },
  {
    slug: 'baseline-resilience',
    url: '/modules/baseline-resilience',
    icon: HeartPulse,
    frontmatter: {
      title: 'Baseline Resilience',
      order: 2,
      phases: ['Before', 'After'],
      summary: 'Build everyday resilience through shared resources, community building, and mutual aid.',
      tags: ['baseline-resilience', 'community']
    }
  },
  {
    slug: 'downloads',
    url: '/downloads',
    icon: Download,
    frontmatter: {
      title: 'Resource Library',
      order: 5,
      summary: 'Printable worksheets, checklists, and planning aids that support the guides.',
      tags: ['library', 'downloads', 'templates', 'resources']
    }
  }
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
