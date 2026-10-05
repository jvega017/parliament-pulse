// Worker 0.16.3: fixes from the 5 Oct 2026 data, UX and security review of
// the live release (Worker 0.16.1). Each test names the review finding it
// covers. Real SQL (node:sqlite, every migration applied) and real feed text
// where the review measured it: tests/fixtures/senate-reports-2026-10-05.xml
// is the live Senate reports feed as fetched on 5 Oct 2026 (134 items), and
// upcoming-hearings-2026-10-05.json is the live Upcoming Senate hearings feed.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-2026-10-05.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const archive = await import("../src/archive.ts");
const { pollAndArchive, parseFeed, pickPerGuid, fallbackTitle, canonicalAphUrl, clampLimit, brisbaneToday, backfillThreads, THREAD_ID_PREFIX } = archive;
const { buildState } = await import("../src/state.ts");
const { APH_FEEDS, sourceGroupForItem, sourceGroupFor } = await import("../src/feeds.ts");
const { parseHearingDate } = await import("../src/hearingDate.ts");
const { checkRateLimit } = await import("../src/rateLimit.ts");
const { default: worker } = await import("../src/index.ts");

console.warn = () => {};
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
  digests: feed("Bills Digests"),
  program: feed("House daily program"),
  news: feed("House news"),
  divisions: feed("House divisions"),
  todayHouse: feed("Today's House and joint hearings"),
};

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function rss(items) {
  const body = items.map((i) => `<item>${i.title !== undefined ? `<title>${esc(i.title)}</title>` : ""}<link>${esc(i.link)}</link>`
    + `${i.guid ? `<guid>${esc(i.guid)}</guid>` : ""}${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ""}`
    + `${i.description ? `<description>${esc(i.description)}</description>` : ""}</item>`).join("\n");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${body}</channel></rss>`;
}

// bodies: feed url -> xml. Every other feed answers an empty channel.
function mockFetch(bodies) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    return new Response(bodies[url] ?? EMPTY, { status: 200 });
  };
}

function env(extra = {}) {
  return { ALLOWED_ORIGINS: "https://parliament-pulse.pages.dev", CACHE: memoryKv(), ARCHIVE: sqliteD1(), ...extra };
}
function ctx() {
  return { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
}
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));

// ---- Data 1: no title dedup across feeds -------------------------------------

test("data-1: a Bills Digest that shares its bill's title with a Senate inquiry is archived", async () => {
  const title = "Treasury Laws Amendment (Tax Reform No. 2) Bill 2026";
  const e = env();
  mockFetch({
    [F.inquiries.url]: rss([{ title, link: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/TLABTaxReform2", pubDate: "Thu, 01 Oct 2026 00:00:00 +1000" }]),
    [F.digests.url]: rss([{ title, link: "https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22library%2Fprspub%2Fbd-tax2%22", guid: "bd-tax2", pubDate: "Fri, 02 Oct 2026 00:00:00 +1000" }]),
  });
  const r = await pollAndArchive(e);
  const bd = r.perFeed.find((f) => f.feed === F.digests.url);
  assert.equal(bd.new, 1, "the digest is new, not dropped as a title duplicate");
  assert.equal(bd.dedup, 0);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signals WHERE title = ?`, title)[0].n, 2);
  const bills = await (await worker.fetch(new Request("https://w.test/bills"), e, ctx())).json();
  assert.equal(bills.total, 1, "/bills counts the digest");
});

