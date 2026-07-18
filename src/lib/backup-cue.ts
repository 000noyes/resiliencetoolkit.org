/**
 * Backup cue — the read side of the work-based cue.
 *
 * The nudge fires on unprotected work, never on elapsed time. This module
 * derives the cue state from the primitives storage.ts maintains at its leaf
 * writers (the write counter and the has-work canary) and owns the canonical
 * work snapshot: the one projection of exportAllData() that the dashboard calm
 * gate, the honest meter, and the restore preview verdicts all hash and count
 * from, so no two surfaces can ever disagree.
 *
 * Cheap-path discipline: readCanary() is one localStorage read and
 * getCueState() is at most two metadata reads. The snapshot hash is
 * dashboard-only (the calm-state gate); it is never computed on ordinary page
 * loads, so old phones never pay a full-data hash per navigation.
 */
import {
  getMetadata,
  setMetadata,
  BACKUP_WRITE_COUNTER_KEY,
  LAST_BACKUP_AT_KEY,
  LAST_BACKUP_HASH_KEY,
  HAS_WORK_CANARY_KEY,
} from '@/lib/storage';

/**
 * Legacy last-backup timestamp key in localStorage (backup.ts LAST_BACKUP_KEY).
 * Declared locally so backup.ts can later depend on this module without an
 * import cycle. The metadata-store timestamp is authoritative; this key is
 * read as a cold-start fallback (it honors a user's pre-ship diligence) and
 * mirrored on write for any older reader still watching it.
 */
const LEGACY_LAST_BACKUP_LOCALSTORAGE_KEY = 'lastExportTimestamp';

// ============================================================================
// HAS-WORK CANARY (read side; storage.ts writes it at the leaf writers)
// ============================================================================

export interface WorkCanary {
  /** moduleKeys that have ever held user work on this device (DR6). */
  modules: Record<string, boolean>;
  updatedAt: string;
}

/** Read the canary. Null when absent, corrupt, or localStorage unavailable. */
export function readCanary(): WorkCanary | null {
  try {
    const raw = localStorage.getItem(HAS_WORK_CANARY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.modules ||
      typeof parsed.modules !== 'object' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }
    return parsed as WorkCanary;
  } catch {
    return null;
  }
}

/** The store counts the loss predicate compares against the canary. */
export interface WorkCounts {
  todos: number;
  tables: number;
  hasNotes: boolean;
}

/**
 * Loss detected = divergent survival: the canary (localStorage) says this
 * device had work while the IndexedDB stores are empty. Best-effort and
 * low-yield by design (origin-wide eviction wipes both sides together); the
 * false-positive guard is structural — the canary is only ever written after
 * a real user write, so a browse-only visitor can never trip this.
 */
export function detectPossibleLoss(canary: WorkCanary | null, counts: WorkCounts): boolean {
  if (!canary || Object.keys(canary.modules).length === 0) return false;
  return counts.todos === 0 && counts.tables === 0 && !counts.hasNotes;
}

// ============================================================================
// CANONICAL WORK SNAPSHOT
// ============================================================================

/**
 * Metadata keys excluded from the canonical work snapshot: device identity,
 * diagnostics (lastCheck re-stamps every load, so a raw-export hash would
 * never match), the cue and baseline keys themselves, migration markers, and
 * the retired streak/goal and bookmark state. A key NOT on this list counts
 * as work — an unknown future metadata key can only cause a harmless extra
 * nudge (over-count is safe; under-count is the catastrophic direction).
 */
export const VOLATILE_METADATA_KEYS: ReadonlySet<string> = new Set([
  'storageDiagnostic',
  'storageDeviceId',
  'storagePersisted',
  'storage_persist_requested_v1',
  BACKUP_WRITE_COUNTER_KEY,
  LAST_BACKUP_AT_KEY,
  LAST_BACKUP_HASH_KEY,
  'migration_seniors_and_disabilities_v1',
  'migration_place_characteristics_row_0_slots_v1',
  'currentStreak',
  'streakLastActivityDate',
  'weekStartDate',
  'weeklyCompleted',
  'weeklyGoal',
  'bookmarkedModules',
  'deviceName',
]);

/** Any exported row: identified by its composite id, all other fields carried through. */
interface SnapshotRow {
  id: string;
}

export interface WorkSnapshot {
  todos: SnapshotRow[];
  tables: SnapshotRow[];
  metadata: Record<string, unknown>;
}

