// Worker 0.16.6: fixes from the recheck of the 0.16.5 candidate (5 Oct 2026).
// Real SQL (node:sqlite) through tests/support/sqlite-d1.mjs.
//
//   1. A link two feeds share is keyed from its STORED owner (chooseGuid),
//      and only the owning feed rewrites a row. Seeded with the five
//      production rows at links New Senate inquiries and Senate reports
//      tabled share (production /archive, 5 Oct 2026): two report-owned, three
//      inquiry-owned, two of those carrying a report title (0.16.1 flip).
//   2. A row stored for the first time whose pubDate is more than
//      FRESH_ARRIVAL_DAYS old (a backfill) fires no alert, enters no digest
//      and is not counted in new_items. It is still stored and threaded.
//   3. Cosmetic: the XML_NAMED_ENTITIES declaration spacing.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.6.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { pollAndArchive, parseFeed, chooseGuid } = await import("../src/archive.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");
const { isFreshArrival, FRESH_ARRIVAL_SQL, FRESH_ARRIVAL_DAYS } = await import("../src/workerScoring.ts");
const worker = (await import("../src/index.ts")).default;

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const fixture = (name) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
const REPORTS_XML = fixture("senate-reports-2026-10-05.xml");
const INQUIRIES_XML = fixture("senate-inquiries-shared-2026-10-05.xml");
const SRC = (name) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), "utf8");

