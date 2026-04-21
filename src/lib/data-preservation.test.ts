/**
 * Data Preservation Regression Test
 *
 * Extracts all moduleKey values from source files (.astro and .mdx)
 * and verifies they match the canonical snapshot. Any migration that changes
 * these keys would destroy user data stored in IndexedDB.
 *
 * Run: pnpm vitest run src/lib/data-preservation.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function findFiles(dir: string, patterns: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, patterns));
    } else if (patterns.some(p => entry.name.endsWith(p))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractModuleKeys(content: string): string[] {
  const matches = content.match(/moduleKey="([^"]+)"/g) || [];
  return [...new Set(matches.map(m => m.replace(/moduleKey="([^"]+)"/, '$1')))];
}

/**
 * Canonical snapshot of all moduleKeys used across the toolkit.
 * If a migration changes any of these, user IndexedDB data is lost.
 * Adding new keys is safe. Removing or renaming keys is NOT.
 */
const CANONICAL_MODULE_KEYS = new Set([
  'emergency-preparedness-kits',
  'food-and-water',
  'first-aid-medical',
  'power-supply',
  'sanitation-hygiene',
  'children-disaster',
  'senior-citizens',
  'people-with-disabilities',
  'lep-populations',
  'warming-cooling-shelter',
  'farm-animals',
  'vehicles-equipment',
  'mutual-aid',
  'flood-recovery',
  'community-emergency-response',
  'volunteer-management',
  'community-building',
  'knowing-community',
  'bringing-people-together',
  'basic-needs',
  'shared-tools',
]);

describe('Data Preservation', () => {
  const srcDir = path.resolve(__dirname, '..');

  it('all source files use only canonical moduleKeys', () => {
    const astroFiles = findFiles(path.join(srcDir, 'pages/modules'), ['.astro']);
    const mdxFiles = findFiles(path.join(srcDir, 'content/sections'), ['.mdx']);
    const allFiles = [...astroFiles, ...mdxFiles];

    const unknownKeys: Array<{ file: string; key: string }> = [];

    for (const fullPath of allFiles) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const keys = extractModuleKeys(content);
      const relPath = path.relative(srcDir, fullPath);

      for (const key of keys) {
        if (!CANONICAL_MODULE_KEYS.has(key)) {
          unknownKeys.push({ file: relPath, key });
        }
      }
    }

    expect(unknownKeys).toEqual([]);
  });

  it('canonical moduleKey set has not shrunk (no keys removed)', () => {
    expect(CANONICAL_MODULE_KEYS.size).toBe(21);
  });

  it('every section file with interactive components has a moduleKey', () => {
    const astroFiles = findFiles(path.join(srcDir, 'pages/modules'), ['.astro']);
    const mdxFiles = findFiles(path.join(srcDir, 'content/sections'), ['.mdx']);
    const allFiles = [...astroFiles, ...mdxFiles];

    const filesWithoutModuleKey: string[] = [];

    for (const fullPath of allFiles) {
      const name = path.basename(fullPath);
      if (name.includes('index') || name.includes('[slug]')) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      const hasTodo = content.includes('<Todo');
      const hasEditableTable = content.includes('<EditableTable');
      const hasDataTable = content.includes('<DataTable');
      const hasPlanForm = content.includes('<PlanForm');

      if ((hasTodo || hasEditableTable || hasDataTable || hasPlanForm) && extractModuleKeys(content).length === 0) {
        filesWithoutModuleKey.push(path.relative(srcDir, fullPath));
      }
    }

    expect(filesWithoutModuleKey).toEqual([]);
  });
});
