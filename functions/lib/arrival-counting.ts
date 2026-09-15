/**
 * Arrival counting: the site's own first-party count of page arrivals, plus
 * the read path that reports it. Same origin, no client script, no cookie, no
 * identifier.
 *
 * WHAT IS STORED, and it is the whole row: the path that was served, one
 * classification label, and the time. NEVER STORED, in this round or any
 * later one: the raw User-Agent string, any IP or partial IP, any hash or
 * fingerprint derived from either, and the referrer. The classifier reads
 * headers in memory, keeps the conclusion, and discards everything it read.
 * Storing a label is not storing a person. If a future change wants one more
 * field to make the label better, the answer is no.
 *
 * THE LIMIT, and every reader of these numbers needs it. `likely-browser`
 * means "not identifiable as an agent". It does not mean "a person". An agent
 * driving a headless browser sends the same headers a person's browser sends,
 * and this server cannot separate the two. Cloudflare's machine-learned bot
 * score, which could, is an Enterprise feature this account does not have. The
 * counts also miss return visits: the site precaches its pages in a service
 * worker, so a returning reader is served from that cache and the request
 * never reaches this server at all. Both limits ship inside the report output
 * so no number can be quoted without them.
 *
 * The three labels are reported separately and are never added together. There
 * is no combined "visits" figure anywhere in the output, deliberately: a
 * single number that folds agents in with people is the thing that made the
 * old hosted analytics feel inflated.
 *
 * Shape follows functions/lib/notes-api.ts, which is the reviewed same-origin
 * Pages Function plus D1 pattern in this repo: all behavior here, the route and
 * the middleware thin, every SQL statement parameterized, and a missing
 * binding answers 404 rather than erroring. The D1 interfaces are declared
 * here rather than shared with notes-api because the two run against different
 * databases and neither should be able to break the other.
 */

import { DECLARED_AGENT_TOKENS } from './agent-tokens';

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

export type ArrivalLabel = 'likely-browser' | 'declared-agent' | 'unknown';

/** Report order: the headline first, the other two beside it. */
export const ARRIVAL_LABELS: readonly ArrivalLabel[] = [
  'likely-browser',
  'declared-agent',
  'unknown',
];

/** Longer paths are not counted. Nothing this site serves comes close. */
export const PATH_MAX = 256;

/** Default report window when no dates are given. */
export const DEFAULT_WINDOW_DAYS = 30;

export const ARRIVAL_CAVEAT =
  'likely-browser means the request was not identifiable as an agent. It does not mean a ' +
  'person. An agent driving a headless browser sends what a person’s browser sends, and ' +
  'this server cannot tell them apart. These counts also miss return visits: pages are ' +
  'precached for offline use, so a returning reader is served from that cache and never ' +
  'reaches this server. Report first arrivals, not visits, and carry this sentence with them.';

/**
 * Derive one label from request headers. Two signals, in order, both read in
 * memory and neither stored.
 *
 * 1. Declared identity. A well-behaved crawler or AI fetcher announces itself
 *    in the User-Agent, and those are the easy majority of automated traffic.
 * 2. Browser navigation shape. A real browser navigation sends
 *    Sec-Fetch-Dest: document, Sec-Fetch-Mode: navigate and an HTML Accept.
 *    Simple crawlers usually send none of the three. Browsers older than the
 *    Sec-Fetch headers fall to `unknown`, which is the honest answer.
 *
 * Nothing else is used. Timing, ordering and session inference would all need
 * an identity to attach to, and identity is out of scope by design.
 */
export function classifyArrival(headers: Headers): ArrivalLabel {
  const ua = (headers.get('user-agent') ?? '').toLowerCase();
  if (ua.length > 0 && DECLARED_AGENT_TOKENS.some((token) => ua.includes(token))) {
    return 'declared-agent';
  }

  const dest = headers.get('sec-fetch-dest');
  const mode = headers.get('sec-fetch-mode');
  const accept = (headers.get('accept') ?? '').toLowerCase();
  if (dest === 'document' && mode === 'navigate' && accept.includes('text/html')) {
    return 'likely-browser';
  }

  return 'unknown';
}

/**
 * The path to store, or null when this request is not an arrival to count.
 * Only the pathname survives, so a query string is discarded by construction
 * and can never reach the database.
 */
export function arrivalPath(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  if (pathname.length === 0 || pathname.length > PATH_MAX) return null;
  if (pathname.startsWith('/api/')) return null;
  return pathname;
}

/**
 * Record one arrival, or decide there is nothing to record. Returns the write
 * as a promise for the caller to hand to waitUntil, or null when the request
 * is not a counted arrival.
 *
 * Counted: a GET that produced a 200 HTML page. That single test does the work
 * of a path filter, because stylesheets, images, the search index and the
 * round-notes JSON are not HTML, and a missing page is not a 200. Browser
 * prefetches are excluded: nobody arrived.
 *
 * The returned promise never rejects. Counting must never affect delivery.
 */
