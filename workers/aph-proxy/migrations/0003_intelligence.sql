-- Intelligence enrichment: scored columns on signals, alert tables, saved searches.
-- Applied after 0002_indexes.sql. Safe to re-run (IF NOT EXISTS / column guards).

-- Scored columns on signals (DEFAULT so existing rows get safe fallbacks).
ALTER TABLE signals ADD COLUMN attention          TEXT    DEFAULT 'low';
ALTER TABLE signals ADD COLUMN confidence         INTEGER DEFAULT 1;
ALTER TABLE signals ADD COLUMN score_json         TEXT;
ALTER TABLE signals ADD COLUMN entities_json      TEXT;
ALTER TABLE signals ADD COLUMN scoring_explanation TEXT;

-- Fast attention filter used by the archive page and digest engine.
CREATE INDEX IF NOT EXISTS idx_signals_attention ON signals(attention);

-- Alert rules: keyword + metadata conditions that fire events on new items.
CREATE TABLE IF NOT EXISTS alert_rules (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  terms         TEXT    NOT NULL DEFAULT '',   -- comma-separated keywords (empty = any)
  attention_min TEXT    NOT NULL DEFAULT 'high', -- high | med | low
  source_group  TEXT,                           -- NULL = any
  kind          TEXT,                           -- NULL = any
  created_at    TEXT    NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);

-- Alert events: one row per (rule, signal) pair when an incoming item fires a rule.
-- UNIQUE prevents duplicate firings on re-poll.
CREATE TABLE IF NOT EXISTS alert_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id     INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  signal_guid TEXT    NOT NULL,
  fired_at    TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  link        TEXT    NOT NULL,
  attention   TEXT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_dedup ON alert_events(rule_id, signal_guid);
CREATE INDEX        IF NOT EXISTS idx_alert_events_fired ON alert_events(fired_at DESC);

-- Saved searches: persist filter sets from the Archive page.
CREATE TABLE IF NOT EXISTS saved_searches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  params_json TEXT    NOT NULL,  -- JSON of {from,to,kind,source_group,attention,q}
  created_at  TEXT    NOT NULL
);
