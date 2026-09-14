/**
 * The search route is one named constant (the appendix, DR7): every
 * search href in the source derives from searchRoute in the contents
 * model. No page, component, or module spells the path itself.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { searchRoute } from '@/data/contents';

const srcDir = path.resolve(__dirname, '../../src');
const CONSTANT_HOME = path.join(srcDir, 'data', 'contents.ts');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(astro|ts|tsx|mjs)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('searchRoute is the only search href source', () => {
  it('names /search', () => {
    expect(searchRoute).toBe('/search');
  });

  it('no source file outside the contents model spells the route', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(srcDir)) {
      if (file === CONSTANT_HOME) continue;
      const text = readFileSync(file, 'utf-8');
      // A quoted literal or a path with a query: '/search', "/search", `/search?`
      if (/['"`]\/search(?:[?'"`\/])/.test(text)) offenders.push(path.relative(srcDir, file));
    }
    expect(offenders).toEqual([]);
  });

  it('the page file itself lives at the route', () => {
    expect(readdirSync(path.join(srcDir, 'pages'))).toContain('search.astro');
  });
});
