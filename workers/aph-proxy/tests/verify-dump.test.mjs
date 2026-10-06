// Local restore drill for the weekly D1 export (scripts/d1-verify-dump.mjs,
// 7 Oct 2026). The weekly backup step in Claude-Workspace/tools/
// backup-all-weekly.ps1 runs it after every export.
//
// Run: node --experimental-sqlite tests/verify-dump.test.mjs
//
// Each control was reverted on a scratch copy and this file then failed
// (see the commit message): skipping the sha256 check, skipping the
// restored-count comparison, and ignoring --min-signals.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildManifest } from "../scripts/d1-dump.mjs";
import { verifyDump } from "../scripts/d1-verify-dump.mjs";

const open = () => new DatabaseSync(":memory:");
const DUMP = [
  "PRAGMA defer_foreign_keys=TRUE;",
  "CREATE TABLE signals (guid TEXT PRIMARY KEY, title TEXT);",
  `INSERT INTO "signals" VALUES('a','It''s "quoted"; INSERT INTO "signals" VALUES(1);');`,
  `INSERT INTO "signals" VALUES('b','second');`,
  "CREATE TABLE feed_health (feed_url TEXT PRIMARY KEY);",
  `INSERT INTO "feed_health" VALUES('https://www.aph.gov.au/house/rss/divisions');`,
  "",
].join("\n");

test("a good dump restores with every manifest count (restraint)", () => {
  const m = buildManifest(DUMP, { file: "x.sql" });
  const v = verifyDump(DUMP, m, open);
  assert.deepEqual(v.problems, []);
  assert.equal(v.ok, true);
  assert.equal(v.restored.signals, 2);
  assert.equal(v.restored.feed_health, 1);
});

test("a dump changed after its manifest fails the sha256 and size check", () => {
  const m = buildManifest(DUMP, { file: "x.sql" });
  const truncated = DUMP.slice(0, DUMP.lastIndexOf("INSERT"));
  const v = verifyDump(truncated, m, open);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => p.includes("sha256")));
});

test("the restored copy is counted: a manifest count the restore does not reproduce fails", () => {
  const m = buildManifest(DUMP, { file: "x.sql" });
  m.tables = { ...m.tables, signals: 3 };
  const v = verifyDump(DUMP, m, open);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => p.startsWith("signals: expected 3, restored 2")), v.problems.join("; "));
});

test("a dump that does not import fails", () => {
  const bad = `${DUMP}INSERT INTO "no_such_table" VALUES(1);\n`;
  const m = buildManifest(bad, { file: "x.sql" });
  const v = verifyDump(bad, m, open);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => p.startsWith("import failed")));
});

test("--min-signals: a dump below the floor fails, one at the floor passes", () => {
  const m = buildManifest(DUMP, { file: "x.sql" });
  assert.equal(verifyDump(DUMP, m, open, { minSignals: 3 }).ok, false);
  assert.equal(verifyDump(DUMP, m, open, { minSignals: 2 }).ok, true);
});
