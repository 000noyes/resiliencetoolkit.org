/**
 * Service Worker behavior tests
 *
 * Loads public/sw.js into a sandbox with mocked SW globals and exercises
 * each event handler. Covers the update-propagation contract:
 *  - one-time legacy ramp (skipWaiting gated on legacy cache names + ramp marker)
 *  - completeness law (nothing rotates or prunes unless the precache is whole)
 *  - prune law (strictly-older only; assets-only retention; marker lifetime)
 *  - message protocol (SKIP_WAITING / SKIP_WAITING_WHEN_HIDDEN / PRECACHE_WARM /
 *    PRECACHE_TOPUP) with tolerance for legacy REGISTER_SYNC and unknown shapes
 * and the offline navigation contract:
 *  - essentials-only install (the full page list arrives via top-up)
 *  - navigation URL normalization (slashless links must hit slashed cache keys)
 *  - cache-first for precached pages, network-first outside the precache
 *  - the styled /offline/ page as the miss fallback, never a raw 503
 *  - D7 asset handling (cache-first with ignoreVary) unchanged.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swSrcRaw = readFileSync(join(__dirname, '../../public/sw.js'), 'utf-8');

const ORIGIN = 'https://resiliencetoolkit.org';
const CURRENT_CACHE = 'resilience-hub-v2-v-build-PENDING';
const RAMP_MARKER = 'resilience-hub-v2-ramp';
const SENTINEL = '/__rt-precache-complete__';

// Default injected precache list: three assets + three routes (routes end with /).
const DEFAULT_PRECACHE = [
  '/',
  '/offline/',
  '/manifest.json',
  '/RHT_orange.svg',
  '/_astro/a.css',
  '/modules/1-1/',
  '/dashboard/',
];

const ESSENTIALS = ['/', '/offline/', '/manifest.json', '/RHT_orange.svg'];

type Listener = (event: any) => void;

class FakeResponse {
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
    return new FakeResponse(this.body, { status: this.status, redirected: this.redirected });
  }
}

class FakeRequest {
  url: string;
  cache?: string;
  constructor(url: string, init?: { cache?: string }) {
    this.url = url.startsWith('http') ? url : ORIGIN + url;
    this.cache = init?.cache;
  }
}

interface AddRecord {
  path: string;
  cacheMode: string | undefined;
}

class FakeCache {
  entries = new Map<string, any>();
  addCalls: AddRecord[] = [];
  constructor(private sandbox: SWSandbox) {}
  // Keys keep the search string (real Cache entries are URL-keyed and
  // Cache.match does not ignore search) so query-carrying runtime writes are
  // representable.
  private keyOf(req: any): string {
    const url = typeof req === 'string' ? req : req.url;
    if (url.startsWith('http')) {
      const u = new URL(url);
      return u.pathname + u.search;
    }
    return url;
  }
  async add(req: any) {
    const key = this.keyOf(req);
    const cacheMode = typeof req === 'string' ? undefined : req.cache;
    this.addCalls.push({ path: key, cacheMode });
    if (this.sandbox.addFailures.has(key)) throw new Error(`add failed: ${key}`);
    this.entries.set(key, new FakeResponse(`cached:${key}`));
  }
  async put(req: any, response: any) {
    this.entries.set(this.keyOf(req), response);
  }
  async match(req: any) {
    return this.entries.get(this.keyOf(req));
  }
  async keys() {
    return [...this.entries.keys()].map((p) => ({ url: ORIGIN + p }));
  }
  async delete(req: any) {
    return this.entries.delete(this.keyOf(req));
  }
}

interface SWSandbox {
  listeners: Record<string, Listener[]>;
  stores: Map<string, FakeCache>;
  caches: any;
  fetchMock: ReturnType<typeof vi.fn>;
  addFailures: Set<string>;
  skipWaitingCalls: number;
  clientsClaimCalls: number;
  windowClients: Array<{ visibilityState?: string }>;
  deletedCaches: string[];
  matchAllCalls: any[];
}

function createSandbox(opts?: {
  precache?: string[];
  seedCaches?: Record<string, string[]>;
  /**
   * Realistic build stamp for tests exercising version ORDERING (prune /
   * bounded cleanup). The default PENDING placeholder has no timestamp, so
   * ordering comparisons fail safe (no deletion) — which would let ordering
   * tests pass vacuously.
   */
  cacheVersion?: string;
}): { sandbox: SWSandbox; context: any } {
  const precache = opts?.precache ?? DEFAULT_PRECACHE;
  let swSrc = swSrcRaw.replace(
    /\/\/ __PRECACHE_ASSETS_START__[\s\S]*?\/\/ __PRECACHE_ASSETS_END__/,
    `// __PRECACHE_ASSETS_START__\nconst PRECACHE_ASSETS = ${JSON.stringify(precache)};\n// __PRECACHE_ASSETS_END__`
  );
  if (opts?.cacheVersion) {
    swSrc = swSrc.replace(
      /const CACHE_VERSION = '[^']*';/,
      `const CACHE_VERSION = '${opts.cacheVersion}';`
    );
  }

  const listeners: Record<string, Listener[]> = {};
  const stores = new Map<string, FakeCache>();

  const sandbox: SWSandbox = {
    listeners,
    stores,
    caches: null,
    fetchMock: vi.fn(),
    addFailures: new Set(),
    skipWaitingCalls: 0,
    clientsClaimCalls: 0,
    windowClients: [],
    deletedCaches: [],
    matchAllCalls: [],
  };

  const openStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new FakeCache(sandbox));
    return stores.get(name)!;
  };

  const realGlobalMatch = async (req: any, _opts?: any) => {
    const path = typeof req === 'string'
      ? req
      : (req.url.startsWith('http') ? new URL(req.url).pathname : req.url);
    for (const store of stores.values()) {
      const hit = store.entries.get(path);
      if (hit) return hit;
    }
    return undefined;
  };

  const caches = {
    open: vi.fn(async (name: string) => openStore(name)),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => {
      sandbox.deletedCaches.push(name);
      return stores.delete(name);
    }),
    match: vi.fn(realGlobalMatch),
  };
  sandbox.caches = caches;

  for (const [name, paths] of Object.entries(opts?.seedCaches ?? {})) {
    const store = openStore(name);
    for (const p of paths) store.entries.set(p, new FakeResponse(`seed:${p}`));
  }

  const self = {
    addEventListener: (type: string, handler: Listener) => {
      (listeners[type] ||= []).push(handler);
    },
    skipWaiting: () => {
      sandbox.skipWaitingCalls += 1;
    },
    registration: { active: {} },
    clients: {
      claim: () => {
        sandbox.clientsClaimCalls += 1;
        return Promise.resolve();
      },
      matchAll: vi.fn(async (query: any) => {
        sandbox.matchAllCalls.push(query);
        return sandbox.windowClients;
      }),
    },
  };

  const context: any = {
    self,
    caches,
    fetch: sandbox.fetchMock,
    Response: FakeResponse,
    Request: FakeRequest,
    URL,
    location: { origin: ORIGIN },
    console: { warn: () => {}, log: () => {}, error: () => {} },
    setTimeout,
  };
  vm.createContext(context);
  vm.runInContext(swSrc, context);
  return { sandbox, context };
}

