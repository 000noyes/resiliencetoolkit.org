/**
 * sw-register tests — D6 #1 (updateViaCache: 'none') + D6 #2 (refreshing
 * flag prevents double-reload).
 *
 * These run in jsdom; we stub navigator.serviceWorker and window.location
 * to inspect what the wrapper passes through.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

let registerMock: ReturnType<typeof vi.fn>;
let getRegistrationsMock: ReturnType<typeof vi.fn>;
let controllerChangeListeners: Array<() => void>;
let reloadMock: ReturnType<typeof vi.fn>;

function installNavigatorMock() {
  controllerChangeListeners = [];
  registerMock = vi.fn().mockResolvedValue({});
  getRegistrationsMock = vi.fn().mockResolvedValue([]);
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: registerMock,
      getRegistrations: getRegistrationsMock,
      addEventListener: (type: string, cb: () => void) => {
        if (type === 'controllerchange') controllerChangeListeners.push(cb);
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

  it('refreshing flag — controllerchange only triggers location.reload once', async () => {
    installLocationMock('resiliencetoolkit.org');
    installNavigatorMock();
    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();

    expect(controllerChangeListeners.length).toBe(1);
    controllerChangeListeners[0]();
    controllerChangeListeners[0]();
    controllerChangeListeners[0]();

    expect(reloadMock).toHaveBeenCalledTimes(1);
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
