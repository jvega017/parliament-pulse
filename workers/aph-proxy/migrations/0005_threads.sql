-- Thread layer over the signals archive: groups related signals (e.g. the same
-- inquiry or bill appearing across multiple feed polls) under a shared thread,
-- so the frontend can show "N updates on this story" instead of N flat rows.
--
-- Additive only: no existing table is altered or dropped.
--
-- IMPORTANT: apply via: wrangler d1 migrations apply parliament-pulse-archive --remote

CREATE TABLE IF NOT EXISTS threads (
  thread_id      TEXT PRIMARY KEY,
  fingerprint    TEXT NOT NULL,   -- comma-separated token set (capped ~30 tokens), used for Jaccard matching
  title          TEXT NOT NULL,   -- seed item's title, kept as the thread's display title
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  item_count     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_threads_last_seen ON threads(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_item_count ON threads(item_count DESC);

-- Mapping table: one row per signal, linking it to the thread it was assigned to.
CREATE TABLE IF NOT EXISTS signal_threads (
  signal_guid  TEXT PRIMARY KEY REFERENCES signals(guid) ON DELETE CASCADE,
  thread_id    TEXT NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signal_threads_thread ON signal_threads(thread_id);