function makeExtendableEvent() {
  const waits: Promise<unknown>[] = [];
  return {
    waitUntil(p: Promise<unknown>) {
      waits.push(p);
    },
    get _waitPromise() {
      return Promise.all(waits);
    },
  };
}

function makeMessageEvent(data: any) {
  const waits: Promise<unknown>[] = [];
  const source = { postMessage: vi.fn() };
  return {
    data,
    source,
    waitUntil(p: Promise<unknown>) {
      waits.push(p);
    },
    get _waitPromise() {
      return Promise.all(waits);
    },
  };
}

function makeFetchEvent(req: { url: string; method?: string; mode?: string; destination?: string }) {
  let respondPromise: Promise<any> | undefined;
  const waits: Promise<unknown>[] = [];
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
    waitUntil(p: Promise<unknown>) {
      waits.push(p);
    },
    get _responded() {
      return respondPromise !== undefined;
    },
    get _response() {
      return respondPromise;
    },
    get _waitPromise() {
      return Promise.all(waits);
    },
  };
}

async function runInstall(sandbox: SWSandbox) {
  const event = makeExtendableEvent();
  sandbox.listeners.install[0](event);
  await event._waitPromise;
  return event;
}

async function runActivate(sandbox: SWSandbox) {
  const event = makeExtendableEvent();
  sandbox.listeners.activate[0](event);
  await event._waitPromise;
  return event;
}

