/**
 * Table of Contents Component
 *
 * Wikipedia-style navigation sidebar for module pages.
 * Auto-detects headers and provides jumpable navigation with progress tracking.
 */

export { TableOfContents } from './TableOfContents';
export { TableOfContentsItem } from './TableOfContentsItem';
export { useTableOfContents } from './useTableOfContents';
export { useActiveSection, scrollToSection } from './useActiveSection';
export type {
  TOCEntry,
  SectionProgress,
  TableOfContentsProps,
  TableOfContentsItemProps,
} from './types';
