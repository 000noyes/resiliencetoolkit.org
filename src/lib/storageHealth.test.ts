/**
 * storageHealth tests — the shared "can this browser hold your work?" signal.
 *
 * Run: pnpm vitest run src/lib/storageHealth.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

import { checkStorageHealth, reportStorageQuotaExceeded, resetStorageHealthForTest } from './storageHealth';

function setPersisted(value: boolean | null) {
  if (value === null) {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, 'storage', {
    value: { persisted: vi.fn().mockResolvedValue(value) },
    configurable: true,
  });
}

beforeEach(() => {
  resetStorageHealthForTest();
});

afterEach(() => {
  Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
});

describe('checkStorageHealth', () => {
  it('reports healthy when IDB is available and the origin is persisted', async () => {
    setPersisted(true);
    const h = await checkStorageHealth();
    expect(h.status).toBe('healthy');
    expect(h.message).toBeNull();
  });

  it('reports at-risk (with a back-it-up message) when not persisted', async () => {
    setPersisted(false);
    const h = await checkStorageHealth();
    expect(h.status).toBe('at-risk');
    expect(h.message).toMatch(/back it up/i);
    // Keeps the privacy promise intact in the copy.
    expect(h.message).toMatch(/private/i);
  });

  it('reports unavailable when IndexedDB is missing', async () => {
    const original = window.indexedDB;
    // @ts-expect-error force-remove for the test
    delete window.indexedDB;
    try {
      const h = await checkStorageHealth();
      expect(h.status).toBe('unavailable');
      expect(h.message).toMatch(/lost when you close/i);
    } finally {
      Object.defineProperty(window, 'indexedDB', { value: original, configurable: true });
    }
  });

  it('reports full after a quota-exceeded report', async () => {
    setPersisted(true);
    reportStorageQuotaExceeded();
    const h = await checkStorageHealth();
    expect(h.status).toBe('full');
    expect(h.message).toMatch(/out of storage/i);
  });

  it('reportStorageQuotaExceeded dispatches the health-changed event', async () => {
    const handler = vi.fn();
    document.addEventListener('rt-storage-health-changed', handler);
    reportStorageQuotaExceeded();
    expect(handler).toHaveBeenCalled();
    document.removeEventListener('rt-storage-health-changed', handler);
  });
});
