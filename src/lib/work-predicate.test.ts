/**
 * The saved-work predicate and its input-column map.
 *
 * A table row bundles the template question (a readonly column) with the
 * person's answer (an input column), so "any non-empty cell" over-counts blank
 * scaffold rows as saved work. `rowHasWork` looks only at the input columns:
 * a row counts as work when at least one input column holds a non-blank value.
 *
 * The coverage test is the guard: every editable table that ships a readonly
 * template column MUST have a map entry whose keys are exactly that table's
 * non-readonly columns. A table missing from the map falls through to
 * "any non-blank cell counts" (over-count, safe); a WRONG map entry could
 * under-count real work, so the test pins the map to the rendered `.astro`
 * column definitions.
 *
 * Run: pnpm vitest run src/lib/work-predicate.test.ts
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rowHasWork, TABLE_INPUT_COLUMNS } from './work-predicate';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(dirname, '../pages/modules');

describe('rowHasWork', () => {
  it('a journal row with a filled input column is work', () => {
    expect(
      rowHasWork({
        moduleKey: 'knowing-community',
        tableId: 'community-dynamics',
        data: { Question: 'Who do people listen to?', 'Your Response': 'The town clerk' },
      })
    ).toBe(true);
  });

  it('a journal row with only the template question filled is NOT work', () => {
    // The exact shape of the 2026-07-04 legacy backup rows.
    expect(
      rowHasWork({
        moduleKey: 'knowing-community',
        tableId: 'community-dynamics',
        data: { Question: 'Who do people listen to?', 'Your Response': '' },
      })
    ).toBe(false);
  });

  it('whitespace-only input is NOT work', () => {
    expect(
      rowHasWork({
        moduleKey: 'knowing-community',
        tableId: 'community-roles',
        data: { Role: 'Fire chief', 'Name(s)': '   ' },
      })
    ).toBe(false);
  });

  it('the community-roles input column is Name(s), not the readonly Role', () => {
    expect(
      rowHasWork({
        moduleKey: 'knowing-community',
        tableId: 'community-roles',
        data: { Role: 'Fire chief', 'Name(s)': 'Sam' },
      })
    ).toBe(true);
  });

  it('a multi-input directory row counts work in ANY input column', () => {
    // leader-directory: role is readonly; name/phone/email are input.
    expect(
      rowHasWork({
        moduleKey: 'community-emergency-response',
        tableId: 'leader-directory',
        data: { role: 'Fire chief', name: '', phone: '802-555-0100', email: '' },
      })
    ).toBe(true);
    expect(
      rowHasWork({
        moduleKey: 'community-emergency-response',
        tableId: 'leader-directory',
        data: { role: 'Fire chief', name: '', phone: '', email: '' },
      })
    ).toBe(false);
  });

  it('a PlanForm {value} row falls through to any-non-blank (no map entry needed)', () => {
    expect(
      rowHasWork({ moduleKey: 'some-plan', tableId: 'my-form', data: { value: 'answer' } })
    ).toBe(true);
    expect(rowHasWork({ moduleKey: 'some-plan', tableId: 'my-form', data: { value: '' } })).toBe(
      false
    );
  });

  it('an unmapped table with a non-blank cell falls through to work (over-count safe)', () => {
    expect(
      rowHasWork({
        moduleKey: 'community-emergency-response',
        tableId: 'neighbor-directory',
        data: { name: 'Pat', phone: '', email: '', address: '' },
      })
    ).toBe(true);
  });

  it('a fully blank row is never work', () => {
    expect(
      rowHasWork({
        moduleKey: 'knowing-community',
        tableId: 'systems',
        data: { Question: '', 'Your Response': '' },
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Exact-coverage guard: the map's input keys must equal each editable table's
// non-readonly columns, discovered from the rendered `.astro` definitions.
// ---------------------------------------------------------------------------

interface DiscoveredTable {
  file: string;
  key: string; // `${moduleKey}-${tableId}`
  inputKeys: string[]; // non-readonly column keys
}

/** Walk src/pages/modules for every .astro file. */
function astroFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...astroFiles(full));
    else if (entry.name.endsWith('.astro')) out.push(full);
  }
  return out;
}

/**
 * Parse every <DataTable .../> block and return the ones that ship at least one
 * readonly (template) column — those are the template-bearing tables the map
 * must cover exactly.
 */
function discoverTemplateTables(): DiscoveredTable[] {
  const found: DiscoveredTable[] = [];
  for (const file of astroFiles(MODULES_DIR)) {
    const src = readFileSync(file, 'utf8');
    const blocks = src.match(/<DataTable\b[\s\S]*?\/>/g) ?? [];
    for (const block of blocks) {
      const moduleKey = block.match(/moduleKey="([^"]+)"/)?.[1];
      const tableId = block.match(/tableId="([^"]+)"/)?.[1];
      const columnsSrc = block.match(/columns=\{\[([\s\S]*?)\]\}/)?.[1];
      if (!moduleKey || !tableId || !columnsSrc) continue;

      const columnObjs = columnsSrc.match(/\{[^{}]*\}/g) ?? [];
      let hasReadonly = false;
      const inputKeys: string[] = [];
      for (const col of columnObjs) {
        const key = col.match(/key:\s*'([^']*)'/)?.[1];
        if (!key) continue;
        if (/readonly:\s*true/.test(col)) hasReadonly = true;
        else inputKeys.push(key);
      }

      if (hasReadonly) {
        found.push({
          file: path.relative(MODULES_DIR, file),
          key: `${moduleKey}-${tableId}`,
          inputKeys,
        });
      }
    }
  }
  return found;
}

const sorted = (a: string[]) => [...a].sort();

describe('TABLE_INPUT_COLUMNS coverage', () => {
  const templateTables = discoverTemplateTables();

  it('discovers the known template-bearing tables (parser sanity)', () => {
    // If the parser silently finds nothing, every coverage assertion below
    // would vacuously pass — pin a floor so a broken parser fails loudly.
    expect(templateTables.length).toBeGreaterThanOrEqual(7);
  });

  it('every template-bearing table has a map entry with exactly its non-readonly columns', () => {
    for (const t of templateTables) {
      const mapped = TABLE_INPUT_COLUMNS[t.key];
      expect(mapped, `missing map entry for ${t.key} (${t.file})`).toBeDefined();
      expect(sorted(mapped!), `wrong input columns for ${t.key} (${t.file})`).toEqual(
        sorted(t.inputKeys)
      );
    }
  });

  it('has no stale map entries pointing at tables that no longer exist', () => {
    const discoveredKeys = new Set(templateTables.map((t) => t.key));
    for (const key of Object.keys(TABLE_INPUT_COLUMNS)) {
      expect(discoveredKeys.has(key), `stale map entry: ${key}`).toBe(true);
    }
  });
});
