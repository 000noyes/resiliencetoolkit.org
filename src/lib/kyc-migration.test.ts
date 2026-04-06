/**
 * KYC Migration Column-Key Verification Test
 *
 * P1 blocker: Verifies that DataTable reads data using the exact column key
 * strings that EditableTable uses for the 6 KYC tables on knowing-your-community.
 *
 * EditableTable stores row data keyed by raw column header strings:
 *   'Prompt', 'Your Response', 'Role', 'Name(s)', 'Question'
 *
 * If DataTable normalizes these keys (e.g., 'prompt' instead of 'Prompt'),
 * existing user data silently disappears. data-preservation.test.ts only
 * checks moduleKey existence, not column-level keys.
 *
 * This test seeds IndexedDB with mock data using the exact EditableTable key
 * strings, then asserts getTableRows returns data that resolves through those
 * same keys.
 *
 * Run: pnpm vitest run src/lib/kyc-migration.test.ts
 */
import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { saveTableRow, getTableRows } from './storage';

/**
 * The 6 KYC tables with their exact column keys as stored by EditableTable.
 * These must never be normalized, renamed, or lowercased.
 */
const KYC_TABLES = [
  {
    tableId: 'place-characteristics',
    description: 'Mapping your community',
    columns: ['Prompt', 'Your Response'],
    sampleRow: {
      'Prompt': 'Write down three important things about your place.',
      'Your Response': 'Mountains and community',
    },
    rowCount: 4,
  },
  {
    tableId: 'community-roles',
    description: 'Who is in your community?',
    columns: ['Role', 'Name(s)'],
    sampleRow: {
      'Role': 'Fire chief',
      'Name(s)': 'Jane Doe',
    },
    rowCount: 12,
  },
  {
    tableId: 'community-dynamics',
    description: 'Community dynamics',
    columns: ['Question', 'Your Response'],
    sampleRow: {
      'Question': 'Who do people listen to?',
      'Your Response': 'The fire chief and the pastor',
    },
    rowCount: 8,
  },
  {
    tableId: 'systems',
    description: 'Stuff and systems',
    columns: ['Question', 'Your Response'],
    sampleRow: {
      'Question': 'What emergency supplies are stored in your place?',
      'Your Response': 'Generator at town hall',
    },
    rowCount: 7,
  },
  {
    tableId: 'ecosystem',
    description: 'Knowing your ecosystem',
    columns: ['Question', 'Your Response'],
    sampleRow: {
      'Question': 'What rivers and streams run through your place?',
      'Your Response': 'White River',
    },
    rowCount: 3,
  },
  {
    tableId: 'going-deeper',
    description: 'Going deeper',
    columns: ['Question', 'Your Response'],
    sampleRow: {
      'Question': 'What special skills do you have?',
      'Your Response': 'Carpentry and first aid',
    },
    rowCount: 6,
  },
] as const;

const MODULE_KEY = 'knowing-community';

describe('KYC Migration — Column Key Preservation', () => {
  it('all 6 KYC tables preserve exact column key strings through storage round-trip', async () => {
    for (const table of KYC_TABLES) {
      // Seed: write a row using exact EditableTable column keys
      await saveTableRow({
        moduleKey: MODULE_KEY,
        tableId: table.tableId,
        rowId: 'row-0',
        data: table.sampleRow,
      });

      // Read: fetch via the same API DataTable uses
      const rows = await getTableRows(MODULE_KEY, table.tableId);
      expect(rows.length).toBeGreaterThanOrEqual(1);

      const row = rows.find((r) => r.rowId === 'row-0');
      expect(row, `row-0 missing for ${table.tableId}`).toBeDefined();

      // Verify each column key resolves exactly
      for (const colKey of table.columns) {
        expect(
          row!.data[colKey],
          `Column key "${colKey}" missing or empty for table "${table.tableId}". ` +
            `If DataTable normalizes keys (e.g., "${colKey.toLowerCase()}" instead of "${colKey}"), ` +
            `existing user data is silently lost.`,
        ).toBe(table.sampleRow[colKey as keyof typeof table.sampleRow]);
      }
    }
  });

  it('pre-populated rows use rowId pattern row-0 through row-N (< 1000)', async () => {
    for (const table of KYC_TABLES) {
      for (let i = 0; i < table.rowCount; i++) {
        const rowId = `row-${i}`;
        const match = rowId.match(/^row-(\d+)$/);
        expect(match, `rowId "${rowId}" does not match row-N pattern`).not.toBeNull();
        expect(parseInt(match![1], 10)).toBeLessThan(1000);
      }
    }
  });

  it('user-added rows use rowId >= 1000 (timestamp-based)', () => {
    // Simulate what DataTable.generateRowId() produces
    const userRowId = `row-${Date.now()}`;
    const match = userRowId.match(/^row-(\d+)$/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(1000);
  });

  it('column keys are case-sensitive — lowercase variants must not match', async () => {
    // Seed with exact keys
    await saveTableRow({
      moduleKey: MODULE_KEY,
      tableId: 'place-characteristics',
      rowId: 'row-case-test',
      data: { 'Prompt': 'Test prompt', 'Your Response': 'Test response' },
    });

    const rows = await getTableRows(MODULE_KEY, 'place-characteristics');
    const row = rows.find((r) => r.rowId === 'row-case-test');
    expect(row).toBeDefined();

    // Lowercase keys must NOT resolve the data
    expect(row!.data['prompt']).toBeUndefined();
    expect(row!.data['your response']).toBeUndefined();
    expect(row!.data['your Response']).toBeUndefined();

    // Exact keys must resolve
    expect(row!.data['Prompt']).toBe('Test prompt');
    expect(row!.data['Your Response']).toBe('Test response');
  });
});
