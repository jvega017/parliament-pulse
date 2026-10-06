// Worker 0.16.5: three fixes from the review of the 0.16.4 candidate
// (5 Oct 2026). Real SQL (node:sqlite) through tests/support/sqlite-d1.mjs.
//
//   1. A report whose link another feed wrote first in the same poll is
//      stored under `${link}#${pubDate}`, never dropped (129 of 134 before).
//   2. Rows stored with an undecoded "&amp;" in guid or link (0.16.3 and
//      earlier) are renamed at ingest and repaired by migration 0014, so the
//      List of Senators row is never duplicated and never reads as new.
//   3. One failing row no longer stops the per-poll thread heal.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.5.test.mjs
//
// Measured to fail with each fix reverted on a scratch copy (see the commit
// message for the counts).

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const archive = await import("../src/archive.ts");
const { pollAndArchive, parseFeed, guidForPoll, backfillThreads, THREAD_HEAL_PER_POLL } = archive;
const { APH_FEEDS } = await import("../src/feeds.ts");

const warnings = [];
console.warn = (...a) => { warnings.push(a.map(String).join(" ")); };
console.log = () => {};
console.error = () => {};

const MIGRATIONS = fileURLToPath(new URL("../migrations/", import.meta.url));
const migration = (name) => readFileSync(`${MIGRATIONS}${name}`, "utf8");
const migrationsBefore = (prefix) => readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql") && n < prefix).sort();
const REPORTS_XML = readFileSync(fileURLToPath(new URL("./fixtures/senate-reports-2026-10-05.xml", import.meta.url)), "utf8");

const feed = (label) => APH_FEEDS.find((f) => f.label === label);
const F = {
  inquiries: feed("New Senate inquiries"),
  reports: feed("Senate reports tabled"),
  senators: feed("Senators' details updates"),
};

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function rss(items) {
  const body = items.map((i) => `<item><title>${esc(i.title)}</title><link>${esc(i.link)}</link>`
    + `${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ""}</item>`).join("\n");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${body}</channel></rss>`;
}
function mockFetch(bodies) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    return new Response(bodies[url] ?? EMPTY, { status: 200 });
  };
}
function env(archiveDb = sqliteD1()) {
  return { ALLOWED_ORIGINS: "https://parliament-pulse.pages.dev", CACHE: memoryKv(), ARCHIVE: archiveDb };
}
const rows = (e, sql, ...args) => e.ARCHIVE.raw.prepare(sql).all(...args).map((r) => ({ ...r }));
const count = (e, sql, ...args) => rows(e, sql, ...args)[0].n;

// ---- Fix 1: a link shared across feeds keeps both rows -----------------------

const SHARED = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/SharedLink";

test("fix-1: two feeds sharing one link store both rows", async () => {
  const e = env();
  mockFetch({
    [F.inquiries.url]: rss([{ title: "Inquiry into a shared thing", link: SHARED, pubDate: "Wed, 01 Jul 2026 00:00:00 +1000" }]),
    [F.reports.url]: rss([{ title: "Shared thing [Final report]", link: SHARED, pubDate: "Fri, 14 Aug 2026 00:00:00 +1000" }]),
  });
  const r = await pollAndArchive(e);
  const stored = rows(e, `SELECT guid, feed_label FROM signals ORDER BY guid`);
  assert.deepEqual(stored, [
    { guid: SHARED, feed_label: "New Senate inquiries" },
    { guid: `${SHARED}#2026-08-13T14:00:00.000Z`, feed_label: "Senate reports tabled" },
  ]);
  assert.equal(r.perFeed.find((f) => f.feed === F.reports.url).new, 1);
  const r2 = await pollAndArchive(e);
  assert.equal(r2.perFeed.find((f) => f.feed === F.reports.url).new, 0, "a re-poll adds nothing");
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM signals`), 2);
});

test("fix-1: all 134 reports are stored when New Senate inquiries carries every report link", async () => {
  const e = env();
  const reports = parseFeed(REPORTS_XML, F.reports);
  const links = [...new Set(reports.map((r) => r.link))];
  assert.equal(reports.length, 134);
  mockFetch({
    [F.inquiries.url]: rss(links.map((link, i) => ({ title: `Inquiry ${i}`, link, pubDate: "Mon, 01 Jun 2026 00:00:00 +1000" }))),
    [F.reports.url]: REPORTS_XML,
  });
  // 0.16.10: an empty archive takes more than one poll (MAX_NEW_PER_POLL);
  // poll until nothing is deferred. No report may be dropped in any poll.
  for (let i = 0; i < 5; i++) {
    e.ARCHIVE.resetQueries(); // each poll is its own invocation
    const r = await pollAndArchive(e);
    assert.equal(r.perFeed.find((f) => f.feed === F.reports.url).dedup, 0);
    if (!r.perFeed.some((f) => f.deferred)) break;
  }
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.reports.url), 134, "no report dropped");
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM signals WHERE feed_url = ?`, F.inquiries.url), links.length);
});