const feed = (label) => APH_FEEDS.find((f) => f.label === label);
const F = { inquiries: feed("New Senate inquiries"), reports: feed("Senate reports tabled") };
const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rss = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items.map((i) =>
  `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link>${i.description ? `<description>${esc(i.description)}</description>` : ""}<pubDate>${i.pubDate}</pubDate></item>`).join("\n")}</channel></rss>`;

/**
 * 0.16.10: a poll writes at most MAX_NEW_PER_POLL new rows (D1's 1,000
 * queries per invocation), so filling the 134-report feed takes more than one
 * poll. Polls until nothing is deferred; each is its own invocation.
 */
async function pollUntilSettled(e) {
  for (let i = 0; i < 5; i++) {
    e.ARCHIVE.resetQueries();
    const r = await pollAndArchive(e);
    if (!r.perFeed.some((f) => f.deferred)) return r;
  }
  throw new Error("poll did not settle in 5 polls");
}

function mockFetch(bodies) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    const b = bodies[url];
    if (b && typeof b === "object") return new Response("upstream error", { status: b.status });
    return new Response(b ?? EMPTY, { status: 200 });
  };
}
const env = () => ({ ALLOWED_ORIGINS: "https://parliament-pulse.pages.dev", CACHE: memoryKv(), ARCHIVE: sqliteD1() });
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));

const BASE = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/";
const L = {
  health: `${BASE}Community_Affairs/HealthIncentivePayments`,
  tga: `${BASE}Community_Affairs/TGAMedicinesGoods`,
  zero: `${BASE}Environment_and_Communications/TripleZero48P`,
  ffs: `${BASE}Finance_and_Public_Administration/FederalFinancialSupport`,
  prod: `${BASE}Productivity_in_Australia/ProductivityinAustralia`,
};
const SHARED = Object.values(L);
const reportItems = parseFeed(REPORTS_XML, F.reports);
const inquiryItems = parseFeed(INQUIRIES_XML, F.inquiries);
const descOf = (items, link, title) => {
  const it = items.find((i) => i.link === link && i.title === title);
  if (!it) throw new Error(`no fixture item ${link} ${title}`);
  return it.description;
};

// The five production rows (production /archive, read 5 Oct 2026): guid,
// kind, title, pub_date and first_seen_at as stored. /archive does not serve
// description; 0.16.1's re-seen UPDATE set it from the same item as the
// title, so each row's description is that item's (the report's for a
// flipped inquiry row; the inquiry's for TGA, whose report 0.16.1 dropped as
// a title duplicate, so it never updated the row).
const PROD = [
  { link: L.tga, kind: "inquiry", title: "Therapeutic Goods Amendment (Medicines Shortages and Other Measures) Bill 2026 and a related bill", pub: "2026-07-01T14:00:00.000Z", first: "2026-08-10T07:00:41.704Z", descFrom: "inquiries" },
  { link: L.health, kind: "inquiry", title: "Health Insurance Amendment (Incentive Payments and Other Measures) Bill 2026", pub: "2026-06-24T14:00:00.000Z", first: "2026-06-30T02:00:28.243Z", descFrom: "reports" },
  { link: L.ffs, kind: "report", title: "Financial support for state and territory infrastructure projects", pub: "2026-04-07T14:00:00.000Z", first: "2026-04-25T21:30:22.602Z", descFrom: "reports" },
  { link: L.zero, kind: "report", title: "Triple Zero service outage [Third progress report]", pub: "2026-02-17T13:00:00.000Z", first: "2026-04-25T21:30:22.602Z", descFrom: "reports" },
  { link: L.prod, kind: "inquiry", title: "Interim report: Housing", pub: "2025-11-03T13:00:00.000Z", first: "2026-08-11T02:00:28.193Z", descFrom: "reports" },
];

function seed(e, which = PROD) {
  for (const r of which) {
    const f = r.kind === "report" ? F.reports : F.inquiries;
    const desc = descOf(r.descFrom === "reports" ? reportItems : inquiryItems, r.link, r.title);
    e.ARCHIVE.raw.prepare(
      `INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, attention, confidence, description)
       VALUES (?, ?, ?, ?, ?, ?, 'Senate', ?, ?, '2026-10-05T10:00:33.639Z', 'med', 3, ?)`,
    ).run(r.link, r.title, r.link, r.pub, f.url, f.label, f.kind, r.first, desc);
  }
}

const sharedRows = (e) => rows(e,
  `SELECT guid, feed_label, kind, title, first_seen_at FROM signals
    WHERE ${SHARED.map(() => "(guid = ? OR substr(guid, 1, length(?) + 1) = ? || '#')").join(" OR ")} ORDER BY guid`,
  ...SHARED.flatMap((l) => [l, l, l]));

// ---- Fix 1 -------------------------------------------------------------------

test("fix-1: production-shaped shared links are stable across both, inquiry gone, gone and back polls", async () => {
  const e = env();
  seed(e);
  const both = { [F.inquiries.url]: INQUIRIES_XML, [F.reports.url]: REPORTS_XML };
  const gone = { [F.inquiries.url]: EMPTY, [F.reports.url]: REPORTS_XML };

  mockFetch(both);
  await pollUntilSettled(e);
  const s1 = sharedRows(e);

  // Each feed's items at each shared link are stored exactly once.
  for (const link of SHARED) {
    const atLink = s1.filter((r) => r.guid === link || r.guid.startsWith(`${link}#`));
    const inq = atLink.filter((r) => r.feed_label === F.inquiries.label);
    const rep = atLink.filter((r) => r.feed_label === F.reports.label);
    assert.deepEqual(inq.map((r) => r.title), inquiryItems.filter((i) => i.link === link).map((i) => i.title),
      `one inquiry row with the inquiries feed's title at ${link}`);
    assert.deepEqual(rep.map((r) => r.title).sort(), reportItems.filter((i) => i.link === link).map((i) => i.title).sort(),
      `each report at ${link} once, with its own title`);
  }
  const byGuid = Object.fromEntries(s1.map((r) => [r.guid, r]));
  // Inquiry-owned rows keep the bare link and get the inquiry title back.
  assert.equal(byGuid[L.health].title, "Private Health Insurance Amendment (Modernising the Private Health Insurance Rebate) Bill 2026");
  assert.equal(byGuid[L.health].feed_label, F.inquiries.label);
  assert.equal(byGuid[L.prod].title, "Select Committee on Productivity in Australia");
  assert.equal(byGuid[L.prod].first_seen_at, "2026-08-11T02:00:28.193Z", "the healed row is the same row");
  // Report-owned rows keep the bare link and a report title; the inquiry is a
  // row of its own.
  assert.equal(byGuid[L.zero].feed_label, F.reports.label);
  // 0.16.8: the stored row's pub_date (2026-02-17) names its document, the
  // aviation report; its 0.16.1 title does not. The row keeps that date and
  // first_seen_at and takes the aviation title back; the third progress
  // report is a row of its own at L#pubDate. 0.16.7 matched on title first
  // and re-dated the row to 2026-08-05 instead.
  const aviation = reportItems.find((i) => i.link === L.zero && i.pubDate === "2026-02-17T13:00:00.000Z");
  assert.match(aviation.title, /^State of Australia.s aviation sector/);
  assert.equal(byGuid[L.zero].title, aviation.title);
  assert.equal(rows(e, `SELECT pub_date FROM signals WHERE guid = ?`, L.zero)[0].pub_date, "2026-02-17T13:00:00.000Z");
  assert.equal(byGuid[L.zero].first_seen_at, "2026-04-25T21:30:22.602Z", "the report row is not re-inserted");
  assert.equal(byGuid[`${L.zero}#2026-08-05T14:00:00.000Z`].title, "Triple Zero service outage [Third progress report]");
  assert.equal(byGuid[`${L.zero}#2026-08-05T14:00:00.000Z`].feed_label, F.reports.label);
  assert.equal(byGuid[`${L.zero}#2026-02-17T13:00:00.000Z`], undefined, "the aviation report is not stored twice");
  assert.equal(byGuid[L.ffs].feed_label, F.reports.label);
  assert.equal(byGuid[`${L.zero}#2025-10-27T13:00:00.000Z`].title, "Triple Zero service outage");
  assert.equal(byGuid[`${L.zero}#2025-10-27T13:00:00.000Z`].feed_label, F.inquiries.label);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.reports.url)[0].n, 134);

  for (const [label, bodies] of [["inquiry gone", gone], ["gone again", gone], ["inquiry back", both]]) {
    mockFetch(bodies);
    e.ARCHIVE.resetQueries();
    const r = await pollAndArchive(e);
    assert.deepEqual(sharedRows(e), s1, `rows unchanged after poll: ${label}`);
    assert.equal(r.perFeed.reduce((a, f) => a + f.new, 0), 0, `nothing new after poll: ${label}`);
    assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.reports.url)[0].n, 134);
  }
});

