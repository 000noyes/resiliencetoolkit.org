/**
 * The 12px floor is conditional (DESIGN.md, Typography): the label step
 * exists for uppercase tracked labels and tabular numerals, where capitals
 * and figures carry more glyph height per pixel. Lowercase running text
 * never sits at 12; it starts at chrome (13).
 *
 * Enforced two ways. Every stylesheet rule that sets `var(--text-label)`
 * also sets `text-transform: uppercase` or `font-variant-numeric:
 * tabular-nums`. Every markup class list that carries `text-label`,
 * `text-xs`, or `text-uppercase-accent` also carries `uppercase` or
 * `tabular-nums`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(astro|tsx|ts|css)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

const files = walk(path.join(ROOT, 'src'));

/** Every `selector { ... }` block whose body sets the label size */
function labelRules(css: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    if (/var\(--text-label\)/.test(m[2])) rules.push({ selector: m[1].trim(), body: m[2] });
  }
  return rules;
}

describe('the label step is uppercase or tabular', () => {
  it('every stylesheet rule at var(--text-label) sets uppercase or tabular-nums', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const file of files) {
      const text = readFileSync(file, 'utf-8');
      if (!text.includes('var(--text-label)')) continue;
      for (const rule of labelRules(text)) {
        seen++;
        const ok =
          /text-transform:\s*uppercase/.test(rule.body) ||
          /font-variant-numeric:\s*tabular-nums/.test(rule.body);
        if (!ok) offenders.push(`${path.relative(ROOT, file)}: ${rule.selector.split('\n').pop()}`);
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('every markup class list at the label size sets uppercase or tabular-nums', () => {
    const offenders: string[] = [];
    let seen = 0;
    // class="...", className="...", className={`...`}, class:list={[...]}
    const attr =
      /(?:class|className|class:list)=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{\[([\s\S]*?)\]\})/g;
    for (const file of files) {
      if (file.endsWith('.css')) continue;
      const text = readFileSync(file, 'utf-8');
      for (const m of text.matchAll(attr)) {
        const list = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
        if (!/\btext-(?:label|xs|uppercase-accent)\b/.test(list)) continue;
        seen++;
        if (!/\b(?:uppercase|tabular-nums)\b/.test(list)) {
          const line = text.slice(0, m.index).split('\n').length;
          offenders.push(`${path.relative(ROOT, file)}:${line} ${list.trim().slice(0, 80)}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(5);
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
