import { exportAllData, flushEditJournalToStorage } from '@/lib/storage';
import { applyJournalToTables, readJournal } from '@/lib/edit-journal';
import { STORAGE_HEALTH_EVENT } from '@/lib/storageHealth';

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

/** Soft storage reminder suppresses for this long after a completed backup. */
export const LAST_BACKUP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The last-backup time in epoch ms, or null when the key is absent, unreadable
 * (private mode), or corrupt. Presentation-layer read of LAST_BACKUP_KEY; does
 * not touch checkStorageHealth's signals.
 */
export function lastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/**
 * Whether a backup was taken within `maxAgeMs` of `now`. Absent/unreadable
 * counts as NOT fresh, so the soft reminder shows (fail toward honesty). Acute
 * states never consult this.
 */
export function isBackupFresh(now: number, maxAgeMs: number = LAST_BACKUP_MAX_AGE_MS): boolean {
  const at = lastBackupAt();
  if (at === null) return false;
  return now - at < maxAgeMs;
}

/** Trigger a full-toolkit JSON download. Returns the backup timestamp (ISO). */
export async function downloadFullBackup(): Promise<string> {
  // Include the last keystrokes even if their debounced write has not landed.
  await flushEditJournalToStorage();

  const data = await exportAllData();

  // Under quota pressure the flush above can fail per-entry (the IDB writes
  // are exactly what a full device rejects), leaving the newest keystrokes
  // journal-only. Merge any leftover entries into the export in memory so the
  // downloaded file is complete even when IndexedDB cannot accept them.
  const leftover = readJournal();
  if (Object.keys(leftover).length > 0) {
    data.tables = applyJournalToTables(data.tables, leftover);
  }
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
    // Same-tab localStorage writes fire no `storage` event, so tell the
    // storage-health banner directly: a completed backup quiets the 14-day
    // soft reminder immediately instead of on next navigation.
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent(STORAGE_HEALTH_EVENT));
    }
  } catch {
    // localStorage unavailable; the file still downloaded
  }
  return ts;
}
