import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SW_UPDATE_READY_EVENT, applyUpdate } from '@/lib/sw-register';
import { isSuppressed, recordDismissal } from '@/lib/update-banner';

/**
 * Update notice: shown only when a new service worker is installed AND has
 * verified its cache generation complete (sw-register's warm pipeline), so
 * tapping Refresh always visibly delivers the new build, online or offline.
 * Presentation-only — the rotation lifecycle lives in sw-register, so a
 * hydration failure here costs nothing (the idle and resume paths still
 * heal the device).
 */
const REENABLE_MS = 10_000;

export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const reenableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The inline-script bundle mirrors READY state onto the root element for
    // islands that hydrate after the event fired.
    const initial = document.documentElement.dataset.rtSwUpdateReady;
    if (initial && !isSuppressed(initial, Date.now())) setVersion(initial);

    const onReady = (event: Event) => {
      const v = String((event as CustomEvent).detail?.version ?? '');
      if (reenableTimerRef.current) clearTimeout(reenableTimerRef.current);
      setWorking(false);
      if (v && !isSuppressed(v, Date.now())) setVersion(v);
    };
    document.addEventListener(SW_UPDATE_READY_EVENT, onReady);
    return () => {
      document.removeEventListener(SW_UPDATE_READY_EVENT, onReady);
      if (reenableTimerRef.current) clearTimeout(reenableTimerRef.current);
    };
  }, []);

  if (!version) return null;

  const handleRefresh = () => {
    setWorking(true);
    applyUpdate();
    // A stacked newer deploy is refused worker-side (it re-warms instead of
    // rotating unwarmed); if no rotation reloads this page, re-enable the
    // button rather than leaving it stuck. A fresh READY resets the banner.
    reenableTimerRef.current = setTimeout(() => setWorking(false), REENABLE_MS);
  };

  const handleDismiss = () => {
    recordDismissal(version, Date.now());
    setVersion(null);
  };

  return (
    <div className="bg-card border-b border-border no-print" role="status" aria-live="polite">
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center gap-3 pr-8">
          <p className="text-sm text-foreground text-center">
            A newer version of this site is ready.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={working}
            className="text-sm font-medium text-primary hover:opacity-80 transition-opacity underline-offset-2 hover:underline disabled:opacity-60 disabled:hover:no-underline"
          >
            {working ? 'Refreshing' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-0 text-muted-foreground hover:text-foreground transition-colors p-2 -m-2"
            aria-label="Dismiss this notice"
            title="Dismiss"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
