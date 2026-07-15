import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SW_UPDATE_READY_EVENT, READY_DATASET_KEY, applyUpdate } from '@/lib/sw-register';
import { isSuppressed, recordDismissal } from '@/lib/update-banner';

/**
 * Update notice: shown only when a new service worker is installed AND has
 * verified its cache generation complete (sw-register's warm pipeline), so
 * tapping Refresh always visibly delivers the new build, online or offline.
 * Presentation-only — the rotation lifecycle lives in sw-register, so a
 * hydration failure here costs nothing (the idle and resume paths still
 * heal the device).
 *
 * Readiness state is read from the documentElement dataset flag (single
 * source of truth across the inline-script and island bundles); the event
 * is a change notification, with detail.version null meaning readiness was
 * withdrawn by a newer deploy (the banner resets and waits for the next
 * verified generation). The Refresh button stays enabled — applyUpdate is
 * idempotent and the worker refuses unwarmed rotations, so a second tap is
 * harmless.
 */
export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const initial = document.documentElement.dataset[READY_DATASET_KEY];
    if (initial && !isSuppressed(initial, Date.now())) setVersion(initial);

    const onReadyChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const v = detail?.version ? String(detail.version) : null;
      setWorking(false);
      if (v && !isSuppressed(v, Date.now())) {
        setVersion(v);
      } else {
        setVersion(null);
      }
    };
    document.addEventListener(SW_UPDATE_READY_EVENT, onReadyChange);
    return () => document.removeEventListener(SW_UPDATE_READY_EVENT, onReadyChange);
  }, []);

  if (!version) return null;

  const handleRefresh = () => {
    setWorking(true);
    applyUpdate();
  };

  const handleDismiss = () => {
    recordDismissal(version, Date.now());
    setVersion(null);
    setWorking(false);
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
            className="text-sm font-medium text-primary hover:opacity-80 transition-opacity underline-offset-2 hover:underline"
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
