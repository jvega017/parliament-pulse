-- Performance indexes for signals table.
-- Applied after initial schema (0001_signals.sql).

-- Fast recent-item queries used by digest and archive default sort.
CREATE INDEX IF NOT EXISTS idx_signals_first_seen ON signals(first_seen_at DESC);

-- Fast date-range filtering used by queryArchive and watchlistAnalytics.
CREATE INDEX IF NOT EXISTS idx_signals_pub_date ON signals(pub_date DESC);

-- Fast source filtering used by archive page source_group filter.
CREATE INDEX IF NOT EXISTS idx_signals_source_group ON signals(source_group);

-- Fast kind filtering used by archive page kind filter.
CREATE INDEX IF NOT EXISTS idx_signals_kind ON signals(kind);

-- Connector check rollup query (GROUP BY url, MAX checked_at).
CREATE INDEX IF NOT EXISTS idx_connector_checks_url ON connector_checks(url, checked_at DESC);
