import React, { useEffect, useRef, useState } from 'react';
import { getTableRows, saveTableRow, initializeStorage } from '@/lib/storage';

export interface SlotCollectionProps {
  /** moduleKey for IndexedDB scoping (e.g. "knowing-community"). */
  moduleKey: string;
  /**
   * tableId for IndexedDB scoping. MUST be isolated from any sibling
   * DataTable's tableId on the same page — a collision pollutes both row
   * sets AND DataTable's seeding guard (DataTable.tsx loads via
   * getTableRows(moduleKey, tableId) and seeds only when savedRows.length === 0).
   */
  tableId: string;
  /** Workbook-asserted slot count. Required, no default. */
  count: number;
  /** Workbook-verbatim prompt text, rendered inside <legend>. */
  prompt: string;
  /**
   * Source-fidelity citation. Not rendered. Read by /verify-against-source
   * to trace the SlotCollection back to a spec in docs/source-specs/.
   */
  source?: string;
  /**
   * Name of the one-shot migration (key in initializeStorage's `migrations`
   * map) that populates this collection's data. If set, editing is gated on
   * THAT migration succeeding rather than on all migrations — so an unrelated
   * migration's failure does not disable this collection (codex round-6 P2).
   */
  requiredMigration?: string;
}

/** Per-slot rowId convention: 1-indexed to mirror workbook glyphs (1: 2: 3:). */
export function slotRowId(n: number): string {
  return `slot-${n}`;
}

/** DOM id for the per-slot <textarea>, paired with <label htmlFor>. */
export function slotTextareaId(moduleKey: string, tableId: string, n: number): string {
  return `slot-collection-${moduleKey}-${tableId}-slot-${n}`;
}

function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
}

