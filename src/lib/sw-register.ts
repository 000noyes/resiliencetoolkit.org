/**
 * Service worker registration + update lifecycle (page side).
 *
 * `updateViaCache: 'none'` forces the browser to revalidate sw.js on every
 * page load instead of caching it (the default `imports` behavior can pin
 * users to an old worker for up to 24h). `/sw.js` is additionally served
 * with Cache-Control: no-cache (public/_headers).
 *
 * Update policy: a waiting worker is asked to warm its cache generation
 * (PRECACHE_WARM); only after it reports the generation complete
 * (PRECACHE_READY) is the update announced (SW_UPDATE_READY_EVENT → the
 * refresh notice). Rotation happens on the user's tap (SKIP_WAITING), after
 * 25s with every window hidden (SKIP_WAITING_WHEN_HIDDEN — the worker
 * verifies nobody is looking), or at a resume boundary after >=5 minutes
 * hidden (iOS suspends background timers, so the timer path alone would
 * never fire for a home-screen app). The worker re-verifies completeness on
 * every rotation request, so no page code path can activate an incomplete
 * cache generation.
 *
 * Readiness has ONE source of truth: the documentElement dataset flag
 * (READY_DATASET_KEY). The inline-script bundle and the banner island are
 * separate module instances, so module variables cannot be shared; the
 * dataset is readable by both, and SW_UPDATE_READY_EVENT is purely a change
 * notification (detail.version null = readiness withdrawn by a newer
 * deploy).
 *
 * Reload discipline: every controlled tab reloads exactly once per rotation
 * (one-shot flag), after showing a dependency-free status notice, flushing
 * pending edits, and waiting for the initiated saves to commit
 * (flushAndWait). A first-install claim is absorbed without a reload. A tab that slept through the rotation (iOS
 * snapshot restore) reloads once on return-to-visible when the controller
 * identity changed under it.
 */
import { flushPendingWrites, flushAndWait } from './flush-writes';

export const SW_UPDATE_READY_EVENT = 'rt:sw-update-ready';
/** documentElement.dataset key mirroring READY state for late-hydrating islands. */
export const READY_DATASET_KEY = 'rtSwUpdateReady';
const HIDDEN_ROTATE_MS = 25_000;
const RESUME_ROTATE_MIN_HIDDEN_MS = 300_000;
const UPDATE_CHECK_INTERVAL_MS = 3_600_000;

const isDev = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/** DOM id of the rotation notice; presence doubles as the injection guard. */
const ROTATION_NOTICE_ID = 'rt-sw-rotation-notice';

/**
 * Calm status bar for the sub-3s flush window before a rotation reload, so
 * the reload reads as "the app updated", not a glitch. Direct DOM with inline
 * styles ON PURPOSE: no island, no hashed asset, no CSS variable — it must
 * render on any vintage page and can never be broken by the cache states that
 * force a rotation. Removed by the reload itself; failure is tolerated
 * because presentation must never block the rotation.
 */
function showRotationNotice(): void {
  try {
    if (document.getElementById(ROTATION_NOTICE_ID)) return;
    const el = document.createElement('div');
    el.id = ROTATION_NOTICE_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = 'Updating to the latest version.';
    // Neutral chrome hardcoded from the base.css tokens (background /
    // text-primary / a hairline border): the bar must be legible on any
    // vintage page without depending on CSS variables being present.
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'padding:12px 16px;text-align:center;' +
      'background:oklch(0.9911 0 0);color:oklch(0.2046 0 0);' +
      'border-top:1px solid oklch(0.92 0 0);' +
      'font:500 0.9375rem/1.4 Outfit,system-ui,sans-serif';
    document.body.appendChild(el);
  } catch {
    /* presentation only */
  }
}

function getReadyVersion(): string | null {
  return document.documentElement.dataset[READY_DATASET_KEY] || null;
}

