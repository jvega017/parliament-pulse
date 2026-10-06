// Worker 0.16.11: Bills Digests source blocks are reported honestly, and the
// feed has its own cadence (7 Oct 2026). Real SQL (node:sqlite, every
// migration applied) through tests/support/sqlite-d1.mjs; fetch is mocked.
//
// Evidence behind the change (archive.ts, "Source-blocked feeds"):
// parlinfo.aph.gov.au's Azure WAF answered the Worker's Bills Digests fetch
// with 403 on every poll from at least 2 Oct to 19:30 UTC 6 Oct 2026, then
// 200 again. Each 403 made the poll "partial" and the feed a red failure.
//
//   1. A 403 or 429 on a feed with blockedBackoffMinutes is "source blocked":
//      not a failed feed, the run is ok, the health row keeps the real HTTP
//      status and last_success_at, /healthz/deep reports feeds_blocked and
//      /healthz/connectors reports state source_blocked with next_poll_at.
//   2. Restraint: a 403 on a feed with no backoff is still a failure.
//   3. The scheduled poll fetches Bills Digests at most every 6 hours, and
//      after a source block at most every 24 hours.
//   4. Restraint: /admin/poll-now and a direct pollAndArchive fetch every feed.
//   5. Fail open: when the cadence read fails, every feed is fetched.
// The deferred-items carry-over (a poll after one that deferred new items
// fetches every feed) is pinned by tests/review-0.16.10.test.mjs test 4,
// which fails without it (88 deferred, 80 stored on the second poll).
//
// Each test here was run against a scratch copy with its fix reverted and
// failed there (see the commit message).
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.11.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { default: worker } = await import("../src/index.ts");
const archive = await import("../src/archive.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");
const { pollAndArchive, SOURCE_BLOCKED_ERROR, feedDue, FEED_DUE_SLACK_MS } = archive;

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const DIGESTS = APH_FEEDS.find((f) => f.label === "Bills Digests");
const DIVISIONS = APH_FEEDS.find((f) => f.label === "House divisions");
const MIN = 60_000;
const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const ONE_DIGEST = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Treasury Laws Amendment (Small Business Energy Relief) Bill 2026</title>
<link>https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22library%2Fprspub%2Ft011%22</link>
<guid>bd-0-16-11</guid>
<pubDate>Mon, 05 Oct 2026 00:00:00 +1000</pubDate>
<description>Bills Digest.</description></item>
</channel></rss>`;

const env = () => ({ ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() });
const ctx = () => ({ pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} });
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));

/** fetch fake: statusFor(url) per call; logs every fetched URL. */
function fakeFetch(statusFor = () => 200) {
  const fetched = [];
  const impl = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    fetched.push(url);
    const status = statusFor(url);
    const body = status === 200 ? (url === DIGESTS.url ? ONE_DIGEST : EMPTY) : "<html>Azure WAF JS Challenge</html>";
    return new Response(body, { status, headers: { "content-type": status === 200 ? "application/rss+xml" : "text/html" } });
  };
  return { impl, fetched };
}

async function withFetch(impl, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = real; }
}

async function scheduledPoll(e, impl) {
  await withFetch(impl, async () => {
    const c = ctx();
    await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, c);
    await Promise.all(c.pending);
  });
}

const lastPoll = (e) => rows(e, `SELECT outcome, detail FROM job_runs WHERE job = 'poll' ORDER BY id DESC LIMIT 1`)[0];
const health = (e, url) => rows(e, `SELECT last_http_status, parse_error, last_polled_at, last_success_at FROM feed_health WHERE feed_url = ?`, url)[0];
const backdate = (e, url, msAgo) =>
  e.ARCHIVE.raw.prepare(`UPDATE feed_health SET last_polled_at = ? WHERE feed_url = ?`).run(new Date(Date.now() - msAgo).toISOString(), url);

async function getJson(e, path) {
  const res = await worker.fetch(new Request(`https://w.test${path}`), e, ctx());
  return { status: res.status, body: await res.json() };
}