export default function SlotCollection({
  moduleKey,
  tableId,
  count,
  prompt,
  requiredMigration,
}: SlotCollectionProps) {
  const [values, setValues] = useState<string[]>(() => Array(count).fill(''));
  const [loading, setLoading] = useState(true);
  // Set when migrations failed or the slot read threw. Keeps textareas
  // disabled so the user cannot type into slots whose backing data is
  // unknown — typing now and persisting on blur could clobber legacy bytes
  // a retried migration would otherwise recover (round-5 P1 #2).
  const [loadError, setLoadError] = useState(false);
  const savedValuesRef = useRef<string[]>(Array(count).fill(''));
  const containerRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // Wait for any pending one-shot migrations to complete before reading
        // slot state. Without this, an upgrading user can hydrate, see slot-1
        // empty, type into it, and clobber the migration's recovered legacy
        // bytes when their onBlur persists. The disabled-during-load guard
        // covers this entire window.
        //
        // initializeStorage swallows migration errors (so app startup never
        // breaks) but reports them via migrationsOk. If a migration failed,
        // do NOT enable editing: keep the slots disabled and show an error so
        // the user cannot type into a slot the migration will repopulate on
        // its next (retried) run. A refresh re-runs the migration.
        const { migrationsOk, migrations } = await initializeStorage();
        if (!mounted) return;
        // Gate on the specific migration this collection depends on, if one is
        // declared; otherwise fall back to "all migrations succeeded". This
        // prevents an unrelated migration's failure from disabling editing.
        const migrationFailed = requiredMigration
          ? migrations[requiredMigration] === false
          : !migrationsOk;
        if (migrationFailed) {
          setLoadError(true);
          return;
        }
        const rows = await getTableRows(moduleKey, tableId);
        if (!mounted) return;
        const next = Array(count).fill('');
        for (const row of rows) {
          const match = row.rowId.match(/^slot-(\d+)$/);
          if (!match) continue;
          const slotIndex = parseInt(match[1], 10) - 1;
          if (slotIndex < 0 || slotIndex >= count) continue;
          const data = row.data as { value?: unknown } | undefined;
          if (typeof data?.value === 'string') {
            next[slotIndex] = data.value;
          }
        }
        setValues(next);
        savedValuesRef.current = [...next];
      } catch (err) {
        console.error('[SlotCollection] load failed:', err);
        // A read failure leaves values blank; enabling editing would let a
        // blur overwrite saved-but-unread data. Keep slots disabled too.
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [moduleKey, tableId, count, requiredMigration]);

  // Auto-resize textareas once values are loaded.
  useEffect(() => {
    if (loading) return;
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll('textarea').forEach((t) => {
      autoResizeTextarea(t as HTMLTextAreaElement);
    });
  }, [loading]);

  async function persist(slotIndex: number, value: string) {
    // Skip no-op writes. A bare focus→blur (no typing) or an Escape-cancel
    // restores the value to what was last saved; persisting it would create
    // an accidental slot row (e.g. { value: '' } on a never-typed slot-1).
    // migratePlaceCharacteristicsRow0 treats slot-1 EXISTENCE as authoritative,
    // so an accidental empty row would later cause it to delete un-recovered
    // legacy bytes on a re-import. Only a real content change persists; this
    // keeps "slot exists" meaning "the user actually edited it" (round-5 P1 #1).
    if (value === savedValuesRef.current[slotIndex]) return;
    try {
      await saveTableRow({
        moduleKey,
        tableId,
        rowId: slotRowId(slotIndex + 1),
        data: { value },
      });
      savedValuesRef.current[slotIndex] = value;
    } catch (err) {
      console.error('[SlotCollection] save failed:', err);
    }
  }

  return (
    <fieldset
      ref={containerRef}
      data-slot-count={count}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--card)',
        margin: 'var(--spacing-lg) 0',
        minWidth: 0,
      }}
    >
      <legend
        style={{
          fontSize: '18px',
          fontWeight: 500,
          color: 'var(--foreground)',
          marginBottom: 'var(--spacing-md)',
          padding: '0 var(--spacing-xs)',
        }}
      >
        {prompt}
      </legend>

      {Array.from({ length: count }, (_, i) => {
        const slotNumber = i + 1;
        const id = slotTextareaId(moduleKey, tableId, slotNumber);
        const value = values[i] ?? '';
        const hasValue = value.trim().length > 0;
        const isLast = i === count - 1;
        return (
          <div
            key={i}
            style={{ marginBottom: isLast ? 0 : 'var(--spacing-md)' }}
          >
            <label
              htmlFor={id}
              style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--foreground)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              {slotNumber}:
            </label>
            <textarea
              id={id}
              value={value}
              placeholder={
                loading
                  ? 'Loading…'
                  : loadError
                    ? 'Could not load your saved responses. Refresh to try again.'
                    : 'Write your response...'
              }
              // Disable input while IndexedDB hydrates. Without this, a user
              // typing before the load resolves would have their in-progress
              // edits clobbered by the setValues(next) call when load
              // completes. Also stay disabled on loadError (migration/read
              // failure) so typing can't clobber data a retry would recover.
              disabled={loading || loadError}
              aria-busy={loading}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                setValues(next);
                autoResizeTextarea(e.target);
              }}
              onBlur={(e) => {
                persist(i, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  const saved = savedValuesRef.current[i] ?? '';
                  const next = [...values];
                  next[i] = saved;
                  setValues(next);
                  const ta = e.target as HTMLTextAreaElement;
                  // Synchronously assign the textarea DOM value to the
                  // saved string BEFORE blur fires. Without this, the
                  // synchronous onBlur reads e.target.value (which still
                  // holds the user's pre-Escape typed bytes because the
                  // setValues React update has not yet re-rendered),
                  // and persists the edit Escape was meant to discard.
                  ta.value = saved;
                  requestAnimationFrame(() => {
                    autoResizeTextarea(ta);
                  });
                  ta.blur();
                }
              }}
              onFocus={(e) => {
                e.target.style.outline = '2px solid var(--ring)';
                e.target.style.outlineOffset = '2px';
                e.target.style.backgroundColor = 'var(--background)';
              }}
              onBlurCapture={(e) => {
                const ta = e.target as HTMLTextAreaElement;
                ta.style.outline = 'none';
                ta.style.outlineOffset = '0';
                const hasContent = ta.value.trim().length > 0;
                ta.style.backgroundColor = hasContent ? 'var(--background)' : 'var(--muted)';
              }}
              style={{
                width: '100%',
                minHeight: 80,
                maxHeight: 400,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--spacing-sm)',
                fontSize: '16px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                color: 'var(--foreground)',
                backgroundColor: hasValue ? 'var(--background)' : 'var(--muted)',
                outline: 'none',
                resize: 'none',
                transition: 'background-color 200ms ease-out, border-color 120ms ease, outline 120ms ease',
                display: 'block',
                boxSizing: 'border-box',
              }}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
