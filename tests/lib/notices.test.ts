/**
 * Notice registry — condition-keyed priority claims.
 *
 * All four top-of-page strips claim the single slot with their own id; the
 * highest priority above the damped floor wins and renders. These tests pin
 * the claim/release lifecycle, the winner computation, the dismissal damper,
 * and the SSR guards.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  claimNotice,
  releaseNotice,
  dampNotice,
  getActiveNotice,
  computeWinner,
  claimDatasetKey,
  NOTICE_CHANGED_EVENT,
  DAMPED_FLOOR_DATASET_KEY,
  NOTICE_PRIORITY,
  type NoticeId,
} from '../../src/lib/notices';

const ALL_IDS: NoticeId[] = ['storageAcute', 'status', 'update', 'storageSoft', 'contact'];

function clearAllClaims() {
  const ds = document.documentElement.dataset;
  for (const id of ALL_IDS) delete ds[claimDatasetKey(id)];
  delete ds[DAMPED_FLOOR_DATASET_KEY];
}

describe('notice registry', () => {
  beforeEach(() => {
    clearAllClaims();
  });

  describe('claimNotice / releaseNotice', () => {
    it('claimNotice writes only its own presence-only dataset key and notifies', () => {
      const spy = vi.fn();
      document.addEventListener(NOTICE_CHANGED_EVENT, spy);
      claimNotice('update');
      expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(true);
      // No other id's key is touched.
      expect(claimDatasetKey('contact') in document.documentElement.dataset).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
      document.removeEventListener(NOTICE_CHANGED_EVENT, spy);
    });

    it('releaseNotice deletes only its own key and notifies', () => {
      claimNotice('update');
      claimNotice('contact');
      const spy = vi.fn();
      document.addEventListener(NOTICE_CHANGED_EVENT, spy);
      releaseNotice('update');
      expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(false);
      expect(claimDatasetKey('contact') in document.documentElement.dataset).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      document.removeEventListener(NOTICE_CHANGED_EVENT, spy);
    });
  });

  describe('computeWinner (pure)', () => {
    it('returns null with no claims', () => {
      expect(computeWinner([], 0)).toBeNull();
    });

    it('returns the single claimant', () => {
      expect(computeWinner(['contact'], 0)).toBe('contact');
    });

    it('returns the highest-priority claimant among many', () => {
      expect(computeWinner(['contact', 'storageSoft', 'update'], 0)).toBe('update');
      expect(computeWinner(['storageAcute', 'status', 'update'], 0)).toBe('storageAcute');
    });

    it('filters claims at or below the damped floor', () => {
      // floor 20 (storageSoft) suppresses soft(20) and contact(10); update(30) wins.
      expect(computeWinner(['update', 'storageSoft', 'contact'], 20)).toBe('update');
      // floor 30 (update) suppresses update/soft/contact; nothing left.
      expect(computeWinner(['update', 'storageSoft', 'contact'], 30)).toBeNull();
      // acute(50) always beats the floor.
      expect(computeWinner(['storageAcute', 'contact'], 40)).toBe('storageAcute');
    });

    it('is a pure function and does not read the DOM', () => {
      claimNotice('contact'); // DOM claim present, but computeWinner ignores the DOM
      expect(computeWinner([], 0)).toBeNull();
    });
  });

  describe('getActiveNotice (reads DOM claims + floor)', () => {
    it('returns null when nothing is claimed', () => {
      expect(getActiveNotice()).toBeNull();
    });

    it('reflects DOM claims and returns the winner', () => {
      claimNotice('contact');
      expect(getActiveNotice()).toBe('contact');
      claimNotice('update');
      // Late higher claim replaces the winner.
      expect(getActiveNotice()).toBe('update');
    });

    it('update visible masks contact (shipped handover regression)', () => {
      claimNotice('contact');
      claimNotice('update');
      expect(getActiveNotice()).toBe('update');
      releaseNotice('update');
      // Handover: contact returns once update releases.
      expect(getActiveNotice()).toBe('contact');
    });
  });

  describe('dampNotice (dismissal damper)', () => {
    it('sets the floor to the dismissed strip priority and suppresses lower claimants', () => {
      claimNotice('storageSoft');
      claimNotice('contact');
      expect(getActiveNotice()).toBe('storageSoft');
      // Dismiss soft: release its claim and damp the floor to 20.
      releaseNotice('storageSoft');
      dampNotice('storageSoft');
      // contact(10) is at/below the floor(20), so it waits for navigation.
      expect(getActiveNotice()).toBeNull();
      expect(document.documentElement.dataset[DAMPED_FLOOR_DATASET_KEY]).toBe('20');
    });

    it('max-merges the floor (a lower later damp never lowers it)', () => {
      dampNotice('update'); // floor 30
      dampNotice('contact'); // 10 < 30, floor stays 30
      expect(document.documentElement.dataset[DAMPED_FLOOR_DATASET_KEY]).toBe('30');
    });

    it('never damps a signal claim above the floor (acute/offline win regardless)', () => {
      dampNotice('update'); // floor 30
      claimNotice('storageAcute'); // 50 > 30
      expect(getActiveNotice()).toBe('storageAcute');
      claimNotice('status'); // 40 > 30
      releaseNotice('storageAcute');
      expect(getActiveNotice()).toBe('status');
    });
  });

  describe('priority table', () => {
    it('pins distinct descending priorities (ties are impossible by construction)', () => {
      const values = ALL_IDS.map((id) => NOTICE_PRIORITY[id]);
      expect(new Set(values).size).toBe(values.length);
      expect(NOTICE_PRIORITY.storageAcute).toBeGreaterThan(NOTICE_PRIORITY.status);
      expect(NOTICE_PRIORITY.status).toBeGreaterThan(NOTICE_PRIORITY.update);
      expect(NOTICE_PRIORITY.update).toBeGreaterThan(NOTICE_PRIORITY.storageSoft);
      expect(NOTICE_PRIORITY.storageSoft).toBeGreaterThan(NOTICE_PRIORITY.contact);
    });
  });

  describe('SSR guards', () => {
    it('claim/release/damp no-op (do not throw) when document is undefined', () => {
      vi.stubGlobal('document', undefined);
      expect(() => claimNotice('update')).not.toThrow();
      expect(() => releaseNotice('update')).not.toThrow();
      expect(() => dampNotice('update')).not.toThrow();
      expect(getActiveNotice()).toBeNull();
      vi.unstubAllGlobals();
    });
  });
});