function setReadyVersion(version: string | null): void {
  if (version) {
    document.documentElement.dataset[READY_DATASET_KEY] = version;
  } else {
    delete document.documentElement.dataset[READY_DATASET_KEY];
  }
  document.dispatchEvent(new CustomEvent(SW_UPDATE_READY_EVENT, { detail: { version } }));
}

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (isDev()) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    return;
  }

  const container = navigator.serviceWorker;
  // The controller this page last reconciled with. Updated on every handled
  // controllerchange (including the absorbed first-install claim) so the
  // return-to-visible guard below detects rotations this page slept through
  // even when the page started life uncontrolled.
  let lastController = container.controller;
  let refreshing = false;
  let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  const reloadOnce = () => {
    if (refreshing) return;
    refreshing = true;
    showRotationNotice();
    flushAndWait().then(() => window.location.reload());
  };

  container.addEventListener('controllerchange', () => {
    const hadController = lastController !== null;
    lastController = container.controller;
    // First-install claim: the page was uncontrolled and just gained a
    // controller — no rotation happened, nothing to reload.
    if (!hadController) return;
    reloadOnce();
  });

  container
    .register('/sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // Ask the active worker to fill any precache gaps. A worker terminated
      // mid-fill (common on phones) resumes on the next page load and
      // whenever the connection comes back.
      const requestTopUp = () => reg.active?.postMessage('PRECACHE_TOPUP');
      container.ready.then(requestTopUp).catch(() => {});
      window.addEventListener('online', () => {
        requestTopUp();
        reg.update().catch(() => {});
      });
      setInterval(() => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);

      // Warm pipeline: a waiting worker fills its own generation without
      // touching the active one; re-posted on load and on return-to-visible
      // so an interrupted warm resumes. Skipped once READY — a verified
      // generation needs no re-warm.
      const considerWaiting = () => {
        if (getReadyVersion()) return;
        if (reg.waiting && container.controller) {
          reg.waiting.postMessage({ type: 'PRECACHE_WARM' });
        }
      };
      considerWaiting();

      reg.addEventListener('updatefound', () => {
        // A newer deploy replaces reg.waiting: withdraw readiness so the
        // banner resets and no rotation path trusts the stale version.
        setReadyVersion(null);
        const installing = reg.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed') considerWaiting();
        });
      });

      const armHiddenTimer = () => {
        if (!getReadyVersion() || !reg.waiting) return;
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(() => {
          // An iOS-frozen page fires suspended timers on resume; the
          // visibility re-check skips the rotation there (the worker's
          // all-hidden check is the second gate).
          if (document.visibilityState === 'hidden' && reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
          }
        }, HIDDEN_ROTATE_MS);
      };

      container.addEventListener('message', (event: MessageEvent) => {
        const data = event.data;
        // Only trust readiness reported by the CURRENT waiting worker.
        if (data?.type === 'PRECACHE_READY' && reg.waiting && event.source === reg.waiting) {
          setReadyVersion(String(data.version ?? ''));
          if (document.visibilityState === 'hidden') armHiddenTimer();
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          hiddenAt = Date.now();
          // Convert pending debounced edits to committed state ONLY when a
          // rotation is actually possible (verified update waiting) — an
          // unconditional flush would blur the user's editor and drop their
          // caret on every ordinary app switch.
          if (getReadyVersion() && reg.waiting) {
            flushPendingWrites();
            armHiddenTimer();
          }
          return;
        }
        // Back to visible.
        if (hiddenTimer) {
          clearTimeout(hiddenTimer);
          hiddenTimer = null;
        }
        const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = null;
        reg.update().catch(() => {});
        // Frozen-tab guard: the controller changed while this page slept
        // through controllerchange (iOS snapshot restore, BFCache) — reload
        // once so the page never runs old HTML under a new worker.
        if (container.controller !== lastController) {
          lastController = container.controller;
          reloadOnce();
          return;
        }
        // Resume boundary (the iOS home-screen heal): rotate before the
        // first keystroke of the resumed session; anything typed earlier
        // was flushed at hide.
        if (getReadyVersion() && reg.waiting && hiddenFor >= RESUME_ROTATE_MIN_HIDDEN_MS) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          considerWaiting();
        }
      });
    })
    .catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
}

/**
 * User-initiated update (the refresh notice tap). Stateless on purpose: the
 * banner island bundles its own copy of this module, so it must not depend
 * on shared module state with the BaseLayout inline-script instance. The
 * worker re-verifies completeness before honoring SKIP_WAITING.
 */
export function applyUpdate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  flushAndWait().then(() => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  });
}
