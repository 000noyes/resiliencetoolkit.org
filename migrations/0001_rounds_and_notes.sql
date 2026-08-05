-- Rounds + notes: the workshop review-round store.
--
-- rounds.id is the full token-bearing round id (e.g. r1-<token>). The id IS
-- the access boundary: the API resolves rounds only by this exact id, so the
-- unguessable token protects the JSON the same way it protects the page.
--
-- notes are add-only. A thread is the set of notes sharing (round_id, pin_no);
-- the thread-opening note carries is_anchor = 1 plus the landmark anchor
-- (target_id + fractional offsets). Whole-page notes have pin_no NULL and form
-- a single thread. Rows are removed only by hand (a group-norms row delete).

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id TEXT NOT NULL REFERENCES rounds(id),
  -- Client-generated idempotency key: a retry after an ambiguous outcome
  -- (timeout after server insert) upserts instead of duplicating.
  draft_uuid TEXT NOT NULL UNIQUE,
  pin_no INTEGER,
  is_anchor INTEGER NOT NULL DEFAULT 0,
  target_id TEXT,
  fx REAL,
  fy REAL,
  name TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_notes_round_id ON notes(round_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);

-- One anchor per pin number per round. Pin numbers are assigned server-side
-- in a single INSERT..SELECT MAX()+1 statement (atomic in SQLite); this
-- partial unique index is the backstop that turns any theoretical race into
-- a constraint error the API retries, never a duplicated pin.
CREATE UNIQUE INDEX uniq_notes_anchor_pin
  ON notes(round_id, pin_no)
  WHERE is_anchor = 1;
