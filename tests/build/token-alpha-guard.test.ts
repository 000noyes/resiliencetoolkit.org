import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import tailwindConfig from '../../tailwind.config.mjs';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(astro|tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Token colors resolve to CSS variables without an <alpha-value> slot, so
 * Tailwind cannot build opacity-modified utilities from them: a class like
 * bg-primary/10 is silently dropped from the compiled CSS and renders
 * nothing. This guard fails the suite when any /NN opacity utility is
 * applied to a token color in src. Literal palette colors (black/50,
 * white/80) still work and stay exempt.
 */

function collectTokenColorNames(): string[] {
  const names: string[] = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
      if (typeof value === 'string') {
        if (value.includes('var(--')) names.push(name);
      } else if (value && typeof value === 'object') {
        walk(value as Record<string, unknown>, name);
      }
    }
  };
  const colors = (tailwindConfig as { theme?: { extend?: { colors?: object } } })
    .theme?.extend?.colors;
  if (colors) walk(colors as Record<string, unknown>, '');
  return names;
}

describe('token-color alpha modifiers (ER6 guard)', () => {
  it('finds token colors in the tailwind config', () => {
    expect(collectTokenColorNames().length).toBeGreaterThan(10);
  });

  it('no /NN opacity utility rides a token color anywhere in src', () => {
    const tokens = collectTokenColorNames()
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const pattern = new RegExp(
      `(?:[\\w-]+:)*(?:from|via|to|bg|text|border|ring|divide|outline|decoration|shadow|fill|stroke|accent|caret|placeholder)-(?:${tokens})\\/\\d+`,
      'g'
    );
    const offenders: string[] = [];
    const files = sourceFiles('src');
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const hits = line.match(pattern);
        if (hits) offenders.push(`${file}:${i + 1} ${hits.join(' ')}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
