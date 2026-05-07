/**
 * UpdatePromptToast visit-counter state machine.
 *
 * The toast escalates across visits while a SW update is pending:
 *   stage 1: neutral chrome, first visit
 *   stage 2: primary palette, second visit
 *   stage 3: primary + ring + pulse, third+ visit
 *
 * State machine:
 *   - localStorage key is keyed by cacheVersion. New CACHE_VERSION = new key
 *     = stage 1 again (correct: a *new* update should not inherit prior
 *     escalation pressure).
 *   - sessionStorage sentinel ensures multiple SPA navigations within a
 *     single tab session count as ONE visit. Without it, three internal
 *     navs would jump straight to stage 3.
 *   - Calling `acceptUpdate` clears state for the current cacheVersion.
 */

export const VISIT_COUNT_PREFIX = 'updatePromptVisits.';
export const SESSION_SENTINEL_KEY = 'updatePromptVisitedThisSession';

export type Stage = 1 | 2 | 3;

export interface UpdatePromptStores {
  local?: Storage;
  session?: Storage;
}

export function getVisitCountKey(cacheVersion: string): string {
  return `${VISIT_COUNT_PREFIX}${cacheVersion}`;
}

export function getVisitCount(cacheVersion: string, stores: UpdatePromptStores = defaultStores()): number {
  const { local } = stores;
  if (!local) return 0;
  try {
    const raw = local.getItem(getVisitCountKey(cacheVersion));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Increments the visit counter for the current cacheVersion, but only
 * once per tab session. Returns the resulting count.
 */
export function recordVisit(cacheVersion: string, stores: UpdatePromptStores = defaultStores()): number {
  const { local, session } = stores;
  if (!local) return 0;

  // Per-session sentinel: skip if we've already counted this tab.
  if (session) {
    try {
      if (session.getItem(SESSION_SENTINEL_KEY) === cacheVersion) {
        return getVisitCount(cacheVersion, stores);
      }
      session.setItem(SESSION_SENTINEL_KEY, cacheVersion);
    } catch {
      /* fall through — without sentinel, we may overcount, but never crash */
    }
  }

  const next = getVisitCount(cacheVersion, stores) + 1;
  try {
    local.setItem(getVisitCountKey(cacheVersion), String(next));
  } catch {
    /* persistence unavailable — return computed value anyway */
  }
  return next;
}

export function computeStage(count: number): Stage {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  return 3;
}

export function clearVisits(cacheVersion: string, stores: UpdatePromptStores = defaultStores()): void {
  const { local, session } = stores;
  if (local) {
    try {
      local.removeItem(getVisitCountKey(cacheVersion));
    } catch {
      /* swallow */
    }
  }
  if (session) {
    try {
      session.removeItem(SESSION_SENTINEL_KEY);
    } catch {
      /* swallow */
    }
  }
}

function defaultStores(): UpdatePromptStores {
  if (typeof window === 'undefined') return {};
  let local: Storage | undefined;
  let session: Storage | undefined;
  try {
    local = window.localStorage;
  } catch {
    /* unavailable */
  }
  try {
    session = window.sessionStorage;
  } catch {
    /* unavailable */
  }
  return { local, session };
}
