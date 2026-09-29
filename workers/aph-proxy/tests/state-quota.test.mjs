// WK-04: per-feed quotas in the /state signals block (DATA-05). Runs against a
// real in-memory SQLite with every migration applied (./support/sqlite-d1.mjs),
// so the ROW_NUMBER() OVER (PARTITION BY feed_label ...) query is executed by a
// real SQL engine rather than a mock that would encode the assumption.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/state-quota.test.mjs
//
// Measured to fail when the controls are removed (scratch copies, 29 Sep 2026):
//  - restoring the pre-WK-04 single query (ORDER BY COALESCE(pub_date,
//    first_seen_at) DESC LIMIT 240, rescore, global slice(0, 30)) fails 5 of 9:
//    "quota: 40 rows in one feed and 3 in four others" ("Senate reports tabled
//    appears in /state": the busy feed takes every row), the 13-feed quota
//    test, the cap test, the unconfigured-label test and the /state shape test;
//  - restoring the "state:v1" cache key fails the cache test (a stale v1 body
//    is served as a HIT).

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { queryStateSignals, PER_FEED_QUOTA, STATE_SIGNAL_CAP } = await import("../src/archive.ts");
const { buildState } = await import("../src/state.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");
const { default: worker } = await import("../src/index.ts");
const { STATE_CACHE_KEY } = await import("../src/version.ts");

console.warn = () => {};
console.log = () => {};

const ITEM_FIELDS = [
  "guid", "title", "link", "pub_date", "feed_label", "source_group", "kind",
  "first_seen_at", "attention", "confidence", "scoring_explanation",
];

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

// Rows are dated on distinct recent hours so recency ordering is well defined.
// The busy feed's rows are the most recent, which is exactly the case where a
// global LIMIT starves every other feed.
function seed(e, feed, n, { hoursAgoStart = 0 } = {}) {
  const stmt = e.ARCHIVE.raw.prepare(
    `INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const base = Date.now();
  for (let i = 0; i < n; i += 1) {
    const at = new Date(base - (hoursAgoStart + i) * 3_600_000).toISOString();
    stmt.run(
      `${feed.label}-${i}`, `${feed.label} item ${i}`, `${feed.url}#${i}`, at,
      feed.url, feed.label, "Test", feed.kind, at, at,
    );
  }
}

function perFeedCounts(items) {
  const m = {};
  for (const it of items) m[it.feed_label] = (m[it.feed_label] ?? 0) + 1;
  return m;
}

test("constants: quota 10, cap 150, and 13 feeds fit under the cap", () => {
  assert.equal(PER_FEED_QUOTA, 10);
  assert.equal(STATE_SIGNAL_CAP, 150);
  assert.ok(APH_FEEDS.length * PER_FEED_QUOTA <= STATE_SIGNAL_CAP);
});

test("quota: 40 rows in one feed and 3 in four others", async () => {
  const e = env();
  const [busy, ...rest] = APH_FEEDS;
  const quiet = rest.slice(0, 4);
  seed(e, busy, 40);
  quiet.forEach((f, i) => seed(e, f, 3, { hoursAgoStart: 50 + i * 5 }));

  const { items, signal_counts } = await queryStateSignals(e);
  const counts = perFeedCounts(items);

  for (const f of [busy, ...quiet]) assert.ok(counts[f.label] > 0, `${f.label} appears in /state`);
  assert.equal(Object.keys(counts).length, 5, "all five seeded feeds present");
  for (const [label, n] of Object.entries(counts)) {
    assert.ok(n <= PER_FEED_QUOTA, `${label} holds ${n}, over the quota`);
  }
  assert.equal(counts[busy.label], PER_FEED_QUOTA, "busy feed filled to its quota");
  for (const f of quiet) assert.equal(counts[f.label], 3, `${f.label} keeps all 3 rows`);
  assert.equal(items.length, 22);
  assert.ok(items.length <= STATE_SIGNAL_CAP);

  // signal_counts matches what was served and what is archived.
  assert.deepEqual(Object.keys(signal_counts).sort(), APH_FEEDS.map((f) => f.label).sort(), "one key per configured feed");
  assert.deepEqual(signal_counts[busy.label], { held: 10, available: 40 });
  for (const f of quiet) assert.deepEqual(signal_counts[f.label], { held: 3, available: 3 });
  for (const f of rest.slice(4)) assert.deepEqual(signal_counts[f.label], { held: 0, available: 0 });
  for (const [label, c] of Object.entries(signal_counts)) {
    assert.equal(c.held, counts[label] ?? 0, `${label} held equals rows served`);
  }

  // Globally sorted by the score-then-recency order.
  for (let i = 1; i < items.length; i += 1) {
    const rank = (it) => ({ high: 3, medium: 2, low: 1 })[it.attention] ?? 0;
    assert.ok(rank(items[i - 1]) >= rank(items[i]), "attention never rises down the list");
  }
});

