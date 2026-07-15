/**
 * Persistent-storage request + ED1 diagnostic breadcrumb tests.
 *
 * requestPersistentStorage() asks the browser to protect this origin's storage
 * from eviction (navigator.storage.persist()) exactly once (marker-gated), then
 * records the current grant boolean, the deviceId, and a diagnostic breadcrumb
 * into the persist()-protected IndexedDB metadata store — so a future loss is
 * diagnosable and the breadcrumb survives the eviction it diagnoses (ED1).
 *
 * Run: pnpm vitest run src/lib/storage-persist.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

import {
  requestPersistentStorage,
  getMetadata,
  deleteMetadata,
  PERSIST_REQUESTED_MARKER,
} from './storage';

function stubStorageManager(opts: {
  persist?: (() => Promise<boolean>) | null;
  persisted?: () => Promise<boolean>;
}) {
  const persistFn = opts.persist === undefined ? vi.fn().mockResolvedValue(true) : opts.persist;
  const persistedFn = opts.persisted ?? vi.fn().mockResolvedValue(true);
  const manager: Record<string, unknown> = { persisted: persistedFn };
  if (persistFn) manager.persist = persistFn;
  Object.defineProperty(navigator, 'storage', { value: manager, configurable: true });
  return { persistFn, persistedFn };
}

beforeEach(async () => {
  localStorage.clear();
  // Clear the once-only marker so each test starts fresh (the fake IDB
  // singleton persists across a file).
  await deleteMetadata(PERSIST_REQUESTED_MARKER);
});

afterEach(() => {
  // Remove the stub so it does not leak into other suites in the same file.
  Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
});

describe('requestPersistentStorage', () => {
  it('requests persistence once and records persisted=true when granted', async () => {
    const { persistFn } = stubStorageManager({ persist: vi.fn().mockResolvedValue(true) });
    const res = await requestPersistentStorage('device-abc');
    expect(res).toMatchObject({ requested: true, persisted: true, supported: true });
    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(await getMetadata('storagePersisted')).toBe(true);
  });

  it('records persisted=false on the denied path', async () => {
    stubStorageManager({ persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) });
    const res = await requestPersistentStorage('device-abc');
    expect(res.persisted).toBe(false);
    expect(await getMetadata('storagePersisted')).toBe(false);
  });

  it('does not re-call persist() once the marker is set (marker-gated)', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const persisted = vi.fn().mockResolvedValue(true);
    stubStorageManager({ persist, persisted });

    await requestPersistentStorage('device-abc');
    const second = await requestPersistentStorage('device-abc');

    expect(persist).toHaveBeenCalledTimes(1); // requested only once
    expect(persisted).toHaveBeenCalled(); // but the grant boolean is re-read
    expect(second.requested).toBe(false);
    expect(second.persisted).toBe(true);
  });

  it('handles a persist() that throws without breaking (records false)', async () => {
    stubStorageManager({ persist: vi.fn().mockRejectedValue(new Error('boom')) });
    const res = await requestPersistentStorage('device-abc');
    expect(res.persisted).toBe(false);
    expect(await getMetadata('storagePersisted')).toBe(false);
  });

  it('reports unsupported when navigator.storage is absent, without throwing', async () => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    const res = await requestPersistentStorage('device-xyz');
    expect(res).toMatchObject({ requested: false, persisted: false, supported: false });
    // Still records the deviceId breadcrumb so a loss report has something.
    expect(await getMetadata('storageDeviceId')).toBe('device-xyz');
  });

  it('writes the deviceId + diagnostic breadcrumb into the metadata store (ED1)', async () => {
    stubStorageManager({ persist: vi.fn().mockResolvedValue(true) });
    await requestPersistentStorage('device-diag');
    expect(await getMetadata('storageDeviceId')).toBe('device-diag');
    const diag = (await getMetadata('storageDiagnostic')) as Record<string, unknown>;
    expect(diag).toBeDefined();
    expect(diag.deviceId).toBe('device-diag');
    expect(diag.persisted).toBe(true);
    expect(typeof diag.lastCheck).toBe('string');
  });
});
