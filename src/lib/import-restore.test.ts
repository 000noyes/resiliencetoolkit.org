/**
 * Import exclusion keyset + re-stamp (DX3) and the legacy-forever invariant.
 *
 * A restored device keeps its own identity: `storageDeviceId`, the device
 * name, the cue keys, and the last-backup keys never merge in from a file.
 * The import re-stamps the cue baseline inside the same transaction, so a
 * restored device never inherits a stale count. Committed fixture files from
 * every shipped export vintage replay through importAllData on every CI run:
 * legacy backup files import forever.
 *
 * Run: pnpm vitest run src/lib/import-restore.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  importAllData,
  getMetadata,
  setMetadata,
  deleteMetadata,
  getAllTodos,
  getAllTableRows,
  getModuleTodos,
  initializeStorage,
  BACKUP_WRITE_COUNTER_KEY,
  LAST_BACKUP_AT_KEY,
  LAST_BACKUP_HASH_KEY,
} from './storage';
import legacyFixture from '../../tests/fixtures/backups/resilience-toolkit-backup-2026-06-15.json';
import currentFixture from '../../tests/fixtures/backups/resilience-toolkit-backup-kitchen-laptop-2026-07-18-0930.json';

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('deviceId', 'device-receiving');
  await setMetadata('storageDeviceId', 'device-receiving');
  await setMetadata('deviceName', 'My Own Phone');
  await deleteMetadata(BACKUP_WRITE_COUNTER_KEY);
  await deleteMetadata(LAST_BACKUP_AT_KEY);
  await deleteMetadata(LAST_BACKUP_HASH_KEY);
  await deleteMetadata('lastBackupTransport');
});

describe('DX3: the exclusion keyset', () => {
  it('a restored device keeps its own identity and device name', async () => {
    await importAllData(JSON.parse(JSON.stringify(legacyFixture)));
    expect(await getMetadata('storageDeviceId')).toBe('device-receiving');
    expect(await getMetadata('deviceName')).toBe('My Own Phone');
  });

  it('cue and last-backup keys never merge in from the file', async () => {
    await importAllData(JSON.parse(JSON.stringify(currentFixture)));
    // The file carried counter 0 at a picker transport; the receiving device
    // re-stamps its own baseline rather than inheriting the file's records.
    expect(await getMetadata('lastBackupTransport')).toBeUndefined();
  });

  it('non-excluded user metadata still merges (personal notes travel)', async () => {
    await importAllData(JSON.parse(JSON.stringify(legacyFixture)));
    expect(await getMetadata('personalNotes')).toBe(
      'Ask Lena about the school gym keys before fall.',
    );
  });
});

describe('the in-transaction re-stamp', () => {
  it('counter resets to exact zero on import', async () => {
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 42);
    await importAllData(JSON.parse(JSON.stringify(legacyFixture)));
    expect(await getMetadata(BACKUP_WRITE_COUNTER_KEY)).toBe(0);
  });

  it('a designed file stamps its own exportedAt and snapshot hash as the baseline', async () => {
    await importAllData(JSON.parse(JSON.stringify(currentFixture)));
    expect(await getMetadata(LAST_BACKUP_AT_KEY)).toBe('2026-07-18T09:30:00.000Z');
    expect(await getMetadata(LAST_BACKUP_HASH_KEY)).toBe(
      '9c4d6f1e2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5',
    );
  });

  it('a legacy file clears the baseline instead of faking one', async () => {
    await setMetadata(LAST_BACKUP_AT_KEY, '2026-07-01T00:00:00.000Z');
    await setMetadata(LAST_BACKUP_HASH_KEY, 'stale');
    await importAllData(JSON.parse(JSON.stringify(legacyFixture)));
    expect(await getMetadata(LAST_BACKUP_AT_KEY)).toBeUndefined();
    expect(await getMetadata(LAST_BACKUP_HASH_KEY)).toBeUndefined();
  });
});

describe('legacy backups import forever', () => {
  it('the shipped legacy fixture imports green', async () => {
    const result = await importAllData(JSON.parse(JSON.stringify(legacyFixture)));
    expect(result.todosImported).toBe(3);
    expect(result.tablesImported).toBe(2);
    const todos = await getAllTodos();
    expect(todos.some((t) => t.id === 'senior-citizens-outreach-directory')).toBe(true);
  });

  it('the current-format fixture imports green with its extra top-level fields ignored', async () => {
    const result = await importAllData(JSON.parse(JSON.stringify(currentFixture)));
    expect(result.todosImported).toBe(1);
    expect(result.tablesImported).toBe(1);
  });

  it('marker-clearing re-runs migrations against imported legacy state', async () => {
    await importAllData(JSON.parse(JSON.stringify(legacyFixture)));
    // The legacy fixture carries a senior-citizens todo plus a (stale) seniors
    // migration marker; import cleared the marker, so the next initialize
    // re-evaluates and lands the merged-key record.
    await initializeStorage();
    const merged = await getModuleTodos('seniors-and-disabilities');
    expect(merged.some((t) => t.todoId === 'outreach-directory')).toBe(true);
    const rows = await getAllTableRows();
    // The place-characteristics row-0 migration also re-ran on the imported row.
    expect(rows.some((r) => r.tableId === 'place-characteristics-row-0-slots')).toBe(true);
  });
});
