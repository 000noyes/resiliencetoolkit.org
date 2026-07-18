import React, { useEffect, useState } from 'react';
import { Download, Check, AlertCircle, HardDrive } from 'lucide-react';
import { downloadFullBackup, LAST_BACKUP_KEY } from '@/lib/backup';

/**
 * "Where your work lives" + one-tap backup, shown on every module page via
 * ModuleLayout.
 *
 * The honest counterpart to the durability floor: the work is private and
 * offline (true and worth saying), and it lives only on this device where a
 * browser can clear it, so keep a backup. The button runs the same full-toolkit
 * backup as the dashboard (via downloadFullBackup) and stamps the last-backup
 * date so the nudge knows when a fresh copy is due. Both surfaces share the
 * `lastExportTimestamp` key, so either one updates the date.
 */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function formatBackupDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'an unknown date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function WorkLivesHere() {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
    } catch {
      // localStorage unavailable
    }
  }, []);

  async function handleBackup() {
    setStatus('exporting');
    try {
      const result = await downloadFullBackup();
      if (!result.completed) {
        // Canceled save dialog: quiet no-op, never an error state.
        setStatus('idle');
        return;
      }
      setLastBackup(result.timestamp);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (error) {
      console.error('[WorkLivesHere] backup failed:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  const isStale = !lastBackup || Date.now() - new Date(lastBackup).getTime() > STALE_MS;

  const backupLine = lastBackup
    ? `Last backup: ${formatBackupDate(lastBackup)}.${isStale ? ' Time for a fresh backup.' : ''}`
    : 'You have not backed up yet.';

  return (
    <div className="w-full rounded-md border border-border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <HardDrive className="h-5 w-5 flex-shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm text-foreground">
          <strong>Your work is saved on this device, and only here.</strong> It stays private and
          works offline. Nothing goes to the cloud or to Google Drive, so back it up to keep a copy
          you can reload later or carry to another device.
        </p>
        <p className={`mt-1 text-xs ${isStale ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
          {backupLine}
        </p>
      </div>
      <button
        type="button"
        onClick={handleBackup}
        disabled={status === 'exporting'}
        className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          status === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
            : status === 'error'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
        }`}
        style={{ minHeight: 44 }}
      >
        {status === 'exporting' ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Backing up...
          </>
        ) : status === 'success' ? (
          <>
            <Check className="h-4 w-4" /> Backed up
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="h-4 w-4" /> Backup failed
          </>
        ) : (
          <>
            <Download className="h-4 w-4" /> Back up my work
          </>
        )}
      </button>
    </div>
  );
}
