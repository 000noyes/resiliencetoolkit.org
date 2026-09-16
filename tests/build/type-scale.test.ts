/**
 * The one type scale (DESIGN.md, Typography).
 *
 * Tailwind's fontSize is the ten-step token scale, no legacy names: every
 * default name (text-xs to text-5xl) is an alias that shares its step's
 * size and line height and carries no weight or tracking of its own, so a
 * default utility never changes a weight the custom name owns. base.css
 * defines every custom property the config reads, with one line height
 * per step.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config.mjs';

type Step = [string, { lineHeight: string; fontWeight?: string; letterSpacing?: string }];

const fontSize = (tailwindConfig as { theme: { extend: { fontSize: Record<string, Step> } } })
  .theme.extend.fontSize;

const STEPS = [
  'label',
  'chrome',
  'body-small',
  'body',
  'body-large',
  'subtitle',
  'title',
  'headline',
  'hero',
  'display',
];

const ALIASES: Record<string, string> = {
  xs: 'label',
  sm: 'body-small',
  base: 'body',
  lg: 'body-large',
  xl: 'subtitle',
  '2xl': 'title',
  '3xl': 'headline',
  '4xl': 'hero',
  '5xl': 'display',
};

const baseCss = readFileSync(path.resolve(__dirname, '../../src/styles/base.css'), 'utf-8');

describe('the type scale', () => {
  it('names exactly the ten steps, the uppercase accent, and the nine default aliases', () => {
    const names = Object.keys(fontSize).sort();
    const expected = [...STEPS, 'uppercase-accent', ...Object.keys(ALIASES)].sort();
    expect(names).toEqual(expected);
  });

  it('every step reads its size and line height from base.css custom properties', () => {
    for (const name of STEPS) {
      const [size, opts] = fontSize[name];
      expect(size, name).toBe(`var(--text-${name})`);
      expect(opts.lineHeight, name).toBe(`var(--leading-${name})`);
      expect(baseCss, `--text-${name} in base.css`).toMatch(new RegExp(`--text-${name}:\\s*[^;]+;`));
      expect(baseCss, `--leading-${name} in base.css`).toMatch(
        new RegExp(`--leading-${name}:\\s*[^;]+;`)
      );
    }
  });

  it('each default name shares its step\'s size and line height and carries no weight or tracking', () => {
    for (const [alias, stepName] of Object.entries(ALIASES)) {
      const [aliasSize, aliasOpts] = fontSize[alias];
      const [stepSize, stepOpts] = fontSize[stepName];
      expect(aliasSize, alias).toBe(stepSize);
      expect(aliasOpts.lineHeight, alias).toBe(stepOpts.lineHeight);
      expect(aliasOpts.fontWeight, `${alias} weight`).toBeUndefined();
      expect(aliasOpts.letterSpacing, `${alias} tracking`).toBeUndefined();
    }
  });

  it('the custom names carry their weight', () => {
    expect(fontSize.display[1].fontWeight).toBe('600');
    expect(fontSize.hero[1].fontWeight).toBe('500');
    expect(fontSize.label[1].fontWeight).toBe('500');
    expect(fontSize.body[1].fontWeight).toBe('400');
    expect(fontSize['uppercase-accent'][0]).toBe('var(--text-label)');
    expect(fontSize['uppercase-accent'][1].letterSpacing).toBe('0.1em');
  });

  it('the two fluid steps hit their anchors: hero 32 at 375 and 44 at 768, display 36 at 375 and 56 at 800', () => {
    const clamp = (name: string) => {
      const m = baseCss.match(new RegExp(`--text-${name}:\\s*clamp\\(([^)]+)\\)`));
      expect(m, name).not.toBeNull();
      const [min, mid, max] = m![1].split(',').map((s) => s.trim());
      const rem = (v: string) => parseFloat(v) * 16;
      const [, a, b] = mid.match(/([\d.]+)rem \+ ([\d.]+)vw/)!;
      return (width: number) =>
        Math.min(rem(max), Math.max(rem(min), rem(a) + (parseFloat(b) * width) / 100));
    };
    const hero = clamp('hero');
    const display = clamp('display');
    expect(hero(375)).toBeCloseTo(32, 0);
    expect(hero(768)).toBeCloseTo(44, 0);
    expect(hero(1360)).toBe(44);
    expect(display(375)).toBeCloseTo(36, 0);
    expect(display(800)).toBeCloseTo(56, 0);
    expect(display(1360)).toBe(56);
  });
});
