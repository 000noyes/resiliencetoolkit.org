import React, { useEffect, useState } from 'react';
import { getTodo, toggleTodo } from '@/lib/storage';

interface TodoProps {
  id: string;
  moduleKey: string;
  children: React.ReactNode;
}

export default function Todo({ id, moduleKey, children }: TodoProps) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

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
        }
      `}</style>
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
      </label>
    </>
  );
}
