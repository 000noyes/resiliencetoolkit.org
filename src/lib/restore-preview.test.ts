/**
 * Restore preview + verdict derivation (DX5, corrected by the eng review).
 *
 * The load-bearing rule: exact-count verdicts ("this file does not have the 3
 * changes you made since July 14") are shown ONLY when the previewed file's
 * lineage matches this device's last recorded baseline. Every other case uses
 * the conservative wording. The file-holds-work verdict is provable by id
 * difference and composes with the missing-newer verdict. The partial-file
 * gate flags a file that holds fewer modules than the device.
 *
 * Run: pnpm vitest run src/lib/restore-preview.test.ts
 */
import { describe, it, expect } from 'vitest';
import { parseBackupFile, buildRestorePreview, type DeviceStateForPreview } from './restore-preview';

const fileRows = {
  todos: [
    { id: 'mod-a-t1', moduleKey: 'mod-a', todoId: 't1', completed: true },
    { id: 'mod-a-t2', moduleKey: 'mod-a', todoId: 't2', completed: false },
  ],
  tables: [
    {
      id: 'mod-b-tab-r1',
      moduleKey: 'mod-b',
      tableId: 'tab',
      rowId: 'r1',
      data: { c: 'x' },
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  ],
  metadata: {},
};

function device(overrides: Partial<DeviceStateForPreview> = {}): DeviceStateForPreview {
  return {
    deviceId: 'device-here',
    cue: { counter: 'unknown', lastBackupAt: null, lastBackupHash: null },
    ids: new Set(['mod-a-t1', 'mod-a-t2', 'mod-b-tab-r1']),
    moduleKeys: new Set(['mod-a', 'mod-b']),
    ...overrides,
  };
}

describe('parseBackupFile', () => {
  it('accepts a legacy file with none of the new fields', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.exportedAt).toBeNull();
      expect(parsed.data.todos).toHaveLength(2);
    }
  });

  it('reads the designed fields when present', () => {
    const parsed = parseBackupFile(
      JSON.stringify({
        ...fileRows,
        exportedAt: '2026-07-02T09:00:00.000Z',
        backupDeviceId: 'device-elsewhere',
        backupCounter: 4,
        backupSnapshotHash: 'abc',
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.exportedAt).toBe('2026-07-02T09:00:00.000Z');
      expect(parsed.data.lineage).toEqual({
        backupDeviceId: 'device-elsewhere',
        backupCounter: 4,
        backupSnapshotHash: 'abc',
      });
    }
  });

  it('names what a non-JSON file was (kind error)', () => {
    const parsed = parseBackupFile('%PDF-1.4 not json at all');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBe('not-json');
  });

  it('names a JSON file that is not a toolkit backup', () => {
    const parsed = parseBackupFile(JSON.stringify({ some: 'other', shape: true }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBe('not-a-backup');
  });
});

describe('buildRestorePreview: counts and date', () => {
  it('summarizes modules, rows, and items in the one unit grammar', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(parsed.data, device());
    expect(preview.summary).toContain('2 modules');
    expect(preview.summary).toContain('2 checked items');
    expect(preview.summary).toContain('1 saved row');
  });

  it('a file without exportedAt shows no date and is never rejected', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(parsed.data, device());
    expect(preview.madeAt).toBeNull();
  });
});

describe('verdicts: exact only on a lineage-baseline match', () => {
  const lineageFile = {
    ...fileRows,
    exportedAt: '2026-07-14T00:00:00.000Z',
    backupDeviceId: 'device-here',
    backupCounter: 0,
    backupSnapshotHash: 'baseline-hash',
  };

  it('baseline match with unprotected work: the exact-count verdict', () => {
    const parsed = parseBackupFile(JSON.stringify(lineageFile));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(
      parsed.data,
      device({
        cue: { counter: 3, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'baseline-hash' },
      }),
    );
    const texts = preview.verdicts.join(' ');
    expect(texts).toContain('does not have the 3 changes');
    expect(preview.demoteReplace).toBe(true);
  });

  it('baseline match, nothing new: no verdict, replace stays primary', () => {
    const parsed = parseBackupFile(JSON.stringify(lineageFile));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(
      parsed.data,
      device({
        cue: { counter: 0, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'baseline-hash' },
      }),
    );
    expect(preview.verdicts).toHaveLength(0);
    expect(preview.demoteReplace).toBe(false);
  });

  it('no lineage match with device work: the conservative wording, never an exact count', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(
      parsed.data,
      device({
        cue: { counter: 3, lastBackupAt: '2026-07-10T00:00:00.000Z', lastBackupHash: 'other-hash' },
      }),
    );
    const texts = preview.verdicts.join(' ');
    expect(texts).toContain('may not include newer work');
    expect(texts).not.toContain('3 changes');
    expect(preview.demoteReplace).toBe(true);
  });

  it('an empty device gets no missing-work verdict', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(
      parsed.data,
      device({ ids: new Set(), moduleKeys: new Set() }),
    );
    expect(preview.verdicts.join(' ')).not.toContain('newer work');
    expect(preview.demoteReplace).toBe(false);
  });

  it('verdicts compose: missing newer work AND file holds work this device lacks', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(
      parsed.data,
      device({
        ids: new Set(['mod-a-t1', 'device-only-id']),
        moduleKeys: new Set(['mod-a', 'mod-b']),
        cue: { counter: 2, lastBackupAt: '2026-07-10T00:00:00.000Z', lastBackupHash: 'x' },
      }),
    );
    const texts = preview.verdicts.join(' ');
    expect(texts).toContain('may not include newer work');
    expect(texts).toContain('holds work this device does not');
  });
});

describe('the partial-file gate', () => {
  it('flags a file holding fewer modules than the device', () => {
    const parsed = parseBackupFile(
      JSON.stringify({ todos: fileRows.todos, tables: [], metadata: {} }),
    );
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(
      parsed.data,
      device({ moduleKeys: new Set(['mod-a', 'mod-b', 'mod-c']) }),
    );
    expect(preview.partialWarning).toContain('1 of your 3 modules');
    expect(preview.partialWarning).toContain('replacing removes the other 2');
  });

  it('no flag when the file covers every module the device has', () => {
    const parsed = parseBackupFile(JSON.stringify(fileRows));
    if (!parsed.ok) throw new Error('parse failed');
    const preview = buildRestorePreview(parsed.data, device());
    expect(preview.partialWarning).toBeNull();
  });
});