test("fix-1: guidForPoll skips only an undated, guid-not-link, or doubly taken item", () => {
  const it = { title: "t", link: SHARED, guid: SHARED, pubDate: "2026-08-13T14:00:00.000Z", description: null };
  assert.equal(guidForPoll(it, new Set()), it);
  assert.equal(guidForPoll(it, new Set([SHARED])).guid, `${SHARED}#2026-08-13T14:00:00.000Z`);
  assert.equal(guidForPoll(it, new Set([SHARED, `${SHARED}#2026-08-13T14:00:00.000Z`])), null);
  assert.equal(guidForPoll({ ...it, pubDate: null }, new Set([SHARED])), null);
  assert.equal(guidForPoll({ ...it, guid: "g-1" }, new Set(["g-1"])), null);
});

// ---- Fix 2: "&amp;" rows are repaired, never duplicated ----------------------

// The live feed's raw text (measured 5 Oct 2026) and the two parsed forms.
const LOS_RAW = "https://www.aph.gov.au/-/media/03_Senators_and_Members/31_Senators/contacts/los.pdf?la=en&amp;hash=C7DFDAEB0519B496B99F6EE654032A83D40036C5";
const LOS = LOS_RAW.replace("&amp;", "&");
const LOS_TITLE = "List of Senators as at 28 January 2026";
const SENATORS_XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>`
  + `<item><title>${LOS_TITLE}</title><link>${LOS_RAW}</link><pubDate>Tue, 27 Jan 2026 13:00:00 GMT</pubDate></item>`
  + `</channel></rss>`;
const OLD_SEEN = "2026-04-25T21:30:22.602Z";

function legacyDb(upTo = "0014") {
  const db = sqliteD1({ migrations: false });
  for (const f of migrationsBefore(upTo)) db.raw.exec(migration(f));
  return db;
}
function seedLegacy(e, guid = LOS_RAW, at = OLD_SEEN) {
  e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, attention)
    VALUES (?, ?, ?, '2026-01-27T13:00:00.000Z', ?, ?, 'Senate', 'signal', ?, ?, 'low')`)
    .run(guid, LOS_TITLE, guid, F.senators.url, F.senators.label, at, at);
}
function seedRule(e) {
  e.ARCHIVE.raw.prepare(`INSERT INTO alert_rules (name, terms, attention_min, created_at, active) VALUES ('senators', 'senators', 'low', ?, 1)`).run(OLD_SEEN);
}
const ampRows = (e) => count(e, `SELECT
    (SELECT COUNT(*) FROM signals WHERE instr(guid, '&amp;') > 0 OR instr(link, '&amp;') > 0)
  + (SELECT COUNT(*) FROM signal_threads WHERE instr(signal_guid, '&amp;') > 0)
  + (SELECT COUNT(*) FROM alert_events WHERE instr(signal_guid, '&amp;') > 0 OR instr(link, '&amp;') > 0) AS n`);

