// Worker 0.16.8: fixes from recheck 8 of 0.16.7 (5 Oct 2026). Real SQL
// (node:sqlite, every migration applied) through tests/support/sqlite-d1.mjs.
//
//   1. keepStoredIdentity match order (tested in review-0.16.7.test.mjs and
//      review-0.16.6.test.mjs "fix-1").
//   2. The two production Upcoming Senate hearings rows on the aphcms host
//      keep their history. The poll renames such a row to its www guid
//      before the upsert (adoptLegacyEntityRow, legacyForms), so it is
//      re-seen, not new, and does not alert. Migration 0011, for a www twin
//      that already exists, gives the twin the older first_seen_at and the
//      dropped row's thread.
//   3. recheck8 watermark probes P3a and P3b.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/review-0.16.8.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { pollAndArchive, legacyForms } = await import("../src/archive.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const migration = (name) => readFileSync(fileURLToPath(new URL(`../migrations/${name}`, import.meta.url)), "utf8");
const feed = (label) => APH_FEEDS.find((f) => f.label === label);
const F = { reports: feed("Senate reports tabled"), hearings: feed("Upcoming Senate hearings") };
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
).run(r.guid, r.title, r.link, r.pub ?? null, r.feed.url, r.feed.label, r.feed.kind, r.first, r.first, r.description ?? null);
const thread = (e, id, guid) => {
  e.ARCHIVE.raw.prepare(`INSERT OR IGNORE INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at, item_count) VALUES (?, 'x', 't', 'x', 'x', 1)`).run(id);
  e.ARCHIVE.raw.prepare(`INSERT INTO signal_threads (signal_guid, thread_id) VALUES (?, ?)`).run(guid, id);
};

const DAY = 24 * 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const rfc = (ms) => new Date(ms).toUTCString();
const T0 = Math.floor(Date.now() / 1000) * 1000;

// Production rows (production /archive, 5 Oct 2026): undated, first seen 10 Aug.
const PATH = "Parliamentary_Business/Committees/Joint/Corporations_and_Financial_Services/OversightASIC/Public_Hearings";
const CMS = `https://aphcms.aph.gov.au/${PATH}`;
const WWW = `https://www.aph.gov.au/${PATH}`;
const TITLE = "Oversight of ASIC, the Takeovers Panel and the Corporations Legislation";
const FIRST = "2026-08-10T01:30:38.200Z";

// ---- Fix 2: aphcms rows ---------------------------------------------------------

test("fix-2: legacyForms names the aphcms host form and the undecoded form", () => {
  assert.deepEqual(legacyForms(WWW), [CMS]);
  assert.deepEqual(legacyForms(`${WWW}#2026-10-01T00:00:00.000Z`), [`${CMS}#2026-10-01T00:00:00.000Z`]);
  assert.deepEqual(legacyForms("https://www.aph.gov.au/x?a=1&b=2"), ["https://www.aph.gov.au/x?a=1&amp;b=2", "https://aphcms.aph.gov.au/x?a=1&b=2"]);
  assert.deepEqual(legacyForms("https://parlinfo.aph.gov.au/x"), []);
});

for (const feedLink of [CMS, WWW]) {
  test(`fix-2: a stored aphcms hearing row re-seen (feed link ${feedLink.slice(8, 14)}) keeps first_seen_at and its thread, and does not alert`, async () => {
    const e = env();
    anyRule(e);
    insert(e, { guid: CMS, link: CMS, title: TITLE, first: FIRST, feed: F.hearings });
    thread(e, "t2:keep", CMS);
    e.ARCHIVE.raw.prepare(`INSERT INTO alert_events (rule_id, signal_guid, fired_at, title, link, attention) VALUES (1, ?, ?, ?, ?, 'med')`).run(CMS, FIRST, TITLE, CMS);
    // Empty KV: the watermark falls back to the latest stored first_seen_at.
    mockFetch({ [F.hearings.url]: rss([{ title: TITLE, link: feedLink }]) });
    const r = await pollAndArchive(e);
    assert.deepEqual(rows(e, `SELECT guid, link, first_seen_at FROM signals`), [{ guid: WWW, link: WWW, first_seen_at: FIRST }]);
    assert.deepEqual(rows(e, `SELECT signal_guid, thread_id FROM signal_threads`), [{ signal_guid: WWW, thread_id: "t2:keep" }]);
    assert.deepEqual(rows(e, `SELECT signal_guid, link FROM alert_events`), [{ signal_guid: WWW, link: WWW }], "no new alert; the old event follows the row");
    assert.equal(r.perFeed.reduce((a, f) => a + f.new, 0), 0, "not counted as new");
  });
}

