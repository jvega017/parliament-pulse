-- Feed-derived connector health (DATA-08, 29 Sep 2026).
--
-- One row per polled RSS feed, upserted by pollAndArchive on every 30-minute
-- poll: the HTTP status the feed last returned, how many items it parsed, the
-- parse error if any, when it was last polled and when it last succeeded.
-- Served as the /state connectors block and /healthz/connectors, replacing
-- the daily landing-page pings in connector_checks as the health signal.
--
-- Additive only: no existing table is altered or dropped. connector_checks
-- stays, and still receives the daily reference-link liveness rows, which are
-- no longer reported as feed health.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote
-- Until it is applied, the poller's health writes fail soft (logged, ingest
-- unaffected) and the connectors block degrades to 'fixture' with a note.

CREATE TABLE IF NOT EXISTS feed_health (
  feed_url          TEXT PRIMARY KEY,
  feed_label        TEXT NOT NULL,
  kind              TEXT,
  last_http_status  INTEGER,          -- 0 when the fetch threw (timeout, DNS, abort)
  items_parsed      INTEGER,          -- NULL when the feed was not parsed
  parse_error       TEXT,             -- NULL on success; fetch or parse error text otherwise
  last_polled_at    TEXT NOT NULL,    -- ISO 8601, every poll attempt
  last_success_at   TEXT              -- ISO 8601, last 2xx + parsed poll; kept on failure
);
