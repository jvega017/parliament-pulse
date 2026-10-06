#!/usr/bin/env node
// Local restore drill for one export (7 Oct 2026). Needs no Cloudflare access.
//
//   node --experimental-sqlite scripts/d1-verify-dump.mjs --manifest backups/archive-<stamp>.manifest.json
//
// 1. The dump's byte size and sha256 equal the manifest's.
// 2. The dump imports cleanly into a fresh in-memory SQLite (node:sqlite).
// 3. Each manifest table, counted on that restored copy with countQuery, is
//    present with the manifest's count (compareCounts, the verdict function
//    scripts/d1-verify.mjs and tests/restore.test.mjs use).
// 4. Optional: --min-signals <n> fails a dump whose signals table holds fewer
//    rows than n (the weekly backup passes the previous export's count less
//    10 per cent, so a dump of a database that lost its archive is caught).
//
// Exits 0 only when every check passes; prints one JSON verdict line.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCounts, countQuery, sha256 } from "./d1-dump.mjs";

/**
 * The verdict for one dump against its manifest. `openDb` returns an object
 * with exec(sql) and prepare(sql).get(), such as node:sqlite's DatabaseSync.
 */
export function verifyDump(sql, manifest, openDb, { minSignals = null } = {}) {
  const problems = [];
  const bytes = Buffer.byteLength(sql, "utf8");
  if (bytes !== manifest.bytes) problems.push(`bytes ${bytes} != manifest ${manifest.bytes}`);
  if (sha256(sql) !== manifest.sha256) problems.push("sha256 differs from manifest");
  const tables = Object.keys(manifest.tables ?? {});
  if (tables.length === 0) problems.push("manifest lists no tables");
  let actual = {};
  if (problems.length === 0) {
    const db = openDb();
    try {
      db.exec(sql);
      actual = { ...db.prepare(countQuery(tables)).get() };
    } catch (err) {
      problems.push(`import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      try { db.close?.(); } catch { /* ignore */ }
    }
  }
  if (problems.length === 0) {
    const verdict = compareCounts(manifest.tables, actual);
    for (const m of verdict.mismatches) problems.push(`${m.table}: expected ${m.expected}, restored ${m.actual}`);
  }
  if (problems.length === 0 && minSignals !== null && Number(actual.signals ?? 0) < minSignals) {
    problems.push(`signals ${actual.signals ?? 0} below the floor ${minSignals}`);
  }
  return { ok: problems.length === 0, problems, restored: actual };
}

function parseArgs(argv) {
  const o = { manifest: null, minSignals: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") o.manifest = resolve(argv[++i]);
    else if (a === "--min-signals") o.minSignals = Number(argv[++i]);
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.manifest) throw new Error("need --manifest");
  if (o.minSignals !== null && !Number.isFinite(o.minSignals)) throw new Error("--min-signals needs a number");
  return o;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const manifest = JSON.parse(readFileSync(o.manifest, "utf8"));
    const sql = readFileSync(join(dirname(o.manifest), manifest.file), "utf8");
    const { DatabaseSync } = await import("node:sqlite");
    const v = verifyDump(sql, manifest, () => new DatabaseSync(":memory:"), { minSignals: o.minSignals });
    console.log(JSON.stringify({ ok: v.ok, file: manifest.file, problems: v.problems, signals: v.restored.signals ?? null }));
    process.exit(v.ok ? 0 : 1);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, problems: [`d1-verify-dump failed: ${err instanceof Error ? err.message : String(err)}`] }));
    process.exit(1);
  }
}
