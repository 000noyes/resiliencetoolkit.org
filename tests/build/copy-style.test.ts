/**
 * Copy style: plain-language checks for the site's own text.
 *
 * People often read this site mid-disaster, on a phone, in a hurry. The
 * copy stays plain so it can be read once and acted on: short sentences,
 * simple punctuation, links that say where they go. These checks hold
 * that line in the text we author.
 *
 * Rules:
 * 1. Sentences break with periods, colons, or commas, not with em or en
 *    dashes. Long asides get cut or become their own sentence.
 * 2. Link and button text names its destination. "Click here" and
 *    "tap here" tell a reader nothing on their own.
 *
 * Scope is the copy we author: pages, components, data files, and the
 * notice copy modules. Excluded:
 * - Toolkit content reproduced verbatim from its sources (module pages,
 *   the introduction, the workflow step pages). Source text keeps its
 *   original punctuation and wording, whatever they are.
 * - Code comments (never rendered) and test files.
 * - The standalone dash placeholder in empty table cells (an element
 *   whose entire text is a single em dash, e.g. the downloads resource
 *   table).
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

/** Verbatim-source content keeps its original punctuation and wording. */
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

function scanAuthoredCopy(pattern: RegExp): string[] {
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
      if (pattern.test(line)) {
        hits.push(`${relPath}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  return hits;
}

describe('site copy style', () => {
  it('sentences break with plain punctuation, not em or en dashes', () => {
    const hits = scanAuthoredCopy(/[—–]/);
    expect(hits, `dashes in authored copy:\n${hits.join('\n')}`).toEqual([]);
  });

  it('link and button text names its destination', () => {
    const hits = scanAuthoredCopy(/\b(?:click|tap)\s+here\b/i);
    expect(hits, `vague link text in authored copy:\n${hits.join('\n')}`).toEqual([]);
  });
});
