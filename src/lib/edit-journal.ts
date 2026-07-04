/**
 * Edit journal — the flood-grade durability backstop.
 *
 * Every edit to a table row is written SYNCHRONOUSLY to a localStorage journal
 * at the moment of change, before the debounced IndexedDB write fires.
 * localStorage writes complete synchronously and survive a tab that is frozen,
 * killed, or closed during the ~300ms debounce window — the exact gap that
 * dropped a real user's work (they typed, closed the tab before the blur/save,
 * and the best-effort IndexedDB write never ran). On the next load,
 * `initializeStorage()` replays the journal into IndexedDB.
 *
 * The journal is localStorage, NOT IndexedDB, on purpose: it must capture the
 * edit synchronously at keystroke time, which the async IDB write cannot do.
 * A localStorage failure (private mode, disabled storage, quota) is swallowed —
 * the app falls back to the IDB-only path, which is exactly today's behavior.
 *
 * Replay reconciles by `updatedAt` and respects deletes:
 *   - a journaled edit NEVER clobbers a newer saved IDB row;
 *   - a tombstoned (deleted) row is NEVER resurrected.
 * This reconcile is the one correctness invariant the eng review flagged as a
 * silent-corruption path if untested (see edit-journal.test.ts).
 */
import type { IDBPDatabase } from 'idb';

export const JOURNAL_KEY = 'rt-edit-journal';

/**
 * The save-on-change debounce window. This is the exact gap the journal exists
 * to cover, so the editors that debounce IndexedDB writes and the journal share
 * one constant rather than each redeclaring it.
 */
export const SAVE_DEBOUNCE_MS = 300;

/** A pending row write, replayed with its change-time `updatedAt`. */
export interface JournalPut {
  id: string;
  moduleKey: string;
  tableId: string;
  rowId: string;
  data: Record<string, string>;
  updatedAt: string;
  deleted?: false;
}

/** A pending row delete. Replay ensures the row is absent (respecting a newer edit). */
export interface JournalTombstone {
  id: string;
  updatedAt: string;
  deleted: true;
}

export type JournalEntry = JournalPut | JournalTombstone;

type JournalMap = Record<string, JournalEntry>;

function compositeId(moduleKey: string, tableId: string, rowId: string): string {
  return `${moduleKey}-${tableId}-${rowId}`;
}

/**
 * Read and parse the journal. Returns {} on any failure (missing, corrupt,
 * or localStorage unavailable) — a corrupt journal must never break startup.
 */
export function readJournal(): JournalMap {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as JournalMap;
  } catch {
    return {};
  }
}

/** Persist the journal map. Swallows failures (private mode / quota). */
function writeJournal(map: JournalMap): void {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(map));
  } catch {
    // Private mode, disabled storage, or quota — fall back to IDB-only.
  }
}

/**
 * Record a row edit synchronously. Upserts by composite id, replacing any
 * prior entry (including a tombstone) so the journal always holds the latest
 * intent for that row.
 */
export function journalRowEdit(row: {
  moduleKey: string;
  tableId: string;
  rowId: string;
  data: Record<string, string>;
  updatedAt: string;
}): void {
  try {
    const id = compositeId(row.moduleKey, row.tableId, row.rowId);
    const map = readJournal();
    map[id] = {
      id,
      moduleKey: row.moduleKey,
      tableId: row.tableId,
      rowId: row.rowId,
      data: row.data,
      updatedAt: row.updatedAt,
    };
    writeJournal(map);
  } catch {
    // Never let journaling break a keystroke.
  }
}

/**
 * Record a row delete synchronously as a tombstone. Upserts by composite id,
 * replacing any prior edit entry — so a delete after an in-flight edit cannot
 * be resurrected by replay.
 */
export function journalRowDelete(
  moduleKey: string,
  tableId: string,
  rowId: string,
  updatedAt: string,
): void {
  try {
    const id = compositeId(moduleKey, tableId, rowId);
    const map = readJournal();
    map[id] = { id, updatedAt, deleted: true };
    writeJournal(map);
  } catch {
    // ignore
  }
}

/** Remove one entry once its IDB write/delete is confirmed durable. */
export function clearJournalRow(moduleKey: string, tableId: string, rowId: string): void {
  try {
    const id = compositeId(moduleKey, tableId, rowId);
    const map = readJournal();
    if (id in map) {
      delete map[id];
      writeJournal(map);
    }
  } catch {
    // ignore
  }
}

/** Remove one entry by its composite id (used by replay). */
function clearJournalId(id: string): void {
  try {
    const map = readJournal();
    if (id in map) {
      delete map[id];
      writeJournal(map);
    }
  } catch {
    // ignore
  }
}

export interface ReplayResult {
  recovered: number;
  deleted: number;
  skipped: number;
}

/**
 * Replay the journal into IndexedDB, reconciling by `updatedAt`.
 *
 * For each entry, compare against the current IDB row:
 *   - put: write only when IDB has no row or an OLDER one; skip when IDB is
 *     newer-or-equal (never clobber a save that already landed).
 *   - tombstone: delete only when IDB has no newer edit; skip when a newer
 *     edit landed after the delete (never drop a fresher write).
 *
 * Each reconciled entry is cleared. A snapshot is taken up front so concurrent
 * replays (multiple components mount and each calls initializeStorage) are
 * idempotent: a double-applied entry reconciles to the same result. An entry
 * whose IDB write throws is left in the journal for the next load.
 */
export async function replayEditJournal(db: IDBPDatabase<any>): Promise<ReplayResult> {
  const result: ReplayResult = { recovered: 0, deleted: 0, skipped: 0 };
  let snapshot: JournalMap;
  try {
    snapshot = readJournal();
  } catch {
    return result;
  }

  const entries = Object.values(snapshot);
  if (entries.length === 0) return result;

  for (const entry of entries) {
    try {
      const existing = await db.get('tables', entry.id);

      if (entry.deleted) {
        // Respect a newer edit that landed after the delete was journaled.
        if (existing && existing.updatedAt > entry.updatedAt) {
          result.skipped++;
        } else if (existing) {
          await db.delete('tables', entry.id);
          result.deleted++;
        }
        clearJournalId(entry.id);
        continue;
      }

      // put: never clobber a newer-or-equal saved row.
      if (existing && existing.updatedAt >= entry.updatedAt) {
        result.skipped++;
      } else {
        await db.put('tables', {
          id: entry.id,
          moduleKey: entry.moduleKey,
          tableId: entry.tableId,
          rowId: entry.rowId,
          data: entry.data,
          updatedAt: entry.updatedAt,
        });
        result.recovered++;
      }
      clearJournalId(entry.id);
    } catch (err) {
      // Leave this entry for the next load; do not abort the whole replay.
      if (import.meta.env.DEV) {
        console.error('[edit-journal] replay failed for', entry.id, err);
      }
    }
  }

  return result;
}
