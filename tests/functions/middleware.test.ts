/**
 * Root middleware composition: the validator-stripped request goes to the
 * origin, the response gets its tag or becomes a 304, and the count sees the
 * response that was sent. The generated hash map is replaced by
 * page-hashes.stub.ts through the alias in vitest.config.ts; the pieces are
 * covered in page-etag.test.ts and arrival-counting.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { onRequest } from '../../functions/_middleware';
import { PAGE_HASHES as STUB } from './page-hashes.stub';
import { SAVED_COPY_HEADER, SAVED_COPY_VALUE } from '../../functions/lib/arrival-counting';
import { FakeArrivalsD1 } from './fake-arrivals-d1';

const ORIGIN = 'https://resiliencetoolkit.org';

function page(body = '<!doctype html><title>page</title>'): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

interface Fake {
  db: FakeArrivalsD1;
  nextCalls: Array<Request | undefined>;
  waits: Promise<unknown>[];
  run(request: Request, upstream?: Response): Promise<Response>;
}

function fakeContext(): Fake {
  const fake: Fake = {
    db: new FakeArrivalsD1(),
    nextCalls: [],
    waits: [],
    async run(request, upstream = page()) {
      const response = await onRequest({
        request,
        env: { ARRIVALS_DB: fake.db },
        next: async (forward?: Request) => {
          fake.nextCalls.push(forward);
          return upstream;
        },
        waitUntil: (p: Promise<unknown>) => {
          fake.waits.push(p);
        },
      });
      await Promise.all(fake.waits);
      return response;
    },
  };
  return fake;
}

let fake: Fake;

beforeEach(() => {
  fake = fakeContext();
});

describe('functions/_middleware.ts', () => {
  it('sends a known page to the origin without its validators and tags the response', async () => {
    const res = await fake.run(
      new Request(`${ORIGIN}/modules/1-1/`, { headers: { 'if-none-match': 'W/"stale"', accept: 'text/html' } })
    );
    expect(fake.nextCalls).toHaveLength(1);
    expect(fake.nextCalls[0]?.headers.get('if-none-match')).toBeNull();
    expect(fake.nextCalls[0]?.headers.get('accept')).toBe('text/html');
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe(`W/"${STUB['/modules/1-1/']}"`);
  });

  it('answers 304 to the saved-copy check and counts it as cached-browser', async () => {
    const res = await fake.run(
      new Request(`${ORIGIN}/modules/1-1/`, {
        headers: { 'if-none-match': 'W/"fedcba9876543210"', [SAVED_COPY_HEADER]: SAVED_COPY_VALUE },
      })
    );
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
    expect(fake.db.arrivals.map((row) => [row.path, row.label])).toEqual([['/modules/1-1/', 'cached-browser']]);
  });

  it('passes an unknown path through untouched and counts it as before', async () => {
    const req = new Request(`${ORIGIN}/changelog/`, { headers: { 'if-none-match': 'W/"x"' } });
    const res = await fake.run(req);
    expect(fake.nextCalls).toEqual([undefined]);
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBeNull();
    expect(fake.db.arrivals.map((row) => row.label)).toEqual(['unknown']);
  });

  it('serves even when counting throws', async () => {
    fake.db.failNextWrite = true;
    const res = await fake.run(new Request(`${ORIGIN}/`));
    expect(res.status).toBe(200);
  });
});
