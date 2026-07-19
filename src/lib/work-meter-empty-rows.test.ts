/**
 * Acceptance gate for the empty-rows meter fix (the named repro).
 *
 * The 2026-07-04 legacy backup holds 39 table rows, all knowing-community,
 * every input answer blank — the scaffold questions persisted with an empty
 * response. Before the fix the meter read "39 saved rows" while progress read
 * 0. After the fix these rows count as zero work everywhere, WITHOUT changing
 * import: all 39 still land in storage (this is a counting fix, not a deletion),
 * and the legacy file imports cleanly, as every legacy backup must forever.
 *
 * Run: pnpm vitest run src/lib/work-meter-empty-rows.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  importAllData,
  getOverallStats,
  getModuleProgress,
  getAllTableRows,
} from './storage';
import legacyEmptyBackup from '../../tests/fixtures/backups/resilience-toolkit-backup-2026-07-04.json';

// A fresh clone per import so the shared fixture object is never mutated.
const clone = () => JSON.parse(JSON.stringify(legacyEmptyBackup));

beforeEach(async () => {
  localStorage.clear();
  await importAllData({ todos: [], tables: [] });
});

describe('2026-07-04 all-empty legacy backup', () => {
  it('imports cleanly and lands all 39 rows (import is unchanged — a counting fix, not a deletion)', async () => {
    const result = await importAllData(clone());
    expect(result.tablesImported).toBe(39);
    expect(result.todosImported).toBe(0);
    // The rows are still in storage; nothing was deleted.
    expect((await getAllTableRows()).length).toBe(39);
  });

  it('reports zero table work, zero modules started, and no seed-timestamp activity', async () => {
    await importAllData(clone());

    const stats = await getOverallStats();
    expect(stats.totalTableRows).toBe(0);
    expect(stats.modulesStarted).toBe(0);
    expect(stats.lastActivityDate).toBeNull();
  });

  it('shows no module as started in the progress breakdown', async () => {
    await importAllData(clone());

    const progress = await getModuleProgress();
    expect(progress).toHaveLength(0);
    expect(progress.find((p) => p.moduleKey === 'knowing-community')).toBeUndefined();
  });
});