test("data-1 + data-7: every Senate report in the live feed is archived, past position 50", async () => {
  const e = env();
  mockFetch({ [F.reports.url]: REPORTS_XML });
  const parsed = parseFeed(REPORTS_XML, F.reports);
  assert.equal(parsed.length, 134, "the parser reads all 134 items");
  // 0.16.4 (defect 4): one row per distinct report, link plus pubDate, not per
  // link: 130 links carry 134 dated reports, and all 134 are archived.
  const distinct = new Set(parsed.map((p) => `${p.guid} ${p.pubDate}`)).size;
  assert.equal(distinct, 134);
  await pollAndArchive(e);
  const stored = rows(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.reports.url)[0].n;
  assert.equal(stored, distinct, "one row per distinct report");
  assert.ok(stored > 50, `more than the old 50-item cap (${stored})`);
  const annual = rows(e, `SELECT COUNT(*) AS n FROM signals WHERE title = 'Annual reports (No. 2 of 2026)'`)[0].n;
  assert.equal(annual, 8, "all eight committees' Annual reports (No. 2 of 2026)");
  const late = rows(e, `SELECT COUNT(*) AS n FROM signals WHERE title = 'Australian Centre for Disease Control Bill 2025 and a related bill'`)[0].n;
  assert.ok(late >= 1, "an item at position 110 is archived");
  const health = rows(e, `SELECT items_parsed FROM feed_health WHERE feed_url = ?`, F.reports.url)[0];
  assert.equal(health.items_parsed, 134, "items_parsed is the true feed count");
});

// ---- Data 2: per-item chamber -----------------------------------------------

test("data-2: the committee chamber in an item's link sets its group", () => {
  assert.equal(sourceGroupFor(F.todayHouse.label), "Joint", "feed rule, unchanged");
  assert.equal(sourceGroupForItem("https://www.aph.gov.au/Parliamentary_Business/Committees/House/Economics/RBAAnnualReport2025/Public_Hearings", F.todayHouse.label), "House");
  assert.equal(sourceGroupForItem("https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Corporations_and_Financial_Services/OversightASIC/Public_Hearings", F.hearings.label), "Joint");
  assert.equal(sourceGroupForItem("https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/X", F.todayHouse.label), "Senate");
  assert.equal(sourceGroupForItem("https://www.aph.gov.au/house/news/x", F.news.label), "House", "no committee path: feed rule");
  assert.equal(sourceGroupForItem("https://parlinfo.aph.gov.au/Committees/Senate/x/y", F.digests.label), "Library", "Library is never overridden");
});

test("data-2: ingest stores the per-item group; migration 0010 repairs old rows idempotently", async () => {
  const e = env();
  const houseLink = "https://www.aph.gov.au/Parliamentary_Business/Committees/House/Economics/RBAAnnualReport2025/Public_Hearings";
  mockFetch({ [F.todayHouse.url]: rss([{ title: "Standing Committee on Economics: Review of the Reserve Bank of Australia Annual Report 2025", link: houseLink, pubDate: "Wed, 30 Sep 2026 14:00:00 GMT" }]) });
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT source_group FROM signals WHERE guid = ?`, houseLink)[0].source_group, "House");
  // Rows as 0.16.2 wrote them.
  e.ARCHIVE.raw.exec(`UPDATE signals SET source_group = 'Joint' WHERE guid = '${houseLink}'`);
  e.ARCHIVE.raw.exec(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES ('j1', 'Oversight of ASIC', 'https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Corporations_and_Financial_Services/OversightASIC', 'u', 'Upcoming Senate hearings', 'Senate', 'hearing', 'x', 'x'),
           ('l1', 'A digest', 'https://parlinfo.aph.gov.au/Committees/Senate/x/y', 'u', 'Bills Digests', 'Library', 'digest', 'x', 'x'),
           ('s1', 'A Senate item', 'https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/Z', 'u', 'New Senate inquiries', 'Senate', 'inquiry', 'x', 'x')`);
  const sql = migration("0010_item_source_group.sql");
  e.ARCHIVE.raw.exec(sql);
  const once = rows(e, `SELECT guid, source_group FROM signals ORDER BY guid`);
  e.ARCHIVE.raw.exec(sql);
  assert.deepEqual(rows(e, `SELECT guid, source_group FROM signals ORDER BY guid`), once, "a second run changes nothing");
  const g = Object.fromEntries(once.map((r) => [r.guid, r.source_group]));
  assert.equal(g[houseLink], "House");
  assert.equal(g.j1, "Joint");
  assert.equal(g.l1, "Library");
  assert.equal(g.s1, "Senate");
});

