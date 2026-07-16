import { useEffect, useState } from 'react';
import {
  claimNotice,
  releaseNotice,
  getActiveNotice,
  NOTICE_CHANGED_EVENT,
  type NoticeId,
} from '@/lib/notices';

/**
 * Shared notice-slot participation for the React banners (precedent:
 * useFlushOnHide). While `wants` is true the strip claims the slot for `id`;
 * it releases on `!wants` and on unmount. The hook subscribes to
 * `rt:notice-changed` so any strip's claim/release recomputes the winner, and
 * returns whether THIS strip is the current winner (the only time it should
 * render).
 *
 * Fail toward showing: if the winner computation ever throws, a claiming strip
 * renders its own claim rather than risk silencing an acute data-loss warning
 * (worst case is stacking, never silence).
 */
export function useNoticeClaim(id: NoticeId, wants: boolean): boolean {
  const [isWinner, setIsWinner] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const recompute = () => {
      if (!wants) {
        setIsWinner(false);
        return;
      }
      try {
        setIsWinner(getActiveNotice() === id);
      } catch {
        // fail toward showing my own claim
        setIsWinner(true);
      }
    };

    if (wants) {
      claimNotice(id);
    } else {
      releaseNotice(id);
    }
    // claim/release already dispatched the change event, but this hook's own
    // listener is not attached yet at that moment — compute directly once.
    recompute();

    document.addEventListener(NOTICE_CHANGED_EVENT, recompute);
    return () => {
      document.removeEventListener(NOTICE_CHANGED_EVENT, recompute);
      releaseNotice(id);
    };
  }, [id, wants]);

  return isWinner;
}
