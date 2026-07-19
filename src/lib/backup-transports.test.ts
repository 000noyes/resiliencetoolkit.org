/**
 * Backup artifact + transport-gated stamping.
 *
 * The file a person holds IS the product on flood day, so the artifact is
 * designed: exportedAt, a verb-free _readme, lineage fields (backupDeviceId,
 * the device's counter and snapshot hash at export), and a filename with time
 * and the optional device slug. The counter reset, timestamp, and stored hash
 * move behind a real per-transport completion signal: share() resolving,
 * the save picker's write completing, or the plain anchor's click (which
 * stamps but persists caution and never claims a confirmed calm).
 *
 * Run: pnpm vitest run src/lib/backup-transports.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import {
  saveTodo,
  setMetadata,
  getMetadata,
  deleteMetadata,
  BACKUP_WRITE_COUNTER_KEY,
  LAST_BACKUP_AT_KEY,
  LAST_BACKUP_HASH_KEY,
} from './storage';
import { buildBackupPayload, downloadFullBackup, shareBackup, backupDeviceSlug } from './backup';
import { buildWorkSnapshot, computeSnapshotHash } from './backup-cue';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem('deviceId', 'device-test-1234');
  await deleteMetadata(BACKUP_WRITE_COUNTER_KEY);
  await deleteMetadata(LAST_BACKUP_AT_KEY);
  await deleteMetadata(LAST_BACKUP_HASH_KEY);
  await deleteMetadata('deviceName');
  await deleteMetadata('lastBackupTransport');
  // jsdom lacks createObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  // remove any picker/share stubs between tests
  delete (window as any).showSaveFilePicker;
  delete (navigator as any).share;
  delete (navigator as any).canShare;
});

describe('buildBackupPayload: the designed artifact', () => {
  it('adds exportedAt, a verb-free readme, and the lineage fields', async () => {
    await saveTodo({ moduleKey: 'artifact-mod', todoId: 't1', completed: true });
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 7);
    const payload = await buildBackupPayload();

    expect(Number.isFinite(Date.parse(payload.data.exportedAt))).toBe(true);
    expect(payload.data._readme).toContain('resiliencetoolkit.org/dashboard');
    // The settled ecosystems decision: the artifact speaks direction only. A
    // file found in 2027 must never point at a by-then-destructive path.
    expect(payload.data._readme).not.toMatch(/restore|replace|import|export/i);
    expect(payload.data.backupDeviceId).toBe('device-test-1234');
    expect(payload.data.backupCounter).toBe(7);
    expect(payload.data.backupSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the lineage hash matches the canonical snapshot of the exported data', async () => {
    await saveTodo({ moduleKey: 'artifact-hash', todoId: 't1', completed: true });
    const payload = await buildBackupPayload();
    const expected = await computeSnapshotHash(buildWorkSnapshot(payload.data));
    expect(payload.data.backupSnapshotHash).toBe(expected);
  });

  it('a missing counter travels as null, never a fake number', async () => {
    const payload = await buildBackupPayload();
    expect(payload.data.backupCounter).toBeNull();
  });

  it('filename carries date and time, date primary', async () => {
    const payload = await buildBackupPayload();
    expect(payload.filename).toMatch(/^resilience-toolkit-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  });

  it('filename gains the device slug when a device name is set', async () => {
    await setMetadata('deviceName', 'Kitchen Laptop!');
    const payload = await buildBackupPayload();
    expect(payload.filename).toMatch(
      /^resilience-toolkit-backup-kitchen-laptop-\d{4}-\d{2}-\d{2}-\d{4}\.json$/,
    );
  });

  it('backupDeviceSlug sanitizes to a calm lowercase slug', () => {
    expect(backupDeviceSlug('Kitchen Laptop!')).toBe('kitchen-laptop');
    expect(backupDeviceSlug('  Fern’s  phone  ')).toBe('ferns-phone');
    expect(backupDeviceSlug('!!!')).toBe('');
  });
});

describe('transport-gated stamping', () => {
  it('anchor transport stamps the baseline and records the caution-persisting transport', async () => {
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 5);
    const result = await downloadFullBackup();
    expect(result.completed).toBe(true);
    expect(result.transport).toBe('anchor');
    expect(await getMetadata(BACKUP_WRITE_COUNTER_KEY)).toBe(0);
    expect(await getMetadata(LAST_BACKUP_AT_KEY)).toBe(result.timestamp);
    expect(typeof (await getMetadata(LAST_BACKUP_HASH_KEY))).toBe('string');
    expect(await getMetadata('lastBackupTransport')).toBe('anchor');
  });

  it('save picker: a completed write stamps with a confirmed transport', async () => {
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 5);
    const write = vi.fn();
    const close = vi.fn();
    (window as any).showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }));
    const result = await downloadFullBackup();
    expect(result.transport).toBe('picker');
    expect(result.completed).toBe(true);
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(await getMetadata(BACKUP_WRITE_COUNTER_KEY)).toBe(0);
    expect(await getMetadata('lastBackupTransport')).toBe('picker');
  });

  it('save picker cancel: no stamp, no error state', async () => {
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 5);
    (window as any).showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('user canceled', 'AbortError');
    });
    const result = await downloadFullBackup();
    expect(result.completed).toBe(false);
    expect(await getMetadata(BACKUP_WRITE_COUNTER_KEY)).toBe(5);
    expect(await getMetadata(LAST_BACKUP_AT_KEY)).toBeUndefined();
  });

  it('share: a resolved share() stamps with the strongest signal', async () => {
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 3);
    (navigator as any).canShare = vi.fn(() => true);
    (navigator as any).share = vi.fn(async () => undefined);
    const result = await shareBackup();
    expect(result.completed).toBe(true);
    expect(result.transport).toBe('share');
    expect(await getMetadata(BACKUP_WRITE_COUNTER_KEY)).toBe(0);
    expect(await getMetadata('lastBackupTransport')).toBe('share');
  });

  it('share cancel: rejects with AbortError, nothing stamps, nothing throws', async () => {
    await setMetadata(BACKUP_WRITE_COUNTER_KEY, 3);
    (navigator as any).canShare = vi.fn(() => true);
    (navigator as any).share = vi.fn(async () => {
      throw new DOMException('canceled', 'AbortError');
    });
    const result = await shareBackup();
    expect(result.completed).toBe(false);
    expect(await getMetadata(BACKUP_WRITE_COUNTER_KEY)).toBe(3);
    expect(await getMetadata(LAST_BACKUP_AT_KEY)).toBeUndefined();
  });

  it('share is unavailable without file support: capability-gated', async () => {
    (navigator as any).canShare = vi.fn(() => false);
    const result = await shareBackup();
    expect(result.completed).toBe(false);
    expect(result.transport).toBeNull();
  });
});
