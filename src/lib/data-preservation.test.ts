/**
 * Data Preservation Regression Test
 *
 * Extracts all moduleKey values from source files (.astro and .mdx)
 * and verifies they match the canonical snapshot. Any migration that changes
 * these keys would destroy user data stored in IndexedDB.
 *
 * Also covers the seniors-and-disabilities IndexedDB migration (day-22):
 * verifies that pre-merge user check-state under `senior-citizens` and
 * `people-with-disabilities` is consolidated under
 * `seniors-and-disabilities-${todoId}` without data loss.
 *
 * Run: pnpm vitest run src/lib/data-preservation.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import 'fake-indexeddb/auto';
import {
  saveTodo,
  getTodo,
  getModuleTodos,
  getMetadata,
  setMetadata,
  deleteMetadata,
  deleteTodo,
  importAllData,
  migrateSeniorsAndDisabilities,
  migratePlaceCharacteristicsRow0,
  isDeprecatedModuleKey,
  DEPRECATED_MODULE_KEYS,
  saveTableRow,
  getTableRow,
  getTableRows,
  deleteTableRow,
} from './storage';

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
  'seniors-and-disabilities',
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
    expect(CANONICAL_MODULE_KEYS.size).toBe(22);
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

/**
 * Seniors + Disabilities IndexedDB Migration (day-22)
 *
 * The 1-8 section split was unmerged in day-21 — the two old moduleKeys
 * `senior-citizens` and `people-with-disabilities` were collapsed into a
 * single canonical `seniors-and-disabilities`. Day-22 ships the migration
 * that consolidates any user check-state stored under the old keys.
 *
 * These fixtures use scenario-prefixed `todoId`s so each test can run on
 * a clean IDB slice without depending on test ordering.
 */
const MIGRATION_MARKER_KEY = 'migration_seniors_and_disabilities_v1';
const MIGRATION_MODULE_KEYS = [
  'senior-citizens',
  'people-with-disabilities',
  'seniors-and-disabilities',
];

// Tests share a single fake-indexeddb instance because storage.ts caches
// the connection in a module-level singleton. Each test must clear ALL
// todos on the migration moduleKeys (not just the ids it seeds) so that
// state from prior tests does not leak into the migration's collision /
// idempotency / no_data assertions.
async function clearMigrationFixtures(): Promise<void> {
  await deleteMetadata(MIGRATION_MARKER_KEY);
  for (const moduleKey of MIGRATION_MODULE_KEYS) {
    const todos = await getModuleTodos(moduleKey);
    for (const todo of todos) {
      await deleteTodo(moduleKey, todo.todoId);
    }
  }
}

