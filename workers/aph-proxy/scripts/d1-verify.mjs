#!/usr/bin/env node
// Verify a restored D1 against an export manifest (WK-07, ARCH-12).
//
//   node scripts/d1-verify.mjs --manifest backups/archive-<stamp>.manifest.json \
//     --database <restored-db-name> --local|--remote [--config <path>]
//
// Runs one read-only SELECT COUNT(*) per manifest table through
// `wrangler d1 execute --json --command` and applies compareCounts from
// d1-dump.mjs, the same verdict function tests/restore.test.mjs exercises.
// Exits 0 only when every manifest table is present with an equal count.
// Excluded tables (manifest.excluded_tables) are expected to hold 0 rows.

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCounts, countQuery } from "./d1-dump.mjs";
import { runWrangler } from "./d1-export.mjs";

const WORKER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const o = { manifest: null, database: null, mode: null, config: join(WORKER_DIR, "wrangler.toml") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") o.manifest = resolve(argv[++i]);
    else if (a === "--database") o.database = argv[++i];
    else if (a === "--config") o.config = resolve(argv[++i]);
    else if (a === "--local" || a === "--remote") o.mode = a.slice(2);
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.manifest || !o.database || !o.mode) throw new Error("need --manifest, --database and one of --local or --remote");
  return o;
}

try {
  const o = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(o.manifest, "utf8"));
  const tables = Object.keys(manifest.tables);
  const out = runWrangler(["d1", "execute", o.database, `--${o.mode}`, "--json", "--config", o.config, "--command", countQuery(tables)], { capture: true });
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  const actual = parsed[0]?.results?.[0];
  if (!actual) throw new Error("wrangler returned no count row");
  const verdict = compareCounts(manifest.tables, actual);
  for (const t of tables) console.log(`  ${t.padEnd(22)} manifest ${String(manifest.tables[t]).padStart(6)}  restored ${String(actual[t]).padStart(6)}`);
  if (!verdict.ok) {
    console.error(`FAIL: ${verdict.mismatches.length} table(s) differ: ${JSON.stringify(verdict.mismatches)}`);
    process.exit(1);
  }
  console.log(`OK: ${tables.length} tables match manifest ${manifest.file} (sha256 ${manifest.sha256.slice(0, 12)})`);
} catch (err) {
  console.error(`d1-verify failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
