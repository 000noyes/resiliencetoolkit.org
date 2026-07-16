/**
 * One notice at a time — a condition-keyed priority claims registry.
 *
 * The site has four top-of-page notice strips (storage-health acute + soft,
 * offline/online status, the update prompt, and the contact banner). Stacking
 * them reads as clutter and, in the field, as alarm; so a single rule
 * coordinates all four: each strip CLAIMS the slot when its own show-condition
 * holds (its signal wants to show AND it is not dismissed), the highest
 * priority above the dismissal-damped floor wins, and a strip renders only
 * while it is the winner.
 *
 *   storageAcute (50) > status (40) > update (30) > storageSoft (20) > contact (10)
 *
 * Claims are keyed on the strip's own CONDITION, never on its rendered
 * visibility: a masked strip keeps its claim so the dismissal handover works
 * (dismiss the winner, the next-highest claimant appears) and nothing
 * oscillates. Because the banner islands are separate module instances,
 * module-level state cannot cross island bundles; claims live on the
 * documentElement dataset (presence-only keys, no values to parse — the same
 * dataset + change-event pattern the update-readiness flag already uses).
 *
 * `computeWinner` is a pure function exported for direct unit testing. If a
 * consumer ever sees it throw it falls back to "my own claim exists, so I
 * render" (fail toward showing; the worst case is stacking, never a silenced
 * acute data-loss warning).
 */
export type NoticeId = 'storageAcute' | 'status' | 'update' | 'storageSoft' | 'contact';

/**
 * Internal priority table. Distinct values are pinned by a unit test so ties
 * are impossible; callers never see these numbers. Higher wins.
 */
export const NOTICE_PRIORITY: Record<NoticeId, number> = {
  storageAcute: 50,
  status: 40,
  update: 30,
  storageSoft: 20,
  contact: 10,
};

/**
 * Fixed id order (highest priority first). computeWinner walks this so the
 * tiebreak is deterministic as defense-in-depth, even though distinct
 * priorities make a tie impossible; the ordering survives future edits.
 */
const ID_ORDER: NoticeId[] = ['storageAcute', 'status', 'update', 'storageSoft', 'contact'];

export const NOTICE_CHANGED_EVENT = 'rt:notice-changed';

/** documentElement.dataset key holding the dismissal-damped floor (a priority). */
export const DAMPED_FLOOR_DATASET_KEY = 'rtNoticeDampedFloor';

/** The presence-only dataset key a strip writes to claim the slot. */
export function claimDatasetKey(id: NoticeId): string {
  return `rtNoticeClaim${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

function notifyChange(): void {
  document.dispatchEvent(new Event(NOTICE_CHANGED_EVENT));
}

/** Claim the slot for `id` (its show-condition holds). Idempotent. */
export function claimNotice(id: NoticeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset[claimDatasetKey(id)] = '';
  notifyChange();
}

/** Release the slot claim for `id` (condition cleared, dismissed, unmounted). */
export function releaseNotice(id: NoticeId): void {
  if (typeof document === 'undefined') return;
  delete document.documentElement.dataset[claimDatasetKey(id)];
  notifyChange();
}

function readDampedFloor(): number {
  const raw = document.documentElement.dataset[DAMPED_FLOOR_DATASET_KEY];
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Damp the floor to `id`'s priority on dismissal, so the next-lower claimant
 * waits until the next page navigation (which resets the per-document dataset)
 * instead of popping in immediately. Max-merges: a lower later damp never
 * lowers the floor. Signal claims above the floor always win (acute/offline
 * are never damped).
 */
export function dampNotice(id: NoticeId): void {
  if (typeof document === 'undefined') return;
  const next = Math.max(readDampedFloor(), NOTICE_PRIORITY[id]);
  document.documentElement.dataset[DAMPED_FLOOR_DATASET_KEY] = String(next);
  notifyChange();
}

/**
 * Pure winner computation: the highest-priority claimed id strictly above the
 * damped floor, or null. Deterministic tiebreak by ID_ORDER. Does not read the
 * DOM — call it with the claimed ids and the floor.
 */
export function computeWinner(claims: NoticeId[], dampedFloor: number): NoticeId | null {
  let best: NoticeId | null = null;
  let bestPriority = -1;
  for (const id of ID_ORDER) {
    if (!claims.includes(id)) continue;
    const p = NOTICE_PRIORITY[id];
    if (p <= dampedFloor) continue;
    if (p > bestPriority) {
      best = id;
      bestPriority = p;
    }
  }
  return best;
}

/** The winning notice id given the current DOM claims and damped floor. */
export function getActiveNotice(): NoticeId | null {
  if (typeof document === 'undefined') return null;
  const ds = document.documentElement.dataset;
  const claims = ID_ORDER.filter((id) => claimDatasetKey(id) in ds);
  return computeWinner(claims, readDampedFloor());
}
