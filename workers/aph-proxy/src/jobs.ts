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

/**
 * Wall-clock budget for one scheduled job (0.16.9). A run still going at
 * this point is recorded as error {"timed_out":1} and recordJobRun returns,
 * so the finish row is written while the invocation is still alive. 0.16.8
 * wrote the finish row only after fn() settled; a run the platform ended
 * first (the poll stalled on an APH body from 30 Sep 2026) kept a NULL
 * outcome for good.
 */
export const JOB_BUDGET_MS = 10 * 60 * 1000;
/** An unfinished row older than this is abandoned (reapAbandoned). */
export const ABANDONED_AFTER_MS = 20 * 60 * 1000;
export const TIMED_OUT_DETAIL = countsDetail({ timed_out: 1 });
export const ABANDONED_DETAIL = countsDetail({ abandoned: 1 });

class JobBudgetExceeded extends Error {
  constructor() {
    super("job budget exceeded");
  }
}

/**
 * Closes run-log rows a killed invocation left open (0.16.9): finished_at
 * NULL and started_at older than ABANDONED_AFTER_MS become outcome error,
 * detail {"abandoned":1}, finished at `now`. Runs at the start of every job,
 * so one is closed within a poll interval. No live run can be that old: the
 * JOB_BUDGET_MS race finishes every run that is still being awaited sooner.
 * Never throws.
 */
export async function reapAbandoned(env: Env, now = Date.now()): Promise<number> {
  try {
    const cutoff = new Date(now - ABANDONED_AFTER_MS).toISOString();
    const r = await env.ARCHIVE.prepare(
      `UPDATE job_runs SET finished_at = ?, outcome = 'error', detail = ?
        WHERE finished_at IS NULL AND started_at < ?`,
    ).bind(new Date(now).toISOString(), ABANDONED_DETAIL, cutoff).run();
    return Number(r?.meta?.changes ?? 0);
  } catch (err) {
    console.warn({ event: "job_runs.reap_failed", error: errMsg(err) });
    return 0;
  }
}

