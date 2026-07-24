/**
 * Round-notes API core, shared by the Pages Function route
 * (functions/api/rounds/[id]/notes.ts). Runs on the workshop origin only —
 * the production project has no D1 binding, so every request there answers
 * 404, indistinguishable from any other unknown path.
 *
 * Access boundary: the full token-bearing round id (r1-<token>) is the only
 * key. A short or malformed id 404s before any query, so the unguessable URL
 * protects the JSON exactly as it protects the page. Every SQL statement is
 * parameterized; user text is never interpolated into SQL and never
 * interpreted as HTML anywhere server-side (clients render it as text nodes).
 *
 * Cross-origin POST posture (decided at build, recorded here): a POST whose
 * Origin header is present and does not match the request origin is refused
 * with 403. An absent Origin is allowed — non-browser clients omit it, and no
 * Origin check constrains them anyway; for those, the unguessable round id
 * plus the throttles are the boundary. Browsers always send Origin on
 * cross-site POSTs, so this closes the drive-by-form/CSRF shape without
 * locking out any legitimate reader of the round link.
 *
 * Write guards, in order: payload cap, round lookup (404), closed-round
 * check (409), origin check (403), field validation (400), throttles (429),
 * then the add-only insert. The throttle protects the D1 daily quota from a
 * scripted writer; it is deliberately generous so 5-10 people behind one
 * rural NAT never contend with it.
 */

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

export const TEXT_MAX = 4000;
export const NAME_MAX = 80;
export const BODY_MAX = 16_384;
export const ROUND_HOURLY_CAP = 300;
export const IP_POST_CAP = 30;
export const IP_WINDOW_MS = 10 * 60 * 1000;

// Full token-bearing round id: r<digits>-<token of 16+ URL-safe chars>.
const ROUND_ID_RE = /^r\d+-[A-Za-z0-9_-]{16,64}$/;
const DRAFT_UUID_RE = /^[A-Za-z0-9-]{8,64}$/;
const TARGET_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

// Best-effort per-IP throttle. Worker isolates are ephemeral and per-POP, so
// this map is not a global limit — it is a local speed bump layered under the
// durable per-round count below, which is what actually protects the quota.
const ipPosts = new Map<string, number[]>();

export function resetIpThrottle(): void {
  ipPosts.clear();
}

function ipThrottled(ip: string): boolean {
  const now = Date.now();
  const recent = (ipPosts.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_POST_CAP) {
    ipPosts.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipPosts.set(ip, recent);
  return false;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex',
    },
  });
}

const notFound = () => json(404, { ok: false, error: 'not found' });

async function findRound(
  db: D1Database,
  roundId: string
): Promise<{ id: string; status: string } | null> {
  return db
    .prepare('SELECT id, status FROM rounds WHERE id = ?1')
    .bind(roundId)
    .first<{ id: string; status: string }>();
}

interface NoteListRow {
  pin_no: number | null;
  is_anchor: number;
  target_id: string | null;
  fx: number | null;
  fy: number | null;
  name: string | null;
  text: string;
  created_at: string;
}

export async function handleGetNotes(
  db: D1Database | undefined,
  roundId: string | undefined
): Promise<Response> {
  if (!db || !roundId || !ROUND_ID_RE.test(roundId)) return notFound();
  const round = await findRound(db, roundId);
  if (!round) return notFound();

  const { results } = await db
    .prepare(
      'SELECT pin_no, is_anchor, target_id, fx, fy, name, text, created_at ' +
        'FROM notes WHERE round_id = ?1 ORDER BY (pin_no IS NULL), pin_no, id'
    )
    .bind(roundId)
    .all<NoteListRow>();

  const threads: Array<{
    pin_no: number;
    target_id: string | null;
    fx: number | null;
    fy: number | null;
    notes: Array<{ name: string | null; text: string; created_at: string }>;
  }> = [];
  const wholePage: Array<{ name: string | null; text: string; created_at: string }> = [];

  for (const row of results) {
    const note = { name: row.name, text: row.text, created_at: row.created_at };
    if (row.pin_no === null) {
      wholePage.push(note);
      continue;
    }
    let thread = threads.find((t) => t.pin_no === row.pin_no);
    if (!thread) {
      thread = { pin_no: row.pin_no, target_id: null, fx: null, fy: null, notes: [] };
      threads.push(thread);
    }
    if (row.is_anchor === 1) {
      thread.target_id = row.target_id;
      thread.fx = row.fx;
      thread.fy = row.fy;
    }
    thread.notes.push(note);
  }

  return json(200, { ok: true, status: round.status, threads, whole_page: wholePage });
}

interface PostBody {
  draft_uuid: string;
  text: string;
  name: string | null;
  pin_no: number | null;
  target_id: string | null;
  fx: number | null;
  fy: number | null;
}

