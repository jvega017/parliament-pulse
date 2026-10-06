// Worker 0.16.10: fixes from the recheck of 0.16.9 (6 Oct 2026). Real SQL
// (node:sqlite, every migration applied) through tests/support/sqlite-d1.mjs,
// which now refuses the 1,001st query of a simulated invocation.
//
//   1. Feed-fetch queue cascade. 0.16.9 started all 13 feed fetches, and
//      their 8 s timers, at once. The platform holds a seventh fetch until
//      one of six open connections closes, so six feeds that never answer
//      freed their slots at 8 s, exactly when the queued seven's own timers
//      fired: all 13 failed. 0.16.9's fake answered a queued fetch in the same
//      macrotask as the abort that freed its slot, so its test "8." could not
//      see this. The fake below gives every answer network latency.
//   2. The reaper never alters a finished row (restraint).
//   3. fetchWithDeadline passes its signal to readCappedText (pinned with a
//      body that ignores abort).
//   4. D1's 1,000 queries per invocation: a restore-case poll (empty archive)
//      is bounded by MAX_NEW_PER_POLL.
//
// Each test here was run against a scratch copy with its fix reverted and
// failed there (see the commit message).
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.10.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv, D1_MAX_QUERIES_PER_INVOCATION, D1_QUERY_LIMIT_MESSAGE } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { default: worker } = await import("../src/index.ts");
const archive = await import("../src/archive.ts");
const jobs = await import("../src/jobs.ts");
const rssProxy = await import("../src/rssProxy.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");
const { pollAndArchive, FEED_FETCH_TIMEOUT_MS } = archive;
const { reapAbandoned, ABANDONED_AFTER_MS } = jobs;
const { fetchWithDeadline, readCappedText } = rssProxy;

console.warn = () => {};
console.log = () => {};
console.error = () => {};
const report = (s) => process.stdout.write(`# measured: ${s}\n`);

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const env = () => ({ ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() });
const ctx = () => ({ pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} });
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function abortError() {
  const e = new Error("The operation was aborted");
  e.name = "AbortError";
  return e;
}

/**
 * The 0.16.9 platform fake (six connections open at once, a seventh queued
 * until one closes; an AbortSignal rejects a pending or queued fetch) with
 * one change: an answer takes `latencyMs` of network time after its fetch
 * leaves the queue, holding its connection meanwhile. A queued fetch
 * therefore completes on a later macrotask than the abort that freed its
 * slot, as on the platform. `peak` is the most connections open at once.
 */
function latentFetch(route, latencyMs = 50) {
  const MAX_OPEN = 6;
  const state = { open: 0, peak: 0, queue: [], calls: [] };
  const release = () => {
    state.open -= 1;
    const next = state.queue.shift();
    if (next) next();
  };
  const acquire = (signal) => new Promise((resolve, reject) => {
    const go = () => {
      if (signal?.aborted) { reject(abortError()); const n = state.queue.shift(); if (n) n(); return; }
      state.open += 1;
      state.peak = Math.max(state.peak, state.open);
      resolve();
    };
    if (state.open < MAX_OPEN) go();
    else {
      const entry = () => go();
      state.queue.push(entry);
      signal?.addEventListener("abort", () => {
        const i = state.queue.indexOf(entry);
        if (i >= 0) { state.queue.splice(i, 1); reject(abortError()); }
      }, { once: true });
    }
  });
  const impl = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const signal = init.signal;
    state.calls.push(url);
    await acquire(signal);
    const r = route(url);
    await new Promise((resolve, reject) => {
      const onAbort = () => { clearTimeout(t); release(); reject(abortError()); };
      if (signal?.aborted) { onAbort(); return; }
      const t = r.hangHeaders ? null : setTimeout(() => { signal?.removeEventListener("abort", onAbort); release(); resolve(); }, latencyMs);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    return new Response(r.body ?? EMPTY, { status: r.status ?? 200 });
  };
  return { impl, state };
}

async function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

/** Rejects if `p` has not settled within `ms`, so a regression fails, not hangs. */
function within(p, ms, what) {
  let t;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`${what} did not finish within ${ms} ms`)), ms); }),
  ]);
}

