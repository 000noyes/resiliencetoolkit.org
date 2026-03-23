import React, { useState, useRef, useEffect, useCallback } from 'react';
import { importAllData } from '@/lib/storage';
import { Upload, AlertCircle, CheckCircle2, X } from 'lucide-react';

type ImportError = 'invalid-json' | 'wrong-schema' | 'import-failed';

const errorMessages: Record<ImportError, string> = {
  'invalid-json': 'This file is not valid JSON. Please select a file exported from the Resilience Toolkit.',
  'wrong-schema': 'This file is missing required fields. Make sure you are importing a Resilience Toolkit backup.',
  'import-failed': 'Something went wrong during import. Try exporting your data to check its state, then try again.',
};

export default function ImportDataButton({ className = '' }: { className?: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'confirm' | 'importing' | 'success' | 'error'>('idle');
  const [errorType, setErrorType] = useState<ImportError | null>(null);
  const [result, setResult] = useState<{ todosImported: number; tablesImported: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pendingData = useRef<unknown>(null);

  // Focus trap for dialog
  useEffect(() => {
    if (!showDialog) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeDialog();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDialog]);

  function closeDialog() {
    setShowDialog(false);
    setStatus('idle');
    setErrorType(null);
    setResult(null);
    pendingData.current = null;
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setErrorType('invalid-json');
        setStatus('error');
        setShowDialog(true);
        return;
      }

      pendingData.current = parsed;
      setStatus('confirm');
      setShowDialog(true);
    } catch {
      setErrorType('invalid-json');
      setStatus('error');
      setShowDialog(true);
    }
  }

  const doImport = useCallback(async () => {
    if (!pendingData.current) return;
    setStatus('importing');

    try {
      const res = await importAllData(pendingData.current);
      setResult(res);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Wrong schema') || msg.includes('missing')) {
        setErrorType('wrong-schema');
      } else {
        setErrorType('import-failed');
      }
      setStatus('error');
    }
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleFileSelect}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
          border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
          text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
          transition-all ${className}`}
      >
        <Upload className="w-4 h-4" />
        Import Data
      </button>

      {/* Dialog overlay */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Import data"
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
              w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-6 shadow-xl
              max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {status === 'confirm' && 'Import Data'}
                {status === 'importing' && 'Importing...'}
                {status === 'success' && 'Import Complete'}
                {status === 'error' && 'Import Error'}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {status === 'confirm' && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will replace all your current data with the imported backup.
                  Export your current data first if you want to keep it.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={doImport}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    Replace my data
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {status === 'importing' && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}

            {status === 'success' && result && (
              <>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-3">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Data imported successfully</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Imported {result.todosImported} checklist items and {result.tablesImported} table rows.
                  Refresh the page to see your data.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  Refresh page
                </button>
              </>
            )}

            {status === 'error' && errorType && (
              <>
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 mb-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{errorMessages[errorType]}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeDialog();
                      handleFileSelect();
                    }}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
