#!/usr/bin/env node
// D1 export with a manifest (WK-07, ARCH-07). Owner-run for --remote.
//
//   node scripts/d1-export.mjs --remote            (pnpm backup:export)
//   node scripts/d1-export.mjs --local             (pnpm backup:export:local)
//
// Options:
//   --remote | --local          which database (exactly one; no default)
//   --out-dir <dir>             default ./backups (git-ignored)
//   --database <name>           default parliament-pulse-archive
//   --config <path>             wrangler config, default wrangler.toml here
//   --exclude-table <name>      drop that table's rows from the dump, keep its
//                               schema; repeatable. CI passes digest_subscribers
//                               so no email address lands in a public artefact.
//   --yes                       pass --skip-confirmation to wrangler
//
// Writes <out-dir>/archive-<UTC stamp>.sql and archive-<UTC stamp>.manifest.json.
// The manifest holds per-table row counts measured from the dump itself, the
// dump's sha256 and byte size, and the wrangler version that produced it.
// Restore and verify: see RESTORE.md.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildManifest, stripTables, utcStamp } from "./d1-dump.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = resolve(HERE, "..");

export function parseArgs(argv) {
  const opts = { mode: null, outDir: join(WORKER_DIR, "backups"), database: "parliament-pulse-archive", config: join(WORKER_DIR, "wrangler.toml"), exclude: [], yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--remote" || a === "--local") {
      const m = a.slice(2);
      if (opts.mode && opts.mode !== m) throw new Error("pass exactly one of --remote or --local");
      opts.mode = m;
    } else if (a === "--out-dir") opts.outDir = resolve(next());
    else if (a === "--database") opts.database = next();
    else if (a === "--config") opts.config = resolve(next());
    else if (a === "--exclude-table") opts.exclude.push(next());
    else if (a === "--yes") opts.yes = true;
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.mode) throw new Error("pass exactly one of --remote or --local");
  return opts;
}

function wranglerBin() {
  const require = createRequire(join(WORKER_DIR, "package.json"));
  const pkgPath = require.resolve("wrangler/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.wrangler;
  return { bin: join(dirname(pkgPath), rel), version: pkg.version };
}

export function runWrangler(args, { capture = false } = {}) {
  const { bin } = wranglerBin();
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: WORKER_DIR,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const tail = capture ? `\n${(r.stderr || r.stdout || "").slice(-2000)}` : "";
    throw new Error(`wrangler ${args[0]} ${args[1] ?? ""} exited ${r.status}${tail}`);
  }
  return r.stdout ?? "";
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { version } = wranglerBin();
  mkdirSync(opts.outDir, { recursive: true });
  const stamp = utcStamp();
  const base = `archive-${stamp}`;
  const sqlPath = join(opts.outDir, `${base}.sql`);
  const rawPath = opts.exclude.length ? join(opts.outDir, `${base}.raw.sql`) : sqlPath;

  const args = ["d1", "export", opts.database, `--${opts.mode}`, `--output=${rawPath}`, "--config", opts.config];
  if (opts.yes) args.push("--skip-confirmation");
  runWrangler(args);

  let sql = readFileSync(rawPath, "utf8");
  if (opts.exclude.length) {
    sql = stripTables(sql, opts.exclude);
    writeFileSync(sqlPath, sql, "utf8");
    rmSync(rawPath, { force: true });
  }

  const manifest = buildManifest(sql, {
    database: opts.database,
    mode: opts.mode,
    created_at: new Date().toISOString(),
    file: `${base}.sql`,
    wrangler_version: version,
    excluded_tables: opts.exclude,
  });
  const manifestPath = join(opts.outDir, `${base}.manifest.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const total = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`Dump:     ${sqlPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`sha256 ${manifest.sha256}, ${manifest.bytes} bytes, ${Object.keys(manifest.tables).length} tables, ${total} rows`);
  for (const [t, c] of Object.entries(manifest.tables)) console.log(`  ${t.padEnd(22)} ${c}`);
  if (opts.exclude.length) console.log(`Rows excluded for: ${opts.exclude.join(", ")} (schema kept)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`d1-export failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
