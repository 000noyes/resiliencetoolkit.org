/**
 * sw-register tests — update lifecycle (page side).
 *
 * Asserts the wrapper:
 *   1. Registers /sw.js with `updateViaCache: 'none'` (no 24h SW caching).
 *   2. Warm pipeline: posts PRECACHE_WARM to a waiting worker, announces
 *      SW_UPDATE_READY_EVENT only on a PRECACHE_READY reply from THAT worker.
 *   3. Reload discipline: first-install claim absorbed; one flush-then-reload
 *      per genuine rotation; frozen-tab guard on return-to-visible.
 *   4. Rotation triggers: 25s all-hidden timer, >=5min resume boundary.
 *   5. Update discovery: reg.update() on visible / online / hourly-visible.
 *   6. Unregisters in dev.
 *
 * jsdom; we stub navigator.serviceWorker, window.location, visibilityState.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const FLUSH_MS = 600;
const HIDDEN_MS = 25_000;
const RESUME_MIN_MS = 300_000;
const HOURLY_MS = 3_600_000;

type Listeners = Record<string, ((event: any) => void)[]>;

let reloadMock: ReturnType<typeof vi.fn>;
let visibility = 'visible';

function makeWorker() {
  return { postMessage: vi.fn(), state: 'installed', addEventListener: vi.fn() };
}

function installEnv(opts: {
  hostname?: string;
  controller?: object | null;
  waiting?: ReturnType<typeof makeWorker> | null;
} = {}) {
  const regListeners: Listeners = {};
  const containerListeners: Listeners = {};
  const reg = {
    active: makeWorker(),
    waiting: opts.waiting ?? null,
    installing: null as ReturnType<typeof makeWorker> | null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: (t: string, h: any) => {
      (regListeners[t] ||= []).push(h);
    },
  };
  const container: any = {
    controller: opts.controller === undefined ? {} : opts.controller,
    register: vi.fn().mockResolvedValue(reg),
    getRegistration: vi.fn().mockResolvedValue(reg),
    getRegistrations: vi.fn().mockResolvedValue([]),
    ready: Promise.resolve(reg),
    addEventListener: (t: string, h: any) => {
      (containerListeners[t] ||= []).push(h);
    },
    removeEventListener: () => {},
  };
  Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: container });

  reloadMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname: opts.hostname ?? 'resiliencetoolkit.org', reload: reloadMock },
  });

  const fire = {
    controllerchange: () => (containerListeners.controllerchange || []).forEach((h) => h({})),
    message: (data: any, source: any) =>
      (containerListeners.message || []).forEach((h) => h({ data, source })),
    updatefound: () => (regListeners.updatefound || []).forEach((h) => h({})),
    setVisibility: (v: string) => {
      visibility = v;
      document.dispatchEvent(new Event('visibilitychange'));
    },
  };
  return { reg, container, fire };
}

async function flushMicrotasks(times = 6) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

async function boot(opts?: Parameters<typeof installEnv>[0]) {
  const env = installEnv(opts);
  const mod = await import('../../src/lib/sw-register');
  mod.registerServiceWorker();
  await flushMicrotasks();
  return { ...env, mod };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  document.documentElement.removeAttribute('data-rt-sw-update-ready');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sw-register — registration + dev mode', () => {
  it('registers /sw.js with updateViaCache: "none"', async () => {
    const { container } = await boot();
    expect(container.register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
  });

  it('dev mode: unregisters existing workers and does NOT register a new one', async () => {
    const env = installEnv({ hostname: 'localhost' });
    const unregister = vi.fn().mockResolvedValue(true);
    env.container.getRegistrations.mockResolvedValueOnce([{ unregister }]);
    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();
    await flushMicrotasks();
    expect(unregister).toHaveBeenCalled();
    expect(env.container.register).not.toHaveBeenCalled();
  });

  it('treats 127.0.0.1 as dev', async () => {
    const env = installEnv({ hostname: '127.0.0.1' });
    const { registerServiceWorker } = await import('../../src/lib/sw-register');
    registerServiceWorker();
    await flushMicrotasks();
    expect(env.container.register).not.toHaveBeenCalled();
  });
});

describe('sw-register — reload discipline', () => {
  it('controllerchange with NO prior controller (first install) does not reload', async () => {
    const { fire } = await boot({ controller: null });
    fire.controllerchange();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('controllerchange on a controlled page: flush event + blur, exactly one reload after the flush wait', async () => {
    const { fire } = await boot();
    const flushSpy = vi.fn();
    document.addEventListener('rt:flush-pending-writes', flushSpy);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    fire.controllerchange();
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(textarea);
    expect(reloadMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(reloadMock).toHaveBeenCalledTimes(1);

    fire.controllerchange();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    textarea.remove();
  });

  it('frozen-tab guard: reloads once on return-to-visible when the controller changed silently', async () => {
    const controllerAtLoad = {};
    const { container, fire } = await boot({ controller: controllerAtLoad });
    container.controller = {}; // identity changed while hidden/frozen
    fire.setVisibility('hidden');
    fire.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    fire.setVisibility('hidden');
    fire.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});

describe('sw-register — warm pipeline + announce', () => {
  it('posts PRECACHE_WARM to a waiting worker present at load', async () => {
    const waiting = makeWorker();
    const { } = await boot({ waiting });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'PRECACHE_WARM' });
  });

  it('announces SW_UPDATE_READY_EVENT + dataset flag only on PRECACHE_READY from reg.waiting', async () => {
    const waiting = makeWorker();
    const { fire, mod } = await boot({ waiting });
    const readySpy = vi.fn();
    document.addEventListener(mod.SW_UPDATE_READY_EVENT, readySpy);

    fire.message({ type: 'PRECACHE_READY', version: 'v-build-X' }, makeWorker());
    expect(readySpy).not.toHaveBeenCalled();

    fire.message({ type: 'PRECACHE_READY', version: 'v-build-X' }, waiting);
    expect(readySpy).toHaveBeenCalledTimes(1);
    expect(readySpy.mock.calls[0][0].detail).toEqual({ version: 'v-build-X' });
    expect(document.documentElement.dataset.rtSwUpdateReady).toBe('v-build-X');
  });

  it('updatefound resets readiness and re-warms when the new worker reaches installed', async () => {
    const waiting = makeWorker();
    const { reg, fire } = await boot({ waiting });
    fire.message({ type: 'PRECACHE_READY', version: 'v1' }, waiting);
    expect(document.documentElement.dataset.rtSwUpdateReady).toBe('v1');

    const next = makeWorker();
    next.state = 'installing';
    reg.installing = next;
    fire.updatefound();
    expect(document.documentElement.dataset.rtSwUpdateReady).toBeUndefined();

    const newWaiting = makeWorker();
    reg.waiting = newWaiting;
    next.state = 'installed';
    const statechange = next.addEventListener.mock.calls.find((c: any[]) => c[0] === 'statechange')?.[1];
    statechange?.();
    expect(newWaiting.postMessage).toHaveBeenCalledWith({ type: 'PRECACHE_WARM' });
  });
});

describe('sw-register — top-up contract + update discovery', () => {
  it("posts bare 'PRECACHE_TOPUP' to the active worker on ready and again on 'online'", async () => {
    const { reg } = await boot();
    expect(reg.active.postMessage).toHaveBeenCalledWith('PRECACHE_TOPUP');
    reg.active.postMessage.mockClear();
    window.dispatchEvent(new Event('online'));
    expect(reg.active.postMessage).toHaveBeenCalledWith('PRECACHE_TOPUP');
  });

  it("calls reg.update() on visibilitychange->visible, on 'online', and hourly while visible", async () => {
    const { reg, fire } = await boot();
    const base = reg.update.mock.calls.length;
    fire.setVisibility('hidden');
    fire.setVisibility('visible');
    expect(reg.update.mock.calls.length).toBe(base + 1);
    window.dispatchEvent(new Event('online'));
    expect(reg.update.mock.calls.length).toBe(base + 2);
    await vi.advanceTimersByTimeAsync(HOURLY_MS + 1000);
    expect(reg.update.mock.calls.length).toBeGreaterThanOrEqual(base + 3);
  });
});

describe('sw-register — idle + resume rotation', () => {
  async function bootReady() {
    const waiting = makeWorker();
    const env = await boot({ waiting });
    env.fire.message({ type: 'PRECACHE_READY', version: 'v1' }, waiting);
    waiting.postMessage.mockClear();
    return { ...env, waiting };
  }

  it('hidden: dispatches flush, then posts SKIP_WAITING_WHEN_HIDDEN after 25s if still hidden', async () => {
    const { fire, waiting } = await bootReady();
    const flushSpy = vi.fn();
    document.addEventListener('rt:flush-pending-writes', flushSpy);
    fire.setVisibility('hidden');
    // Prior boots in this file left their own visibilitychange listeners on
    // the shared jsdom document, so assert the flush fired, not an exact count.
    expect(flushSpy).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(HIDDEN_MS + 500);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
  });

  it('hidden timer cancelled when the page returns to visible before it fires', async () => {
    const { fire, waiting } = await bootReady();
    fire.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(HIDDEN_MS / 2);
    fire.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(HIDDEN_MS * 2);
    expect(waiting.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
  });

  it('no idle rotation before READY (worker not verified complete)', async () => {
    const waiting = makeWorker();
    const { fire } = await boot({ waiting });
    waiting.postMessage.mockClear();
    fire.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(HIDDEN_MS + 500);
    expect(waiting.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
  });

  it('resume boundary: posts plain SKIP_WAITING when visible after >=5min hidden', async () => {
    const { fire, waiting } = await bootReady();
    fire.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(RESUME_MIN_MS + 1000);
    fire.setVisibility('visible');
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('short app-switch (<5min) does not rotate; re-warms instead', async () => {
    const { fire, waiting } = await bootReady();
    fire.setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(30_000);
    fire.setVisibility('visible');
    expect(waiting.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'PRECACHE_WARM' });
  });
});

describe('sw-register — applyUpdate', () => {
  it('flushes, blurs, waits, then posts SKIP_WAITING to the waiting worker', async () => {
    const waiting = makeWorker();
    const { mod } = await boot({ waiting });
    waiting.postMessage.mockClear();
    const flushSpy = vi.fn();
    document.addEventListener('rt:flush-pending-writes', flushSpy);

    mod.applyUpdate();
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('no-op when nothing is waiting', async () => {
    const { mod, reg } = await boot({ waiting: null });
    mod.applyUpdate();
    await vi.advanceTimersByTimeAsync(FLUSH_MS + 50);
    expect(reg.active.postMessage).not.toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