export function recordArrival(
  db: D1Database | undefined,
  request: Request,
  response: Response
): Promise<void> | null {
  if (!db) return null;
  if (request.method !== 'GET') return null;
  if (response.status !== 200) return null;

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('text/html')) return null;

  const purpose = (request.headers.get('sec-purpose') ?? '').toLowerCase();
  if (purpose.includes('prefetch')) return null;

  const path = arrivalPath(request.url);
  if (path === null) return null;

  const label = classifyArrival(request.headers);

  return db
    .prepare('INSERT INTO arrivals (path, label) VALUES (?1, ?2)')
    .bind(path, label)
    .run()
    .then(
      () => undefined,
      () => undefined
    );
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body, null, 2), {
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

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Length-independent comparison, so the key cannot be guessed by timing. */
function secretsMatch(given: string, expected: string): boolean {
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) {
    diff |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

interface LabelCounts {
  'likely-browser': number;
  'declared-agent': number;
  unknown: number;
}

function emptyCounts(): LabelCounts {
  return { 'likely-browser': 0, 'declared-agent': 0, unknown: 0 };
}

function isLabel(value: unknown): value is ArrivalLabel {
  return (ARRIVAL_LABELS as readonly string[]).includes(String(value));
}

interface GroupedRow {
  key: string;
  label: string;
  c: number;
}

function group(rows: GroupedRow[], keyName: 'path' | 'day'): Record<string, unknown>[] {
  const byKey = new Map<string, LabelCounts>();
  for (const row of rows) {
    if (!isLabel(row.label)) continue;
    let counts = byKey.get(row.key);
    if (!counts) {
      counts = emptyCounts();
      byKey.set(row.key, counts);
    }
    counts[row.label] += Number(row.c) || 0;
  }
  return [...byKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, counts]) => ({ [keyName]: key, ...counts }));
}

/**
 * The monthly read path. Plain counts by path and by day, split by label and
 * never summed. Closed by default: without both the database binding and the
 * key binding it answers 404, exactly like any unknown path.
 *
 * Window: `since` and `until` are optional YYYY-MM-DD dates, inclusive, and
 * default to the last thirty days.
 */
export async function handleArrivalsReport(
  db: D1Database | undefined,
  expectedKey: string | undefined,
  request: Request
): Promise<Response> {
  if (!db || !expectedKey) return notFound();

  const url = new URL(request.url);
  const givenKey = url.searchParams.get('key');
  if (givenKey === null || !secretsMatch(givenKey, expectedKey)) return notFound();

  const sinceParam = url.searchParams.get('since');
  const untilParam = url.searchParams.get('until');
  if (
    (sinceParam !== null && !DAY_RE.test(sinceParam)) ||
    (untilParam !== null && !DAY_RE.test(untilParam))
  ) {
    return json(400, { ok: false, error: 'since and until must be YYYY-MM-DD' });
  }

  const now = new Date();
  const since =
    sinceParam ?? dayOf(new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000));
  const until = untilParam ?? dayOf(now);
  if (since > until) {
    return json(400, { ok: false, error: 'since must not be after until' });
  }

  const from = `${since}T00:00:00.000Z`;
  const to = `${until}T23:59:59.999Z`;

  const labelRows = await db
    .prepare('SELECT label, COUNT(*) AS c FROM arrivals WHERE created_at >= ?1 AND created_at <= ?2 GROUP BY label')
    .bind(from, to)
    .all<{ label: string; c: number }>();

  const pathRows = await db
    .prepare(
      'SELECT path AS key, label, COUNT(*) AS c FROM arrivals ' +
        'WHERE created_at >= ?1 AND created_at <= ?2 GROUP BY path, label'
    )
    .bind(from, to)
    .all<GroupedRow>();

  const dayRows = await db
    .prepare(
      "SELECT substr(created_at, 1, 10) AS key, label, COUNT(*) AS c FROM arrivals " +
        'WHERE created_at >= ?1 AND created_at <= ?2 GROUP BY key, label'
    )
    .bind(from, to)
    .all<GroupedRow>();

  const byLabel = emptyCounts();
  for (const row of labelRows.results) {
    if (isLabel(row.label)) byLabel[row.label] += Number(row.c) || 0;
  }

  return json(200, {
    ok: true,
    window: { since, until },
    what_this_counts: 'One row per HTML page served by this origin. No cookie, no identifier.',
    caveat: ARRIVAL_CAVEAT,
    by_label: byLabel,
    by_path: group(pathRows.results, 'path'),
    by_day: group(dayRows.results, 'day'),
  });
}
