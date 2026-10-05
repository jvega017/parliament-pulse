// Worker 0.16.7: fixes from the full-production-seed recheck of 0.16.6
// (5 Oct 2026). Real SQL (node:sqlite) through tests/support/sqlite-d1.mjs.
//
//   1. The 0.16.6 re-split heal is removed (tested in review-0.16.6.test.mjs,
//      "fix-1 (0.16.7)").
//   2. A new report tabled at a link that already holds a stored report is
//      stored as a NEW row at L#pubDate (first_seen_at = now, alerts if
//      fresh). The stored row keeps its identity: title, pub_date and
//      first_seen_at. 0.16.6 renamed the stored row to the new report and
//      re-inserted the old one as if new.
//   3. The alert watermark survives a polling gap longer than 7 days: it is
//      written with no expiry, and a missing key falls back to the latest
//      first_seen_at stored before the poll.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.7.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { pollAndArchive, keepStoredIdentity } = await import("../src/archive.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const feed = (label) => APH_FEEDS.find((f) => f.label === label);
const F = { reports: feed("Senate reports tabled"), program: feed("House daily program"), inquiries: feed("New Senate inquiries") };
const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rss = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items.map((i) =>
  `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link>${i.description ? `<description>${esc(i.description)}</description>` : ""}${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ""}</item>`).join("\n")}</channel></rss>`;
function mockFetch(bodies) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    return new Response(bodies[url] ?? EMPTY, { status: 200 });
  };
}
const env = (kv = memoryKv()) => ({ ALLOWED_ORIGINS: "https://parliament-pulse.pages.dev", CACHE: kv, ARCHIVE: sqliteD1() });
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));
const anyRule = (e) => e.ARCHIVE.raw.prepare(`INSERT INTO alert_rules (name, terms, attention_min, created_at, active) VALUES ('any', '', 'low', '2026-01-01T00:00:00.000Z', 1)`).run();
const insert = (e, r) => e.ARCHIVE.raw.prepare(
  `INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, attention, confidence, description)
   VALUES (?, ?, ?, ?, ?, ?, 'Senate', ?, ?, ?, 'med', 3, ?)`,
).run(r.guid, r.title, r.link, r.pub, r.feed.url, r.feed.label, r.feed.kind, r.first, r.first, r.description ?? null);

const DAY = 24 * 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const rfc = (ms) => new Date(ms).toUTCString();
// Whole seconds: RFC 822 pubDates carry no milliseconds.
const T0 = Math.floor(Date.now() / 1000) * 1000;

const L = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/SharedInquiry";

// ---- Fix 2 -------------------------------------------------------------------

function seedOldReport(e) {
  const old = { guid: L, link: L, title: "Interim report", pub: iso(T0 - 20 * DAY), first: iso(T0 - 20 * DAY + 3600e3), feed: F.reports, description: "interim" };
  insert(e, old);
  return old;
}

test("fix-2: a new report at a stored report's link is a new row at L#pubDate; the stored row keeps its identity", async () => {
  const e = env();
  anyRule(e);
  const old = seedOldReport(e);
  // The old row was alerted when it arrived.
  e.ARCHIVE.raw.prepare(`INSERT INTO alert_events (rule_id, signal_guid, fired_at, title, link, attention) VALUES (1, ?, ?, ?, ?, 'med')`).run(L, old.first, old.title, L);
  await e.CACHE.put("alert:watermark", iso(T0 - 1 * DAY));

  const fresh = { title: "Final report", link: L, pubDate: rfc(T0 - 1 * DAY), description: "final" };
  const prev = { title: "Interim report", link: L, pubDate: rfc(Date.parse(old.pub)), description: "interim" };
  mockFetch({ [F.reports.url]: rss([fresh, prev]) });
  const r1 = await pollAndArchive(e);

  const at = () => rows(e, `SELECT guid, title, pub_date, first_seen_at, feed_label FROM signals ORDER BY guid`);
  const s1 = at();
  assert.equal(s1.length, 2, "two rows: the stored report and the new one");
  assert.deepEqual(s1[0], { guid: L, title: "Interim report", pub_date: old.pub, first_seen_at: old.first, feed_label: F.reports.label },
    "the stored row is not renamed and keeps first_seen_at");
  const newGuid = `${L}#${iso(T0 - 1 * DAY)}`;
  assert.equal(s1[1].guid, newGuid);
  assert.equal(s1[1].title, "Final report");
  assert.notEqual(s1[1].first_seen_at, old.first, "the new report gets first_seen_at = now");
  assert.ok(Date.parse(s1[1].first_seen_at) >= T0, "first_seen_at is this poll");
  assert.equal(r1.perFeed.find((f) => f.feed === F.reports.url).new, 1);

  const ev = rows(e, `SELECT signal_guid, title FROM alert_events ORDER BY id`);
  assert.deepEqual(ev, [{ signal_guid: L, title: "Interim report" }, { signal_guid: newGuid, title: "Final report" }],
    "the new report alerts once; the old one does not alert again");

  // Stable: the next poll adds nothing and changes nothing but last_seen_at.
  const r2 = await pollAndArchive(e);
  assert.deepEqual(at(), s1);
  assert.equal(r2.perFeed.reduce((a, f) => a + f.new, 0), 0);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 2);
});

