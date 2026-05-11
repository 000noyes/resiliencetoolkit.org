import { describe, it, expect } from 'vitest';
import {
  sourceSpecSchema,
  structuralFlattenSchema,
} from './schemas';

describe('structuralFlattenSchema', () => {
  it('accepts slot_flatten / pending_restore', () => {
    expect(
      structuralFlattenSchema.parse({
        variant: 'slot_flatten',
        resolution: 'pending_restore',
        archive_id: '0-1-place-characteristics-row-0-flatten',
      }),
    ).toMatchObject({ variant: 'slot_flatten', resolution: 'pending_restore' });
  });

  it('accepts bullet_flatten / restored with expected_component_count', () => {
    expect(
      structuralFlattenSchema.parse({
        variant: 'bullet_flatten',
        resolution: 'restored',
        archive_id: '2-1-carpooling-initiatives-flatten',
        expected_component_count: 3,
      }),
    ).toMatchObject({ resolution: 'restored', expected_component_count: 3 });
  });

  it('accepts subcolumn_flatten / accepted_decorative', () => {
    expect(
      structuralFlattenSchema.parse({
        variant: 'subcolumn_flatten',
        resolution: 'accepted_decorative',
        archive_id: '2-3-skill-other-subcolumn-flatten',
      }),
    ).toMatchObject({ resolution: 'accepted_decorative' });
  });

  it('rejects unknown variant', () => {
    expect(() =>
      structuralFlattenSchema.parse({
        variant: 'free_flatten',
        resolution: 'pending_restore',
        archive_id: 'x',
      }),
    ).toThrow();
  });

  it('rejects unknown resolution', () => {
    expect(() =>
      structuralFlattenSchema.parse({
        variant: 'slot_flatten',
        resolution: 'maybe',
        archive_id: 'x',
      }),
    ).toThrow();
  });

  it('requires non-empty archive_id', () => {
    expect(() =>
      structuralFlattenSchema.parse({
        variant: 'slot_flatten',
        resolution: 'pending_restore',
        archive_id: '',
      }),
    ).toThrow();
  });

  it('rejects expected_component_count below 1', () => {
    expect(() =>
      structuralFlattenSchema.parse({
        variant: 'bullet_flatten',
        resolution: 'restored',
        archive_id: 'x',
        expected_component_count: 0,
      }),
    ).toThrow();
  });
});

describe('sourceSpecSchema integration', () => {
  it('parses a spec without structural_flatten unchanged (additive)', () => {
    expect(
      sourceSpecSchema.parse({
        module: '1-9',
        template: 'leader-directory',
        title: 'Leader Directory',
        citation: { source: 'docs/source-specs/test.md', page: '1' },
        fields: [{ key: 'x', label: 'X', type: 'text' }],
      }),
    ).toMatchObject({ title: 'Leader Directory' });
  });

  it('accepts structural_flatten on a spec body', () => {
    const spec = sourceSpecSchema.parse({
      module: '0-1',
      template: 'place-characteristics',
      title: 'Place Characteristics',
      citation: { source: 'docs/source-specs/0-1-place-characteristics.md', page: '10' },
      fields: [{ key: 'a', label: 'A', type: 'text' }],
      structural_flatten: {
        variant: 'slot_flatten',
        resolution: 'pending_restore',
        archive_id: '0-1-place-characteristics-row-0-flatten',
      },
    });
    expect(spec.structural_flatten?.variant).toBe('slot_flatten');
  });
});