describe('Seniors + Disabilities Migration', () => {
  describe('happy path — copy under new moduleKey', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('copies all old-key check-states onto seniors-and-disabilities-${todoId}', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'hp-senior-only-checked',
        completed: true,
        completedAt: '2026-04-20T12:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'hp-disability-only-checked',
        completed: true,
        completedAt: '2026-04-21T12:00:00.000Z',
        notes: 'Service animal plan drafted',
      });
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'hp-senior-with-notes',
        completed: false,
        notes: 'Need to call council on aging',
      });

      const result = await migrateSeniorsAndDisabilities();
      expect(result.status).toBe('migrated');
      expect(result.todosCopied).toBe(3);
      expect(result.collisions).toBe(0);

      const merged1 = await getTodo('seniors-and-disabilities', 'hp-senior-only-checked');
      expect(merged1?.completed).toBe(true);
      expect(merged1?.completedAt).toBe('2026-04-20T12:00:00.000Z');
      expect(merged1?.moduleKey).toBe('seniors-and-disabilities');
      expect(merged1?.id).toBe('seniors-and-disabilities-hp-senior-only-checked');

      const merged2 = await getTodo('seniors-and-disabilities', 'hp-disability-only-checked');
      expect(merged2?.completed).toBe(true);
      expect(merged2?.completedAt).toBe('2026-04-21T12:00:00.000Z');
      expect(merged2?.notes).toBe('Service animal plan drafted');

      const merged3 = await getTodo('seniors-and-disabilities', 'hp-senior-with-notes');
      expect(merged3?.completed).toBe(false);
      expect(merged3?.notes).toBe('Need to call council on aging');
    });
  });

  describe('collision tie-break', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('a completed entry beats an uncompleted entry on the same todoId', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'col-completed-vs-uncompleted',
        completed: false,
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'col-completed-vs-uncompleted',
        completed: true,
        completedAt: '2026-04-22T08:00:00.000Z',
      });

      const result = await migrateSeniorsAndDisabilities();
      expect(result.collisions).toBe(1);

      const merged = await getTodo('seniors-and-disabilities', 'col-completed-vs-uncompleted');
      expect(merged?.completed).toBe(true);
      expect(merged?.completedAt).toBe('2026-04-22T08:00:00.000Z');
    });

    it('among two completed entries, the later completedAt wins', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'col-both-completed',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'col-both-completed',
        completed: true,
        completedAt: '2026-04-25T08:00:00.000Z',
      });

      const result = await migrateSeniorsAndDisabilities();
      expect(result.collisions).toBe(1);

      const merged = await getTodo('seniors-and-disabilities', 'col-both-completed');
      expect(merged?.completedAt).toBe('2026-04-25T08:00:00.000Z');
    });

    it('among two uncompleted entries, the one with notes wins', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'col-both-uncompleted-with-notes',
        completed: false,
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'col-both-uncompleted-with-notes',
        completed: false,
        notes: 'Reach out to disability rights group',
      });

      const result = await migrateSeniorsAndDisabilities();
      expect(result.collisions).toBe(1);

      const merged = await getTodo('seniors-and-disabilities', 'col-both-uncompleted-with-notes');
      expect(merged?.notes).toBe('Reach out to disability rights group');
    });

    it('when no other signal differs, the lexicographically first moduleKey is the primary, and distinct notes are preserved from both', async () => {
      // Both entries identical except for notes. Lexicographic order:
      // 'people-with-disabilities' < 'senior-citizens' — so the
      // disabilities entry is the primary. Distinct notes from both
      // sides survive via mergeWinner concat.
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'col-fallback-deterministic',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
        notes: 'from-senior',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'col-fallback-deterministic',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
        notes: 'from-disability',
      });

      const result = await migrateSeniorsAndDisabilities();
      expect(result.collisions).toBe(1);

      const merged = await getTodo('seniors-and-disabilities', 'col-fallback-deterministic');
      // Primary's note appears first (lexicographic anchor); secondary
      // concatenated after the separator.
      expect(merged?.notes?.startsWith('from-disability')).toBe(true);
      expect(merged?.notes).toContain('from-senior');
      expect(merged?.notes).toContain('---');
    });

    it('an existing post-merge entry on seniors-and-disabilities is preserved (target wins, source ignored)', async () => {
      // Simulates: user clicked the Todo on the new build between day-21
      // (when .astro switched to the new moduleKey) and day-22 (this commit).
      // Their click on the merged key must NOT be overwritten when the
      // pre-merge entry from senior-citizens runs through migration.
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'col-existing-target-wins',
        completed: true,
        completedAt: '2026-04-19T08:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'seniors-and-disabilities',
        todoId: 'col-existing-target-wins',
        completed: true,
        completedAt: '2026-04-29T08:00:00.000Z',
      });

      const result = await migrateSeniorsAndDisabilities();
      // Target exists → no write, no collision counted (collisions only
      // count cross-old-key duplicates that get merged via mergeWinner).
      expect(result.todosCopied).toBe(0);
      expect(result.collisions).toBe(0);

      const merged = await getTodo('seniors-and-disabilities', 'col-existing-target-wins');
      expect(merged?.completedAt).toBe('2026-04-29T08:00:00.000Z');
    });
  });

  describe('legacy data preservation', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('does not delete entries on old keys; old data remains readable post-migration', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'legacy-senior-readable',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'legacy-disability-readable',
        completed: false,
        notes: 'Pre-migration note',
      });

      await migrateSeniorsAndDisabilities();

      const oldSenior = await getTodo('senior-citizens', 'legacy-senior-readable');
      expect(oldSenior?.completed).toBe(true);
      expect(oldSenior?.moduleKey).toBe('senior-citizens');

      const oldDisability = await getTodo('people-with-disabilities', 'legacy-disability-readable');
      expect(oldDisability?.notes).toBe('Pre-migration note');
      expect(oldDisability?.moduleKey).toBe('people-with-disabilities');
    });

    it('flags old moduleKeys as deprecated via DEPRECATED_MODULE_KEYS', () => {
      expect(DEPRECATED_MODULE_KEYS.has('senior-citizens')).toBe(true);
      expect(DEPRECATED_MODULE_KEYS.has('people-with-disabilities')).toBe(true);
      expect(DEPRECATED_MODULE_KEYS.has('seniors-and-disabilities')).toBe(false);

      expect(isDeprecatedModuleKey('senior-citizens')).toBe(true);
      expect(isDeprecatedModuleKey('people-with-disabilities')).toBe(true);
      expect(isDeprecatedModuleKey('seniors-and-disabilities')).toBe(false);
    });
  });

  describe('idempotency', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('a second run reports already_run and copies nothing', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'idem-once',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });

      const first = await migrateSeniorsAndDisabilities();
      expect(first.status).toBe('migrated');
      expect(first.todosCopied).toBe(1);

      const second = await migrateSeniorsAndDisabilities();
      expect(second.status).toBe('already_run');
      expect(second.todosCopied).toBe(0);
      expect(second.collisions).toBe(0);

      // Marker is set
      const marker = await getMetadata(MIGRATION_MARKER_KEY);
      expect(typeof marker).toBe('string');
    });

    it('a second run does not overwrite a post-migration write on the merged key', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'idem-post-marker-set',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });

      await migrateSeniorsAndDisabilities();

      // After migration, user toggles the merged key explicitly (e.g.,
      // unchecks the item). This write is the source of truth going forward.
      await saveTodo({
        moduleKey: 'seniors-and-disabilities',
        todoId: 'idem-post-marker-set',
        completed: false,
      });

      const second = await migrateSeniorsAndDisabilities();
      expect(second.status).toBe('already_run');

      const merged = await getTodo('seniors-and-disabilities', 'idem-post-marker-set');
      expect(merged?.completed).toBe(false);
    });

    it('on a fresh device with no old-key data, returns no_data and intentionally does NOT set the marker', async () => {
      const result = await migrateSeniorsAndDisabilities();
      expect(result.status).toBe('no_data');
      expect(result.todosCopied).toBe(0);

      // Marker stays unset so a future import that brings old-key data in
      // will trigger a real migration pass (regression: P1 #1 from codex).
      const marker = await getMetadata(MIGRATION_MARKER_KEY);
      expect(marker).toBeUndefined();

      // No todos created on the merged key.
      const merged = await getModuleTodos('seniors-and-disabilities');
      expect(merged).toEqual([]);
    });

    it('a fresh-device no_data does NOT skip migration when old-key data appears later', async () => {
      // Simulates: user's first page load, no old data → no_data, no marker.
      // Then importAllData (or a real-world re-seed) brings old-key data in.
      // Next migration run must NOT short-circuit on a stale marker.
      const first = await migrateSeniorsAndDisabilities();
      expect(first.status).toBe('no_data');

      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'idem-late-arrival',
        completed: true,
        completedAt: '2026-04-25T08:00:00.000Z',
      });

      const second = await migrateSeniorsAndDisabilities();
      expect(second.status).toBe('migrated');
      expect(second.todosCopied).toBe(1);

      const merged = await getTodo('seniors-and-disabilities', 'idem-late-arrival');
      expect(merged?.completed).toBe(true);
    });
  });

  describe('atomicity + delta (codex challenge regressions)', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('the merged-key target is authoritative — post-migration writes are never overwritten by deprecated-key drift', async () => {
      // Codex P1 #3 documented limitation: a stale tab still running the
      // pre-day-21 UI may keep writing to a deprecated moduleKey after
      // migration ran on another tab. Those writes are orphaned. The
      // migration intentionally never re-imports source state once the
      // merged-key target exists, so post-migration user actions on the
      // merged key (unchecks, edits, notes) are preserved across reloads.
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'target-authoritative',
        completed: false,
      });
      await migrateSeniorsAndDisabilities();

      // Stale-tab write — appears in IndexedDB but must NOT propagate.
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'target-authoritative',
        completed: true,
        completedAt: '2099-01-01T00:00:00.000Z',
      });

      const second = await migrateSeniorsAndDisabilities();
      expect(second.status).toBe('already_run');
      expect(second.todosCopied).toBe(0);

      const merged = await getTodo('seniors-and-disabilities', 'target-authoritative');
      expect(merged?.completed).toBe(false);
      expect(merged?.completedAt).toBeUndefined();

      // Stale-tab write IS preserved on the deprecated key for forensic
      // recovery if a future migration version chooses to re-merge.
      const orphaned = await getTodo('senior-citizens', 'target-authoritative');
      expect(orphaned?.completed).toBe(true);
      expect(orphaned?.completedAt).toBe('2099-01-01T00:00:00.000Z');
    });

    it('a fully-current delta pass produces zero todo writes and reports already_run', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'delta-noop',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });

      await migrateSeniorsAndDisabilities();

      // Sources still exist (read-only deprecated keys) but the merged-key
      // target already matches. The delta pass should be zero-write.
      const second = await migrateSeniorsAndDisabilities();
      expect(second.status).toBe('already_run');
      expect(second.todosCopied).toBe(0);
    });

    it('importAllData clears the migration marker so imported old-key data is migrated', async () => {
      // First device: fresh, no_data → no marker.
      // Then this device imports a snapshot from an OLDER device that
      // (somehow) carries a marker AND old-key todos that were never
      // migrated on the source device.
      const importPayload = {
        todos: [
          {
            id: 'senior-citizens-imported-old-key',
            moduleKey: 'senior-citizens',
            todoId: 'imported-old-key',
            completed: true,
            completedAt: '2026-04-15T08:00:00.000Z',
          },
        ],
        tables: [],
        metadata: {
          [MIGRATION_MARKER_KEY]: '2026-04-10T08:00:00.000Z',
        },
      };

      await importAllData(importPayload);

      // Marker must have been cleared by importAllData (codex P1 #1).
      const markerAfterImport = await getMetadata(MIGRATION_MARKER_KEY);
      expect(markerAfterImport).toBeUndefined();

      // Migration runs on the imported state and migrates the old-key todo.
      const result = await migrateSeniorsAndDisabilities();
      expect(result.status).toBe('migrated');
      expect(result.todosCopied).toBe(1);

      const merged = await getTodo('seniors-and-disabilities', 'imported-old-key');
      expect(merged?.completed).toBe(true);
    });

    it('a non-string migration marker is treated as already-set (does not silently re-run)', async () => {
      // Codex P2 #5: a malformed import or manual IDB poke could leave
      // the marker as a non-string value. The guard is `marker !== undefined`,
      // not `isString(marker)`, so we don't silently redo work.
      await setMetadata(MIGRATION_MARKER_KEY, true);

      // No source data → already_run, not no_data, not migrated.
      const result = await migrateSeniorsAndDisabilities();
      expect(result.status).toBe('already_run');
      expect(result.todosCopied).toBe(0);
    });

    it('merged-key counts after migration match the union of distinct todoIds across old keys', async () => {
      // Codex P2 #6: tests should assert merged-key totals after migration.
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'count-shared',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'count-shared',
        completed: true,
        completedAt: '2026-04-21T08:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'count-senior-only',
        completed: false,
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'count-disability-only',
        completed: false,
        notes: 'tracking',
      });

      const result = await migrateSeniorsAndDisabilities();
      expect(result.status).toBe('migrated');
      expect(result.todosCopied).toBe(3); // 3 distinct todoIds
      expect(result.collisions).toBe(1); // count-shared collided

      const mergedTodos = await getModuleTodos('seniors-and-disabilities');
      const mergedIds = mergedTodos.map((t) => t.todoId).sort();
      expect(mergedIds).toEqual(['count-disability-only', 'count-senior-only', 'count-shared']);
    });
  });

  describe('notes preservation (codex P2 #4)', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('concatenates notes from multiple uncompleted entries with distinct notes', async () => {
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'notes-dual',
        completed: false,
        notes: 'Senior-side note: call council on aging',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'notes-dual',
        completed: false,
        notes: 'Disability-side note: contact VCIL',
      });

      await migrateSeniorsAndDisabilities();

      const merged = await getTodo('seniors-and-disabilities', 'notes-dual');
      expect(merged?.completed).toBe(false);
      expect(merged?.notes).toContain('Senior-side note: call council on aging');
      expect(merged?.notes).toContain('Disability-side note: contact VCIL');
      expect(merged?.notes).toContain('---');
    });

    it('does not duplicate notes when both uncompleted entries carry the same note text', async () => {
      const sharedNote = 'Same note on both sides';
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'notes-shared',
        completed: false,
        notes: sharedNote,
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'notes-shared',
        completed: false,
        notes: sharedNote,
      });

      await migrateSeniorsAndDisabilities();

      const merged = await getTodo('seniors-and-disabilities', 'notes-shared');
      expect(merged?.notes).toBe(sharedNote);
    });

    it('keeps completed-side state AND preserves the uncompleted-side note (regression for codex v2 P2 #5)', async () => {
      // The completed entry's check + completedAt is authoritative, but
      // the uncompleted-side note is also user-visible intent and must
      // not be silently dropped. mergeWinner concats the note onto the
      // completed primary's notes (which are typically empty).
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'notes-asymmetric',
        completed: true,
        completedAt: '2026-04-22T08:00:00.000Z',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'notes-asymmetric',
        completed: false,
        notes: 'Need paratransit follow-up',
      });

      await migrateSeniorsAndDisabilities();

      const merged = await getTodo('seniors-and-disabilities', 'notes-asymmetric');
      expect(merged?.completed).toBe(true);
      expect(merged?.completedAt).toBe('2026-04-22T08:00:00.000Z');
      expect(merged?.notes).toBe('Need paratransit follow-up');
    });

    it('preserves the older completed note when the later-completedAt winner has no notes (codex v3 test-gap closure)', async () => {
      // Two completed entries; the later-completedAt one is the primary
      // per pickMigrationWinner, but the older one carries the only note.
      // mergeWinner must concat that note onto the primary.
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'notes-completed-asymmetric',
        completed: true,
        completedAt: '2026-04-15T08:00:00.000Z',
        notes: 'Initial intake note',
      });
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'notes-completed-asymmetric',
        completed: true,
        completedAt: '2026-04-25T08:00:00.000Z',
        // No notes on the later-completedAt winner.
      });

      await migrateSeniorsAndDisabilities();

      const merged = await getTodo('seniors-and-disabilities', 'notes-completed-asymmetric');
      expect(merged?.completed).toBe(true);
      expect(merged?.completedAt).toBe('2026-04-25T08:00:00.000Z');
      expect(merged?.notes).toBe('Initial intake note');
    });

    it('dedupes notes that differ only by surrounding whitespace (regression for codex v2 P2 #4)', async () => {
      // people-with-disabilities is lexicographically first, so it's the
      // primary. Its note text is preserved verbatim. The trailing-space
      // candidate from senior-citizens is recognized as a trim-duplicate
      // and NOT concatenated — preventing pile-up over repeat migrations.
      await saveTodo({
        moduleKey: 'people-with-disabilities',
        todoId: 'notes-whitespace-dup',
        completed: false,
        notes: 'Call council',
      });
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'notes-whitespace-dup',
        completed: false,
        notes: 'Call council ', // trailing space — semantically the same
      });

      await migrateSeniorsAndDisabilities();

      const merged = await getTodo('seniors-and-disabilities', 'notes-whitespace-dup');
      expect(merged?.notes).toBe('Call council');
    });
  });

  describe('marker hardening (codex v2 P2 #2)', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('a null-valued marker is treated as already-set (does not silently re-run)', async () => {
      // The guard is `marker !== undefined`, so any non-undefined value
      // (true, null, an object, a number) counts as "already migrated".
      // Defends against malformed imports that left a non-string value
      // at the migration marker key.
      await setMetadata(MIGRATION_MARKER_KEY, null);

      const result = await migrateSeniorsAndDisabilities();
      expect(result.status).toBe('already_run');
      expect(result.todosCopied).toBe(0);
    });
  });

  describe('concurrent migrations (codex v2 P2 #3)', () => {
    beforeEach(async () => {
      await clearMigrationFixtures();
    });

    it('a tab serialized after another tab finishes the merge reports already_run, not a misleading migrated:0', async () => {
      // Simulates the tail-end of a two-tab race: both tabs pre-checked
      // with no marker, both saw source data. Tab A finished first,
      // populated the merged key + marker. Tab B's tx now runs second,
      // sees the existing target, skips writes. Status must be
      // 'already_run' (zero work) — not 'migrated' (which used to be
      // returned because hasMarker was captured pre-tx as false).
      await saveTodo({
        moduleKey: 'senior-citizens',
        todoId: 'concurrent-tail',
        completed: true,
        completedAt: '2026-04-20T08:00:00.000Z',
      });

      // Tab A run.
      const tabA = await migrateSeniorsAndDisabilities();
      expect(tabA.status).toBe('migrated');
      expect(tabA.todosCopied).toBe(1);

      // Tab B run with a stale "no marker" view: simulate by clearing
      // the marker between A's commit and B's start.
      await deleteMetadata(MIGRATION_MARKER_KEY);

      const tabB = await migrateSeniorsAndDisabilities();
      expect(tabB.status).toBe('already_run');
      expect(tabB.todosCopied).toBe(0);
    });
  });
});

