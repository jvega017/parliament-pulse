// WK-07 (ARCH-07, ARCH-12): export, manifest and restore drill, in memory.
//
// Run: node --experimental-sqlite tests/restore.test.mjs
//
// Builds a real in-memory SQLite with every migration applied plus the
// d1_migrations ledger wrangler keeps, seeds rows (including values holding
// quotes, semicolons, newlines and the text "INSERT INTO"), dumps it in the
// format `wrangler d1 export` writes (observed on wrangler 4.84.1, 29 Sep
// 2026), restores the dump into a fresh database and checks per-table counts
// with compareCounts, the verdict function scripts/d1-verify.mjs uses.
//
// Canary: a dump truncated mid-way must FAIL the count check. If it passes,
// the check cannot detect a lost tail and the suite aborts as untrustworthy.
//
// Measured to fail when the controls are removed (scratch copies of scripts/
// and this file, 29 Sep 2026):
//  - compareCounts returning ok:true unconditionally trips the canary, which
//    aborts the run with exit 2;
//  - splitStatements ignoring quotes fails the tricky-values test;
//  - stripTables keeping every INSERT fails the exclusion test;
//  - isInternalTable returning false fails the internal-tables test and the
//    every-migrated-table test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildManifest, compareCounts, countQuery, countRows, splitStatements, stripTables, utcStamp } from "../scripts/d1-dump.mjs";
import { parseArgs } from "../scripts/d1-export.mjs";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
const MIGRATIONS = readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql")).sort();

function migratedDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);`);
  for (const f of MIGRATIONS) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    db.prepare("INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)").run(f, "2026-09-29 00:00:00");
  }
  return db;
}

const TRICKY = `It's "quoted"; then INSERT INTO "signals" VALUES(1);\nsecond line`;

function seed(db) {
  const now = "2026-09-29T00:00:00.000Z";
  const sig = db.prepare(`INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (let i = 0; i < 25; i++) {
    sig.run(`g-${i}`, i === 3 ? TRICKY : `Item ${i}`, `https://www.aph.gov.au/x?${i}`, i % 5 ? now : null,
      "https://www.aph.gov.au/feed", "Feed", "house", "bill", now, now);
  }
  const th = db.prepare("INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at, item_count) VALUES (?, ?, ?, ?, ?, ?)");
  const st = db.prepare("INSERT INTO signal_threads (signal_guid, thread_id) VALUES (?, ?)");
  for (let i = 0; i < 5; i++) th.run(`t-${i}`, `fp-${i}`, `Thread ${i}`, now, now, 5);
  for (let i = 0; i < 25; i++) st.run(`g-${i}`, `t-${i % 5}`);
  const cc = db.prepare("INSERT INTO connector_checks (url, status, ok, checked_at, error) VALUES (?, ?, ?, ?, ?)");
  for (let i = 0; i < 7; i++) cc.run(`https://www.aph.gov.au/r${i}`, 200, 1, now, null);
  db.prepare("INSERT INTO digest_subscribers (email, watchlists, created_at) VALUES (?, ?, ?)").run("reader@example.org", "a,b", now);
  db.prepare("INSERT INTO digest_subscribers (email, watchlists, created_at) VALUES (?, ?, ?)").run("o'brien@example.org", null, now);
  db.prepare("INSERT INTO job_runs (job, started_at, finished_at, outcome, detail) VALUES (?, ?, ?, ?, ?)").run("poll", now, now, "ok", '{"new":1}');
}

function literal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
  const s = String(v).replace(/'/g, "''");
  // wrangler writes a newline as the two characters \n inside
  // replace('...','\n',char(10)) (observed in the 29 Sep 2026 local drill).
  return s.includes("\n") ? `replace('${s.replace(/\n/g, "\\n")}','\\n',char(10))` : `'${s}'`;
}

// The wrangler d1 export layout: PRAGMA, then each table's CREATE followed by
// its INSERTs, then sqlite_sequence, then indexes.
function dump(db) {
  const lines = ["PRAGMA defer_foreign_keys=TRUE;"];
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all();
  for (const { name, sql } of tables) {
    lines.push(`${sql};`);
    for (const row of db.prepare(`SELECT * FROM "${name}"`).all()) {
      lines.push(`INSERT INTO "${name}" VALUES(${Object.values(row).map(literal).join(",")});`);
    }
  }
  lines.push("DELETE FROM sqlite_sequence;");
  for (const row of db.prepare("SELECT name, seq FROM sqlite_sequence").all()) {
    lines.push(`INSERT INTO "sqlite_sequence" VALUES(${literal(row.name)},${literal(row.seq)});`);
  }
  for (const { sql } of db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY rowid").all()) {
    lines.push(`${sql};`);
  }
  return lines.join("\n") + "\n";
}

function liveCounts(db, tables) {
  return { ...db.prepare(countQuery(tables)).get() };
}

