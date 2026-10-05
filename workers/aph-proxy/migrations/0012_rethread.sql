-- Rebuild the thread layer with canonical keys (Worker 0.16.3, data review
-- 5 Oct 2026).
--
-- Threads built by 0.16.2 and earlier matched on word overlap across title
-- AND description at Jaccard 0.5, which grouped seven different procedural
-- divisions, four different Treasury Laws bills, and "Annual reports" items
-- from different committees. 0.16.3 threads by canonical key (inquiry path,
-- bill name, or division id; src/threads.ts canonicalThreadKey) and by title
-- overlap at 0.6 otherwise, and names every new thread "t2:<guid>".
--
-- This file removes every thread that is NOT a t2 thread, with its mapping
-- rows. The signals themselves are untouched. They are then unthreaded, and
-- the poll re-threads up to THREAD_HEAL_PER_POLL of them every 30 minutes
-- (src/archive.ts); POST /admin/backfill-threads does the rest at once:
--   repeat until the response's `processed` is 0.
--
-- ORDER: apply AFTER Worker 0.16.3 is deployed. Applied first, the old
-- Worker would rebuild word-overlap threads under the old "thread:" prefix.
--
-- Idempotent: only non-t2 threads are deleted, so a second run, or a run
-- after the backfill, leaves every rebuilt thread in place.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

DELETE FROM signal_threads WHERE thread_id NOT LIKE 't2:%';
DELETE FROM threads WHERE thread_id NOT LIKE 't2:%';
