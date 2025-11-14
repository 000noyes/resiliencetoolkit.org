import { useEffect, useState } from 'react';
import { getTableRows, saveTableRow, type TableRow } from '@/lib/storage';

interface EditableTableProps {
  moduleKey: string;
  tableId: string;
  columns: string[];
  initialData?: Record<string, any>[];
  children?: React.ReactNode;
}

export default function EditableTable({
  moduleKey,
  tableId,
  columns,
  initialData = [],
}: EditableTableProps) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [note, setNote] = useState('');
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  // Helper function to check if a row is from initial data
  const isInitialRow = (rowId: string): boolean => {
    // Initial rows have pattern: row-0, row-1, row-2, etc.
    // User-added rows have pattern: row-{timestamp}
    const match = rowId.match(/^row-(\d+)$/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    // Initial rows have small numbers (0 to initialData.length-1)
    // Timestamps are 13 digits (much larger)
    return num < 1000; // Safe threshold to distinguish
  };

  // Load note from localStorage
  useEffect(() => {
    const noteKey = `table-note-${moduleKey}-${tableId}`;
    const savedNote = localStorage.getItem(noteKey);
    if (savedNote) {
      setNote(savedNote);
      setIsNoteExpanded(true); // Auto-expand if there's a saved note
    }
  }, [moduleKey, tableId]);

  // Save note to localStorage
  useEffect(() => {
    const noteKey = `table-note-${moduleKey}-${tableId}`;
    if (note) {
      localStorage.setItem(noteKey, note);
    }
  }, [note, moduleKey, tableId]);

  useEffect(() => {
    async function loadData() {
      try {
        const savedRows = await getTableRows(moduleKey, tableId);

        if (savedRows.length === 0 && initialData.length > 0) {
          // Initialize with default data
          const newRows: TableRow[] = initialData.map((data, index) => ({
            id: `${moduleKey}-${tableId}-${index}`,
            moduleKey,
            tableId,
            rowId: `row-${index}`,
            data,
            updatedAt: new Date().toISOString(),
          }));

          // Save initial data
          for (const row of newRows) {
            await saveTableRow(row);
          }

          setRows(newRows);
        } else {
          setRows(savedRows);
        }
      } catch (error) {
        console.error('Failed to load table data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [moduleKey, tableId, initialData]);

  async function handleCellChange(rowId: string, column: string, value: string) {
    try {
      const row = rows.find((r) => r.rowId === rowId);
      if (!row) return;

      // Prevent editing first column of initial rows
      if (isInitialRow(rowId) && column === columns[0]) {
        console.warn('Cannot edit prompts in pre-populated rows');
        return;
      }

      const updatedRow = {
        ...row,
        data: {
          ...row.data,
          [column]: value,
        },
      };

      await saveTableRow(updatedRow);

      setRows((prev) => prev.map((r) => (r.rowId === rowId ? updatedRow : r)));

      // Dispatch event for potential sync
      window.dispatchEvent(
        new CustomEvent('table-changed', {
          detail: { moduleKey, tableId, rowId },
        })
      );
    } catch (error) {
      console.error('Failed to update cell:', error);
    }
  }


  if (loading) {
    return (
      <div className="overflow-x-auto">
        <div className="min-w-full animate-pulse">
          <div className="h-12 bg-surface-muted rounded-lg mb-xs shadow-ambient"></div>
          <div className="h-12 bg-surface-muted/50 rounded-lg mb-xs shadow-ambient"></div>
          <div className="h-12 bg-surface-muted/50 rounded-lg shadow-ambient"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-lg">
      <div className="overflow-x-auto border border-border rounded-lg shadow-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-md py-md text-left text-uppercase-accent uppercase font-semibold text-text-secondary tracking-wide"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {rows.map((row /* , index */) => (
              <tr key={row.rowId} className="hover:bg-surface-muted/30 transition-colors duration-default ease-default" style={{ minHeight: '72px' }}>
                {columns.map((column) => (
                  <td
                    key={`${row.rowId}-${column}`}
                    className="px-md py-md"
                    onClick={() => {
                      // Prevent editing first column of initial rows (prompts are read-only)
                      if (isInitialRow(row.rowId) && column === columns[0]) return;
                      setEditingCell({ rowId: row.rowId, column });
                    }}
                  >
                    {editingCell?.rowId === row.rowId && editingCell?.column === column ? (
                      <input
                        type="text"
                        value={row.data[column] || ''}
                        onChange={(e) => handleCellChange(row.rowId, column, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        className="w-full h-10 px-sm py-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-input text-body text-foreground transition-all duration-default ease-default shadow-ambient"
                      />
                    ) : (
                      <span className={`text-body text-text-primary ${isInitialRow(row.rowId) && column === columns[0] ? 'cursor-default' : 'cursor-text'}`}>
                        {row.data[column] || <span className="text-text-muted">{isInitialRow(row.rowId) && column === columns[0] ? '' : 'Click to edit'}</span>}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Note Section */}
      <div className="mt-md">
        <button
          onClick={() => setIsNoteExpanded(!isNoteExpanded)}
          className="px-lg py-sm text-body-small font-medium rounded-full bg-secondary text-secondary-foreground shadow-sm hover:shadow-raised hover:bg-secondary/90 transition-all duration-default ease-default active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {isNoteExpanded ? 'Hide Note' : 'Add Note'}
        </button>

        {isNoteExpanded && (
          <div className="mt-md border border-border rounded-lg shadow-card bg-card p-md">
            <label htmlFor={`note-${moduleKey}-${tableId}`} className="block text-body-small font-medium text-text-secondary mb-xs">
              Notes for this table:
            </label>
            <textarea
              id={`note-${moduleKey}-${tableId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your notes here..."
              rows={4}
              className="w-full px-sm py-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-input text-body text-foreground transition-all duration-default ease-default shadow-ambient resize-vertical"
            />
            <p className="mt-xs text-body-small text-text-muted">
              Notes are saved automatically to your browser
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