// ---- Data 3 / hearing-date limit: the next hearing is the stored one ----------

test("data-3: of several hearings for one inquiry, the next one (Brisbane today) is stored", async () => {
  const items = HEARINGS.items.map((i) => ({ title: i.title, link: i.link, description: i.description }));
  const parsed = parseFeed(rss(items), F.hearings);
  const { items: kept, dropped } = pickPerGuid(parsed, "hearing", "2026-10-05");
  assert.equal(kept.length + dropped, parsed.length);
  const ndis = kept.find((k) => k.title === "Annual Report No. 2 of the 48th Parliament");
  assert.equal(parseHearingDate(ndis.description), "2026-10-06", "6 Oct, not the first-listed 11 Sep");
  const { items: later } = pickPerGuid(parsed, "hearing", "2026-12-31");
  const ndisLater = later.find((k) => k.title === "Annual Report No. 2 of the 48th Parliament");
  assert.equal(parseHearingDate(ndisLater.description), "2026-10-07", "all past: the latest past hearing");
  const { items: other } = pickPerGuid([parsed[0], { ...parsed[0], title: "second" }], "report", "2026-10-05");
  assert.equal(other[0].title, parsed[0].title, "non-hearing feeds keep the first listed item");
});

test("data-3: /state serves the next hearing date after a poll", async () => {
  const e = env();
  const items = HEARINGS.items.map((i) => ({ title: i.title, link: i.link, description: i.description }));
  mockFetch({ [F.hearings.url]: rss(items) });
  await pollAndArchive(e);
  const today = brisbaneToday();
  const state = await buildState(e);
  const ndis = state.blocks.signals.items.find((s) => s.title === "Annual Report No. 2 of the 48th Parliament");
  const dates = HEARINGS.items.filter((i) => i.title === ndis.title).map((i) => parseHearingDate(i.description)).sort();
  const expected = dates.find((d) => d >= today) ?? dates[dates.length - 1];
  assert.equal(ndis.hearing_date, expected);
});

// ---- Data 8: re-seen rows refresh pub_date -----------------------------------

