// WK-05 (ARCH-06): job-run log and /healthz/deep. Runs against a real
// in-memory SQLite with migrations 0001 to 0008 applied (./support/sqlite-d1.mjs).
//
// Run: node --experimental-strip-types --experimental-sqlite tests/health.test.mjs
//
// The canary test copies src/ to a scratch directory, hard-codes ok:true in
// the scratch deepHealth, and asserts the stale-poll check FAILS against it.
// If the stale check could pass on a Worker that always reports ok, the
// canary aborts the suite as untrustworthy.
//
// Measured to fail when the controls are removed (scratch copies, 29 Sep 2026):
//  - removing the try/catch around fn() in recordJobRun fails both (c) tests
//    and the detail test;
//  - storing JSON.stringify(counts) unfiltered fails the detail test;
//  - outcomeFromFailures never returning "partial" fails the partial-poll test;
//  - dropping pruneJobRuns from the 0 5 branch fails the prune test;
//  - removing "/healthz/deep" from READ_LIMITS fails the rate-limit test;
//  - returning String(err) on a D1 error fails the D1 error test;
//  - counting any finished run (not only ok or partial) as last_ok_at fails
//    the error-run test;
//  - widening the threshold to 3x fails all three (b) staleness tests.

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { default: worker } = await import("../src/index.ts");
const jobs = await import("../src/jobs.ts");
const { POLL_MAX_AGE_MS, DAILY_MAX_AGE_MS, JOB_THRESHOLDS, recordJobRun, countsDetail } = jobs;
const { APH_FEEDS } = await import("../src/feeds.ts");

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Item from someone@example.com</title><link>https://www.aph.gov.au/x?1</link>
<description>contact clerk@aph.gov.au</description><pubDate>Mon, 28 Sep 2026 01:00:00 GMT</pubDate><guid>g-1</guid></item>
</channel></rss>`;

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

function ctx() {
  return { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
}

function seedRun(e, job, finishedMsAgo, outcome = "ok") {
  const at = new Date(Date.now() - finishedMsAgo).toISOString();
  e.ARCHIVE.raw
    .prepare(`INSERT INTO job_runs (job, started_at, finished_at, outcome, detail) VALUES (?, ?, ?, ?, ?)`)
    .run(job, at, at, outcome, "{}");
}

function seedAllFresh(e) {
  for (const job of Object.keys(JOB_THRESHOLDS)) seedRun(e, job, 60_000);
}

async function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

async function deep(mod, e) {
  const res = await mod.fetch(new Request("https://w.test/healthz/deep"), e, ctx());
  return { status: res.status, body: await res.json(), res };
}

// The stale-poll check, shared by test (b) and the canary.
async function assertStalePollIs503(mod) {
  const e = env();
  seedAllFresh(e);
  e.ARCHIVE.raw.exec(`DELETE FROM job_runs WHERE job = 'poll'`);
  seedRun(e, "poll", 2 * 60 * 60 * 1000);
  const { status, body } = await deep(mod, e);
  assert.equal(status, 503, "a poll 2 hours old returns 503");
  assert.equal(body.ok, false);
  assert.equal(body.jobs.poll.overdue, true);
  assert.equal(body.jobs.connectors.overdue, false, "fresh daily job is not overdue");
}

test("constants: thresholds are 75 minutes and 26 hours", () => {
  assert.equal(POLL_MAX_AGE_MS, 75 * 60 * 1000);
  assert.equal(DAILY_MAX_AGE_MS, 26 * 60 * 60 * 1000);
  assert.deepEqual(Object.keys(JOB_THRESHOLDS).sort(), ["connectors", "digest", "members", "poll", "qons"]);
});

test("migration 0008: job_runs and its index exist beside 0001-0007", () => {
  const e = env();
  const cols = e.ARCHIVE.raw.prepare(`PRAGMA table_info(job_runs)`).all().map((c) => c.name);
  assert.deepEqual(cols, ["id", "job", "started_at", "finished_at", "outcome", "detail"]);
  const idx = e.ARCHIVE.raw.prepare(`PRAGMA index_list(job_runs)`).all().map((i) => i.name);
  assert.ok(idx.includes("idx_job_runs_job_started"));
  for (const t of ["signals", "feed_health", "members", "connector_checks"]) {
    assert.ok(e.ARCHIVE.raw.prepare(`SELECT name FROM sqlite_master WHERE name = ?`).get(t), `${t} present`);
  }
  // Idempotent: re-running 0008 on a migrated database is a no-op.
  const sql = readFileSync(fileURLToPath(new URL("../migrations/0008_job_runs.sql", import.meta.url)), "utf8");
  e.ARCHIVE.raw.exec(sql);
  assert.throws(() => e.ARCHIVE.raw.prepare(
    `INSERT INTO job_runs (job, started_at, outcome) VALUES ('poll', 'x', 'bogus')`).run(), /CHECK/);
});

test("(a) fresh ok runs for every job give 200 ok:true", async () => {
  const e = env();
  seedAllFresh(e);
  const { status, body, res } = await deep(worker, e);
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(res.headers.get("cache-control"), "no-store");
  for (const job of Object.keys(JOB_THRESHOLDS)) {
    assert.equal(body.jobs[job].overdue, false, job);
    assert.equal(body.jobs[job].last_outcome, "ok", job);
    assert.ok(body.jobs[job].last_ok_at, job);
  }
});

test("(b) a poll 2 hours old gives 503 with overdue:true", async () => {
  await assertStalePollIs503(worker);
});

test("(b) a daily job 27 hours old gives 503; 25 hours old is fine", async () => {
  const e = env();
  seedAllFresh(e);
  e.ARCHIVE.raw.exec(`DELETE FROM job_runs WHERE job = 'qons'`);
  seedRun(e, "qons", 25 * 60 * 60 * 1000);
  assert.equal((await deep(worker, e)).status, 200);
  e.ARCHIVE.raw.exec(`DELETE FROM job_runs WHERE job = 'qons'`);
  seedRun(e, "qons", 27 * 60 * 60 * 1000);
  const { status, body } = await deep(worker, e);
  assert.equal(status, 503);
  assert.equal(body.jobs.qons.overdue, true);
});

test("(b) a recent error run does not count as ok", async () => {
  const e = env();
  seedAllFresh(e);
  e.ARCHIVE.raw.exec(`DELETE FROM job_runs WHERE job = 'poll'`);
  seedRun(e, "poll", 2 * 60 * 60 * 1000, "ok");
  seedRun(e, "poll", 60_000, "error");
  const { status, body } = await deep(worker, e);
  assert.equal(status, 503);
  assert.equal(body.jobs.poll.last_outcome, "error");
  assert.equal(body.jobs.poll.overdue, true);
});

test("(b) an empty run log is 503 with every job overdue", async () => {
  const { status, body } = await deep(worker, env());
  assert.equal(status, 503);
  for (const job of Object.keys(JOB_THRESHOLDS)) assert.equal(body.jobs[job].overdue, true, job);
});

test("D1 error: 503 with a generic note and no stack", async () => {
  const e = env();
  e.ARCHIVE.raw.exec(`DROP TABLE job_runs`);
  const { status, body } = await deep(worker, e);
  assert.equal(status, 503);
  assert.deepEqual(body, { ok: false, note: "job run log unavailable" });
});

test("/healthz stays a liveness probe: 200 with an empty run log", async () => {
  const res = await worker.fetch(new Request("https://w.test/healthz"), env(), ctx());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test("/healthz/deep is rate-limited through READ_LIMITS", async () => {
  const e = env();
  seedAllFresh(e);
  const statuses = [];
  for (let i = 0; i < 32; i += 1) {
    const res = await worker.fetch(new Request("https://w.test/healthz/deep", { headers: { "cf-connecting-ip": "1.2.3.4" } }), e, ctx());
    statuses.push(res.status);
  }
  assert.equal(statuses.filter((s) => s === 200).length, 30);
  assert.equal(statuses.at(-1), 429);
});

test("(c) a failing job records outcome error and scheduled() resolves", async () => {
  const e = env();
  // ingestMembers reads signals; dropping it makes the members job throw.
  e.ARCHIVE.raw.exec(`DROP TABLE signals`);
  const c = ctx();
  await withFetch(async () => { throw new Error("network down for ops@example.com"); }, async () => {
    await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, c);
    await Promise.all(c.pending);
  });
  const rows = e.ARCHIVE.raw.prepare(`SELECT job, outcome, finished_at, detail FROM job_runs ORDER BY job`).all();
  assert.deepEqual(rows.map((r) => r.job), ["members", "poll"]);
  for (const r of rows) {
    assert.equal(r.outcome, "error", r.job);
    assert.ok(r.finished_at, `${r.job} finished`);
  }
});

test("(c) recordJobRun never rejects, even with no job_runs table", async () => {
  const e = env();
  e.ARCHIVE.raw.exec(`DROP TABLE job_runs`);
  let ran = false;
  await recordJobRun(e, "poll", async () => { ran = true; throw new Error("boom"); }, () => ({ outcome: "ok", counts: {} }));
  assert.ok(ran, "the job still ran without a run log");
  const c = ctx();
  await worker.scheduled({ cron: "0 19 * * *", scheduledTime: Date.now() }, e, c);
  await Promise.all(c.pending);
});

test("(d) partial poll: some feeds fail; detail never contains '@'", async () => {
  const e = env();
  const failing = APH_FEEDS[0].url;
  const c = ctx();
  await withFetch(async (input) => {
    const u = typeof input === "string" ? input : input.url;
    if (u === failing) return new Response("blocked for admin@example.com", { status: 403 });
    return new Response(XML, { status: 200, headers: { "content-type": "application/rss+xml" } });
  }, async () => {
    await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, c);
    await Promise.all(c.pending);
  });
  const poll = e.ARCHIVE.raw.prepare(`SELECT outcome, detail FROM job_runs WHERE job = 'poll'`).get();
  assert.equal(poll.outcome, "partial");
  const d = JSON.parse(poll.detail);
  assert.equal(d.feeds, APH_FEEDS.length);
  assert.equal(d.feeds_failed, 1);
  const details = e.ARCHIVE.raw.prepare(`SELECT detail FROM job_runs`).all().map((r) => r.detail);
  assert.ok(details.length >= 2);
  for (const det of details) assert.ok(!det.includes("@"), `detail carries '@': ${det}`);
});

test("(d) detail keeps numeric counts only, drops strings, and is truncated", async () => {
  const e = env();
  await recordJobRun(e, "digest", async () => ({ to: "reader@example.com" }), (r) => ({
    outcome: "ok",
    counts: { delivered: 2, recipient: r.to, "bad key@x": 1, body: "<rss>raw</rss>" },
  }));
  await recordJobRun(e, "qons", async () => { throw new Error("upstream said hello@example.com"); }, () => ({ outcome: "ok", counts: {} }));
  const rows = e.ARCHIVE.raw.prepare(`SELECT job, outcome, detail FROM job_runs ORDER BY id`).all();
  assert.deepEqual(JSON.parse(rows[0].detail), { delivered: 2 });
  assert.equal(rows[1].outcome, "error");
  for (const r of rows) assert.ok(!r.detail.includes("@"));
  const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]));
  assert.ok(countsDetail(many).length <= jobs.DETAIL_MAX_CHARS);
});

test("0 5 job: connector link rot stays ok, and rows over 30 days are pruned", async () => {
  const e = env();
  seedRun(e, "poll", 31 * 24 * 60 * 60 * 1000);
  seedRun(e, "poll", 29 * 24 * 60 * 60 * 1000);
  const c = ctx();
  await withFetch(async (input) => {
    const u = typeof input === "string" ? input : input.url;
    return new Response("", { status: u.startsWith("https://parlinfo.aph.gov.au") ? 403 : 200 });
  }, async () => {
    await worker.scheduled({ cron: "0 5 * * *", scheduledTime: Date.now() }, e, c);
    await Promise.all(c.pending);
  });
  const conn = e.ARCHIVE.raw.prepare(`SELECT outcome, detail FROM job_runs WHERE job = 'connectors'`).get();
  assert.equal(conn.outcome, "ok");
  assert.equal(JSON.parse(conn.detail).links_failed, 1);
  const polls = e.ARCHIVE.raw.prepare(`SELECT COUNT(*) AS n FROM job_runs WHERE job = 'poll'`).get().n;
  assert.equal(polls, 1, "the 31-day-old row is pruned, the 29-day-old row kept");
});

test("0 19 job: qons and digest are both recorded ok", async () => {
  const e = env();
  const c = ctx();
  await withFetch(async () => new Response("<html></html>", { status: 200 }), async () => {
    await worker.scheduled({ cron: "0 19 * * *", scheduledTime: Date.now() }, e, c);
    await Promise.all(c.pending);
  });
  const rows = e.ARCHIVE.raw.prepare(`SELECT job, outcome FROM job_runs ORDER BY job`).all();
  assert.deepEqual(rows.map((r) => [r.job, r.outcome]), [["digest", "ok"], ["qons", "ok"]]);
});

test("(e) canary: a scratch Worker hard-coded to ok:true fails the stale-poll check", async () => {
  const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), "pp-health-canary-"));
  try {
    const dst = join(scratch, "src");
    cpSync(srcDir, dst, { recursive: true });
    const jobsPath = join(dst, "jobs.ts");
    const original = readFileSync(jobsPath, "utf8");
    const mutated = original.replace("return { ok, jobs, feeds_failed };", "return { ok: true, jobs, feeds_failed };");
    assert.notEqual(mutated, original, "canary mutation must apply");
    writeFileSync(jobsPath, mutated);
    const { default: broken } = await import(pathToFileURL(join(dst, "index.ts")).href);
    await assert.rejects(
      () => assertStalePollIs503(broken),
      assert.AssertionError,
      "stale-poll check passed against a hard-coded ok:true Worker: the check is untrustworthy",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

// ---- 0.16.3 (security review 5 Oct 2026) ------------------------------------

test("0.16.3 a recent partial poll counts as a successful run and reports feeds_failed", async () => {
  // Live state on 5 Oct 2026: Bills Digests 403 since 3 Oct, so every poll was
  // partial and /healthz/deep was 503 permanently.
  const e = env();
  seedAllFresh(e);
  e.ARCHIVE.raw.exec(`DELETE FROM job_runs WHERE job = 'poll'`);
  const at = new Date(Date.now() - 60_000).toISOString();
  e.ARCHIVE.raw
    .prepare(`INSERT INTO job_runs (job, started_at, finished_at, outcome, detail) VALUES ('poll', ?, ?, 'partial', ?)`)
    .run(at, at, JSON.stringify({ feeds: 13, feeds_failed: 1, new_items: 0, seen_items: 200 }));
  const { status, body } = await deep(worker, e);
  assert.equal(status, 200, "one blocked feed does not make the monitor alarm");
  assert.equal(body.ok, true);
  assert.equal(body.jobs.poll.last_outcome, "partial");
  assert.equal(body.jobs.poll.overdue, false);
  assert.equal(body.feeds_failed, 1, "the failing feed is still reported");
});

test("0.16.3 a stale partial poll is still overdue", async () => {
  const e = env();
  seedAllFresh(e);
  e.ARCHIVE.raw.exec(`DELETE FROM job_runs WHERE job = 'poll'`);
  seedRun(e, "poll", 2 * 60 * 60 * 1000, "partial");
  const { status, body } = await deep(worker, e);
  assert.equal(status, 503);
  assert.equal(body.jobs.poll.overdue, true);
});

test("0.16.3 /healthz drops mail config; /healthz/deep carries resend_wired", async () => {
  const e = { ...env(), RESEND_API_KEY: "re_test", DIGEST_FROM_EMAIL: "noreply@example.com" };
  const live = await (await worker.fetch(new Request("https://w.test/healthz"), e, ctx())).json();
  assert.equal(live.ok, true);
  assert.ok(!("resend_wired" in live), "no resend_wired on the public probe");
  assert.ok(!("digest_from" in live), "no digest_from on the public probe");
  assert.ok(!JSON.stringify(live).includes("@"), "no address on the public probe");
  seedAllFresh(e);
  const { body } = await deep(worker, e);
  assert.equal(body.resend_wired, true);
});

test("0.16.3 /healthz is rate-limited at 60 a minute", async () => {
  const e = env();
  const statuses = [];
  for (let i = 0; i < 62; i += 1) {
    const res = await worker.fetch(new Request("https://w.test/healthz", { headers: { "cf-connecting-ip": "5.6.7.8" } }), e, ctx());
    statuses.push(res.status);
  }
  assert.equal(statuses.filter((x) => x === 200).length, 60);
  assert.equal(statuses.at(-1), 429);
});
