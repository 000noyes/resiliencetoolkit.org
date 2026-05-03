import { useState, useEffect, useCallback } from 'react';
import type { TOCEntry } from './types';

/**
 * Generates a URL-safe slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Ensures unique IDs by appending numeric suffix if needed
 */
function ensureUniqueId(id: string, existingIds: Set<string>): string {
  if (!existingIds.has(id)) {
    existingIds.add(id);
    return id;
  }

  let counter = 2;
  while (existingIds.has(`${id}-${counter}`)) {
    counter++;
  }
  const uniqueId = `${id}-${counter}`;
  existingIds.add(uniqueId);
  return uniqueId;
}

/**
 * Determines if a heading element should be excluded because it belongs to UI chrome
 */
function isExcludedChrome(element: Element): boolean {
  return (
    !!element.closest('.external-link-modal') ||
    element.closest('[data-no-toc]') !== null
  );
}

/**
 * Checks if a strong element should be excluded from TOC
 * Returns true if the strong is an external link or contains only external links
 */
function isExternalLinkHeader(element: Element): boolean {
  if (isExcludedChrome(element)) {
    return true;
  }

  // Check if the strong is inside an external link anchor
  const parentAnchor = element.closest('a');
  if (parentAnchor) {
    const href = parentAnchor.getAttribute('href') || '';
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return true;
    }
  }

  // Check if the strong contains only anchor elements that are external links
  const childAnchors = element.querySelectorAll('a');
  if (childAnchors.length > 0) {
    // Get the text content without anchor text
    const clonedElement = element.cloneNode(true) as Element;
    clonedElement.querySelectorAll('a').forEach((a) => a.remove());
    const remainingText = clonedElement.textContent?.trim() || '';

    // If no remaining text after removing anchors, this is essentially just links
    if (remainingText === '') {
      // Check if all anchors are external
      const allExternal = Array.from(childAnchors).every((anchor) => {
        const href = anchor.getAttribute('href') || '';
        return href.startsWith('http://') || href.startsWith('https://');
      });
      if (allExternal) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Custom hook to detect and build table of contents from page headers
 */
export function useTableOfContents(containerSelector: string = 'article') {
  const [entries, setEntries] = useState<TOCEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const scanDocument = useCallback(() => {
    const container = document.querySelector(containerSelector);
    if (!container) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    const existingIds = new Set<string>();
    const tocEntries: TOCEntry[] = [];

    // Find all potential section headers
    const semanticHeaders = container.querySelectorAll('h2, h3');
    const tableHeaders = container.querySelectorAll(
      'table tr td[colspan] strong, table tr td:only-child strong'
    );

    // Filter out UI chrome (external link modals, explicit exclusions)
    const filteredSemanticHeaders = Array.from(semanticHeaders).filter(
      (header) => !isExcludedChrome(header)
    );
    const filteredTableHeaders = Array.from(tableHeaders).filter(
      (header) => !isExternalLinkHeader(header)
    );

    // Combine and sort by document position
    const allHeaders: Element[] = [
      ...filteredSemanticHeaders,
      ...filteredTableHeaders,
    ].sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    // Build entries
    allHeaders.forEach((header, index) => {
      const text = header.textContent?.trim() || '';
      if (!text) return;

      // Determine level
      let level: 'h2' | 'h3' | 'table';
      if (header.tagName === 'H2') {
        level = 'h2';
      } else if (header.tagName === 'H3') {
        level = 'h3';
      } else {
        level = 'table';
      }

      // Generate or use existing ID
      let id = header.id || (header.parentElement as HTMLElement)?.id;
      if (!id) {
        id = slugify(text);
      }
      id = ensureUniqueId(id, existingIds);

      // Apply ID to the element for navigation
      if (!header.id) {
        header.id = id;
      }

      // Find next section to scope Todo counting
      const nextHeader = allHeaders[index + 1] || null;

      // Count todos in this section
      const sectionRoot =
        level === 'table'
          ? header.closest('tr')?.nextElementSibling || header.parentElement
          : header.nextElementSibling;

      let todoCount = { total: 0, completed: 0 };

      if (sectionRoot) {
        // For table sections, count within the table structure
        if (level === 'table') {
          const row = header.closest('tr');
          if (row) {
            let currentRow = row.nextElementSibling;
            while (currentRow) {
              // Stop if we hit another section header
              const hasHeader = currentRow.querySelector(
                'td[colspan] strong, td:only-child strong'
              );
              if (hasHeader && currentRow !== row) break;

              const todos = currentRow.querySelectorAll('[data-module-key]');
              todos.forEach((todo) => {
                todoCount.total++;
                const checkbox = todo.querySelector(
                  'input[type="checkbox"]'
                ) as HTMLInputElement | null;
                if (checkbox?.checked) {
                  todoCount.completed++;
                }
              });

              currentRow = currentRow.nextElementSibling;
            }
          }
        } else {
          // For semantic headers, walk siblings
          let current: Element | null = header.nextElementSibling;
          while (current) {
            if (
              current.tagName === 'H2' ||
              current.tagName === 'H3' ||
              current === nextHeader
            ) {
              break;
            }

            const todos = current.querySelectorAll('[data-module-key]');
            todos.forEach((todo) => {
              todoCount.total++;
              const checkbox = todo.querySelector(
                'input[type="checkbox"]'
              ) as HTMLInputElement | null;
              if (checkbox?.checked) {
                todoCount.completed++;
              }
            });

            current = current.nextElementSibling;
          }
        }
      }

      tocEntries.push({
        id,
        text,
        level,
        element: header as HTMLElement,
        hasInteractive: todoCount.total > 0,
        interactiveCount: todoCount.total,
        completedCount: todoCount.completed,
        children: [],
      });
    });

    // Fallback: pages with no semantic headers and no table section headers
    // (e.g. 1-3, 1-5, 1-12, 1-13) would otherwise render no sidebar at all.
    // Synthesize a single "Top of page" entry pointing at the container so
    // the sidebar still surfaces and the layout column stays consistent.
    if (tocEntries.length === 0) {
      const containerEl = container as HTMLElement;
      if (!containerEl.id) {
        containerEl.id = 'toc-top';
      }
      tocEntries.push({
        id: containerEl.id,
        text: 'Top of page',
        level: 'h2',
        element: containerEl,
        hasInteractive: false,
        interactiveCount: 0,
        completedCount: 0,
        children: [],
      });
    }

    setEntries(tocEntries);
    setIsLoading(false);
  }, [containerSelector]);

  // Initial scan after mount and React hydration
  useEffect(() => {
    // Wait for React components to hydrate
    const timeoutId = setTimeout(scanDocument, 100);
    window.addEventListener('load', scanDocument);

    // Re-scan when todos change
    const handleTodoChange = () => {
      scanDocument();
    };

    document.addEventListener('todo-changed', handleTodoChange);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('todo-changed', handleTodoChange);
      window.removeEventListener('load', scanDocument);
    };
  }, [scanDocument]);

  // Observe DOM mutations inside the container so we can rescan when client-only components render
  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    let debounceId: number | null = null;
    const observer = new MutationObserver(() => {
      if (debounceId) {
        window.clearTimeout(debounceId);
      }
      debounceId = window.setTimeout(() => {
        scanDocument();
      }, 120);
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceId) {
        window.clearTimeout(debounceId);
      }
    };
  }, [containerSelector, scanDocument]);

  // Provide a manual rescan function
  const rescan = useCallback(() => {
    scanDocument();
  }, [scanDocument]);

  return { entries, isLoading, rescan };
}

export default useTableOfContents;