test("quota: every configured feed with 20 rows gets exactly 10, total 130", async () => {
  const e = env();
  APH_FEEDS.forEach((f, i) => seed(e, f, 20, { hoursAgoStart: i }));
  const { items, signal_counts } = await queryStateSignals(e);
  const counts = perFeedCounts(items);
  assert.equal(items.length, APH_FEEDS.length * PER_FEED_QUOTA);
  for (const f of APH_FEEDS) {
    assert.equal(counts[f.label], PER_FEED_QUOTA, f.label);
    assert.deepEqual(signal_counts[f.label], { held: 10, available: 20 });
  }
});

test("cap: the hard total cap holds when quotas would exceed it", async () => {
  const e = env();
  APH_FEEDS.forEach((f, i) => seed(e, f, 20, { hoursAgoStart: i }));
  const { items, signal_counts } = await queryStateSignals(e, { perFeed: 20 });
  assert.equal(items.length, STATE_SIGNAL_CAP, "260 candidates capped at 150");
  const held = Object.values(signal_counts).reduce((a, c) => a + c.held, 0);
  assert.equal(held, STATE_SIGNAL_CAP, "held counts sum to the capped total");
});

test("quota: rows from an unconfigured feed_label are not served", async () => {
  const e = env();
  seed(e, APH_FEEDS[0], 3);
  seed(e, { label: "Bills Digests 1970", url: "https://example.test/legacy", kind: "digest" }, 5);
  const { items, signal_counts } = await queryStateSignals(e);
  assert.ok(items.every((it) => it.feed_label !== "Bills Digests 1970"));
  assert.equal(signal_counts["Bills Digests 1970"], undefined);
});

test("/state: meta.signal_counts present, schema state-v1, item shape unchanged", async () => {
  const e = env();
  const [busy, ...rest] = APH_FEEDS;
  seed(e, busy, 40);
  rest.slice(0, 4).forEach((f, i) => seed(e, f, 3, { hoursAgoStart: 50 + i * 5 }));
  const state = await buildState(e);

  assert.equal(state.meta.schema, "state-v1");
  assert.deepEqual(state.meta.signal_counts[busy.label], { held: 10, available: 40 });
  const block = state.blocks.signals;
  assert.equal(block.provenance, "live");
  assert.ok(Array.isArray(block.items));
  assert.equal(block.items.length, 22);
  for (const it of block.items) assert.deepEqual(Object.keys(it).sort(), [...ITEM_FIELDS].sort());
});

test("/state: empty signals table is fixture with zero counts, never sample rows", async () => {
  const state = await buildState(env());
  assert.equal(state.blocks.signals.provenance, "fixture");
  assert.deepEqual(state.blocks.signals.items, []);
  for (const c of Object.values(state.meta.signal_counts)) assert.deepEqual(c, { held: 0, available: 0 });
});

test("/state: a failed signals query omits signal_counts rather than claim zero", async () => {
  const e = env();
  e.ARCHIVE.raw.exec(`DROP TABLE signals`);
  const state = await buildState(e);
  assert.equal(state.blocks.signals.provenance, "fixture");
  assert.equal(state.meta.signal_counts, undefined);
});

test("cache: a stale state:v1 body is never served; the response is cached under the versioned state:v2 key", async () => {
  const e = env();
  seed(e, APH_FEEDS[0], 3);
  await e.CACHE.put("state:v1", JSON.stringify({ stale: "30-row body" }));
  const ctx = { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
  const res = await worker.fetch(new Request("https://w.test/state"), e, ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-cache"), "MISS");
  const body = await res.json();
  assert.equal(body.stale, undefined, "old v1 cache body not served");
  assert.equal(body.meta.schema, "state-v1");
  await Promise.all(ctx.pending);
  assert.ok(await e.CACHE.get(STATE_CACHE_KEY), "fresh body cached under the versioned state:v2 key");
  assert.equal(await e.CACHE.get("state:v2"), null, "no unversioned state:v2 body written");
  const again = await worker.fetch(new Request("https://w.test/state"), e, ctx);
  assert.equal(again.headers.get("x-cache"), "HIT");
});
