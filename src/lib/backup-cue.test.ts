/**
 * Backup cue mechanism — the work-based cue that replaces every time-based
 * backup nudge.
 *
 * Covers:
 *   - the write counter: leaf-writer increments (saveTodo, deleteTodo,
 *     saveTableRow, deleteTableRow, savePersonalNotes, batch and clear paths),
 *     wrapper inheritance without double-counting, and the setMetadata
 *     diagnostics path that must NOT self-increment
 *   - cold-start honesty: an absent counter stays 'unknown' (never invents an
 *     exact count over pre-existing work); only a recorded backup baseline
 *     starts exact counting at zero
 *   - the has-work canary (localStorage, deliberately: divergent survival vs
 *     IndexedDB is the loss-detected signal) carrying the module map
 *   - the canonical work snapshot: volatile metadata excluded, deterministic
 *     serialization, SHA-256 hash stability
 *   - the backup baseline record: counter reset + timestamp + hash, with the
 *     legacy localStorage mirror
 *
 * Run: pnpm vitest run src/lib/backup-cue.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import {
  saveTodo,
  toggleTodo,
  deleteTodo,
  saveTableRow,
  deleteTableRow,
  savePersonalNotes,
  batchUpdateChecklistItems,
  clearCompletedItems,
  setMetadata,
  getMetadata,
  deleteMetadata,
  initializeStorage,
  flushEditJournalToStorage,
  exportAllData,
  BACKUP_WRITE_COUNTER_KEY,
  LAST_BACKUP_AT_KEY,
  LAST_BACKUP_HASH_KEY,
  HAS_WORK_CANARY_KEY,
} from './storage';
import { LAST_BACKUP_KEY } from './backup';
import {
  readCanary,
  detectPossibleLoss,
  buildWorkSnapshot,
  serializeSnapshot,
  computeSnapshotHash,
  getCueState,
  recordBackupBaseline,
  isCalmState,
} from './backup-cue';
import { JOURNAL_PREFIX } from './edit-journal';

// jsdom has no SubtleCrypto; the browser and Node both do.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

beforeEach(async () => {
  localStorage.clear();
  // The DB singleton shares state across tests (gotcha 2): reset the cue
  // metadata so absent-counter (cold start) assumptions hold per test.
  await deleteMetadata(BACKUP_WRITE_COUNTER_KEY);
  await deleteMetadata(LAST_BACKUP_AT_KEY);
  await deleteMetadata(LAST_BACKUP_HASH_KEY);
});

/** Read the raw counter metadata value (undefined when absent). */
async function counterValue(): Promise<unknown> {
  return await getMetadata(BACKUP_WRITE_COUNTER_KEY);
}

/** Seed the counter to an exact number, as a completed backup would. */
async function seedCounter(n: number): Promise<void> {
  await setMetadata(BACKUP_WRITE_COUNTER_KEY, n);
}

