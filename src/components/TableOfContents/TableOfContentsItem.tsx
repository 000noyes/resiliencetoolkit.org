import { CheckSquare } from 'lucide-react';
import type { TableOfContentsItemProps, SectionProgress } from './types';

/** The interactive badge and the count for one reading of a row */
function Meta({ progress, variant }: { progress?: SectionProgress; variant?: 'own' | 'rollup' }) {
  const modifier = variant ? ` toc-item-meta--${variant}` : '';
  return (
    <span className={`toc-item-meta${modifier}`}>
      {progress && progress.total > 0 && (
        <>
          <span
            className="toc-interactive-badge"
            title={`${progress.total} interactive item${progress.total !== 1 ? 's' : ''}`}
          >
            <CheckSquare size={12} />
          </span>
          <span
            className={`toc-progress ${progress.completed === progress.total ? 'toc-progress--complete' : ''}`}
            title={`${progress.completed} of ${progress.total} complete`}
          >
            {progress.completed}/{progress.total}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * Individual table of contents entry
 * Displays section title with optional interactive badge and progress.
 * An h2 row carries two readings of its counts: its own (md and above)
 * and the roll-up of its children (below md, where only h2 rows show).
 */
export function TableOfContentsItem({
  entry,
  isActive,
  progress,
  rollup,
  onClick,
}: TableOfContentsItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(entry.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(entry.id);
    }
  };

  // Determine CSS modifier classes based on level
  const levelClass = `toc-item--${entry.level}`; // toc-item--h2, toc-item--h3, or toc-item--table
  const isNested = entry.level === 'h3';

  return (
    <li className="toc-item-wrapper" data-level={entry.level}>
      <a
        href={`#${entry.id}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`toc-item ${levelClass} ${isActive ? 'toc-item--active' : ''} ${isNested ? 'toc-item--nested' : ''}`}
        aria-current={isActive ? 'location' : undefined}
      >
        <span className="toc-item-text">{entry.text}</span>

        {entry.level === 'h2' ? (
          <>
            <Meta progress={progress} variant="own" />
            <Meta progress={rollup} variant="rollup" />
          </>
        ) : (
          <Meta progress={progress} />
        )}
      </a>
    </li>
  );
}

export default TableOfContentsItem;
