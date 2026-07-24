/**
 * Copy typography — house style: no em (—) or en (–) dashes in authored
 * site copy. Sentences are broken with periods, colons, or commas instead.
 *
 * Scope is the copy WE author: pages, components, and data files. Excluded:
 * - Toolkit content reproduced verbatim from its sources (module pages, the
 *   introduction, the workflow step pages) — those keep their original
 *   punctuation, whatever it is.
 * - Comments (never rendered) and test files.
 * - The standalone "—" empty-cell placeholder (an element whose entire text
 *   is a single em dash, e.g. the downloads resource table).
 *
 * The scan is source-level so it also covers strings that only render
 * client-side inside islands (modals, widgets, print templates), which a
 * built-HTML scan would miss.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

const SCAN_DIRS = ['src/pages', 'src/components', 'src/data'];
const SCAN_FILES = ['src/lib/storageHealth.ts', 'src/lib/notices.ts'];
const SCAN_EXTENSIONS = new Set(['.astro', '.tsx', '.ts']);

/** Verbatim-source content keeps its original punctuation. */
const EXCLUDED = [
  'src/pages/modules',
  'src/pages/introduction.astro',
  'src/pages/workflows/before.astro',
  'src/pages/workflows/response.astro',
  'src/pages/workflows/recover.astro',
];

function isExcluded(relPath: string): boolean {
  return (
    relPath.includes('.test.') ||
    EXCLUDED.some(prefix => relPath === prefix || relPath.startsWith(prefix + '/'))
  );
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (SCAN_EXTENSIONS.has(path.extname(name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Remove text that never reaches a reader: block comments, line comments
 * (only when preceded by line start or whitespace, so `https://` inside
 * strings survives), and HTML comments. Comment bodies are replaced with
 * blank equivalents that preserve line numbers.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/[^\n]*/gm, (m, lead) => lead + ' '.repeat(m.length - lead.length));
}

/** The empty-cell placeholder: an element whose entire text is one em dash. */
function dropPlaceholderDashes(source: string): string {
  return source.replace(/>—</g, '><');
}

describe('site copy typography', () => {
  it('authored copy contains no em or en dashes', () => {
    const files = [
      ...SCAN_DIRS.flatMap(dir => walk(path.join(ROOT, dir))),
      ...SCAN_FILES.map(f => path.join(ROOT, f)),
    ];

    const hits: string[] = [];
    for (const file of files) {
      const relPath = path.relative(ROOT, file).split(path.sep).join('/');
      if (isExcluded(relPath)) continue;
      const cleaned = dropPlaceholderDashes(stripComments(readFileSync(file, 'utf8')));
      cleaned.split('\n').forEach((line, i) => {
        if (/[—–]/.test(line)) {
          hits.push(`${relPath}:${i + 1}: ${line.trim()}`);
        }
      });
    }

    expect(hits, `em/en dashes in authored copy:\n${hits.join('\n')}`).toEqual([]);
  });
});