describe('write counter: leaf-writer increments', () => {
  it('saveTodo increments an existing counter by 1', async () => {
    await seedCounter(0);
    await saveTodo({ moduleKey: 'cue-save-todo', todoId: 't1', completed: true });
    expect(await counterValue()).toBe(1);
  });

  it('toggleTodo counts exactly once (via its saveTodo leaf, no double count)', async () => {
    await seedCounter(0);
    await toggleTodo('cue-toggle', 't1');
    expect(await counterValue()).toBe(1);
  });

  it('deleteTodo increments', async () => {
    await seedCounter(0);
    await saveTodo({ moduleKey: 'cue-del-todo', todoId: 't1', completed: false });
    await deleteTodo('cue-del-todo', 't1');
    expect(await counterValue()).toBe(2);
  });

  it('saveTableRow and deleteTableRow each increment', async () => {
    await seedCounter(0);
    await saveTableRow({ moduleKey: 'cue-table', tableId: 'tab', rowId: 'r1', data: { a: 'x' } });
    await deleteTableRow('cue-table', 'tab', 'r1');
    expect(await counterValue()).toBe(2);
  });

  it('savePersonalNotes increments exactly once (increment lives at the leaf, not in setMetadata)', async () => {
    await seedCounter(0);
    await savePersonalNotes('my notes');
    expect(await counterValue()).toBe(1);
  });

  it('generic setMetadata does NOT increment (diagnostics would self-count)', async () => {
    await seedCounter(0);
    await setMetadata('storageDiagnostic', { persisted: false });
    await setMetadata('storagePersisted', false);
    expect(await counterValue()).toBe(0);
  });

  it('batchUpdateChecklistItems counts one per landed item', async () => {
    await seedCounter(0);
    await batchUpdateChecklistItems([
      { moduleKey: 'cue-batch', todoId: 'a', completed: true },
      { moduleKey: 'cue-batch', todoId: 'b', completed: true },
      { moduleKey: 'cue-batch', todoId: 'c', completed: false },
    ]);
    expect(await counterValue()).toBe(3);
  });

  it('clearCompletedItems counts one per deleted item', async () => {
    await batchUpdateChecklistItems([
      { moduleKey: 'cue-clear', todoId: 'a', completed: true },
      { moduleKey: 'cue-clear', todoId: 'b', completed: true },
      { moduleKey: 'cue-clear', todoId: 'c', completed: false },
    ]);
    await seedCounter(0);
    const removed = await clearCompletedItems('cue-clear');
    expect(removed).toBe(2);
    expect(await counterValue()).toBe(2);
  });
});

describe('machine writes never count as user work', () => {
  it('seedTableRow lands the row without touching the counter or the canary', async () => {
    const { seedTableRow, getTableRow } = await import('./storage');
    await seedCounter(0);
    await seedTableRow({
      moduleKey: 'cue-seed-mod',
      tableId: 'tab',
      rowId: 'r1',
      data: { prompt: 'pre-populated' },
    });
    expect(await counterValue()).toBe(0);
    expect(readCanary()).toBeNull();
    expect(await getTableRow('cue-seed-mod', 'tab', 'r1')).toBeDefined();
  });
});

describe('write counter: cold-start honesty (DR7)', () => {
  it('an absent counter stays absent through user writes (unknown, never a fake exact count)', async () => {
    await saveTodo({ moduleKey: 'cue-cold', todoId: 't1', completed: true });
    expect(await counterValue()).toBeUndefined();
  });

  it('getCueState maps an absent counter to unknown', async () => {
    const cue = await getCueState();
    expect(cue.counter).toBe('unknown');
  });

  it('getCueState returns the exact number once a baseline exists', async () => {
    await recordBackupBaseline('2026-07-18T12:00:00.000Z', 'abc123');
    await saveTodo({ moduleKey: 'cue-exact', todoId: 't1', completed: true });
    const cue = await getCueState();
    expect(cue.counter).toBe(1);
  });

  it('cold start honors prior diligence: legacy localStorage timestamp surfaces as lastBackupAt', async () => {
    localStorage.setItem(LAST_BACKUP_KEY, '2026-07-01T00:00:00.000Z');
    const cue = await getCueState();
    expect(cue.lastBackupAt).toBe('2026-07-01T00:00:00.000Z');
    expect(cue.counter).toBe('unknown');
  });

  it('the metadata timestamp wins over the legacy localStorage one', async () => {
    localStorage.setItem(LAST_BACKUP_KEY, '2026-07-01T00:00:00.000Z');
    await recordBackupBaseline('2026-07-18T12:00:00.000Z', 'h');
    const cue = await getCueState();
    expect(cue.lastBackupAt).toBe('2026-07-18T12:00:00.000Z');
  });
});

