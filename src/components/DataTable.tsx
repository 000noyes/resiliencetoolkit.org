/**
 * DataTable Component — Resilience Toolkit
 *
 * Replaces EditableTable with:
 * - Stacked vertical card layout on mobile (<640px), progressive disclosure for 5+ columns
 * - Table layout on desktop (768px+)
 * - Persistent "Saved just now" indicator per table
 * - Pre-populated readonly rows (rowId < 1000 convention)
 * - Add Row with scroll-to-new and auto-focus
 * - Delete Row with inline undo toast (5-second window)
 * - CSV export per table
 * - Loading skeleton, empty state, error states
 * - Full keyboard navigation and ARIA landmarks
 *
 * Uses existing IndexedDB storage layer (src/lib/storage.ts).
 * All colors from base.css design tokens (oklch color space).
 *
 * Note: EditableTable's per-table notes feature (localStorage key
 * `table-note-${moduleKey}-${tableId}`) was intentionally not ported.
 * Orphaned note data may remain in localStorage but is not displayed.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { getTableRows, saveTableRow, deleteTableRow, initializeStorage, type TableRow } from '@/lib/storage';
import { journalRowEdit, journalRowDelete, clearJournalRow, SAVE_DEBOUNCE_MS } from '@/lib/edit-journal';
import { useFlushOnHide } from '@/lib/useFlushOnHide';
import { reportStorageQuotaExceeded } from '@/lib/storageHealth';
import { FLUSH_WRITES_EVENT, dirtyRows, type FlushWritesDetail } from '@/lib/flush-writes';
import { SaveIndicator, type SaveState } from './SaveIndicator';
import { InfoCalloutBanner } from './InfoCalloutBanner';
import '@/lib/asset-rev'; // re-hash chunk past the 2026-06-07 Cloudflare asset-poisoning incident

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef {
  key: string;
  label: string;
  type?: 'text';
  readonly?: boolean;
  placeholder?: string;
  priority?: 1 | 2 | 3;
}

export interface PrePopulatedRow {
  rowId: string;
  data: Record<string, string>;
}

export interface DataTableProps {
  moduleKey: string;
  tableId: string;
  columns: ColumnDef[];
  initialRows?: PrePopulatedRow[];
  tableName: string;
  /** Whether to show the InfoCallout above the table (first table on page) */
  showInfoCallout?: boolean;
  /** 'table' (default) = spreadsheet grid; 'journal' = stacked prompt+textarea for reflection */
  variant?: 'table' | 'journal';
  /**
   * Source-fidelity citation. Not rendered. Read by /verify-against-source to
   * trace column headers to a spec in docs/source-specs/ or a PDF in
   * public/toolkit/ or rt-templates/. See .claude/skills/verify-against-source/SKILL.md.
   */
  source?: string;
  page?: string;
  /**
   * rowIds that must NEVER be rendered or edited in this table, even if they
   * still exist in storage. Used for rows that have been DEPRECATED in favor
   * of another component — e.g. place-characteristics `row-0` is owned by the
   * SlotCollection post-restore. A one-shot migration deletes such rows, but
   * until it succeeds (or after a re-import that resurrects one) the stale row
   * could otherwise render as an editable duplicate whose edits are later
   * discarded by the migration. Hiding it here closes that path regardless of
   * migration state (codex round-8 P1).
   */
  hiddenRowIds?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNDO_WINDOW_MS = 5000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pre-populated rows have rowId pattern row-0 through row-999 */
function isInitialRow(rowId: string): boolean {
  const match = rowId.match(/^row-(\d+)$/);
  if (!match) return false;
  return parseInt(match[1], 10) < 1000;
}

/** Generate a unique row ID using timestamp */
function generateRowId(): string {
  return `row-${Date.now()}`;
}

/** Escape CSV cell value */
function escapeCSVCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Auto-resize a textarea to fit its content */
function autoResizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
}

