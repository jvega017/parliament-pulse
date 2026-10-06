// Worker 0.16.9: scheduled runs left unfinished when APH stalls (6 Oct 2026).
// Real SQL (node:sqlite, every migration applied) through
// tests/support/sqlite-d1.mjs, which now also enforces D1's 100 bound
// parameters and 100 KB statement limits and counts queries.
//
// Since 30 Sep 2026 production job_runs held rows with a NULL outcome: the
// poll cleared its 8 s abort timer when headers arrived and then awaited
// res.text() with no limit, checkConnectors had no timeout, recordJobRun
// wrote the finish row only after fn() settled, and /healthz/deep read only
// finished rows.
//
// The fake fetch below carries the Workers platform behaviour these tests
// depend on (developers.cloudflare.com/workers/platform/limits, read 6 Oct
// 2026): at most six fetches waiting for response headers per invocation, a
// seventh queued until one answers; an AbortSignal rejects a pending or
// queued fetch and errors a body that is still streaming.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.9.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, memoryKv, D1_MAX_BOUND_PARAMS } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { default: worker } = await import("../src/index.ts");
const archive = await import("../src/archive.ts");
const jobs = await import("../src/jobs.ts");
const { ingestQons } = await import("../src/hansard.ts");
const { APH_FEEDS, APH_REFERENCE_LINKS } = await import("../src/feeds.ts");
const { pollAndArchive, backfillThreads, FEED_FETCH_TIMEOUT_MS, CONNECTOR_TIMEOUT_MS } = archive;
const { recordJobRun, reapAbandoned, deepHealth, JOB_BUDGET_MS } = jobs;

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const env = () => ({ ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() });
const ctx = () => ({ pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} });
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));

function abortError() {
  const e = new Error("The operation was aborted");
  e.name = "AbortError";
  return e;
}

/**
 * A platform-faithful fetch. `route(url)` returns one of:
 *   { body: string, status? }  answer at once
 *   { hangHeaders: true }      never send headers
 *   { stallBody: true }        send headers and one chunk, then nothing
 * Records cancelled bodies in `cancelled` and the peak count of fetches
 * waiting for headers in `peak`.
 */
