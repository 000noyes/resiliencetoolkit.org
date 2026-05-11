/**
 * structuralFlattenMatches behavior table:
 *
 *   | spec.structural_flatten | archive_id in yaml | site shape  | verdict                          |
 *   |-------------------------|--------------------|-------------|----------------------------------|
 *   | absent                  | n/a                | any         | (no entry)                       |
 *   | accepted_decorative     | yes                | any         | (no entry — PASS)                |
 *   | accepted_decorative     | no                 | any         | structural_flatten_unarchived    |
 *   | pending_restore         | yes                | any         | structural_flatten_pending       |
 *   | pending_restore         | no                 | any         | structural_flatten_unarchived    |
 *   | restored                | yes                | any         | (no entry — defers to fidelity)  |
 *   | restored                | no                 | any         | structural_flatten_unarchived    |
 *
 * Plus the defensive `ctx.archiveIds` absent path emits needs_human_review.
 */
import { describe, it, expect } from 'vitest';
import type { SourceSpec } from './schemas';
import {
  loadStructuralFlattenArchiveIds,
  structuralFlattenMatches,
  type CheckContext,
} from './runner-checks';

function baseSpec(overrides: Partial<SourceSpec> = {}): SourceSpec {
  return {
    module: '0-1',
    template: 'place-characteristics',
    title: 'Place Characteristics',
    citation: { source: 'docs/source-specs/test.md', page: '10' },
    ...overrides,
  } as SourceSpec;
}

function ctx(
  spec: SourceSpec,
  archiveIds?: ReadonlySet<string>,
): CheckContext {
  const c: CheckContext = {
    spec,
    file: 'src/pages/modules/test.astro',
    citationLine: 1,
    siteContent: '<div />',
    source: 'docs/source-specs/test.md',
  };
  if (archiveIds !== undefined) c.archiveIds = archiveIds;
  return c;
}

describe('structuralFlattenMatches', () => {
  it('emits nothing when spec.structural_flatten is absent', () => {
    const spec = baseSpec({ fields: [{ key: 'x', label: 'X', type: 'text' }] });
    expect(structuralFlattenMatches(ctx(spec, new Set(['anything'])))).toEqual([]);
  });

  it('PASS — accepted_decorative with archive_id resolving', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'subcolumn_flatten',
        resolution: 'accepted_decorative',
        archive_id: 'a-1',
      },
    });
    expect(structuralFlattenMatches(ctx(spec, new Set(['a-1'])))).toEqual([]);
  });

  it('HARD FAIL — accepted_decorative with archive_id NOT in yaml', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'subcolumn_flatten',
        resolution: 'accepted_decorative',
        archive_id: 'missing-id',
      },
    });
    const out = structuralFlattenMatches(ctx(spec, new Set(['a-1'])));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('structural_flatten_unarchived');
    expect(out[0].message).toContain('missing-id');
  });

  it('SOFT — pending_restore with archive_id resolving', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'slot_flatten',
        resolution: 'pending_restore',
        archive_id: 'a-1',
      },
    });
    const out = structuralFlattenMatches(ctx(spec, new Set(['a-1'])));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('structural_flatten_pending');
    expect(out[0].message).toMatch(/slot_flatten/);
  });

  it('HARD FAIL — pending_restore overrides nothing; unresolved archive_id wins', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'slot_flatten',
        resolution: 'pending_restore',
        archive_id: 'gone',
      },
    });
    const out = structuralFlattenMatches(ctx(spec, new Set(['a-1'])));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('structural_flatten_unarchived');
  });

  it('restored with archive resolving — emits nothing (delegates to structural_fidelity)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'bullet_flatten',
        resolution: 'restored',
        archive_id: 'a-1',
        expected_component_count: 3,
      },
    });
    expect(structuralFlattenMatches(ctx(spec, new Set(['a-1'])))).toEqual([]);
  });

  it('HARD FAIL — restored with archive_id NOT in yaml', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'bullet_flatten',
        resolution: 'restored',
        archive_id: 'never-archived',
      },
    });
    const out = structuralFlattenMatches(ctx(spec, new Set([])));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('structural_flatten_unarchived');
  });

  it('ctx.archiveIds absent — emits needs_human_review (defensive)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_flatten: {
        variant: 'slot_flatten',
        resolution: 'accepted_decorative',
        archive_id: 'a-1',
      },
    });
    // No archiveIds threaded in.
    const out = structuralFlattenMatches(ctx(spec));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('needs_human_review');
  });
});

describe('loadStructuralFlattenArchiveIds', () => {
  it('extracts ids from a well-formed structural_flatten slice', () => {
    const text = [
      '# header noise',
      'categories:',
      '  other_category:',
      '    - id: noise-1',
      '      type: other_category',
      '  structural_flatten:',
      '    - id: alpha',
      '      category: structural_flatten',
      '      variant: slot_flatten',
      '      resolution: pending_restore',
      '    - id: beta',
      '      category: structural_flatten',
      '      variant: bullet_flatten',
      '      resolution: accepted_decorative',
      '      rationale: ok',
      '  yet_another:',
      '    - id: noise-2',
      '      type: yet_another',
      '',
    ].join('\n');
    const ids = loadStructuralFlattenArchiveIds(text);
    expect(ids.size).toBe(2);
    expect(ids.has('alpha')).toBe(true);
    expect(ids.has('beta')).toBe(true);
    expect(ids.has('noise-1')).toBe(false);
    expect(ids.has('noise-2')).toBe(false);
  });

  it('returns empty set when the category is absent', () => {
    const text = 'categories:\n  some_other:\n    - id: x\n';
    expect(loadStructuralFlattenArchiveIds(text).size).toBe(0);
  });

  it('returns empty set when the slice does not parse', () => {
    // Malformed yaml inside the slice.
    const text = [
      'categories:',
      '  structural_flatten:',
      '    - id: a',
      '       : : : not valid mapping',
      '',
    ].join('\n');
    expect(loadStructuralFlattenArchiveIds(text).size).toBe(0);
  });

  it('reads the live archive yaml and returns the 3 Case-8 ids', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const text = readFileSync(
      resolve(__dirname, '../../../docs/site-inventions-archive.yaml'),
      'utf-8',
    );
    const ids = loadStructuralFlattenArchiveIds(text);
    expect(ids.has('0-1-place-characteristics-row-0-flatten')).toBe(true);
    expect(ids.has('2-1-carpooling-initiatives-flatten')).toBe(true);
    expect(ids.has('2-3-skill-other-subcolumn-flatten')).toBe(true);
  });
});
