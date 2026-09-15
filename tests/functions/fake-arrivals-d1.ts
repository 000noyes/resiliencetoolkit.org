/**
 * In-memory D1 stand-in for the arrival-counting unit suite.
 *
 * Implements exactly the SQL surface functions/lib/arrival-counting.ts uses,
 * keyed on distinctive substrings, over a plain array. Rows are kept as whole
 * objects so the suite can assert what a stored row contains AND what it does
 * not contain, which is the privacy guarantee of this round.
 *
 * Kept separate from fake-d1.ts on purpose: arrivals and round notes run
 * against different databases, and the fakes stay as separate as the real
 * ones.
 */

import type { D1Database, D1PreparedStatement } from '../../functions/lib/arrival-counting';

export interface ArrivalRow {
  id: number;
  path: string;
  label: string;
  created_at: string;
}

export class FakeArrivalsD1 implements D1Database {
  arrivals: ArrivalRow[] = [];
  failNextWrite = false;
  private nextId = 1;

  seed(partial: Partial<ArrivalRow> & { path: string; label: string }): ArrivalRow {
    const row: ArrivalRow = {
      id: this.nextId++,
      path: partial.path,
      label: partial.label,
      created_at: partial.created_at ?? new Date().toISOString(),
    };
    this.arrivals.push(row);
    return row;
  }

  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement implements D1PreparedStatement {
  private args: unknown[] = [];

  constructor(
    private db: FakeArrivalsD1,
    private sql: string
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.args = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.execute()[0] as T) ?? null;
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

    if (sql.includes('INSERT INTO arrivals')) {
      if (db.failNextWrite) {
        db.failNextWrite = false;
        throw new Error('D1_ERROR: no such table: arrivals');
      }
      db.seed({ path: String(args[0]), label: String(args[1]) });
      return [];
    }

    const inWindow = (row: ArrivalRow): boolean =>
      row.created_at >= String(args[0]) && row.created_at <= String(args[1]);

    const tally = (keyOf: (row: ArrivalRow) => string): Record<string, unknown>[] => {
      const counts = new Map<string, number>();
      for (const row of db.arrivals.filter(inWindow)) {
        const composite = JSON.stringify([keyOf(row), row.label]);
        counts.set(composite, (counts.get(composite) ?? 0) + 1);
      }
      return [...counts.entries()].map(([composite, c]) => {
        const [key, label] = JSON.parse(composite) as [string, string];
        return { key, label, c };
      });
    };

    if (sql.includes('GROUP BY label')) {
      const counts = new Map<string, number>();
      for (const row of db.arrivals.filter(inWindow)) {
        counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
      }
      return [...counts.entries()].map(([label, c]) => ({ label, c }));
    }

    if (sql.includes('GROUP BY path, label')) {
      return tally((row) => row.path);
    }

    if (sql.includes('substr(created_at, 1, 10)')) {
      return tally((row) => row.created_at.slice(0, 10));
    }

    throw new Error(`FakeArrivalsD1: unrecognized SQL: ${sql}`);
  }
}
