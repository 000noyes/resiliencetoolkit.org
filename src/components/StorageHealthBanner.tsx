import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  checkStorageHealth,
  shouldClaimStorageSoft,
  STORAGE_HEALTH_EVENT,
  STORAGE_COPY,
  type StorageHealth,
  type StorageNoticeCopy,
} from '@/lib/storageHealth';
import { useNoticeClaim } from '@/lib/useNoticeClaim';
import { dampNotice } from '@/lib/notices';
import { getCueState, readCanary } from '@/lib/backup-cue';

/**
 * App-wide storage-health banner.
 *
 * Warns, honestly and in one place, when the browser cannot durably hold the
 * user's work:
 *   - unavailable / full  -> acute, not dismissible (data is being lost now)
 *   - at-risk             -> soft, dismissible for the session (back it up)
 *   - healthy             -> renders nothing
 *
 * It re-checks when the tab becomes visible and when an editor reports a quota
 * hit, so a device that fills up mid-session surfaces the warning app-wide
 * rather than only inside the table that failed to save.
 *
 * Notice-slot participation: the acute states claim priority `storageAcute`
 * (top of the queue, non-dismissible), the soft at-risk state claims
 * `storageSoft` (near the bottom). Each claims on its own condition and
 * renders only while it is the winner; the two claims are mutually exclusive
 * because a given health status is exactly one of acute / soft / healthy.
 *
 * Visual: whisper tint (no icons — severity is carried by the 500-weight lead
 * phrase + role). Links use the strip foreground color + underline (primary
 * orange fails contrast on the tint). See DESIGN.md.
 */
const DISMISS_KEY = 'rt-storage-health-dismissed';

function StorageHealthBannerInner() {
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // null = the cue has not resolved yet, which never claims (appear-late is
  // fine; flash-then-hide is not).
  const [softCue, setSoftCue] = useState<boolean | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      // One sequenced async run: health first, then the cue only when health
      // resolves at-risk, so an IndexedDB failure can never suppress the
      // acute path. The request id drops stale resolutions from overlapping
      // visibility rechecks. Cheap reads only: one localStorage canary read
      // and one metadata counter read; the hash is dashboard-only.
      const requestId = ++requestRef.current;
      try {
        const h = await checkStorageHealth();
        if (!mounted || requestId !== requestRef.current) return;
        setHealth(h);
        if (h.status !== 'at-risk') {
          setSoftCue(false);
          return;
        }
        const canary = readCanary();
        let counter: number | 'unknown' = 'unknown';
        try {
          counter = (await getCueState()).counter;
        } catch {
          // counter-unknown claims, failing toward honesty
        }
        if (!mounted || requestId !== requestRef.current) return;
        setSoftCue(shouldClaimStorageSoft({ atRisk: true, dismissed: false, canary, counter }));
      } catch {
        // health unreadable: keep the last known state
      }
    };
    run();

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // sessionStorage unavailable; treat as not dismissed
    }

    const onEvent = () => run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener(STORAGE_HEALTH_EVENT, onEvent);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted = false;
      document.removeEventListener(STORAGE_HEALTH_EVENT, onEvent);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const acuteState = health?.status === 'unavailable' || health?.status === 'full';
  const softState = health?.status === 'at-risk';

  // The soft reminder is work-based (reconciliation R1): it claims only when
  // unprotected work exists on an at-risk origin, and never for a visitor
  // with nothing saved. A completed backup dispatches STORAGE_HEALTH_EVENT,
  // which re-runs the sequenced check above and releases the claim same-tab.
  // Acute states ignore all of this: data is being lost NOW.
  const acuteWinner = useNoticeClaim('storageAcute', !!acuteState);
  const softWinner = useNoticeClaim('storageSoft', !!softState && !dismissed && softCue === true);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    dampNotice('storageSoft');
    setDismissed(true);
  };

  const winner = acuteWinner ? 'acute' : softWinner ? 'soft' : null;
  if (!health || !winner) return null;

  const acute = winner === 'acute';
  const dismissible = !acute;
  const copy: StorageNoticeCopy =
    health.status === 'unavailable'
      ? STORAGE_COPY.unavailable
      : health.status === 'full'
        ? STORAGE_COPY.full
        : STORAGE_COPY.soft;

  return (
    <div
      className={`border-b no-print ${acute ? 'notice-acute' : 'notice-soft'}`}
      role={acute ? 'alert' : 'status'}
      aria-live={acute ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-label="Storage notice"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-start justify-center">
          <p
            className={`max-w-3xl text-sm text-foreground text-center max-[400px]:text-left ${
              dismissible ? 'pe-11' : ''
            }`}
            style={{ textWrap: 'balance' }}
          >
            <span className={`font-medium ${acute ? 'text-destructive' : 'text-foreground'}`}>
              {copy.lead}
            </span>{' '}
            <span>{copy.body}</span>
            {copy.linkHref && copy.linkLabel && (
              <>
                {' '}
                <a
                  href={copy.linkHref}
                  className="font-medium text-foreground underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  {copy.linkLabel}
                </a>
              </>
            )}
          </p>
          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute end-0 top-0 flex h-11 w-11 items-center justify-center text-foreground opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss storage notice"
              title="Dismiss"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StorageHealthBanner() {
  return <StorageHealthBannerInner />;
}