/** Fill the current cache with every precache path so precacheComplete() is true. */
function fillCurrentComplete(
  sandbox: SWSandbox,
  precache: string[] = DEFAULT_PRECACHE,
  cacheName: string = CURRENT_CACHE
) {
  const store = sandbox.stores.get(cacheName) ?? new FakeCache(sandbox);
  sandbox.stores.set(cacheName, store);
  for (const p of precache) store.entries.set(p, new FakeResponse(`cached:${p}`));
  return store;
}

describe('sw.js — legacy ramp gate (one-time skipWaiting at install)', () => {
  it('does NOT skipWaiting on a fresh device (no legacy caches)', async () => {
    const { sandbox } = createSandbox();
    await runInstall(sandbox);
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('does NOT skipWaiting when only v2 caches exist', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v2-v-build-20260601000000000': ['/'] },
    });
    await runInstall(sandbox);
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('does NOT skipWaiting when the ramp marker exists despite legacy caches', async () => {
    const { sandbox } = createSandbox({
      seedCaches: {
        'resilience-hub-v-build-20260630103410142': ['/'],
        [RAMP_MARKER]: [],
      },
    });
    await runInstall(sandbox);
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('skipWaiting EXACTLY once when a legacy cache exists and no marker', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v-build-20260630103410142': ['/'] },
    });
    await runInstall(sandbox);
    expect(sandbox.skipWaitingCalls).toBe(1);
  });

  it('legacy predicate boundaries: only historical name shapes are legacy', async () => {
    for (const [name, isLegacy] of [
      ['resilience-hub-v-build-20260630103410142', true],
      ['resilience-hub-v25-minimal', true],
      ['resilience-hub-v2-ramp', false],
      [CURRENT_CACHE, false],
      // A future non-historical prefix must NOT re-arm the fleet-wide ramp.
      ['resilience-hub-data-store', false],
    ] as const) {
      const { sandbox } = createSandbox({ seedCaches: { [name]: name === RAMP_MARKER ? [] : ['/'] } });
      await runInstall(sandbox);
      expect(sandbox.skipWaitingCalls, name).toBe(isLegacy ? 1 : 0);
    }
  });
});

describe('sw.js — install fill (essentials only; the rest arrives via top-up)', () => {
  it('install caches only the essential shell', async () => {
    const { sandbox } = createSandbox();
    await runInstall(sandbox);
    const added = sandbox.stores.get(CURRENT_CACHE)!.addCalls.map((c) => c.path).sort();
    expect(added).toEqual([...ESSENTIALS].sort());
  });

  it('wraps non-/_astro/ URLs as Request with cache:no-cache; /_astro/ passed bare', async () => {
    const { sandbox } = createSandbox();
    await runInstall(sandbox);
    const calls = sandbox.stores.get(CURRENT_CACHE)!.addCalls;
    const manifest = calls.find((c) => c.path === '/manifest.json');
    expect(manifest?.cacheMode).toBe('no-cache');
    // The hashed asset arrives via top-up, not install; it must be passed
    // bare so the immutable HTTP cache stays a valid source for it.
    const event = makeMessageEvent('PRECACHE_TOPUP');
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    const astro = sandbox.stores.get(CURRENT_CACHE)!.addCalls.find((c) => c.path === '/_astro/a.css');
    expect(astro?.cacheMode).toBeUndefined();
  });

  it('rejects when an ESSENTIAL asset fails to cache', async () => {
    const { sandbox } = createSandbox();
    sandbox.addFailures.add('/');
    const event = makeExtendableEvent();
    sandbox.listeners.install[0](event);
    await expect(event._waitPromise).rejects.toThrow('add failed: /');
  });

  it('rejects when the offline fallback page fails to cache (it is essential)', async () => {
    const { sandbox } = createSandbox();
    sandbox.addFailures.add('/offline/');
    const event = makeExtendableEvent();
    sandbox.listeners.install[0](event);
    await expect(event._waitPromise).rejects.toThrow('add failed: /offline/');
  });

  it('resolves even when non-essential precache entries would fail (they are not fetched at install)', async () => {
    const { sandbox } = createSandbox();
    sandbox.addFailures.add('/modules/1-1/');
    const event = makeExtendableEvent();
    sandbox.listeners.install[0](event);
    await expect(event._waitPromise).resolves.toBeDefined();
  });
});