function platformFetch(route) {
  const MAX_WAITING = 6;
  const state = { waiting: 0, peak: 0, queue: [], cancelled: new Set(), calls: [] };
  const release = () => {
    state.waiting -= 1;
    const next = state.queue.shift();
    if (next) next();
  };
  const acquire = (signal) => new Promise((resolve, reject) => {
    const go = () => {
      if (signal?.aborted) { reject(abortError()); if (state.queue.length) state.queue.shift()(); return; }
      state.waiting += 1;
      state.peak = Math.max(state.peak, state.waiting);
      resolve();
    };
    if (state.waiting < MAX_WAITING) go();
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
    if (r.hangHeaders) {
      return new Promise((_, reject) => {
        if (signal?.aborted) { release(); reject(abortError()); return; }
        signal?.addEventListener("abort", () => { release(); reject(abortError()); }, { once: true });
      });
    }
    release();
    if (r.stallBody) {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>`));
          signal?.addEventListener("abort", () => { try { c.error(abortError()); } catch { /* closed */ } }, { once: true });
        },
        cancel() { state.cancelled.add(url); },
      });
      return new Response(stream, { status: 200 });
    }
    const bytes = new TextEncoder().encode(r.body ?? EMPTY);
    const stream = new ReadableStream({
      start(c) { c.enqueue(bytes); c.close(); },
      cancel() { state.cancelled.add(url); },
    });
    return new Response(stream, { status: r.status ?? 200 });
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

const ITEM = (n, p) => `<item><title>Item ${p} ${n}</title><link>https://www.aph.gov.au/${p}/${n}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`;
const RSS = (n, p = "x") => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${Array.from({ length: n }, (_, i) => ITEM(i, p)).join("")}</channel></rss>`;
const slug = (url) => url.replace(/[^a-z0-9]+/gi, "_");

// ---- The shim enforces the limits it fakes --------------------------------------

test("shim: D1's 100 bound parameters is enforced, and 100 itself is allowed (detection and restraint)", async () => {
  const e = env();
  const sql = (n) => `SELECT guid FROM signals WHERE guid IN (${Array.from({ length: n }, () => "?").join(", ")})`;
  const ok = await e.ARCHIVE.prepare(sql(D1_MAX_BOUND_PARAMS)).bind(...Array.from({ length: D1_MAX_BOUND_PARAMS }, (_, i) => `g${i}`)).all();
  assert.deepEqual(ok.results, []);
  await assert.rejects(
    e.ARCHIVE.prepare(sql(D1_MAX_BOUND_PARAMS + 1)).bind(...Array.from({ length: D1_MAX_BOUND_PARAMS + 1 }, (_, i) => `g${i}`)).all(),
    /too many SQL variables/,
  );
  await assert.rejects(e.ARCHIVE.prepare(`SELECT 1 /* ${"x".repeat(100_001)} */`).all(), /too long/);
});

test("fake fetch: a seventh fetch waits for headers to free a slot (the platform limit it fakes)", async () => {
  const f = platformFetch((url) => (url.endsWith("/slow") ? { hangHeaders: true } : { body: "x" }));
  const controllers = Array.from({ length: 6 }, () => new AbortController());
  const hung = controllers.map((c) => f.impl("https://a.test/slow", { signal: c.signal }).catch((err) => err));
  let seventh = false;
  const p = f.impl("https://a.test/fast").then(() => { seventh = true; });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(seventh, false, "queued behind six fetches awaiting headers");
  controllers[0].abort();
  await p;
  assert.equal(seventh, true);
  assert.equal(f.state.peak, 6);
  for (const c of controllers) c.abort();
  for (const h of await Promise.all(hung)) assert.equal(h.name, "AbortError");
});

// ---- 1. Poll: deadline covers the body ---------------------------------------------

test("1. a feed whose body never ends: the poll finishes partial within about 10 s and the run row closes", async () => {
  const stalled = APH_FEEDS[0].url;
  const f = platformFetch((url) => (url === stalled ? { stallBody: true } : { body: RSS(2) }));
  const e = env();
  const c = ctx();
  const t0 = Date.now();
  await withFetch(f.impl, async () => {
    await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, c);
    await within(Promise.all(c.pending), 15_000, "poll");
  });
  const secs = (Date.now() - t0) / 1000;
  assert.ok(secs >= FEED_FETCH_TIMEOUT_MS / 1000 - 0.5 && secs < 12, `poll took ${secs}s`);
  const [run] = rows(e, `SELECT outcome, finished_at, detail FROM job_runs WHERE job = 'poll'`);
  assert.equal(run.outcome, "partial");
  assert.ok(run.finished_at);
  assert.equal(JSON.parse(run.detail).feeds_failed, 1);
  const [h] = rows(e, `SELECT last_http_status, parse_error FROM feed_health WHERE feed_url = ?`, stalled);
  assert.deepEqual(h, { last_http_status: 0, parse_error: "fetch timed out" });
});

test("1. a non-ok feed response has its unread body cancelled", async () => {
  const blocked = APH_FEEDS[1].url;
  const f = platformFetch((url) => (url === blocked ? { status: 403, body: "<html>blocked</html>" } : { body: EMPTY }));
  const e = env();
  const r = await withFetch(f.impl, () => pollAndArchive(e));
  assert.equal(r.perFeed.find((p) => p.feed === blocked).error, "HTTP 403");
  assert.ok(f.state.cancelled.has(blocked), "403 body cancelled");
  assert.equal(f.state.cancelled.size, 1, "a read body is never cancelled (restraint)");
});

test("1. a body over RSS_MAX_BYTES is a failed feed, not a hung or crashed poll", async () => {
  const big = APH_FEEDS[2].url;
  const f = platformFetch((url) => (url === big ? { body: "x".repeat(2 * 1024 * 1024 + 1) } : { body: EMPTY }));
  const r = await withFetch(f.impl, () => pollAndArchive(env()));
  assert.equal(r.perFeed.find((p) => p.feed === big).error, "body too large");
  assert.equal(r.perFeed.filter((p) => p.ok).length, APH_FEEDS.length - 1);
});

// ---- 8. Fetch concurrency (no limit added) ---------------------------------------
// Item 8 was conditional on a test showing queued fetches timing out. Under
// the fake platform's six-awaiting-headers limit they do not: as each dead
// feed's deadline frees its slot, a queued feed is answered before its own
// deadline fires. Kept as a guard; it passes with and without a limiter.

test("8. six feeds that never answer do not time out the feeds queued behind them", async () => {
  const dead = new Set(APH_FEEDS.slice(0, 6).map((f) => f.url));
  const f = platformFetch((url) => (dead.has(url) ? { hangHeaders: true } : { body: RSS(1) }));
  const r = await withFetch(f.impl, () => within(pollAndArchive(env()), 30_000, "poll"));
  const failed = r.perFeed.filter((p) => !p.ok);
  assert.deepEqual(failed.map((p) => p.feed).sort(), [...dead].sort());
  for (const p of failed) assert.equal(p.error, "fetch timed out");
  assert.equal(r.perFeed.filter((p) => p.ok).length, APH_FEEDS.length - 6, "every answering feed archived");
  assert.equal(f.state.peak, 6, "the platform limit was reached");
});

// ---- 2. Connectors -----------------------------------------------------------------

test("2. a hanging connector link is recorded as 'fetch timed out' and the job finishes ok", async () => {
  const hanging = APH_REFERENCE_LINKS[0];
  const f = platformFetch((url) => (url === hanging ? { hangHeaders: true } : url === APH_REFERENCE_LINKS[1] ? { status: 404, body: "gone" } : { body: "<html>ok</html>" }));
  const e = env();
  const c = ctx();
  const t0 = Date.now();
  await withFetch(f.impl, async () => {
    await worker.scheduled({ cron: "0 5 * * *", scheduledTime: Date.now() }, e, c);
    await within(Promise.all(c.pending), 20_000, "connectors");
  });
  const secs = (Date.now() - t0) / 1000;
  assert.ok(secs >= CONNECTOR_TIMEOUT_MS / 1000 - 0.5 && secs < 12, `connectors took ${secs}s`);
  const checks = rows(e, `SELECT url, status, ok, error FROM connector_checks ORDER BY id`);
  assert.equal(checks.length, APH_REFERENCE_LINKS.length);
  assert.deepEqual(checks[0], { url: hanging, status: 0, ok: 0, error: "fetch timed out" });
  assert.deepEqual(checks[1], { url: APH_REFERENCE_LINKS[1], status: 404, ok: 0, error: "HTTP 404" });
  assert.equal(checks.filter((x) => x.ok === 1).length, APH_REFERENCE_LINKS.length - 2);
  // Every answered link's body is cancelled, ok or not; none is read.
  for (const u of APH_REFERENCE_LINKS.slice(1)) assert.ok(f.state.cancelled.has(u), `cancelled ${u}`);
  const [run] = rows(e, `SELECT outcome, detail FROM job_runs WHERE job = 'connectors'`);
  assert.equal(run.outcome, "ok");
  assert.equal(JSON.parse(run.detail).links_failed, 2);
});

test("2 (sibling). a ParlInfo QON page whose body never ends: ingestQons returns, adds nothing", async () => {
  const f = platformFetch(() => ({ stallBody: true }));
  const r = await withFetch(f.impl, () => within(ingestQons(env()), 15_000, "ingestQons"));
  assert.deepEqual(r, { added: 0, attempted: 0 });
});

// ---- 3. Job budget -----------------------------------------------------------------

test("3. a fn() that never resolves records error {timed_out:1}", async () => {
  assert.equal(JOB_BUDGET_MS, 10 * 60 * 1000);
  const e = env();
  await within(recordJobRun(e, "poll", () => new Promise(() => {}), () => ({ outcome: "ok", counts: {} }), 50), 5_000, "recordJobRun");
  const [run] = rows(e, `SELECT outcome, finished_at, detail FROM job_runs`);
  assert.equal(run.outcome, "error");
  assert.ok(run.finished_at);
  assert.deepEqual(JSON.parse(run.detail), { timed_out: 1 });
});

test("3 restraint. a fn() that finishes inside the budget keeps its own outcome", async () => {
  const e = env();
  await recordJobRun(e, "poll", async () => 7, (n) => ({ outcome: "partial", counts: { n } }), 5_000);
  const [run] = rows(e, `SELECT outcome, detail FROM job_runs`);
  assert.equal(run.outcome, "partial");
  assert.deepEqual(JSON.parse(run.detail), { n: 7 });
});

// ---- 4. Reaper ---------------------------------------------------------------------

test("4. a NULL row seeded 30 min ago is reaped; one seeded 5 min ago is left alone", async () => {
  const e = env();
  const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
  e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at) VALUES ('poll', ?)`).run(ago(30));
  e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at) VALUES ('members', ?)`).run(ago(5));
  await recordJobRun(e, "connectors", async () => 1, () => ({ outcome: "ok", counts: {} }));
  const got = rows(e, `SELECT job, outcome, finished_at IS NOT NULL AS done, detail FROM job_runs ORDER BY id`);
  assert.deepEqual(got[0], { job: "poll", outcome: "error", done: 1, detail: `{"abandoned":1}` });
  assert.deepEqual(got[1], { job: "members", outcome: null, done: 0, detail: null });
  assert.equal(got[2].outcome, "ok");
});

test("4. reapAbandoned never throws, and a D1 error does not stop the job", async () => {
  const broken = { ARCHIVE: { prepare() { throw new Error("D1 down"); } } };
  assert.equal(await reapAbandoned(broken), 0);
  const e = env();
  const prepare = e.ARCHIVE.prepare.bind(e.ARCHIVE);
  e.ARCHIVE.prepare = (sql) => {
    if (/^\s*UPDATE job_runs SET finished_at = \?, outcome = 'error'/.test(sql)) throw new Error("D1 down");
    return prepare(sql);
  };
  let ran = false;
  await recordJobRun(e, "poll", async () => { ran = true; }, () => ({ outcome: "ok", counts: {} }));
  assert.equal(ran, true);
  assert.equal(rows(e, `SELECT outcome FROM job_runs`)[0].outcome, "ok");
});

// ---- 5. /healthz/deep --------------------------------------------------------------

function seedFresh(e) {
  const at = new Date(Date.now() - 60_000).toISOString();
  for (const job of Object.keys(jobs.JOB_THRESHOLDS)) {
    e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at, finished_at, outcome, detail) VALUES (?, ?, ?, 'ok', '{}')`).run(job, at, at);
  }
}

