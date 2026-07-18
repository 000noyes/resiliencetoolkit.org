import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Upload, X } from 'lucide-react';
import { exportAllData, importAllData } from '@/lib/storage';
import { getCueState } from '@/lib/backup-cue';
import {
  parseBackupFile,
  buildRestorePreview,
  type ParseErrorKind,
  type ParsedBackup,
  type RestorePreview,
} from '@/lib/restore-preview';
import { formatReceiptDate } from '@/lib/safety-card-state';
import { downloadFullBackup } from '@/lib/backup';

/**
 * The restore zone: preview before anything changes.
 *
 * Parse first, show the filename, the file's own date, and what it holds,
 * then the DX5 verdict block, then the explicit choice. When a verdict says
 * this file may be missing newer device work, Replace demotes to the outline
 * style and "Back up this device first" takes the filled slot. Replace is
 * styled with the calm action color, never a destructive red. Errors are kind
 * and name what the file was; a corrupt file changes nothing and says so.
 */

/** Session marker the safety card reads after the reload: one story in two surfaces. */
export const JUST_RESTORED_MARKER = 'rt-just-restored';

type DialogState =
  | { kind: 'closed' }
  | { kind: 'preview'; file: ParsedBackup; filename: string; preview: RestorePreview }
  | { kind: 'importing' }
  | { kind: 'success'; todos: number; tables: number; madeAt: string | null }
  | { kind: 'error'; error: ParseErrorKind | 'import-failed'; filename: string }
  | { kind: 'backing-up-first'; file: ParsedBackup; filename: string };

function errorCopy(error: ParseErrorKind | 'import-failed', filename: string): string {
  switch (error) {
    case 'not-json':
      return `${filename} could not be read as a backup file. A Resilience Toolkit backup is a .json file with a name like resilience-toolkit-backup-2026-07-18.json.`;
    case 'not-a-backup':
      return `${filename} is a readable file, but it is not a Resilience Toolkit backup. Nothing on this device changed.`;
    case 'import-failed':
      return 'That restore did not finish. Nothing on this device changed; your work is still here. Try again.';
  }
}

