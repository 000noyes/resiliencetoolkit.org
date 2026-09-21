/**
 * Arrival-counting unit suite.
 *
 * Covers the four classification outcomes, what a counted arrival is and is
 * not (a 304 for a page counts, a saved-copy check counts), the privacy
 * guarantee asserted as an absence, the missing-binding 404, and the rule
 * that the report never emits a combined total.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ARRIVAL_LABELS,
  ARRIVAL_CAVEAT,
  PATH_MAX,
  SAVED_COPY_HEADER,
  SAVED_COPY_VALUE,
  arrivalPath,
  classifyArrival,
  handleArrivalsReport,
  recordArrival,
} from '../../functions/lib/arrival-counting';
import { FakeArrivalsD1 } from './fake-arrivals-d1';

const ORIGIN = 'https://resiliencetoolkit.org';
const KEY = 'a-long-enough-report-key';

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
};

// What the worker's saved-copy check looks like on the wire: a fetch from
// the worker, not a navigation, carrying the constant marker header.
const SAVED_COPY_HEADERS = {
  'user-agent': BROWSER_HEADERS['user-agent'],
  accept: '*/*',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'if-none-match': 'W/"0123456789abcdef"',
  [SAVED_COPY_HEADER]: SAVED_COPY_VALUE,
};

function pageRequest(
  path = '/',
  headers: Record<string, string> = BROWSER_HEADERS,
  method = 'GET'
): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers });
}

