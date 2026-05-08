/**
 * sw-register tests — silent-update policy.
 *
 * Asserts that the wrapper:
 *   1. Registers /sw.js with `updateViaCache: 'none'` (no 24h SW caching).
 *   2. Does NOT attach a controllerchange/reload handler — silent updates
 *      land on the next natural visit, not via mid-session reload.
 *   3. Unregisters in dev to avoid stale workers during local development.
 *
 * jsdom; we stub navigator.serviceWorker and window.location.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let registerMock: ReturnType<typeof vi.fn>;
let getRegistrationsMock: ReturnType<typeof vi.fn>;
let serviceWorkerListenerCount: number;
let reloadMock: ReturnType<typeof vi.fn>;

function installNavigatorMock() {
  serviceWorkerListenerCount = 0;
  registerMock = vi.fn().mockResolvedValue({});
  getRegistrationsMock = vi.fn().mockResolvedValue([]);
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: registerMock,
      getRegistrations: getRegistrationsMock,
      addEventListener: () => {
        serviceWorkerListenerCount += 1;
      },
      removeEventListener: () => {},
    },
  });
}

function installLocationMock(hostname: string) {
  reloadMock = vi.fn();
  // jsdom Location is read-only; redefine the whole object.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname, reload: reloadMock },
  });
}

describe('sw-register', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers /sw.js with updateViaCache: "none"', async () => {
    installLocationMock('resiliencetoolkit.org');
    installNavigatorMock();
    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();
    expect(registerMock).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
  });

  it('does NOT attach any serviceWorker event listeners (silent update — no mid-session reload)', async () => {
    installLocationMock('resiliencetoolkit.org');
    installNavigatorMock();
    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();
    expect(serviceWorkerListenerCount).toBe(0);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('dev mode: unregisters existing workers and does NOT register a new one', async () => {
    installLocationMock('localhost');
    installNavigatorMock();
    const unregister = vi.fn().mockResolvedValue(true);
    getRegistrationsMock.mockResolvedValueOnce([{ unregister }]);

    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();
    await new Promise((r) => setTimeout(r, 0));

    expect(getRegistrationsMock).toHaveBeenCalled();
    expect(unregister).toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('treats 127.0.0.1 as dev', async () => {
    installLocationMock('127.0.0.1');
    installNavigatorMock();
    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();
    await new Promise((r) => setTimeout(r, 0));
    expect(registerMock).not.toHaveBeenCalled();
  });
});