test("data-8: a re-seen item with a new pubDate refreshes pub_date; a missing one keeps it", async () => {
  const e = env();
  const item = { title: "Daily Program: Tuesday, 6 October 2026", link: "https://parlwork.aph.gov.au/House", pubDate: "Mon, 10 Aug 2026 22:30:38 GMT" };
  mockFetch({ [F.program.url]: rss([item]) });
  await pollAndArchive(e);
  mockFetch({ [F.program.url]: rss([{ ...item, pubDate: "Mon, 05 Oct 2026 21:00:00 GMT" }]) });
  await new Promise((r) => setTimeout(r, 5));
  const r = await pollAndArchive(e);
  assert.equal(r.perFeed.find((f) => f.feed === F.program.url).new, 0, "re-seen, not new");
  assert.equal(rows(e, `SELECT pub_date FROM signals WHERE guid = ?`, item.link)[0].pub_date, "2026-10-05T21:00:00.000Z");
  mockFetch({ [F.program.url]: rss([{ ...item, pubDate: undefined }]) });
  await new Promise((r) => setTimeout(r, 5));
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT pub_date FROM signals WHERE guid = ?`, item.link)[0].pub_date, "2026-10-05T21:00:00.000Z");
});

test("data-8: an unparseable pubDate is stored as null, not a failed feed", () => {
  const p = parseFeed(rss([{ title: "x", link: "https://www.aph.gov.au/x", pubDate: "not a date" }]), F.news);
  assert.equal(p.length, 1);
  assert.equal(p[0].pubDate, null);
});

// ---- Data 9: aphcms host ------------------------------------------------------

test("data-9: aphcms links and guids are rewritten at parse time", () => {
  assert.equal(canonicalAphUrl("https://aphcms.aph.gov.au/Parliamentary_Business/Committees/Joint/X/Public_Hearings"),
    "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/X/Public_Hearings");
  const [p] = parseFeed(rss([{ title: "Oversight of ASIC", link: "https://aphcms.aph.gov.au/Parliamentary_Business/Committees/Joint/X/Public_Hearings" }]), F.hearings);
  assert.ok(p.link.startsWith("https://www.aph.gov.au/"));
  assert.equal(p.guid, p.link);
});

test("data-9: migration 0011 renames aphcms rows, drops a duplicate, and is idempotent", async () => {
  const e = env();
  const path = "Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport/Aviationsector_48/Public_Hearings";
  const dupPath = "Parliamentary_Business/Committees/Joint/Corporations_and_Financial_Services/OversightASIC/Public_Hearings";
  const ins = (guid) => e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES (?, 't', ?, 'u', 'Upcoming Senate hearings', 'Senate', 'hearing', 'x', 'x')`).run(guid, guid);
  ins(`https://aphcms.aph.gov.au/${path}`);
  ins(`https://aphcms.aph.gov.au/${dupPath}`);
  ins(`https://www.aph.gov.au/${dupPath}`);
  e.ARCHIVE.raw.exec(`INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at) VALUES ('thread:a', 'x', 't', 'x', 'x')`);
  e.ARCHIVE.raw.prepare(`INSERT INTO signal_threads (signal_guid, thread_id) VALUES (?, 'thread:a')`).run(`https://aphcms.aph.gov.au/${path}`);
  const sql = migration("0011_link_and_title_repair.sql");
  e.ARCHIVE.raw.exec(sql);
  e.ARCHIVE.raw.exec(sql);
  const all = rows(e, `SELECT guid, link FROM signals ORDER BY guid`);
  assert.equal(all.length, 2, "the aphcms twin of an existing www row is dropped");
  for (const r of all) {
    assert.ok(r.guid.startsWith("https://www.aph.gov.au/"), r.guid);
    assert.equal(r.link, r.guid);
  }
});

// ---- Data 10: House news titles ----------------------------------------------

test("data-10: a missing title comes from the link's last segment, else a word-boundary cut", () => {
  const link = "https://www.aph.gov.au/About_Parliament/House_of_Representatives/About_the_House_News/News/Gain_a_better_understanding_of_the_House_of_Representatives_in_engaging_half-day_seminar";
  assert.equal(fallbackTitle(link, "How does the House of Representatives work?"),
    "Gain a better understanding of the House of Representatives in engaging half-day seminar");
  const desc = "The House of Representatives Standing Committee on Climate Change, Energy, Environment and Water will hold public hearings next week.";
  const t = fallbackTitle("https://www.aph.gov.au/x", desc);
  assert.ok(t.endsWith("…"), t);
  assert.ok(!/ wil…$/.test(t), "not cut mid-word");
  assert.ok(desc.startsWith(t.slice(0, -1)), "a prefix of the description");
  assert.equal(fallbackTitle("https://www.aph.gov.au/x", "Short line"), "Short line");
});

