import { useMemo } from 'react';
import { useTableOfContents } from './useTableOfContents';
import { useActiveSection, scrollToSection } from './useActiveSection';
import { TableOfContentsItem } from './TableOfContentsItem';
import type { TableOfContentsProps, SectionProgress, TOCEntry } from './types';

/**
 * On this page: the page's section headers as a list, seeded from the
 * build so it is on the page before any script runs and identical after
 * hydration. Effects add the todo counts and the active item only; the
 * list never changes under the reader. Below md, CSS shows h2 rows only,
 * each carrying the counts of its h3 and band children rolled up, so the
 * rows still sum to the header.
 */
export function TableOfContents({
  moduleKey: _moduleKey, // Reserved for future progress tracking integration
  headings,
  containerSelector = 'article',
  className = '',
}: TableOfContentsProps) {
  const { entries } = useTableOfContents(headings, containerSelector);
  const activeId = useActiveSection(entries);

  const progressOf = (completed: number, total: number): SectionProgress => ({
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  });

  // Build progress map from entry data
  const progressMap = useMemo(() => {
    const map = new Map<string, SectionProgress>();
    entries.forEach((entry) => {
      if (entry.interactiveCount > 0) {
        map.set(entry.id, progressOf(entry.completedCount, entry.interactiveCount));
      }
    });
    return map;
  }, [entries]);

  // An h2 row's roll-up: its own counts plus every h3 and band row until the next h2
  const rollupMap = useMemo(() => {
    const map = new Map<string, SectionProgress>();
    entries.forEach((entry, i) => {
      if (entry.level !== 'h2') return;
      let total = entry.interactiveCount;
      let completed = entry.completedCount;
      for (let j = i + 1; j < entries.length && entries[j].level !== 'h2'; j++) {
        total += entries[j].interactiveCount;
        completed += entries[j].completedCount;
      }
      if (total > 0) map.set(entry.id, progressOf(completed, total));
    });
    return map;
  }, [entries]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    let total = 0;
    let completed = 0;
    entries.forEach((entry: TOCEntry) => {
      total += entry.interactiveCount;
      completed += entry.completedCount;
    });
    return progressOf(completed, total);
  }, [entries]);

  const handleItemClick = (id: string) => {
    scrollToSection(id);
  };

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

        <ol className="toc-list">
          {entries.map((entry) => (
            <TableOfContentsItem
              key={entry.id}
              entry={entry}
              isActive={activeId === entry.id}
              progress={progressMap.get(entry.id)}
              rollup={rollupMap.get(entry.id)}
              onClick={handleItemClick}
            />
          ))}
        </ol>
      </nav>
    </aside>
  );
}

export default TableOfContents;
