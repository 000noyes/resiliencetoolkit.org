import { useEffect, useState } from 'react';
import { getTodo, toggleTodo } from '@/lib/storage';

interface ChecklistRowProps {
  id: string;
  moduleKey: string;
  children: React.ReactNode;
  metadata?: {
    lastEditedBy?: string;
    lastEditedAt?: string;
  };
}

/**
 * ChecklistRow - Individual checklist item with enhanced styling
 *
 * Part of the Interactive Table design system. This is a specialized
 * version of the Todo component optimized for use within tables with
 * the design profile specifications.
 *
 * Features:
 * - Hover state with accent border
 * - Completed state with accent background (no strikethrough)
 * - Checkmark icon instead of default checkbox
 * - Optional metadata display
 * - Keyboard navigation support
 */
export default function ChecklistRow({
  id,
  moduleKey,
  children,
  metadata,
}: ChecklistRowProps) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadState() {
      try {
        const todo = await getTodo(moduleKey, id);
        setCompleted(todo?.completed ?? false);
      } catch (error) {
        console.error('Failed to load checklist row state:', error);
      } finally {
        setLoading(false);
      }
    }

    loadState();
  }, [id, moduleKey]);

  async function handleToggle() {
    try {
      const newCompleted = await toggleTodo(moduleKey, id);
      setCompleted(newCompleted);

      window.dispatchEvent(
        new CustomEvent('todo-changed', {
          detail: { moduleKey, id, completed: newCompleted },
        })
      );
    } catch (error) {
      console.error('Failed to toggle checklist row:', error);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleToggle();
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border animate-pulse"
        style={{ boxShadow: 'var(--shadow-ambient)' }}
      >
        <div className="w-5 h-5 bg-surface-muted rounded"></div>
        <div className="flex-1 h-4 bg-surface-muted rounded"></div>
      </div>
    );
  }

  return (
    <div
      role="checkbox"
      aria-checked={completed}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        completed
          ? 'bg-[var(--table-accent-subtle)] border-[var(--table-accent)]'
          : 'bg-transparent border-transparent hover:bg-[var(--table-surface-subtle)] hover:border-[var(--table-accent)]'
      }`}
      style={{
        transitionDuration: 'var(--motion-duration-base)',
        transitionTimingFunction: 'var(--motion-easing-standard)',
        minHeight: '44px', // WCAG touch target
      }}
    >
      <div className="relative flex items-center justify-center mt-0.5 w-8 h-8">
        <div
          className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
          style={{
            borderColor: completed
              ? 'var(--table-accent)'
              : 'var(--table-checkbox-border)',
            backgroundColor: completed
              ? 'var(--table-checkbox-fill)'
              : 'transparent',
            transitionDuration: 'var(--motion-duration-base)',
            transitionTimingFunction: 'var(--motion-easing-standard)',
          }}
        >
          {completed && (
            <svg
              className="w-4 h-4"
              style={{ color: '#ffffff' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-base transition-colors ${
            completed ? 'text-[var(--table-text-muted)]' : 'text-[var(--table-body)]'
          }`}
          style={{
            transitionDuration: 'var(--motion-duration-base)',
            transitionTimingFunction: 'var(--motion-easing-standard)',
          }}
        >
          {children}
        </div>
        {metadata && (metadata.lastEditedBy || metadata.lastEditedAt) && (
          <div
            className="text-xs mt-1"
            style={{ color: 'var(--table-text-muted)' }}
          >
            {metadata.lastEditedBy && (
              <span className="mr-2">Edited by {metadata.lastEditedBy}</span>
            )}
            {metadata.lastEditedAt && (
              <span>
                {new Date(metadata.lastEditedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