test("data-10: migration 0011 repairs a stored House news title cut from its description", async () => {
  const e = env();
  const link = "https://www.aph.gov.au/About_Parliament/House_of_Representatives/About_the_House_News/News/Winners_of_the_2026_My_First_Speech_visit_the_House_of_Representatives";
  const desc = "On the 14th of September, the winners of the My First Speech competition visited Parliament House to meet Members.";
  const keep = "https://www.aph.gov.au/About_Parliament/House_of_Representatives/About_the_House_News/News/Real_title_given";
  const ins = (guid, title, d) => e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, description)
    VALUES (?, ?, ?, 'u', 'House news', 'House', 'signal', 'x', 'x', ?)`).run(guid, title, guid, d);
  ins(link, desc.slice(0, 100).trim(), desc);
  ins(keep, "A real feed title", "Different description text");
  const sql = migration("0011_link_and_title_repair.sql");
  e.ARCHIVE.raw.exec(sql);
  e.ARCHIVE.raw.exec(sql);
  const t = Object.fromEntries(rows(e, `SELECT guid, title FROM signals`).map((r) => [r.guid, r.title]));
  assert.equal(t[link], "Winners of the 2026 My First Speech visit the House of Representatives");
  assert.equal(t[keep], "A real feed title", "a title the feed supplied is never touched");
});

// ---- Data 6: threads --------------------------------------------------------

const DIV = (n, id, subject) => ({ title: `Division ${n} - ${subject}`, link: `https://www.aph.gov.au/divisions/Details?id=${id}`, pubDate: "Wed, 16 Sep 2026 07:00:00 GMT" });

test("data-6: procedural divisions are separate threads; divisions on one bill share one", async () => {
  const e = env();
  const bill = "Private Health Insurance Amendment (Modernising the Private Health Insurance Rebate) Bill 2026";
  mockFetch({
    [F.divisions.url]: rss([
      DIV(289, 2813, "Suspension of standing and sessional orders: That the motion be agreed to"),
      DIV(288, 2812, "Suspension of standing and sessional orders: That the motion be agreed to"),
      DIV(286, 2810, `${bill}: Second reading: That the bill be now read a second time`),
      DIV(285, 2809, `${bill}: Consideration in detail: That the amendments be agreed to`),
    ]),
  });
  await pollAndArchive(e);
  const threads = rows(e, `SELECT t.thread_id, COUNT(st.signal_guid) AS n FROM threads t JOIN signal_threads st ON st.thread_id = t.thread_id GROUP BY t.thread_id ORDER BY n DESC`);
  assert.deepEqual(threads.map((t) => t.n), [2, 1, 1], "one bill thread of two, two procedural singletons");
  assert.ok(threads.every((t) => t.thread_id.startsWith(THREAD_ID_PREFIX)));
});

test("data-6: same-title Annual reports from different committees are separate threads", async () => {
  const e = env();
  mockFetch({ [F.reports.url]: REPORTS_XML });
  await pollAndArchive(e);
  const n = rows(e, `SELECT COUNT(DISTINCT st.thread_id) AS n FROM signals s JOIN signal_threads st ON st.signal_guid = s.guid
                      WHERE s.title = 'Annual reports (No. 2 of 2026)'`)[0].n;
  assert.equal(n, 8);
});

test("data-6: migration 0012 removes old threads only, and the poll heals the layer", async () => {
  const e = env();
  mockFetch({ [F.divisions.url]: rss([DIV(289, 2813, "Suspension of standing and sessional orders: That the motion be agreed to")]) });
  await pollAndArchive(e);
  // An old word-overlap thread from 0.16.2 holding an archived signal.
  e.ARCHIVE.raw.exec(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES ('old-1', 'Division 239 - Suspension of standing and sessional orders: That debate be adjourned', 'https://www.aph.gov.au/divisions/Details?id=2763', 'u', 'House divisions', 'House', 'division', '2026-08-11T00:00:00Z', '2026-08-11T00:00:00Z')`);
  e.ARCHIVE.raw.exec(`INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at) VALUES ('thread:old-1', 'debate,adjourned', 't', 'x', 'x')`);
  e.ARCHIVE.raw.exec(`INSERT INTO signal_threads (signal_guid, thread_id) VALUES ('old-1', 'thread:old-1')`);
  const sql = migration("0012_rethread.sql");
  e.ARCHIVE.raw.exec(sql);
  const after = rows(e, `SELECT thread_id FROM threads`);
  assert.ok(after.length >= 1 && after.every((t) => t.thread_id.startsWith("t2:")), "t2 threads survive");
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signal_threads WHERE signal_guid = 'old-1'`)[0].n, 0, "old mapping removed");
  await pollAndArchive(e);
  const healed = rows(e, `SELECT thread_id FROM signal_threads WHERE signal_guid = 'old-1'`);
  assert.equal(healed.length, 1, "the next poll re-threads the signal");
  assert.ok(healed[0].thread_id.startsWith("t2:"));
  e.ARCHIVE.raw.exec(sql);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signal_threads WHERE signal_guid = 'old-1'`)[0].n, 1, "re-running 0012 keeps rebuilt threads");
  const b = await backfillThreads(e);
  assert.equal(b.processed, 0, "nothing left to backfill");
});

// ---- Data 15: thread publication range and total ------------------------------

test("data-15: /state threads carry first/last pub_date of members and the thread total", async () => {
  const e = env();
  const bill = "Interactive Gambling Amendment (Gambling Reform) Bill 2026";
  mockFetch({
    [F.divisions.url]: rss([
      { ...DIV(249, 2773, `${bill}: Detail`), pubDate: "Tue, 18 Aug 2026 03:00:00 GMT" },
      { ...DIV(250, 2774, `${bill}: Third reading`), pubDate: "Wed, 19 Aug 2026 03:00:00 GMT" },
      DIV(289, 2813, "Suspension of standing and sessional orders: That the motion be agreed to"),
    ]),
  });
  await pollAndArchive(e);
  const block = (await buildState(e)).blocks.threads;
  assert.equal(block.total, 2);
  const t = block.items.find((i) => i.item_count === 2);
  assert.equal(t.first_pub_date, "2026-08-18T03:00:00.000Z");
  assert.equal(t.last_pub_date, "2026-08-19T03:00:00.000Z");
  assert.equal(t.signal_guids.length, t.item_count);
});

// ---- Security 2: negative limit -------------------------------------------------

test("sec-2: clampLimit refuses zero, negative and junk limits", () => {
  assert.equal(clampLimit("-1", 100, 500), 100);
  assert.equal(clampLimit("0", 100, 500), 100);
  assert.equal(clampLimit("abc", 100, 500), 100);
  assert.equal(clampLimit(null, 100, 500), 100);
  assert.equal(clampLimit("9999", 100, 500), 500);
  assert.equal(clampLimit("7", 100, 500), 7);
});

test("sec-2: /archive?limit=-1 returns at most the default 100 rows", async () => {
  const e = env();
  const stmt = e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES (?, ?, 'https://www.aph.gov.au/x', '2026-09-01T00:00:00Z', 'u', 'House news', 'House', 'signal', 'x', 'x')`);
  for (let i = 0; i < 130; i += 1) stmt.run(`g${i}`, `item ${i}`);
  for (const path of ["/archive?limit=-1", "/bills?limit=-1", "/members?limit=-1", "/qons?limit=-1", "/alerts/events?limit=-1"]) {
    const res = await worker.fetch(new Request(`https://w.test${path}`), e, ctx());
    assert.equal(res.status, 200, path);
  }
  const body = await (await worker.fetch(new Request("https://w.test/archive?limit=-1"), e, ctx())).json();
  assert.equal(body.total, 130);
  assert.equal(body.rows.length, 100);
});

