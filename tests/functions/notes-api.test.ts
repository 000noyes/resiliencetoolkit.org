/**
 * Round-notes API unit suite (the T1 build contract).
 *
 * Covers, per the build record: POST happy path, closed-round reject,
 * payload/name caps, throttle, draft_uuid duplicate = upsert, pin_no
 * collision retry, the JSON envelope on every outcome, the token-bearing
 * round-id boundary (a short id 404s exactly like the page would), and the
 * cross-origin POST posture (mismatched Origin refused, absent Origin
 * allowed). GET is the export path: status + threads.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  handleGetNotes,
  handlePostNote,
  resetIpThrottle,
  TEXT_MAX,
  NAME_MAX,
  ROUND_HOURLY_CAP,
  IP_POST_CAP,
} from '../../functions/lib/notes-api';
import { FakeD1 } from './fake-d1';

const ORIGIN = 'https://workshop.resiliencetoolkit.org';
const ROUND = 'r1-abcdefghijklmnopqrstuvwx';

function postRequest(
  body: unknown,
  opts: { origin?: string | null; ip?: string; raw?: string } = {}
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.origin !== null) headers['origin'] = opts.origin ?? ORIGIN;
  headers['cf-connecting-ip'] = opts.ip ?? '203.0.113.7';
  return new Request(`${ORIGIN}/api/rounds/${ROUND}/notes`, {
    method: 'POST',
    headers,
    body: opts.raw ?? JSON.stringify(body),
  });
}

function newPin(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    draft_uuid: `uuid-${Math.random().toString(36).slice(2)}`,
    target_id: 'hero',
    fx: 0.5,
    fy: 0.25,
    text: 'The heading reads clearly.',
    ...overrides,
  };
}

async function json(res: Response): Promise<any> {
  return JSON.parse(await res.text());
}

let db: FakeD1;

beforeEach(() => {
  db = new FakeD1();
  db.seedRound(ROUND, 'open');
  resetIpThrottle();
});

describe('round-id boundary', () => {
  it('GET with a short (token-less) round id 404s without touching the DB', async () => {
    const res = await handleGetNotes(db, 'r1');
    expect(res.status).toBe(404);
    expect((await json(res)).ok).toBe(false);
  });

  it('POST with a short round id 404s', async () => {
    const res = await handlePostNote(db, 'r1', postRequest(newPin()));
    expect(res.status).toBe(404);
  });

  it('GET for an unknown (but well-shaped) round id 404s', async () => {
    const res = await handleGetNotes(db, 'r9-zzzzzzzzzzzzzzzzzzzzzzzz');
    expect(res.status).toBe(404);
  });

  it('missing DB binding (production origin) 404s instead of crashing', async () => {
    expect((await handleGetNotes(undefined, ROUND)).status).toBe(404);
    expect((await handlePostNote(undefined, ROUND, postRequest(newPin()))).status).toBe(404);
  });
});

describe('POST — placing pins', () => {
  it('assigns server-side pin numbers in sequence and returns the E10 envelope', async () => {
    const first = await handlePostNote(db, ROUND, postRequest(newPin()));
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('application/json');
    const firstBody = await json(first);
    expect(firstBody).toMatchObject({ ok: true, pin_no: 1 });

    const second = await handlePostNote(db, ROUND, postRequest(newPin()));
    expect((await json(second)).pin_no).toBe(2);
  });

  it('stores the anchor (target + fractions) on the thread-opening note', async () => {
    await handlePostNote(db, ROUND, postRequest(newPin({ target_id: 'find-your-path', fx: 0.1, fy: 0.9 })));
    const anchor = db.notes.find((n) => n.is_anchor === 1);
    expect(anchor).toMatchObject({ target_id: 'find-your-path', fx: 0.1, fy: 0.9, pin_no: 1 });
  });

  it('a duplicate draft_uuid upserts: same pin_no back, no second row', async () => {
    const body = newPin({ draft_uuid: 'retry-me' });
    const first = await handlePostNote(db, ROUND, postRequest(body));
    expect((await json(first)).pin_no).toBe(1);

    const retry = await handlePostNote(db, ROUND, postRequest(body));
    expect(retry.status).toBe(200);
    expect((await json(retry)).pin_no).toBe(1);
    expect(db.notes).toHaveLength(1);
  });

  it('retries once when the computed pin number collides with a concurrent insert', async () => {
    db.anchorCollideOnce = true;
    const res = await handlePostNote(db, ROUND, postRequest(newPin({ draft_uuid: 'collide-1' })));
    expect(res.status).toBe(200);
    const mine = db.notes.find((n) => n.draft_uuid === 'collide-1');
    expect(mine?.pin_no).toBe(2); // the concurrent insert took pin 1
  });

  it('replies to an existing pin join its thread (same pin_no, no anchor)', async () => {
    await handlePostNote(db, ROUND, postRequest(newPin()));
    const reply = await handlePostNote(
      db,
      ROUND,
      postRequest({ draft_uuid: 'reply-001', pin_no: 1, text: 'Agreed.', name: 'Lena' })
    );
    expect((await json(reply)).pin_no).toBe(1);
    const row = db.notes.find((n) => n.draft_uuid === 'reply-001');
    expect(row).toMatchObject({ pin_no: 1, is_anchor: 0, name: 'Lena' });
  });

  it('a reply to a pin that does not exist is refused', async () => {
    const res = await handlePostNote(
      db,
      ROUND,
      postRequest({ draft_uuid: 'reply-00x', pin_no: 7, text: 'To nothing.' })
    );
    expect(res.status).toBe(400);
    expect((await json(res)).ok).toBe(false);
  });

  it('whole-page notes store pin_no null (DD9)', async () => {
    const res = await handlePostNote(
      db,
      ROUND,
      postRequest({ draft_uuid: 'whole-001', text: 'The page overall feels calm.' })
    );
    expect(res.status).toBe(200);
    expect((await json(res)).pin_no).toBeNull();
    expect(db.notes[0]).toMatchObject({ pin_no: null, is_anchor: 0 });
  });
});

describe('POST — guards', () => {
  it('rejects posts to a closed round', async () => {
    db.seedRound('r2-abcdefghijklmnopqrstuvwx', 'closed');
    const res = await handlePostNote(db, 'r2-abcdefghijklmnopqrstuvwx', postRequest(newPin()));
    expect(res.status).toBe(409);
    expect((await json(res)).ok).toBe(false);
  });

  it(`caps note text at ${TEXT_MAX} characters, name at ${NAME_MAX}`, async () => {
    const long = await handlePostNote(db, ROUND, postRequest(newPin({ text: 'x'.repeat(TEXT_MAX + 1) })));
    expect(long.status).toBe(400);
    const longName = await handlePostNote(
      db,
      ROUND,
      postRequest(newPin({ name: 'n'.repeat(NAME_MAX + 1) }))
    );
    expect(longName.status).toBe(400);
    expect(db.notes).toHaveLength(0);
  });

  it('rejects an oversized body outright', async () => {
    const res = await handlePostNote(db, ROUND, postRequest(null, { raw: 'x'.repeat(20_000) }));
    expect(res.status).toBe(413);
  });

  it('answers malformed JSON with the JSON failure envelope, not a crash', async () => {
    const res = await handlePostNote(db, ROUND, postRequest(null, { raw: '{not json' }));
    expect(res.status).toBe(400);
    expect((await json(res)).ok).toBe(false);
  });

  it('rejects invalid anchors (fractions out of range, missing fy)', async () => {
    expect((await handlePostNote(db, ROUND, postRequest(newPin({ fx: 1.5 })))).status).toBe(400);
    expect((await handlePostNote(db, ROUND, postRequest(newPin({ fy: undefined })))).status).toBe(400);
  });

  it('refuses a cross-origin POST, allows an absent Origin header', async () => {
    const cross = await handlePostNote(
      db,
      ROUND,
      postRequest(newPin(), { origin: 'https://evil.example' })
    );
    expect(cross.status).toBe(403);

    const absent = await handlePostNote(db, ROUND, postRequest(newPin(), { origin: null }));
    expect(absent.status).toBe(200);
  });

  it(`throttles a round past ${ROUND_HOURLY_CAP} notes/hour with a JSON 429`, async () => {
    for (let i = 0; i < ROUND_HOURLY_CAP; i++) {
      db.seedNote({ round_id: ROUND, text: 'seed', draft_uuid: `s-${i}` });
    }
    const res = await handlePostNote(db, ROUND, postRequest(newPin()));
    expect(res.status).toBe(429);
    expect((await json(res)).ok).toBe(false);
  });

  it(`per-IP best-effort throttle trips past ${IP_POST_CAP} posts in its window`, async () => {
    for (let i = 0; i < IP_POST_CAP; i++) {
      const res = await handlePostNote(db, ROUND, postRequest(newPin(), { ip: '198.51.100.9' }));
      expect(res.status).toBe(200);
    }
    const over = await handlePostNote(db, ROUND, postRequest(newPin(), { ip: '198.51.100.9' }));
    expect(over.status).toBe(429);
    // A different IP is unaffected (rural-NAT neighbors share one IP, so the
    // cap is generous, but distinct IPs never contend).
    const other = await handlePostNote(db, ROUND, postRequest(newPin(), { ip: '198.51.100.10' }));
    expect(other.status).toBe(200);
  });

  it('stores attacker-shaped text verbatim without interpreting it', async () => {
    const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    await handlePostNote(db, ROUND, postRequest(newPin({ text: payload })));
    expect(db.notes[0].text).toBe(payload);
  });
});

describe('GET — the export path', () => {
  it('returns status + threads grouped by pin with the whole-page thread apart', async () => {
    await handlePostNote(db, ROUND, postRequest(newPin({ draft_uuid: 'p1-anchor', name: 'Meghan' })));
    await handlePostNote(
      db,
      ROUND,
      postRequest({ draft_uuid: 'p1-reply-1', pin_no: 1, text: 'Seconded.' })
    );
    await handlePostNote(
      db,
      ROUND,
      postRequest({ draft_uuid: 'w1-whole-1', text: 'Whole page note.' })
    );

    const res = await handleGetNotes(db, ROUND);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('open');
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0]).toMatchObject({ pin_no: 1, target_id: 'hero', fx: 0.5, fy: 0.25 });
    expect(body.threads[0].notes).toHaveLength(2);
    expect(body.threads[0].notes[0]).toMatchObject({ name: 'Meghan' });
    expect(body.threads[0].notes[1]).toMatchObject({ name: null, text: 'Seconded.' });
    expect(body.whole_page).toHaveLength(1);
    expect(body.whole_page[0].text).toBe('Whole page note.');
  });

  it('an empty round returns empty threads, never an error', async () => {
    const body = await json(await handleGetNotes(db, ROUND));
    expect(body).toMatchObject({ ok: true, status: 'open', threads: [], whole_page: [] });
  });

  it('reports closed status so the client renders the closed state', async () => {
    db.seedRound('r2-abcdefghijklmnopqrstuvwx', 'closed');
    const body = await json(await handleGetNotes(db, 'r2-abcdefghijklmnopqrstuvwx'));
    expect(body.status).toBe('closed');
  });

  it('sends no-store + nosniff headers (function responses bypass _headers)', async () => {
    const res = await handleGetNotes(db, ROUND);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
