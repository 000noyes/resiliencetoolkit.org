import React, { useEffect, useState } from 'react';
import { Download, Check, AlertCircle, HardDrive } from 'lucide-react';
import { downloadFullBackup } from '@/lib/backup';
import { getCueState } from '@/lib/backup-cue';
import { moduleCardBackupLine } from '@/lib/safety-card-state';

/**
 * "Where your work lives" + one-tap backup, shown on every module page via
 * ModuleLayout.
 *
 * The honest counterpart to the durability floor: the work is private and
 * offline (true and worth saying), and it lives only on this device where a
 * browser can clear it, so keep a backup. The button runs the same
 * full-toolkit backup as the dashboard, and the backup line renders from the
 * same work-based cue as the dashboard card (moduleCardBackupLine), so the
 * two surfaces can never disagree. Time alone never triggers a prompt here.
 */
export default function WorkLivesHere() {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [backupLine, setBackupLine] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    getCueState()
      .then((cue) => {
        if (mounted) setBackupLine(moduleCardBackupLine(cue));
      })
      .catch(() => {
        // storage unreadable: keep the empty line; the headline stays true
      });
    return () => {
      mounted = false;
    };
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
      setBackupLine(moduleCardBackupLine(await getCueState()));
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (error) {
      console.error('[WorkLivesHere] backup failed:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <div className="w-full rounded-md border border-border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <HardDrive className="h-5 w-5 flex-shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm text-foreground">
          <strong>Your work is saved on this device, and only here.</strong> It stays private and
          works offline. Nothing goes to the cloud or to Google Drive, so back it up to keep a copy
          you can reload later or carry to another device.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{backupLine}</p>
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
