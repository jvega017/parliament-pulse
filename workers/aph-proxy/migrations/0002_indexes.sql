-- Performance indexes for signals table (additional, safe to re-run).
-- Applied after initial schema (0001_signals.sql).

-- Fast recent-item queries used by digest and archive default sort.
CREATE INDEX IF NOT EXISTS idx_signals_first_seen ON signals(first_seen_at DESC);

-- Fast source filtering used by archive page source_group filter.
CREATE INDEX IF NOT EXISTS idx_signals_source_group ON signals(source_group);
