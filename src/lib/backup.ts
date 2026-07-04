import { exportAllData, flushEditJournalToStorage } from '@/lib/storage';

/**
 * Backup = the whole toolkit, one JSON file, one code path.
 *
 * Both the module-page "Back up my work" button and the dashboard "Export My
 * Data" button call this, so they can never drift into two different backups.
 * It flushes pending journaled edits into IndexedDB first, so a backup taken
 * mid-edit is complete, then serializes every store and stamps the last-backup
 * time.
 */
export const LAST_BACKUP_KEY = 'lastExportTimestamp';

/** Trigger a full-toolkit JSON download. Returns the backup timestamp (ISO). */
export async function downloadFullBackup(): Promise<string> {
  // Include the last keystrokes even if their debounced write has not landed.
  await flushEditJournalToStorage();

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
    // localStorage unavailable; the file still downloaded
  }
  return ts;
}
