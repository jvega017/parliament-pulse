// WK-03: correct thread counts (DATA-06) and feed-derived connector health
// (DATA-08, UX-12), exercised end to end through pollAndArchive and /state
// against a real in-memory SQLite with every migration applied (see
// ./support/sqlite-d1.mjs). fetch is mocked; nothing leaves the process.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/ingest.test.mjs
//
// Measured to fail when the controls are removed (scratch clone, 29 Sep 2026):
//  - restoring the pre-WK-03 new-row test (meta.last_row_id) and the
//    `item_count = item_count + 1` thread updates fails
//    "threads: item_count equals signal_guids.length after 5 polls of one item"
//    (stored item_count 5 against 1 member signal);
//  - restoring only the meta.last_row_id new-row test fails the same test on
//    "a re-seen item is not counted as new";
//  - restoring the connector_checks query in state.ts fails
//    "connectors: one row per configured feed_label, no parlinfo root" and
//    the Bills Digests ok test (block degrades to fixture).

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { pollAndArchive } = await import("../src/archive.ts");
const { buildState } = await import("../src/state.ts");
const { APH_FEEDS, APH_REFERENCE_LINKS } = await import("../src/feeds.ts");
const { default: worker } = await import("../src/index.ts");

console.warn = () => {};
console.log = () => {};

const BILLS_DIGESTS = APH_FEEDS.find((f) => f.label === "Bills Digests");
const PARLINFO_ROOT = "https://parlinfo.aph.gov.au/";

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const ONE_ITEM = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Treasury Laws Amendment (Small Business Energy Relief) Bill 2026</title>
<link>https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22library%2Fprspub%2Ftest%22</link>
<guid>bd-test-guid-1</guid>
<pubDate>Mon, 28 Sep 2026 00:00:00 +1000</pubDate>
<description>Bills Digest for the energy relief bill.</description></item>
</channel></rss>`;

// statusFor(url) -> HTTP status for that feed on this poll; body is ONE_ITEM
// for Bills Digests and EMPTY for every other feed.
function mockFetch(statusFor = () => 200) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    const status = statusFor(url);
    const body = url === BILLS_DIGESTS.url ? ONE_ITEM : EMPTY;
    return new Response(status === 200 ? body : "blocked", { status });
  };
}

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

test("threads: item_count equals signal_guids.length after 5 polls of one item", async () => {
  const e = env();
  mockFetch();
  const polls = [];
  for (let i = 0; i < 5; i += 1) polls.push(await pollAndArchive(e));

  // Stored column: must match the mapping table, not the number of polls.
  const stored = e.ARCHIVE.raw.prepare(
    `SELECT t.item_count AS stored, (SELECT COUNT(*) FROM signal_threads st WHERE st.thread_id = t.thread_id) AS members
       FROM threads t`,
  ).all();
  assert.equal(stored.length, 1, "one thread for one item");
  assert.equal(stored[0].stored, stored[0].members, "stored item_count equals member count");
  assert.equal(stored[0].stored, 1);

  // Served value: /state threads block.
  const state = await buildState(e);
  const items = state.blocks.threads.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].item_count, items[0].signal_guids.length, "served item_count equals signal_guids.length");
  assert.equal(items[0].item_count, 1);

  const bd = (p) => p.perFeed.find((f) => f.feed === BILLS_DIGESTS.url);
  assert.equal(bd(polls[0]).new, 1, "first poll inserts the item");
  for (let i = 1; i < 5; i += 1) {
    assert.equal(bd(polls[i]).new, 0, `a re-seen item is not counted as new (poll ${i + 1})`);
  }
});

test("threads: /state serves the member count even when the stored column is inflated", async () => {
  const e = env();
  mockFetch();
  await pollAndArchive(e);
  // Simulate a pre-WK-03 row that the unapplied 0007 backfill has not repaired.
  e.ARCHIVE.raw.exec(`UPDATE threads SET item_count = 37`);
  const state = await buildState(e);
  const t = state.blocks.threads.items[0];
  assert.equal(t.item_count, 1);
  assert.equal(t.item_count, t.signal_guids.length);
});

test("connectors: one row per configured feed_label, no parlinfo root", async () => {
  const e = env();
  mockFetch();
  await pollAndArchive(e);
  const block = (await buildState(e)).blocks.connectors;

  assert.equal(block.provenance, "live");
  assert.equal(APH_FEEDS.length, 13, "13 configured feeds");
  assert.equal(block.checks.length, 13, "one check per configured feed");
  assert.deepEqual(block.checks.map((c) => c.feed_label), APH_FEEDS.map((f) => f.label));
  for (const c of block.checks) {
    assert.ok(c.last_success_at, `${c.feed_label} has last_success_at`);
    assert.equal(c.last_http_status, 200);
  }
  assert.ok(!block.checks.some((c) => c.url === PARLINFO_ROOT), "parlinfo root is not a health row");

  // Landing pages are a plain reference list with no ok/fail.
  assert.ok(block.reference_links.includes(PARLINFO_ROOT), "parlinfo root is a reference link");
  assert.ok(block.reference_links.every((l) => typeof l === "string"), "reference links carry no status");
  assert.deepEqual(block.reference_links, APH_REFERENCE_LINKS);
});

test("connectors: Bills Digests reports ok on a 200 feed; a 403 feed reports failure and keeps last_success_at", async () => {
  const e = env();
  const divisions = APH_FEEDS.find((f) => f.kind === "division");
  mockFetch();
  await pollAndArchive(e);
  await new Promise((r) => setTimeout(r, 5)); // distinct poll timestamps
  mockFetch((url) => (url === divisions.url ? 403 : 200));
  await pollAndArchive(e);

  const checks = (await buildState(e)).blocks.connectors.checks;
  const bd = checks.find((c) => c.feed_label === "Bills Digests");
  assert.equal(bd.ok, 1);
  assert.equal(bd.status, 200);
  assert.equal(bd.items_parsed, 1);
  assert.equal(bd.parse_error, null);

  const div = checks.find((c) => c.url === divisions.url);
  assert.equal(div.ok, 0);
  assert.equal(div.last_http_status, 403);
  assert.equal(div.parse_error, "HTTP 403");
  assert.ok(div.last_success_at, "last_success_at survives a failed poll");
  assert.ok(div.last_success_at < div.checked_at, "last success predates the failed poll");
});

test("connectors: before any poll the block is fixture, not live", async () => {
  const block = (await buildState(env())).blocks.connectors;
  assert.equal(block.provenance, "fixture");
  assert.deepEqual(block.checks, []);
  assert.ok(block.reference_links.length > 0);
});

test("connectors: an unmigrated feed_health table degrades to fixture, ingest still works", async () => {
  const e = env();
  e.ARCHIVE.raw.exec(`DROP TABLE feed_health`);
  mockFetch();
  const r = await pollAndArchive(e);
  assert.equal(r.perFeed.find((f) => f.feed === BILLS_DIGESTS.url).new, 1, "ingest unaffected by missing health table");
  const block = (await buildState(e)).blocks.connectors;
  assert.equal(block.provenance, "fixture");
  assert.match(block.note, /feed_health/);
});

test("/healthz/connectors serves feed rows plus reference_links", async () => {
  const e = env();
  mockFetch();
  await pollAndArchive(e);
  const res = await worker.fetch(new Request("https://w.test/healthz/connectors"), e, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.connectors.length, 13);
  assert.ok(!body.connectors.some((c) => c.url === PARLINFO_ROOT));
  assert.ok(body.reference_links.includes(PARLINFO_ROOT));
});