export async function recordJobRun<T>(
  env: Env,
  job: JobName,
  fn: () => Promise<T>,
  summarise: (result: T) => JobSummary,
  budgetMs: number = JOB_BUDGET_MS,
): Promise<void> {
  await reapAbandoned(env);
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
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    budgetTimer = setTimeout(() => reject(new JobBudgetExceeded()), budgetMs);
  });
  try {
    // fn() is started inside the try, so a synchronous throw is an error run.
    const result = await Promise.race([Promise.resolve().then(fn), deadline]);
    try {
      const s = summarise(result);
      outcome = s.outcome;
      detail = countsDetail(s.counts);
    } catch {
      outcome = "ok";
      detail = countsDetail({});
    }
  } catch (err) {
    if (err instanceof JobBudgetExceeded) {
      console.error({ event: "job.timed_out", job, budget_ms: budgetMs, ts: new Date().toISOString() });
      outcome = "error";
      detail = TIMED_OUT_DETAIL;
    } else {
      // The error message can carry upstream text, so it goes to the log only;
      // the stored detail stays counts-only.
      console.error({ event: "job.failed", job, error: errMsg(err), ts: new Date().toISOString() });
      outcome = "error";
      detail = countsDetail({ errors: 1 });
    }
  } finally {
    if (budgetTimer !== undefined) clearTimeout(budgetTimer);
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

// last_ok_at is the last run that DID ITS JOB: outcome ok, or partial (0.16.3).
// A partial run is one where some items failed and the rest succeeded, which
// for the poll means some feeds answered and were archived. Counting only
// "ok" made /healthz/deep 503 permanently once one feed (Bills Digests,
// HTTP 403 since 3 Oct 2026) was blocked, so an external monitor would alarm
// all the time and mean nothing. A failing feed is reported separately as
// feeds_failed, from the latest poll's counts, and per feed on
// /healthz/connectors. An "error" run (nothing succeeded) never counts.
export const SUCCESS_OUTCOMES: readonly JobOutcome[] = ["ok", "partial"];

/**
 * 0.16.9 fields. running_since: started_at of the oldest unfinished run, or
 * null. stuck: that run has been going longer than JOB_BUDGET_MS, which no
 * live run can (the budget race closes it), so the invocation was ended and
 * its row is waiting for reapAbandoned. last_failure: why the latest
 * finished run failed when the run log knows: "abandoned" (reaped) or
 * "timed_out" (hit JOB_BUDGET_MS). 0.16.8 read only finished rows, so a run
 * left open by a killed invocation was invisible here.
 */
export type JobHealth = {
  last_ok_at: string | null;
  last_outcome: JobOutcome | null;
  overdue: boolean;
  running_since: string | null;
  stuck: boolean;
  last_failure: "abandoned" | "timed_out" | null;
};
export type DeepHealth = {
  ok: boolean;
  jobs: Record<JobName, JobHealth>;
  feeds_failed: number | null;
  feeds_blocked: number | null;
};

function failureOf(outcome: JobOutcome | null, detail: string | null): JobHealth["last_failure"] {
  if (outcome !== "error" || !detail) return null;
  try {
    const d = JSON.parse(detail);
    if (d?.abandoned === 1) return "abandoned";
    if (d?.timed_out === 1) return "timed_out";
  } catch {
    // counts-only detail that does not parse: no named failure
  }
  return null;
}

/**
 * Reads job_runs. Throws on a D1 error; the route maps that to a generic 503.
 * ok is false when any job is overdue or stuck (0.16.9).
 */
export async function deepHealth(env: Env, now = Date.now()): Promise<DeepHealth> {
  const { results } = await env.ARCHIVE.prepare(
    `SELECT j.job AS job,
            (SELECT MAX(finished_at) FROM job_runs WHERE job = j.job AND outcome IN ('ok', 'partial')) AS last_ok_at,
            (SELECT outcome FROM job_runs WHERE job = j.job AND outcome IS NOT NULL
               ORDER BY finished_at DESC, id DESC LIMIT 1) AS last_outcome,
            (SELECT detail FROM job_runs WHERE job = j.job AND outcome IS NOT NULL
               ORDER BY finished_at DESC, id DESC LIMIT 1) AS last_detail,
            (SELECT MIN(started_at) FROM job_runs WHERE job = j.job AND finished_at IS NULL) AS running_since
       FROM (SELECT DISTINCT job FROM job_runs) j`,
  ).all<{
    job: string;
    last_ok_at: string | null;
    last_outcome: JobOutcome | null;
    last_detail: string | null;
    running_since: string | null;
  }>();
  const byJob = new Map((results ?? []).map((r) => [r.job, r]));
  let feeds_failed: number | null = null;
  // 0.16.11: feeds the host refused (source blocked), from the same detail.
  // A poll detail with feeds_failed and no feeds_blocked had none blocked.
  let feeds_blocked: number | null = null;
  try {
    const d = JSON.parse(byJob.get("poll")?.last_detail ?? "null");
    if (d && typeof d.feeds_failed === "number") {
      feeds_failed = d.feeds_failed;
      feeds_blocked = typeof d.feeds_blocked === "number" ? d.feeds_blocked : 0;
    }
  } catch {
    feeds_failed = null;
    feeds_blocked = null;
  }

  const jobs = {} as Record<JobName, JobHealth>;
  let ok = true;
  for (const [job, maxAge] of Object.entries(JOB_THRESHOLDS) as Array<[JobName, number]>) {
    const r = byJob.get(job);
    const lastOk = r?.last_ok_at ?? null;
    const lastOkMs = lastOk ? Date.parse(lastOk) : NaN;
    const overdue = !Number.isFinite(lastOkMs) || now - lastOkMs > maxAge;
    const runningSince = r?.running_since ?? null;
    const runningMs = runningSince ? Date.parse(runningSince) : NaN;
    const stuck = Number.isFinite(runningMs) && now - runningMs > JOB_BUDGET_MS;
    if (overdue || stuck) ok = false;
    jobs[job] = {
      last_ok_at: lastOk,
      last_outcome: r?.last_outcome ?? null,
      overdue,
      running_since: runningSince,
      stuck,
      last_failure: failureOf(r?.last_outcome ?? null, r?.last_detail ?? null),
    };
  }
  return { ok, jobs, feeds_failed, feeds_blocked };
}
