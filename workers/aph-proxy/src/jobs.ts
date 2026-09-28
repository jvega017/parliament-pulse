// Scheduled-job run log and deep health (ARCH-06, WK-05).
//
// recordJobRun wraps each scheduled() branch: it inserts a start row into
// job_runs, runs the job, and sets finished_at, outcome and a counts-only
// detail. It never throws, so a failing job or a missing job_runs table can
// never reject out of scheduled(). If the run-log writes fail, the job still
// runs and the failure is logged.
//
// deepHealth reads job_runs and reports, per job, when it last finished ok,
// its latest outcome and whether it is overdue against the named thresholds.

import type { Env } from "./archive";

export type JobName = "poll" | "members" | "connectors" | "qons" | "digest";
export type JobOutcome = "ok" | "partial" | "error";
export type JobSummary = { outcome: JobOutcome; counts: Record<string, number> };

/** A 30-minute job is overdue when its last ok run is older than this. */
export const POLL_MAX_AGE_MS = 75 * 60 * 1000;
/** A daily job is overdue when its last ok run is older than this. */
export const DAILY_MAX_AGE_MS = 26 * 60 * 60 * 1000;
/** Run-log rows older than this are pruned by the daily 0 5 job. */
export const JOB_RUN_RETENTION_DAYS = 30;
/** Hard cap on the stored detail column. */
export const DETAIL_MAX_CHARS = 512;

export const JOB_THRESHOLDS: Record<JobName, number> = {
  poll: POLL_MAX_AGE_MS,
  members: POLL_MAX_AGE_MS,
  connectors: DAILY_MAX_AGE_MS,
  qons: DAILY_MAX_AGE_MS,
  digest: DAILY_MAX_AGE_MS,
};

/**
 * Detail is numeric counts only. Keys must be plain snake_case identifiers
 * and values finite numbers; anything else (strings, which could carry an
 * email address or an upstream body) is dropped, then the JSON is truncated.
 */
export function countsDetail(counts: Record<string, unknown>): string {
  const safe: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    if (/^[a-z][a-z0-9_]{0,39}$/.test(k) && typeof v === "number" && Number.isFinite(v)) safe[k] = v;
  }
  return JSON.stringify(safe).slice(0, DETAIL_MAX_CHARS);
}

/** ok when every item succeeded, error when none did, partial otherwise. */
export function outcomeFromFailures(total: number, failed: number): JobOutcome {
  if (failed <= 0) return "ok";
  if (failed >= total) return "error";
  return "partial";
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function recordJobRun<T>(
  env: Env,
  job: JobName,
  fn: () => Promise<T>,
  summarise: (result: T) => JobSummary,
): Promise<void> {
  let runId: number | null = null;
  try {
    const row = await env.ARCHIVE.prepare(
      `INSERT INTO job_runs (job, started_at) VALUES (?, ?) RETURNING id`,
    )
      .bind(job, new Date().toISOString())
      .first<{ id: number }>();
    runId = row?.id ?? null;
  } catch (err) {
    console.warn({ event: "job_runs.start_failed", job, error: errMsg(err) });
  }

  let outcome: JobOutcome;
  let detail: string;
  try {
    const result = await fn();
    try {
      const s = summarise(result);
      outcome = s.outcome;
      detail = countsDetail(s.counts);
    } catch {
      outcome = "ok";
      detail = countsDetail({});
    }
  } catch (err) {
    // The error message can carry upstream text, so it goes to the log only;
    // the stored detail stays counts-only.
    console.error({ event: "job.failed", job, error: errMsg(err), ts: new Date().toISOString() });
    outcome = "error";
    detail = countsDetail({ errors: 1 });
  }

  try {
    const finished = new Date().toISOString();
    if (runId !== null) {
      await env.ARCHIVE.prepare(`UPDATE job_runs SET finished_at = ?, outcome = ?, detail = ? WHERE id = ?`)
        .bind(finished, outcome, detail, runId)
        .run();
    } else {
      // The start insert failed (for example a transient D1 error): record
      // the finished run in one row rather than lose it.
      await env.ARCHIVE.prepare(
        `INSERT INTO job_runs (job, started_at, finished_at, outcome, detail) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(job, finished, finished, outcome, detail)
        .run();
    }
  } catch (err) {
    console.warn({ event: "job_runs.finish_failed", job, error: errMsg(err) });
  }
}

/** Delete run-log rows older than the retention window. Never throws. */
export async function pruneJobRuns(env: Env, now = Date.now()): Promise<void> {
  try {
    const cutoff = new Date(now - JOB_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await env.ARCHIVE.prepare(`DELETE FROM job_runs WHERE started_at < ?`).bind(cutoff).run();
  } catch (err) {
    console.warn({ event: "job_runs.prune_failed", error: errMsg(err) });
  }
}

export type JobHealth = { last_ok_at: string | null; last_outcome: JobOutcome | null; overdue: boolean };
export type DeepHealth = { ok: boolean; jobs: Record<JobName, JobHealth> };

/** Reads job_runs. Throws on a D1 error; the route maps that to a generic 503. */
export async function deepHealth(env: Env, now = Date.now()): Promise<DeepHealth> {
  const { results } = await env.ARCHIVE.prepare(
    `SELECT j.job AS job,
            (SELECT MAX(finished_at) FROM job_runs WHERE job = j.job AND outcome = 'ok') AS last_ok_at,
            (SELECT outcome FROM job_runs WHERE job = j.job AND outcome IS NOT NULL
               ORDER BY finished_at DESC, id DESC LIMIT 1) AS last_outcome
       FROM (SELECT DISTINCT job FROM job_runs) j`,
  ).all<{ job: string; last_ok_at: string | null; last_outcome: JobOutcome | null }>();
  const byJob = new Map((results ?? []).map((r) => [r.job, r]));

  const jobs = {} as Record<JobName, JobHealth>;
  let ok = true;
  for (const [job, maxAge] of Object.entries(JOB_THRESHOLDS) as Array<[JobName, number]>) {
    const r = byJob.get(job);
    const lastOk = r?.last_ok_at ?? null;
    const lastOkMs = lastOk ? Date.parse(lastOk) : NaN;
    const overdue = !Number.isFinite(lastOkMs) || now - lastOkMs > maxAge;
    if (overdue) ok = false;
    jobs[job] = { last_ok_at: lastOk, last_outcome: r?.last_outcome ?? null, overdue };
  }
  return { ok, jobs };
}