// ---- Security 1: Rate Limiting binding -------------------------------------------

function fakeBinding(limit) {
  const counts = new Map();
  return {
    keys: [],
    async limit({ key }) {
      this.keys.push(key);
      await new Promise((r) => setTimeout(r, 1)); // resolve out of order, as a network call would
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    },
  };
}

test("sec-1: a concurrent burst against the binding gets 429s", async () => {
  const RL_30 = fakeBinding(30);
  const e = env({ RL_30 });
  const reqs = Array.from({ length: 35 }, () => worker.fetch(new Request("https://w.test/healthz/deep", { headers: { "cf-connecting-ip": "9.9.9.9" } }), e, ctx()));
  const statuses = (await Promise.all(reqs)).map((r) => r.status);
  assert.ok(statuses.filter((s) => s === 429).length >= 5, `at least 5 of 35 refused: ${statuses.join(",")}`);
  assert.ok(RL_30.keys.every((k) => k === "healthz_deep:9.9.9.9"), "keyed by endpoint and IP");
});

test("sec-1: inline-limited routes use their budget's binding; the KV limiter is not touched", async () => {
  const RL_120 = fakeBinding(120);
  const RL_60 = fakeBinding(60);
  const RL_30 = fakeBinding(30);
  const kv = memoryKv();
  const puts = [];
  const e = env({ RL_120, RL_60, RL_30, CACHE: { ...kv, async put(k, v, o) { puts.push(k); return kv.put(k, v, o); } } });
  await worker.fetch(new Request("https://w.test/archive"), e, ctx());
  await worker.fetch(new Request("https://w.test/bills"), e, ctx());
  await worker.fetch(new Request("https://w.test/qons"), e, ctx());
  assert.deepEqual(RL_120.keys, ["archive:unknown"]);
  assert.deepEqual(RL_60.keys, ["bills:unknown"]);
  assert.deepEqual(RL_30.keys, ["qons:unknown"]);
  assert.ok(!puts.some((k) => k.startsWith("rl:")), "no KV counter writes when a binding decides");
});

