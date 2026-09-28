-- One-off backfill: correct threads.item_count from signal_threads (DATA-06,
-- 29 Sep 2026).
--
-- Before this date the poller incremented item_count every time a re-seen
-- item was mistaken for a new one, so stored counts are inflated. The
-- signal_threads mapping (one row per signal, INSERT OR IGNORE) was never
-- inflated, so it is the true count. /state already serves COUNT(*) from
-- signal_threads, so the displayed value is correct without this file; this
-- only repairs the stored column for any other reader.
--
-- Idempotent: re-running recomputes the same values.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

UPDATE threads
   SET item_count = (
     SELECT COUNT(*) FROM signal_threads st WHERE st.thread_id = threads.thread_id
   );
