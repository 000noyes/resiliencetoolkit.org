import {
  exportAllData,
  flushEditJournalToStorage,
  getMetadata,
  setMetadata,
  BACKUP_WRITE_COUNTER_KEY,
} from '@/lib/storage';
import { applyJournalToTables, readJournal } from '@/lib/edit-journal';
import { STORAGE_HEALTH_EVENT } from '@/lib/storageHealth';
import { buildWorkSnapshot, computeSnapshotHash, recordBackupBaseline } from '@/lib/backup-cue';

/**
 * Backup = the whole toolkit, one JSON file, one code path.
 *
 * Both the module-page "Back up my work" button and the dashboard safety card
 * call this, so they can never drift into two different backups. The file is
 * designed, not just serialized: it carries its own timestamp, a verb-free
 * readme for whoever finds it later, and lineage fields (which device made
 * it, at what counter, over what snapshot) so the restore preview can tell
 * exact truth when the file is this device's own last baseline.
 *
 * The counter reset, timestamp, and stored hash are gated on a real
 * per-transport completion signal: share() resolving, the save picker's write
 * completing, or the plain anchor's click. The anchor has no completion
 * signal, so its transport is recorded and the card persists the "check your
 * Downloads" caution rather than ever claiming a confirmed calm on it.
 */
export const LAST_BACKUP_KEY = 'lastExportTimestamp';

/** Metadata key recording which transport completed the last backup. */
export const LAST_BACKUP_TRANSPORT_KEY = 'lastBackupTransport';

/**
 * The last-backup time in epoch ms, or null when the key is absent, unreadable
 * (private mode), or corrupt. Presentation-layer read of the legacy
 * localStorage key; the metadata-store timestamp is the authoritative record.
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

export type BackupTransport = 'share' | 'picker' | 'anchor';

export interface BackupData {
  todos: Array<{ id: string }>;
  tables: Array<{ id: string }>;
  metadata: Record<string, unknown>;
  /** The file's own timestamp (people rename files; this survives). */
  exportedAt: string;
  /** One plain sentence for whoever finds the file. Direction only, no verbs
   * that could point a person at a destructive path years later. */
  _readme: string;
  /** Lineage: the device that made this file. */
  backupDeviceId: string | null;
  /** Lineage: the device's write counter at export (null when unknown). */
  backupCounter: number | null;
  /** Lineage: the canonical snapshot hash of this file's own content. */
  backupSnapshotHash: string;
}

export interface BackupPayload {
  data: BackupData;
  filename: string;
  timestamp: string;
  snapshotHash: string;
}

export interface BackupResult {
  completed: boolean;
  transport: BackupTransport | null;
  timestamp: string | null;
  filename: string | null;
}

const README_SENTENCE =
  'This file holds your saved Resilience Toolkit work. To put it back, open resiliencetoolkit.org/dashboard.';

/** Sanitize a device name into a calm lowercase filename slug. */
export function backupDeviceSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFilename(timestamp: string, deviceSlug: string): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const slug = deviceSlug ? `${deviceSlug}-` : '';
  return `resilience-toolkit-backup-${slug}${date}-${time}.json`;
}

/**
 * Assemble the complete backup artifact: flush pending journaled edits,
 * serialize every store, merge any quota-stranded journal entries in memory,
 * and add the additive designed fields. Everything in the stores travels;
 * restore fidelity beats file cosmetics.
 */
