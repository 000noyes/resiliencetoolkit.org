/**
 * update-banner dismissal logic.
 *
 * Dismissing the refresh notice suppresses the SAME version for at most 24h
 * (a home-screen app's session can span weeks, so a session-long dismissal
 * would strand updates). A different version always re-shows. sessionStorage
 * failures (private mode) fall back to in-memory suppression.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSuppressed,
  recordDismissal,
  UPDATE_DISMISS_KEY,
  DISMISS_MAX_AGE_MS,
  __resetMemoryFallback,
} from '../../src/lib/update-banner';

describe('update-banner dismissal', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetMemoryFallback();
  });

  it('not suppressed with no dismissal recorded', () => {
    expect(isSuppressed('v1', Date.now())).toBe(false);
  });

  it('suppresses the same version within 24h', () => {
    const now = 1_000_000;
    recordDismissal('v1', now);
    expect(isSuppressed('v1', now + 60_000)).toBe(true);
  });

  it('a DIFFERENT version always re-shows', () => {
    const now = 1_000_000;
    recordDismissal('v1', now);
    expect(isSuppressed('v2', now + 60_000)).toBe(false);
  });

  it('dismissal expires after 24h', () => {
    const now = 1_000_000;
    recordDismissal('v1', now);
    expect(isSuppressed('v1', now + DISMISS_MAX_AGE_MS + 1)).toBe(false);
  });

  it('corrupt stored JSON is treated as no dismissal', () => {
    sessionStorage.setItem(UPDATE_DISMISS_KEY, 'not-json{');
    expect(isSuppressed('v1', Date.now())).toBe(false);
  });

  it('falls back to in-memory suppression when sessionStorage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const now = 1_000_000;
    recordDismissal('v1', now);
    expect(isSuppressed('v1', now + 60_000)).toBe(true);
    expect(isSuppressed('v2', now + 60_000)).toBe(false);
    setItem.mockRestore();
    getItem.mockRestore();
  });
});
