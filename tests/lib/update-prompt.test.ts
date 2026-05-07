import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVisitCount,
  recordVisit,
  computeStage,
  clearVisits,
  getVisitCountKey,
  SESSION_SENTINEL_KEY,
} from '../../src/lib/update-prompt';

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

const V = 'v-build-20260507120000000';

describe('update-prompt: stage computation', () => {
  it('count 0 or 1 → stage 1', () => {
    expect(computeStage(0)).toBe(1);
    expect(computeStage(1)).toBe(1);
  });

  it('count 2 → stage 2', () => {
    expect(computeStage(2)).toBe(2);
  });

  it('count 3+ caps at stage 3', () => {
    expect(computeStage(3)).toBe(3);
    expect(computeStage(99)).toBe(3);
  });
});

describe('update-prompt: visit counter', () => {
  let local: Storage;
  let session: Storage;

  beforeEach(() => {
    local = fakeStorage();
    session = fakeStorage();
  });

  it('first recordVisit returns 1 and sets the session sentinel', () => {
    expect(recordVisit(V, { local, session })).toBe(1);
    expect(session.getItem(SESSION_SENTINEL_KEY)).toBe(V);
  });

  it('multiple recordVisit calls within one session only count once', () => {
    expect(recordVisit(V, { local, session })).toBe(1);
    expect(recordVisit(V, { local, session })).toBe(1);
    expect(recordVisit(V, { local, session })).toBe(1);
    expect(getVisitCount(V, { local, session })).toBe(1);
  });

  it('clearing the session sentinel allows the next call to count again', () => {
    recordVisit(V, { local, session });
    session.removeItem(SESSION_SENTINEL_KEY);
    expect(recordVisit(V, { local, session })).toBe(2);
  });

  it('per-cacheVersion keying — new CACHE_VERSION resets to stage 1', () => {
    recordVisit(V, { local, session });
    recordVisit(V, { local, session: fakeStorage() }); // simulate new session
    expect(getVisitCount(V, { local, session })).toBe(2);

    const NEW_V = 'v-build-20260508000000000';
    expect(getVisitCount(NEW_V, { local, session })).toBe(0);
    expect(recordVisit(NEW_V, { local, session: fakeStorage() })).toBe(1);
  });

  it('clearVisits removes both counter and sentinel', () => {
    recordVisit(V, { local, session });
    clearVisits(V, { local, session });
    expect(getVisitCount(V, { local, session })).toBe(0);
    expect(session.getItem(SESSION_SENTINEL_KEY)).toBeNull();
  });

  it('survives undefined stores (SSR)', () => {
    expect(getVisitCount(V, {})).toBe(0);
    expect(recordVisit(V, {})).toBe(0);
    expect(() => clearVisits(V, {})).not.toThrow();
  });

  it('uses the documented localStorage key shape', () => {
    expect(getVisitCountKey(V)).toBe(`updatePromptVisits.${V}`);
  });

  it('escalation walk — 3 sessions hit each stage', () => {
    // Session 1
    let count = recordVisit(V, { local, session: fakeStorage() });
    expect(computeStage(count)).toBe(1);
    // Session 2
    count = recordVisit(V, { local, session: fakeStorage() });
    expect(computeStage(count)).toBe(2);
    // Session 3
    count = recordVisit(V, { local, session: fakeStorage() });
    expect(computeStage(count)).toBe(3);
    // Session 4 — still stage 3
    count = recordVisit(V, { local, session: fakeStorage() });
    expect(computeStage(count)).toBe(3);
  });
});