test("config: Bills Digests carries a 6-hour cadence and a 24-hour block backoff; no other feed does", () => {
  assert.equal(DIGESTS.pollEveryMinutes, 360);
  assert.equal(DIGESTS.blockedBackoffMinutes, 1440);
  const others = APH_FEEDS.filter((f) => f !== DIGESTS && (f.pollEveryMinutes !== undefined || f.blockedBackoffMinutes !== undefined));
  assert.deepEqual(others, [], "every other feed keeps the 30-minute poll and ordinary failures (restraint)");
});

test("1. a 403 on Bills Digests is source blocked: run ok, status and last success kept, health says so", async () => {
  const e = env();
  // A first poll that works, so there is a last_success_at to keep.
  await scheduledPoll(e, fakeFetch().impl);
  const okAt = health(e, DIGESTS.url).last_success_at;
  assert.ok(okAt);
  backdate(e, DIGESTS.url, 7 * 60 * MIN); // due again
  const f = fakeFetch((u) => (u === DIGESTS.url ? 403 : 200));
  await scheduledPoll(e, f.impl);
  assert.ok(f.fetched.includes(DIGESTS.url), "the due feed was fetched");
  const run = lastPoll(e);
  assert.equal(run.outcome, "ok", "a source block alone does not make the run partial");
  const d = JSON.parse(run.detail);
  assert.equal(d.feeds_failed, 0);
  assert.equal(d.feeds_blocked, 1);
  const h = health(e, DIGESTS.url);
  assert.equal(h.last_http_status, 403, "the real status is kept");
  assert.equal(h.parse_error, SOURCE_BLOCKED_ERROR);
  assert.equal(h.last_success_at, okAt, "last_success_at survives the block");

  const deep = await getJson(e, "/healthz/deep");
  assert.equal(deep.body.feeds_failed, 0);
  assert.equal(deep.body.feeds_blocked, 1);
  const conn = await getJson(e, "/healthz/connectors");
  const row = conn.body.connectors.find((c) => c.url === DIGESTS.url);
  assert.equal(row.state, "source_blocked");
  assert.equal(row.ok, 0, "ok still means 200 and parsed (no false green)");
  assert.equal(row.error, SOURCE_BLOCKED_ERROR);
  assert.equal(Date.parse(row.next_poll_at) - Date.parse(row.checked_at), 1440 * MIN, "retried after 24 hours");
  const other = conn.body.connectors.find((c) => c.url === DIVISIONS.url);
  assert.equal(other.state, "ok");
  assert.equal(other.next_poll_at, null, "an every-poll feed has no next_poll_at");
});

test("1b. a 429 on Bills Digests is source blocked too", async () => {
  const e = env();
  await scheduledPoll(e, fakeFetch((u) => (u === DIGESTS.url ? 429 : 200)).impl);
  const d = JSON.parse(lastPoll(e).detail);
  assert.equal(d.feeds_blocked, 1);
  assert.equal(d.feeds_failed, 0);
  assert.equal(health(e, DIGESTS.url).last_http_status, 429);
});

test("2. restraint: a 403 on a feed with no backoff, or a 500 on Bills Digests, is still a failure", async () => {
  const e = env();
  await scheduledPoll(e, fakeFetch((u) => (u === DIVISIONS.url ? 403 : u === DIGESTS.url ? 500 : 200)).impl);
  const run = lastPoll(e);
  assert.equal(run.outcome, "partial");
  const d = JSON.parse(run.detail);
  assert.equal(d.feeds_failed, 2);
  assert.equal(d.feeds_blocked, undefined);
  assert.equal(health(e, DIVISIONS.url).parse_error, "HTTP 403");
  assert.equal(health(e, DIGESTS.url).parse_error, "HTTP 500");
  const conn = await getJson(e, "/healthz/connectors");
  for (const url of [DIVISIONS.url, DIGESTS.url]) {
    assert.equal(conn.body.connectors.find((c) => c.url === url).state, "failed");
  }
});

