/**
 * Same-origin Pages Function: GET returns a round's status + threads (the
 * export path); POST adds one note. All behavior lives in
 * functions/lib/notes-api.ts, which the unit suite covers directly. On the
 * production project this route has no D1 binding and answers 404.
 */
import { handleGetNotes, handlePostNote, type D1Database } from '../../../lib/notes-api';

interface RouteContext {
  request: Request;
  env: { DB?: D1Database };
  params: { id?: string | string[] };
}

function roundIdOf(params: RouteContext['params']): string | undefined {
  return typeof params.id === 'string' ? params.id : undefined;
}

export async function onRequestGet(context: RouteContext): Promise<Response> {
  return handleGetNotes(context.env.DB, roundIdOf(context.params));
}

export async function onRequestPost(context: RouteContext): Promise<Response> {
  return handlePostNote(context.env.DB, roundIdOf(context.params), context.request);
}
