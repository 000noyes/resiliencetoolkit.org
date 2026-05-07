/**
 * BetaBanner persistence helpers.
 *
 * Versioned localStorage key — bumping the version (e.g. `.v2`) re-shows the
 * banner to users who previously dismissed it. Useful when the copy or
 * mailto target changes and we want everyone to see the new message once.
 *
 * All localStorage access wraps try/catch so Safari private mode and
 * storage-disabled environments don't crash the component — they just lose
 * persistence (banner re-shows next visit).
 */

export const BETA_BANNER_KEY = 'betaBanner.dismissed.v1';

export function isDismissed(storage: Storage | undefined = safeLocalStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(BETA_BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDismissed(storage: Storage | undefined = safeLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(BETA_BANNER_KEY, '1');
  } catch {
    /* swallow — Safari private mode etc. */
  }
}

function safeLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
