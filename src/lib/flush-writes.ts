/**
 * Flush contract for pending debounced writes.
 *
 * The service worker update lifecycle reloads pages after a rotation. The
 * editors debounce their IndexedDB saves (DataTable 300ms, PersonalNotes
 * 500ms) with TRAILING timers, so the pending delta at any moment is
 * everything typed since the last debounce-length pause — not a fixed few
 * hundred milliseconds. Before any rotation-triggered reload (and on tab
 * hide while an update is pending), this flush converts pending state into
 * committed state:
 *
 * 1. Blur the focused editor. For the blur-save editors (PlanForm,
 *    SlotCollection) that IS the complete flush, and on Safari a button tap
 *    does not necessarily blur a focused textarea, so the blur must be
 *    programmatic.
 * 2. Dispatch FLUSH_WRITES_EVENT with a `pending` collector in its detail.
 *    Debounced editors commit their pending value immediately (clearing
 *    their timers) and push the resulting save promises into the collector,
 *    so a rotation can wait for the actual IndexedDB commits instead of
 *    guessing with a timer.
 *
 * flushAndWait() is that wait: collected saves settled AND a floor that
 * covers editors which cannot report (blur-save commits initiated by step
 * 1), capped so a hung put can never stall a rotation indefinitely.
 */
export const FLUSH_WRITES_EVENT = 'rt:flush-pending-writes';

/**
 * Floor: must exceed every editor debounce-to-commit tail for saves the
 * collector cannot see (blur-save editors). Cap: a wedged IndexedDB put must
 * not block a user-requested refresh forever.
 */
export const FLUSH_WAIT_MS = 600;
export const FLUSH_MAX_WAIT_MS = 2500;

export interface FlushWritesDetail {
  /** Listeners push the promises of saves they initiate in response. */
  pending: Promise<unknown>[];
}

/**
 * Rows whose current edit has not reached IndexedDB yet. DataTable's shared
 * debounce timer means a second row edited inside the window silently
 * cancels the first row's save, so sweeps compare EVERY row against its
 * saved copy rather than trusting the last timer. Rows without a saved
 * counterpart are skipped: add-row awaits its initial save before the row
 * renders, so absence means that save still owns the write.
 */
export function dirtyRows<T extends { rowId: string; updatedAt: string }>(
  current: T[],
  saved: T[]
): T[] {
  const savedById = new Map(saved.map((r) => [r.rowId, r]));
  return current.filter((r) => {
    const savedRow = savedById.get(r.rowId);
    return savedRow !== undefined && savedRow.updatedAt !== r.updatedAt;
  });
}

export function flushPendingWrites(): Promise<unknown>[] {
  if (typeof document === 'undefined') return [];
  const el = document.activeElement as HTMLElement | null;
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  ) {
    el.blur();
  }
  const detail: FlushWritesDetail = { pending: [] };
  document.dispatchEvent(new CustomEvent<FlushWritesDetail>(FLUSH_WRITES_EVENT, { detail }));
  return detail.pending;
}

/** Flush, then wait for the initiated saves to commit (floored and capped). */
export function flushAndWait(): Promise<void> {
  const pending = flushPendingWrites();
  const floor = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_WAIT_MS));
  const cap = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_MAX_WAIT_MS));
  const settled = Promise.allSettled(pending).then(() => undefined);
  return Promise.race([Promise.all([floor, settled]).then(() => undefined), cap]);
}