/** Validate + normalize the POST body; a string return is the 400 reason. */
function parsePostBody(raw: unknown): PostBody | string {
  if (typeof raw !== 'object' || raw === null) return 'body must be a JSON object';
  const body = raw as Record<string, unknown>;

  const draftUuid = body.draft_uuid;
  if (typeof draftUuid !== 'string' || !DRAFT_UUID_RE.test(draftUuid)) return 'bad draft_uuid';

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length === 0 || text.length > TEXT_MAX) return 'bad text';

  let name: string | null = null;
  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string' || body.name.trim().length > NAME_MAX) return 'bad name';
    name = body.name.trim() || null;
  }

  const hasPin = body.pin_no !== undefined && body.pin_no !== null;
  const hasTarget = body.target_id !== undefined && body.target_id !== null;
  if (hasPin && hasTarget) return 'pin_no and target_id are exclusive';

  if (hasPin) {
    if (typeof body.pin_no !== 'number' || !Number.isInteger(body.pin_no) || body.pin_no < 1) {
      return 'bad pin_no';
    }
    return { draft_uuid: draftUuid, text, name, pin_no: body.pin_no, target_id: null, fx: null, fy: null };
  }

  if (hasTarget) {
    if (typeof body.target_id !== 'string' || !TARGET_ID_RE.test(body.target_id)) {
      return 'bad target_id';
    }
    const { fx, fy } = body;
    if (typeof fx !== 'number' || typeof fy !== 'number' || fx < 0 || fx > 1 || fy < 0 || fy > 1) {
      return 'bad anchor fractions';
    }
    return { draft_uuid: draftUuid, text, name, pin_no: null, target_id: body.target_id, fx, fy };
  }

  // Neither pin_no nor target_id: a whole-page note (DD9).
  return { draft_uuid: draftUuid, text, name, pin_no: null, target_id: null, fx: null, fy: null };
}

async function existingPinFor(db: D1Database, draftUuid: string): Promise<number | null | undefined> {
  const row = await db
    .prepare('SELECT pin_no FROM notes WHERE draft_uuid = ?1')
    .bind(draftUuid)
    .first<{ pin_no: number | null }>();
  return row ? row.pin_no : undefined;
}

export async function handlePostNote(
  db: D1Database | undefined,
  roundId: string | undefined,
  request: Request
): Promise<Response> {
  if (!db || !roundId || !ROUND_ID_RE.test(roundId)) return notFound();

  const rawBody = await request.text();
  if (rawBody.length > BODY_MAX) return json(413, { ok: false, error: 'body too large' });

  const round = await findRound(db, roundId);
  if (!round) return notFound();
  if (round.status !== 'open') return json(409, { ok: false, error: 'round closed' });

  const origin = request.headers.get('origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    return json(403, { ok: false, error: 'cross-origin write refused' });
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawBody);
  } catch {
    return json(400, { ok: false, error: 'body is not JSON' });
  }
  const parsed = parsePostBody(parsedRaw);
  if (typeof parsed === 'string') return json(400, { ok: false, error: parsed });

  // Idempotency first: a retry after an ambiguous outcome must not re-count
  // against the throttle or re-insert.
  const already = await existingPinFor(db, parsed.draft_uuid);
  if (already !== undefined) return json(200, { ok: true, pin_no: already });

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (ipThrottled(ip)) return json(429, { ok: false, error: 'too many notes, wait a moment' });

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = await db
    .prepare('SELECT COUNT(*) AS c FROM notes WHERE round_id = ?1 AND created_at > ?2')
    .bind(roundId, hourAgo)
    .first<{ c: number }>();
  if ((count?.c ?? 0) >= ROUND_HOURLY_CAP) {
    return json(429, { ok: false, error: 'this round is busy, try again soon' });
  }

  if (parsed.pin_no !== null) {
    // Reply: the pin's thread must exist.
    const anchor = await db
      .prepare('SELECT 1 AS present FROM notes WHERE round_id = ?1 AND pin_no = ?2 AND is_anchor = 1')
      .bind(roundId, parsed.pin_no)
      .first<{ present: number }>();
    if (!anchor) return json(400, { ok: false, error: 'no such pin' });
    await db
      .prepare(
        'INSERT INTO notes (round_id, draft_uuid, pin_no, is_anchor, target_id, fx, fy, name, text) ' +
          'VALUES (?1, ?2, ?3, 0, NULL, NULL, NULL, ?4, ?5) ON CONFLICT(draft_uuid) DO NOTHING'
      )
      .bind(roundId, parsed.draft_uuid, parsed.pin_no, parsed.name, parsed.text)
      .run();
  } else if (parsed.target_id !== null) {
    // New pin: the pin number is computed inside the INSERT (atomic in
    // SQLite); the partial unique anchor index backstops any race, and the
    // constraint error is retried a bounded number of times.
    let inserted = false;
    for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
      try {
        await db
          .prepare(
            'INSERT INTO notes (round_id, draft_uuid, pin_no, is_anchor, target_id, fx, fy, name, text) ' +
              'SELECT ?1, ?2, COALESCE(MAX(pin_no), 0) + 1, 1, ?3, ?4, ?5, ?6, ?7 ' +
              'FROM notes WHERE round_id = ?1 ON CONFLICT(draft_uuid) DO NOTHING'
          )
          .bind(roundId, parsed.draft_uuid, parsed.target_id, parsed.fx, parsed.fy, parsed.name, parsed.text)
          .run();
        inserted = true;
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('UNIQUE')) throw error;
      }
    }
    if (!inserted) return json(500, { ok: false, error: 'could not place the pin' });
  } else {
    // Whole-page note.
    await db
      .prepare(
        'INSERT INTO notes (round_id, draft_uuid, pin_no, is_anchor, target_id, fx, fy, name, text) ' +
          'VALUES (?1, ?2, NULL, 0, NULL, NULL, NULL, ?3, ?4) ON CONFLICT(draft_uuid) DO NOTHING'
      )
      .bind(roundId, parsed.draft_uuid, parsed.name, parsed.text)
      .run();
  }

  const pinNo = await existingPinFor(db, parsed.draft_uuid);
  if (pinNo === undefined) return json(500, { ok: false, error: 'note did not persist' });
  return json(200, { ok: true, pin_no: pinNo });
}
