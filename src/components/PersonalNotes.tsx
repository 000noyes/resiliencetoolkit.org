import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPersonalNotes, savePersonalNotes } from '@/lib/storage';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react';

interface PersonalNotesProps {
  className?: string;
}

/**
 * Collapsible personal notes section with auto-save
 */
export default function PersonalNotes({ className = '' }: PersonalNotesProps) {
  const [notes, setNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasNotes, setHasNotes] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notes on mount
  useEffect(() => {
    let mounted = true;

    async function loadNotes() {
      try {
        const savedNotes = await getPersonalNotes();
        if (mounted) {
          setNotes(savedNotes);
          setHasNotes(savedNotes.length > 0);
          // Auto-expand if notes exist
          if (savedNotes.length > 0) {
            setIsExpanded(true);
          }
        }
      } catch (error) {
        console.error('Failed to load personal notes:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadNotes();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && isExpanded) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [notes, isExpanded]);

  // Debounced save function
  const debouncedSave = useCallback((value: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await savePersonalNotes(value);
        setHasNotes(value.length > 0);
      } catch (error) {
        console.error('Failed to save notes:', error);
      } finally {
        setIsSaving(false);
      }
    }, 500); // 500ms debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    // Limit to 5000 characters
    if (value.length <= 5000) {
      setNotes(value);
      debouncedSave(value);
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden ${className}`}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StickyNote
            className={`w-5 h-5 ${
              hasNotes
                ? 'text-primary'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          />
          <span className="font-medium text-gray-900 dark:text-white">
            Personal Notes
          </span>
          {hasNotes && !isExpanded && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              ({notes.length} chars)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-gray-400">Saving...</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={handleNotesChange}
            placeholder="Write notes about your resilience planning..."
            className="w-full mt-4 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all"
            style={{ minHeight: '120px' }}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">
              Notes are saved automatically
            </p>
            <p className="text-xs text-gray-400">
              {notes.length}/5000
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