describe('has-work canary (DR6: the canary carries the module map)', () => {
  it('a user write marks the canary with its moduleKey', async () => {
    await saveTableRow({ moduleKey: 'cue-canary', tableId: 'tab', rowId: 'r1', data: { a: 'x' } });
    const canary = readCanary();
    expect(canary).not.toBeNull();
    expect(canary!.modules['cue-canary']).toBe(true);
  });

  it('personal notes mark the canary under personal-notes', async () => {
    await savePersonalNotes('hello');
    expect(readCanary()!.modules['personal-notes']).toBe(true);
  });

  it('readCanary returns null when absent and on corrupt content', () => {
    expect(readCanary()).toBeNull();
    localStorage.setItem(HAS_WORK_CANARY_KEY, '{not json');
    expect(readCanary()).toBeNull();
  });

  it('detectPossibleLoss fires only on divergent survival (canary yes, stores empty)', () => {
    // no canary, empty stores: a browse-only visitor can never trip it
    expect(detectPossibleLoss(null, { todos: 0, tables: 0, hasNotes: false })).toBe(false);
    const canary = { modules: { m: true }, updatedAt: '2026-07-18T00:00:00.000Z' };
    // canary + surviving data: no loss
    expect(detectPossibleLoss(canary, { todos: 1, tables: 0, hasNotes: false })).toBe(false);
    expect(detectPossibleLoss(canary, { todos: 0, tables: 0, hasNotes: true })).toBe(false);
    // canary says work existed, stores are empty: possible loss
    expect(detectPossibleLoss(canary, { todos: 0, tables: 0, hasNotes: false })).toBe(true);
  });
});

describe('canonical work snapshot', () => {
  const base = {
    todos: [
      { id: 'b-mod-t2', moduleKey: 'b-mod', todoId: 't2', completed: false },
      { id: 'a-mod-t1', moduleKey: 'a-mod', todoId: 't1', completed: true },
    ],
    tables: [
      { id: 'm-tab-r2', moduleKey: 'm', tableId: 'tab', rowId: 'r2', data: { c: 'y' }, updatedAt: '2' },
      { id: 'm-tab-r1', moduleKey: 'm', tableId: 'tab', rowId: 'r1', data: { c: 'x' }, updatedAt: '1' },
    ],
    metadata: {
      personalNotes: 'keep me',
      storageDiagnostic: { lastCheck: 'volatile' },
      storageDeviceId: 'device-1',
      storagePersisted: true,
      storage_persist_requested_v1: '2026',
      [BACKUP_WRITE_COUNTER_KEY]: 4,
      [LAST_BACKUP_AT_KEY]: '2026-07-18',
      [LAST_BACKUP_HASH_KEY]: 'h',
      migration_seniors_and_disabilities_v1: '2026',
      migration_place_characteristics_row_0_slots_v1: '2026',
      currentStreak: 3,
      streakLastActivityDate: '2026-07-17',
      weekStartDate: '2026-07-13',
      weeklyCompleted: 2,
      weeklyGoal: 5,
      bookmarkedModules: ['m'],
      deviceName: 'Kitchen Laptop',
    },
  };

  it('keeps user content and drops every volatile key', () => {
    const snap = buildWorkSnapshot(base as any);
    expect(snap.metadata.personalNotes).toBe('keep me');
    expect(Object.keys(snap.metadata)).toEqual(['personalNotes']);
    expect(snap.todos).toHaveLength(2);
    expect(snap.tables).toHaveLength(2);
  });

  it('serializes deterministically regardless of input order', () => {
    const reordered = {
      todos: [...base.todos].reverse(),
      tables: [...base.tables].reverse(),
      metadata: { ...base.metadata },
    };
    expect(serializeSnapshot(buildWorkSnapshot(base as any))).toBe(
      serializeSnapshot(buildWorkSnapshot(reordered as any)),
    );
  });

  it('volatile churn does not change the serialization (the lastCheck re-stamp trap)', () => {
    const churned = {
      ...base,
      metadata: { ...base.metadata, storageDiagnostic: { lastCheck: 'later' } },
    };
    expect(serializeSnapshot(buildWorkSnapshot(churned as any))).toBe(
      serializeSnapshot(buildWorkSnapshot(base as any)),
    );
  });

  it('real content change DOES change the serialization', () => {
    const changed = {
      ...base,
      todos: [...base.todos, { id: 'c-mod-t9', moduleKey: 'c-mod', todoId: 't9', completed: true }],
    };
    expect(serializeSnapshot(buildWorkSnapshot(changed as any))).not.toBe(
      serializeSnapshot(buildWorkSnapshot(base as any)),
    );
  });

  it('computeSnapshotHash returns stable lowercase hex and tracks content', async () => {
    const h1 = await computeSnapshotHash(buildWorkSnapshot(base as any));
    const h2 = await computeSnapshotHash(buildWorkSnapshot(base as any));
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
    const changed = { ...base, metadata: { ...base.metadata, personalNotes: 'edited' } };
    expect(await computeSnapshotHash(buildWorkSnapshot(changed as any))).not.toBe(h1);
  });
});

