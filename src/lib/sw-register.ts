/**
 * Service worker registration.
 *
 * `updateViaCache: 'none'` forces the browser to revalidate sw.js on every
 * page load instead of caching it (the default `imports` behavior can pin
 * users to an old worker for up to 24h).
 *
 * Silent-update policy: a new SW stays in `waiting` until every controlled
 * tab is closed, then the browser promotes it on next visit. There is no
 * client-side prompt, no controllerchange reload, and no SKIP_WAITING
 * message — the only update path is the natural lifecycle.
 */

const isDev = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  if (isDev()) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    return;
  }

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
    console.log('Service Worker registration failed:', error);
  });
}
