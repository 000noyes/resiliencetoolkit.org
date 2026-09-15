/**
 * Same-origin Pages Function: GET returns the arrival counts, split by label
 * and grouped by path and by day. All behavior lives in
 * functions/lib/arrival-counting.ts, which the unit suite covers directly.
 *
 * Closed by default. Without both the ARRIVALS_DB binding and the ARRIVALS_KEY
 * secret this route answers 404, indistinguishable from any other unknown
 * path, so counts are never published by accident.
 */
import { handleArrivalsReport, type D1Database } from '../lib/arrival-counting';

interface RouteContext {
  request: Request;
  env: { ARRIVALS_DB?: D1Database; ARRIVALS_KEY?: string };
}

export async function onRequestGet(context: RouteContext): Promise<Response> {
  return handleArrivalsReport(context.env.ARRIVALS_DB, context.env.ARRIVALS_KEY, context.request);
}