/** Convert tableName to kebab-case for filenames */
function toKebab(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

/** Generate self-contained HTML export for journal responses */
function formatHTMLExport(
  tableName: string,
  rows: { prompt: string; response: string }[],
): string {
  const entries = rows
    .map((r) => {
      const response = r.response.trim()
        ? `<p>${r.response.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`
        : `<p class="no-response">No response</p>`;
      return `<h3>${r.prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h3>\n${response}\n<hr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My Community Reflection — ${tableName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
<style>
body { font-family: 'Outfit', system-ui, -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 40px 24px; color: #333; background: #fff; }
h1 { font-size: 24px; font-weight: 600; margin-bottom: 32px; }
h3 { font-size: 18px; font-weight: 500; margin-bottom: 8px; }
p { font-size: 16px; font-weight: 400; line-height: 1.6; margin-bottom: 24px; }
.no-response { font-style: italic; color: #8a8a8a; }
hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
.footer { font-size: 14px; color: #8a8a8a; margin-top: 32px; }
</style>
</head>
<body>
<h1>My Community Reflection — ${tableName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
${entries}
<p class="footer">Exported from Resilience Hub Toolkit</p>
</body>
</html>`;
}

/** Inline SVG checkmark for completion indicators */
function CheckmarkIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--spacing-xs)' }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--destructive) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--destructive) 20%, transparent)',
        color: 'var(--destructive)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        marginBottom: 'var(--spacing-md)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none',
            border: '1px solid var(--destructive)',
            color: 'var(--destructive)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

function UndoToast({
  onUndo,
  onExpire,
}: {
  onUndo: () => void;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(UNDO_WINDOW_MS / 1000);
  const expireRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    expireRef.current = setTimeout(onExpire, UNDO_WINDOW_MS);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      clearTimeout(expireRef.current);
      clearInterval(interval);
    };
  }, [onExpire]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: 'var(--muted)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-sm)',
        fontSize: '14px',
        color: 'var(--foreground)',
      }}
    >
      <span>Row deleted. ({remaining}s)</span>
      <button
        onClick={() => {
          clearTimeout(expireRef.current);
          onUndo();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          fontFamily: 'var(--font-sans)',
          padding: '2px 8px',
        }}
      >
        Undo
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton({ columns }: { columns: ColumnDef[] }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        backgroundColor: 'var(--card)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'color-mix(in srgb, var(--ring) 5%, transparent)',
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm) var(--spacing-md)',
              fontWeight: 500,
              fontSize: '14px',
              color: 'var(--foreground)',
            }}
          >
            {col.label}
          </div>
        ))}
      </div>
      {/* Skeleton rows */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
            padding: 'var(--spacing-sm) var(--spacing-md)',
          }}
        >
          {columns.map((col) => (
            <div key={col.key} style={{ flex: 1, padding: '0 var(--spacing-xs)' }}>
              <div
                className="animate-pulse"
                style={{
                  height: 20,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--muted)',
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function JournalLoadingSkeleton() {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--card)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            marginBottom: i < 2 ? 'var(--spacing-md)' : 0,
          }}
        >
          <div
            className="animate-pulse"
            style={{
              height: 16,
              width: '60%',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--muted)',
              marginBottom: 'var(--spacing-xs)',
            }}
          />
          <div
            className="animate-pulse"
            style={{
              height: 80,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--muted)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Singleton responsive styles (injected once regardless of instance count)
// ---------------------------------------------------------------------------

const DT_STYLE_ID = 'dt-responsive-styles';
const DT_CSS = `
.dt-desktop-table { display: block; }
.dt-mobile-cards { display: none; }
@media (max-width: 767px) {
  .dt-desktop-table { display: none !important; }
  .dt-mobile-cards { display: block !important; }
}
@media print {
  .dt-mobile-cards { display: none !important; }
  .dt-desktop-table { display: block !important; }
  .dt-desktop-table table { box-shadow: none; }
  .dt-desktop-table th, .dt-desktop-table td {
    border: 1px solid #333 !important;
    padding: 6px 10px !important;
  }
  .dt-desktop-table th {
    font-weight: bold !important;
    background-color: #f0f0f0 !important;
  }
  .dt-desktop-table [role="status"],
  .dt-desktop-table button,
  .dt-mobile-cards button {
    display: none !important;
  }
}`;

function DataTableStyles() {
  useEffect(() => {
    if (document.getElementById(DT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DT_STYLE_ID;
    style.textContent = DT_CSS;
    document.head.appendChild(style);
  }, []);
  return null;
}

const DT_JOURNAL_PRINT_ID = 'dt-journal-print-styles';
const DT_JOURNAL_PRINT_CSS = `
@media (max-width: 640px) {
  .dt-journal { padding: var(--spacing-md) !important; }
}
@media print {
  .dt-journal textarea { display: none; }
  .dt-journal .print-response { display: block !important; }
  .dt-journal .dt-journal-footer { display: none; }
  .dt-journal { color: #333 !important; background: #fff !important; }
  .dt-journal * { color: #333 !important; background: #fff !important; }
  .dt-journal .dt-journal-entry { break-inside: avoid; }
  @page { margin: 1in; }
}`;

function JournalPrintStyles() {
  useEffect(() => {
    if (document.getElementById(DT_JOURNAL_PRINT_ID)) return;
    const style = document.createElement('style');
    style.id = DT_JOURNAL_PRINT_ID;
    style.textContent = DT_JOURNAL_PRINT_CSS;
    document.head.appendChild(style);
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DataTable({
  moduleKey,
  tableId,
  columns,
  initialRows = [],
  tableName,
  showInfoCallout = false,
  variant = 'table',
  hiddenRowIds,
}: DataTableProps) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [pendingDelete, setPendingDelete] = useState<{
    row: TableRow;
    index: number;
  } | null>(null);
  const [idbAvailable, setIdbAvailable] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const newRowRef = useRef<HTMLElement | null>(null);
  // One SHARED debounce timer. On its own a shared timer would let an edit to
  // row B cancel row A's still-pending IDB write (browser autofill can touch
  // several rows without blur events), so the timer callback never trusts its
  // own row: it sweeps EVERY dirty row against its saved copy and commits the
  // stragglers too.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const addRowLockRef = useRef(false);
  const savedRowsRef = useRef<TableRow[]>([]);
  // Authoritative, synchronously-updated mirror of `rows`. saveCell reads and
  // writes it so two edits to different columns of the same row in one batch
  // (e.g. browser autofill of name + phone + email) both survive; building the
  // saved/journaled row from the render closure would drop all but the last.
  const liveRowsRef = useRef<TableRow[]>([]);
  const journalContainerRef = useRef<HTMLDivElement>(null);

  // Determine which columns are priority 1
  const priorityCols = columns.filter((c) => (c.priority ?? 1) === 1).slice(0, 3);
  const needsDisclosure = columns.length > 4;

  // Journal variant: derive prompt (readonly) and response (editable) columns
  const isJournal = variant === 'journal';
  const readonlyCols = columns.filter((c) => c.readonly);
  const editableCols = columns.filter((c) => !c.readonly);
  const journalValid = readonlyCols.length === 1 && editableCols.length === 1;
  if (isJournal && !journalValid) {
    console.error(
      `DataTable journal variant requires exactly 1 readonly + 1 editable column, got ${readonlyCols.length} readonly + ${editableCols.length} editable`,
    );
  }
  const promptCol = readonlyCols[0];
  const responseCol = editableCols[0];
  // Effective variant: fall back to table if column structure is invalid
  const effectiveVariant = isJournal && journalValid ? 'journal' : 'table';

  // Auto-resize textareas on data load (journal variant)
  useEffect(() => {
    if (effectiveVariant !== 'journal' || loading) return;
    const container = journalContainerRef.current;
    if (!container) return;
    const textareas = container.querySelectorAll<HTMLTextAreaElement>('textarea');
    textareas.forEach(autoResizeTextarea);
  }, [effectiveVariant, loading, rows]);

  // ResizeObserver for journal container — re-run auto-resize on width changes
  useEffect(() => {
    if (effectiveVariant !== 'journal') return;
    const container = journalContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const textareas = container.querySelectorAll<HTMLTextAreaElement>('textarea');
      textareas.forEach(autoResizeTextarea);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [effectiveVariant]);

  // -----------------------------------------------------------------------
  // Load data
  // -----------------------------------------------------------------------
  const loadData = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        setIdbAvailable(false);
        setLoading(false);
        return;
      }

      // Wait for one-shot migrations to complete before reading rows. A
      // migration may delete or rewrite rows in this table (e.g. the
      // place-characteristics row-0 → SlotCollection restore deletes row-0).
      // Without this await, DataTable can hydrate a stale row that the
      // migration is about to remove, render it, and let a user edit re-save
      // (resurrect) it after the migration's marker is set. initializeStorage
      // is idempotent and marker-gated, so this is cheap after the first call.
      await initializeStorage();

      const allSavedRows = await getTableRows(moduleKey, tableId);
      // Drop deprecated rows that must never render (e.g. place-characteristics
      // row-0, owned by the SlotCollection post-restore). Filtering here means
      // a stale/resurrected row is never editable, regardless of whether its
      // one-shot migration has run yet (codex round-8 P1). The empty-check
      // below uses the VISIBLE set so a table holding only hidden rows still
      // re-seeds its initialRows instead of rendering blank.
      //
      // initialRows is filtered the SAME way: a hidden rowId present in both
      // savedRows and initialRows must not slip back in via the seed path, or
      // the "never rendered/edited" contract would break on a cleared table
      // (codex round-9 P2). Hidden rows therefore never enter `rows` state, so
      // the edit/delete/add handlers — which only operate on `rows` — can
      // never touch them; no separate handler guard is needed.
      const savedRows = hiddenRowIds?.length
        ? allSavedRows.filter((r) => !hiddenRowIds.includes(r.rowId))
        : allSavedRows;
      const visibleInitialRows = hiddenRowIds?.length
        ? initialRows.filter((r) => !hiddenRowIds.includes(r.rowId))
        : initialRows;

      if (savedRows.length === 0 && visibleInitialRows.length > 0) {
        const newRows: TableRow[] = visibleInitialRows.map((init) => ({
          id: `${moduleKey}-${tableId}-${init.rowId}`,
          moduleKey,
          tableId,
          rowId: init.rowId,
          data: init.data,
          updatedAt: new Date().toISOString(),
        }));

        for (const row of newRows) {
          await saveTableRow({
            moduleKey: row.moduleKey,
            tableId: row.tableId,
            rowId: row.rowId,
            data: row.data,
          });
        }
        setRows(newRows);
        savedRowsRef.current = newRows;
      } else {
        setRows(savedRows);
        savedRowsRef.current = savedRows;
      }

      setError(null);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'UpgradeBlockedError'
          ? 'Another tab is updating. Please reload this page.'
          : 'Could not load your saved data. Your data is still on your device.';
      setError(msg);
      console.error('[DataTable] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, tableId, initialRows, hiddenRowIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep the synchronous mirror in step with committed state (add / delete /
  // undo / load). saveCell also updates it synchronously mid-batch.
  useEffect(() => {
    liveRowsRef.current = rows;
  }, [rows]);

  // -----------------------------------------------------------------------
  // Commit one row to IndexedDB with the FULL save semantics (indicator,
  // dashboard notification, trust-ack, quota handling). Both the debounce
  // timer and the flush listener go through here so the two paths cannot
  // drift.
  // -----------------------------------------------------------------------
  const commitRow = useCallback(
    async (row: TableRow) => {
      try {
        await saveTableRow({
          moduleKey: row.moduleKey,
          tableId: row.tableId,
          rowId: row.rowId,
          data: row.data,
        });
        savedRowsRef.current = savedRowsRef.current.map((r) =>
          r.rowId === row.rowId ? row : r,
        );
        // Durable in IDB now, so drop the journal backstop for this row,
        // UNLESS a newer keystroke was journaled while this save was in
        // flight (the conditional keeps that newer backstop alive).
        clearJournalRow(row.moduleKey, row.tableId, row.rowId, row.updatedAt);
        setSaveState({ status: 'saved', at: new Date() });

        // Notify dashboard/streak components
        document.dispatchEvent(
          new CustomEvent('table-changed', {
            detail: { moduleKey, tableId, rowId: row.rowId },
          }),
        );

        // Mark trust acknowledged on first save
        try {
          localStorage.setItem('rt-trust-acknowledged', 'true');
        } catch {
          // ignore
        }
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === 'QuotaExceededError' || err.code === 22)
        ) {
          setQuotaExceeded(true);
          reportStorageQuotaExceeded();
          setSaveState({
            status: 'error',
            message: 'Device storage is full. You can export your data but cannot add new entries.',
          });
        } else if (err instanceof DOMException && err.name === 'UpgradeBlockedError') {
          setSaveState({
            status: 'error',
            message: 'Another tab is updating. Please reload this page.',
          });
        } else {
          setSaveState({
            status: 'error',
            message: 'Could not save. Please try again.',
          });
        }
        console.error('[DataTable] Save error:', err);
        throw err;
      }
    },
    [moduleKey, tableId],
  );

  // -----------------------------------------------------------------------
  // Save cell
  // -----------------------------------------------------------------------
  const saveCell = useCallback(
    async (rowId: string, columnKey: string, value: string, immediate = false) => {
      // Merge onto the LIVE mirror, not the render closure, so a second edit to
      // a different column of the same row in the same batch does not drop the
      // first column's value from the saved/journaled row.
      const base = liveRowsRef.current;
      const idx = base.findIndex((r) => r.rowId === rowId);
      if (idx === -1) return;

      // Prevent editing readonly columns on pre-populated rows
      const colDef = columns.find((c) => c.key === columnKey);
      if (colDef?.readonly && isInitialRow(rowId)) return;

      const updatedRow: TableRow = {
        ...base[idx],
        data: { ...base[idx].data, [columnKey]: value },
        updatedAt: new Date().toISOString(),
      };
      // Update the mirror synchronously so a same-batch sibling edit builds on
      // this value; render with a functional merge of the single column.
      liveRowsRef.current = base.map((r, i) => (i === idx ? updatedRow : r));
      setRows((prev) =>
        prev.map((r) =>
          r.rowId === rowId
            ? { ...r, data: { ...r.data, [columnKey]: value }, updatedAt: updatedRow.updatedAt }
            : r,
        ),
      );

      // Synchronous journal FIRST, before the async IDB write. This captures
      // the edit even if the tab is killed before the debounced write fires or
      // if IDB is full — the flood-grade durability backstop.
      journalRowEdit(updatedRow);

      // If storage is full we still keep the edit on screen and in the journal,
      // but there is no point scheduling an IDB write that will throw.
      if (quotaExceeded) return;

      clearTimeout(saveTimerRef.current);
      setSaveState({ status: 'saving' });

      // The sweep commits EVERY dirty row, not just this one: the shared
      // timer means an edit to another row inside the window silently
      // cancelled that row's save while the indicator already showed Saved.
      // Rows come from the synchronously updated live mirror, so a blur-time
      // (immediate) sweep sees THIS edit before any re-render, and commitRow
      // drops each row's journal backstop only after its IDB write is durable.
      const sweepDirty = async () => {
        await Promise.all(
          dirtyRows(liveRowsRef.current, savedRowsRef.current).map((row) =>
            commitRow(row).catch(() => {
              // Error state already surfaced by commitRow.
            }),
          ),
        );
      };

      // Blur = immediate save; typing (onChange) = debounced save-on-change.
      // Either way the journal above already holds the edit.
      if (immediate) {
        await sweepDirty();
      } else {
        saveTimerRef.current = setTimeout(() => {
          void sweepDirty();
        }, SAVE_DEBOUNCE_MS);
      }
    },
    [columns, quotaExceeded, commitRow],
  );

  // Last-resort flush: persist any dirty rows when the tab is hidden/closed.
  // Every edit was already journaled synchronously on change, so this is a
  // best-effort net for the pending debounced sweep, not the guarantee. It
  // routes through commitRow, like the debounce and rotation-flush paths, so
  // the journal backstop is only dropped after a durable IDB write.
  const flushDirtyOnHide = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    for (const row of dirtyRows(liveRowsRef.current, savedRowsRef.current)) {
      commitRow(row).catch(() => {
        // Best-effort on unload; the journal remains the durable record.
      });
    }
  }, [commitRow]);
  useFlushOnHide(flushDirtyOnHide);

  // Escape = discard the in-progress edit of ONE cell and restore its
  // last-saved value. Restores only the escaped COLUMN: other columns of the
  // same row can hold legitimate pending edits (browser autofill fills several
  // columns mid-debounce), and a whole-row restore would silently revert them
  // and drop their journal backstop.
  //
  // The caller blur()s the element right after this, and that blur fires a
  // synchronous immediate saveCell of the restored value. saveCell merges onto
  // the live mirror (keeping the other columns' pending edits), cancels the
  // pending debounced sweep, journals the merged row, and commits it, so the
  // discarded value can neither persist nor replay, without touching the
  // rest of the row.
  const restoreCellFromSaved = useCallback(
    (rowId: string, columnKey: string, el: HTMLInputElement | HTMLTextAreaElement) => {
      const saved = savedRowsRef.current.find((r) => r.rowId === rowId);
      if (!saved) return;
      const savedValue = saved.data[columnKey] ?? '';
      const restoreCol = (r: TableRow) =>
        r.rowId === rowId ? { ...r, data: { ...r.data, [columnKey]: savedValue } } : r;
      setRows((prev) => prev.map(restoreCol));
      liveRowsRef.current = liveRowsRef.current.map(restoreCol);
      // Restore the DOM value BEFORE the blur fires, so the blur-save reads
      // the saved value, not the discarded one.
      el.value = savedValue;
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Add row
  // -----------------------------------------------------------------------
  const addRow = useCallback(async () => {
    if (addRowLockRef.current || quotaExceeded) return;
    addRowLockRef.current = true;

    try {
      const newRowId = generateRowId();
      const emptyData: Record<string, string> = {};
      for (const col of columns) {
        emptyData[col.key] = '';
      }

      const newRow: TableRow = {
        id: `${moduleKey}-${tableId}-${newRowId}`,
        moduleKey,
        tableId,
        rowId: newRowId,
        data: emptyData,
        updatedAt: new Date().toISOString(),
      };

      await saveTableRow({
        moduleKey: newRow.moduleKey,
        tableId: newRow.tableId,
        rowId: newRow.rowId,
        data: newRow.data,
      });
      savedRowsRef.current = [...savedRowsRef.current, newRow];
      setRows((prev) => [...prev, newRow]);
      setSaveState({ status: 'saved', at: new Date() });

      // Notify dashboard/streak components
      document.dispatchEvent(
        new CustomEvent('table-changed', {
          detail: { moduleKey, tableId, rowId: newRowId },
        }),
      );

      // Mark trust acknowledged
      try {
        localStorage.setItem('rt-trust-acknowledged', 'true');
      } catch {
        // ignore
      }

      // Scroll to new row after render
      requestAnimationFrame(() => {
        if (newRowRef.current) {
          newRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Auto-focus first editable input
          const input = newRowRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'input, textarea',
          );
          input?.focus();
        }
        addRowLockRef.current = false;
      });
    } catch (err) {
      addRowLockRef.current = false;
      if (
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22)
      ) {
        setQuotaExceeded(true);
        reportStorageQuotaExceeded();
        setSaveState({
          status: 'error',
          message: 'Device storage is full.',
        });
      }
      console.error('[DataTable] Add row error:', err);
    }
  }, [moduleKey, tableId, columns, quotaExceeded]);

  // -----------------------------------------------------------------------
  // Delete row
  // -----------------------------------------------------------------------
  // The actual IDB delete + journal tombstone for one row. Shared by the
  // undo-toast expiry and by startDelete when a SECOND delete arrives while
  // the first is still in its undo window.
  const commitDelete = useCallback(
    async (rowId: string) => {
      // No per-row save to cancel here: the shared debounce sweep reads the
      // live rows at fire time, and startDelete already removed this row from
      // them, so a pending sweep cannot re-save it after the delete.
      const ts = new Date().toISOString();
      // Tombstone the journal synchronously BEFORE the async IDB delete. This
      // replaces any pending edit entry for the row, so replay-on-load can never
      // resurrect a row the user deleted (the resurrection class the reconcile
      // test guards).
      journalRowDelete(moduleKey, tableId, rowId, ts);
      try {
        await deleteTableRow(moduleKey, tableId, rowId);
        savedRowsRef.current = savedRowsRef.current.filter((r) => r.rowId !== rowId);
        clearJournalRow(moduleKey, tableId, rowId, ts);
      } catch (err) {
        // Leave the tombstone in the journal so the delete replays next load.
        console.error('[DataTable] Delete error:', err);
      }
    },
    [moduleKey, tableId],
  );

  const startDelete = useCallback(
    (rowId: string) => {
      const idx = rows.findIndex((r) => r.rowId === rowId);
      if (idx === -1) return;
      const row = rows[idx];

      // Don't allow deleting readonly pre-populated rows
      if (isInitialRow(rowId)) return;

      // A second delete while another row's undo toast is still open would
      // otherwise REPLACE pendingDelete and the first row would never be
      // deleted from IndexedDB — it silently reappears on the next load.
      // Commit the first delete now; its undo window ends here.
      if (pendingDelete) {
        void commitDelete(pendingDelete.row.rowId);
      }

      setPendingDelete({ row, index: idx });
      setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    },
    [rows, pendingDelete, commitDelete],
  );

  // If the tab closes or navigates away while an undo toast is open, the
  // pending delete is deliberately NOT committed: the row reappears on the
  // next load. Resurrection is the fail-safe direction for this app; silently
  // finalizing a delete the user might have undone is not.
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await commitDelete(pendingDelete.row.rowId);
    setPendingDelete(null);
  }, [pendingDelete, commitDelete]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(pendingDelete.index, 0, pendingDelete.row);
      return copy;
    });
    setPendingDelete(null);
  }, [pendingDelete]);

  // -----------------------------------------------------------------------
  // Flush pending state (service worker rotation, or tab hide while an
  // update is waiting). Commits every dirty row through commitRow (full
  // save semantics) and FINALIZES a pending undo-delete — a rotation reload
  // before the 5s undo window expires would otherwise resurrect the row.
  // Initiated save promises are pushed into the flush event's collector so
  // the rotation can wait for the actual IndexedDB commits.
  // -----------------------------------------------------------------------
  const commitRowRef = useRef(commitRow);
  commitRowRef.current = commitRow;
  const confirmDeleteRef = useRef(confirmDelete);
  confirmDeleteRef.current = confirmDelete;
  const hasPendingDeleteRef = useRef(false);
  hasPendingDeleteRef.current = pendingDelete !== null;

  useEffect(() => {
    const onFlush = (event: Event) => {
      clearTimeout(saveTimerRef.current);
      const pending: Promise<unknown>[] = [];
      // Sweep the same synchronously updated live mirror as the debounce and
      // hide paths. The flush contract blurs the focused editor first, and
      // that blur-save lands in the mirror before this event fires; sweeping
      // render state here could commit a stale copy of the same row and then
      // clear the newer journal entry.
      for (const row of dirtyRows(liveRowsRef.current, savedRowsRef.current)) {
        pending.push(
          commitRowRef.current(row).catch(() => {
            // Error state already surfaced by commitRow.
          }),
        );
      }
      if (hasPendingDeleteRef.current) {
        pending.push(Promise.resolve(confirmDeleteRef.current()).catch(() => {}));
      }
      const detail = (event as CustomEvent<FlushWritesDetail>).detail;
      if (detail?.pending) detail.pending.push(...pending);
    };
    document.addEventListener(FLUSH_WRITES_EVENT, onFlush);
    return () => document.removeEventListener(FLUSH_WRITES_EVENT, onFlush);
  }, []);

  // -----------------------------------------------------------------------
  // CSV export
  // -----------------------------------------------------------------------
  const exportCSV = useCallback(() => {
    const headerLine = columns.map((c) => escapeCSVCell(c.label)).join(',');
    const dataLines = rows.map((row) =>
      columns.map((c) => escapeCSVCell(row.data[c.key] || '')).join(','),
    );
    const csv = '\uFEFF' + [headerLine, ...dataLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `${tableName.toLowerCase().replace(/\s+/g, '-')}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, columns, tableName]);

  // -----------------------------------------------------------------------
  // HTML export (journal variant)
  // -----------------------------------------------------------------------
  const exportHTML = useCallback(() => {
    if (!promptCol || !responseCol) return;
    const entries = rows.map((row) => ({
      prompt: row.data[promptCol.key] || '',
      response: row.data[responseCol.key] || '',
    }));
    const html = formatHTMLExport(tableName, entries);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resilience-toolkit-${toKebab(tableName)}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [rows, promptCol, responseCol, tableName]);

  // -----------------------------------------------------------------------
  // Journal counter
  // -----------------------------------------------------------------------
  const journalAnswered = effectiveVariant === 'journal' && responseCol
    ? rows.filter((r) => (r.data[responseCol.key] || '').trim().length > 0).length
    : 0;
  const journalTotal = effectiveVariant === 'journal' ? rows.length : 0;
  const journalComplete = journalTotal > 0 && journalAnswered === journalTotal;

  // -----------------------------------------------------------------------
  // Row count for pre-populated tables
  // -----------------------------------------------------------------------
  const totalPrepopulated = initialRows.length;
  const filledCount = totalPrepopulated > 0
    ? rows.filter((r) => {
        if (!isInitialRow(r.rowId)) return false;
        // Count as filled if any non-readonly column has content
        return columns.some(
          (c) => !(c.readonly && isInitialRow(r.rowId)) && r.data[c.key]?.trim(),
        );
      }).length
    : 0;

  // -----------------------------------------------------------------------
  // IDB unavailable
  // -----------------------------------------------------------------------
  if (!idbAvailable) {
    return (
      <div style={{ margin: 'var(--spacing-lg) 0' }}>
        {showInfoCallout && <InfoCalloutBanner />}
        <ErrorBanner message="This feature requires a modern browser with IndexedDB support." />
        {/* Render pre-populated rows as static read-only */}
        {initialRows.length > 0 && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        textAlign: 'left',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'var(--foreground)',
                        backgroundColor: 'color-mix(in srgb, var(--ring) 5%, transparent)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialRows.map((row) => (
                  <tr key={row.rowId}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: 'var(--spacing-sm) var(--spacing-md)',
                          backgroundColor: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {row.data[col.key] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{ margin: 'var(--spacing-lg) 0' }}>
        {showInfoCallout && <InfoCalloutBanner />}
        {effectiveVariant === 'journal' ? <JournalLoadingSkeleton /> : <LoadingSkeleton columns={columns} />}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const hasRows = rows.length > 0;

  // -----------------------------------------------------------------------
  // JOURNAL VARIANT RENDER
  // -----------------------------------------------------------------------
  if (effectiveVariant === 'journal' && promptCol && responseCol) {
    return (
      <div ref={containerRef} style={{ margin: 'var(--spacing-lg) 0' }}>
        {showInfoCallout && <InfoCalloutBanner />}

        {error && <ErrorBanner message={error} onRetry={loadData} />}

        {quotaExceeded && !error && (
          <ErrorBanner message="Device storage is full. You can export your data but cannot add new entries." />
        )}

        {/* Journal container — no green header bar, no role="grid" */}
        <div
          ref={journalContainerRef}
          className="dt-journal"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--card)',
          }}
        >
          {/* Table name with completion checkmark */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              {journalComplete && <CheckmarkIcon />}
              {tableName}
            </span>
          </div>

          {/* Journal entries */}
          {rows.map((row, idx) => {
            const promptValue = row.data[promptCol.key] || '';
            const responseValue = row.data[responseCol.key] || '';
            const textareaId = `dt-journal-${tableId}-${row.rowId}`;
            const hasResponse = responseValue.trim().length > 0;

            return (
              <div
                key={row.rowId}
                className="dt-journal-entry"
                style={{
                  paddingBottom: idx < rows.length - 1 ? 'var(--spacing-lg)' : 0,
                  marginBottom: idx < rows.length - 1 ? 'var(--spacing-lg)' : 0,
                  borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <label
                  htmlFor={textareaId}
                  style={{
                    display: 'block',
                    fontSize: '16px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  {promptValue}
                </label>
                <textarea
                  id={textareaId}
                  value={responseValue}
                  placeholder="Write your response..."
                  onChange={(e) => {
                    // Save-on-change (debounced) + synchronous journal, so a
                    // type-then-close without blur cannot lose the edit.
                    saveCell(row.rowId, responseCol.key, e.target.value);
                    autoResizeTextarea(e.target);
                  }}
                  onBlur={(e) => saveCell(row.rowId, responseCol.key, e.target.value, true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      restoreCellFromSaved(row.rowId, responseCol.key, e.target as HTMLTextAreaElement);
                      // Recalculate height for restored content
                      requestAnimationFrame(() => {
                        autoResizeTextarea(e.target as HTMLTextAreaElement);
                      });
                      (e.target as HTMLTextAreaElement).blur();
                    }
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
                    backgroundColor: hasResponse ? 'var(--background)' : 'var(--muted)',
                    outline: 'none',
                    resize: 'none',
                    transition: 'background-color 200ms ease-out, border-color 120ms ease, outline 120ms ease',
                    display: 'block',
                    boxSizing: 'border-box',
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
                />
                {/* Hidden print-response span for print stylesheet */}
                <span
                  className="print-response"
                  style={{ display: 'none', whiteSpace: 'pre-wrap', fontSize: '16px', lineHeight: 1.6 }}
                >
                  {responseValue.trim() || 'No response'}
                </span>
              </div>
            );
          })}

          {/* Footer: counter + save indicator + export */}
          <div
            className="dt-journal-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'var(--spacing-md)',
              paddingTop: 'var(--spacing-md)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              {/* Counter */}
              <span
                aria-live="polite"
                style={{
                  fontSize: '14px',
                  color: journalComplete ? 'var(--ring)' : 'var(--muted-foreground)',
                }}
              >
                {journalComplete && <CheckmarkIcon />}
                {journalComplete
                  ? `All ${journalTotal} questions answered`
                  : `${journalAnswered} of ${journalTotal} questions answered`}
              </span>
              {/* Save indicator */}
              <SaveIndicator state={saveState} />
            </div>
            {/* Export button */}
            <button
              onClick={exportHTML}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                padding: '4px 8px',
              }}
            >
              Export responses
            </button>
          </div>
        </div>

        {/* No "Add Row" button in journal mode — all rows are initial rows */}

        <JournalPrintStyles />
        <DataTableStyles />
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ margin: 'var(--spacing-lg) 0' }}>
      {showInfoCallout && <InfoCalloutBanner />}

      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {quotaExceeded && !error && (
        <ErrorBanner message="Device storage is full. You can export your data but cannot add new entries." />
      )}

      {/* Table container */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
          backgroundColor: 'var(--card)',
        }}
      >
        {/* Sticky header area with save indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'color-mix(in srgb, var(--ring) 5%, transparent)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
            {totalPrepopulated > 0 && hasRows && (
              <>{filledCount} of {totalPrepopulated} rows filled</>
            )}
            {totalPrepopulated === 0 && hasRows && (
              <>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</>
            )}
          </span>
          <SaveIndicator state={saveState} />
        </div>

        {/* Desktop table view (hidden below 768px) */}
        <div className="dt-desktop-table">
          <table role="grid" aria-label={tableName} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr role="row">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    role="columnheader"
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      textAlign: 'left',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: 'var(--foreground)',
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: 'color-mix(in srgb, var(--ring) 5%, transparent)',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                <th
                  role="columnheader"
                  style={{
                    width: 44,
                    padding: 'var(--spacing-sm)',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: 'color-mix(in srgb, var(--ring) 5%, transparent)',
                  }}
                  aria-label="Actions"
                />
              </tr>
            </thead>
            <tbody>
              {!hasRows && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    style={{
                      padding: 'var(--spacing-2xl) var(--spacing-md)',
                      textAlign: 'center',
                    }}
                  >
                    <p
                      style={{
                        color: 'var(--muted-foreground)',
                        marginBottom: 'var(--spacing-md)',
                        fontSize: '14px',
                      }}
                    >
                      No entries yet
                    </p>
                    {!quotaExceeded && (
                      <button
                        onClick={addRow}
                        aria-label={`Add first entry to ${tableName}`}
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--spacing-xs) var(--spacing-md)',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          minHeight: 44,
                        }}
                      >
                        Add your first entry
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => {
                const isPrePop = isInitialRow(row.rowId);
                const isLast = idx === rows.length - 1;
                return (
                  <tr
                    key={row.rowId}
                    role="row"
                    ref={isLast ? (el) => { newRowRef.current = el; } : undefined}
                    style={{
                      backgroundColor: isPrePop ? 'var(--muted)' : undefined,
                      borderBottom: '1px solid var(--border)',
                      transition: 'background-color 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isPrePop) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'color-mix(in srgb, var(--surface-muted) 30%, transparent)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = isPrePop
                        ? 'var(--muted)'
                        : '';
                    }}
                  >
                    {columns.map((col, colIdx) => {
                      const isReadonly = col.readonly && isPrePop;
                      const cellValue = row.data[col.key] || '';
                      return (
                        <td
                          key={col.key}
                          role="gridcell"
                          aria-readonly={isReadonly || undefined}
                          style={{
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            verticalAlign: 'top',
                            color: isPrePop ? 'var(--muted-foreground)' : 'var(--foreground)',
                            position: 'relative',
                          }}
                        >
                          {isReadonly ? (
                            <div>
                              <span>{cellValue}</span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={cellValue}
                              placeholder={col.placeholder || ''}
                              aria-label={`${col.label} for row ${idx + 1}`}
                              onChange={(e) => saveCell(row.rowId, col.key, e.target.value)}
                              onBlur={(e) => saveCell(row.rowId, col.key, e.target.value, true)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                } else if (e.key === 'Escape') {
                                  restoreCellFromSaved(row.rowId, col.key, e.target as HTMLInputElement);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              style={{
                                width: '100%',
                                border: '1px solid transparent',
                                borderRadius: 'var(--radius-sm)',
                                padding: '6px 8px',
                                fontSize: '14px',
                                fontFamily: 'var(--font-sans)',
                                color: 'var(--foreground)',
                                backgroundColor: 'transparent',
                                outline: 'none',
                                minHeight: 36,
                                transition: 'border-color 120ms ease, box-shadow 120ms ease',
                              }}
                              onFocus={(e) => {
                                e.target.style.borderColor = 'var(--ring)';
                                e.target.style.boxShadow = 'var(--shadow-focus-ring)';
                              }}
                              onBlurCapture={(e) => {
                                (e.target as HTMLInputElement).style.borderColor = 'transparent';
                                (e.target as HTMLInputElement).style.boxShadow = 'none';
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: 'var(--spacing-sm)',
                        verticalAlign: 'top',
                        width: 44,
                      }}
                    >
                      {!isPrePop && (
                        <button
                          onClick={() => startDelete(row.rowId)}
                          aria-label={`Delete row ${idx + 1}`}
                          title="Delete row"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--muted-foreground)',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 32,
                            minHeight: 32,
                            transition: 'color 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--destructive)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)';
                          }}
                        >
                          <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card view (hidden at 768px+) */}
        <div className="dt-mobile-cards" role="list" aria-label={tableName}>
          {!hasRows && (
            <div
              style={{
                padding: 'var(--spacing-2xl) var(--spacing-md)',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  color: 'var(--muted-foreground)',
                  marginBottom: 'var(--spacing-md)',
                  fontSize: '14px',
                }}
              >
                No entries yet
              </p>
              {!quotaExceeded && (
                <button
                  onClick={addRow}
                  aria-label={`Add first entry to ${tableName}`}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    minHeight: 44,
                  }}
                >
                  Add your first entry
                </button>
              )}
            </div>
          )}
          {rows.map((row, idx) => {
            const isPrePop = isInitialRow(row.rowId);
            const isLast = idx === rows.length - 1;
            const cardExpanded = expandedCards.has(row.rowId);
            const visibleCols = needsDisclosure && !cardExpanded ? priorityCols : columns;

            return (
              <div
                key={row.rowId}
                ref={isLast ? (el) => { newRowRef.current = el; } : undefined}
                style={{
                  borderBottom: '1px solid var(--border)',
                  padding: 'var(--spacing-md)',
                  backgroundColor: isPrePop ? 'var(--muted)' : undefined,
                }}
              >
                {/* Card fields */}
                {visibleCols.map((col, colIdx) => {
                  const isReadonly = col.readonly && isPrePop;
                  const cellValue = row.data[col.key] || '';

                  return (
                    <div
                      key={col.key}
                      style={{
                        marginBottom: colIdx < visibleCols.length - 1 ? 'var(--spacing-sm)' : 0,
                      }}
                    >
                      <label
                        htmlFor={isReadonly ? undefined : `dt-${tableId}-${row.rowId}-${col.key}`}
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          color: 'var(--muted-foreground)',
                          marginBottom: 4,
                        }}
                      >
                        {col.label}
                      </label>
                      {isReadonly ? (
                        <span
                          style={{
                            color: 'var(--muted-foreground)',
                            fontSize: '14px',
                          }}
                        >
                          {cellValue}
                        </span>
                      ) : (
                        <input
                          id={`dt-${tableId}-${row.rowId}-${col.key}`}
                          type="text"
                          value={cellValue}
                          placeholder={col.placeholder || ''}
                          onChange={(e) => saveCell(row.rowId, col.key, e.target.value)}
                          onBlur={(e) => saveCell(row.rowId, col.key, e.target.value, true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              restoreCellFromSaved(row.rowId, col.key, e.target as HTMLInputElement);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          style={{
                            width: '100%',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                            fontSize: '16px',
                            fontFamily: 'var(--font-sans)',
                            color: 'var(--foreground)',
                            backgroundColor: isPrePop ? 'var(--card)' : 'transparent',
                            outline: 'none',
                            minHeight: 44,
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--ring)';
                            e.target.style.boxShadow = 'var(--shadow-focus-ring)';
                          }}
                          onBlurCapture={(e) => {
                            (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
                            (e.target as HTMLInputElement).style.boxShadow = 'none';
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Show all fields toggle */}
                {needsDisclosure && !cardExpanded && (
                  <button
                    onClick={() =>
                      setExpandedCards((prev) => new Set(prev).add(row.rowId))
                    }
                    style={{
                      display: 'block',
                      marginTop: 'var(--spacing-sm)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Show all fields ({columns.length - priorityCols.length} more)
                  </button>
                )}
                {needsDisclosure && cardExpanded && (
                  <button
                    onClick={() =>
                      setExpandedCards((prev) => {
                        const next = new Set(prev);
                        next.delete(row.rowId);
                        return next;
                      })
                    }
                    style={{
                      display: 'block',
                      marginTop: 'var(--spacing-sm)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Show fewer fields
                  </button>
                )}

                {/* Delete button for mobile */}
                {!isPrePop && (
                  <button
                    onClick={() => startDelete(row.rowId)}
                    aria-label={`Delete row ${idx + 1}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 'var(--spacing-sm)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted-foreground)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontFamily: 'var(--font-sans)',
                      minHeight: 44,
                    }}
                  >
                    <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Undo toast */}
      {pendingDelete && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <UndoToast onUndo={undoDelete} onExpire={confirmDelete} />
        </div>
      )}

      {/* Action bar */}
      {hasRows && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-md)',
            flexWrap: 'wrap',
          }}
        >
          {!quotaExceeded && (
            <button
              onClick={addRow}
              aria-label={`Add new row to ${tableName}`}
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-xs) var(--spacing-md)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Row
            </button>
          )}
          <button
            onClick={exportCSV}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      )}

      <DataTableStyles />
    </div>
  );
}
