/**
 * The per-block id stability contract (ER4): ids are write-once once notes
 * can anchor to them. The registry at src/data/annot-registry.json records
 * every id the built reading pages carry; a recorded id may never vanish
 * or change, every built id must be recorded, and every id follows the
 * kept API's shape rule (max 64 chars, alphanumeric and hyphen).
 *
 * The dist comparisons skip without a build; the shape checks always run.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_ID_RE } from '@/lib/block-ids';
// @ts-expect-error plain .mjs module without type declarations
import { collectBlockIds } from '../../scripts/annot-registry.mjs';

const root = path.resolve(__dirname, '../..');
const registryPath = path.join(root, 'src', 'data', 'annot-registry.json');
const DIST_PRESENT = existsSync(path.join(root, 'dist', 'index.html'));

const registry: Record<string, string[]> = JSON.parse(readFileSync(registryPath, 'utf-8'));

describe('annotation id registry', () => {
  it('records the introduction and every chapter', () => {
    const routes = Object.keys(registry);
    expect(routes).toContain('/introduction');
    expect(routes.filter((r) => /^\/modules\/.+\/\d+-\d+$/.test(r)).length).toBeGreaterThanOrEqual(16);
    expect(routes).toContain('/modules/knowing-your-community');
  });

  it('every id follows the API shape rule and is unique on its page', () => {
    for (const [route, ids] of Object.entries(registry)) {
      expect(new Set(ids).size, `${route}: duplicate ids`).toBe(ids.length);
      for (const id of ids) {
        expect(BLOCK_ID_RE.test(id), `${route}: ${id}`).toBe(true);
        expect(id.length, `${route}: ${id}`).toBeLessThanOrEqual(64);
      }
    }
  });

  it.skipIf(!DIST_PRESENT)('write-once: every recorded id is still in the build, and every built id is recorded', () => {
    const built: Record<string, string[]> = collectBlockIds();
    for (const [route, ids] of Object.entries(registry)) {
      const now = new Set(built[route] ?? []);
      const missing = ids.filter((id) => !now.has(id));
      expect(missing, `${route}: recorded ids gone from the build (write-once)`).toEqual([]);
    }
    for (const [route, ids] of Object.entries(built)) {
      const recorded = new Set(registry[route] ?? []);
      const unrecorded = ids.filter((id) => !recorded.has(id));
      expect(unrecorded, `${route}: built ids not in the registry; run node scripts/annot-registry.mjs`).toEqual([]);
    }
  });
});