test("sec-1: a binding that throws fails open", async () => {
  const ok = await checkRateLimit(memoryKv(), "1.1.1.1", "x", 1, 60, undefined, { async limit() { throw new Error("down"); } });
  assert.equal(ok, true);
});

// ---- Security 3, 10, 14, 15, 16: headers and strings ---------------------------

test("sec-14/15: CORS allows GET and OPTIONS only; OPTIONS and JSON carry the security headers and CSP", async () => {
  const e = env();
  const pre = await worker.fetch(new Request("https://w.test/state", { method: "OPTIONS", headers: { origin: "https://parliament-pulse.pages.dev" } }), e, ctx());
  assert.equal(pre.headers.get("access-control-allow-methods"), "GET,OPTIONS");
  assert.equal(pre.headers.get("x-content-type-options"), "nosniff");
  assert.equal(pre.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  const res = await worker.fetch(new Request("https://w.test/healthz"), e, ctx());
  assert.equal(res.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});

test("sec-10: /bills, /archive/timeline and /archive/watchlist-trend are cacheable for 5 minutes", async () => {
  const e = env();
  for (const path of ["/bills?limit=50", "/archive/timeline", "/archive/watchlist-trend?terms=ai"]) {
    const res = await worker.fetch(new Request(`https://w.test${path}`), e, ctx());
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("cache-control"), "public, max-age=300", path);
  }
});

test("sec-16: rate-limit errors carry no em dash", async () => {
  const e = env({ RL_120: { async limit() { return { success: false }; } }, RL_60: { async limit() { return { success: false }; } }, RL_30: { async limit() { return { success: false }; } } });
  for (const path of ["/archive", "/bills", "/qons", "/members", "/state", "/healthz"]) {
    const res = await worker.fetch(new Request(`https://w.test${path}`), e, ctx());
    assert.equal(res.status, 429, path);
    const { error } = await res.json();
    assert.match(error, /^rate limit exceeded, max \d+\/min$/, path);
  }
  const src = ["index.ts", "digest.ts"].map((f) => readFileSync(fileURLToPath(new URL(`../src/${f}`, import.meta.url)), "utf8"));
  for (const s of src) {
    const strings = s.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && /["`'][^"`']*—/.test(l));
    assert.deepEqual(strings, [], "no em dash inside a string literal");
  }
});
