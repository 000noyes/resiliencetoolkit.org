import { CheckSquare } from 'lucide-react';
import type { TableOfContentsItemProps } from './types';

/**
 * Individual table of contents entry
 * Displays section title with optional interactive badge and progress
 */
export function TableOfContentsItem({
  entry,
  isActive,
  progress,
  onClick,
  depth = 0,
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
  const isNested = entry.level === 'h3' || depth > 0;

  return (
    <li className="toc-item-wrapper">
      <a
        href={`#${entry.id}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`toc-item ${levelClass} ${isActive ? 'toc-item--active' : ''} ${isNested ? 'toc-item--nested' : ''}`}
        aria-current={isActive ? 'location' : undefined}
      >
        <span className="toc-item-text">{entry.text}</span>

        <span className="toc-item-meta">
          {/* Interactive indicator */}
          {entry.hasInteractive && (
            <span
              className="toc-interactive-badge"
              title={`${entry.interactiveCount} interactive item${entry.interactiveCount !== 1 ? 's' : ''}`}
            >
              <CheckSquare size={12} />
            </span>
          )}

          {/* Progress indicator */}
          {progress && progress.total > 0 && (
            <span
              className={`toc-progress ${progress.completed === progress.total ? 'toc-progress--complete' : ''}`}
              title={`${progress.completed} of ${progress.total} complete`}
            >
              {progress.completed}/{progress.total}
            </span>
          )}
        </span>
      </a>

      {/* Render children if any */}
      {entry.children.length > 0 && (
        <ol className="toc-children">
          {entry.children.map((child) => (
            <TableOfContentsItem
              key={child.id}
              entry={child}
              isActive={isActive}
              onClick={onClick}
              depth={depth + 1}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

export default TableOfContentsItem;