test("fix-2 restraint: a www row that already exists is left alone (0011 merges the aphcms duplicate)", async () => {
  const e = env();
  insert(e, { guid: CMS, link: CMS, title: TITLE, first: FIRST, feed: F.hearings });
  insert(e, { guid: WWW, link: WWW, title: TITLE, first: "2026-10-05T00:00:00.000Z", feed: F.hearings });
  mockFetch({ [F.hearings.url]: rss([{ title: TITLE, link: WWW }]) });
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT guid FROM signals ORDER BY guid`).map((r) => r.guid), [CMS, WWW]);
});

test("fix-2: migration 0011 gives a www twin the dropped aphcms row's first_seen_at and thread, and is idempotent", () => {
  const e = env();
  // The aphcms row (production) and the twin a poll inserted, threaded in a
  // thread of its own.
  insert(e, { guid: CMS, link: CMS, title: TITLE, first: FIRST, feed: F.hearings });
  thread(e, "thread:old", CMS);
  insert(e, { guid: WWW, link: WWW, title: TITLE, first: "2026-10-05T11:00:00.000Z", feed: F.hearings });
  thread(e, `t2:${WWW}`, WWW);
  // A second pair where the aphcms row is unthreaded: the twin keeps its thread.
  const P2 = "Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport/Aviationsector_48/Public_Hearings";
  insert(e, { guid: `https://aphcms.aph.gov.au/${P2}`, link: `https://aphcms.aph.gov.au/${P2}`, title: "Aviation", first: "2026-08-10T02:30:36.191Z", feed: F.hearings });
  insert(e, { guid: `https://www.aph.gov.au/${P2}`, link: `https://www.aph.gov.au/${P2}`, title: "Aviation", first: "2026-10-05T11:00:00.000Z", feed: F.hearings });
  thread(e, `t2:https://www.aph.gov.au/${P2}`, `https://www.aph.gov.au/${P2}`);
  // An unrelated row and thread are untouched.
  insert(e, { guid: "https://www.aph.gov.au/other", link: "https://www.aph.gov.au/other", title: "o", first: "2026-10-05T11:00:00.000Z", feed: F.hearings });
  thread(e, "t2:https://www.aph.gov.au/other", "https://www.aph.gov.au/other");

  const sql = migration("0011_link_and_title_repair.sql");
  e.ARCHIVE.raw.exec(sql);
  const after = () => ({
    signals: rows(e, `SELECT guid, first_seen_at FROM signals ORDER BY guid`),
    st: rows(e, `SELECT signal_guid, thread_id FROM signal_threads ORDER BY signal_guid`),
    threads: rows(e, `SELECT thread_id FROM threads ORDER BY thread_id`).map((r) => r.thread_id),
  });
  const a1 = after();
  assert.deepEqual(a1.signals, [
    { guid: WWW, first_seen_at: FIRST },
    { guid: `https://www.aph.gov.au/${P2}`, first_seen_at: "2026-08-10T02:30:36.191Z" },
    { guid: "https://www.aph.gov.au/other", first_seen_at: "2026-10-05T11:00:00.000Z" },
  ]);
  assert.deepEqual(a1.st, [
    { signal_guid: WWW, thread_id: "thread:old" },
    { signal_guid: `https://www.aph.gov.au/${P2}`, thread_id: `t2:https://www.aph.gov.au/${P2}` },
    { signal_guid: "https://www.aph.gov.au/other", thread_id: "t2:https://www.aph.gov.au/other" },
  ]);
  assert.deepEqual(a1.threads, [`t2:https://www.aph.gov.au/${P2}`, "t2:https://www.aph.gov.au/other", "thread:old"],
    "the twin's emptied thread is removed, nothing else");
  e.ARCHIVE.raw.exec(sql);
  assert.deepEqual(after(), a1, "a second run changes nothing");
});

