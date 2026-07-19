/**
 * The count origins filter blank template rows.
 *
 * getOverallStats and getModuleProgress filter the raw table rows through
 * rowHasWork at the TOP, before deriving anything — so totalTableRows,
 * modulesStarted, lastActivityDate, module inclusion, per-module tableRowCount,
 * and per-module lastActivity all inherit the filter. A module whose only rows
 * are blank scaffold must not count as started, must not appear in the progress
 * breakdown, and must not contribute a seed-timestamp last activity.
 *
 * Run: pnpm vitest run src/lib/work-meter-filter.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { importAllData, getOverallStats, getModuleProgress, type TableRow } from './storage';

function row(
  moduleKey: string,
  tableId: string,
  rowId: string,
  data: Record<string, string>,
  updatedAt: string
): TableRow {
  return { id: `${moduleKey}-${tableId}-${rowId}`, moduleKey, tableId, rowId, data, updatedAt };
}

// A blank knowing-community journal row: the template question present, the
// input answer empty (the exact shape of the 2026-07-04 legacy backup).
const BLANK_TS = '2026-07-04T23:07:16.635Z';
const FILLED_TS = '2026-07-10T10:00:00.000Z';

beforeEach(async () => {
  localStorage.clear();
  await importAllData({ todos: [], tables: [] });
});

describe('getOverallStats ignores blank template rows', () => {
  it('a module of only blank scaffold rows counts as zero work and zero started', async () => {
    await importAllData({
      todos: [],
      tables: [
        row('knowing-community', 'community-dynamics', 'row-0', {
          Question: 'Who do people listen to?',
          'Your Response': '',
        }, BLANK_TS),
        row('knowing-community', 'community-dynamics', 'row-1', {
          Question: 'Where do people gather?',
          'Your Response': '',
        }, BLANK_TS),
      ],
    });

    const stats = await getOverallStats();
    expect(stats.totalTableRows).toBe(0);
    expect(stats.modulesStarted).toBe(0);
    expect(stats.lastActivityDate).toBeNull();
  });

  it('counts only rows with a filled input column, and dates them', async () => {
    await importAllData({
      todos: [],
      tables: [
        row('knowing-community', 'community-dynamics', 'row-0', {
          Question: 'Who do people listen to?',
          'Your Response': '',
        }, BLANK_TS),
        row('knowing-community', 'community-dynamics', 'row-1', {
          Question: 'Where do people gather?',
          'Your Response': 'The general store',
        }, FILLED_TS),
      ],
    });

    const stats = await getOverallStats();
    expect(stats.totalTableRows).toBe(1);
    expect(stats.modulesStarted).toBe(1);
    // The blank row's later-looking seed timestamp must not win; only the
    // filled row's date counts.
    expect(stats.lastActivityDate).toBe(FILLED_TS);
  });
});

describe('getModuleProgress ignores blank template rows', () => {
  it('a module of only blank scaffold rows is absent from the breakdown', async () => {
    await importAllData({
      todos: [],
      tables: [
        row('knowing-community', 'community-roles', 'row-0', {
          Role: 'Fire chief',
          'Name(s)': '',
        }, BLANK_TS),
      ],
    });

    const progress = await getModuleProgress();
    expect(progress.find((p) => p.moduleKey === 'knowing-community')).toBeUndefined();
  });

  it('reports the filtered row count and the filled-row activity date', async () => {
    await importAllData({
      todos: [],
      tables: [
        row('knowing-community', 'community-roles', 'row-0', { Role: 'Fire chief', 'Name(s)': '' }, BLANK_TS),
        row('knowing-community', 'community-roles', 'row-1', { Role: 'Road crew', 'Name(s)': 'Sam' }, FILLED_TS),
      ],
    });

    const progress = await getModuleProgress();
    const kc = progress.find((p) => p.moduleKey === 'knowing-community');
    expect(kc).toBeDefined();
    expect(kc!.tableRowCount).toBe(1);
    expect(kc!.lastActivity).toBe(FILLED_TS);
  });

  it('a filled PlanForm {value} row still counts (fall-through)', async () => {
    await importAllData({
      todos: [],
      tables: [row('some-plan', 'my-form', 'field-1', { value: 'an answer' }, FILLED_TS)],
    });

    const stats = await getOverallStats();
    expect(stats.totalTableRows).toBe(1);
    expect(stats.modulesStarted).toBe(1);
  });
});
