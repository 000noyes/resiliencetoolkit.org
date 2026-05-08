/**
 * Service Worker behavior tests
 *
 * Loads public/sw.js into a sandbox with mocked SW globals and exercises
 * each event handler. Keeps the iron-rule D2 regression suite (no auto
 * skipWaiting in install) and validates D7 fetch-handler behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swSrc = readFileSync(join(__dirname, '../../public/sw.js'), 'utf-8');

type Listener = (event: any) => void;

interface SWSandbox {
  listeners: Record<string, Listener[]>;
  caches: {
    open: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
  };
  cacheStore: { add: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
  fetchMock: ReturnType<typeof vi.fn>;
  skipWaitingCalls: number;
  clientsClaimCalls: number;
}

function createSandbox(): { sandbox: SWSandbox; context: any } {
  const listeners: Record<string, Listener[]> = {};
  const cacheStore = {
    add: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cacheStore),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const fetchMock = vi.fn();

  const sandbox: SWSandbox = {
    listeners,
    caches,
    cacheStore,
    fetchMock,
    skipWaitingCalls: 0,
    clientsClaimCalls: 0,
  };

  const self = {
    addEventListener: (type: string, handler: Listener) => {
      (listeners[type] ||= []).push(handler);
    },
    skipWaiting: () => {
      sandbox.skipWaitingCalls += 1;
    },
    clients: {
      claim: () => {
        sandbox.clientsClaimCalls += 1;
        return Promise.resolve();
      },
    },
  };

  const context: any = {
    self,
    caches,
    fetch: fetchMock,
    Response: class FakeResponse {
      ok: boolean;
      redirected: boolean;
      status: number;
      body: any;
      constructor(body: any, init?: { status?: number; redirected?: boolean }) {
        this.body = body;
        this.status = init?.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.redirected = init?.redirected ?? false;
      }
      clone() {
        return new (this.constructor as any)(this.body, {
          status: this.status,
          redirected: this.redirected,
        });
      }
    },
    URL,
    location: { origin: 'https://resiliencetoolkit.org' },
    console: { warn: () => {}, log: () => {}, error: () => {} },
  };
  vm.createContext(context);
  vm.runInContext(swSrc, context);
  return { sandbox, context };
}

function makeExtendableEvent() {
  let waitPromise: Promise<unknown> = Promise.resolve();
  return {
    waitUntil(p: Promise<unknown>) {
      waitPromise = p;
    },
    get _waitPromise() {
      return waitPromise;
    },
  };
}

function makeFetchEvent(req: { url: string; method?: string; mode?: string; destination?: string }) {
  let respondPromise: Promise<any> | undefined;
  return {
    request: {
      url: req.url,
      method: req.method ?? 'GET',
      mode: req.mode ?? 'no-cors',
      destination: req.destination ?? '',
    },
    respondWith(p: Promise<any>) {
      respondPromise = p;
    },
    get _responded() {
      return respondPromise !== undefined;
    },
    get _response() {
      return respondPromise;
    },
  };
}

describe('sw.js — D2 regression (IRON RULE: install must not auto-skipWaiting)', () => {
  it('install handler does NOT call self.skipWaiting()', async () => {
    const { sandbox, context } = createSandbox();
    const event = makeExtendableEvent();
    sandbox.listeners.install[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('SKIP_WAITING message handler still triggers skipWaiting', () => {
    const { sandbox } = createSandbox();
    sandbox.listeners.message[0]({ data: { type: 'SKIP_WAITING' } });
    expect(sandbox.skipWaitingCalls).toBe(1);
  });

  it('activate handler deletes old caches and claims clients', async () => {
    const { sandbox } = createSandbox();
    sandbox.caches.keys.mockResolvedValueOnce(['resilience-hub-v-old', 'resilience-hub-v-build-PENDING', 'unrelated']);
    const event = makeExtendableEvent();
    sandbox.listeners.activate[0](event);
    await event._waitPromise;
    // Deletes everything that isn't the current CACHE_NAME (PENDING is current at test time)
    expect(sandbox.caches.delete).toHaveBeenCalledWith('resilience-hub-v-old');
    expect(sandbox.caches.delete).toHaveBeenCalledWith('unrelated');
    expect(sandbox.caches.delete).not.toHaveBeenCalledWith('resilience-hub-v-build-PENDING');
    expect(sandbox.clientsClaimCalls).toBe(1);
  });

  it('non-SKIP_WAITING messages do not trigger skipWaiting', () => {
    const { sandbox } = createSandbox();
    sandbox.listeners.message[0]({ data: { type: 'OTHER_THING' } });
    sandbox.listeners.message[0]({ data: undefined });
    expect(sandbox.skipWaitingCalls).toBe(0);
  });
});

describe('sw.js — D7 install: essential vs nice-to-have asset partition', () => {
  it('install rejects when an ESSENTIAL asset fails to cache', async () => {
    const { sandbox } = createSandbox();
    sandbox.cacheStore.add.mockImplementation((url: string) => {
      if (url === '/') return Promise.reject(new Error('boom'));
      return Promise.resolve();
    });
    const event = makeExtendableEvent();
    sandbox.listeners.install[0](event);
    await expect(event._waitPromise).rejects.toThrow('boom');
  });

  it('install resolves when only nice-to-have assets fail (allSettled tolerance)', async () => {
    const { sandbox } = createSandbox();
    sandbox.cacheStore.add.mockImplementation((url: string) => {
      // Essential URLs succeed
      if (url === '/' || url === '/manifest.json' || url === '/RHT_orange.svg') return Promise.resolve();
      // Other assets reject
      return Promise.reject(new Error('nice-to-have failed'));
    });
    const event = makeExtendableEvent();
    sandbox.listeners.install[0](event);
    await expect(event._waitPromise).resolves.toBeDefined();
  });
});

describe('sw.js — D7 fetch handler', () => {
  it('does not call respondWith for non-GET requests', () => {
    const { sandbox } = createSandbox();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const event = makeFetchEvent({ url: 'https://resiliencetoolkit.org/api', method });
      sandbox.listeners.fetch[0](event);
      expect(event._responded).toBe(false);
    }
  });

  it('does not call respondWith for cross-origin requests', () => {
    const { sandbox } = createSandbox();
    const event = makeFetchEvent({ url: 'https://example.com/asset.png' });
    sandbox.listeners.fetch[0](event);
    expect(event._responded).toBe(false);
  });

  it('uses network-first for navigation requests', async () => {
    const { sandbox, context } = createSandbox();
    sandbox.fetchMock.mockResolvedValueOnce(
      new context.Response('<html>fresh</html>', { status: 200, redirected: false })
    );
    const event = makeFetchEvent({
      url: 'https://resiliencetoolkit.org/modules/1-1/',
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    expect(event._responded).toBe(true);
    const response = await event._response;
    expect(response.body).toBe('<html>fresh</html>');
    expect(sandbox.fetchMock).toHaveBeenCalledOnce();
  });

  it('falls back to cache when navigation network fails', async () => {
    const { sandbox, context } = createSandbox();
    sandbox.fetchMock.mockRejectedValueOnce(new Error('offline'));
    sandbox.caches.match.mockResolvedValueOnce(
      new context.Response('<html>cached</html>', { status: 200, redirected: false })
    );
    const event = makeFetchEvent({
      url: 'https://resiliencetoolkit.org/modules/1-1/',
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('<html>cached</html>');
  });

  it('does not write runtime cache for non-whitelisted destinations', async () => {
    const { sandbox, context } = createSandbox();
    sandbox.caches.match.mockResolvedValueOnce(undefined);
    sandbox.fetchMock.mockResolvedValueOnce(
      new context.Response('{}', { status: 200, redirected: false })
    );
    // 'fetch' destination = XHR/JSON, not in CACHEABLE_DESTINATIONS whitelist
    const event = makeFetchEvent({
      url: 'https://resiliencetoolkit.org/data.json',
      mode: 'no-cors',
      destination: 'fetch',
    });
    sandbox.listeners.fetch[0](event);
    await event._response;
    // Wait one microtask for the cache.open().then() chain
    await new Promise((r) => setTimeout(r, 0));
    expect(sandbox.cacheStore.put).not.toHaveBeenCalled();
  });

  it('writes runtime cache for whitelisted destinations on cache miss', async () => {
    const { sandbox, context } = createSandbox();
    sandbox.caches.match.mockResolvedValueOnce(undefined);
    sandbox.fetchMock.mockResolvedValueOnce(
      new context.Response('body{}', { status: 200, redirected: false })
    );
    const event = makeFetchEvent({
      url: 'https://resiliencetoolkit.org/_astro/x.css',
      mode: 'no-cors',
      destination: 'style',
    });
    sandbox.listeners.fetch[0](event);
    await event._response;
    await new Promise((r) => setTimeout(r, 0));
    expect(sandbox.cacheStore.put).toHaveBeenCalled();
  });

  it('does not cache redirected responses', async () => {
    const { sandbox, context } = createSandbox();
    sandbox.caches.match.mockResolvedValueOnce(undefined);
    sandbox.fetchMock.mockResolvedValueOnce(
      new context.Response('redir', { status: 200, redirected: true })
    );
    const event = makeFetchEvent({
      url: 'https://resiliencetoolkit.org/_astro/x.css',
      mode: 'no-cors',
      destination: 'style',
    });
    sandbox.listeners.fetch[0](event);
    await event._response;
    await new Promise((r) => setTimeout(r, 0));
    expect(sandbox.cacheStore.put).not.toHaveBeenCalled();
  });
});