/**
 * Project an exportAllData() result to the canonical work snapshot: todos and
 * tables sorted by id, metadata minus the volatile keyset. Pure.
 */
export function buildWorkSnapshot(data: {
  todos: readonly SnapshotRow[];
  tables: readonly SnapshotRow[];
  metadata: Record<string, unknown>;
}): WorkSnapshot {
  const byId = (a: SnapshotRow, b: SnapshotRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(data.metadata).sort()) {
    if (!VOLATILE_METADATA_KEYS.has(key)) {
      metadata[key] = data.metadata[key];
    }
  }
  return {
    todos: [...data.todos].sort(byId),
    tables: [...data.tables].sort(byId),
    metadata,
  };
}

/** JSON.stringify with recursively sorted object keys, so hashes are stable. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const parts = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/** Deterministic serialization of a snapshot (input order never matters). */
export function serializeSnapshot(snapshot: WorkSnapshot): string {
  return canonicalJson(snapshot);
}

/** SHA-256 of the canonical serialization, lowercase hex. */
export async function computeSnapshotHash(snapshot: WorkSnapshot): Promise<string> {
  const bytes = new TextEncoder().encode(serializeSnapshot(snapshot));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// CUE STATE
// ============================================================================

export interface CueState {
  /**
   * Landed writes since the last completed backup. 'unknown' when the counter
   * is absent (cold start: exact counting begins after the first backup) or
   * unreadable (fails toward claiming the cue, never toward false calm).
   */
  counter: number | 'unknown';
  /** ISO timestamp of the last completed backup, or null when never. */
  lastBackupAt: string | null;
  /** Canonical snapshot hash recorded at the last completed backup. */
  lastBackupHash: string | null;
}

/**
 * Read the cue state. At most two metadata reads plus one legacy localStorage
 * fallback; never computes the hash.
 */
export async function getCueState(): Promise<CueState> {
  let counter: number | 'unknown' = 'unknown';
  let lastBackupAt: string | null = null;
  let lastBackupHash: string | null = null;

  try {
    const raw = await getMetadata(BACKUP_WRITE_COUNTER_KEY);
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      counter = raw;
    }
    const at = await getMetadata(LAST_BACKUP_AT_KEY);
    if (typeof at === 'string' && at) {
      lastBackupAt = at;
    }
    const hash = await getMetadata(LAST_BACKUP_HASH_KEY);
    if (typeof hash === 'string' && hash) {
      lastBackupHash = hash;
    }
  } catch {
    // A failed metadata read maps to counter-unknown, which claims the cue.
  }

  if (!lastBackupAt) {
    // Cold start honors diligence (DR7): a pre-ship backup stamped only the
    // legacy localStorage key; surface it rather than claiming "never".
    try {
      const legacy = localStorage.getItem(LEGACY_LAST_BACKUP_LOCALSTORAGE_KEY);
      if (legacy && Number.isFinite(Date.parse(legacy))) {
        lastBackupAt = legacy;
      }
    } catch {
      // localStorage unavailable
    }
  }

  return { counter, lastBackupAt, lastBackupHash };
}

/**
 * The dashboard calm gate: calm ONLY when the counter says zero AND the
 * current canonical-snapshot hash matches the one stored at the last backup.
 * If an unwired write path ever makes the two disagree, truth wins and the
 * card shows unprotected work.
 */
export function isCalmState(cue: CueState, currentHash: string): boolean {
  return cue.counter === 0 && cue.lastBackupHash !== null && cue.lastBackupHash === currentHash;
}

/**
 * Record a completed backup's baseline: counter to exact zero, timestamp and
 * snapshot hash stamped, legacy localStorage key mirrored for older readers.
 * Callers gate this on a real per-transport completion signal — never on the
 * strength of a click alone.
 */
export async function recordBackupBaseline(timestampIso: string, snapshotHash: string): Promise<void> {
  await setMetadata(BACKUP_WRITE_COUNTER_KEY, 0);
  await setMetadata(LAST_BACKUP_AT_KEY, timestampIso);
  await setMetadata(LAST_BACKUP_HASH_KEY, snapshotHash);
  try {
    localStorage.setItem(LEGACY_LAST_BACKUP_LOCALSTORAGE_KEY, timestampIso);
  } catch {
    // localStorage unavailable; the metadata record is the authoritative one
  }
}
