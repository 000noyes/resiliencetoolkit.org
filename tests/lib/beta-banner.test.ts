import { describe, it, expect, beforeEach } from 'vitest';
import { isDismissed, setDismissed, BETA_BANNER_KEY } from '../../src/lib/beta-banner';

function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function throwingStorage(): Storage {
  return {
    getItem: () => {
      throw new Error('disabled');
    },
    setItem: () => {
      throw new Error('disabled');
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

describe('beta-banner helpers', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
    // jsdom provides a real localStorage that persists across tests in the
    // same file; clear it so the default-param branch starts clean.
    if (typeof window !== 'undefined') window.localStorage.clear();
  });

  it('isDismissed returns false on first visit', () => {
    expect(isDismissed(storage)).toBe(false);
  });

  it('setDismissed persists, isDismissed returns true after', () => {
    setDismissed(storage);
    expect(isDismissed(storage)).toBe(true);
    expect(storage.getItem(BETA_BANNER_KEY)).toBe('1');
  });

  it('versioned key — bumping the version constant re-shows the banner', () => {
    setDismissed(storage);
    // Simulate version bump: raw key check on a hypothetical .v2
    expect(storage.getItem('betaBanner.dismissed.v2')).toBeNull();
    expect(storage.getItem('betaBanner.dismissed.v1')).toBe('1');
  });

  it('survives throwing storage (Safari private mode / disabled)', () => {
    const broken = throwingStorage();
    expect(() => setDismissed(broken)).not.toThrow();
    expect(() => isDismissed(broken)).not.toThrow();
    expect(isDismissed(broken)).toBe(false);
  });

  it('default-storage path uses window.localStorage and starts clean', () => {
    // No explicit storage arg — falls back to safeLocalStorage()
    expect(isDismissed()).toBe(false);
    setDismissed();
    expect(isDismissed()).toBe(true);
  });
});