test("fix-2: the old report has left the feed, the new report at its link is still a new row", async () => {
  const e = env();
  anyRule(e);
  const old = seedOldReport(e);
  await e.CACHE.put("alert:watermark", iso(T0 - 1 * DAY));
  mockFetch({ [F.reports.url]: rss([{ title: "Final report", link: L, pubDate: rfc(T0 - 1 * DAY), description: "final" }]) });
  await pollAndArchive(e);
  const s = rows(e, `SELECT guid, title, pub_date, first_seen_at FROM signals ORDER BY guid`);
  assert.deepEqual(s[0], { guid: L, title: "Interim report", pub_date: old.pub, first_seen_at: old.first });
  assert.equal(s[1].guid, `${L}#${iso(T0 - 1 * DAY)}`);
  assert.equal(s[1].title, "Final report");
  assert.deepEqual(rows(e, `SELECT title FROM alert_events`).map((r) => r.title), ["Final report"]);
});

test("fix-2 restraint: the same report re-seen, or a re-dated House daily program, rewrites L in place", async () => {
  // (a) The same report re-seen: one row, no new rows.
  const a = env();
  const old = seedOldReport(a);
  mockFetch({ [F.reports.url]: rss([{ title: "Interim report", link: L, pubDate: rfc(Date.parse(old.pub)), description: "interim" }]) });
  const ra = await pollAndArchive(a);
  assert.deepEqual(rows(a, `SELECT guid, first_seen_at FROM signals`), [{ guid: L, first_seen_at: old.first }]);
  assert.equal(ra.perFeed.reduce((x, f) => x + f.new, 0), 0);

  // (b) The House daily program keeps one link and changes title and date.
  const b = env();
  const P = "https://www.aph.gov.au/House_of_Representatives/House_of_Representatives_Daily_Program";
  insert(b, { guid: P, link: P, title: "Daily Program for Tuesday, 15 September 2026", pub: iso(T0 - 20 * DAY), first: iso(T0 - 20 * DAY), feed: F.program });
  mockFetch({ [F.program.url]: rss([{ title: "Daily Program for Wednesday, 16 September 2026", link: P, pubDate: rfc(T0 - 1 * DAY) }]) });
  await pollAndArchive(b);
  assert.deepEqual(rows(b, `SELECT guid, title, pub_date FROM signals`),
    [{ guid: P, title: "Daily Program for Wednesday, 16 September 2026", pub_date: iso(T0 - 1 * DAY) }]);
});

test("fix-2: keepStoredIdentity keys from the stored row's document", () => {
  const own = (o) => new Map([[L, { feed_url: "rep", description: null, ...o }]]);
  const newest = { title: "B", link: L, pubDate: "2026-09-02T00:00:00.000Z", guid: L, description: null };
  const older = { title: "A", link: L, pubDate: "2026-09-01T00:00:00.000Z", guid: `${L}#2026-09-01T00:00:00.000Z`, description: null };
  const keys = (out) => out.map((i) => `${i.title}=${i.guid}`);
  // Stored row is A: A keeps L, B moves to L#pubDate.
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "rep", "report", own({ title: "A", pub_date: older.pubDate }))),
    [`B=${L}#2026-09-02T00:00:00.000Z`, `A=${L}`]);
  // Stored row is B: unchanged.
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "rep", "report", own({ title: "B", pub_date: newest.pubDate }))),
    [`B=${L}`, `A=${L}#2026-09-01T00:00:00.000Z`]);
  // Stored by another feed: unchanged (chooseGuid's rule 5 applies).
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "rep", "report", new Map([[L, { feed_url: "inq", title: "A", description: null, pub_date: older.pubDate }]]))),
    [`B=${L}`, `A=${L}#2026-09-01T00:00:00.000Z`]);
  // A has a stored L#pubDate row already: unchanged, so A is not written twice.
  const both = own({ title: "A", pub_date: older.pubDate });
  both.set(older.guid, { feed_url: "rep", title: "A", description: null, pub_date: older.pubDate });
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "rep", "report", both)), [`B=${L}`, `A=${L}#2026-09-01T00:00:00.000Z`]);
});

// ---- Fix 3 -------------------------------------------------------------------

test("fix-3: after a polling gap longer than 7 days (watermark key gone), old fresh rows do not alert again", async () => {
  const e = env(); // empty KV: the 7-day key written by 0.16.6 has expired
  anyRule(e);
  // Rows stored at the last poll 10 days ago, each fresh when it arrived.
  for (let i = 0; i < 3; i += 1) {
    const g = `https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/Old${i}`;
    insert(e, { guid: g, link: g, title: `Old fresh report ${i}`, pub: iso(T0 - 11 * DAY), first: iso(T0 - 10 * DAY), feed: F.reports });
  }
  const g = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/NewOne";
  mockFetch({ [F.reports.url]: rss([{ title: "New report today", link: g, pubDate: rfc(T0 - 3600e3) }]) });
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT title FROM alert_events`).map((r) => r.title), ["New report today"],
    "only the row first seen this poll alerts");
});

test("fix-3: the watermark is written with no expiry", async () => {
  const puts = [];
  const kv = memoryKv();
  const put = kv.put.bind(kv);
  kv.put = async (k, v, opts) => { puts.push({ k, opts }); return put(k, v, opts); };
  const e = env(kv);
  anyRule(e);
  mockFetch({});
  await pollAndArchive(e);
  const wm = puts.filter((p) => p.k === "alert:watermark");
  assert.equal(wm.length, 1);
  assert.equal(wm[0].opts?.expirationTtl, undefined);
  assert.equal(wm[0].opts?.expiration, undefined);
});

test("fix-3 restraint: first poll of an empty archive still alerts on fresh arrivals", async () => {
  const e = env();
  anyRule(e);
  const g = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/First";
  mockFetch({ [F.reports.url]: rss([{ title: "First report", link: g, pubDate: rfc(T0 - 3600e3) }]) });
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT title FROM alert_events`).map((r) => r.title), ["First report"]);
});
