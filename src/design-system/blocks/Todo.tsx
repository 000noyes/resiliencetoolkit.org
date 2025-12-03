import React, { useEffect, useState } from 'react';
import { getTodo, toggleTodo, updateTodoNote } from '@/lib/storage';
import { StickyNote } from 'lucide-react';

interface TodoProps {
  id: string;
  moduleKey: string;
  children: React.ReactNode;
}

export default function Todo({ id, moduleKey, children }: TodoProps) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  // Shared size token to ensure perfect square
  const checkboxSize = '20px';

  useEffect(() => {
    let mounted = true;

    // Set a timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Todo loading timeout - falling back to unchecked state');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Load initial state from IndexedDB
    async function loadState() {
      try {
        const todo = await getTodo(moduleKey, id);
        if (mounted) {
          setCompleted(todo?.completed ?? false);
          setNote(todo?.notes ?? '');
          // Auto-expand if note exists
          if (todo?.notes) {
            setIsNoteExpanded(true);
          }
        }
      } catch (error) {
        console.error('Failed to load todo state:', error);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadState();

    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [id, moduleKey]);

  async function handleToggle() {
    try {
      const newCompleted = await toggleTodo(moduleKey, id);
      setCompleted(newCompleted);

      // Dispatch event for potential sync
      window.dispatchEvent(
        new CustomEvent('todo-changed', {
          detail: { moduleKey, id, completed: newCompleted },
        })
      );
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  }

  async function handleNoteChange(newNote: string) {
    try {
      setNote(newNote);
      await updateTodoNote(moduleKey, id, newNote);

      // Dispatch event for potential sync
      window.dispatchEvent(
        new CustomEvent('todo-note-changed', {
          detail: { moduleKey, id, note: newNote },
        })
      );
    } catch (error) {
      console.error('Failed to update todo note:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse">
        <div
          className="bg-gray-300 dark:bg-gray-600"
          style={{
            width: checkboxSize,
            height: checkboxSize,
            minWidth: checkboxSize,
            borderRadius: 'var(--radius-md)',
            aspectRatio: '1 / 1'
          }}
        ></div>
        <div className="flex-1 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .todo-item {
            break-inside: avoid;
            page-break-inside: avoid;
            padding: 2px 0 !important;
            border: none !important;
            background: transparent !important;
            margin: 2px 0;
          }

          .todo-checkbox-container {
            margin-top: 1px;
          }

          .todo-checkbox {
            -webkit-appearance: none;
            appearance: none;
            width: 14px !important;
            height: 14px !important;
            min-width: 14px !important;
            border: 2px solid #333 !important;
            border-radius: 2px !important;
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            position: relative;
          }

          .todo-checkbox:checked {
            background: white !important;
            border-color: #333 !important;
          }

          .todo-checkbox:checked::before {
            content: "✓";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 12px;
            font-weight: bold;
            color: #000;
          }

          .todo-checkmark-svg {
            display: none !important;
          }

          .todo-text {
            color: black !important;
            font-size: 10pt;
            line-height: 1.3;
          }

          .todo-text.completed {
            color: #666 !important;
          }

          .todo-note-button {
            display: none !important;
          }

          .todo-note-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .todo-note-textarea {
            border: 1px solid #333 !important;
            background: white !important;
            color: black !important;
            min-height: 40px;
            font-size: 9pt;
          }
        }
      `}</style>
      <div className="space-y-2">
        <label
          className={`todo-item group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-base ${
            completed
              ? 'bg-[var(--table-accent-subtle)] border-[var(--table-checkbox-fill)]'
              : 'bg-transparent border-transparent hover:bg-[var(--table-surface-subtle)] hover:border-[var(--table-checkbox-border)]'
          }`}
        >
          <div
            className="todo-checkbox-container relative flex items-center justify-center mt-0.5 flex-shrink-0"
            style={{
              width: checkboxSize,
              height: checkboxSize,
              minWidth: checkboxSize
            }}
          >
            <input
              type="checkbox"
              checked={completed}
              onChange={handleToggle}
              className={`todo-checkbox peer appearance-none cursor-pointer transition-all duration-base border-2 focus:ring-2 focus:ring-offset-2 focus:ring-[var(--table-focus-ring)] focus:ring-offset-[var(--surface)] ${
                completed
                  ? 'bg-[var(--table-checkbox-fill)] border-[var(--table-checkbox-fill)]'
                  : 'bg-[var(--surface)] border-[var(--table-checkbox-border)]'
              }`}
              style={{
                width: checkboxSize,
                height: checkboxSize,
                minWidth: checkboxSize,
                borderRadius: 'var(--radius-md)',
                aspectRatio: '1 / 1'
              }}
              aria-checked={completed}
            />
            {completed && (
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="todo-checkmark-svg absolute text-white pointer-events-none"
                aria-hidden="true"
                style={{
                  top: '50%',
                  left: '50%',
                  width: '20px',
                  height: '20px',
                  transform: 'translate(-50%, -50%) translateX(-3.6px)'
                }}
              >
                <path d="M6.2 10.6 9.1 13.4 13.8 7.2" />
              </svg>
            )}
          </div>
          <span
            className={`todo-text flex-1 text-base transition-colors duration-base ${
              completed ? 'completed text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {children}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsNoteExpanded(!isNoteExpanded);
            }}
            className={`todo-note-button ml-auto flex-shrink-0 p-2 rounded-md transition-all duration-default focus:outline-none focus:ring-2 focus:ring-[var(--table-focus-ring)] focus:ring-offset-2 ${
              note
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            aria-label={note ? 'Edit note' : 'Add note'}
            title={note ? 'Edit note' : 'Add note'}
          >
            <StickyNote size={20} strokeWidth={note ? 2.5 : 2} />
          </button>
        </label>

        {/* Note Section */}
        {isNoteExpanded && (
          <div className="todo-note-section ml-8 border border-border rounded-lg shadow-card bg-card p-md">
            <label
              htmlFor={`note-${moduleKey}-${id}`}
              className="block text-body-small font-medium text-text-secondary mb-xs"
            >
              Notes for this item:
            </label>
            <textarea
              id={`note-${moduleKey}-${id}`}
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Add your notes here..."
              rows={4}
              className="todo-note-textarea w-full px-sm py-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-input text-body text-foreground transition-all duration-default ease-default shadow-ambient resize-vertical"
            />
            <p className="mt-xs text-body-small text-text-muted">
              Notes are saved automatically
            </p>
          </div>
        )}
      </div>
    </>
  );
}