test("fix-2: seed an &amp; row, apply 0014, poll: one row, no &amp;, first_seen_at kept", async () => {
  const e = env(legacyDb());
  seedLegacy(e);
  e.ARCHIVE.raw.prepare(`INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at) VALUES (?, 'list,senators', ?, ?, ?)`)
    .run(`t2:${LOS_RAW}`, LOS_TITLE, OLD_SEEN, OLD_SEEN);
  e.ARCHIVE.raw.prepare(`INSERT INTO signal_threads (signal_guid, thread_id) VALUES (?, ?)`).run(LOS_RAW, `t2:${LOS_RAW}`);
  seedRule(e);
  e.ARCHIVE.raw.prepare(`INSERT INTO alert_events (rule_id, signal_guid, fired_at, title, link, attention) VALUES (1, ?, ?, ?, ?, 'low')`)
    .run(LOS_RAW, OLD_SEEN, LOS_TITLE, LOS_RAW);
  e.ARCHIVE.raw.exec(migration("0014_entity_repair.sql"));
  e.ARCHIVE.raw.exec(migration("0014_entity_repair.sql")); // idempotent
  mockFetch({ [F.senators.url]: SENATORS_XML });
  const r = await pollAndArchive(e);
  const los = rows(e, `SELECT guid, link, first_seen_at FROM signals WHERE title = ?`, LOS_TITLE);
  assert.deepEqual(los, [{ guid: LOS, link: LOS, first_seen_at: OLD_SEEN }]);
  assert.equal(ampRows(e), 0, "no &amp; anywhere");
  assert.equal(r.perFeed.find((f) => f.feed === F.senators.url).new, 0, "re-seen, not new");
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM alert_events`), 1, "no second alert");
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM threads WHERE instr(thread_id, '&amp;') > 0`), 0, "the emptied thread is removed");
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM signal_threads WHERE signal_guid = ?`, LOS), 1, "the heal step re-threads it");
});

test("fix-2: 0014 drops an &amp; row whose decoded twin exists and keeps the older first_seen_at", async () => {
  const e = env(legacyDb());
  seedLegacy(e);
  seedLegacy(e, LOS, "2026-10-06T00:00:00.000Z");
  e.ARCHIVE.raw.exec(migration("0014_entity_repair.sql"));
  assert.deepEqual(rows(e, `SELECT guid, first_seen_at FROM signals`), [{ guid: LOS, first_seen_at: OLD_SEEN }]);
  e.ARCHIVE.raw.exec(migration("0014_entity_repair.sql"));
  assert.deepEqual(rows(e, `SELECT guid, first_seen_at FROM signals`), [{ guid: LOS, first_seen_at: OLD_SEEN }], "idempotent");
});

test("fix-2: before 0014, a poll renames the &amp; row in place: no duplicate, no new alert", async () => {
  const e = env(legacyDb());
  seedLegacy(e);
  seedRule(e);
  // The live alert watermark sits at the last poll, after the row was first seen.
  await e.CACHE.put("alert:watermark", "2026-10-05T09:00:39.300Z");
  mockFetch({ [F.senators.url]: SENATORS_XML });
  const r = await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT guid, link, first_seen_at FROM signals WHERE title = ?`, LOS_TITLE),
    [{ guid: LOS, link: LOS, first_seen_at: OLD_SEEN }]);
  assert.equal(r.perFeed.find((f) => f.feed === F.senators.url).new, 0);
  assert.equal(count(e, `SELECT COUNT(*) AS n FROM alert_events`), 0, "nothing fired");
});

// ---- Fix 3: the heal step survives a failing row -------------------------------

function failingOn(db, guid) {
  return {
    ...db,
    raw: db.raw,
    prepare(sql) {
      const st = db.prepare(sql);
      if (!/INSERT OR IGNORE INTO signal_threads/.test(sql)) return st;
      return { bind: (...args) => (args[0] === guid
        ? { run: async () => { throw new Error("D1_ERROR: simulated"); } }
        : st.bind(...args)) };
    },
  };
}
function seedUnthreaded(e, n) {
  const ins = e.ARCHIVE.raw.prepare(`INSERT INTO signals (guid, title, link, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, 'u', 'Senate reports tabled', 'Senate', 'report', ?, ?)`);
  for (let i = 0; i < n; i += 1) {
    const at = new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString();
    ins.run(`g${String(i).padStart(3, "0")}`, `Distinct report number ${i} alpha${i} beta${i}`, `https://www.aph.gov.au/x/Inquiry${i}`, at, at);
  }
}
const unthreaded = (e) => count(e, `SELECT COUNT(*) AS n FROM signals s LEFT JOIN signal_threads st ON st.signal_guid = s.guid WHERE st.signal_guid IS NULL`);

test("fix-3: a failing oldest row does not stop the heal step", async () => {
  const base = sqliteD1();
  const e = env(failingOn(base, "g000"));
  seedUnthreaded(e, 30);
  mockFetch({});
  await pollAndArchive(e);
  assert.equal(unthreaded(e), 30 - (THREAD_HEAL_PER_POLL - 1), "every other selected row is threaded");
  await pollAndArchive(e);
  await pollAndArchive(e);
  assert.equal(unthreaded(e), 1, "only the failing row is left");
  const b = await backfillThreads(e, 500);
  assert.deepEqual([b.processed, b.failed], [0, 1], "processed reaches 0 so an admin loop ends");
});

test("drain: polls alone thread a backlog at THREAD_HEAL_PER_POLL per poll, no admin call", async () => {
  const e = env();
  seedUnthreaded(e, 3 * THREAD_HEAL_PER_POLL + 7);
  mockFetch({});
  const left = [];
  for (let i = 0; i < 4; i += 1) { await pollAndArchive(e); left.push(unthreaded(e)); }
  assert.deepEqual(left, [2 * THREAD_HEAL_PER_POLL + 7, THREAD_HEAL_PER_POLL + 7, 7, 0]);
});
