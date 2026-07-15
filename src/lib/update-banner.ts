/**
 * Dismissal state for the update notice (UpdateBanner island).
 *
 * Per-tab sessionStorage, keyed by build version, capped at 24h: a
 * home-screen app's "session" can span weeks of resumes, so an
 * until-tab-closes dismissal would strand updates on exactly the devices
 * this lifecycle exists to heal. A different version always re-shows.
 * Dismissal hides UI only — the idle and resume rotations in sw-register
 * never consult it.
 */
export const UPDATE_DISMISS_KEY = 'rt-update-dismissed';
export const DISMISS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Dismissal {
  version: string;
  at: number;
}

function readDismissal(): Dismissal | null {
  try {
    const raw = sessionStorage.getItem(UPDATE_DISMISS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.version === 'string' && typeof parsed?.at === 'number') return parsed;
    return null;
  } catch {
    // Private mode / quota / corrupt value: treat as not dismissed — the
    // banner reappearing is benign for a notice the rotation paths ignore.
    return null;
  }
}

export function isSuppressed(version: string, now: number): boolean {
  const dismissal = readDismissal();
  if (!dismissal) return false;
  return dismissal.version === version && now - dismissal.at < DISMISS_MAX_AGE_MS;
}

export function recordDismissal(version: string, now: number): void {
  try {
    sessionStorage.setItem(UPDATE_DISMISS_KEY, JSON.stringify({ version, at: now }));
  } catch {
    // Private mode / quota: dismissal simply doesn't persist.
  }
}
