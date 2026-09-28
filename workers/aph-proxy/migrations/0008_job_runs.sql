-- Scheduled-job run log (ARCH-06, WK-05, 29 Sep 2026).
--
-- One row per scheduled job run, written by recordJobRun in src/jobs.ts: the
-- start row is inserted before the job runs, and finished_at plus outcome are
-- set when it settles. GET /healthz/deep reads this table to report whether
-- the 30-minute poll and the daily jobs are running, so an external monitor
-- can alert on a job that has silently stopped.
--
-- outcome: 'ok' (job completed, every feed succeeded), 'partial' (job
-- completed but some feeds failed), 'error' (job threw). NULL while running.
-- detail: truncated JSON of numeric counts only. Never email addresses and
-- never raw upstream bodies. Rows older than 30 days are pruned by the daily
-- 0 5 * * * job.
--
-- Additive and idempotent: no existing table is altered or dropped.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote
-- Until it is applied, the run-log writes fail soft (logged, the jobs still
-- run) and /healthz/deep returns 503 with a generic note.

CREATE TABLE IF NOT EXISTS job_runs (
  id           INTEGER PRIMARY KEY,
  job          TEXT NOT NULL,
  started_at   TEXT NOT NULL,       -- ISO 8601
  finished_at  TEXT,                -- ISO 8601; NULL while running
  outcome      TEXT CHECK(outcome IN ('ok','partial','error')),
  detail       TEXT                 -- truncated JSON counts only
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_started ON job_runs (job, started_at);