test("5. /healthz/deep reports a run open past the budget as stuck (503); a fresh open run is running, not stuck", async () => {
  const e = env();
  seedFresh(e);
  const stuckAt = new Date(Date.now() - 15 * 60_000).toISOString();
  e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at) VALUES ('poll', ?)`).run(stuckAt);
  let res = await worker.fetch(new Request("https://w.test/healthz/deep"), e, ctx());
  let body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.ok, false);
  assert.equal(body.jobs.poll.stuck, true);
  assert.equal(body.jobs.poll.running_since, stuckAt);
  assert.equal(body.jobs.poll.overdue, false, "the last ok poll is recent; stuck is reported on its own");

  const e2 = env();
  seedFresh(e2);
  const liveAt = new Date(Date.now() - 2 * 60_000).toISOString();
  e2.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at) VALUES ('poll', ?)`).run(liveAt);
  res = await worker.fetch(new Request("https://w.test/healthz/deep"), e2, ctx());
  body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.jobs.poll.stuck, false);
  assert.equal(body.jobs.poll.running_since, liveAt);
  assert.equal(body.jobs.members.running_since, null);
});

test("5. /healthz/deep names an abandoned or timed-out latest run", async () => {
  const e = env();
  seedFresh(e);
  const t = Date.now();
  e.ARCHIVE.raw.prepare(`INSERT INTO job_runs (job, started_at) VALUES ('poll', ?)`).run(new Date(t - 30 * 60_000).toISOString());
  await reapAbandoned(e, t);
  await recordJobRun(e, "members", () => new Promise(() => {}), () => ({ outcome: "ok", counts: {} }), 20);
  const h = await deepHealth(e, t + 1000);
  assert.equal(h.jobs.poll.last_outcome, "error");
  assert.equal(h.jobs.poll.last_failure, "abandoned");
  assert.equal(h.jobs.members.last_failure, "timed_out");
  assert.equal(h.jobs.connectors.last_failure, null, "an ok run names no failure (restraint)");
});

