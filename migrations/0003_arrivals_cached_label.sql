-- Arrivals: add the cached-browser label.
--
-- Applies to the ARRIVALS_DB database after migration 0002. The service
-- worker now sends one conditional GET after it serves a page from the copy
-- saved on the device, and the middleware counts that request under a fourth
-- label. The row shape is unchanged: path, label, time, nothing else.
--
-- label meanings, and the limit that travels with them:
--   likely-browser   the request had the shape of a real browser navigation.
--                    It means "not identifiable as an agent", NOT "a person".
--   cached-browser   a browser opened the page from its saved copy while
--                    online and sent the saved-copy check. Same limit.
--   declared-agent   the User-Agent announced a crawler or AI fetcher.
--   unknown          neither could be established.
--
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt:
-- a new table with the wider constraint, every row copied with its id and
-- time, the id sequence carried over, the old table dropped, the new one
-- renamed, the two indexes recreated. Rows stay append-only.
--
-- The sequence step matters: copying rows starts the new table's sequence at
-- the highest id copied, not at the old table's high-water mark, so if any
-- id had ever been removed the next insert would reuse it. The old table's
-- counter is carried across before the drop, and the rename carries the
-- row in sqlite_sequence with it.
--
-- Account-side step, not in this repo. Apply it BEFORE the release that
-- sends the check goes live, or right after: the wider constraint is
-- harmless to the current code, while every cached-browser write made
-- before it is applied fails the old CHECK, is swallowed by the middleware,
-- and is lost. Pages serve as before either way. The report says whether
-- the table accepts every label (schema.accepts_every_label), so a pending
-- migration is not read as zero visits.
--
-- How to apply: as ONE invocation, so the statements run as one batch,
--   wrangler d1 execute <arrivals database> --remote --file migrations/0003_arrivals_cached_label.sql
-- Not `wrangler d1 migrations apply`: migrations/ serves two databases (0001
-- is the workshop notes database) and there is no per-database migrations
-- directory. Not statement by statement in the dashboard console: a stop
-- between the copy and the rename would leave both tables, or neither.
-- Prove it on a scratch database first (apply 0002, add a few rows, apply
-- this file, read sqlite_sequence). If D1 refuses the UPDATE of
-- sqlite_sequence, drop that statement: with append-only rows the copied ids
-- already set the counter to the same value.
-- Recovery if a run stopped part way: both tables present, rerun this file
-- (the first statement clears the leftover); only arrivals_next present, run
-- the RENAME and the two CREATE INDEX statements.

DROP TABLE IF EXISTS arrivals_next;

CREATE TABLE arrivals_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('likely-browser', 'cached-browser', 'declared-agent', 'unknown')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO arrivals_next (id, path, label, created_at)
  SELECT id, path, label, created_at FROM arrivals;

UPDATE sqlite_sequence
  SET seq = (SELECT MAX(seq) FROM sqlite_sequence WHERE name IN ('arrivals', 'arrivals_next'))
  WHERE name = 'arrivals_next';

DROP TABLE arrivals;

ALTER TABLE arrivals_next RENAME TO arrivals;

CREATE INDEX idx_arrivals_created_at ON arrivals(created_at);
CREATE INDEX idx_arrivals_path ON arrivals(path);
