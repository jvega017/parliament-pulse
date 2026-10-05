// 0.16.2: /state serves hearing_date for hearing rows, parsed from the stored
// APH description. The fixture is the verbatim <description> of every item in
// the live Upcoming Senate hearings feed captured on 5 Oct 2026; its expected
// dates were read by hand from the printed day, month and year.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/hearing-date.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { parseHearingDate } = await import("../src/hearingDate.ts");
const { queryStateSignals } = await import("../src/archive.ts");
const { buildState } = await import("../src/state.ts");
const { APH_FEEDS } = await import("../src/feeds.ts");

console.warn = () => {};
console.log = () => {};

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/upcoming-hearings-2026-10-05.json", import.meta.url)), "utf8"),
);

const UPCOMING = APH_FEEDS.find((f) => f.label === "Upcoming Senate hearings");
const DIVISIONS = APH_FEEDS.find((f) => f.kind === "division");

test("fixture: 30 real descriptions, each parses to its printed date", () => {
  assert.equal(fixture.items.length, 30);
  for (const it of fixture.items) {
    assert.equal(parseHearingDate(it.description), it.hearing_date, it.description);
  }
});

test("fixture: the missing month/year space in the live feed still parses", () => {
  const odd = fixture.items.find((it) => it.description.includes("October2026"));
  assert.ok(odd, "the 'October2026' item is in the fixture");
  assert.equal(parseHearingDate(odd.description), "2026-10-16");
});

test("a civil date is never shifted through UTC", () => {
  // A UTC round trip from Brisbane (+10:00) would move midnight to the
  // previous day; the parse is purely calendrical.
  assert.equal(parseHearingDate("Thursday, 1 October 2026 - Committee Room 2S3, Parliament House, Canberra"), "2026-10-01");
  assert.equal(parseHearingDate("Thursday, 12 November 2026 - Venue TBC, Melbourne, VIC"), "2026-11-12");
});

test("never guesses: null for missing, malformed, impossible or weekday-inconsistent dates", () => {
  for (const d of [
    null,
    undefined,
    "",
    "Venue TBC, Canberra, ACT",
    "Hearing on Friday, 18 September 2026 - Canberra", // date not at the start
    "Thursday, 18 September 2026 - Canberra",          // 18 Sep 2026 is a Friday
    "Wednesday, 31 September 2026 - Canberra",         // no 31 September
    "Friday, 18 Sept 2026 - Canberra",                 // abbreviated month never observed
    "Friday, 18 September 20261 - Canberra",           // five-digit year
    "18 September 2026 - Canberra",                    // no weekday
  ]) {
    assert.equal(parseHearingDate(d), null, String(d));
  }
});

test("a description that is only the date parses", () => {
  assert.equal(parseHearingDate("Friday, 18 September 2026"), "2026-09-18");
});

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

function insert(e, { guid, title, feed, description, pub_date = null }) {
  const at = new Date().toISOString();
  e.ARCHIVE.raw.prepare(
    `INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(guid, title, `https://example.test/${guid}`, pub_date, feed.url, feed.label, "Senate", feed.kind, at, at, description);
}

test("/state signals: hearing rows carry hearing_date from the stored description", async () => {
  const e = env();
  fixture.items.slice(0, 5).forEach((it, i) =>
    insert(e, { guid: `h${i}`, title: `${it.title} ${i}`, feed: UPCOMING, description: it.description }),
  );
  insert(e, { guid: "h-bad", title: "No date here", feed: UPCOMING, description: "Venue TBC, Canberra, ACT" });
  insert(e, { guid: "h-null", title: "Null description", feed: UPCOMING, description: null });
  // A non-hearing row whose description happens to open with a date stays null.
  insert(e, { guid: "d1", title: "Division", feed: DIVISIONS, description: "Friday, 18 September 2026 - Senate", pub_date: new Date().toISOString() });

  const { items } = await queryStateSignals(e);
  const byGuid = Object.fromEntries(items.map((it) => [it.guid, it]));
  fixture.items.slice(0, 5).forEach((it, i) => {
    assert.equal(byGuid[`h${i}`].hearing_date, it.hearing_date, it.description);
    assert.equal(byGuid[`h${i}`].pub_date, null, "pub_date is unchanged");
  });
  assert.equal(byGuid["h-bad"].hearing_date, null);
  assert.equal(byGuid["h-null"].hearing_date, null);
  assert.equal(byGuid["d1"].hearing_date, null, "only hearing rows are parsed");
  for (const it of items) assert.equal("description" in it, false, "description is not served");
});

test("/state: hearing_date reaches the served signals block", async () => {
  const e = env();
  insert(e, { guid: "h0", title: fixture.items[3].title, feed: UPCOMING, description: fixture.items[3].description });
  const state = await buildState(e);
  assert.equal(state.blocks.signals.provenance, "live");
  assert.equal(state.blocks.signals.items[0].hearing_date, fixture.items[3].hearing_date);
});
