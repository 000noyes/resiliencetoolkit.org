import { describe, it, expect } from 'vitest';
import { structuralFidelitySchema } from './schemas';

describe('structuralFidelitySchema', () => {
  it('accepts table_count: 0 (Todo-only-page assertion)', () => {
    expect(
      structuralFidelitySchema.parse({ table_count: 0 }),
    ).toMatchObject({ table_count: 0 });
  });

  it('accepts table_count: N with no scope_id (file-global sum)', () => {
    expect(
      structuralFidelitySchema.parse({ table_count: 2 }),
    ).toMatchObject({ table_count: 2 });
  });

  it('accepts a non-empty scope_id', () => {
    expect(
      structuralFidelitySchema.parse({
        table_count: 1,
        scope_id: 'place-characteristics-row-0-slots',
      }),
    ).toMatchObject({ scope_id: 'place-characteristics-row-0-slots' });
  });

  it('rejects an empty scope_id (would silently disable scoping)', () => {
    expect(() =>
      structuralFidelitySchema.parse({ table_count: 1, scope_id: '' }),
    ).toThrow();
  });

  it('rejects a whitespace-only scope_id', () => {
    expect(() =>
      structuralFidelitySchema.parse({ table_count: 1, scope_id: '   ' }),
    ).toThrow();
  });

  it('trims surrounding whitespace from a scope_id', () => {
    expect(
      structuralFidelitySchema.parse({
        table_count: 1,
        scope_id: '  my-scope  ',
      }),
    ).toMatchObject({ scope_id: 'my-scope' });
  });

  it('rejects a negative table_count', () => {
    expect(() =>
      structuralFidelitySchema.parse({ table_count: -1 }),
    ).toThrow();
  });

  it('rejects a non-integer table_count', () => {
    expect(() =>
      structuralFidelitySchema.parse({ table_count: 1.5 }),
    ).toThrow();
  });
});
