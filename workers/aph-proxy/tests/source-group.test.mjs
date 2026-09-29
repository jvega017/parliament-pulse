// Joint committee items are grouped "Joint", never the leftover "Custom"
// (round 1 fix, 29 Sep 2026). Covers the rule in src/jurisdictions.json, the
// value an ingest writes to D1, and migration 0009 relabelling stored rows.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/source-group.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { pollAndArchive } = await import("../src/archive.ts");
const { APH_FEEDS, sourceGroupFor } = await import("../src/feeds.ts");

console.warn = () => {};
console.log = () => {};

const JOINT = APH_FEEDS.find((f) => f.label === "Joint committee inquiries");
const MIGRATION_0009 = readFileSync(
  fileURLToPath(new URL("../migrations/0009_joint_source_group.sql", import.meta.url)), "utf8");

const EMPTY = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`;
const JOINT_ITEM = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Inquiry into the test joint committee matter</title>
<link>https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/test</link>
<guid>joint-test-guid-1</guid>
<pubDate>Mon, 28 Sep 2026 00:00:00 +1000</pubDate>
<description>Joint committee inquiry.</description></item>
</channel></rss>`;

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

function mockFetch() {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input.url;
    return new Response(url === JOINT.url ? JOINT_ITEM : EMPTY, { status: 200 });
  };
}

test("rule: the joint committee feed is grouped Joint", () => {
  assert.ok(JOINT, "Joint committee inquiries is a configured feed");
  assert.equal(sourceGroupFor(JOINT.label), "Joint");
});

test("rule: no configured feed maps to Custom; every group is a named chamber group", () => {
  const allowed = new Set(["Senate", "House", "Library", "Joint"]);
  for (const f of APH_FEEDS) {
    const g = sourceGroupFor(f.label);
    assert.notEqual(g, "Custom", `${f.label} is not Custom`);
    assert.ok(allowed.has(g), `${f.label} -> ${g} is an allowed group`);
  }
});

test("ingest: a joint committee item is stored with source_group Joint", async () => {
  const e = env();
  mockFetch();
  await pollAndArchive(e);
  const row = e.ARCHIVE.raw.prepare(`SELECT source_group FROM signals WHERE guid = ?`).get("joint-test-guid-1");
  assert.ok(row, "the joint item was ingested");
  assert.equal(row.source_group, "Joint");
});

test("migration 0009: relabels stored Custom signals and alert rules, idempotently", async () => {
  const e = env();
  mockFetch();
  await pollAndArchive(e);
  // Simulate rows written by Worker 0.16.0 and earlier.
  e.ARCHIVE.raw.exec(`UPDATE signals SET source_group = 'Custom' WHERE guid = 'joint-test-guid-1'`);
  e.ARCHIVE.raw.exec(`INSERT INTO alert_rules (name, terms, attention_min, source_group, kind, created_at, active)
                      VALUES ('joint rule', '', 'high', 'Custom', NULL, '2026-09-01T00:00:00Z', 1),
                             ('senate rule', '', 'high', 'Senate', NULL, '2026-09-01T00:00:00Z', 1)`);
  e.ARCHIVE.raw.exec(MIGRATION_0009);
  e.ARCHIVE.raw.exec(MIGRATION_0009);
  const custom = e.ARCHIVE.raw.prepare(
    `SELECT (SELECT COUNT(*) FROM signals WHERE source_group = 'Custom')
          + (SELECT COUNT(*) FROM alert_rules WHERE source_group = 'Custom') AS n`).get();
  assert.equal(custom.n, 0, "no Custom value remains");
  assert.equal(e.ARCHIVE.raw.prepare(`SELECT source_group FROM signals WHERE guid = 'joint-test-guid-1'`).get().source_group, "Joint");
  const rules = e.ARCHIVE.raw.prepare(`SELECT name, source_group FROM alert_rules ORDER BY name`).all().map((r) => ({ ...r }));
  assert.deepEqual(rules, [
    { name: "joint rule", source_group: "Joint" },
    { name: "senate rule", source_group: "Senate" },
  ], "only Custom rows change");
});
