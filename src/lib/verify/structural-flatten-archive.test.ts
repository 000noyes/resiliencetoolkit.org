/**
 * Structural validation of the `structural_flatten` category in
 * docs/site-inventions-archive.yaml. The test reads the live archive,
 * slices out the structural_flatten section (robust to parse errors
 * elsewhere in the file), and checks the per-entry contract:
 *
 *   - id is a non-empty kebab string
 *   - category is "structural_flatten"
 *   - variant is one of slot_flatten | bullet_flatten | subcolumn_flatten
 *   - resolution is one of pending_restore | restored | accepted_decorative
 *   - inferred_source cites a workbook page (HARD INVARIANT)
 *   - workbook_page is a positive integer
 *   - rationale is non-null when resolution=accepted_decorative
 *   - restore_commit is non-null when resolution=restored
 *   - post_restore_site_shape is non-null when resolution=restored
 *   - the 3 live entries enumerated by §D2 of the ADR are present
 *   - all ids are unique
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const ARCHIVE_PATH = resolve(__dirname, '../../../docs/site-inventions-archive.yaml');

interface FlattenEntry {
  id?: unknown;
  category?: unknown;
  variant?: unknown;
  page?: unknown;
  workbook_page?: unknown;
  workbook_structure?: unknown;
  pre_restore_site_shape?: unknown;
  post_restore_site_shape?: unknown;
  inferred_source?: unknown;
  resolution?: unknown;
  rationale?: unknown;
  date_archived?: unknown;
  archived_in_commit?: unknown;
  restore_commit?: unknown;
  proposed_canonical_field?: unknown;
}

function loadStructuralFlattenEntries(): FlattenEntry[] {
  const text = readFileSync(ARCHIVE_PATH, 'utf-8');
  const match = text.match(
    /(?:^|\n) {2}structural_flatten:\n([\s\S]*?)(?=\n {2}[a-z_][a-z0-9_]*:|$)/,
  );
  if (!match) throw new Error('structural_flatten category not found in archive yaml');
  const parsed = yamlLoad(match[1]);
  if (!Array.isArray(parsed)) throw new Error('structural_flatten slice did not parse as a list');
  return parsed as FlattenEntry[];
}

const VARIANTS = new Set(['slot_flatten', 'bullet_flatten', 'subcolumn_flatten']);
const RESOLUTIONS = new Set(['pending_restore', 'restored', 'accepted_decorative']);

describe('site-inventions-archive.yaml — structural_flatten category', () => {
  const entries = loadStructuralFlattenEntries();

  it('contains at least one entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty kebab-style id', () => {
    for (const e of entries) {
      expect(typeof e.id).toBe('string');
      expect((e.id as string).length).toBeGreaterThan(0);
      expect(e.id as string).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('ids are unique', () => {
    const ids = entries.map((e) => String(e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry declares category="structural_flatten"', () => {
    for (const e of entries) {
      expect(e.category).toBe('structural_flatten');
    }
  });

  it('every entry has a recognized variant', () => {
    for (const e of entries) {
      expect(VARIANTS.has(String(e.variant))).toBe(true);
    }
  });

  it('every entry has a recognized resolution', () => {
    for (const e of entries) {
      expect(RESOLUTIONS.has(String(e.resolution))).toBe(true);
    }
  });

  it('every entry has a positive integer workbook_page (Source Fidelity invariant)', () => {
    for (const e of entries) {
      expect(typeof e.workbook_page).toBe('number');
      expect(Number.isInteger(e.workbook_page as number)).toBe(true);
      expect(e.workbook_page as number).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty inferred_source citing the workbook', () => {
    for (const e of entries) {
      expect(typeof e.inferred_source).toBe('string');
      expect((e.inferred_source as string).length).toBeGreaterThan(0);
      expect((e.inferred_source as string).toLowerCase()).toMatch(/workbook|batjc/);
    }
  });

  it('accepted_decorative entries require non-null rationale', () => {
    for (const e of entries) {
      if (e.resolution === 'accepted_decorative') {
        expect(e.rationale).not.toBeNull();
        expect(typeof e.rationale).toBe('string');
        expect((e.rationale as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('restored entries require non-null restore_commit and post_restore_site_shape', () => {
    for (const e of entries) {
      if (e.resolution === 'restored') {
        expect(e.restore_commit).not.toBeNull();
        expect(e.post_restore_site_shape).not.toBeNull();
      }
    }
  });

  it('every entry has a `page` referencing src/pages/modules/', () => {
    for (const e of entries) {
      expect(typeof e.page).toBe('string');
      expect(e.page as string).toMatch(/^src\/pages\/modules\//);
    }
  });

  it('slot_flatten and bullet_flatten entries declare a proposed_canonical_field (substrate hook)', () => {
    for (const e of entries) {
      if (e.variant === 'slot_flatten' || e.variant === 'bullet_flatten') {
        expect(e.proposed_canonical_field).not.toBeNull();
        expect(typeof e.proposed_canonical_field).toBe('string');
      }
    }
  });

  it('contains the 3 case-8 live entries by id', () => {
    const ids = new Set(entries.map((e) => String(e.id)));
    expect(ids.has('0-1-place-characteristics-row-0-flatten')).toBe(true);
    expect(ids.has('2-1-carpooling-initiatives-flatten')).toBe(true);
    expect(ids.has('2-3-skill-other-subcolumn-flatten')).toBe(true);
  });
});
