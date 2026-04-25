-- Parliament Pulse archive schema (D1).
-- Persists every distinct RSS item observed by the cron poll.
-- Idempotent on guid; updates last_seen_at on revisit.

CREATE TABLE IF NOT EXISTS signals (
  guid             TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  link             TEXT NOT NULL,
  pub_date         TEXT,                 -- ISO 8601 from RSS pubDate / Atom updated
  feed_url         TEXT NOT NULL,
  feed_label       TEXT NOT NULL,
  source_group     TEXT NOT NULL,        -- Senate / House / Library / Custom
  kind             TEXT NOT NULL,        -- inquiry / hearing / report / digest / signal
  first_seen_at    TEXT NOT NULL,        -- ISO 8601 (cron observation time)
  last_seen_at     TEXT NOT NULL,
  raw_xml_excerpt  TEXT
);

CREATE INDEX IF NOT EXISTS idx_signals_pub_date  ON signals(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_feed      ON signals(feed_url);
CREATE INDEX IF NOT EXISTS idx_signals_kind      ON signals(kind);
CREATE INDEX IF NOT EXISTS idx_signals_source    ON signals(source_group);

-- Connector health log: written by the fortnightly URL re-verification cron.
CREATE TABLE IF NOT EXISTS connector_checks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url          TEXT NOT NULL,
  status       INTEGER,
  ok           INTEGER NOT NULL,         -- 1 / 0
  checked_at   TEXT NOT NULL,
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_connector_checks_url ON connector_checks(url, checked_at DESC);

-- Hansard QON shell. Populated by a future ParlInfo daily job; the schema is
-- defined now so downstream consumers can wire to it.
CREATE TABLE IF NOT EXISTS qons (
  id            TEXT PRIMARY KEY,
  asked_at      TEXT NOT NULL,
  member        TEXT,
  chamber       TEXT,
  target        TEXT,
  question      TEXT,
  hansard_url   TEXT,
  ingested_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qons_asked ON qons(asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_qons_member ON qons(member);

-- Email digest subscribers. Activated by /digest/subscribe when the digest
-- delivery worker is enabled.
CREATE TABLE IF NOT EXISTS digest_subscribers (
  email          TEXT PRIMARY KEY,
  watchlists     TEXT,                   -- comma-separated list of watchlist names
  attention_min  TEXT NOT NULL DEFAULT 'high',
  created_at     TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1
);
