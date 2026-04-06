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
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { getTableRows, saveTableRow, deleteTableRow, type TableRow } from '@/lib/storage';

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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAVE_DEBOUNCE_MS = 300;
const UNDO_WINDOW_MS = 5000;
const SAVE_RECENT_THRESHOLD_MS = 30000;

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

/** Format time for save indicator */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Escape CSV cell value */
function escapeCSVCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; at: Date }
  | { status: 'error'; message: string };

function SaveIndicator({ state }: { state: SaveState }) {
  const [, setTick] = useState(0);

  // Tick every 10s to update "Saved just now" -> "Saved at HH:MM"
  useEffect(() => {
    if (state.status !== 'saved') return;
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, [state]);

  if (state.status === 'idle') return null;

  if (state.status === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-body-small animate-pulse"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Saving...
      </span>
    );
  }

  if (state.status === 'error') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-body-small"
        style={{ color: 'var(--destructive)' }}
      >
        {state.message}
      </span>
    );
  }

  // status === 'saved'
  const elapsed = Date.now() - state.at.getTime();
  const isRecent = elapsed < SAVE_RECENT_THRESHOLD_MS;

  return (
    <span
      role="status"
      aria-live="polite"
      className="text-body-small"
      style={{ color: isRecent ? 'var(--ring)' : 'var(--muted-foreground)' }}
    >
      {isRecent ? 'Saved just now' : `Saved at ${formatTime(state.at)}`}
    </span>
  );
}

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

function InfoCalloutBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('rt-trust-acknowledged') === 'true') {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      style={{
        backgroundColor: 'color-mix(in srgb, var(--primary) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-sm)',
      }}
    >
      <svg
        style={{ width: 20, height: 20, color: 'var(--primary)', flexShrink: 0, marginTop: 2 }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--foreground)' }}>
        <strong>Your data saves automatically to your device.</strong> Everything you enter stays
        in your browser and works offline. Your information never leaves your device.
      </p>
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const addRowLockRef = useRef(false);

  // Determine which columns are priority 1
  const priorityCols = columns.filter((c) => (c.priority ?? 1) === 1).slice(0, 3);
  const needsDisclosure = columns.length > 4;

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

      const savedRows = await getTableRows(moduleKey, tableId);

      if (savedRows.length === 0 && initialRows.length > 0) {
        const newRows: TableRow[] = initialRows.map((init) => ({
          id: `${moduleKey}-${tableId}-${init.rowId}`,
          moduleKey,
          tableId,
          rowId: init.rowId,
          data: init.data,
          updatedAt: new Date().toISOString(),
        }));

        for (const row of newRows) {
          await saveTableRow(row);
        }
        setRows(newRows);
      } else {
        setRows(savedRows);
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
  }, [moduleKey, tableId, initialRows]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -----------------------------------------------------------------------
  // Save cell
  // -----------------------------------------------------------------------
  const saveCell = useCallback(
    async (rowId: string, columnKey: string, value: string) => {
      if (quotaExceeded) return;

      const row = rows.find((r) => r.rowId === rowId);
      if (!row) return;

      // Prevent editing readonly columns on pre-populated rows
      const colDef = columns.find((c) => c.key === columnKey);
      if (colDef?.readonly && isInitialRow(rowId)) return;

      const updatedRow: TableRow = {
        ...row,
        data: { ...row.data, [columnKey]: value },
        updatedAt: new Date().toISOString(),
      };

      setRows((prev) => prev.map((r) => (r.rowId === rowId ? updatedRow : r)));

      // Debounced save
      clearTimeout(saveTimerRef.current);
      setSaveState({ status: 'saving' });

      saveTimerRef.current = setTimeout(async () => {
        try {
          await saveTableRow(updatedRow);
          setSaveState({ status: 'saved', at: new Date() });

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
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [rows, columns, quotaExceeded],
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

      await saveTableRow(newRow);
      setRows((prev) => [...prev, newRow]);
      setSaveState({ status: 'saved', at: new Date() });

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
  const startDelete = useCallback(
    (rowId: string) => {
      const idx = rows.findIndex((r) => r.rowId === rowId);
      if (idx === -1) return;
      const row = rows[idx];

      // Don't allow deleting readonly pre-populated rows
      if (isInitialRow(rowId)) return;

      setPendingDelete({ row, index: idx });
      setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    },
    [rows],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteTableRow(moduleKey, tableId, pendingDelete.row.rowId);
    } catch (err) {
      console.error('[DataTable] Delete error:', err);
    }
    setPendingDelete(null);
  }, [pendingDelete, moduleKey, tableId]);

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
  // CSV export
  // -----------------------------------------------------------------------
  const exportCSV = useCallback(() => {
    const headerLine = columns.map((c) => escapeCSVCell(c.label)).join(',');
    const dataLines = rows.map((row) =>
      columns.map((c) => escapeCSVCell(row.data[c.key] || '')).join(','),
    );
    const csv = [headerLine, ...dataLines].join('\n');
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
        <LoadingSkeleton columns={columns} />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const hasRows = rows.length > 0;

  return (
    <div ref={containerRef} style={{ margin: 'var(--spacing-lg) 0' }}>
      {showInfoCallout && <InfoCalloutBanner />}

      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {quotaExceeded && !error && (
        <ErrorBanner message="Device storage is full. You can export your data but cannot add new entries." />
      )}

      {/* Table container */}
      <div
        role="grid"
        aria-label={tableName}
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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                              {colIdx === 0 && (
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    color: 'var(--muted-foreground)',
                                    fontWeight: 400,
                                    marginTop: 2,
                                  }}
                                >
                                  (example)
                                </span>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={cellValue}
                              placeholder={col.placeholder || ''}
                              aria-label={`${col.label} for row ${idx + 1}`}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? { ...r, data: { ...r.data, [col.key]: e.target.value } }
                                      : r,
                                  ),
                                )
                              }
                              onBlur={(e) => saveCell(row.rowId, col.key, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                } else if (e.key === 'Escape') {
                                  // Restore to saved value
                                  const original = rows.find((r) => r.rowId === row.rowId);
                                  if (original) {
                                    setRows((prev) =>
                                      prev.map((r) =>
                                        r.rowId === row.rowId ? original : r,
                                      ),
                                    );
                                  }
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
                              onFocusCapture={undefined}
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
        <div className="dt-mobile-cards">
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
                        {isReadonly && colIdx === 0 && (
                          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', marginLeft: 6 }}>
                            (example)
                          </span>
                        )}
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
                          type="text"
                          value={cellValue}
                          placeholder={col.placeholder || ''}
                          aria-label={`${col.label} for row ${idx + 1}`}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId
                                  ? { ...r, data: { ...r.data, [col.key]: e.target.value } }
                                  : r,
                              ),
                            )
                          }
                          onBlur={(e) => saveCell(row.rowId, col.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
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

      {/* Responsive styles — injected once */}
      <style>{`
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
          [role="status"],
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
