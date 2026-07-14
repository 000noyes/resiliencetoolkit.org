/**
 * Flush contract for pending debounced writes.
 *
 * The service worker update lifecycle reloads pages after a rotation. The
 * editors debounce their IndexedDB saves (DataTable 300ms, PersonalNotes
 * 500ms) with TRAILING timers, so the pending delta at any moment is
 * everything typed since the last debounce-length pause — not a fixed few
 * hundred milliseconds. Before any rotation-triggered reload (and on every
 * tab hide), this flush converts pending state into committed state:
 *
 * 1. Blur the focused editor. For the blur-save editors (PlanForm,
 *    SlotCollection) that IS the complete flush, and on Safari a button tap
 *    does not necessarily blur a focused textarea, so the blur must be
 *    programmatic.
 * 2. Dispatch FLUSH_WRITES_EVENT. Debounced editors listen and commit their
 *    pending value immediately (clearing their timers), covering values that
 *    blur alone would leave in a re-armed debounce.
 *
 * Callers wait FLUSH_WAIT_MS (sw-register) after calling this so the
 * resulting IndexedDB puts can commit before the page unloads.
 */
export const FLUSH_WRITES_EVENT = 'rt:flush-pending-writes';

export function flushPendingWrites(): void {
  if (typeof document === 'undefined') return;
  const el = document.activeElement as HTMLElement | null;
  if (
    el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  ) {
    el.blur();
  }
  document.dispatchEvent(new Event(FLUSH_WRITES_EVENT));
}
