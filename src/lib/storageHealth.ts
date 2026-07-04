/**
 * Shared storage-health signal.
 *
 * One place to answer "can this browser durably hold your work right now?" so
 * the app-wide StorageHealthBanner and every editor read the same picture. The
 * editors keep their own local save-gating (DataTable still tracks
 * idbAvailable/quotaExceeded to block writes to a full store); this module adds
 * the shared, app-wide signal on top and every editor reports a quota hit here
 * via reportStorageQuotaExceeded() so the banner reflects it. The durability UI
 * is driven off the persisted() grant boolean and the acute unavailable/full
 * states, never raw estimate() quota numbers (browsers deliberately fuzz those).
 *
 * The copy here is honest about the one thing the toolkit could not previously
 * promise: your data is private and offline (true), AND it lives only on this
 * device and a browser can clear it, so back it up.
 */
import { getMetadata } from '@/lib/storage';

/** Editors dispatch this on the document when the storage picture changes (e.g. quota hit). */
export const STORAGE_HEALTH_EVENT = 'rt-storage-health-changed';

export type StorageHealthStatus = 'healthy' | 'at-risk' | 'full' | 'unavailable';

export interface StorageHealth {
  status: StorageHealthStatus;
  idbAvailable: boolean;
  persisted: boolean;
  /** Human-readable warning shown in the banner, or null when healthy. */
  message: string | null;
}

const UNAVAILABLE_MESSAGE =
  'This browser is not saving your work on this device right now. That can happen in private or restricted browsing. Anything you type will be lost when you close the page, so back it up now to keep a copy.';

const FULL_MESSAGE =
  'This device is out of storage space. You can still back up what you already have, but new entries will not save until you free up some room.';

const AT_RISK_MESSAGE =
  'Your work is saved on this device and stays private, but your browser can clear it to make room. Back it up so you do not lose it.';

// Module-level flag: an editor that hits a QuotaExceededError flips this so the
// app-wide banner reflects the full-storage state, not just the editor's inline
// message. Reset is a page reload (the natural recovery after freeing space).
let quotaExceeded = false;

/**
 * Report that a write failed with QuotaExceededError. Flips the shared signal
 * and notifies the banner so a full device is surfaced app-wide.
 */
export function reportStorageQuotaExceeded(): void {
  quotaExceeded = true;
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(STORAGE_HEALTH_EVENT));
  }
}

/** Test seam: reset the shared quota flag. */
export function resetStorageHealthForTest(): void {
  quotaExceeded = false;
}

/**
 * Compute the current storage health. Cheap and safe to call repeatedly.
 *   - no IndexedDB (some private/restricted modes) -> unavailable (acute)
 *   - a write already hit the quota -> full (acute)
 *   - IDB works but the origin is not persisted -> at-risk (soft, back it up)
 *   - IDB works and the origin is persisted -> healthy (no banner)
 */
export async function checkStorageHealth(): Promise<StorageHealth> {
  const idbAvailable = typeof window !== 'undefined' && !!window.indexedDB;
  if (!idbAvailable) {
    return { status: 'unavailable', idbAvailable: false, persisted: false, message: UNAVAILABLE_MESSAGE };
  }

  if (quotaExceeded) {
    return { status: 'full', idbAvailable: true, persisted: false, message: FULL_MESSAGE };
  }

  let persisted = false;
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.persisted === 'function'
  ) {
    try {
      persisted = await navigator.storage.persisted();
    } catch {
      persisted = false;
    }
  } else {
    // Persistence API absent: fall back to the grant recorded at init.
    try {
      persisted = (await getMetadata('storagePersisted')) === true;
    } catch {
      persisted = false;
    }
  }

  if (persisted) {
    return { status: 'healthy', idbAvailable: true, persisted: true, message: null };
  }
  return { status: 'at-risk', idbAvailable: true, persisted: false, message: AT_RISK_MESSAGE };
}