/**
 * Place Characteristics Row-0 Slots Migration (PR B)
 *
 * Substrate restore: workbook p10's 3-slot enumeration ("1: 2: 3:") was
 * authored as row-0 of the place-characteristics DataTable as a single
 * free-text "Your Response" cell. PR B extracts row-0 into a SlotCollection
 * under an isolated tableId ("place-characteristics-row-0-slots"); the
 * migration lifts existing legacy text into slot-1 while preserving any
 * user state already on the new SlotCollection.
 *
 * Mirrors the seniors precedent's discipline:
 *   - Marker NEVER set on `no_data` (late-arriving import must re-evaluate)
 *   - Target-authoritative across ALL slots (slot-2-only state blocks overwrite)
 *   - Lossless (legacy row-0 record stays readable on pre-substrate key)
 *   - Marker hardening (non-string marker treated as already-set)
 *   - importAllData clears the marker (extended MIGRATION_MARKER_KEYS)
 */
const PLACE_CHAR_ROW0_MIGRATION_MARKER = 'migration_place_characteristics_row_0_slots_v1';
const PLACE_CHAR_ROW0_MODULE_KEY = 'knowing-community';
const PLACE_CHAR_ROW0_LEGACY_TABLE_ID = 'place-characteristics';
const PLACE_CHAR_ROW0_LEGACY_ROW_ID = 'row-0';
const PLACE_CHAR_ROW0_MERGED_TABLE_ID = 'place-characteristics-row-0-slots';

