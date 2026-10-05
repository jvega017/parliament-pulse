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
// 0.16.8 adds the keepStoredIdentity match-order tests (pub_date before
// title; no title-only match for a dated stored report) and recheck8's
// probes P1, P2b, P2c and P2d here; the aphcms and watermark probes are in
// review-0.16.8.test.mjs.
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

// ---- 0.16.8: match order in keepStoredIdentity ---------------------------------
// Title AND pub_date, then pub_date, then title (title alone never in the
// Senate reports feed for a dated stored row). Each step is pinned by a case
// only that step decides.

test("0.16.8 step 1: title AND pub_date beats an item matching on pub_date alone", () => {
  // Two items share the stored date; only one also has the stored title.
  const own = new Map([[L, { feed_url: "rep", description: null, title: "A", pub_date: "2026-09-01T00:00:00.000Z" }]]);
  const newest = { title: "B", link: L, pubDate: "2026-09-02T00:00:00.000Z", guid: L, description: null };
  const sameDate = { title: "C", link: L, pubDate: "2026-09-01T00:00:00.000Z", guid: `${L}#2026-09-01T00:00:00.000Z`, description: null };
  const exact = { title: "A", link: L, pubDate: "2026-09-01T00:00:00.000Z", guid: `${L}#2026-09-01T00:00:00.000Z`, description: null };
  const out = keepStoredIdentity([newest, sameDate, exact], "rep", "report", own);
  assert.equal(out[2].guid, L, "the exact match keeps L");
  assert.equal(out[1].guid, `${L}#2026-09-01T00:00:00.000Z`, "the date-only match is not chosen");
  assert.equal(out[0].guid, `${L}#2026-09-02T00:00:00.000Z`);
});

test("0.16.8 step 1: title AND pub_date beats an item matching on title alone (non-report feed)", () => {
  const own = new Map([[L, { feed_url: "prog", description: null, title: "A", pub_date: "2026-09-01T00:00:00.000Z" }]]);
  const newest = { title: "A", link: L, pubDate: "2026-09-03T00:00:00.000Z", guid: L, description: null };
  const exact = { title: "A", link: L, pubDate: "2026-09-01T00:00:00.000Z", guid: `${L}#2026-09-01T00:00:00.000Z`, description: null };
  const out = keepStoredIdentity([newest, exact], "prog", "program", own);
  assert.equal(out[1].guid, L, "the exact match keeps L, not the newest same-titled item");
  assert.equal(out[0].guid, `${L}#2026-09-03T00:00:00.000Z`);
});

test("0.16.8 step 2: pub_date beats title (the production TripleZero48P shape)", () => {
  // Stored row: 0.16.1 gave it the NEWEST report's title but kept the older
  // report's date. The dated item is the row's document.
  const own = new Map([[L, { feed_url: "rep", description: null, title: "Third", pub_date: "2026-02-17T13:00:00.000Z" }]]);
  const third = { title: "Third", link: L, pubDate: "2026-08-05T14:00:00.000Z", guid: L, description: null };
  const aviation = { title: "Aviation", link: L, pubDate: "2026-02-17T13:00:00.000Z", guid: `${L}#2026-02-17T13:00:00.000Z`, description: null };
  const progress = { title: "Progress", link: L, pubDate: "2025-12-09T13:00:00.000Z", guid: `${L}#2025-12-09T13:00:00.000Z`, description: null };
  for (const kind of ["report", "program"]) {
    const out = keepStoredIdentity([third, aviation, progress], "rep", kind, own);
    assert.deepEqual(out.map((i) => `${i.title}=${i.guid}`),
      [`Third=${L}#2026-08-05T14:00:00.000Z`, `Aviation=${L}`, `Progress=${L}#2025-12-09T13:00:00.000Z`], kind);
  }
});

