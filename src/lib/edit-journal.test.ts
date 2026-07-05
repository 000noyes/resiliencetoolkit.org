/**
 * Edit-journal tests — the flood-grade durability backstop.
 *
 * Two surfaces:
 *   1. The synchronous localStorage journal writers (journalRowEdit /
 *      journalRowDelete / clearJournalRow / readJournal) — pure, no IDB.
 *   2. replayEditJournal — the CRITICAL reconcile-on-load path. It must
 *      reconcile by updatedAt (never clobber a newer saved row) and respect
 *      deletes (never resurrect a tombstoned row). Untested, this is a silent
 *      data-corruption path (eng review CRITICAL gap).
 *
 * Run: pnpm vitest run src/lib/edit-journal.test.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';

import {
  journalRowEdit,
  journalRowDelete,
  clearJournalRow,
  readJournal,
  replayEditJournal,
  applyJournalToTables,
  JOURNAL_PREFIX,
} from './edit-journal';

beforeEach(() => {
  localStorage.clear();
});

// A minimal `tables`-store DB, keyed by `id` exactly like the real schema.
// Decoupled from storage.ts on purpose — replayEditJournal only needs a
// store it can get/put/delete by composite id.
async function makeTablesDb(name: string): Promise<IDBPDatabase<any>> {
  return openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('tables', { keyPath: 'id' });
    },
  });
}

function tableRecord(
  moduleKey: string,
  tableId: string,
  rowId: string,
  data: Record<string, string>,
  updatedAt: string,
) {
  return { id: `${moduleKey}-${tableId}-${rowId}`, moduleKey, tableId, rowId, data, updatedAt };
}

// ---------------------------------------------------------------------------
// Synchronous journal writers
// ---------------------------------------------------------------------------
describe('journal writers', () => {
  it('journalRowEdit writes a put entry keyed by composite id', () => {
    journalRowEdit({
      moduleKey: 'mod',
      tableId: 'tbl',
      rowId: 'row-1',
      data: { a: 'hello' },
      updatedAt: '2026-07-04T10:00:00.000Z',
    });
    const journal = readJournal();
    const entry = journal['mod-tbl-row-1'];
    expect(entry).toBeDefined();
    expect(entry.deleted).toBeFalsy();
    expect(entry).toMatchObject({
      id: 'mod-tbl-row-1',
      moduleKey: 'mod',
      tableId: 'tbl',
      rowId: 'row-1',
      data: { a: 'hello' },
      updatedAt: '2026-07-04T10:00:00.000Z',
    });
  });

  it('journalRowDelete upserts a tombstone that REPLACES an existing put (delete wins)', () => {
    journalRowEdit({
      moduleKey: 'mod',
      tableId: 'tbl',
      rowId: 'row-1',
      data: { a: 'typed' },
      updatedAt: '2026-07-04T10:00:00.000Z',
    });
    journalRowDelete('mod', 'tbl', 'row-1', '2026-07-04T10:00:01.000Z');
    const entry = readJournal()['mod-tbl-row-1'];
    expect(entry.deleted).toBe(true);
    expect(entry.updatedAt).toBe('2026-07-04T10:00:01.000Z');
    // No stale row data lingers under the tombstone.
    expect((entry as any).data).toBeUndefined();
  });

  it('journalRowEdit after a delete replaces the tombstone with the latest edit', () => {
    journalRowDelete('mod', 'tbl', 'row-1', '2026-07-04T10:00:00.000Z');
    journalRowEdit({
      moduleKey: 'mod',
      tableId: 'tbl',
      rowId: 'row-1',
      data: { a: 're-added' },
      updatedAt: '2026-07-04T10:00:02.000Z',
    });
    const entry = readJournal()['mod-tbl-row-1'];
    expect(entry.deleted).toBeFalsy();
    expect((entry as any).data).toEqual({ a: 're-added' });
  });

  it('clearJournalRow removes a single entry, leaving others', () => {
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-1', data: {}, updatedAt: 't1' });
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-2', data: {}, updatedAt: 't2' });
    clearJournalRow('mod', 'tbl', 'row-1');
    const journal = readJournal();
    expect(journal['mod-tbl-row-1']).toBeUndefined();
    expect(journal['mod-tbl-row-2']).toBeDefined();
  });

  it('readJournal returns {} when empty; a corrupt entry is skipped without hiding others', () => {
    expect(readJournal()).toEqual({});
    localStorage.setItem(`${JOURNAL_PREFIX}mod-tbl-corrupt`, '{not valid json');
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'ok', data: {}, updatedAt: 't1' });
    const journal = readJournal();
    expect(journal['mod-tbl-corrupt']).toBeUndefined();
    expect(journal['mod-tbl-ok']).toBeDefined();
  });

  it('each entry is its own localStorage key (no whole-journal blob rewrite)', () => {
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-1', data: {}, updatedAt: 't1' });
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-2', data: {}, updatedAt: 't2' });
    expect(localStorage.getItem(`${JOURNAL_PREFIX}mod-tbl-row-1`)).toBeTruthy();
    expect(localStorage.getItem(`${JOURNAL_PREFIX}mod-tbl-row-2`)).toBeTruthy();
    // Clearing one row physically touches only its own key.
    clearJournalRow('mod', 'tbl', 'row-1');
    expect(localStorage.getItem(`${JOURNAL_PREFIX}mod-tbl-row-1`)).toBeNull();
    expect(localStorage.getItem(`${JOURNAL_PREFIX}mod-tbl-row-2`)).toBeTruthy();
  });

  it('clearJournalRow with ifNotNewerThan KEEPS a newer entry (keystroke during in-flight save)', () => {
    // The save that is about to confirm was journaled at t1...
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-1', data: { a: 'v1' }, updatedAt: '2026-07-05T10:00:00.000Z' });
    // ...but a newer keystroke was journaled while that save was in flight.
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-1', data: { a: 'v2' }, updatedAt: '2026-07-05T10:00:01.000Z' });
    // The t1 save resolves and tries to clear its backstop.
    clearJournalRow('mod', 'tbl', 'row-1', '2026-07-05T10:00:00.000Z');
    const entry = readJournal()['mod-tbl-row-1'];
    expect(entry).toBeDefined();
    expect((entry as any).data).toEqual({ a: 'v2' });
  });

  it('clearJournalRow with ifNotNewerThan clears an equal-or-older entry', () => {
    journalRowEdit({ moduleKey: 'mod', tableId: 'tbl', rowId: 'row-1', data: { a: 'v1' }, updatedAt: '2026-07-05T10:00:00.000Z' });
    clearJournalRow('mod', 'tbl', 'row-1', '2026-07-05T10:00:00.000Z');
    expect(readJournal()['mod-tbl-row-1']).toBeUndefined();
  });

  it('swallows a localStorage failure (private mode / disabled storage)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    // Must not throw — the app falls back to the IDB-only path.
    expect(() =>
      journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r', data: {}, updatedAt: 't1' }),
    ).not.toThrow();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// replayEditJournal — CRITICAL reconcile-on-load
// ---------------------------------------------------------------------------
describe('replayEditJournal (reconcile by updatedAt + respect deletes)', () => {
  let db: IDBPDatabase<any>;
  let dbName = 0;

  beforeEach(async () => {
    // Fresh DB per test (fake-indexeddb persists across a single test file).
    db = await makeTablesDb(`replay-${dbName++}`);
  });

  afterEach(() => {
    db.close();
  });

  it('recovers a journaled edit when IDB has no such row (the loss case)', async () => {
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'recovered' }, updatedAt: '2026-07-04T10:00:00.000Z' });
    const res = await replayEditJournal(db);
    expect(res.recovered).toBe(1);
    const row = await db.get('tables', 'm-t-r1');
    expect(row.data).toEqual({ v: 'recovered' });
    // Applied entry is cleared from the journal.
    expect(readJournal()['m-t-r1']).toBeUndefined();
  });

  it('recovers over a STALE IDB row (journal edit is newer)', async () => {
    await db.put('tables', tableRecord('m', 't', 'r1', { v: 'old' }, '2026-07-04T09:00:00.000Z'));
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'new' }, updatedAt: '2026-07-04T10:00:00.000Z' });
    const res = await replayEditJournal(db);
    expect(res.recovered).toBe(1);
    const row = await db.get('tables', 'm-t-r1');
    expect(row.data).toEqual({ v: 'new' });
  });

  it('does NOT clobber a NEWER IDB row (the corruption path the test guards)', async () => {
    // IDB already holds a save that landed AFTER the journaled change (e.g. a
    // later edit saved; the stale journal entry was never cleared).
    await db.put('tables', tableRecord('m', 't', 'r1', { v: 'newer-saved' }, '2026-07-04T11:00:00.000Z'));
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'stale-journal' }, updatedAt: '2026-07-04T10:00:00.000Z' });
    const res = await replayEditJournal(db);
    expect(res.skipped).toBe(1);
    expect(res.recovered).toBe(0);
    const row = await db.get('tables', 'm-t-r1');
    expect(row.data).toEqual({ v: 'newer-saved' });
    // The stale entry is still cleared (it has been reconciled, not lost-forever).
    expect(readJournal()['m-t-r1']).toBeUndefined();
  });

  it('skips when IDB updatedAt EQUALS the journal (IDB wins on ties)', async () => {
    const ts = '2026-07-04T10:00:00.000Z';
    await db.put('tables', tableRecord('m', 't', 'r1', { v: 'idb' }, ts));
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'journal' }, updatedAt: ts });
    await replayEditJournal(db);
    const row = await db.get('tables', 'm-t-r1');
    expect(row.data).toEqual({ v: 'idb' });
  });

  it('respects a tombstone: deletes a row that was tombstoned (no resurrection)', async () => {
    await db.put('tables', tableRecord('m', 't', 'r1', { v: 'to-delete' }, '2026-07-04T10:00:00.000Z'));
    journalRowDelete('m', 't', 'r1', '2026-07-04T10:00:05.000Z');
    const res = await replayEditJournal(db);
    expect(res.deleted).toBe(1);
    expect(await db.get('tables', 'm-t-r1')).toBeUndefined();
  });

  it('does NOT delete when a NEWER IDB edit landed after the tombstone', async () => {
    // User deleted, then (another tab / a later re-add) saved a newer row.
    await db.put('tables', tableRecord('m', 't', 'r1', { v: 'newer' }, '2026-07-04T11:00:00.000Z'));
    journalRowDelete('m', 't', 'r1', '2026-07-04T10:00:00.000Z');
    await replayEditJournal(db);
    const row = await db.get('tables', 'm-t-r1');
    expect(row).toBeDefined();
    expect(row.data).toEqual({ v: 'newer' });
  });

  it('edit-then-delete in one session leaves the row absent after replay', async () => {
    await db.put('tables', tableRecord('m', 't', 'r1', { v: 'saved' }, '2026-07-04T10:00:00.000Z'));
    // The user typed (journaled), then deleted (tombstone upserts over the edit).
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'typed' }, updatedAt: '2026-07-04T10:00:01.000Z' });
    journalRowDelete('m', 't', 'r1', '2026-07-04T10:00:02.000Z');
    await replayEditJournal(db);
    expect(await db.get('tables', 'm-t-r1')).toBeUndefined();
  });

  it('no-ops cleanly on an empty journal', async () => {
    const res = await replayEditJournal(db);
    expect(res).toEqual({ recovered: 0, deleted: 0, skipped: 0 });
  });

  it('does NOT clear an entry that was re-journaled NEWER while replay was in flight', async () => {
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'first' }, updatedAt: '2026-07-05T10:00:00.000Z' });
    // Wrap the db so that during replay's async put, a newer edit lands in the
    // journal (same shape as a keystroke in this tab or a write from another).
    const wrapped = {
      get: (store: string, id: string) => db.get(store, id),
      delete: (store: string, id: string) => db.delete(store, id),
      put: async (store: string, value: any) => {
        journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'newer' }, updatedAt: '2026-07-05T10:00:05.000Z' });
        return db.put(store, value);
      },
    } as unknown as IDBPDatabase<any>;
    await replayEditJournal(wrapped);
    // The snapshot entry was applied, but the NEWER journal entry survives as
    // the backstop for the not-yet-saved edit.
    const entry = readJournal()['m-t-r1'];
    expect(entry).toBeDefined();
    expect((entry as any).data).toEqual({ v: 'newer' });
    // And a second replay reconciles it into IDB.
    const res2 = await replayEditJournal(db);
    expect(res2.recovered).toBe(1);
    const row = await db.get('tables', 'm-t-r1');
    expect(row.data).toEqual({ v: 'newer' });
    expect(readJournal()['m-t-r1']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyJournalToTables — in-memory export merge (backup completeness under
// quota pressure, when the replay-into-IDB flush cannot land)
// ---------------------------------------------------------------------------
describe('applyJournalToTables (backup export merge)', () => {
  it('returns the rows unchanged when the journal is empty', () => {
    const rows = [tableRecord('m', 't', 'r1', { v: 'saved' }, '2026-07-05T10:00:00.000Z')];
    expect(applyJournalToTables(rows, {})).toBe(rows);
  });

  it('adds a journal-only edit missing from the export (the quota-loss case)', () => {
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'journal-only' }, updatedAt: '2026-07-05T10:00:00.000Z' });
    const merged = applyJournalToTables([], readJournal());
    expect(merged).toHaveLength(1);
    expect((merged[0] as any).data).toEqual({ v: 'journal-only' });
  });

  it('replaces an older exported row with the newer journal edit', () => {
    const rows = [tableRecord('m', 't', 'r1', { v: 'old' }, '2026-07-05T09:00:00.000Z')];
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'new' }, updatedAt: '2026-07-05T10:00:00.000Z' });
    const merged = applyJournalToTables(rows, readJournal());
    expect(merged).toHaveLength(1);
    expect((merged[0] as any).data).toEqual({ v: 'new' });
  });

  it('does NOT clobber a newer-or-equal exported row (same rule as replay)', () => {
    const rows = [tableRecord('m', 't', 'r1', { v: 'newer-saved' }, '2026-07-05T11:00:00.000Z')];
    journalRowEdit({ moduleKey: 'm', tableId: 't', rowId: 'r1', data: { v: 'stale' }, updatedAt: '2026-07-05T10:00:00.000Z' });
    const merged = applyJournalToTables(rows, readJournal());
    expect((merged[0] as any).data).toEqual({ v: 'newer-saved' });
  });

  it('a tombstone removes the exported row unless a newer edit landed', () => {
    const rows = [
      tableRecord('m', 't', 'r1', { v: 'deleted' }, '2026-07-05T10:00:00.000Z'),
      tableRecord('m', 't', 'r2', { v: 'kept-newer' }, '2026-07-05T12:00:00.000Z'),
    ];
    journalRowDelete('m', 't', 'r1', '2026-07-05T10:00:05.000Z');
    journalRowDelete('m', 't', 'r2', '2026-07-05T11:00:00.000Z');
    const merged = applyJournalToTables(rows, readJournal());
    expect(merged).toHaveLength(1);
    expect((merged[0] as any).id).toBe('m-t-r2');
  });
});