async function clearPlaceCharRow0Fixtures(): Promise<void> {
  await deleteMetadata(PLACE_CHAR_ROW0_MIGRATION_MARKER);
  // Legacy row-0 record
  await deleteTableRow(
    PLACE_CHAR_ROW0_MODULE_KEY,
    PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
    PLACE_CHAR_ROW0_LEGACY_ROW_ID,
  );
  // All slot records under the merged tableId
  const existingSlots = await getTableRows(
    PLACE_CHAR_ROW0_MODULE_KEY,
    PLACE_CHAR_ROW0_MERGED_TABLE_ID,
  );
  for (const slot of existingSlots) {
    await deleteTableRow(PLACE_CHAR_ROW0_MODULE_KEY, PLACE_CHAR_ROW0_MERGED_TABLE_ID, slot.rowId);
  }
}

async function seedLegacyRow(responseText: string): Promise<void> {
  await saveTableRow({
    moduleKey: PLACE_CHAR_ROW0_MODULE_KEY,
    tableId: PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
    rowId: PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    data: {
      Prompt: 'Write down three important things about your place/what life is like here.',
      'Your Response': responseText,
    },
  });
}

async function seedSlot(slotNumber: number, value: string): Promise<void> {
  await saveTableRow({
    moduleKey: PLACE_CHAR_ROW0_MODULE_KEY,
    tableId: PLACE_CHAR_ROW0_MERGED_TABLE_ID,
    rowId: `slot-${slotNumber}`,
    data: { value },
  });
}

