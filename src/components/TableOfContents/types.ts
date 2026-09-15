/**
 * Table of Contents - Type Definitions
 *
 * Types for the On this page island. The list is seeded from the build
 * (the same headers the heading-id pass ids); the island adds counts and
 * the active item.
 */

import type { SeededHeading } from '@/lib/heading-ids';

export type { SeededHeading };

export interface TOCEntry extends SeededHeading {
  /** The header element, resolved on the client */
  element?: HTMLElement;
  /** Count of completed interactive elements in this section */
  completedCount: number;
}

export interface SectionProgress {
  /** Number of completed items */
  completed: number;
  /** Total number of items */
  total: number;
  /** Completion percentage (0-100) */
  percentage: number;
}

export interface TableOfContentsProps {
  /** Module key for progress tracking (e.g., "emergency-preparedness-kits") */
  moduleKey: string;
  /** The headers the build read from the body, in document order */
  headings: SeededHeading[];
  /** CSS selector for the content container (default: "article") */
  containerSelector?: string;
  /** Optional className for styling */
  className?: string;
}

export interface TableOfContentsItemProps {
  /** The TOC entry to render */
  entry: TOCEntry;
  /** Whether this item is currently active */
  isActive: boolean;
  /** Progress data for this section */
  progress?: SectionProgress;
  /** For an h2 row: its own progress plus its h3 and band children until the next h2 */
  rollup?: SectionProgress;
  /** Click handler */
  onClick: (id: string) => void;
}
