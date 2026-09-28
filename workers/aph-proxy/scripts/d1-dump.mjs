// Pure helpers shared by d1-export.mjs, d1-verify.mjs and tests/restore.test.mjs
// (WK-07, ARCH-07). No I/O here, so the test exercises the exact functions the
// owner-run scripts use to write and check a manifest.
//
// Dump format: what `wrangler d1 export` writes (observed on wrangler 4.84.1,
// 29 Sep 2026, local export of parliament-pulse-archive):
//   PRAGMA defer_foreign_keys=TRUE;
//   CREATE TABLE d1_migrations(...);
//   INSERT INTO "d1_migrations" VALUES(1,'0001_signals.sql','...');
//   CREATE TABLE signals (...);
//   ...
//   DELETE FROM sqlite_sequence;
//   INSERT INTO "sqlite_sequence" VALUES(...);
//   CREATE INDEX ...;
// Statements are split on semicolons outside quotes, so a value containing
// ";", a newline or the text "INSERT INTO" cannot shift the counts.

import { createHash } from "node:crypto";

/** Split SQL text into statements, respecting '...', "...", `...`, [...] and comments. */
export function splitStatements(sql) {
  const out = [];
  let start = 0;
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === "`") {
      i++;
      while (i < n) {
        if (sql[i] === c) {
          if (sql[i + 1] === c) { i += 2; continue; }
          break;
        }
        i++;
      }
      i++;
      continue;
    }
    if (c === "[") {
      while (i < n && sql[i] !== "]") i++;
      i++;
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === ";") {
      const stmt = sql.slice(start, i).trim();
      if (stmt) out.push(stmt);
      start = i + 1;
    }
    i++;
  }
  const tail = sql.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

const INSERT_RE = /^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(?:"((?:[^"]|"")+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/i;
const CREATE_RE = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"((?:[^"]|"")+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/i;

function nameOf(m) {
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/""/g, '"');
}

/** Tables that are engine or platform internals, never counted. */
export function isInternalTable(name) {
  return name === "sqlite_sequence" || name.startsWith("sqlite_") || name.startsWith("_cf_");
}

/** Per-table row counts from a dump: one INSERT statement is one row. */
export function countRows(sql) {
  const tables = {};
  for (const stmt of splitStatements(sql)) {
    const created = nameOf(CREATE_RE.exec(stmt));
    if (created && !isInternalTable(created)) {
      tables[created] ??= 0;
      continue;
    }
    const inserted = nameOf(INSERT_RE.exec(stmt));
    if (inserted && !isInternalTable(inserted)) {
      tables[inserted] = (tables[inserted] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(tables).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Remove every INSERT for the named tables (their CREATE TABLE stays, so a
 * restore still has the schema). Used to keep personal data, such as
 * digest_subscribers email addresses, out of a CI artefact on a public repo.
 */
export function stripTables(sql, exclude) {
  if (!exclude.length) return sql;
  const drop = new Set(exclude);
  const kept = splitStatements(sql).filter((stmt) => {
    const t = nameOf(INSERT_RE.exec(stmt));
    return !(t && drop.has(t));
  });
  return kept.map((s) => `${s};`).join("\n") + "\n";
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** The manifest written beside a dump. */
export function buildManifest(sql, meta = {}) {
  return {
    format: "parliament-pulse-d1-export/1",
    ...meta,
    bytes: Buffer.byteLength(sql, "utf8"),
    sha256: sha256(sql),
    statements: splitStatements(sql).length,
    tables: countRows(sql),
  };
}

/**
 * The restore verdict: compare the manifest's per-table counts with counts
 * measured on the restored database. Every manifest table must be present with
 * an equal count. Tables in `actual` that the manifest does not list (for
 * example one added by a migration re-applied after the restore) are reported
 * as `extra` but do not fail the check unless they hold rows.
 */
export function compareCounts(expected, actual) {
  const mismatches = [];
  for (const [table, want] of Object.entries(expected)) {
    const got = Object.prototype.hasOwnProperty.call(actual, table) ? Number(actual[table]) : null;
    if (got !== want) mismatches.push({ table, expected: want, actual: got });
  }
  const extra = Object.keys(actual).filter((t) => !(t in expected) && !isInternalTable(t));
  for (const t of extra) {
    if (Number(actual[t]) !== 0) mismatches.push({ table: t, expected: null, actual: Number(actual[t]) });
  }
  return { ok: mismatches.length === 0, mismatches, extra };
}

/** One SELECT that returns every table's row count as a single row. */
export function countQuery(tables) {
  const parts = tables.map((t) => `(SELECT COUNT(*) FROM "${t.replace(/"/g, '""')}") AS "${t.replace(/"/g, '""')}"`);
  return `SELECT ${parts.join(", ")};`;
}

/** UTC timestamp safe for a file name, for example 20260929T051200Z. */
export function utcStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