describe('Place Characteristics Row-0 Slots Migration', () => {
  beforeEach(async () => {
    await clearPlaceCharRow0Fixtures();
  });

  it('1. happy path — lifts legacy "Your Response" text into slot-1 and deletes the source row', async () => {
    await seedLegacyRow('first thing\nsecond thing\nthird thing');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('migrated');
    expect(result.slotsCopied).toBe(1);

    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('first thing\nsecond thing\nthird thing');

    // Slots 2 and 3 remain unwritten
    const slot2 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-2',
    );
    const slot3 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-3',
    );
    expect(slot2).toBeUndefined();
    expect(slot3).toBeUndefined();

    // Legacy source row was deleted in the same transaction so DataTable's
    // namespace-scoped getTableRows no longer surfaces it alongside row-1/2/3.
    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeUndefined();
  });

  it('1b. preserves user whitespace — slot-1 stores raw legacy bytes (leading/trailing whitespace intact)', async () => {
    // Trim is the emptiness gate only — the user's exact bytes are written
    // to slot-1 unchanged (codex P2: do not silently mutate user data).
    await seedLegacyRow('  important thing 1\n  important thing 2  ');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('migrated');

    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('  important thing 1\n  important thing 2  ');
  });

  it('2. idempotency — second run reports already_run, no further writes', async () => {
    await seedLegacyRow('user notes');

    const first = await migratePlaceCharacteristicsRow0();
    expect(first.status).toBe('migrated');

    const second = await migratePlaceCharacteristicsRow0();
    expect(second.status).toBe('already_run');
    expect(second.slotsCopied).toBe(0);

    // slot-1 still holds the migrated text — nothing was rewritten
    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('user notes');
  });

  it('3. slot-2 typed before migration completed — migrate legacy into empty slot-1, preserve slot-2, delete legacy', async () => {
    // Race window: user opened the page, the UI hydrated, the user typed
    // into slot-2 BEFORE migration's IndexedDB transaction completed.
    // Migration must:
    //   - recover the legacy bytes by writing them into the empty slot-1
    //     (slot-1 was empty, so this is non-destructive)
    //   - preserve the user's slot-2 typing
    //   - delete the legacy row so DataTable does not surface it as a
    //     duplicate prompt below the SlotCollection
    await seedLegacyRow('legacy bytes recovered into slot-1');
    await seedSlot(2, 'I started typing in slot 2 during the load race');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('migrated');
    expect(result.slotsCopied).toBe(1);

    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('legacy bytes recovered into slot-1');

    // slot-2 is preserved verbatim
    const slot2 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-2',
    );
    expect(slot2?.data?.value).toBe('I started typing in slot 2 during the load race');

    // Legacy source row is gone — no double-render
    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeUndefined();
  });

  it('4. slot-1 already populated — user typing wins, legacy is released, legacy row deleted', async () => {
    // User has typed directly into slot-1 post-PR-B (e.g., they ignored
    // their pre-PR-B row-0 text and started fresh). Their slot-1 value
    // is authoritative. Migration must:
    //   - leave slot-1 unchanged (do NOT overwrite)
    //   - delete the legacy row anyway to prevent DataTable double-render
    //   - return already_run, set marker
    await seedLegacyRow('legacy bytes released because user retyped');
    await seedSlot(1, 'user typed directly into slot-1');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('already_run');
    expect(result.slotsCopied).toBe(0);

    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('user typed directly into slot-1');

    // Legacy source row is gone — no double-render
    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeUndefined();
  });

  it('5. no_data — empty legacy, marker stays unset (late-arriving import re-evaluates)', async () => {
    // No legacy row exists at all
    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('no_data');
    expect(result.slotsCopied).toBe(0);

    // Marker MUST stay unset so a future import that brings legacy data in
    // triggers a real migration pass (codex P1 #1 regression precedent).
    const marker = await getMetadata(PLACE_CHAR_ROW0_MIGRATION_MARKER);
    expect(marker).toBeUndefined();

    // Now simulate the late import: bring in legacy text, run migration again
    await seedLegacyRow('arrived later via import');
    const second = await migratePlaceCharacteristicsRow0();
    expect(second.status).toBe('migrated');
    expect(second.slotsCopied).toBe(1);
  });

  it('6. marker hardening — non-string marker is treated as already-set', async () => {
    // The guard is `marker !== undefined`, so any non-undefined value
    // (true, null, an object) counts as already migrated. Defends against
    // malformed imports that left a non-string value at the marker key.
    await setMetadata(PLACE_CHAR_ROW0_MIGRATION_MARKER, true);
    await seedLegacyRow('would-be migrated text');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('already_run');
    expect(result.slotsCopied).toBe(0);

    // Marker short-circuited the migration: legacy row was NOT deleted
    // (no migration ran), slot-1 was NOT written.
    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1).toBeUndefined();
    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeTruthy();
  });

  it('7. importAllData clears the migration marker so imported legacy data is migrated', async () => {
    // First device populated the marker but the imported snapshot brings
    // legacy row-0 data that was never migrated on the source device.
    const importPayload = {
      todos: [],
      tables: [
        {
          id: `${PLACE_CHAR_ROW0_MODULE_KEY}-${PLACE_CHAR_ROW0_LEGACY_TABLE_ID}-${PLACE_CHAR_ROW0_LEGACY_ROW_ID}`,
          moduleKey: PLACE_CHAR_ROW0_MODULE_KEY,
          tableId: PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
          rowId: PLACE_CHAR_ROW0_LEGACY_ROW_ID,
          data: {
            Prompt: 'Write down three important things about your place/what life is like here.',
            'Your Response': 'imported legacy text',
          },
          updatedAt: '2026-04-15T08:00:00.000Z',
        },
      ],
      metadata: {
        [PLACE_CHAR_ROW0_MIGRATION_MARKER]: '2026-04-10T08:00:00.000Z',
      },
    };

    await importAllData(importPayload);

    // Marker was cleared by importAllData via the extended MIGRATION_MARKER_KEYS.
    const markerAfterImport = await getMetadata(PLACE_CHAR_ROW0_MIGRATION_MARKER);
    expect(markerAfterImport).toBeUndefined();

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('migrated');
    expect(result.slotsCopied).toBe(1);

    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('imported legacy text');
  });

  it('8. legacy row-0 is deleted in the same transaction as the slot-1 write (no double-render)', async () => {
    // DataTable.tsx loads via getTableRows(moduleKey, tableId) which is
    // namespace-scoped — it returns the orphan row-0 alongside row-1/2/3
    // and renders all of them. To avoid surfacing the same workbook prompt
    // twice (once in the SlotCollection above, once in the DataTable
    // below), the migration deletes the legacy source row inside the same
    // atomic transaction as the slot-1 write. The user's bytes live in
    // slot-1 from this point forward.
    await seedLegacyRow('this row will be deleted post-copy');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('migrated');

    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeUndefined();

    // The migrated bytes are intact in slot-1 — slot-1 IS the canonical
    // post-PR-B recovery point.
    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1?.data?.value).toBe('this row will be deleted post-copy');
  });

  it('9. defensive — malformed legacyRow (missing "Your Response" field) is treated as no_data, but the ghost row is deleted', async () => {
    // Some imports may carry a legacy row whose data shape differs from the
    // expected DataTable two-column shape — e.g. a saveFormField path
    // accidentally writing { value: ... } under the legacy tableId, or an
    // older row schema. The migration's optional chain on
    // legacyRow?.data?.[FIELD] must guard against both shapes without
    // crashing. Because DataTable would render the malformed row as a
    // ghost (empty prompt, empty response) below the SlotCollection, the
    // migration also deletes it. Marker stays unset so a later import
    // with the correct shape can still trigger a real migration.
    await saveTableRow({
      moduleKey: PLACE_CHAR_ROW0_MODULE_KEY,
      tableId: PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      rowId: PLACE_CHAR_ROW0_LEGACY_ROW_ID,
      // Wrong shape: { value } instead of { 'Your Response' }
      data: { value: 'legacy-but-wrong-shape' },
    });

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('no_data');
    expect(result.slotsCopied).toBe(0);

    // Marker stays unset — a future re-import with correct shape can still migrate.
    const marker = await getMetadata(PLACE_CHAR_ROW0_MIGRATION_MARKER);
    expect(marker).toBeUndefined();

    // Malformed legacy row was deleted — no ghost row remains for
    // DataTable to render below the SlotCollection.
    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeUndefined();
  });

  it('10. defensive — whitespace-only "Your Response" is treated as no_data, but the ghost row is deleted', async () => {
    // Legacy text is just "   " — trims to empty, no migration. But the
    // row still exists in the place-characteristics namespace and would
    // be surfaced by DataTable as an empty ghost row. Delete it.
    await seedLegacyRow('   \n\t  ');

    const result = await migratePlaceCharacteristicsRow0();
    expect(result.status).toBe('no_data');
    expect(result.slotsCopied).toBe(0);

    // No slot-1 write, no marker
    const slot1 = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_MERGED_TABLE_ID,
      'slot-1',
    );
    expect(slot1).toBeUndefined();
    const marker = await getMetadata(PLACE_CHAR_ROW0_MIGRATION_MARKER);
    expect(marker).toBeUndefined();

    // Legacy whitespace-only row deleted — no ghost row in DataTable.
    const legacyRow = await getTableRow(
      PLACE_CHAR_ROW0_MODULE_KEY,
      PLACE_CHAR_ROW0_LEGACY_TABLE_ID,
      PLACE_CHAR_ROW0_LEGACY_ROW_ID,
    );
    expect(legacyRow).toBeUndefined();
  });
});
