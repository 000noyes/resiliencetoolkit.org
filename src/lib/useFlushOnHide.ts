import { useEffect, useRef } from 'react';

/**
 * Last-resort flush on tab hide / close.
 *
 * Registers `pagehide` and `visibilitychange === 'hidden'` handlers that run
 * the supplied flush callback when the page is backgrounded or unloaded. On
 * mobile (Safari / Android) the OS can freeze or kill a backgrounded tab, so
 * this is the last moment to persist in-flight edits.
 *
 * This is BEST-EFFORT, not the core guarantee — an IndexedDB write started
 * during `pagehide` can be killed mid-unload before it commits. The synchronous
 * localStorage edit journal (see edit-journal.ts) is the real backstop; this
 * hook just gives the pending debounced write one more chance to land.
 *
 * The callback is held in a ref so the listeners register once and always call
 * the latest closure without re-subscribing on every render.
 */
export function useFlushOnHide(flush: () => void): void {
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPageHide = () => flushRef.current();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushRef.current();
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