function restore(sql) {
  const db = new DatabaseSync(":memory:");
  db.exec(sql);
  return db;
}

const source = migratedDb();
seed(source);
const SQL = dump(source);
const manifest = buildManifest(SQL, { file: "archive-test.sql", wrangler_version: "test" });
const TABLES = Object.keys(manifest.tables);

test("manifest counts match the source database table by table", () => {
  assert.deepEqual(manifest.tables, liveCounts(source, TABLES));
  assert.equal(manifest.tables.signals, 25);
  assert.equal(manifest.tables.signal_threads, 25);
  assert.equal(manifest.tables.d1_migrations, MIGRATIONS.length);
  assert.equal(manifest.tables.qons, 0, "empty tables are listed with 0");
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
});

test("every migrated table appears in the manifest", () => {
  const all = source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name).sort();
  assert.deepEqual(TABLES, all);
});

test("internal tables are never counted", () => {
  assert.ok(SQL.includes('INSERT INTO "sqlite_sequence"'), "fixture carries sqlite_sequence rows");
  assert.ok(!("sqlite_sequence" in manifest.tables));
});

test("values with quotes, semicolons, newlines and INSERT text do not shift counts", () => {
  const stmts = splitStatements(`INSERT INTO "signals" VALUES('${TRICKY.replace(/'/g, "''")}');\nINSERT INTO signals VALUES(2);`);
  assert.equal(stmts.length, 2);
  assert.deepEqual(countRows(stmts.map((s) => s + ";").join("\n")), { signals: 2 });
});

test("round trip: restore into a fresh database and the counts match the manifest", () => {
  const restored = restore(SQL);
  const verdict = compareCounts(manifest.tables, liveCounts(restored, TABLES));
  assert.equal(verdict.ok, true, JSON.stringify(verdict.mismatches));
  assert.equal(restored.prepare("SELECT title FROM signals WHERE guid='g-3'").get().title, TRICKY);
  // Re-dumping the restored copy reproduces the original byte for byte.
  assert.equal(buildManifest(dump(restored)).sha256, manifest.sha256);
});

test("CANARY: a truncated dump fails the count check", () => {
  const cut = SQL.lastIndexOf('INSERT INTO "signal_threads"');
  assert.ok(cut > 0);
  const truncated = SQL.slice(0, SQL.lastIndexOf("\n", cut) + 1);
  const restored = restore(truncated);
  const verdict = compareCounts(manifest.tables, liveCounts(restored, TABLES.filter((t) => restored.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(t))));
  if (verdict.ok) {
    console.error("CANARY FAILED: a truncated dump passed the count check; restore verification is untrustworthy");
    process.exit(2);
  }
  assert.ok(verdict.mismatches.some((m) => m.table === "signal_threads"));
  assert.ok(verdict.mismatches.some((m) => m.table === "job_runs" && m.actual === null), "tables after the cut are missing");
  assert.notEqual(buildManifest(truncated).sha256, manifest.sha256);
});

test("a table missing from the restored database fails the check", () => {
  const { job_runs, ...rest } = manifest.tables;
  assert.equal(job_runs, 1);
  assert.equal(compareCounts(manifest.tables, rest).ok, false);
});

test("an extra table holding rows fails; an extra empty table does not", () => {
  assert.equal(compareCounts(manifest.tables, { ...manifest.tables, new_table: 0 }).ok, true);
  assert.equal(compareCounts(manifest.tables, { ...manifest.tables, new_table: 3 }).ok, false);
});

test("excluding digest_subscribers drops its rows, keeps its schema, and restores cleanly", () => {
  const stripped = stripTables(SQL, ["digest_subscribers"]);
  assert.ok(!stripped.includes("example.org"), "no subscriber email survives");
  assert.ok(stripped.includes("CREATE TABLE digest_subscribers"));
  const m = buildManifest(stripped, { excluded_tables: ["digest_subscribers"] });
  assert.equal(m.tables.digest_subscribers, 0);
  assert.equal(m.tables.signals, 25);
  const restored = restore(stripped);
  assert.equal(compareCounts(m.tables, liveCounts(restored, Object.keys(m.tables))).ok, true);
});

test("export arguments: exactly one of --remote or --local, no default", () => {
  assert.throws(() => parseArgs([]), /exactly one/);
  assert.throws(() => parseArgs(["--remote", "--local"]), /exactly one/);
  assert.equal(parseArgs(["--local"]).mode, "local");
  assert.deepEqual(parseArgs(["--remote", "--exclude-table", "digest_subscribers"]).exclude, ["digest_subscribers"]);
  assert.throws(() => parseArgs(["--local", "--out-dir"]), /needs a value/);
});

test("file stamps are UTC and filename-safe", () => {
  assert.equal(utcStamp(new Date("2026-09-29T05:12:03.456Z")), "20260929T051203Z");
});