test("fix-2: production path, 0.16.8 polls on the 0009 schema, then 0011 to 0014: the hearing row keeps its history", async () => {
  // 0009 schema: apply only 0001-0009.
  const e = { ALLOWED_ORIGINS: "https://parliament-pulse.pages.dev", CACHE: memoryKv(), ARCHIVE: sqliteD1({ migrations: false }) };
  for (const n of ["0001_signals.sql", "0002_indexes.sql", "0003_intelligence.sql", "0004_members.sql", "0005_threads.sql",
    "0006_feed_health.sql", "0007_backfill_thread_item_count.sql", "0008_job_runs.sql", "0009_joint_source_group.sql"]) {
    e.ARCHIVE.raw.exec(migration(n));
  }
  anyRule(e);
  insert(e, { guid: CMS, link: CMS, title: TITLE, first: FIRST, feed: F.hearings });
  thread(e, "thread:old", CMS);
  mockFetch({ [F.hearings.url]: rss([{ title: TITLE, link: CMS }]) });
  await pollAndArchive(e);
  for (const n of ["0010_item_source_group.sql", "0011_link_and_title_repair.sql", "0012_rethread.sql", "0013_thread_key_index.sql", "0014_entity_repair.sql"]) {
    e.ARCHIVE.raw.exec(migration(n));
  }
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT guid, first_seen_at FROM signals`), [{ guid: WWW, first_seen_at: FIRST }]);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 0, "no alert on an old row");
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM signal_threads WHERE signal_guid = ?`, WWW)[0].n, 1, "threaded");
});

// ---- 3: recheck8 watermark probes -------------------------------------------------

const R = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics/ProbeReports";

test("P3a: KV missing, only this poll's new fresh row alerts; the watermark is written and nothing refires", async () => {
  const e = env();
  anyRule(e);
  insert(e, { guid: `${R}/a`, link: `${R}/a`, title: "Earlier fresh A", pub: iso(T0 - 3 * DAY), first: iso(T0 - 2 * DAY), feed: F.reports });
  insert(e, { guid: `${R}/b`, link: `${R}/b`, title: "Earlier fresh B", pub: iso(T0 - DAY), first: iso(T0 - 3600e3), feed: F.reports });
  assert.equal(await e.CACHE.get("alert:watermark"), null);
  mockFetch({ [F.reports.url]: rss([
    { title: "Earlier fresh A", link: `${R}/a`, pubDate: rfc(T0 - 3 * DAY) },
    { title: "Earlier fresh B", link: `${R}/b`, pubDate: rfc(T0 - DAY) },
    { title: "Brand new", link: `${R}/c`, pubDate: rfc(T0 - 3600e3) },
  ]) });
  await pollAndArchive(e);
  assert.deepEqual(rows(e, `SELECT title FROM alert_events`).map((r) => r.title), ["Brand new"]);
  assert.ok(await e.CACHE.get("alert:watermark"), "watermark written");
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 1, "no refire");
});

test("P3b: KV missing and nothing new this poll: no alerts at all", async () => {
  const e = env();
  anyRule(e);
  insert(e, { guid: `${R}/a`, link: `${R}/a`, title: "Earlier fresh A", pub: iso(T0 - DAY), first: iso(T0 - 3600e3), feed: F.reports });
  mockFetch({ [F.reports.url]: rss([{ title: "Earlier fresh A", link: `${R}/a`, pubDate: rfc(T0 - DAY) }]) });
  await pollAndArchive(e);
  assert.equal(rows(e, `SELECT COUNT(*) AS n FROM alert_events`)[0].n, 0);
});