function htmlResponse(status = 200): Response {
  return new Response(status === 304 ? null : '<!doctype html><title>page</title>', {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

async function json(res: Response): Promise<any> {
  return JSON.parse(await res.text());
}

let db: FakeArrivalsD1;

beforeEach(() => {
  db = new FakeArrivalsD1();
});

describe('classification', () => {
  it('labels a declared crawler as declared-agent', () => {
    const headers = new Headers({
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    expect(classifyArrival(headers)).toBe('declared-agent');
  });

  it('labels a declared AI fetcher as declared-agent', () => {
    const headers = new Headers({
      'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1',
    });
    expect(classifyArrival(headers)).toBe('declared-agent');
  });

  it('labels a declared agent as declared-agent even when it sends browser headers', () => {
    const headers = new Headers({ ...BROWSER_HEADERS, 'user-agent': 'ClaudeBot/1.0' });
    expect(classifyArrival(headers)).toBe('declared-agent');
  });

  it('labels a browser-shaped navigation as likely-browser', () => {
    expect(classifyArrival(new Headers(BROWSER_HEADERS))).toBe('likely-browser');
  });

  it('labels a bare request with neither signal as unknown', () => {
    expect(classifyArrival(new Headers())).toBe('unknown');
  });

  it('labels a browser user agent without Sec-Fetch headers as unknown, not as a browser', () => {
    const headers = new Headers({
      'user-agent': BROWSER_HEADERS['user-agent'],
      accept: BROWSER_HEADERS.accept,
    });
    expect(classifyArrival(headers)).toBe('unknown');
  });

  it('does not mistake an ordinary Android user agent for an agent', () => {
    const headers = new Headers({
      ...BROWSER_HEADERS,
      'user-agent':
        'Mozilla/5.0 (Linux; Android 13; Cubot Note 30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    });
    expect(classifyArrival(headers)).toBe('likely-browser');
  });

  it('labels a subresource fetch from a real browser as unknown, since it is not a navigation', () => {
    const headers = new Headers({
      ...BROWSER_HEADERS,
      'sec-fetch-dest': 'image',
      'sec-fetch-mode': 'no-cors',
    });
    expect(classifyArrival(headers)).toBe('unknown');
  });

  it('labels the saved-copy check as cached-browser, though it is not a navigation', () => {
    expect(classifyArrival(new Headers(SAVED_COPY_HEADERS))).toBe('cached-browser');
  });

  it('labels the marker before the navigation shape, so a marked navigation is cached-browser', () => {
    const headers = new Headers({ ...BROWSER_HEADERS, [SAVED_COPY_HEADER]: SAVED_COPY_VALUE });
    expect(classifyArrival(headers)).toBe('cached-browser');
  });

  it('needs the exact marker value, not just the header', () => {
    const headers = new Headers({ ...SAVED_COPY_HEADERS, [SAVED_COPY_HEADER]: 'yes' });
    expect(classifyArrival(headers)).toBe('unknown');
  });

  it('keeps a declared agent as declared-agent even when it sends the marker', () => {
    const headers = new Headers({ ...SAVED_COPY_HEADERS, 'user-agent': 'ClaudeBot/1.0' });
    expect(classifyArrival(headers)).toBe('declared-agent');
  });
});

describe('what counts as an arrival', () => {
  it('records a GET that served a 200 HTML page', async () => {
    await recordArrival(db, pageRequest('/modules/'), htmlResponse());
    expect(db.arrivals).toHaveLength(1);
    expect(db.arrivals[0].path).toBe('/modules/');
    expect(db.arrivals[0].label).toBe('likely-browser');
  });

  it('records nothing when there is no database binding', () => {
    expect(recordArrival(undefined, pageRequest(), htmlResponse())).toBeNull();
  });

  it('records nothing for a non-HTML response', async () => {
    const asset = new Response('body{}', {
      status: 200,
      headers: { 'content-type': 'text/css' },
    });
    expect(recordArrival(db, pageRequest('/styles.css'), asset)).toBeNull();
    expect(db.arrivals).toHaveLength(0);
  });

  it('records nothing for a page that was not found', async () => {
    expect(recordArrival(db, pageRequest('/gone/'), htmlResponse(404))).toBeNull();
    expect(db.arrivals).toHaveLength(0);
  });

  it('records a 304 for a page: the reader arrived, the copy they held was current', async () => {
    const headers = { ...BROWSER_HEADERS, 'if-none-match': 'W/"0123456789abcdef"' };
    await recordArrival(db, pageRequest('/modules/', headers), htmlResponse(304));
    expect(db.arrivals).toHaveLength(1);
    expect(db.arrivals[0].path).toBe('/modules/');
    expect(db.arrivals[0].label).toBe('likely-browser');
  });

  it('records nothing for a 304 that is not a page', async () => {
    const asset = new Response(null, { status: 304, headers: { 'content-type': 'text/css' } });
    expect(recordArrival(db, pageRequest('/styles.css'), asset)).toBeNull();
    const bare = new Response(null, { status: 304 });
    expect(recordArrival(db, pageRequest('/styles.css'), bare)).toBeNull();
    expect(db.arrivals).toHaveLength(0);
  });

  it('records the saved-copy check under cached-browser with the path, on a 304 and on a 200', async () => {
    await recordArrival(db, pageRequest('/modules/1-1/', SAVED_COPY_HEADERS), htmlResponse(304));
    await recordArrival(db, pageRequest('/map/', SAVED_COPY_HEADERS), htmlResponse(200));
    expect(db.arrivals.map((row) => [row.path, row.label])).toEqual([
      ['/modules/1-1/', 'cached-browser'],
      ['/map/', 'cached-browser'],
    ]);
  });

  it("records a crawler's conditional 304 under its own label", async () => {
    const headers = {
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'if-none-match': 'W/"0123456789abcdef"',
    };
    await recordArrival(db, pageRequest('/modules/', headers), htmlResponse(304));
    expect(db.arrivals[0].label).toBe('declared-agent');
  });

  it('records nothing for a non-GET request', async () => {
    const headers = { ...BROWSER_HEADERS };
    expect(recordArrival(db, pageRequest('/', headers, 'POST'), htmlResponse())).toBeNull();
    expect(db.arrivals).toHaveLength(0);
  });

  it('records nothing for a browser prefetch, because nobody arrived', async () => {
    const headers = { ...BROWSER_HEADERS, 'sec-purpose': 'prefetch;anonymous-client-ip' };
    expect(recordArrival(db, pageRequest('/modules/', headers), htmlResponse())).toBeNull();
    expect(db.arrivals).toHaveLength(0);
  });

  it('records nothing for the API surface', async () => {
    expect(recordArrival(db, pageRequest('/api/arrivals'), htmlResponse())).toBeNull();
    expect(db.arrivals).toHaveLength(0);
  });

  it('never rejects when the write fails, so delivery is never affected', async () => {
    db.failNextWrite = true;
    let threw = false;
    try {
      const write = recordArrival(db, pageRequest('/'), htmlResponse());
      if (write) await write;
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

describe('the path that is stored', () => {
  it('drops the query string, so it can never reach the database', async () => {
    await recordArrival(db, pageRequest('/map/?who=someone&ref=elsewhere'), htmlResponse());
    expect(db.arrivals[0].path).toBe('/map/');
  });

  it('refuses an absurdly long path', () => {
    expect(arrivalPath(`${ORIGIN}/${'x'.repeat(PATH_MAX + 1)}`)).toBeNull();
  });
});

describe('the privacy guarantee, asserted as an absence', () => {
  it('stores the label and nothing that identifies anyone', async () => {
    const headers = {
      ...BROWSER_HEADERS,
      referer: 'https://search.example/results?q=flood+prep',
      'cf-connecting-ip': '203.0.113.7',
      cookie: 'session=abc123',
    };
    await recordArrival(db, pageRequest('/modules/', headers), htmlResponse());

    const row = db.arrivals[0];
    expect(Object.keys(row).sort()).toEqual(['created_at', 'id', 'label', 'path']);

    const stored = JSON.stringify(row);
    expect(stored).not.toContain('Mozilla');
    expect(stored).not.toContain('Safari');
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('search.example');
    expect(stored).not.toContain('abc123');
  });

  it('reads the marker and the validator of a saved-copy check and stores neither', async () => {
    const headers = {
      ...SAVED_COPY_HEADERS,
      'cf-connecting-ip': '203.0.113.7',
      cookie: 'session=abc123',
    };
    await recordArrival(db, pageRequest('/modules/', headers), htmlResponse(304));

    const row = db.arrivals[0];
    expect(Object.keys(row).sort()).toEqual(['created_at', 'id', 'label', 'path']);
    expect(row.label).toBe('cached-browser');

    const stored = JSON.stringify(row);
    expect(stored).not.toContain(SAVED_COPY_HEADER);
    expect(stored).not.toContain('0123456789abcdef');
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('abc123');
  });

  it('the marker is one constant with nothing per reader in it', () => {
    expect(SAVED_COPY_HEADER).toMatch(/^[a-z0-9-]+$/);
    expect(SAVED_COPY_VALUE).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('the report', () => {
  function reportRequest(query = ''): Request {
    return new Request(`${ORIGIN}/api/arrivals?key=${encodeURIComponent(KEY)}${query}`);
  }

  function seedMix(): void {
    // Deliberately distinct counts so no legitimate figure can coincide with
    // the grand total of fourteen.
    for (let i = 0; i < 5; i++) db.seed({ path: '/', label: 'likely-browser' });
    for (let i = 0; i < 4; i++) db.seed({ path: '/', label: 'cached-browser' });
    for (let i = 0; i < 3; i++) db.seed({ path: '/map/', label: 'declared-agent' });
    for (let i = 0; i < 2; i++) db.seed({ path: '/map/', label: 'unknown' });
  }

  it('404s without a database binding', async () => {
    const res = await handleArrivalsReport(undefined, KEY, reportRequest());
    expect(res.status).toBe(404);
    expect((await json(res)).ok).toBe(false);
  });

  it('404s without a key binding, so counts are never published by accident', async () => {
    const res = await handleArrivalsReport(db, undefined, reportRequest());
    expect(res.status).toBe(404);
  });

  it('404s on a wrong or missing key, indistinguishably from any unknown path', async () => {
    expect((await handleArrivalsReport(db, KEY, new Request(`${ORIGIN}/api/arrivals`))).status).toBe(404);
    expect(
      (await handleArrivalsReport(db, KEY, new Request(`${ORIGIN}/api/arrivals?key=wrong`))).status
    ).toBe(404);
  });

  it('reports the four labels separately', async () => {
    seedMix();
    const body = await json(await handleArrivalsReport(db, KEY, reportRequest()));
    expect(body.ok).toBe(true);
    expect(body.by_label).toEqual({
      'likely-browser': 5,
      'cached-browser': 4,
      'declared-agent': 3,
      unknown: 2,
    });
  });

  it('groups by path and by day without collapsing the labels', async () => {
    seedMix();
    const body = await json(await handleArrivalsReport(db, KEY, reportRequest()));

    const map = body.by_path.find((row: any) => row.path === '/map/');
    expect(map).toEqual({
      path: '/map/',
      'likely-browser': 0,
      'cached-browser': 0,
      'declared-agent': 3,
      unknown: 2,
    });

    expect(body.by_day).toHaveLength(1);
    expect(body.by_day[0]).toEqual({
      day: new Date().toISOString().slice(0, 10),
      'likely-browser': 5,
      'cached-browser': 4,
      'declared-agent': 3,
      unknown: 2,
    });
  });

  it('never emits a combined total', async () => {
    seedMix();
    const res = await handleArrivalsReport(db, KEY, reportRequest());
    const body = await json(res);

    const keys: string[] = [];
    const numbers: number[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'number') numbers.push(value);
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          keys.push(key);
          walk(inner);
        }
      }
    };
    walk(body);

    expect(keys.some((key) => /total|visits|visitors|sum|all/i.test(key))).toBe(false);
    expect(numbers).not.toContain(14);
    // The two browser labels are never pre-summed either.
    expect(numbers).not.toContain(9);

    for (const row of [...body.by_path, ...body.by_day]) {
      const labelKeys = Object.keys(row).filter((key) => key !== 'path' && key !== 'day');
      expect(labelKeys.sort()).toEqual([...ARRIVAL_LABELS].sort());
    }
  });

  it('carries the limit in the output, so no number can be quoted without it', async () => {
    seedMix();
    const body = await json(await handleArrivalsReport(db, KEY, reportRequest()));
    expect(body.caveat).toBe(ARRIVAL_CAVEAT);
    expect(body.caveat).toContain('does not mean a person');
    expect(body.caveat).toContain('cached-browser');
  });

  it('honours an explicit window and rejects a malformed one', async () => {
    db.seed({ path: '/', label: 'likely-browser', created_at: '2026-01-15T10:00:00.000Z' });
    db.seed({ path: '/', label: 'likely-browser', created_at: '2026-03-15T10:00:00.000Z' });

    const january = await json(
      await handleArrivalsReport(db, KEY, reportRequest('&since=2026-01-01&until=2026-01-31'))
    );
    expect(january.window).toEqual({ since: '2026-01-01', until: '2026-01-31' });
    expect(january.by_label['likely-browser']).toBe(1);

    const bad = await handleArrivalsReport(db, KEY, reportRequest('&since=january'));
    expect(bad.status).toBe(400);

    const backwards = await handleArrivalsReport(
      db,
      KEY,
      reportRequest('&since=2026-03-01&until=2026-01-01')
    );
    expect(backwards.status).toBe(400);
  });

  it('says whether the table accepts every label, so a pending migration is not read as zero visits', async () => {
    let body = await json(await handleArrivalsReport(db, KEY, reportRequest()));
    expect(body.schema).toEqual({ accepts_every_label: true });

    db.acceptedLabels = ['likely-browser', 'declared-agent', 'unknown'];
    body = await json(await handleArrivalsReport(db, KEY, reportRequest()));
    expect(body.schema).toEqual({ accepts_every_label: false });
  });

  it('answers with no-store JSON that search engines are told not to index', async () => {
    const res = await handleArrivalsReport(db, KEY, reportRequest());
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });
});