test("fix-1: another feed re-seeing a stored guid refreshes last_seen_at only", async () => {
  const e = env();
  seed(e, PROD.filter((r) => r.link === L.zero));
  mockFetch({ [F.inquiries.url]: INQUIRIES_XML, [F.reports.url]: EMPTY });
  await pollAndArchive(e);
  const [row] = rows(e, `SELECT title, feed_label, kind, pub_date, description FROM signals WHERE guid = ?`, L.zero);
  assert.equal(row.title, "Triple Zero service outage [Third progress report]");
  assert.equal(row.feed_label, F.reports.label);
  assert.equal(row.pub_date, "2026-02-17T13:00:00.000Z");
  assert.match(row.description, /tabled a progress report/);
});

test("fix-1 guard: an undated item from another feed at a stored link cannot rewrite the row", async () => {
  const e = env();
  seed(e, PROD.filter((r) => r.link === L.zero));
  // Undated, so it cannot be keyed L#pubDate: it re-sees the bare row.
  const undated = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>Triple Zero service outage</title><link>${L.zero}</link><description>Inquiry text</description></item></channel></rss>`;
  mockFetch({ [F.inquiries.url]: undated, [F.reports.url]: EMPTY });
  const r = await pollAndArchive(e);
  const all = rows(e, `SELECT guid, title, feed_label, description, last_seen_at FROM signals`);
  assert.equal(all.length, 1);
  assert.equal(all[0].title, "Triple Zero service outage [Third progress report]");
  assert.equal(all[0].feed_label, F.reports.label);
  assert.match(all[0].description, /tabled a progress report/);
  assert.notEqual(all[0].last_seen_at, "2026-10-05T10:00:33.639Z", "last_seen_at is refreshed");
  assert.equal(r.perFeed.find((f) => f.feed === F.inquiries.url).new, 0);
});

// 0.16.7: the 0.16.6 re-split heal is removed. On the full production seed
// it moved 24 of 75 New Senate inquiries rows into Senate reports tabled and
// overwrote their pub_date. A flipped inquiry row now stays an inquiry row.
test("fix-1 (0.16.7): a flipped inquiry row whose inquiry has left its feed STAYS an inquiry row; the report is stored at L#pubDate", async () => {
  const e = env();
  seed(e, PROD.filter((r) => r.link === L.prod));
  // The inquiries feed is fetched and lists other inquiries, not this one.
  const others = rss([{ title: "Another inquiry", link: `${BASE}Economics/Another`, pubDate: "Thu, 01 Oct 2026 00:00:00 +1000" }]);
  mockFetch({ [F.inquiries.url]: others, [F.reports.url]: REPORTS_XML });
  await pollUntilSettled(e);
  const at = () => rows(e, `SELECT guid, feed_label, kind, title, pub_date, first_seen_at FROM signals WHERE guid = ? OR substr(guid, 1, length(?) + 1) = ? || '#' ORDER BY guid`, L.prod, L.prod, L.prod);
  const after = at();
  assert.equal(after.length, 2);
  assert.deepEqual(after[0], {
    guid: L.prod, feed_label: F.inquiries.label, kind: "inquiry", title: "Interim report: Housing",
    pub_date: "2025-11-03T13:00:00.000Z", first_seen_at: "2026-08-11T02:00:28.193Z",
  }, "the inquiry row keeps its feed, kind and pub_date");
  assert.equal(after[1].guid, `${L.prod}#2026-08-10T14:00:00.000Z`);
  assert.equal(after[1].feed_label, F.reports.label);
  assert.equal(after[1].kind, "report");
  assert.equal(after[1].title, "Interim report: Housing");
  assert.equal(after[1].pub_date, "2026-08-10T14:00:00.000Z");
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.inquiries.url)[0].n, 2, "the inquiries feed still holds its rows");
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.reports.url)[0].n, 134);
  await pollAndArchive(e);
  assert.deepEqual(at(), after, "stable on the next poll");
});

