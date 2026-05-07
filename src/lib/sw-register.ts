/**
 * Service worker registration.
 *
 * `updateViaCache: 'none'` forces the browser to revalidate sw.js on every
 * page load instead of caching it (the default `imports` behavior can pin
 * users to an old worker for up to 24h).
 *
 * `refreshing` flag prevents a double-reload race: when SKIP_WAITING fires,
 * controllerchange triggers reload; without the flag, multiple simultaneous
 * controllerchange events would each call location.reload().
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

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
