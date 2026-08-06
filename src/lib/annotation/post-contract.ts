/**
 * The E10 client save contract: a note is saved when the server answered
 * 2xx with a JSON body carrying ok and the server-assigned pin number key.
 * Everything else — non-2xx, an HTML error page (the daily-cap 1027 shape),
 * a body missing either field — is a failure the sheet renders as
 * keep/retry/copy, with the text never cleared.
 */

export interface PostOutcome {
  saved: boolean;
  pinNo?: number | null;
}

export function interpretPostResponse(status: number, bodyText: string): PostOutcome {
  if (status < 200 || status >= 300) return { saved: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { saved: false };
  }
  if (typeof parsed !== 'object' || parsed === null) return { saved: false };
  const body = parsed as Record<string, unknown>;
  if (body.ok !== true || !('pin_no' in body)) return { saved: false };
  return { saved: true, pinNo: typeof body.pin_no === 'number' ? body.pin_no : null };
}

/**
 * Client idempotency key, minted once per compose session and reused across
 * retries so an ambiguous outcome (timeout after server insert) upserts
 * instead of duplicating.
 */
export function newDraftUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
