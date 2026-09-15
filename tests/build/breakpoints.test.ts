/**
 * Five breakpoints, one source (DESIGN.md, Layout).
 *
 * src/lib/breakpoints.mjs is the only place a breakpoint value is written.
 * Tailwind's screens are built from it, so a `sm:` utility, an `@screen`
 * rule, and a script that watches a width all agree. Tailwind's own xl
 * and 2xl are gone: the site has no 1280 or 1536 band.
 */
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config.mjs';
import { breakpoints, atOrAbove, below } from '../../src/lib/breakpoints.mjs';

const screens = (tailwindConfig as { theme: { screens: Record<string, string> } }).theme.screens;

describe('breakpoints', () => {
  it('are the five named values, mobile first', () => {
    expect(breakpoints).toEqual({ sm: 640, md: 768, lg: 1024, reading: 1200, wide: 1340 });
  });

  it('the Tailwind screens equal the module', () => {
    expect(screens).toEqual(
      Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v}px`]))
    );
  });

  it('the query helpers never overlap at a threshold', () => {
    expect(atOrAbove('md')).toBe('(min-width: 768px)');
    expect(below('md')).toBe('(max-width: 767.98px)');
  });
});
