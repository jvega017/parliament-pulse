-- Index for the keyed thread lookup (Worker 0.16.4, review of 5 Oct 2026).
--
-- A keyed thread stores its canonical key ("key:inquiry/...", "key:bill/...",
-- "key:division/...", "key:estimates/...") as the first token of its
-- comma-separated fingerprint. 0.16.3 found a thread by key with
-- `fingerprint LIKE '<key>,%'`, and D1 rejects any LIKE pattern over 50 bytes
-- ("LIKE or GLOB pattern too complex"), which most inquiry keys exceed:
-- locally 153 of 178 signals failed to thread. 0.16.4 compares the first
-- token for equality instead (src/archive.ts findKeyedThread, using
-- THREAD_KEY_EXPR). This index is on that exact expression, so the lookup is
-- an index search instead of a scan of every thread on each new keyed item.
--
-- Additive and schema-compatible: no column is added or changed, so any
-- Worker version runs against it, and it may be applied before or after the
-- 0.16.4 deploy. Without it 0.16.4 is still correct, only slower.
--
-- Idempotent: CREATE INDEX IF NOT EXISTS.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

CREATE INDEX IF NOT EXISTS idx_threads_key
  ON threads(substr(fingerprint, 1, instr(fingerprint || ',', ',') - 1));
