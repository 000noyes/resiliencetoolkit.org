import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { checkStorageHealth, STORAGE_HEALTH_EVENT, type StorageHealth } from '@/lib/storageHealth';

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
 */
const DISMISS_KEY = 'rt-storage-health-dismissed';

function StorageHealthBannerInner() {
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = () => {
      checkStorageHealth().then((h) => {
        if (mounted) setHealth(h);
      });
    };
    run();

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // sessionStorage unavailable — treat as not dismissed
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

  if (!health || health.status === 'healthy' || !health.message) return null;

  const acute = health.status === 'unavailable' || health.status === 'full';
  const dismissible = !acute;
  if (dismissible && dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const tone = acute
    ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900'
    : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900';

  return (
    <div
      className={`border-b no-print ${tone}`}
      role={acute ? 'alert' : 'status'}
      aria-live={acute ? 'assertive' : 'polite'}
      aria-label="Storage notice"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-start justify-center gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <p className={`max-w-3xl text-sm ${dismissible ? 'pr-8' : ''}`}>{health.message}</p>
          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-0 -m-2 p-2 opacity-70 transition-opacity hover:opacity-100"
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
