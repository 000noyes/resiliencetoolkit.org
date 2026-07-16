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

/**
 * Structured notice copy (LOCKED at /plan-design-review, 2026-07-15). Each
 * state is a 500-weight lead phrase + a body sentence, with an optional action
 * link. The banner renders lead and body separately (the lead carries the
 * severity, since icons were removed); `message` composes them for the
 * signal-level checks. No em/en dashes.
 *
 * The acute-unavailable state has NO backup link on purpose: exportAllData()
 * needs IndexedDB, which is exactly what is missing there, so a backup link
 * would be a dead end. It offers the real remedy (leave private browsing).
 * The consequence sentence in each acute state ("gone when you close this
 * page" / "will not save until you free up room") is load-bearing and must
 * survive any future rewording.
 */
export interface StorageNoticeCopy {
  lead: string;
  body: string;
  linkLabel?: string;
  linkHref?: string;
}

export const STORAGE_COPY: Record<'soft' | 'unavailable' | 'full', StorageNoticeCopy> = {
  soft: {
    lead: 'Work you save here stays on this device.',
    body: 'Browsers can clear saved work to make room, so keep a backup copy.',
    linkLabel: 'Back up',
    linkHref: '/dashboard#backup',
  },
  unavailable: {
    lead: 'This page is not saving your work right now.',
    body: 'This can happen in private browsing. Anything you type will be gone when you close this page, so open this site in a regular browser window to work safely.',
  },
  full: {
    lead: 'This device is out of storage space.',
    body: 'New entries will not save until you free up room. Your saved work is still here and you can keep a copy.',
    linkLabel: 'Back up now',
    linkHref: '/dashboard#backup',
  },
};

const compose = (c: StorageNoticeCopy): string => `${c.lead} ${c.body}`;

const UNAVAILABLE_MESSAGE = compose(STORAGE_COPY.unavailable);
const FULL_MESSAGE = compose(STORAGE_COPY.full);
const AT_RISK_MESSAGE = compose(STORAGE_COPY.soft);

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
