import React, { useEffect, useState } from 'react';
import { Download, Check, AlertCircle, HardDrive } from 'lucide-react';
import { exportAllData } from '@/lib/storage';

/**
 * "Where your work lives" + one-tap backup, shown on every module page via
 * ModuleLayout.
 *
 * The honest counterpart to the durability floor: the toolkit's work is private
 * and offline (true and worth saying), AND it lives only on this device where a
 * browser could clear it, so keep a backup. One tap exports everything as JSON
 * (the same shape Restore imports) and stamps the last-backup date so the nudge
 * knows when a fresh copy is due.
 *
 * Backups here and the settings-page Export share the `lastExportTimestamp`
 * key, so either one updates the "last backup" date.
 */
const LAST_BACKUP_KEY = 'lastExportTimestamp';
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
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString();
      const a = document.createElement('a');
      a.href = url;
      a.download = `resilience-toolkit-backup-${ts.split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      try {
        localStorage.setItem(LAST_BACKUP_KEY, ts);
      } catch {
        // ignore
      }
      setLastBackup(ts);
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
          <strong>Your work lives on this device.</strong> It stays private and works offline, and it
          is not saved to the cloud or Google Drive. Back it up to keep a copy you can restore or move
          to another device.
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
