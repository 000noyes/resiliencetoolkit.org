import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import {
  recordVisit,
  computeStage,
  clearVisits,
  type Stage,
} from '@/lib/update-prompt';

type Status = 'idle' | 'updating' | 'error';

const SKIP_WAITING_TIMEOUT_MS = 5000;

function readCurrentCacheVersion(): string | null {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
  const reg = (window as any).__rhtSwRegistration;
  if (reg?.waiting?.scriptURL) return reg.waiting.scriptURL;
  return null;
}

function UpdatePromptToastInner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [stage, setStage] = useState<Stage>(1);
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const cacheVersionRef = useRef<string>('unknown');

  // SW lifecycle: detect a waiting worker on mount and on any update found.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.ready
      .then((registration) => {
        if (cancelled) return;
        // Use the waiting worker's scriptURL hash as the cache-version proxy.
        // If sw-register hasn't exposed the registration yet, fall back to
        // reg.waiting?.scriptURL or a stable per-deploy string.
        const versionFromUrl = registration.waiting?.scriptURL || readCurrentCacheVersion() || 'unknown';
        cacheVersionRef.current = versionFromUrl;

        if (registration.waiting) {
          setWaiting(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        /* registration unavailable — render nothing */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Bump the per-cacheVersion visit counter once when we have a waiting worker.
  useEffect(() => {
    if (!waiting) return;
    const count = recordVisit(cacheVersionRef.current);
    setStage(computeStage(count));
  }, [waiting]);

  const handleAccept = useCallback(() => {
    if (!waiting) return;
    setStatus('updating');

    const timeoutId = window.setTimeout(() => {
      setStatus('error');
    }, SKIP_WAITING_TIMEOUT_MS);

    // Once the new SW takes control, sw-register handles the reload via
    // controllerchange. Clear the visit counter for this cacheVersion so a
    // future update starts fresh at stage 1.
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.clearTimeout(timeoutId);
        clearVisits(cacheVersionRef.current);
      },
      { once: true }
    );

    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!waiting || dismissed) return null;

  // Tailwind classes per D3 escalation table.
  const isStage1 = stage === 1;
  const isStage3 = stage === 3;

  const containerSize = isStage1 ? 'max-w-xs' : stage === 2 ? 'max-w-sm' : 'max-w-md';
  const containerSurface = isStage1
    ? 'bg-card border-2 border-border text-foreground'
    : 'bg-primary text-primary-foreground border border-primary';
  const containerRing = isStage3
    ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background motion-safe:animate-pulse-soft'
    : '';
  const iconColor = isStage1 ? 'text-muted-foreground' : 'text-primary-foreground';
  const iconSize = isStage1 ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const buttonBg = isStage1
    ? 'bg-primary text-primary-foreground hover:opacity-90 px-3 py-1.5 text-xs'
    : 'bg-primary-foreground text-primary hover:opacity-90 px-4 py-2 text-sm';
  const dismissColor = isStage1
    ? 'text-muted-foreground hover:text-foreground'
    : 'text-primary-foreground/70 hover:text-primary-foreground';

  const isUpdating = status === 'updating';
  const isError = status === 'error';

  return (
    <div
      className={[
        'fixed inset-x-4 bottom-4 sm:inset-x-auto sm:right-4 z-50 no-print',
        'rounded-lg shadow-lg p-4',
        containerSize,
        containerSurface,
        containerRing,
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-busy={isUpdating}
    >
      <div className="flex items-start gap-3">
        {isUpdating ? (
          <Loader2 className={`${iconSize} ${iconColor} animate-spin flex-shrink-0 mt-0.5`} strokeWidth={1.5} />
        ) : (
          <RefreshCw className={`${iconSize} ${iconColor} flex-shrink-0 mt-0.5`} strokeWidth={1.5} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-2">Toolkit update available.</p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isUpdating}
            className={`${buttonBg} rounded font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed`}
            aria-live={isError ? 'assertive' : undefined}
          >
            {isError ? 'Try refreshing manually.' : isUpdating ? 'Updating…' : 'Update now.'}
          </button>
          {isStage3 && (
            <p className="text-xs font-normal mt-2 opacity-90">Pending since first visit.</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className={`${dismissColor} transition-colors p-2 -m-2 flex-shrink-0`}
          aria-label="Dismiss update notice"
          title="Dismiss"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export default function UpdatePromptToast() {
  return <UpdatePromptToastInner />;
}
