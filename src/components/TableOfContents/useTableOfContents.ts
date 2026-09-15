import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SeededHeading, TOCEntry } from './types';

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

interface Counted {
  element: HTMLElement;
  total: number;
  completed: number;
}

/**
 * The On this page list, seeded from the build and kept current by the
 * scanner. The list itself never changes on the client: the scan finds
 * the same headers by their static ids and adds the todo counts and the
 * elements the active-section observer watches. A header the build did
 * not list is ignored, so the list a reader saw before any script ran is
 * the list they keep.
 */
export function useTableOfContents(
  seeded: SeededHeading[],
  containerSelector: string = 'article'
) {
  const [counts, setCounts] = useState<Map<string, Counted>>(() => new Map());

  const scanDocument = useCallback(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

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

    const next = new Map<string, Counted>();

    allHeaders.forEach((header, index) => {
      const level: 'h2' | 'h3' | 'table' =
        header.tagName === 'H2' ? 'h2' : header.tagName === 'H3' ? 'h3' : 'table';

      // The static id (the build's heading ids, or an authored one on the
      // header or its parent) IS the id (one id system, SR3)
      const id = header.id || (header.parentElement as HTMLElement)?.id;
      if (!id) return;

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

      next.set(id, { element: header as HTMLElement, ...todoCount });
    });

    setCounts(next);
  }, [containerSelector]);

  // Initial scan after mount and React hydration
  useEffect(() => {
    // Wait for React components to hydrate
    const timeoutId = setTimeout(scanDocument, 100);
    window.addEventListener('load', scanDocument);

    // Re-scan when todos change. The event fires from the toggle handler
    // before React commits the checkbox to the DOM (checking hid this
    // behind the streak writes; unchecking read a stale checked state and
    // the counter never went down). Deferring one tick reads the DOM the
    // reader actually sees.
    const handleTodoChange = () => {
      setTimeout(scanDocument, 0);
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

  // The seeded list, with whatever the scan has added so far
  const entries = useMemo<TOCEntry[]>(
    () =>
      seeded.map((h) => {
        const counted = counts.get(h.id);
        return {
          ...h,
          element: counted?.element,
          interactiveCount: counted ? counted.total : h.interactiveCount,
          completedCount: counted ? counted.completed : 0,
        };
      }),
    [seeded, counts]
  );

  // Provide a manual rescan function
  const rescan = useCallback(() => {
    scanDocument();
  }, [scanDocument]);

  return { entries, rescan };
}

export default useTableOfContents;
