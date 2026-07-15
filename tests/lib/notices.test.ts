/**
 * One-notice-at-a-time coordination (contact banner yields to the update
 * notice while it is visible).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setActiveNotice,
  getActiveNotice,
  NOTICE_CHANGED_EVENT,
  ACTIVE_NOTICE_DATASET_KEY,
} from '../../src/lib/notices';

describe('notices', () => {
  beforeEach(() => {
    delete document.documentElement.dataset[ACTIVE_NOTICE_DATASET_KEY];
  });

  it('setActiveNotice stores the id on the root element and notifies', () => {
    const spy = vi.fn();
    document.addEventListener(NOTICE_CHANGED_EVENT, spy);
    setActiveNotice('update');
    expect(getActiveNotice()).toBe('update');
    expect(spy).toHaveBeenCalledTimes(1);
    document.removeEventListener(NOTICE_CHANGED_EVENT, spy);
  });

  it('setActiveNotice(null) releases the slot and notifies', () => {
    setActiveNotice('update');
    const spy = vi.fn();
    document.addEventListener(NOTICE_CHANGED_EVENT, spy);
    setActiveNotice(null);
    expect(getActiveNotice()).toBeNull();
    expect(document.documentElement.dataset[ACTIVE_NOTICE_DATASET_KEY]).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    document.removeEventListener(NOTICE_CHANGED_EVENT, spy);
  });

  it('getActiveNotice reads state set before a late-hydrating banner mounts', () => {
    document.documentElement.dataset[ACTIVE_NOTICE_DATASET_KEY] = 'update';
    expect(getActiveNotice()).toBe('update');
  });
});