export async function buildBackupPayload(): Promise<BackupPayload> {
  // Include the last keystrokes even if their debounced write has not landed.
  await flushEditJournalToStorage();

  const exported = await exportAllData();

  // Under quota pressure the flush above can fail per-entry (the IDB writes
  // are exactly what a full device rejects), leaving the newest keystrokes
  // journal-only. Merge any leftover entries into the export in memory so the
  // downloaded file is complete even when IndexedDB cannot accept them.
  const leftover = readJournal();
  const tables =
    Object.keys(leftover).length > 0
      ? applyJournalToTables(exported.tables, leftover)
      : exported.tables;

  const timestamp = new Date().toISOString();
  const snapshotHash = await computeSnapshotHash(
    buildWorkSnapshot({ todos: exported.todos, tables, metadata: exported.metadata }),
  );

  let deviceId: string | null = null;
  try {
    deviceId = localStorage.getItem('deviceId');
  } catch {
    // localStorage unavailable; lineage travels without a device id
  }

  const rawCounter = await getMetadata(BACKUP_WRITE_COUNTER_KEY).catch(() => undefined);
  const backupCounter = typeof rawCounter === 'number' && !Number.isNaN(rawCounter) ? rawCounter : null;

  const rawName = await getMetadata('deviceName').catch(() => undefined);
  const deviceSlug = typeof rawName === 'string' ? backupDeviceSlug(rawName) : '';

  const data: BackupData = {
    todos: exported.todos,
    tables,
    metadata: exported.metadata,
    exportedAt: timestamp,
    _readme: README_SENTENCE,
    backupDeviceId: deviceId,
    backupCounter,
    backupSnapshotHash: snapshotHash,
  };

  return { data, filename: buildFilename(timestamp, deviceSlug), timestamp, snapshotHash };
}

/** Stamp the completed backup's baseline and notify listening surfaces. */
async function stampCompleted(payload: BackupPayload, transport: BackupTransport): Promise<void> {
  await recordBackupBaseline(payload.timestamp, payload.snapshotHash);
  try {
    await setMetadata(LAST_BACKUP_TRANSPORT_KEY, transport);
  } catch {
    // transport record is presentation-only; the baseline is what matters
  }
  // Same-tab metadata writes fire no `storage` event, so tell the listening
  // banners directly: a completed backup quiets the soft reminder immediately.
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(STORAGE_HEALTH_EVENT));
  }
}

function toBlob(payload: BackupPayload): Blob {
  return new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Download the backup file. Prefers the save picker (a real completion
 * signal) and falls back to the plain anchor, which stamps on the click (the
 * best signal it has) while recording its caution-persisting transport.
 * A canceled picker is a quiet no-op: nothing stamps, nothing errors.
 */
export async function downloadFullBackup(): Promise<BackupResult> {
  const payload = await buildBackupPayload();
  const blob = toBlob(payload);

  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: payload.filename,
        types: [{ description: 'Resilience Toolkit backup', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      await stampCompleted(payload, 'picker');
      return { completed: true, transport: 'picker', timestamp: payload.timestamp, filename: payload.filename };
    } catch (err) {
      if (isAbort(err)) {
        return { completed: false, transport: null, timestamp: null, filename: null };
      }
      // Picker failed for a non-cancel reason: fall through to the anchor so
      // the person still gets their file.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await stampCompleted(payload, 'anchor');
  return { completed: true, transport: 'anchor', timestamp: payload.timestamp, filename: payload.filename };
}

/**
 * Share a copy to another device the person owns (DR2). Capability-gated on
 * file share support; the reject-on-cancel completion signal is the strongest
 * of the three transports. The caller shows the one-time caution interstitial
 * BEFORE calling this, so the signal survives.
 */
export async function shareBackup(): Promise<BackupResult> {
  const payload = await buildBackupPayload();
  const file = new File([toBlob(payload)], payload.filename, { type: 'application/json' });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[] }) => Promise<void>;
  };
  if (typeof nav.canShare !== 'function' || typeof nav.share !== 'function' || !nav.canShare({ files: [file] })) {
    return { completed: false, transport: null, timestamp: null, filename: null };
  }

  try {
    await nav.share({ files: [file] });
  } catch (err) {
    if (isAbort(err)) {
      return { completed: false, transport: null, timestamp: null, filename: null };
    }
    throw err;
  }

  await stampCompleted(payload, 'share');
  return { completed: true, transport: 'share', timestamp: payload.timestamp, filename: payload.filename };
}