export default function RestoreBackupZone() {
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog.kind === 'closed') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDialog({ kind: 'closed' });
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialog.kind]);

  async function derivePreview(file: ParsedBackup, filename: string) {
    const [cue, data] = [await getCueState(), await exportAllData()];
    const ids = new Set<string>();
    const moduleKeys = new Set<string>();
    for (const t of data.todos) {
      ids.add(t.id);
      moduleKeys.add(t.moduleKey);
    }
    for (const r of data.tables) {
      ids.add(r.id);
      moduleKeys.add(r.moduleKey);
    }
    let deviceId: string | null = null;
    try {
      deviceId = localStorage.getItem('deviceId');
    } catch {
      // no identity available; lineage simply cannot match
    }
    const preview = buildRestorePreview(file, { deviceId, cue, ids, moduleKeys });
    setDialog({ kind: 'preview', file, filename, preview });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    e.target.value = '';
    const filename = picked.name;
    try {
      const parsed = parseBackupFile(await picked.text());
      if (!parsed.ok) {
        setDialog({ kind: 'error', error: parsed.error, filename });
        return;
      }
      await derivePreview(parsed.data, filename);
    } catch {
      setDialog({ kind: 'error', error: 'not-json', filename });
    }
  }

  async function handleBackupFirst(file: ParsedBackup, filename: string) {
    setDialog({ kind: 'backing-up-first', file, filename });
    try {
      await downloadFullBackup();
    } catch (error) {
      console.error('[RestoreBackupZone] backup-first failed:', error);
    }
    // Re-derive against the refreshed device state: a completed backup
    // resolves the missing-newer verdict honestly instead of hiding it.
    await derivePreview(file, filename);
  }

  async function handleReplace(file: ParsedBackup) {
    setDialog({ kind: 'importing' });
    try {
      const result = await importAllData(file.raw);
      setDialog({
        kind: 'success',
        todos: result.todosImported,
        tables: result.tablesImported,
        madeAt: file.exportedAt,
      });
    } catch (error) {
      console.error('[RestoreBackupZone] import failed:', error);
      setDialog({ kind: 'error', error: 'import-failed', filename: 'That file' });
    }
  }

  function finishRestore(success: { todos: number; tables: number; madeAt: string | null }) {
    try {
      sessionStorage.setItem(
        JUST_RESTORED_MARKER,
        JSON.stringify({ todos: success.todos, tables: success.tables, madeAt: success.madeAt }),
      );
    } catch {
      // the reload still lands on a truthful card without the marker
    }
    window.location.reload();
  }

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

      <div
        data-testid="rt-restore-zone"
        className="rounded-lg border border-border bg-background p-6 flex flex-col sm:flex-row items-center gap-4"
      >
        <FolderOpen
          className="h-6 w-6 text-muted-foreground flex-shrink-0"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <p className="flex-1 text-sm text-muted-foreground text-center sm:text-left">
          Pick the backup file from your Downloads, a drive, or wherever you keep it.
        </p>
        <button
          type="button"
          data-testid="rt-restore-choose"
          onClick={() => fileInputRef.current?.click()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm border border-border bg-card text-foreground hover:bg-muted transition-colors"
          style={{ minHeight: 44 }}
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          Choose backup file
        </button>
      </div>

      {dialog.kind !== 'closed' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && dialog.kind !== 'importing') {
              setDialog({ kind: 'closed' });
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Restore from a backup"
            data-testid="rt-restore-dialog"
            className="bg-card border border-border w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-6 shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {dialog.kind === 'preview' && 'Restore from a backup'}
                {dialog.kind === 'backing-up-first' && 'Backing up this device'}
                {dialog.kind === 'importing' && 'Restoring...'}
                {dialog.kind === 'success' && 'Your work is back'}
                {dialog.kind === 'error' && 'That did not work'}
              </h3>
              {dialog.kind !== 'importing' && (
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'closed' })}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {dialog.kind === 'preview' && (
              <>
                <p
                  data-testid="rt-restore-filename"
                  className="text-sm font-medium text-foreground break-all"
                >
                  {dialog.filename}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dialog.preview.madeAt
                    ? `This backup was made ${formatReceiptDate(dialog.preview.madeAt)}. `
                    : ''}
                  {dialog.preview.summary}
                </p>
                {dialog.preview.verdicts.map((v) => (
                  <p
                    key={v}
                    data-testid="rt-restore-verdict"
                    className="mt-2 text-sm text-foreground"
                  >
                    {v}
                  </p>
                ))}
                {dialog.preview.partialWarning && (
                  <p data-testid="rt-restore-partial" className="mt-2 text-sm font-medium text-foreground">
                    {dialog.preview.partialWarning}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {dialog.preview.demoteReplace ? (
                    <>
                      <button
                        type="button"
                        data-testid="rt-restore-backup-first"
                        onClick={() => handleBackupFirst(dialog.file, dialog.filename)}
                        className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Back up this device first
                      </button>
                      <button
                        type="button"
                        data-testid="rt-restore-replace"
                        onClick={() => handleReplace(dialog.file)}
                        className="w-full px-4 py-2.5 rounded-lg font-medium text-sm border border-primary text-primary hover:bg-primary/10 transition-colors"
                      >
                        Replace everything on this device
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid="rt-restore-replace"
                      onClick={() => handleReplace(dialog.file)}
                      className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Replace everything on this device
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'closed' })}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm border border-border text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {(dialog.kind === 'importing' || dialog.kind === 'backing-up-first') && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}

            {dialog.kind === 'success' && (
              <>
                <p data-testid="rt-restore-success" className="text-sm text-muted-foreground">
                  This device now holds{' '}
                  {[
                    dialog.todos > 0 ? `${dialog.todos} checked item${dialog.todos === 1 ? '' : 's'}` : '',
                    dialog.tables > 0 ? `${dialog.tables} saved row${dialog.tables === 1 ? '' : 's'}` : '',
                  ]
                    .filter(Boolean)
                    .join(' and ') || 'your restored work'}
                  {dialog.madeAt ? ` from the backup made ${formatReceiptDate(dialog.madeAt)}` : ''}. New
                  work from here counts toward your next backup.
                </p>
                <button
                  type="button"
                  data-testid="rt-restore-finish"
                  onClick={() => finishRestore(dialog)}
                  className="mt-4 w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Bring my work into view
                </button>
              </>
            )}

            {dialog.kind === 'error' && (
              <>
                <p className="text-sm text-muted-foreground">
                  {errorCopy(dialog.error, dialog.filename)}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDialog({ kind: 'closed' });
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Choose a different file
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'closed' })}
                    className="w-full px-4 py-2.5 rounded-lg font-medium text-sm border border-border text-foreground hover:bg-muted transition-colors"
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
