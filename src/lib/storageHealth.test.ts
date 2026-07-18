/**
 * storageHealth tests — the shared "can this browser hold your work?" signal.
 *
 * Run: pnpm vitest run src/lib/storageHealth.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

import {
  checkStorageHealth,
  reportStorageQuotaExceeded,
  resetStorageHealthForTest,
  shouldClaimStorageSoft,
} from './storageHealth';

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

  it('reports at-risk (with the mechanism-phrased soft copy) when not persisted', async () => {
    setPersisted(false);
    const h = await checkStorageHealth();
    expect(h.status).toBe('at-risk');
    // Soft copy: mechanism phrasing pointing at a backup, no alarm words.
    expect(h.message).toMatch(/stays on this device/i);
    expect(h.message).toMatch(/keep a backup copy/i);
  });

  it('reports unavailable with the remedy copy (no backup dead-end) when IndexedDB is missing', async () => {
    const original = window.indexedDB;
    // @ts-expect-error force-remove for the test
    delete window.indexedDB;
    try {
      const h = await checkStorageHealth();
      expect(h.status).toBe('unavailable');
      // Load-bearing consequence sentence + the real remedy (leave private browsing).
      expect(h.message).toMatch(/gone when you close this page/i);
      expect(h.message).toMatch(/regular browser window/i);
    } finally {
      Object.defineProperty(window, 'indexedDB', { value: original, configurable: true });
    }
  });

  it('reports full after a quota-exceeded report', async () => {
    setPersisted(true);
    reportStorageQuotaExceeded();
    const h = await checkStorageHealth();
    expect(h.status).toBe('full');
    expect(h.message).toMatch(/out of storage space/i);
    expect(h.message).toMatch(/free up room/i);
  });

  it('reportStorageQuotaExceeded dispatches the health-changed event', async () => {
    const handler = vi.fn();
    document.addEventListener('rt-storage-health-changed', handler);
    reportStorageQuotaExceeded();
    expect(handler).toHaveBeenCalled();
    document.removeEventListener('rt-storage-health-changed', handler);
  });
});

describe('shouldClaimStorageSoft (reconciliation R1: the work-aware claim boolean)', () => {
  const canary = { modules: { m: true }, updatedAt: '2026-07-18T00:00:00.000Z' };

  it('claims only on at-risk + not dismissed + work exists + unprotected work', () => {
    expect(shouldClaimStorageSoft({ atRisk: true, dismissed: false, canary, counter: 3 })).toBe(true);
    expect(shouldClaimStorageSoft({ atRisk: true, dismissed: false, canary, counter: 'unknown' })).toBe(true);
  });

  it('the no-work case is unconditional: no canary work, no strip, anywhere', () => {
    expect(shouldClaimStorageSoft({ atRisk: true, dismissed: false, canary: null, counter: 'unknown' })).toBe(false);
    expect(
      shouldClaimStorageSoft({
        atRisk: true,
        dismissed: false,
        canary: { modules: {}, updatedAt: 'x' },
        counter: 5,
      }),
    ).toBe(false);
  });

  it('a healthy or acute origin never claims the soft slot here', () => {
    expect(shouldClaimStorageSoft({ atRisk: false, dismissed: false, canary, counter: 5 })).toBe(false);
  });

  it('fully backed-up work stays quiet even at risk', () => {
    expect(shouldClaimStorageSoft({ atRisk: true, dismissed: false, canary, counter: 0 })).toBe(false);
  });

  it('session dismissal stays quiet', () => {
    expect(shouldClaimStorageSoft({ atRisk: true, dismissed: true, canary, counter: 3 })).toBe(false);
  });
});