test("0.16.8 step 3: title alone matches outside the reports feed, and for an undated stored report", () => {
  const newest = { title: "B", link: L, pubDate: "2026-09-02T00:00:00.000Z", guid: L, description: null };
  const older = { title: "A", link: L, pubDate: "2026-09-01T00:00:00.000Z", guid: `${L}#2026-09-01T00:00:00.000Z`, description: null };
  const keys = (out) => out.map((i) => `${i.title}=${i.guid}`);
  // Stored row A with a date no item carries: other feeds match on title.
  const dated = new Map([[L, { feed_url: "f", description: null, title: "A", pub_date: "2026-08-01T00:00:00.000Z" }]]);
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "f", "program", dated)), [`B=${L}#2026-09-02T00:00:00.000Z`, `A=${L}`]);
  // The reports feed does not: no item matches, the newest is a new report
  // and the older item keeps its own L#pubDate key.
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "f", "report", dated)),
    [`B=${L}#2026-09-02T00:00:00.000Z`, `A=${L}#2026-09-01T00:00:00.000Z`]);
  // An undated stored report has only its title to go on.
  const undated = new Map([[L, { feed_url: "f", description: null, title: "A", pub_date: null }]]);
  assert.deepEqual(keys(keepStoredIdentity([newest, older], "f", "report", undated)), [`B=${L}#2026-09-02T00:00:00.000Z`, `A=${L}`]);
});

test("0.16.8 (probe P2b): a new SAME-titled report at a link whose stored report has left the feed is a new row and alerts", async () => {
  const e = env();
  anyRule(e);
  const T = "National Disability Insurance Scheme Amendment Bill 2026";
  const old = { guid: L, link: L, title: T, pub: iso(T0 - 50 * DAY), first: iso(T0 - 49 * DAY), feed: F.reports, description: "first report" };
  insert(e, old);
  await e.CACHE.put("alert:watermark", iso(T0 - 1000));
  mockFetch({ [F.reports.url]: rss([{ title: T, link: L, pubDate: rfc(T0 - DAY), description: "second report" }]) });
  await pollAndArchive(e);
  const s = rows(e, `SELECT guid, title, pub_date, first_seen_at, description FROM signals ORDER BY guid`);
  assert.equal(s.length, 2, "the new report is a new row");
  assert.deepEqual(s[0], { guid: L, title: T, pub_date: old.pub, first_seen_at: old.first, description: "first report" }, "stored row unchanged");
  assert.equal(s[1].guid, `${L}#${iso(T0 - DAY)}`);
  assert.deepEqual(rows(e, `SELECT signal_guid FROM alert_events`).map((r) => r.signal_guid), [`${L}#${iso(T0 - DAY)}`], "the new report alerts once");
  // Re-polled, nothing changes and nothing re-alerts.
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals`)[0].n, 2);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 1);
});

test("0.16.8 restraint (P2b in the House daily program): a re-dated same-titled item still rewrites L", async () => {
  const e = env();
  const P = "https://www.aph.gov.au/House_of_Representatives/House_of_Representatives_Daily_Program";
  insert(e, { guid: P, link: P, title: "Daily Program", pub: iso(T0 - 20 * DAY), first: iso(T0 - 20 * DAY), feed: F.program });
  mockFetch({ [F.program.url]: rss([{ title: "Daily Program", link: P, pubDate: rfc(T0 - DAY) }]) });
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT guid, pub_date FROM signals`), [{ guid: P, pub_date: iso(T0 - DAY) }]);
});

