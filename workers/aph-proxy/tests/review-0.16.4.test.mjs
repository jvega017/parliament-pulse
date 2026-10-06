// Worker 0.16.4: fixes for the seven Worker defects found in review of the
// 0.16.3 candidate (5 Oct 2026). Real SQL (node:sqlite, every migration
// applied) through tests/support/sqlite-d1.mjs, which since 0.16.4 holds every
// LIKE to D1's 50-byte pattern limit; that limit is what 166 green tests
// missed in defects 1 and 2.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.4.test.mjs
//
// Measured to fail when the fixes are removed: this file, run against the
// 0.16.3 sources (commit 0c507ee) on a scratch copy with the new shim, fails
// every test named for defects 1, 2, 4, 5, 6 and 7 (see the commit message
// for the counts).

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv, d1Like, D1_LIKE_PATTERN_MAX_BYTES } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const archive = await import("../src/archive.ts");
const { pollAndArchive, parseFeed, pickPerGuid, backfillThreads, queryStateSignals } = archive;
const { canonicalThreadKey } = await import("../src/threads.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");
const { parseHearingDate } = await import("../src/hearingDate.ts");
const { default: worker } = await import("../src/index.ts");

const warnings = [];
console.warn = (...a) => { warnings.push(a.map(String).join(" ")); };
console.log = () => {};
console.error = () => {};

const fixture = (name) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
const migration = (name) => readFileSync(fileURLToPath(new URL(`../migrations/${name}`, import.meta.url)), "utf8");
const REPORTS_XML = fixture("senate-reports-2026-10-05.xml");
const HEARINGS = JSON.parse(fixture("upcoming-hearings-2026-10-05.json"));