test("3. cadence: Bills Digests at most every 6 hours, every 24 hours after a block", async () => {
  const e = env();
  const f1 = fakeFetch();
  await scheduledPoll(e, f1.impl);
  assert.ok(f1.fetched.includes(DIGESTS.url), "a never-polled feed is due");

  const f2 = fakeFetch();
  await scheduledPoll(e, f2.impl);
  assert.ok(!f2.fetched.includes(DIGESTS.url), "not fetched 30 minutes later");
  assert.equal(f2.fetched.length, APH_FEEDS.length - 1, "every other feed still fetched (restraint)");
  const d2 = JSON.parse(lastPoll(e).detail);
  assert.equal(d2.feeds_not_due, 1);
  assert.equal(d2.feeds, APH_FEEDS.length);
  assert.equal(lastPoll(e).outcome, "ok", "a feed not due is not a failure");
  const before = health(e, DIGESTS.url).last_polled_at;

  backdate(e, DIGESTS.url, 5 * 60 * MIN);
  const f3 = fakeFetch();
  await scheduledPoll(e, f3.impl);
  assert.ok(!f3.fetched.includes(DIGESTS.url), "not fetched at 5 hours");

  backdate(e, DIGESTS.url, 6 * 60 * MIN - FEED_DUE_SLACK_MS + MIN);
  const f4 = fakeFetch((u) => (u === DIGESTS.url ? 403 : 200));
  await scheduledPoll(e, f4.impl);
  assert.ok(f4.fetched.includes(DIGESTS.url), "fetched at 6 hours (less the cron slack)");
  assert.notEqual(health(e, DIGESTS.url).last_polled_at, before);

  // Now blocked: 7 hours later is still inside the 24-hour backoff.
  backdate(e, DIGESTS.url, 7 * 60 * MIN);
  const f5 = fakeFetch();
  await scheduledPoll(e, f5.impl);
  assert.ok(!f5.fetched.includes(DIGESTS.url), "a blocked feed waits 24 hours, not 6");

  backdate(e, DIGESTS.url, 25 * 60 * MIN);
  const f6 = fakeFetch();
  await scheduledPoll(e, f6.impl);
  assert.ok(f6.fetched.includes(DIGESTS.url), "retried after 24 hours");
  assert.equal(health(e, DIGESTS.url).parse_error, null, "recovered");
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE guid = 'bd-0-16-11'`)[0].n, 1);
});

test("3b. feedDue: unread, future or missing last_polled_at is due", () => {
  const now = Date.now();
  assert.equal(feedDue(DIGESTS, undefined, now), true);
  assert.equal(feedDue(DIGESTS, { last_polled_at: "not a date", parse_error: null }, now), true);
  assert.equal(feedDue(DIGESTS, { last_polled_at: new Date(now + 60 * MIN).toISOString(), parse_error: null }, now), true);
  assert.equal(feedDue(DIVISIONS, { last_polled_at: new Date(now).toISOString(), parse_error: null }, now), true, "no cadence: always due");
  assert.equal(feedDue(DIGESTS, { last_polled_at: new Date(now - MIN).toISOString(), parse_error: null }, now), false);
});

test("4. restraint: a direct poll and /admin/poll-now fetch every feed, due or not", async () => {
  const e = { ...env(), ADMIN_TOKEN: "t0ken-0-16-11" };
  await scheduledPoll(e, fakeFetch().impl);
  const f = fakeFetch();
  await withFetch(f.impl, () => pollAndArchive(e));
  assert.equal(f.fetched.length, APH_FEEDS.length);
  const g = fakeFetch();
  const res = await withFetch(g.impl, () =>
    worker.fetch(new Request("https://w.test/admin/poll-now", { method: "POST", headers: { "x-admin-token": "t0ken-0-16-11" } }), e, ctx()));
  assert.equal(res.status, 200);
  assert.ok(g.fetched.includes(DIGESTS.url), "poll-now ignores the cadence");
});

test("5. fail open: a failed cadence read fetches every feed", async () => {
  const e = env();
  await scheduledPoll(e, fakeFetch().impl);
  const realPrepare = e.ARCHIVE.prepare.bind(e.ARCHIVE);
  e.ARCHIVE.prepare = (sql) => {
    if (sql === archive.FEED_HEALTH_SQL) throw new Error("D1 unavailable");
    return realPrepare(sql);
  };
  const f = fakeFetch();
  await scheduledPoll(e, f.impl);
  assert.ok(f.fetched.includes(DIGESTS.url), "fetched although not due, because the read failed");
});