test("0.16.8 (probe P2d): a 0.16.1-flipped stored report keeps its date and first_seen_at, and a 4th report alone alerts", async () => {
  const e = env();
  anyRule(e);
  const A = { title: "Aviation sector report", link: L, pubDate: rfc(T0 - 230 * DAY) };
  const P = { title: "Triple Zero [Progress report]", link: L, pubDate: rfc(T0 - 300 * DAY) };
  const Th = { title: "Triple Zero [Third progress report]", link: L, pubDate: rfc(T0 - 60 * DAY) };
  const seeded = { guid: L, link: L, title: Th.title, pub: iso(T0 - 230 * DAY), first: iso(T0 - 160 * DAY), feed: F.reports };
  insert(e, seeded);
  await e.CACHE.put("alert:watermark", iso(T0 - 1000));
  mockFetch({ [F.reports.url]: rss([Th, A, P]) });
  await pollAndArchive(e);
  const [row] = rows(e, `SELECT title, pub_date, first_seen_at FROM signals WHERE guid = ?`, L);
  assert.deepEqual(row, { title: A.title, pub_date: seeded.pub, first_seen_at: seeded.first });
  assert.equal(rows(e, `SELECT title FROM signals WHERE guid = ?`, `${L}#${iso(T0 - 60 * DAY)}`)[0]?.title, Th.title);
  mockFetch({ [F.reports.url]: rss([{ title: "Triple Zero [Final report]", link: L, pubDate: rfc(T0 - DAY) }, Th, A, P]) });
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals`)[0].n, 4);
  assert.deepEqual(rows(e, `SELECT feed_url, link, pub_date, COUNT(*) n FROM signals GROUP BY feed_url, link, pub_date HAVING n > 1`), []);
  assert.deepEqual(rows(e, `SELECT title FROM alert_events`).map((r) => r.title), ["Triple Zero [Final report]"]);
});

test("0.16.8 (probe P2c): a new SAME-titled report while the old one is still listed is a new row; the stored row is unchanged", async () => {
  const e = env();
  anyRule(e);
  const T = "National Disability Insurance Scheme Amendment Bill 2026";
  const old = { guid: L, link: L, title: T, pub: iso(T0 - 50 * DAY), first: iso(T0 - 49 * DAY), feed: F.reports };
  insert(e, old);
  await e.CACHE.put("alert:watermark", iso(T0 - 1000));
  mockFetch({ [F.reports.url]: rss([{ title: T, link: L, pubDate: rfc(T0 - DAY) }, { title: T, link: L, pubDate: rfc(T0 - 50 * DAY) }]) });
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT pub_date, first_seen_at FROM signals WHERE guid = ?`, L), [{ pub_date: old.pub, first_seen_at: old.first }]);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals`)[0].n, 2);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 1);
});

// ---- 0.16.8 (probe P1): shared-link ownership across feed presence cycles -----
const PL = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/ProbeShared";
for (const start of ["empty", "owner-inquiries", "owner-reports", "owner-inquiries-flipped"]) {
  test(`0.16.8 (probe P1) shared link, start=${start}: inquiry present, absent, present, absent, present`, async () => {
    const e = env();
    anyRule(e);
    const inq = { title: "Inquiry into probes", link: PL, pubDate: rfc(T0 - 60 * DAY) };
    const rep = { title: "Interim report: probes", link: PL, pubDate: rfc(T0 - 30 * DAY) };
    if (start === "owner-inquiries") insert(e, { guid: PL, link: PL, title: inq.title, pub: iso(T0 - 60 * DAY), first: iso(T0 - 59 * DAY), feed: F.inquiries });
    if (start === "owner-reports") insert(e, { guid: PL, link: PL, title: rep.title, pub: iso(T0 - 30 * DAY), first: iso(T0 - 29 * DAY), feed: F.reports });
    // 0.16.1 flip: an inquiries row carrying the report's title, with the inquiry's date.
    if (start === "owner-inquiries-flipped") insert(e, { guid: PL, link: PL, title: rep.title, pub: iso(T0 - 60 * DAY), first: iso(T0 - 59 * DAY), feed: F.inquiries });
    await e.CACHE.put("alert:watermark", iso(T0 - 1000));
    const snap = () => rows(e, `SELECT guid, title, pub_date, feed_label, first_seen_at FROM signals ORDER BY guid`);
    const seeded = snap();
    const both = { [F.inquiries.url]: rss([inq]), [F.reports.url]: rss([rep]) };
    const repOnly = { [F.reports.url]: rss([rep]) };
    const states = [];
    for (const b of [both, repOnly, both, repOnly, both]) { mockFetch(b); await pollAndArchive(e); states.push(snap()); }
    for (const s of seeded) {
      const now = states.at(-1).find((r) => r.guid === s.guid);
      assert.ok(now, `seeded row ${s.guid} still present`);
      assert.equal(now.feed_label, s.feed_label, "seeded row keeps its feed");
      assert.equal(now.pub_date, s.pub_date, "seeded row keeps its pub_date");
      assert.equal(now.first_seen_at, s.first_seen_at, "seeded row keeps first_seen_at");
    }
    for (let i = 1; i < states.length; i += 1) assert.deepEqual(states[i], states[0], `poll ${i + 1} identical to poll 1`);
    assert.equal(states[0].filter((r) => r.feed_label === F.reports.label).length, 1, "one reports row");
    assert.equal(states[0].find((r) => r.feed_label === F.reports.label).title, rep.title);
    assert.equal(states[0].filter((r) => r.feed_label === F.inquiries.label).length, 1, "one inquiries row");
    assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 0, "no alerts for items older than 7 days");
  });
}

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