// One fixed, fresh pubDate. A per-call new Date() changes between polls that
// straddle a second, and the Senate reports feed then reads every item as a
// new report at its link (keepStoredIdentity), so a re-poll is not a re-poll.
const PUB = new Date(Date.now() - 3_600_000).toUTCString();
const ITEM = (n, p) => `<item><title>Item ${p} ${n}</title><link>https://www.aph.gov.au/${p}/${n}</link><pubDate>${PUB}</pubDate></item>`;
const RSS = (n, p = "x") => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${Array.from({ length: n }, (_, i) => ITEM(i, p)).join("")}</channel></rss>`;
const slug = (url) => url.replace(/[^a-z0-9]+/gi, "_");

// ---- 1. Feed-fetch queue cascade -------------------------------------------------

test("fake fetch: a queued fetch whose slot frees as its own deadline fires does not complete (latency modelled)", async () => {
  const f = latentFetch((url) => (url.endsWith("/dead") ? { hangHeaders: true } : { body: "x" }), 50);
  const ctrls = Array.from({ length: 6 }, () => new AbortController());
  const dead = ctrls.map((c) => f.impl("https://a.test/dead", { signal: c.signal }).catch((e) => e));
  // All seven timers are armed together, as 0.16.9's were.
  const own = new AbortController();
  for (const c of ctrls) setTimeout(() => c.abort(), 100);
  setTimeout(() => own.abort(), 100);
  const queued = await f.impl("https://a.test/live", { signal: own.signal }).then(() => "answered", (e) => e.name);
  assert.equal(queued, "AbortError", "the queued fetch left the queue at 100 ms and needed 50 ms more");
  for (const d of await Promise.all(dead)) assert.equal(d.name, "AbortError");
  assert.equal(f.state.peak, 6);
  // Restraint: with its slot free, the same fetch is answered.
  const g = latentFetch(() => ({ body: "x" }), 50);
  const res = await g.impl("https://a.test/live", { signal: AbortSignal.timeout(1000) });
  assert.equal(await res.text(), "x");
});

test("1. six feeds that never answer: the seven live feeds still archive (0.16.9 failed all 13)", async () => {
  assert.equal(APH_FEEDS.length, 13);
  assert.equal(archive.FEED_FETCH_CONCURRENCY, 5);
  const dead = new Set(APH_FEEDS.slice(0, 6).map((x) => x.url));
  const f = latentFetch((url) => (dead.has(url) ? { hangHeaders: true } : { body: RSS(1, slug(url)) }), 50);
  const t0 = Date.now();
  const r = await withFetch(f.impl, () => within(pollAndArchive(env()), 40_000, "poll"));
  const secs = (Date.now() - t0) / 1000;
  report(`six dead feeds: poll ${secs.toFixed(1)} s, peak open connections ${f.state.peak}`);
  const failed = r.perFeed.filter((p) => !p.ok);
  assert.deepEqual(failed.map((p) => p.feed).sort(), [...dead].sort(), "only the dead feeds fail");
  for (const p of failed) assert.equal(p.error, "fetch timed out");
  assert.equal(r.perFeed.filter((p) => p.ok && p.new === 1).length, 7, "every live feed archived its item");
  assert.ok(f.state.peak <= archive.FEED_FETCH_CONCURRENCY, `peak ${f.state.peak}: no fetch waited in the platform queue`);
});

test("1. worst case: all 13 feeds dead, the poll still finishes within FEED_FETCH_WORST_CASE_MS (24 s)", async () => {
  assert.equal(archive.FEED_FETCH_WORST_CASE_MS, 24_000);
  const f = latentFetch(() => ({ hangHeaders: true }));
  const e = env();
  const c = ctx();
  const t0 = Date.now();
  await withFetch(f.impl, async () => {
    await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, c);
    await within(Promise.all(c.pending), 40_000, "poll");
  });
  const secs = (Date.now() - t0) / 1000;
  report(`all 13 feeds dead: poll ${secs.toFixed(1)} s (bound ${archive.FEED_FETCH_WORST_CASE_MS / 1000} s)`);
  assert.ok(secs >= 3 * FEED_FETCH_TIMEOUT_MS / 1000 - 0.5, `three waves of 8 s, took ${secs}s`);
  assert.ok(secs < archive.FEED_FETCH_WORST_CASE_MS / 1000 + 2, `took ${secs}s`);
  const [run] = rows(e, `SELECT outcome, finished_at, detail FROM job_runs WHERE job = 'poll'`);
  assert.equal(run.outcome, "error");
  assert.ok(run.finished_at);
  assert.equal(JSON.parse(run.detail).feeds_failed, 13);
  assert.ok(f.state.peak <= 5);
});

test("1. mapConcurrent keeps order, never exceeds its limit, and starts each call only when a slot frees", async () => {
  let live = 0;
  let peak = 0;
  const started = [];
  const t0 = Date.now();
  const out = await archive.mapConcurrent([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    started.push(Date.now() - t0);
    live += 1; peak = Math.max(peak, live);
    await sleep(40);
    live -= 1;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70]);
  assert.equal(peak, 3);
  assert.ok(started[3] >= 35, `the fourth call started at ${started[3]} ms, after a slot freed`);
});

// ---- 2. Reaper restraint ----------------------------------------------------------

test("2. the reaper never alters a finished row, however old; it closes only the open one", async () => {
  const e = env();
  const t = Date.now();
  const ago = (min) => new Date(t - min * 60_000).toISOString();
  const ins = e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at, finished_at, outcome, detail) VALUES (?, ?, ?, ?, ?)`);
  ins.run("poll", ago(90), ago(89), "ok", `{"feeds":13}`);
  ins.run("members", ago(45), ago(44), "partial", `{"added":1}`);
  ins.run("connectors", ago(30), ago(21), "error", `{"timed_out":1}`);
  ins.run("qons", ago(25), ago(25), "ok", null);
  e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at) VALUES ('digest', ?)`).run(ago(30));
  assert.ok(ABANDONED_AFTER_MS === 20 * 60_000);
  const before = rows(e, `SELECT * FROM job_runs WHERE finished_at IS NOT NULL ORDER BY id`);
  assert.equal(before.length, 4);
  const reaped = await reapAbandoned(e, t);
  assert.equal(reaped, 1, "detection: the reaper ran and closed the open row");
  assert.deepEqual(rows(e, `SELECT * FROM job_runs WHERE id <= 4 ORDER BY id`), before, "finished rows untouched");
  const [open] = rows(e, `SELECT outcome, detail FROM job_runs WHERE job = 'digest'`);
  assert.deepEqual(open, { outcome: "error", detail: `{"abandoned":1}` });
});

// ---- 3. The deadline's signal reaches readCappedText -----------------------------

/** A body that sends one chunk and then nothing, and ignores every abort signal. */
function deafBody() {
  const state = { cancelled: false };
  const stream = new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(`<?xml version="1.0"?><rss>`)); },
    cancel() { state.cancelled = true; },
  });
  return { stream, state };
}

test("3. a body that ignores abort still ends at the deadline: fetchWithDeadline hands readCappedText its signal", async () => {
  const body = deafBody();
  const impl = async () => new Response(body.stream, { status: 200 });
  const t0 = Date.now();
  const r = await withFetch(impl, () => within(
    fetchWithDeadline("https://a.test/feed", {}, { timeoutMs: 100, readBody: true, logLabel: "t" }),
    3_000, "fetchWithDeadline",
  ));
  assert.deepEqual({ ok: r.ok, status: r.status, error: r.error }, { ok: false, status: 0, error: "fetch timed out" });
  assert.ok(Date.now() - t0 < 1_500);
  assert.equal(body.state.cancelled, true, "the stalled body was cancelled, not left open");
});

test("3 restraint. readCappedText with no abort reads a complete body in full", async () => {
  const ctrl = new AbortController();
  const text = await readCappedText(new Response("<rss>ok</rss>"), 1024, ctrl.signal);
  assert.equal(text, "<rss>ok</rss>");
});

// ---- 4. D1's 1,000 queries per invocation ----------------------------------------

test("shim: the 1,001st query of one invocation is refused; each invocation counts its own", async () => {
  const e = env();
  const q = () => e.ARCHIVE.prepare(`SELECT 1 AS one`).first();
  const a = await e.ARCHIVE.invocation(async () => { for (let i = 0; i < D1_MAX_QUERIES_PER_INVOCATION; i++) await q(); });
  assert.equal(a.queries, 1000);
  assert.equal(a.refused, 0, "1,000 itself is allowed (restraint)");
  const b = await e.ARCHIVE.invocation(async () => {
    for (let i = 0; i < D1_MAX_QUERIES_PER_INVOCATION; i++) await q();
    await assert.rejects(q(), new RegExp(D1_QUERY_LIMIT_MESSAGE));
    await assert.rejects(e.ARCHIVE.batch([e.ARCHIVE.prepare(`SELECT 1`)]), new RegExp(D1_QUERY_LIMIT_MESSAGE));
  });
  assert.equal(b.queries, 1000);
  assert.equal(b.refused, 2, "a batch member counts as a query");
  // Two invocations at once keep separate counts, and neither touches the
  // instance counter outside them.
  e.ARCHIVE.resetQueries();
  const [x, y] = await Promise.all([
    e.ARCHIVE.invocation(async () => { for (let i = 0; i < 600; i++) { await q(); await sleep(0); } }),
    e.ARCHIVE.invocation(async () => { for (let i = 0; i < 600; i++) { await q(); await sleep(0); } }),
  ]);
  assert.deepEqual([x.queries, x.refused, y.queries, y.refused], [600, 0, 600, 0]);
  assert.equal(e.ARCHIVE.queries, 0);
  // Outside invocation(): the instance counter, restarted by resetQueries.
  for (let i = 0; i < 1000; i++) await q();
  await assert.rejects(q(), new RegExp(D1_QUERY_LIMIT_MESSAGE));
  e.ARCHIVE.resetQueries();
  await q();
  assert.equal(e.ARCHIVE.queries, 1);
});

// One half-hourly scheduled invocation (poll and members jobs) with its query count.
async function scheduledPoll(e, impl) {
  return withFetch(impl, () => e.ARCHIVE.invocation(async () => {
    const c = ctx();
    await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, c);
    await Promise.all(c.pending);
  }));
}
const lastPoll = (e) => JSON.parse(rows(e, `SELECT detail FROM job_runs WHERE job = 'poll' ORDER BY id DESC LIMIT 1`)[0].detail);

test("4. restore case: an empty archive and 208 new items stay under 1,000 queries in one invocation", async () => {
  const PER_FEED = 16;
  const total = APH_FEEDS.length * PER_FEED;
  const f = latentFetch((url) => ({ body: RSS(PER_FEED, slug(url)) }), 1);
  const e = env();
  const first = await scheduledPoll(e, f.impl);
  assert.equal(first.refused, 0, "no query was refused");
  const d1 = lastPoll(e);
  report(`restore poll 1: ${total} listed, ${d1.new_items} stored, ${d1.deferred_items ?? 0} deferred, ${first.queries} queries, ${first.refused} refused`);
  assert.ok(first.queries < D1_MAX_QUERIES_PER_INVOCATION, `${first.queries} queries`);
  assert.equal(d1.new_items, archive.MAX_NEW_PER_POLL, "the cap bounded the new-item work");
  assert.equal(d1.deferred_items, total - archive.MAX_NEW_PER_POLL);
  // The rest arrive on the next poll, still as new rows.
  const second = await scheduledPoll(e, f.impl);
  assert.equal(second.refused, 0);
  const d2 = lastPoll(e);
  report(`restore poll 2: ${d2.new_items} stored, ${d2.deferred_items ?? 0} deferred, ${second.queries} queries`);
  assert.ok(second.queries < D1_MAX_QUERIES_PER_INVOCATION);
  assert.equal(d2.new_items, total - archive.MAX_NEW_PER_POLL);
  assert.equal(d2.deferred_items, undefined);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals`)[0].n, total);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals s LEFT JOIN signal_threads t ON t.signal_guid = s.guid WHERE t.signal_guid IS NULL`)[0].n, 0, "every row threaded");
  // Restraint: a re-poll of the full archive defers nothing.
  const third = await scheduledPoll(e, f.impl);
  const d3 = lastPoll(e);
  report(`re-poll of ${total} stored items: ${third.queries} queries`);
  assert.equal(d3.new_items, 0);
  assert.equal(d3.deferred_items, undefined);
  assert.equal(third.refused, 0);
});

const REPORTS_XML = readFileSync(fileURLToPath(new URL("./fixtures/senate-reports-2026-10-05.xml", import.meta.url)), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

test("4. restore case on the real Senate reports fixture (134 reports, 130 inquiries at their links): every poll under the limit, nothing lost", async () => {
  const inquiries = APH_FEEDS.find((x) => x.label === "New Senate inquiries");
  const reports = APH_FEEDS.find((x) => x.label === "Senate reports tabled");
  const links = [...new Set(archive.parseFeed(REPORTS_XML, reports).map((r) => r.link))];
  const inqXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${links.map((l, i) => `<item><title>Inquiry ${i}</title><link>${esc(l)}</link><pubDate>Mon, 01 Jun 2026 00:00:00 +1000</pubDate></item>`).join("")}</channel></rss>`;
  const f = latentFetch((url) => ({ body: url === inquiries.url ? inqXml : url === reports.url ? REPORTS_XML : EMPTY }), 1);
  const e = env();
  const counts = [];
  for (let i = 0; i < 5; i++) {
    const r = await scheduledPoll(e, f.impl);
    assert.equal(r.refused, 0, `poll ${i + 1}: no query refused (${r.queries} run)`);
    const d = lastPoll(e);
    counts.push(`${r.queries}q/${(d.new_items ?? 0) + (d.backfilled_items ?? 0)}new/${d.deferred_items ?? 0}deferred`);
    assert.ok(r.queries < D1_MAX_QUERIES_PER_INVOCATION, `poll ${i + 1}: ${r.queries} queries`);
    if (!d.deferred_items) break;
  }
  report(`real-fixture restore (${links.length + 134} items): ${counts.join(", ")}`);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, reports.url)[0].n, 134, "no report dropped");
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, inquiries.url)[0].n, links.length);
  // Keys come out as one unbounded poll gives them: the inquiries feed, polled
  // first, holds each bare link, and every report is at link#pubDate. Once
  // the cap is reached every later new item waits, so no report can take a
  // waiting inquiry's bare link.
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ? AND guid = link`, inquiries.url)[0].n, links.length);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ? AND guid LIKE '%#%'`, reports.url)[0].n, 134);
});
