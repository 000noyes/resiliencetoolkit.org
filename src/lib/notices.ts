/**
 * One notice at a time.
 *
 * The site has two top-of-page notice strips (the contact banner and the
 * update notice). Stacking them reads as clutter, so a single rule
 * coordinates them: while the update notice is VISIBLE, it owns the slot
 * and the contact banner steps aside; the contact banner returns the moment
 * the update notice goes away (refresh, dismissal, or readiness withdrawn).
 *
 * The banners are separate islands with separate module instances, so the
 * shared state lives on the documentElement dataset (same pattern as the
 * update-readiness flag) with a change event for already-hydrated banners.
 * Keyed on actual VISIBILITY, not update readiness: a dismissed update
 * notice releases the slot even though an update is still waiting.
 */
export const ACTIVE_NOTICE_DATASET_KEY = 'rtActiveNotice';
export const NOTICE_CHANGED_EVENT = 'rt:notice-changed';

export function setActiveNotice(id: string | null): void {
  if (typeof document === 'undefined') return;
  if (id) {
    document.documentElement.dataset[ACTIVE_NOTICE_DATASET_KEY] = id;
  } else {
    delete document.documentElement.dataset[ACTIVE_NOTICE_DATASET_KEY];
  }
  document.dispatchEvent(new Event(NOTICE_CHANGED_EVENT));
}

export function getActiveNotice(): string | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.dataset[ACTIVE_NOTICE_DATASET_KEY] || null;
}