// ---- 6. backfillThreads ------------------------------------------------------------

function recordSql(e) {
  const seen = [];
  const prepare = e.ARCHIVE.prepare.bind(e.ARCHIVE);
  e.ARCHIVE.prepare = (sql) => { seen.push(sql); return prepare(sql); };
  return seen;
}
const CANDIDATE_LOAD = /SELECT thread_id, fingerprint FROM threads ORDER BY last_seen_at DESC LIMIT \?/;

test("6. backfillThreads skips the candidate load when nothing needs healing", async () => {
  const e = env();
  const seen = recordSql(e);
  const r = await backfillThreads(e, 25);
  assert.deepEqual(r, { processed: 0, failed: 0, threadsCreated: 0, threadsJoined: 0 });
  assert.equal(seen.filter((s) => CANDIDATE_LOAD.test(s)).length, 0);
});

test("6 restraint. with an unthreaded row the candidates load and the row is threaded", async () => {
  const e = env();
  e.ARCHIVE.raw.prepare(
    `INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, attention, confidence)
     VALUES ('g1', 'Inquiry into things', 'https://www.aph.gov.au/x/1', 'f', 'F', 'Senate', 'inquiry', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'med', 3)`,
  ).run();
  const seen = recordSql(e);
  const r = await backfillThreads(e, 25);
  assert.equal(r.processed, 1);
  assert.equal(seen.filter((s) => CANDIDATE_LOAD.test(s)).length, 1);
});

