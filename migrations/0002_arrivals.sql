-- Arrivals: the site's own count of page arrivals.
--
-- Applies to the ARRIVALS_DB database, which is separate from the workshop
-- round-notes database that migration 0001 builds. Keeping them apart means
-- neither can break the other, and the workshop project never counts arrivals.
--
-- The row is the whole record: which path was served, one classification
-- label, and when. There is no user agent column, no IP column, no referrer
-- column and no identifier of any kind, and that is a guarantee the unit suite
-- asserts rather than a convention. The label is derived in memory from
-- headers that are then discarded.
--
-- label meanings, and the limit that travels with them:
--   likely-browser   the request had the shape of a real browser navigation.
--                    It means "not identifiable as an agent", NOT "a person".
--   declared-agent   the User-Agent announced a crawler or AI fetcher.
--   unknown          neither could be established.
--
-- Rows are append-only. Nothing in the application updates or deletes them.

-- To turn this on, three account-side steps, none of them in this repo:
--   1. Create a D1 database and apply this migration to it.
--   2. Bind it to the production Pages project as ARRIVALS_DB.
--   3. Set ARRIVALS_KEY on the same project to a long random string. The
--      report at /api/arrivals answers 404 until both exist, and answers 404
--      to any request whose ?key= does not match.
-- Until then the middleware records nothing and every page serves as it does
-- today.

CREATE TABLE arrivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('likely-browser', 'declared-agent', 'unknown')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The report groups by day and by path within a date window.
CREATE INDEX idx_arrivals_created_at ON arrivals(created_at);
CREATE INDEX idx_arrivals_path ON arrivals(path);