describe('sw.js — activate: claim, marker, completeness-gated prune', () => {
  it('claims clients', async () => {
    const { sandbox } = createSandbox();
    await runActivate(sandbox);
    expect(sandbox.clientsClaimCalls).toBe(1);
  });

  it('creates the ramp marker when legacy caches exist', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v-build-20260630103410142': ['/'] },
    });
    await runActivate(sandbox);
    expect([...sandbox.stores.keys()]).toContain(RAMP_MARKER);
  });

  it('does NOT prune when the precache is incomplete (never shrink offline)', async () => {
    const { sandbox } = createSandbox({
      seedCaches: {
        'resilience-hub-v-build-20260630103410142': ['/', '/modules/1-1/'],
        'resilience-hub-v2-v-build-20260101000000000': ['/'],
      },
    });
    await runActivate(sandbox);
    expect(sandbox.deletedCaches).toEqual([]);
    expect([...sandbox.stores.keys()]).toContain('resilience-hub-v-build-20260630103410142');
  });

  it('prunes when complete: deletes legacy + unrelated + strictly-older v2, retains newer v2', async () => {
    const own = 'v-build-20260301000000000';
    const { sandbox } = createSandbox({
      cacheVersion: own,
      seedCaches: {
        'resilience-hub-v25-minimal': ['/'],
        unrelated: ['/x'],
        'resilience-hub-v2-v-build-20260101000000000': ['/'],
        'resilience-hub-v2-v-build-20260201000000000': ['/', '/_astro/keep.js'],
        'resilience-hub-v2-v-build-99999999999999999': ['/'],
      },
    });
    fillCurrentComplete(sandbox, DEFAULT_PRECACHE, `resilience-hub-v2-${own}`);
    await runActivate(sandbox);
    expect(sandbox.deletedCaches).toContain('resilience-hub-v25-minimal');
    expect(sandbox.deletedCaches).toContain('unrelated');
    // Oldest strictly-older v2 is deleted; the NEWEST strictly-older build
    // becomes the assets-stripped skew shield instead.
    expect(sandbox.deletedCaches).toContain('resilience-hub-v2-v-build-20260101000000000');
    const shield = sandbox.stores.get('resilience-hub-v2-v-build-20260201000000000')!;
    expect([...shield.entries.keys()]).toEqual(['/_astro/keep.js']);
    // A NEWER v2 generation (a warming waiting worker's cache) survives whole.
    expect([...sandbox.stores.keys()]).toContain('resilience-hub-v2-v-build-99999999999999999');
    expect([...sandbox.stores.keys()]).toContain(`resilience-hub-v2-${own}`);
  });

  it('strips the newest previous BUILD cache to /_astro/* entries instead of deleting it', async () => {
    const older = 'resilience-hub-v-build-20260501000000000';
    const newest = 'resilience-hub-v-build-20260630103410142';
    const { sandbox } = createSandbox({
      seedCaches: {
        [older]: ['/', '/_astro/old.css'],
        [newest]: ['/', '/modules/1-1/', '/_astro/keep.js'],
      },
    });
    fillCurrentComplete(sandbox);
    await runActivate(sandbox);
    // Older build deleted whole; newest retained assets-only.
    expect(sandbox.deletedCaches).toContain(older);
    const kept = sandbox.stores.get(newest)!;
    expect([...kept.entries.keys()]).toEqual(['/_astro/keep.js']);
  });

  it('never treats a v28-style name as the retained build cache (regex guard)', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v28-minimal': ['/', '/_astro/x.js'] },
    });
    fillCurrentComplete(sandbox);
    await runActivate(sandbox);
    expect(sandbox.deletedCaches).toContain('resilience-hub-v28-minimal');
  });

  it('deletes the ramp marker only when no legacy-named cache survives the prune', async () => {
    // Case 1: stripped legacy build cache survives -> marker retained.
    const newest = 'resilience-hub-v-build-20260630103410142';
    const s1 = createSandbox({ seedCaches: { [newest]: ['/', '/_astro/keep.js'], [RAMP_MARKER]: [] } });
    fillCurrentComplete(s1.sandbox);
    await runActivate(s1.sandbox);
    expect([...s1.sandbox.stores.keys()]).toContain(RAMP_MARKER);
    // Case 2: only a non-build legacy cache existed -> deleted whole -> marker goes too.
    const s2 = createSandbox({ seedCaches: { 'resilience-hub-v25-minimal': ['/'], [RAMP_MARKER]: [] } });
    fillCurrentComplete(s2.sandbox);
    await runActivate(s2.sandbox);
    expect(s2.sandbox.deletedCaches).toContain(RAMP_MARKER);
  });

  it("activate's waitUntil settles without awaiting the detached fill", async () => {
    // Incomplete current cache: the detached topUpPrecache would fill it; the
    // waitUntil promise must resolve regardless (fetch events queue on it).
    const { sandbox } = createSandbox();
    const event = makeExtendableEvent();
    sandbox.listeners.activate[0](event);
    await expect(event._waitPromise).resolves.toBeDefined();
  });
});