const feed = (label) => APH_FEEDS.find((f) => f.label === label);
const F = {
  inquiries: feed("New Senate inquiries"),
  reports: feed("Senate reports tabled"),
  hearings: feed("Upcoming Senate hearings"),
  senators: feed("Senators' details updates"),
};

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function rss(items) {
  const body = items.map((i) => `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link>`
    + `${i.guid ? `<guid>${esc(i.guid)}</guid>` : ""}${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ""}`
    + `${i.description ? `<description>${esc(i.description)}</description>` : ""}</item>`).join("\n");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${body}</channel></rss>`;
}
function mockFetch(bodies) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    return new Response(bodies[url] ?? EMPTY, { status: 200 });
  };
}
function env() {
  return { ALLOWED_ORIGINS: "https://parliament-pulse.pages.dev", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}
function ctx() {
  return { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
}
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));
const get = async (e, path) => worker.fetch(new Request(`https://w.test${path}`), e, ctx());

// A real inquiry path, from the Upcoming Senate hearings fixture (live feed,
// 5 Oct 2026). Its key alone is 77 bytes, over the 50-byte LIKE limit.
const LONG_INQUIRY = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport/Aviationsector_48";

// ---- Defect 3: the D1 stand-in enforces the 50-byte LIKE limit ----------------

test("defect-3: the stand-in throws on a LIKE pattern over 50 bytes, bound or literal", () => {
  const e = env();
  const p51 = `%${"a".repeat(49)}%`;
  assert.equal(Buffer.byteLength(p51), 51);
  assert.throws(() => e.ARCHIVE.raw.prepare(`SELECT 'x' LIKE ?`).get(p51), /LIKE or GLOB pattern too complex/);
  assert.throws(() => e.ARCHIVE.raw.prepare(`SELECT 'x' LIKE '${p51}'`).get(), /LIKE or GLOB pattern too complex/);
  assert.throws(() => d1Like("é".repeat(26), "x"), /too complex/, "the limit is bytes, not characters (52 bytes)");
});

test("defect-3: the stand-in stays silent at 50 bytes and keeps SQLite LIKE semantics", () => {
  const e = env();
  const one = (sql, ...a) => Object.values(e.ARCHIVE.raw.prepare(sql).get(...a))[0];
  const p50 = `%${"a".repeat(48)}%`;
  assert.equal(Buffer.byteLength(p50), D1_LIKE_PATTERN_MAX_BYTES);
  assert.equal(one(`SELECT ? LIKE ?`, "a".repeat(48), p50), 1);
  assert.equal(one(`SELECT 'Treasury LAWS' LIKE '%laws'`), 1, "ASCII case folding");
  assert.equal(one(`SELECT 'É' LIKE 'é'`), 0, "no non-ASCII folding, as SQLite");
  assert.equal(one(`SELECT 'abc' LIKE 'a_c'`), 1);
  assert.equal(one(`SELECT 'abc' LIKE 'a\\_c' ESCAPE '\\'`), 0, "escaped _ is literal");
  assert.equal(one(`SELECT 'a_c' LIKE 'a\\_c' ESCAPE '\\'`), 1);
  assert.equal(one(`SELECT 'line1\nline2' LIKE 'line1%line2'`), 1, "% spans newlines");
  assert.equal(one(`SELECT NULL LIKE 'a'`), null);
  assert.equal(one(`SELECT COUNT(*) FROM signals WHERE guid LIKE 't2:%'`), 0, "migration-style literal patterns run");
});

// ---- Defect 1: threads build for keys over 50 bytes ---------------------------

test("defect-1: a poll threads every item whose key exceeds the LIKE limit, with no failure", async () => {
  const e = env();
  const key = canonicalThreadKey("x", LONG_INQUIRY, "report");
  assert.ok(Buffer.byteLength(`${key},%`) > 50, `key is ${key.length} bytes`);
  mockFetch({
    [F.inquiries.url]: rss([{ title: "State of Australia's aviation sector", link: LONG_INQUIRY, pubDate: "Wed, 01 Oct 2025 00:00:00 +1000" }]),
    [F.reports.url]: rss([
      { title: "State of Australia's aviation sector [Interim report]", link: `${LONG_INQUIRY}/Report`, pubDate: "Wed, 18 Feb 2026 00:00:00 +1100" },
      { title: "Another long one", link: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport/Hempindustry_48", pubDate: "Thu, 20 Aug 2026 00:00:00 +1000" },
    ]),
  });
  warnings.length = 0;
  await pollAndArchive(e);
  assert.deepEqual(warnings.filter((w) => /thread/i.test(w)), [], "no thread assignment or heal failure");
  const unthreaded = rows(e, `SELECT COUNT(*) AS n FROM signals s LEFT JOIN signal_threads st ON st.signal_guid = s.guid WHERE st.signal_guid IS NULL`)[0].n;
  assert.equal(unthreaded, 0, "every signal has a thread");
  const groups = rows(e, `SELECT thread_id, COUNT(*) AS n FROM signal_threads GROUP BY thread_id ORDER BY n DESC`);
  assert.deepEqual(groups.map((g) => g.n), [2, 1], "the inquiry and its report share the long-key thread");
});

test("defect-1: the heal step and the backfill thread a backlog of long-key signals", async () => {
  const e = env();
  const ins = e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, 'u', 'Senate reports tabled', 'Senate', 'report', ?, ?)`);
  for (let i = 0; i < 40; i += 1) {
    const link = `https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Environment_and_Communications/LongInquiryName${i % 8}`;
    const at = new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString();
    ins.run(`g${i}`, `Report ${i}`, link, at, at);
  }
  mockFetch({});
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signal_threads`)[0].n, 25, "the heal step threads THREAD_HEAL_PER_POLL");
  const r = await backfillThreads(e, 500);
  assert.equal(r.processed, 15);
  assert.equal(rows(e, `SELECT COUNT(DISTINCT thread_id) AS n FROM signal_threads`)[0].n, 8, "one thread per inquiry");
});

test("defect-1: the key lookup matches the whole first token only, and uses idx_threads_key", async () => {
  const e = env();
  const a = "key:inquiry/senate/rural_and_regional_affairs_and_transport/aviationsector_48";
  e.ARCHIVE.raw.exec(`INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at, item_count) VALUES
    ('t2:long', '${a}x,aviation', 'longer key', '2026-10-02', '2026-10-02', 1),
    ('t2:exact', '${a},aviation,sector', 'the key', '2026-10-01', '2026-10-01', 1),
    ('t2:bare', 'key:bill/x bill 2026', 'bare', '2026-10-01', '2026-10-01', 1)`);
  assert.equal((await archive.findKeyedThread(e, a)).thread_id, "t2:exact", "a longer key sharing the prefix is not a match");
  assert.equal((await archive.findKeyedThread(e, "key:bill/x bill 2026")).thread_id, "t2:bare", "a fingerprint that is only the key");
  assert.equal(await archive.findKeyedThread(e, "key:inquiry/none"), null);
  const plan = rows(e, `EXPLAIN QUERY PLAN SELECT thread_id FROM threads WHERE ${archive.THREAD_KEY_EXPR} = ? ORDER BY last_seen_at DESC LIMIT 1`, a);
  assert.ok(plan.some((p) => /idx_threads_key/.test(p.detail)), JSON.stringify(plan));
  e.ARCHIVE.raw.exec(migration("0013_thread_key_index.sql"));
  e.ARCHIVE.raw.exec(migration("0013_thread_key_index.sql"));
});

