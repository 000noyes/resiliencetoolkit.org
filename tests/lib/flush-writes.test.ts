/**
 * flush-writes tests.
 *
 * flushPendingWrites: blurs the focused editor (the complete flush for
 * blur-save editors) and dispatches FLUSH_WRITES_EVENT (debounced editors
 * commit their pending value on it). dirtyRows: the sweep DataTable runs on
 * flush to save every row whose edit is still sitting in a debounce —
 * including rows whose save was silently cancelled by the shared timer.
 */
import { describe, it, expect, vi } from 'vitest';
import { flushPendingWrites, dirtyRows, FLUSH_WRITES_EVENT } from '../../src/lib/flush-writes';

describe('flushPendingWrites', () => {
  it('blurs a focused textarea and dispatches the flush event', () => {
    const spy = vi.fn();
    document.addEventListener(FLUSH_WRITES_EVENT, spy);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    flushPendingWrites();

    expect(document.activeElement).not.toBe(textarea);
    expect(spy).toHaveBeenCalledTimes(1);
    document.removeEventListener(FLUSH_WRITES_EVENT, spy);
    textarea.remove();
  });

  it('dispatches the event even when nothing editable is focused', () => {
    const spy = vi.fn();
    document.addEventListener(FLUSH_WRITES_EVENT, spy);
    (document.activeElement as HTMLElement | null)?.blur?.();

    flushPendingWrites();

    expect(spy).toHaveBeenCalledTimes(1);
    document.removeEventListener(FLUSH_WRITES_EVENT, spy);
  });
});

describe('dirtyRows', () => {
  const row = (rowId: string, updatedAt: string) => ({ rowId, updatedAt });

  it('returns rows whose updatedAt differs from the saved copy', () => {
    const current = [row('a', 't2'), row('b', 't1')];
    const saved = [row('a', 't1'), row('b', 't1')];
    expect(dirtyRows(current, saved).map((r) => r.rowId)).toEqual(['a']);
  });

  it('catches BOTH rows when a shared debounce cancelled the earlier save', () => {
    // Edit row a, then row b within the debounce window: main's shared timer
    // cancels a's save while the UI still shows Saved. Both must sweep dirty.
    const current = [row('a', 't2'), row('b', 't2')];
    const saved = [row('a', 't1'), row('b', 't1')];
    expect(dirtyRows(current, saved).map((r) => r.rowId)).toEqual(['a', 'b']);
  });

  it('skips rows with no saved counterpart (add-row save already in flight)', () => {
    const current = [row('new', 't1')];
    expect(dirtyRows(current, [])).toEqual([]);
  });

  it('returns empty when everything is committed', () => {
    const current = [row('a', 't1')];
    expect(dirtyRows(current, [row('a', 't1')])).toEqual([]);
  });
});