describe('sw.js — topUpPrecache via messages', () => {
  it("bare-string 'PRECACHE_TOPUP' triggers a fill of missing entries (contract with pages)", async () => {
    const { sandbox } = createSandbox();
    const event = makeMessageEvent('PRECACHE_TOPUP');
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    const store = sandbox.stores.get(CURRENT_CACHE)!;
    for (const p of DEFAULT_PRECACHE) expect([...store.entries.keys()]).toContain(p);
  });

  it('writes the completeness sentinel only when the fill completes', async () => {
    const { sandbox } = createSandbox();
    const event = makeMessageEvent('PRECACHE_TOPUP');
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.stores.get(CURRENT_CACHE)!.entries.has(SENTINEL)).toBe(true);

    const failed = createSandbox();
    failed.sandbox.addFailures.add('/_astro/a.css');
    const ev2 = makeMessageEvent('PRECACHE_TOPUP');
    failed.sandbox.listeners.message[0](ev2);
    await ev2._waitPromise;
    expect(failed.sandbox.stores.get(CURRENT_CACHE)!.entries.has(SENTINEL)).toBe(false);
  });

  it('never fetches route HTML while any non-route asset is missing', async () => {
    const { sandbox } = createSandbox();
    sandbox.addFailures.add('/_astro/a.css');
    const event = makeMessageEvent('PRECACHE_TOPUP');
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    const calls = sandbox.stores.get(CURRENT_CACHE)!.addCalls.map((c) => c.path);
    expect(calls).not.toContain('/modules/1-1/');
  });

  it('query-carrying runtime cache entries never satisfy the completeness law', async () => {
    // A visit to /modules/1-1/?print=1 runtime-caches a query-keyed entry;
    // the plain route is still missing, so rotation must be refused (an
    // offline navigation to /modules/1-1/ would miss the query-keyed entry).
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.delete('/modules/1-1/');
    store.entries.set('/modules/1-1/?print=1', new FakeResponse('runtime'));
    const event = makeMessageEvent({ type: 'SKIP_WAITING' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('sentinel fast path: a verified-complete generation skips re-enumeration and re-fill', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v25-minimal': ['/'] },
    });
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    const event = makeMessageEvent('PRECACHE_TOPUP');
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(store.addCalls).toEqual([]);
    expect(sandbox.deletedCaches).toEqual([]);
  });

  it('empty PRECACHE_ASSETS fails safe: no sentinel, no prune', async () => {
    const { sandbox } = createSandbox({
      precache: [],
      seedCaches: { 'resilience-hub-v25-minimal': ['/'] },
    });
    const event = makeMessageEvent('PRECACHE_TOPUP');
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.deletedCaches).toEqual([]);
  });
});

