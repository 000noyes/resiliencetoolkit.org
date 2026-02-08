import { useState, useEffect, useCallback } from 'react';
import { List, X } from 'lucide-react';
import { TableOfContents } from './TableOfContents';
import type { TableOfContentsMobileProps } from './types';

/**
 * Mobile table of contents with floating trigger and slide-in drawer
 *
 * Features:
 * - Floating action button (bottom-right)
 * - Slide-in drawer from left
 * - Backdrop blur overlay
 * - Closes on navigation or outside click
 * - Keyboard accessible (Escape to close)
 */
export function TableOfContentsMobile({
  moduleKey,
  containerSelector = 'article',
}: TableOfContentsMobileProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Wrap the original onClick to also close drawer
  const handleNavigation = useCallback(() => {
    // Small delay to allow scroll to start
    setTimeout(closeDrawer, 150);
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="toc-mobile-trigger"
        onClick={openDrawer}
        aria-label="Open table of contents"
        aria-expanded={isOpen}
        aria-controls="toc-mobile-drawer"
      >
        <List size={18} />
        <span>Contents</span>
      </button>

      {/* Backdrop */}
      <div
        className={`toc-mobile-backdrop ${isOpen ? 'toc-mobile-backdrop--visible' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        id="toc-mobile-drawer"
        className={`toc-mobile-drawer ${isOpen ? 'toc-mobile-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Table of Contents"
      >
        <header className="toc-mobile-header">
          <h2 className="toc-mobile-title">Contents</h2>
          <button
            className="toc-mobile-close"
            onClick={closeDrawer}
            aria-label="Close table of contents"
          >
            <X size={20} />
          </button>
        </header>

        <div className="toc-mobile-content" onClick={handleNavigation}>
          <TableOfContents
            moduleKey={moduleKey}
            containerSelector={containerSelector}
            className="toc-sidebar--mobile"
          />
        </div>
      </div>
    </>
  );
}

export default TableOfContentsMobile;