// ---- Defect 2: long searches answer, absurd ones are 400 -----------------------

test("defect-2: a search over 48 bytes answers 200 on every search route", async () => {
  const e = env();
  const title = "National Disability Insurance Scheme Amendment (Securing the NDIS for Future Generations) Bill 2026";
  const q = "securing the ndis for future generations) bill 2026"; // 51 bytes
  assert.ok(Buffer.byteLength(q) > 48);
  e.ARCHIVE.raw.exec(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES ('d1', '${title}', 'https://x/d1', '2026-10-01T00:00:00.000Z', 'u', 'Bills Digests', 'Library', 'digest', '2026-10-01', '2026-10-01')`);
  e.ARCHIVE.raw.exec(`INSERT INTO qons (id, asked_at, member, chamber, target, question, hansard_url, ingested_at)
    VALUES ('q1', '2026-10-01', 'Senator Long Name', 'Senate', 'x', 'About ${title}', 'https://x/q1', '2026-10-01')`);
  e.ARCHIVE.raw.exec(`INSERT INTO members (mpid, name, chamber, party, state, role, profile_url, updated_at)
    VALUES ('m1', 'Firstname Middlename Double-Barrelled-Surname Of Some Length', 'Senate', null, null, 'Senator', 'https://x/m1', '2026-10-01')`);
  const enc = encodeURIComponent;
  const arch = await get(e, `/archive?q=${enc(q.toUpperCase())}`);
  assert.equal(arch.status, 200);
  assert.equal((await arch.json()).total, 1, "case-insensitive as before");
  const bills = await get(e, `/bills?q=${enc(q)}`);
  assert.equal(bills.status, 200);
  assert.equal((await bills.json()).total, 1);
  const qons = await get(e, `/qons?q=${enc(q)}`);
  assert.equal(qons.status, 200);
  assert.equal((await qons.json()).total, 1);
  const mem = await get(e, `/members?q=${enc("middlename double-barrelled-surname of some length")}`);
  assert.equal(mem.status, 200);
  assert.equal((await mem.json()).total, 1);
  const an = await get(e, `/archive/analytics?terms=${enc(q)}`);
  assert.equal(an.status, 200);
  assert.equal((await an.json()).series[0].count, 1);
  const tr = await get(e, `/archive/watchlist-trend?terms=${enc(q)}`);
  assert.equal(tr.status, 200);
});

test("defect-2: search terms stay literal: % and _ match only themselves", async () => {
  const e = env();
  e.ARCHIVE.raw.exec(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at) VALUES
    ('a', 'A 50% rebate', 'l', 'u', 'f', 'g', 'k', '2026-10-01', '2026-10-01'),
    ('b', 'A 500 rebate', 'l', 'u', 'f', 'g', 'k', '2026-10-01', '2026-10-01'),
    ('c', 'snake_case', 'l', 'u', 'f', 'g', 'k', '2026-10-01', '2026-10-01'),
    ('d', 'snakeXcase', 'l', 'u', 'f', 'g', 'k', '2026-10-01', '2026-10-01')`);
  assert.deepEqual((await (await get(e, `/archive?q=${encodeURIComponent("50%")}`)).json()).rows.map((r) => r.guid), ["a"]);
  assert.deepEqual((await (await get(e, `/archive?q=e_c`)).json()).rows.map((r) => r.guid), ["c"]);
});

test("defect-2: a term over 200 characters is a 400 on every search route, not a 503", async () => {
  const e = env();
  const long = "a".repeat(201);
  for (const path of [`/archive?q=${long}`, `/bills?q=${long}`, `/qons?q=${long}`, `/members?q=${long}`,
    `/archive/analytics?terms=${long}`, `/archive/watchlist-trend?terms=${long}`]) {
    const r = await get(e, path);
    assert.equal(r.status, 400, path);
    const body = await r.json();
    assert.equal(body.code, "query_too_long", path);
    assert.equal(body.max_chars, 200);
  }
  assert.equal((await get(e, `/archive?q=${"a".repeat(200)}`)).status, 200, "200 characters is allowed");
});

// ---- Defect 4: newest pubDate wins; older documents on one link are kept -------

