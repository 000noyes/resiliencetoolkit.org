import { useState, useEffect, useRef, useCallback } from 'react';
import type { TOCEntry } from './types';

/**
 * Custom hook to track which section is currently visible
 * Uses Intersection Observer for efficient scroll tracking
 */
export function useActiveSection(entries: TOCEntry[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleSectionsRef = useRef<Set<string>>(new Set());

  // Debounce active section updates
  const updateActiveSection = useCallback(() => {
    const visible = visibleSectionsRef.current;

    if (visible.size === 0) {
      // If nothing visible, keep current or default to first
      if (!activeId && entries.length > 0) {
        setActiveId(entries[0].id);
      }
      return;
    }

    // Find the topmost visible section by document order
    for (const entry of entries) {
      if (visible.has(entry.id)) {
        setActiveId(entry.id);
        return;
      }
    }
  }, [entries, activeId]);

  useEffect(() => {
    if (entries.length === 0) return;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer with offset for natural feel
    // -20% from top means section becomes active when 20% from top
    // -60% from bottom means section stays active until 40% from bottom
    observerRef.current = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((entry) => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visibleSectionsRef.current.add(id);
          } else {
            visibleSectionsRef.current.delete(id);
          }
        });

        updateActiveSection();
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    // Observe all section elements
    entries.forEach((entry) => {
      if (entry.element) {
        observerRef.current?.observe(entry.element);
      }
    });

    // Set initial active section
    if (entries.length > 0 && !activeId) {
      setActiveId(entries[0].id);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [entries, updateActiveSection, activeId]);

  return activeId;
}

/**
 * Scrolls to a section with smooth behavior
 * Respects reduced motion preference
 */
export function scrollToSection(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const rootStyles = getComputedStyle(document.documentElement);
  const headerHeightValue = rootStyles.getPropertyValue('--header-height').trim();
  const headerHeight = parseInt(headerHeightValue, 10) || 0;
  const spacingOffset = 16; // matches scroll-margin padding
  const elementTop = element.getBoundingClientRect().top + window.scrollY;
  const target = Math.max(elementTop - headerHeight - spacingOffset, 0);

  window.scrollTo({
    top: target,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });

  // Update URL hash without scrolling (already scrolled)
  history.pushState(null, '', `#${id}`);
}

export default useActiveSection;
