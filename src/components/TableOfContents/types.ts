/**
 * Table of Contents - Type Definitions
 *
 * Types for the Wikipedia-style table of contents sidebar.
 */

export interface TOCEntry {
  /** Unique ID for the section (auto-generated or from element) */
  id: string;
  /** Section title text */
  text: string;
  /** Header level: h2, h3, or table section header */
  level: 'h2' | 'h3' | 'table';
  /** Reference to the DOM element */
  element: HTMLElement;
  /** Whether this section contains interactive elements (Todo items) */
  hasInteractive: boolean;
  /** Count of interactive elements in this section */
  interactiveCount: number;
  /** Count of completed interactive elements */
  completedCount: number;
  /** Nested child entries (h3s under h2) */
  children: TOCEntry[];
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
  /** Click handler */
  onClick: (id: string) => void;
  /** Nesting depth for indentation */
  depth?: number;
}