describe('backup baseline record', () => {
  it('resets the counter to 0 and stamps timestamp + hash in metadata', async () => {
    await saveTodo({ moduleKey: 'cue-baseline', todoId: 't1', completed: true });
    await recordBackupBaseline('2026-07-18T15:30:00.000Z', 'deadbeef');
    expect(await counterValue()).toBe(0);
    expect(await getMetadata(LAST_BACKUP_AT_KEY)).toBe('2026-07-18T15:30:00.000Z');
    expect(await getMetadata(LAST_BACKUP_HASH_KEY)).toBe('deadbeef');
  });

  it('mirrors the timestamp to the legacy localStorage key for older readers', async () => {
    await recordBackupBaseline('2026-07-18T15:30:00.000Z', 'deadbeef');
    expect(localStorage.getItem(LAST_BACKUP_KEY)).toBe('2026-07-18T15:30:00.000Z');
  });
});

describe('calm gate (counter AND hash must both agree)', () => {
  it('is calm only when the counter is 0 and the current hash matches the stored one', () => {
    expect(isCalmState({ counter: 0, lastBackupAt: 't', lastBackupHash: 'h' }, 'h')).toBe(true);
    expect(isCalmState({ counter: 0, lastBackupAt: 't', lastBackupHash: 'h' }, 'other')).toBe(false);
    expect(isCalmState({ counter: 2, lastBackupAt: 't', lastBackupHash: 'h' }, 'h')).toBe(false);
    expect(isCalmState({ counter: 'unknown', lastBackupAt: 't', lastBackupHash: 'h' }, 'h')).toBe(false);
    expect(isCalmState({ counter: 0, lastBackupAt: 't', lastBackupHash: null }, 'h')).toBe(false);
  });
});

describe('edit-journal replay counting', () => {
  it('the load-time replay counts recovered rows at the initializeStorage call site', async () => {
    await seedCounter(0);
    const entry = {
      id: 'cue-replay-tab-r1',
      moduleKey: 'cue-replay',
      tableId: 'tab',
      rowId: 'r1',
      data: { a: 'journaled' },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${JOURNAL_PREFIX}${entry.id}`, JSON.stringify(entry));
    await initializeStorage();
    expect(await counterValue()).toBe(1);
  });

  it("the backup's own flush does NOT count (flushEditJournalToStorage stays silent)", async () => {
    await seedCounter(0);
    const entry = {
      id: 'cue-flush-tab-r1',
      moduleKey: 'cue-flush',
      tableId: 'tab',
      rowId: 'r1',
      data: { a: 'journaled' },
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${JOURNAL_PREFIX}${entry.id}`, JSON.stringify(entry));
    await flushEditJournalToStorage();
    expect(await counterValue()).toBe(0);
  });
});

describe('snapshot round-trip over the real store', () => {
  it('exportAllData feeds the snapshot: volatile metadata excluded end to end', async () => {
    await saveTodo({ moduleKey: 'cue-e2e', todoId: 't1', completed: true });
    await setMetadata('storageDiagnostic', { lastCheck: 'now' });
    const snap = buildWorkSnapshot(await exportAllData());
    expect(snap.metadata.storageDiagnostic).toBeUndefined();
    expect(snap.todos.some((t) => t.id === 'cue-e2e-t1')).toBe(true);
  });
});
