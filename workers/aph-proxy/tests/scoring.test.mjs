// Honest scoring explanations (WK-01: PR-02, DATA-03) and ingest freshness
// (DATA-04, DATA-07).
//
// Run: node --experimental-strip-types tests/scoring.test.mjs
//
// Measured to fail when the controls are removed: restoring
// `if (!pubDate) return 48;` in ageHours makes the undated-ranking test fail,
// and restoring the unconditional `Published ${ageStr}` explanation makes the
// canary test fail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreForArchive, UNDATED_TIME_NOVELTY, formatDayMonYear } from "../src/workerScoring.ts";
import { queryFreshness, isStale, STALE_AFTER_MINUTES, FRESHNESS_SQL } from "../src/freshness.ts";

const NOW = new Date("2026-09-29T02:00:00.000Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

// Canary: a row whose source supplied no pubDate.
const CANARY = { title: "Inquiry into regional telecommunications", kind: "inquiry", pub_date: null, first_seen_at: "2026-09-27T05:10:00.000Z" };

test("canary: undated item explanation never says Published and names first seen", () => {
  const r = scoreForArchive(CANARY.title, CANARY.kind, CANARY.pub_date, NOW, 0, CANARY.first_seen_at);
  assert.ok(!/Published/.test(r.explanation), r.explanation);
  assert.match(r.explanation, /first seen/);
  assert.match(r.explanation, /Publication date not supplied by the source; first seen 27 Sep 2026/);
});

test("undated item with no first_seen_at still never says Published", () => {
  const r = scoreForArchive(CANARY.title, CANARY.kind, null, NOW);
  assert.ok(!/Published/.test(r.explanation), r.explanation);
  assert.match(r.explanation, /Publication date not supplied by the source\./);
});

test("unparseable pubDate is treated as undated, not as NaN hours", () => {
  const r = scoreForArchive(CANARY.title, CANARY.kind, "not a date", NOW, 0, CANARY.first_seen_at);
  assert.ok(!/Published/.test(r.explanation), r.explanation);
  assert.ok(Number.isFinite(r.overallPct));
});

test("no explanation claims portfolio scoring, and only computed dimensions are named", () => {
  const samples = [
    scoreForArchive(CANARY.title, "inquiry", null, NOW, 0, CANARY.first_seen_at),
    scoreForArchive("Budget estimates hearing", "hearing", hoursAgo(2), NOW),
    scoreForArchive("Division: Energy Bill 2026", "division", hoursAgo(30), NOW, 0.6),
    scoreForArchive("Program note", "signal", hoursAgo(24 * 20), NOW),
  ];
  for (const s of samples) {
    assert.ok(!/Portfolio scored/.test(s.explanation), s.explanation);
    assert.ok(!/portfolio|watchlist/i.test(s.explanation), s.explanation);
    assert.match(s.explanation, /Scored on authority, recency, novelty, scrutiny/);
  }
  assert.match(samples[2].explanation, /momentum/);
  assert.ok(!/momentum/i.test(samples[1].explanation));
});

test("dated items keep a truthful Published phrase", () => {
  assert.match(scoreForArchive("x", "report", hoursAgo(2), NOW).explanation, /Published within 4h\./);
  assert.match(scoreForArchive("x", "report", hoursAgo(72), NOW).explanation, /Published 3d ago\./);
});

test("a dated 3-day-old item outranks an equally authoritative undated item", () => {
  const dated = scoreForArchive(CANARY.title, CANARY.kind, hoursAgo(72), NOW);
  const undated = scoreForArchive(CANARY.title, CANARY.kind, null, NOW, 0, CANARY.first_seen_at);
  assert.ok(dated.overallPct > undated.overallPct, `dated ${dated.overallPct} vs undated ${undated.overallPct}`);
});

test("undated floor sits below every dated value in the last 7 days", () => {
  assert.ok(UNDATED_TIME_NOVELTY <= 0.35);
  const undated = scoreForArchive(CANARY.title, CANARY.kind, null, NOW);
  for (const h of [0.5, 5, 23, 47, 71, 72, 100, 167.9]) {
    const dated = scoreForArchive(CANARY.title, CANARY.kind, hoursAgo(h), NOW);
    assert.ok(dated.overallPct > undated.overallPct, `h=${h}: dated ${dated.overallPct} vs undated ${undated.overallPct}`);
  }
});

test("formatDayMonYear uses Australian eastern date and three-letter month", () => {
  assert.equal(formatDayMonYear("2026-09-29T15:30:00.000Z"), "30 Sep 2026"); // 01:30 AEST next day
  assert.equal(formatDayMonYear(null), null);
  assert.equal(formatDayMonYear("garbage"), null);
});

// ---- freshness (fixture D1 mock) --------------------------------------------

function mockDb(rows, calls) {
  return {
    prepare(sql) {
      calls.push(sql);
      return { async all() { return { results: rows }; } };
    },
  };
}

test("freshness: one query yields last_poll_at, last_new_item_at and per-feed last_seen_at", async () => {
  const calls = [];
  const rows = [
    { feed_label: "Senate media releases", last_seen_at: "2026-09-29T01:30:00.000Z", first_seen_at: "2026-09-28T22:00:00.000Z" },
    { feed_label: "House media releases", last_seen_at: "2026-09-29T01:45:00.000Z", first_seen_at: "2026-09-27T03:00:00.000Z" },
  ];
  const f = await queryFreshness(mockDb(rows, calls), NOW);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], FRESHNESS_SQL);
  assert.match(FRESHNESS_SQL, /MAX\(last_seen_at\)/);
  assert.match(FRESHNESS_SQL, /MAX\(first_seen_at\)/);
  assert.equal(f.last_poll_at, "2026-09-29T01:45:00.000Z");
  assert.equal(f.last_new_item_at, "2026-09-28T22:00:00.000Z");
  assert.deepEqual(f.feeds, [
    { feed_label: "Senate media releases", last_seen_at: "2026-09-29T01:30:00.000Z" },
    { feed_label: "House media releases", last_seen_at: "2026-09-29T01:45:00.000Z" },
  ]);
  assert.equal(f.stale, false); // 15 minutes old
});

test("freshness: stale when last poll is older than the threshold", async () => {
  assert.equal(STALE_AFTER_MINUTES, 90);
  const rows = [{ feed_label: "A", last_seen_at: hoursAgo(1.6), first_seen_at: hoursAgo(5) }];
  const f = await queryFreshness(mockDb(rows, []), NOW);
  assert.equal(f.stale, true);
  assert.equal(isStale(hoursAgo(1.4), NOW), false);
  assert.equal(isStale(hoursAgo(1.6), NOW), true);
});

test("freshness: empty table reports nulls and stale, never an invented time", async () => {
  const f = await queryFreshness(mockDb([], []), NOW);
  assert.equal(f.last_poll_at, null);
  assert.equal(f.last_new_item_at, null);
  assert.deepEqual(f.feeds, []);
  assert.equal(f.stale, true);
});