test("defect-4: the NDIS final report (14 Aug) is stored, and the interim (23 Jun) is kept beside it", async () => {
  const e = env();
  mockFetch({ [F.reports.url]: REPORTS_XML });
  // 0.16.10: an empty archive is filled MAX_NEW_PER_POLL rows per poll
  // (D1's 1,000 queries per invocation), so 134 reports take two polls.
  const r0 = await pollAndArchive(e);
  const first = r0.perFeed.find((f) => f.feed === F.reports.url);
  assert.equal(first.new, archive.MAX_NEW_PER_POLL);
  assert.equal(first.deferred, 134 - archive.MAX_NEW_PER_POLL);
  e.ARCHIVE.resetQueries();
  const r1 = await pollAndArchive(e);
  const link = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Community_Affairs/NDISFutureGenBill";
  const main = rows(e, `SELECT pub_date, description FROM signals WHERE guid = ?`, link)[0];
  assert.equal(main.pub_date, "2026-08-13T14:00:00.000Z", "Fri 14 Aug 2026 00:00 +1000");
  assert.match(main.description, /have tabled a report titled/);
  const interim = rows(e, `SELECT pub_date, description FROM signals WHERE guid = ?`, `${link}#2026-06-22T14:00:00.000Z`)[0];
  assert.ok(interim, "the interim report is archived under link#pubDate");
  assert.match(interim.description, /interim report/);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.reports.url)[0].n, 134, "all 134 reports");
  assert.equal(r1.perFeed.find((f) => f.feed === F.reports.url).new, 134 - archive.MAX_NEW_PER_POLL);
  assert.equal(r1.perFeed.find((f) => f.feed === F.reports.url).deferred, undefined);
  e.ARCHIVE.resetQueries();
  const r2 = await pollAndArchive(e);
  assert.equal(r2.perFeed.find((f) => f.feed === F.reports.url).new, 0, "a re-poll adds nothing");
  const ndisThreads = rows(e, `SELECT COUNT(DISTINCT st.thread_id) AS n FROM signal_threads st JOIN signals s ON s.guid = st.signal_guid WHERE s.link = ?`, link)[0].n;
  assert.equal(ndisThreads, 1, "both reports share the inquiry thread");
});

test("defect-4: pickPerGuid keeps the newest, keeps feed order on ties, and never splits a real guid", () => {
  const L = "https://www.aph.gov.au/x";
  const it = (title, pubDate, guid = L) => ({ title, link: L, pubDate, guid, description: null });
  const { items } = pickPerGuid([it("old", "2026-01-01T00:00:00.000Z"), it("new", "2026-02-01T00:00:00.000Z")], "report", "2026-10-05");
  assert.deepEqual(items.map((i) => [i.title, i.guid]), [["new", L], ["old", `${L}#2026-01-01T00:00:00.000Z`]]);
  const tie = pickPerGuid([it("first", null), it("second", null)], "report", "2026-10-05");
  assert.deepEqual(tie.items.map((i) => i.title), ["first"]);
  assert.equal(tie.dropped, 1);
  const real = pickPerGuid([it("a", "2026-01-01T00:00:00.000Z", "g1"), it("b", "2026-02-01T00:00:00.000Z", "g1")], "report", "2026-10-05");
  assert.deepEqual(real.items.map((i) => [i.title, i.guid]), [["b", "g1"]], "a feed-supplied guid is one row");
});

// ---- Defect 5: hearings ranked by hearing date ------------------------------