test("fix-1 heal restraint: no re-split when the owning feed failed, or the row is the inquiry's own", async () => {
  // (a) The inquiries feed failed this poll: it may still list the inquiry.
  const a = env();
  seed(a, PROD.filter((r) => r.link === L.prod));
  mockFetch({ [F.inquiries.url]: { status: 500 }, [F.reports.url]: REPORTS_XML });
  await pollAndArchive(a);
  const ra = rows(a, `SELECT guid, feed_label FROM signals WHERE guid = ? OR substr(guid, 1, length(?) + 1) = ? || '#' ORDER BY guid`, L.prod, L.prod, L.prod);
  assert.deepEqual(ra, [
    { guid: L.prod, feed_label: F.inquiries.label },
    { guid: `${L.prod}#2026-08-10T14:00:00.000Z`, feed_label: F.reports.label },
  ]);
  // (b) TGA: the inquiry and the report share a title, but the row carries the
  // inquiry's description, so it is the inquiry's own row.
  const b = env();
  seed(b, PROD.filter((r) => r.link === L.tga));
  mockFetch({ [F.inquiries.url]: EMPTY, [F.reports.url]: REPORTS_XML });
  await pollAndArchive(b);
  const rb = rows(b, `SELECT guid, feed_label FROM signals WHERE guid = ? OR substr(guid, 1, length(?) + 1) = ? || '#' ORDER BY guid`, L.tga, L.tga, L.tga);
  assert.deepEqual(rb, [
    { guid: L.tga, feed_label: F.inquiries.label },
    { guid: `${L.tga}#2026-08-31T14:00:00.000Z`, feed_label: F.reports.label },
  ]);
});

test("fix-1: chooseGuid keys from the stored owner", () => {
  const it = { title: "T", link: "https://x/L", pubDate: "2026-09-01T00:00:00.000Z", guid: "https://x/L", description: null };
  const own = (feed_url) => ({ feed_url, title: "S", description: null, pub_date: null });
  // L stored by this feed: L.
  assert.equal(chooseGuid(it, "rep", new Set(), new Map([["https://x/L", own("rep")]])).item.guid, "https://x/L");
  // L stored by another feed: L#pubDate, never a hand-over (0.16.7).
  const other = chooseGuid(it, "rep", new Set(), new Map([["https://x/L", own("inq")]]));
  assert.equal(other.item.guid, "https://x/L#2026-09-01T00:00:00.000Z");
  assert.equal(other.adoptFrom, undefined);
  // L#pubDate stored by this feed wins even when L is free.
  assert.equal(chooseGuid(it, "rep", new Set(), new Map([["https://x/L#2026-09-01T00:00:00.000Z", own("rep")]])).item.guid, "https://x/L#2026-09-01T00:00:00.000Z");
  // Nothing stored, nothing seen: L.
  assert.equal(chooseGuid(it, "rep", new Set(), new Map()).item.guid, "https://x/L");
});

