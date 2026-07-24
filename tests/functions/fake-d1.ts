/**
 * In-memory D1 stand-in for the round-notes API unit suite.
 *
 * Implements exactly the SQL surface functions/lib/notes-api.ts uses, keyed on
 * distinctive substrings, over plain arrays — including the two constraints
 * the schema relies on (UNIQUE draft_uuid with DO-NOTHING upsert semantics,
 * and the partial unique anchor-pin index). `anchorCollideOnce` simulates a
 * concurrent anchor insert taking the computed pin number, so the API's
 * collision-retry path is exercisable.
 */

import type { D1Database, D1PreparedStatement } from '../../functions/lib/notes-api';

export interface NoteRow {
  id: number;
  round_id: string;
  draft_uuid: string;
  pin_no: number | null;
  is_anchor: number;
  target_id: string | null;
  fx: number | null;
  fy: number | null;
  name: string | null;
  text: string;
  created_at: string;
}

export class FakeD1 implements D1Database {
  rounds = new Map<string, { id: string; status: string }>();
  notes: NoteRow[] = [];
  anchorCollideOnce = false;
  private nextId = 1;

  seedRound(id: string, status: 'open' | 'closed' = 'open'): void {
    this.rounds.set(id, { id, status });
  }

  seedNote(partial: Partial<NoteRow> & { round_id: string; text: string }): NoteRow {
    const row: NoteRow = {
      id: this.nextId++,
      draft_uuid: partial.draft_uuid ?? `seed-${this.nextId}`,
      pin_no: partial.pin_no ?? null,
      is_anchor: partial.is_anchor ?? 0,
      target_id: partial.target_id ?? null,
      fx: partial.fx ?? null,
      fy: partial.fy ?? null,
      name: partial.name ?? null,
      created_at: partial.created_at ?? new Date().toISOString(),
      round_id: partial.round_id,
      text: partial.text,
    };
    this.notes.push(row);
    return row;
  }

  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement implements D1PreparedStatement {
  private args: unknown[] = [];

  constructor(
    private db: FakeD1,
    private sql: string
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.args = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const rows = this.execute();
    return (rows[0] as T) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: this.execute() as T[] };
  }

  async run(): Promise<{ success: boolean }> {
    this.execute();
    return { success: true };
  }

  private execute(): Record<string, unknown>[] {
    const { sql, args, db } = { sql: this.sql, args: this.args, db: this.db };

    if (sql.includes('FROM rounds')) {
      const round = db.rounds.get(String(args[0]));
      return round ? [{ id: round.id, status: round.status }] : [];
    }

    if (sql.includes('COUNT(*)')) {
      const [roundId, cutoff] = [String(args[0]), String(args[1])];
      const c = db.notes.filter((n) => n.round_id === roundId && n.created_at > cutoff).length;
      return [{ c }];
    }

    if (sql.includes('WHERE draft_uuid')) {
      const row = db.notes.find((n) => n.draft_uuid === String(args[0]));
      return row ? [{ pin_no: row.pin_no }] : [];
    }

    if (sql.includes('SELECT 1 AS present')) {
      const [roundId, pinNo] = [String(args[0]), Number(args[1])];
      const hit = db.notes.some(
        (n) => n.round_id === roundId && n.pin_no === pinNo && n.is_anchor === 1
      );
      return hit ? [{ present: 1 }] : [];
    }

    if (sql.includes('COALESCE(MAX(pin_no)')) {
      // Anchor insert: ?1 round, ?2 draft_uuid, ?3 target_id, ?4 fx, ?5 fy,
      // ?6 name, ?7 text — pin_no computed as MAX+1 within the statement.
      const roundId = String(args[0]);
      const draftUuid = String(args[1]);
      if (db.notes.some((n) => n.draft_uuid === draftUuid)) return []; // DO NOTHING
      const maxPin = Math.max(0, ...db.notes.filter((n) => n.round_id === roundId).map((n) => n.pin_no ?? 0));
      const pin = maxPin + 1;
      if (db.anchorCollideOnce) {
        db.anchorCollideOnce = false;
        // A concurrent insert claimed this pin number between MAX and INSERT.
        db.seedNote({ round_id: roundId, pin_no: pin, is_anchor: 1, text: 'concurrent' });
        throw new Error('UNIQUE constraint failed: notes.round_id, notes.pin_no');
      }
      if (db.notes.some((n) => n.round_id === roundId && n.pin_no === pin && n.is_anchor === 1)) {
        throw new Error('UNIQUE constraint failed: notes.round_id, notes.pin_no');
      }
      db.seedNote({
        round_id: roundId,
        draft_uuid: draftUuid,
        pin_no: pin,
        is_anchor: 1,
        target_id: args[2] === null ? null : String(args[2]),
        fx: args[3] === null ? null : Number(args[3]),
        fy: args[4] === null ? null : Number(args[4]),
        name: args[5] === null ? null : String(args[5]),
        text: String(args[6]),
      });
      return [];
    }

    if (sql.includes('INSERT INTO notes')) {
      const draftUuid = String(args[1]);
      if (db.notes.some((n) => n.draft_uuid === draftUuid)) return []; // DO NOTHING
      // Whole-page insert inlines NULL for pin_no (?1 round, ?2 draft_uuid,
      // ?3 name, ?4 text); the reply insert binds it (?3 pin_no, ?4 name,
      // ?5 text).
      const wholePage = sql.includes('VALUES (?1, ?2, NULL');
      db.seedNote({
        round_id: String(args[0]),
        draft_uuid: draftUuid,
        pin_no: wholePage ? null : Number(args[2]),
        is_anchor: 0,
        name: (wholePage ? args[2] : args[3]) === null ? null : String(wholePage ? args[2] : args[3]),
        text: String(wholePage ? args[3] : args[4]),
      });
      return [];
    }

    if (sql.includes('ORDER BY')) {
      const roundId = String(args[0]);
      const rows = db.notes
        .filter((n) => n.round_id === roundId)
        .sort((a, b) => {
          const aNull = a.pin_no === null ? 1 : 0;
          const bNull = b.pin_no === null ? 1 : 0;
          if (aNull !== bNull) return aNull - bNull;
          if (a.pin_no !== b.pin_no) return (a.pin_no ?? 0) - (b.pin_no ?? 0);
          return a.id - b.id;
        });
      return rows.map((n) => ({
        pin_no: n.pin_no,
        is_anchor: n.is_anchor,
        target_id: n.target_id,
        fx: n.fx,
        fy: n.fy,
        name: n.name,
        text: n.text,
        created_at: n.created_at,
      }));
    }

    throw new Error(`FakeD1: unrecognized SQL: ${sql}`);
  }
}
