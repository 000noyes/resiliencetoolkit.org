/**
 * A storage open that never settles must not leave every editor waiting.
 * WebKit can produce an IDBOpenDBRequest that fires neither success nor
 * error (seen on first visits to a new origin). The bound in getDB turns
 * that into a rejection, and storage health reports it as unavailable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

function neverSettlingOpen(): void {
  const realOpen = indexedDB.open.bind(indexedDB);
  vi.spyOn(indexedDB, 'open').mockImplementation((...args: Parameters<typeof indexedDB.open>) => {
    const req = realOpen(...args);
    const noop = () => {};
    req.addEventListener = noop as typeof req.addEventListener;
    for (const key of ['onsuccess', 'onerror', 'onupgradeneeded', 'onblocked'] as const) {
      Object.defineProperty(req, key, { set: noop, get: () => null, configurable: true });
    }
    return req;
  });
}

describe('storage open timeout', () => {
  beforeEach(() => {
    // A fresh factory per test: a neutralized open leaves a store-less database behind.
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects a read with TimeoutError when the open never settles, and health reads unavailable', async () => {
    neverSettlingOpen();
    const storage = await import('@/lib/storage');
    const health = await import('@/lib/storageHealth');

    const pending = storage.getModuleTodos('emergency-preparedness');
    const outcome = pending.then(
      () => 'resolved',
      (e: unknown) => (e instanceof DOMException ? e.name : String(e))
    );
    await vi.advanceTimersByTimeAsync(storage.STORAGE_OPEN_TIMEOUT_MS + 1);
    expect(await outcome).toBe('TimeoutError');
    expect(storage.storageOpenTimedOut()).toBe(true);

    const status = await health.checkStorageHealth();
    expect(status.status).toBe('unavailable');
    expect(status.idbAvailable).toBe(false);
  });

  it('opens normally well inside the bound and health does not read unavailable', async () => {
    const storage = await import('@/lib/storage');
    const todos = storage.getModuleTodos('emergency-preparedness');
    await vi.advanceTimersByTimeAsync(50);
    expect(await todos).toEqual([]);
    expect(storage.storageOpenTimedOut()).toBe(false);
  });
});