// ---- Fix 2 -------------------------------------------------------------------

const DAY = 24 * 3600 * 1000;
const rfc = (ms) => new Date(ms).toUTCString();

test("fix-2: a backfilled old report is stored and threaded but fires no alert and is not new_items", async () => {
  const e = env();
  e.ARCHIVE.raw.prepare(`INSERT INTO alert_rules (name, terms, attention_min, created_at, active) VALUES ('any', '', 'low', '2026-01-01T00:00:00.000Z', 1)`).run();
  const old = { title: "Old report tabled weeks ago", link: `${BASE}Economics/OldOne`, pubDate: rfc(Date.now() - 40 * DAY) };
  const fresh = { title: "Fresh report tabled yesterday", link: `${BASE}Economics/FreshOne`, pubDate: rfc(Date.now() - 1 * DAY) };
  mockFetch({ [F.reports.url]: rss([old, fresh]) });
  const ctx = { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
  await worker.scheduled({ cron: "*/30 * * * *", scheduledTime: Date.now() }, e, ctx);
  await Promise.all(ctx.pending);

  assert.deepEqual(rows(e, `SELECT title FROM signals ORDER BY title`).map((r) => r.title), [fresh.title, old.title], "both stored");
  const unthreaded = rows(e, `SELECT COUNT(*) AS n FROM signals s LEFT JOIN signal_threads st ON st.signal_guid = s.guid WHERE st.signal_guid IS NULL`)[0].n;
  assert.equal(unthreaded, 0, "both threaded");
  assert.deepEqual(rows(e, `SELECT title FROM alert_events`).map((r) => r.title), [fresh.title], "only the fresh arrival fires");
  const run = rows(e, `SELECT detail FROM job_runs WHERE job = 'poll' ORDER BY id DESC LIMIT 1`)[0];
  const detail = JSON.parse(run.detail);
  assert.equal(detail.new_items, 1);
  assert.equal(detail.backfilled_items, 1);
});

test("fix-2: FRESH_ARRIVAL_SQL and isFreshArrival agree, boundary included", () => {
  assert.equal(FRESH_ARRIVAL_DAYS, 7);
  const e = env();
  const at = "2026-10-05T10:00:00.000Z";
  const atMs = Date.parse(at);
  const cases = [
    null,
    new Date(atMs - 7 * DAY).toISOString(),
    new Date(atMs - 7 * DAY - 1).toISOString(),
    new Date(atMs - 40 * DAY).toISOString(),
    new Date(atMs - 1 * DAY).toISOString(),
    new Date(atMs + 1 * DAY).toISOString(),
  ];
  cases.forEach((pub, i) => {
    e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at) VALUES (?, 't', 'l', ?, 'f', 'F', 'Senate', 'report', ?, ?)`).run(`g${i}`, pub, at, at);
  });
  const fresh = new Set(rows(e, `SELECT guid FROM signals WHERE ${FRESH_ARRIVAL_SQL}`).map((r) => r.guid));
  cases.forEach((pub, i) => assert.equal(fresh.has(`g${i}`), isFreshArrival(pub, at), `case ${i} ${pub}`));
  assert.deepEqual([...fresh].sort(), ["g0", "g1", "g4", "g5"]);
});

test("fix-2: the (dormant) digest query and the alert query apply FRESH_ARRIVAL_SQL", () => {
  assert.match(SRC("digest.ts"), /WHERE first_seen_at >= \?\s+AND \$\{FRESH_ARRIVAL_SQL\}/);
  assert.match(SRC("archive.ts"), /WHERE first_seen_at > \? AND first_seen_at <= \? AND \$\{FRESH_ARRIVAL_SQL\}/);
});

// ---- Fix 3 -------------------------------------------------------------------

test("fix-3: XML_NAMED_ENTITIES declaration is spaced", () => {
  assert.match(SRC("archive.ts"), /const XML_NAMED_ENTITIES: Record<string, string> = \{ amp/);
});
