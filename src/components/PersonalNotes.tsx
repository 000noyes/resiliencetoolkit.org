import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPersonalNotes, savePersonalNotes } from '@/lib/storage';
import { FLUSH_WRITES_EVENT, type FlushWritesDetail } from '@/lib/flush-writes';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

  // Commit path shared by the debounce timer and the flush listener so the
  // two cannot drift.
  const commitNotes = useCallback(async (value: string) => {
    try {
      await savePersonalNotes(value);
      setHasNotes(value.length > 0);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced save function
  const debouncedSave = useCallback(
    (value: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        commitNotes(value);
      }, 500); // 500ms debounce
    },
    [commitNotes],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Latest notes value, readable from the flush listener without re-subscribing.
  const notesRef = useRef('');
  notesRef.current = notes;

  // Flush pending debounced save (service worker rotation, or tab hide while
  // an update is waiting): commit the pending value immediately instead of
  // waiting out the 500ms debounce, and report the save promise to the flush
  // collector so the rotation can wait for the commit.
  useEffect(() => {
    const onFlush = (event: Event) => {
      if (!saveTimeoutRef.current) return;
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      const save = commitNotes(notesRef.current);
      const detail = (event as CustomEvent<FlushWritesDetail>).detail;
      if (detail?.pending) detail.pending.push(save);
    };
    document.addEventListener(FLUSH_WRITES_EVENT, onFlush);
    return () => document.removeEventListener(FLUSH_WRITES_EVENT, onFlush);
  }, [commitNotes]);

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
        <div className="h-12 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <section aria-label="Notes" className={className}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-1.5 rounded hover:bg-muted transition-colors group"
        aria-expanded={isExpanded}
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
            Notes
          </span>
          {hasNotes && !isExpanded && (
            <span className="text-xs text-muted-foreground">{notes.length} chars</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {isSaving && <span className="text-xs text-muted-foreground">Saving...</span>}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2">
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={handleNotesChange}
            placeholder="Notes for your own reference"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all"
            style={{ minHeight: '120px' }}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">Saved automatically</p>
            <p className="text-xs text-muted-foreground">{notes.length}/5000</p>
          </div>
        </div>
      )}
    </section>
  );
}
