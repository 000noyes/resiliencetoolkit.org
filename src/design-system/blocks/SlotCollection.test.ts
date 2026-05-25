/**
 * SlotCollection Tests
 *
 * Covers:
 *   - Pure helper key derivation (slotRowId / slotTextareaId)
 *   - Static structural render via react-dom/server (no RTL dependency)
 *   - Storage round-trip via fake-indexeddb (slot composite keys + isolation)
 *
 * Run: pnpm vitest run src/design-system/blocks/SlotCollection.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';

import SlotCollection, { slotRowId, slotTextareaId } from './SlotCollection';
import {
  saveTableRow,
  getTableRow,
  getTableRows,
} from '@/lib/storage';

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------
describe('SlotCollection key helpers', () => {
  it('slotRowId returns slot-${n} for 1-indexed numbers', () => {
    expect(slotRowId(1)).toBe('slot-1');
    expect(slotRowId(2)).toBe('slot-2');
    expect(slotRowId(3)).toBe('slot-3');
  });

  it('slotTextareaId composes moduleKey, tableId, and 1-indexed slot number', () => {
    expect(slotTextareaId('knowing-community', 'place-characteristics-row-0-slots', 1))
      .toBe('slot-collection-knowing-community-place-characteristics-row-0-slots-slot-1');
    expect(slotTextareaId('knowing-community', 'place-characteristics-row-0-slots', 3))
      .toBe('slot-collection-knowing-community-place-characteristics-row-0-slots-slot-3');
  });
});

// ---------------------------------------------------------------------------
// Static structural render via react-dom/server
//
// renderToStaticMarkup does not execute useEffect, so storage-loaded values
// stay empty. These tests cover the DOM structure that ships before
// hydration: fieldset, legend, label/textarea pairs, and the data-slot-count
// attribute the future PR C verifier hook will read.
// ---------------------------------------------------------------------------
describe('SlotCollection static markup', () => {
  it('renders <fieldset data-slot-count="3"> for count={3}', () => {
    const html = renderToStaticMarkup(
      createElement(SlotCollection, {
        moduleKey: 'render-test-1',
        tableId: 'tbl-render-1',
        count: 3,
        prompt: 'irrelevant',
        source: 'docs/source-specs/test.md',
      }),
    );
    expect(html).toMatch(/<fieldset[^>]*data-slot-count="3"/);
  });

  it('renders N <textarea> elements for count={N}', () => {
    const html = renderToStaticMarkup(
      createElement(SlotCollection, {
        moduleKey: 'render-test-2',
        tableId: 'tbl-render-2',
        count: 3,
        prompt: 'irrelevant',
        source: 'docs/source-specs/test.md',
      }),
    );
    const textareaMatches = html.match(/<textarea\b/g) ?? [];
    expect(textareaMatches).toHaveLength(3);
  });

  it('renders the workbook-verbatim prompt inside <legend>', () => {
    const prompt = 'Write down three important things about your place/what life is like here.';
    const html = renderToStaticMarkup(
      createElement(SlotCollection, {
        moduleKey: 'render-test-3',
        tableId: 'tbl-render-3',
        count: 3,
        prompt,
        source: 'docs/source-specs/test.md',
      }),
    );
    // <legend> must wrap the workbook-verbatim prompt — slash escapes as expected
    expect(html).toContain('<legend');
    // workbook glyph fidelity: forward slash and trailing period preserved
    expect(html).toContain('Write down three important things about your place/what life is like here.');
  });

  it('renders numbered prefix "1:" "2:" "3:" with colons (workbook-verbatim, NOT periods)', () => {
    const html = renderToStaticMarkup(
      createElement(SlotCollection, {
        moduleKey: 'render-test-4',
        tableId: 'tbl-render-4',
        count: 3,
        prompt: 'irrelevant',
        source: 'docs/source-specs/test.md',
      }),
    );
    // Workbook p10 enumeration is "1: 2: 3:" — colons, source-fidelity HARD INVARIANT.
    // Match labels that contain the colon glyph rather than period.
    expect(html).toMatch(/<label[^>]*>1:<\/label>/);
    expect(html).toMatch(/<label[^>]*>2:<\/label>/);
    expect(html).toMatch(/<label[^>]*>3:<\/label>/);
    expect(html).not.toMatch(/<label[^>]*>1\.<\/label>/);
  });

  it('ties each <label htmlFor> to its <textarea id> via slotTextareaId', () => {
    const moduleKey = 'render-test-5';
    const tableId = 'tbl-render-5';
    const html = renderToStaticMarkup(
      createElement(SlotCollection, {
        moduleKey,
        tableId,
        count: 3,
        prompt: 'irrelevant',
        source: 'docs/source-specs/test.md',
      }),
    );
    for (let n = 1; n <= 3; n += 1) {
      const id = slotTextareaId(moduleKey, tableId, n);
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Storage round-trip via fake-indexeddb
//
// Verifies the (moduleKey, tableId, slot-N) tuple round-trips through
// saveTableRow → getTableRow with data: { value: string }. Also confirms
// isolation across sibling tableIds on the same moduleKey — the SlotCollection's
// tableId namespace MUST NOT leak into a DataTable's tableId on the same page.
//
// Use isolated moduleKey/tableId per test per the project's "DB singleton means
// tests share state" gotcha (CLAUDE.md Known Gotcha #2).
// ---------------------------------------------------------------------------
describe('SlotCollection storage round-trip', () => {
  beforeEach(async () => {
    // fake-indexeddb 6.x exposes a reset API on indexedDB
    // Reset to a clean DB so isolated keys don't accumulate across tests.
    const fakeDb = (indexedDB as unknown as { _databases?: Map<unknown, unknown> })._databases;
    if (fakeDb && typeof fakeDb.clear === 'function') {
      fakeDb.clear();
    }
  });

  it('persists slot-N value via saveTableRow and reads via getTableRow with data: { value }', async () => {
    const moduleKey = 'storage-test-1';
    const tableId = 'tbl-storage-1';

    await saveTableRow({
      moduleKey,
      tableId,
      rowId: slotRowId(2),
      data: { value: 'middle slot text' },
    });

    const row = await getTableRow(moduleKey, tableId, 'slot-2');
    expect(row).toBeTruthy();
    expect(row?.data?.value).toBe('middle slot text');
  });

  it('isolates SlotCollection rows from a sibling DataTable tableId on the same moduleKey', async () => {
    const moduleKey = 'storage-test-2';
    const slotTableId = 'tbl-storage-2-slots';
    const dataTableId = 'tbl-storage-2-table';

    // SlotCollection writes
    await saveTableRow({
      moduleKey,
      tableId: slotTableId,
      rowId: slotRowId(1),
      data: { value: 'slot one' },
    });

    // Sibling DataTable writes under a different tableId (DataTable row shape)
    await saveTableRow({
      moduleKey,
      tableId: dataTableId,
      rowId: 'row-1',
      data: { Prompt: 'p', 'Your Response': 'datatable response' },
    });

    const slotRows = await getTableRows(moduleKey, slotTableId);
    const dtRows = await getTableRows(moduleKey, dataTableId);

    expect(slotRows).toHaveLength(1);
    expect(slotRows[0].rowId).toBe('slot-1');
    expect(slotRows[0].data?.value).toBe('slot one');

    expect(dtRows).toHaveLength(1);
    expect(dtRows[0].rowId).toBe('row-1');
    expect((dtRows[0].data as Record<string, string>)['Your Response']).toBe('datatable response');

    // Neither namespace leaks into the other
    expect(slotRows.find((r) => r.rowId === 'row-1')).toBeUndefined();
    expect(dtRows.find((r) => r.rowId === 'slot-1')).toBeUndefined();
  });

  it('writes all three slots independently under the same (moduleKey, tableId)', async () => {
    const moduleKey = 'storage-test-3';
    const tableId = 'tbl-storage-3-slots';

    await saveTableRow({ moduleKey, tableId, rowId: slotRowId(1), data: { value: 'one' } });
    await saveTableRow({ moduleKey, tableId, rowId: slotRowId(2), data: { value: 'two' } });
    await saveTableRow({ moduleKey, tableId, rowId: slotRowId(3), data: { value: 'three' } });

    const rows = await getTableRows(moduleKey, tableId);
    expect(rows).toHaveLength(3);

    const byRowId = Object.fromEntries(rows.map((r) => [r.rowId, r.data?.value]));
    expect(byRowId['slot-1']).toBe('one');
    expect(byRowId['slot-2']).toBe('two');
    expect(byRowId['slot-3']).toBe('three');
  });
});