describe('sw.js — message protocol: rotation gates', () => {
  it('SKIP_WAITING with complete precache -> skipWaiting', async () => {
    const { sandbox } = createSandbox();
    fillCurrentComplete(sandbox);
    const event = makeMessageEvent({ type: 'SKIP_WAITING' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(1);
  });

  it('SKIP_WAITING with incomplete precache -> refused; kicks a non-pruning top-up instead', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v25-minimal': ['/'] },
    });
    const event = makeMessageEvent({ type: 'SKIP_WAITING' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(0);
    // The refusal triggered a fill (top-up ran)...
    expect(sandbox.stores.get(CURRENT_CACHE)!.entries.has('/manifest.json')).toBe(true);
    // ...and that fill never prunes (prune:false), even though it completed.
    expect(sandbox.deletedCaches).toEqual([]);
  });

  it('SKIP_WAITING_WHEN_HIDDEN: all window clients hidden + complete -> skipWaiting', async () => {
    const { sandbox } = createSandbox();
    fillCurrentComplete(sandbox);
    sandbox.windowClients = [{ visibilityState: 'hidden' }, { visibilityState: 'hidden' }];
    const event = makeMessageEvent({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(1);
    expect(sandbox.matchAllCalls[0]).toEqual({ type: 'window', includeUncontrolled: true });
  });

  it('SKIP_WAITING_WHEN_HIDDEN: one visible client -> refused', async () => {
    const { sandbox } = createSandbox();
    fillCurrentComplete(sandbox);
    sandbox.windowClients = [{ visibilityState: 'hidden' }, { visibilityState: 'visible' }];
    const event = makeMessageEvent({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('SKIP_WAITING_WHEN_HIDDEN: missing visibilityState counts as not-hidden (degrades to tap-only)', async () => {
    const { sandbox } = createSandbox();
    fillCurrentComplete(sandbox);
    sandbox.windowClients = [{}];
    const event = makeMessageEvent({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('SKIP_WAITING_WHEN_HIDDEN: incomplete precache -> refused even when all hidden', async () => {
    const { sandbox } = createSandbox();
    sandbox.windowClients = [{ visibilityState: 'hidden' }];
    const event = makeMessageEvent({ type: 'SKIP_WAITING_WHEN_HIDDEN' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('PRECACHE_WARM fills without pruning and replies PRECACHE_READY to source when complete', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v25-minimal': ['/'] },
    });
    const event = makeMessageEvent({ type: 'PRECACHE_WARM' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(sandbox.deletedCaches).toEqual([]);
    expect(event.source.postMessage).toHaveBeenCalledWith({
      type: 'PRECACHE_READY',
      version: 'v-build-PENDING',
    });
  });

  it('PRECACHE_WARM does not reply when the fill is incomplete', async () => {
    const { sandbox } = createSandbox();
    sandbox.addFailures.add('/_astro/a.css');
    const event = makeMessageEvent({ type: 'PRECACHE_WARM' });
    sandbox.listeners.message[0](event);
    await event._waitPromise;
    expect(event.source.postMessage).not.toHaveBeenCalled();
  });

  it('tolerates REGISTER_SYNC, null, and unknown shapes: no throw, no skipWaiting', async () => {
    const { sandbox } = createSandbox();
    fillCurrentComplete(sandbox);
    for (const data of [{ type: 'REGISTER_SYNC' }, null, 42, { type: 'WAT' }, {}]) {
      const event = makeMessageEvent(data);
      expect(() => sandbox.listeners.message[0](event)).not.toThrow();
      await event._waitPromise;
    }
    expect(sandbox.skipWaitingCalls).toBe(0);
  });

  it('reserved types: worker source never posts SW_UPDATED or SYNC_DATA (live legacy listeners)', () => {
    expect(swSrcRaw).not.toMatch(/postMessage\([^)]*SW_UPDATED/);
    expect(swSrcRaw).not.toMatch(/postMessage\([^)]*SYNC_DATA/);
  });
});

describe('sw.js — first-fetch startup task', () => {
  it('runs exactly once per SW startup: ensures marker + kicks top-up when incomplete', async () => {
    const { sandbox } = createSandbox({
      seedCaches: { 'resilience-hub-v-build-20260630103410142': ['/'] },
    });
    const e1 = makeFetchEvent({ url: `${ORIGIN}/modules/1-1/`, mode: 'navigate', destination: 'document' });
    sandbox.fetchMock.mockResolvedValue(new FakeResponse('<html></html>'));
    sandbox.listeners.fetch[0](e1);
    await e1._waitPromise;
    expect([...sandbox.stores.keys()]).toContain(RAMP_MARKER);
    expect(sandbox.stores.get(CURRENT_CACHE)!.entries.has('/manifest.json')).toBe(true);

    const markerCreations = sandbox.caches.open.mock.calls.filter((c: any[]) => c[0] === RAMP_MARKER).length;
    const e2 = makeFetchEvent({ url: `${ORIGIN}/`, mode: 'navigate', destination: 'document' });
    sandbox.listeners.fetch[0](e2);
    await e2._waitPromise;
    expect(
      sandbox.caches.open.mock.calls.filter((c: any[]) => c[0] === RAMP_MARKER).length
    ).toBe(markerCreations);
  });

  it('bounded cleanup: deletes all but the newest sentinel-less stale v2 generation', async () => {
    // Devices where the fill never completes must not stack a generation per
    // deploy until quota eviction. The newest sentinel-less stale one (often
    // the assets-stripped skew shield) survives; older ones die. The current
    // generation is kept INCOMPLETE here so the normal prune law never runs
    // and the bounded cleanup is the only deleter.
    const older = 'resilience-hub-v2-v-build-20260101000000000';
    const newer = 'resilience-hub-v2-v-build-20260201000000000';
    const { sandbox } = createSandbox({
      cacheVersion: 'v-build-20260301000000000',
      seedCaches: { [older]: ['/'], [newer]: ['/_astro/keep.js'] },
    });
    sandbox.addFailures.add('/_astro/a.css');
    sandbox.fetchMock.mockResolvedValue(new FakeResponse('<html></html>'));
    const e1 = makeFetchEvent({ url: `${ORIGIN}/`, mode: 'navigate', destination: 'document' });
    sandbox.listeners.fetch[0](e1);
    await e1._waitPromise;
    expect(sandbox.deletedCaches).toContain(older);
    expect([...sandbox.stores.keys()]).toContain(newer);
  });
});

describe('sw.js — navigation handler (cache-first precache, offline fallback)', () => {
  it('does not call respondWith for non-GET requests', () => {
    const { sandbox } = createSandbox();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const event = makeFetchEvent({ url: `${ORIGIN}/api`, method });
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

  it('serves precached navigations cache-first, normalizing the missing trailing slash', async () => {
    // The cache holds only the built slashed route; the link-shaped request
    // has no trailing slash. This normalization is the fix for the field
    // failure where every sub-page died offline with a raw 503.
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/dashboard`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('cached:/dashboard/');
    expect(sandbox.fetchMock).not.toHaveBeenCalled();
  });

  it('treats the explicit /index.html form as the same precached route (cache-first)', async () => {
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/dashboard/index.html`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('cached:/dashboard/');
    expect(sandbox.fetchMock).not.toHaveBeenCalled();
  });

  it('serves a precached route cache-first at its slashed URL too', async () => {
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/modules/1-1/`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('cached:/modules/1-1/');
    expect(sandbox.fetchMock).not.toHaveBeenCalled();
  });

  it('a precached route missing from the cache falls through to the network', async () => {
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    store.entries.delete('/modules/1-1/');
    sandbox.fetchMock.mockResolvedValueOnce(new FakeResponse('<html>fresh</html>'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/modules/1-1/`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('<html>fresh</html>');
    // The precache fill owns this entry, so the network success is NOT
    // runtime-cached (a runtime put would bypass the revalidating fill).
    await new Promise((r) => setTimeout(r, 0));
    expect(store.entries.has('/modules/1-1/')).toBe(false);
  });

  it('uses network-first for navigations outside the precache and runtime-caches the response', async () => {
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    sandbox.fetchMock.mockResolvedValueOnce(new FakeResponse('<html>fresh</html>'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/changelog/`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    expect(event._responded).toBe(true);
    const response = await event._response;
    expect(response.body).toBe('<html>fresh</html>');
    expect(sandbox.fetchMock).toHaveBeenCalledOnce();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.entries.has('/changelog/')).toBe(true);
  });

  it('falls back to the runtime cache when a non-precached navigation fails', async () => {
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    store.entries.set('/changelog/', new FakeResponse('<html>runtime cached</html>'));
    sandbox.fetchMock.mockRejectedValue(new Error('offline'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/changelog/`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('<html>runtime cached</html>');
  });

  it('falls back to the offline page, not a raw 503, when an uncached navigation fails', async () => {
    const { sandbox } = createSandbox();
    const store = fillCurrentComplete(sandbox);
    store.entries.set(SENTINEL, new FakeResponse('complete'));
    sandbox.fetchMock.mockRejectedValue(new Error('offline'));
    const event = makeFetchEvent({
      url: `${ORIGIN}/changelog/`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('cached:/offline/');
    expect(response.status).toBe(200);
  });

  it('returns a 503 only when even the offline page is missing', async () => {
    const { sandbox } = createSandbox();
    sandbox.fetchMock.mockRejectedValue(new Error('offline'));
    // Every add fails so the concurrent startup top-up cannot fill /offline/.
    for (const p of DEFAULT_PRECACHE) sandbox.addFailures.add(p);
    const event = makeFetchEvent({
      url: `${ORIGIN}/changelog/`,
      mode: 'navigate',
      destination: 'document',
    });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.status).toBe(503);
  });
});

describe('sw.js — D7 asset handler (strategies unchanged)', () => {
  it('does not write runtime cache for non-whitelisted destinations', async () => {
    const { sandbox } = createSandbox();
    sandbox.fetchMock.mockResolvedValue(new FakeResponse('{}'));
    const event = makeFetchEvent({ url: `${ORIGIN}/data.json`, mode: 'no-cors', destination: 'fetch' });
    sandbox.listeners.fetch[0](event);
    await event._response;
    await new Promise((r) => setTimeout(r, 0));
    const store = sandbox.stores.get(CURRENT_CACHE);
    expect(store?.entries.has('/data.json') ?? false).toBe(false);
  });

  it('writes runtime cache for whitelisted destinations on cache miss', async () => {
    const { sandbox } = createSandbox();
    sandbox.fetchMock.mockResolvedValue(new FakeResponse('body{}'));
    const event = makeFetchEvent({ url: `${ORIGIN}/_astro/x.css`, mode: 'no-cors', destination: 'style' });
    sandbox.listeners.fetch[0](event);
    await event._response;
    await new Promise((r) => setTimeout(r, 0));
    expect(sandbox.stores.get(CURRENT_CACHE)!.entries.has('/_astro/x.css')).toBe(true);
  });

  it('matches the cache with ignoreVary so Vary headers cannot break offline serving', async () => {
    const { sandbox } = createSandbox();
    sandbox.caches.match.mockResolvedValueOnce(new FakeResponse('body{}'));
    const event = makeFetchEvent({ url: `${ORIGIN}/_astro/x.css`, mode: 'cors', destination: 'style' });
    sandbox.listeners.fetch[0](event);
    const response = await event._response;
    expect(response.body).toBe('body{}');
    expect(sandbox.fetchMock).not.toHaveBeenCalled();
    expect(sandbox.caches.match).toHaveBeenCalledWith(expect.anything(), { ignoreVary: true });
  });

  it('does not cache redirected responses', async () => {
    const { sandbox } = createSandbox();
    sandbox.fetchMock.mockResolvedValue(new FakeResponse('redir', { status: 200, redirected: true }));
    const event = makeFetchEvent({ url: `${ORIGIN}/_astro/x.css`, mode: 'no-cors', destination: 'style' });
    sandbox.listeners.fetch[0](event);
    await event._response;
    await new Promise((r) => setTimeout(r, 0));
    expect(sandbox.stores.get(CURRENT_CACHE)?.entries.has('/_astro/x.css') ?? false).toBe(false);
  });
});