test("defect-5: the hearing quota keeps every upcoming hearing, soonest first, including 16 Oct", async () => {
  const e = env();
  const parsed = parseFeed(rss(HEARINGS.items.map((i) => ({ title: i.title, link: i.link, description: i.description }))), F.hearings);
  const { items } = pickPerGuid(parsed, "hearing", "2026-10-05");
  assert.ok(items.length > 10, `${items.length} hearing rows, more than the quota`);
  const ins = e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, description)
    VALUES (?, ?, ?, NULL, ?, ?, 'Senate', 'hearing', '2026-10-05T00:00:00.000Z', '2026-10-05T00:00:00.000Z', ?)`);
  for (const i of items) ins.run(i.guid, i.title, i.link, F.hearings.url, F.hearings.label, i.description);
  const all = items.map((i) => parseHearingDate(i.description));
  const upcoming = all.filter((d) => d && d >= "2026-10-05").sort();
  assert.ok(upcoming.includes("2026-10-16"));
  const { items: held } = await queryStateSignals(e, { feeds: [F.hearings.label], now: new Date("2026-10-05T02:00:00Z") });
  assert.equal(held.length, 10);
  const heldUpcoming = held.map((h) => h.hearing_date).filter((d) => d && d >= "2026-10-05").sort();
  assert.deepEqual(heldUpcoming, upcoming, "every upcoming hearing is held");
  assert.ok(held.some((h) => h.hearing_date === "2026-10-16"), "the 16 Oct aviation sector hearing");
  const past = all.filter((d) => d && d < "2026-10-05").sort().reverse();
  const heldPast = held.map((h) => h.hearing_date).filter((d) => d && d < "2026-10-05").sort().reverse();
  assert.deepEqual(heldPast, past.slice(0, 10 - upcoming.length), "then the most recent past hearings");
});

test("defect-5: a hearing still listed is a candidate even when 40+ newer-first-seen rows have left the feed", async () => {
  const e = env();
  const ins = e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, description)
    VALUES (?, ?, ?, NULL, ?, ?, 'Senate', 'hearing', ?, ?, ?)`);
  ins.run("listed", "Still listed", "https://x/listed", F.hearings.url, F.hearings.label,
    "2026-08-01T00:00:00.000Z", "2026-10-05T00:00:00.000Z", "Friday, 16 October 2026 - Canberra");
  for (let i = 0; i < 45; i += 1) {
    ins.run(`gone${i}`, `Gone ${i}`, `https://x/gone${i}`, F.hearings.url, F.hearings.label,
      `2026-09-${String(10 + (i % 15)).padStart(2, "0")}T00:00:00.000Z`, "2026-09-26T00:00:00.000Z", "Tuesday, 1 September 2026 - Canberra");
  }
  const { items: held } = await queryStateSignals(e, { feeds: [F.hearings.label], now: new Date("2026-10-05T02:00:00Z") });
  assert.equal(held.length, 10);
  assert.ok(held.some((h) => h.guid === "listed"), "the upcoming hearing is held");
});

// ---- Defect 6: Senate estimates threads per committee ------------------------

test("defect-6: Senate estimates links key on committee and round", () => {
  assert.equal(
    canonicalThreadKey("Budget Estimates 2026–27", "https://www.aph.gov.au/Parliamentary_Business/Senate_estimates/legcon/2026-27_Budget_estimates", "report"),
    "key:estimates/legcon/2026-27_budget_estimates",
  );
  assert.equal(canonicalThreadKey("Budget Estimates 2026–27", "https://www.aph.gov.au/Parliamentary_Business/Senate_estimates/ec/2026-27_Budget_estimates", "report"),
    "key:estimates/ec/2026-27_budget_estimates");
});

test("defect-6: the five committees' Budget Estimates 2026-27 reports are five threads, not one", async () => {
  const e = env();
  mockFetch({ [F.reports.url]: REPORTS_XML });
  await pollAndArchive(e);
  await backfillThreads(e, 500);
  const est = rows(e, `SELECT s.guid, st.thread_id FROM signals s JOIN signal_threads st ON st.signal_guid = s.guid
    WHERE s.link LIKE '%/Senate_estimates/%'`);
  const budget = est.filter((r) => /2026-27_Budget_estimates$/.test(r.guid));
  assert.equal(budget.length, 5, "ec, rrat, legcon, fadt, fpa");
  assert.equal(new Set(budget.map((r) => r.thread_id)).size, 5);
  assert.equal(new Set(est.map((r) => r.thread_id)).size, est.length, "every estimates page its own thread");
});

// ---- Defect 7: XML entities decoded ------------------------------------------

test("defect-7: links, titles and descriptions have XML entities decoded once", () => {
  const xml = `<rss><channel><item><title>Smith &amp; Jones &#8211; &quot;Q&quot; &#39;x&#39; &#x2019;</title>`
    + `<link>https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results?q=&amp;sen=1&amp;hash=abc</link>`
    + `<description>a &amp;lt; b &lt;i&gt; &bogus; &#0;</description></item>`
    + `<item><title><![CDATA[Keep &amp; literal]]></title><link>https://www.aph.gov.au/y</link></item></channel></rss>`;
  const [a, b] = parseFeed(xml, F.senators);
  assert.equal(a.link, "https://www.aph.gov.au/Senators_and_Members/Parliamentarian_Search_Results?q=&sen=1&hash=abc");
  assert.equal(a.guid, a.link);
  assert.equal(a.title, "Smith & Jones – \"Q\" 'x' ’");
  assert.equal(a.description, "a &lt; b <i> &bogus; &#0;", "one pass; unknown or invalid references left as written");
  assert.equal(b.title, "Keep &amp; literal", "CDATA is literal text");
});
