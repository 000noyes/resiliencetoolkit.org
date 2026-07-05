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
 * Storage layout: ONE localStorage key PER ENTRY (`rt-edit-journal:<id>`), not
 * one JSON blob for the whole journal. A blob means every write and clear is a
 * read-modify-write of the entire map, so two tabs interleaving on UNRELATED
 * rows can silently drop each other's entries (last writer wins on the blob).
 * Per-entry keys make each row's journal write/clear independent; the only
 * remaining cross-tab race is two tabs editing the SAME row at the same
 * moment, where last-writer-wins is the correct "latest intent" semantics.
 *
 * Replay reconciles by `updatedAt` and respects deletes:
 *   - a journaled edit NEVER clobbers a newer saved IDB row;
 *   - a tombstoned (deleted) row is NEVER resurrected.
 * Clearing is CONDITIONAL: an entry is only removed if it is not newer than
 * the write that was just confirmed durable. Without this, a slow async save
 * resolving AFTER a newer keystroke was journaled would clear the newer
 * entry's backstop, and a tab kill before the next debounced save would lose
 * the newest keystrokes — the exact class this journal exists to prevent.
 */
import type { IDBPDatabase } from 'idb';

/** Per-entry key prefix. Full key = `rt-edit-journal:<compositeId>`. */
export const JOURNAL_PREFIX = 'rt-edit-journal:';

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

function entryKey(id: string): string {
  return `${JOURNAL_PREFIX}${id}`;
}

/** Parse one journal entry value. Returns null on corrupt/invalid content. */
function parseEntry(raw: string | null): JournalEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof parsed.id !== 'string' || typeof parsed.updatedAt !== 'string') return null;
    return parsed as JournalEntry;
  } catch {
    return null;
  }
}

/** Read one entry by composite id. Returns null when absent/corrupt/unavailable. */
function readEntry(id: string): JournalEntry | null {
  try {
    return parseEntry(localStorage.getItem(entryKey(id)));
  } catch {
    return null;
  }
}

/**
 * Read all journal entries as a map keyed by composite id. Returns {} on any
 * failure (localStorage unavailable) — a corrupt journal must never break
 * startup. Corrupt individual entries are skipped (never returned).
 */
export function readJournal(): JournalMap {
  const map: JournalMap = {};
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(JOURNAL_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      const entry = parseEntry(localStorage.getItem(key));
      if (entry) map[entry.id] = entry;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Record a row edit synchronously. Upserts by composite id, replacing any
 * prior entry (including a tombstone) so the journal always holds the latest
 * intent for that row. A single setItem — no read-modify-write of other
 * entries, so concurrent tabs editing other rows are unaffected.
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
    const entry: JournalPut = {
      id,
      moduleKey: row.moduleKey,
      tableId: row.tableId,
      rowId: row.rowId,
      data: row.data,
      updatedAt: row.updatedAt,
    };
    localStorage.setItem(entryKey(id), JSON.stringify(entry));
  } catch {
    // Private mode, disabled storage, or quota — fall back to IDB-only.
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
    const entry: JournalTombstone = { id, updatedAt, deleted: true };
    localStorage.setItem(entryKey(id), JSON.stringify(entry));
  } catch {
    // ignore
  }
}

/**
 * Remove one entry once its IDB write/delete is confirmed durable.
 *
 * `ifNotNewerThan` guards the async gap between scheduling a save and its
 * completion: pass the `updatedAt` of the write that just landed, and the
 * entry is kept when the journal now holds something NEWER (a keystroke that
 * arrived while the save was in flight). Omit it only on discard paths
 * (Escape / revert-to-saved), where whatever is journaled for the row is the
 * intermediate value being intentionally thrown away.
 */
export function clearJournalRow(
  moduleKey: string,
  tableId: string,
  rowId: string,
  ifNotNewerThan?: string,
): void {
  clearJournalId(compositeId(moduleKey, tableId, rowId), ifNotNewerThan);
}

/** Remove one entry by its composite id (shared by clearJournalRow and replay). */
function clearJournalId(id: string, ifNotNewerThan?: string): void {
  try {
    const entry = readEntry(id);
    if (!entry) {
      // Corrupt or absent — a corrupt entry is unusable, drop the key if present.
      localStorage.removeItem(entryKey(id));
      return;
    }
    if (ifNotNewerThan !== undefined && entry.updatedAt > ifNotNewerThan) {
      // A newer edit was journaled while the confirmed write was in flight;
      // keep its backstop.
      return;
    }
    localStorage.removeItem(entryKey(id));
  } catch {
    // ignore
  }
}

export interface ReplayResult {
  recovered: number;
  deleted: number;
  skipped: number;
}

/** The minimal row shape the export merge needs (structurally a TableRow). */
interface ExportableRow {
  id: string;
  updatedAt: string;
}

/**
 * Overlay journal entries onto an exported `tables` array, in memory, using
 * the same reconcile rules as replay (newer wins; tombstones remove).
 *
 * Backup depends on the journal being flushed into IndexedDB first, but under
 * quota pressure those IDB writes are exactly what fails — leaving the user's
 * newest keystrokes journal-only at the moment a backup matters most. This
 * merge makes the downloaded file complete even when IDB cannot accept the
 * writes. Pure and synchronous; touches nothing in storage.
 */
export function applyJournalToTables<T extends ExportableRow>(
  rows: T[],
  journal: Record<string, JournalEntry> = readJournal(),
): (T | Omit<JournalPut, 'deleted'>)[] {
  const entries = Object.values(journal);
  if (entries.length === 0) return rows;

  const out: (T | Omit<JournalPut, 'deleted'>)[] = [...rows];
  for (const entry of entries) {
    const idx = out.findIndex((r) => r.id === entry.id);
    const existing = idx === -1 ? undefined : out[idx];

    if (entry.deleted) {
      // Same rule as replay: respect a newer edit that landed after the delete.
      if (existing && existing.updatedAt <= entry.updatedAt) {
        out.splice(idx, 1);
      }
      continue;
    }

    // put: never clobber a newer-or-equal exported row.
    if (existing && existing.updatedAt >= entry.updatedAt) continue;
    const row = {
      id: entry.id,
      moduleKey: entry.moduleKey,
      tableId: entry.tableId,
      rowId: entry.rowId,
      data: entry.data,
      updatedAt: entry.updatedAt,
    };
    if (idx === -1) {
      out.push(row);
    } else {
      out[idx] = row;
    }
  }
  return out;
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
 * Each reconciled entry is cleared CONDITIONALLY on the snapshot's updatedAt,
 * so an edit journaled while replay was in flight (this tab or another) is
 * never dropped. A snapshot is taken up front so concurrent replays (multiple
 * components mount and each calls initializeStorage) are idempotent: a
 * double-applied entry reconciles to the same result. An entry whose IDB
 * write throws is left in the journal for the next load.
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
        clearJournalId(entry.id, entry.updatedAt);
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
      clearJournalId(entry.id, entry.updatedAt);
    } catch (err) {
      // Leave this entry for the next load; do not abort the whole replay.
      if (import.meta.env.DEV) {
        console.error('[edit-journal] replay failed for', entry.id, err);
      }
    }
  }

  return result;
}