// ---- 7. Legacy-form lookup batched per feed --------------------------------------

const PER_ITEM_LEGACY = /^SELECT guid FROM signals WHERE guid IN \(/;

test("7. the legacy-form lookup is one chunked query per feed, not one per item", async () => {
  const one = APH_FEEDS[0].url;
  const f = platformFetch((url) => ({ body: url === one ? RSS(30) : EMPTY }));
  const e = env();
  const seen = recordSql(e);
  await withFetch(f.impl, () => pollAndArchive(e));
  const lookups = seen.filter((s) => PER_ITEM_LEGACY.test(s));
  // 30 items x (guid = link, link#pubDate) legacy forms = 60 aphcms forms,
  // one chunk of at most 90 parameters.
  assert.equal(lookups.length, 1, `legacy lookups: ${lookups.length}`);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals`)[0].n, 30);
});

test("7 restraint. a legacy aphcms row is still renamed to its www guid and keeps its history", async () => {
  const feed = APH_FEEDS.find((x) => x.label === "Upcoming Senate hearings");
  const path = "Parliamentary_Business/Committees/Senate/Thing/Hearings";
  const www = `https://www.aph.gov.au/${path}`;
  const first = "2026-08-10T01:30:38.200Z";
  const e = env();
  e.ARCHIVE.raw.prepare(
    `INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, attention, confidence)
     VALUES (?, 'Thing hearings', ?, ?, ?, 'Senate', ?, ?, ?, 'med', 3)`,
  ).run(`https://aphcms.aph.gov.au/${path}`, `https://aphcms.aph.gov.au/${path}`, feed.url, feed.label, feed.kind, first, first);
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>Thing hearings</title><link>${www}</link></item></channel></rss>`;
  const f = platformFetch((url) => ({ body: url === feed.url ? xml : EMPTY }));
  await withFetch(f.impl, () => pollAndArchive(e));
  assert.deepEqual(rows(e, `SELECT guid, first_seen_at FROM signals`), [{ guid: www, first_seen_at: first }]);
});

// Production polls saw 190 items across 13 feeds (job_runs, 6 Oct 2026).
test("7. a 13-feed, 195-item re-poll stays well under D1's 1,000 queries per invocation", async () => {
  const f = platformFetch((url) => ({ body: RSS(15, slug(url)) }));
  const e = env();
  e.ARCHIVE.resetQueries();
  await withFetch(f.impl, () => pollAndArchive(e));
  const first = e.ARCHIVE.queries;
  e.ARCHIVE.resetQueries();
  await withFetch(f.impl, () => pollAndArchive(e));
  const second = e.ARCHIVE.queries;
  console.info?.(`queries: first poll ${first}, re-poll ${second}`);
  assert.ok(first < 1000 && second < 1000, `polls used ${first} and ${second} queries`);
  // 0.16.8 spent one legacy SELECT per item on top of the upsert; batched,
  // a re-poll is about one upsert per item plus per-feed work.
  assert.ok(second < 195 * 1.5, `re-poll used ${second} queries for 195 items`);
});
