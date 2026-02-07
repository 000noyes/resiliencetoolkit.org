import { useMemo } from 'react';
import { useTableOfContents } from './useTableOfContents';
import { useActiveSection, scrollToSection } from './useActiveSection';
import { TableOfContentsItem } from './TableOfContentsItem';
import type { TableOfContentsProps, SectionProgress } from './types';

/**
 * Wikipedia-style table of contents sidebar
 *
 * Features:
 * - Auto-detects headers (H2, H3) and table section headers
 * - Tracks active section on scroll
 * - Shows interactive element indicators
 * - Displays progress for sections with todos
 * - Smooth scroll navigation
 */
export function TableOfContents({
  moduleKey: _moduleKey, // Reserved for future progress tracking integration
  containerSelector = 'article',
  className = '',
}: TableOfContentsProps) {
  const { entries, isLoading } = useTableOfContents(containerSelector);
  const activeId = useActiveSection(entries);

  // Build progress map from entry data
  const progressMap = useMemo(() => {
    const map = new Map<string, SectionProgress>();
    entries.forEach((entry) => {
      if (entry.interactiveCount > 0) {
        map.set(entry.id, {
          completed: entry.completedCount,
          total: entry.interactiveCount,
          percentage:
            entry.interactiveCount > 0
              ? Math.round((entry.completedCount / entry.interactiveCount) * 100)
              : 0,
        });
      }
    });
    return map;
  }, [entries]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    let total = 0;
    let completed = 0;
    entries.forEach((entry) => {
      total += entry.interactiveCount;
      completed += entry.completedCount;
    });
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [entries]);

  const handleItemClick = (id: string) => {
    scrollToSection(id);
  };

  // Don't render if no entries found
  if (!isLoading && entries.length === 0) {
    return null;
  }

  return (
    <aside className={`toc-sidebar ${className}`}>
      <nav aria-label="Table of Contents">
        <header className="toc-header">
          <h2 className="toc-title">On this page</h2>
          {overallProgress.total > 0 && (
            <div className="toc-overall-progress">
              <div
                className="toc-progress-bar"
                style={{ '--progress': `${overallProgress.percentage}%` } as React.CSSProperties}
              >
                <div className="toc-progress-fill" />
              </div>
              <span className="toc-progress-text">
                {overallProgress.completed}/{overallProgress.total}
              </span>
            </div>
          )}
        </header>

        {isLoading ? (
          <div className="toc-loading">
            <span className="toc-loading-text">Loading...</span>
          </div>
        ) : (
          <ol className="toc-list">
            {entries.map((entry) => (
              <TableOfContentsItem
                key={entry.id}
                entry={entry}
                isActive={activeId === entry.id}
                progress={progressMap.get(entry.id)}
                onClick={handleItemClick}
              />
            ))}
          </ol>
        )}
      </nav>
    </aside>
  );
}

export default TableOfContents;
