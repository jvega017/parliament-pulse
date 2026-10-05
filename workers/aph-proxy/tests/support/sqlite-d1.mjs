// A D1Database stand-in backed by a real in-memory SQLite (node:sqlite), with
// every file in ../../migrations applied in order. Used by tests that need
// SQL semantics to be real: ON CONFLICT, RETURNING, GROUP BY, and in
// particular last_insert_rowid(), which is what the pre-29-Sep-2026 new-row
// test in archive.ts relied on. A hand-rolled mock that returned canned
// `meta` would have encoded the bug's assumption instead of testing it.
//
// Surface implemented: prepare(sql).bind(...).{run,all,first}, batch, exec.
// Only what the Worker source calls.

import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations/", import.meta.url));

function norm(args) {
  return args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a));
}

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, norm(args)); }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async all() {
    const rows = this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r }));
    return { success: true, results: rows, meta: {} };
  }
  async first(col) {
    const row = this.db.prepare(this.sql).get(...this.args);
    if (!row) return null;
    return col ? row[col] ?? null : { ...row };
  }
}

// D1 caps a LIKE or GLOB pattern at 50 bytes (SQLITE_LIMIT_LIKE_PATTERN_LENGTH
// = 50) and fails the whole statement with "LIKE or GLOB pattern too complex".
// Stock SQLite allows 50,000, so before 0.16.4 this stand-in passed queries
// that production rejected: a thread key or search term over about 48 bytes
// (review of 5 Oct 2026: 153 of 178 signals failed to thread locally, and
// /archive?q=<long> returned 503). like() is overridden here so every LIKE,
// bound or literal, is held to D1's limit, then evaluated with SQLite's own
// semantics: % any run, _ one character, ASCII-only case folding, optional
// single-character ESCAPE.
export const D1_LIKE_PATTERN_MAX_BYTES = 50;

function asciiLower(s) {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function likeToRegExp(pattern, escape) {
  let re = "";
  const chars = [...pattern];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (escape !== null && c === escape && i + 1 < chars.length) {
      re += chars[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (c === "%") re += "[\\s\\S]*";
    else if (c === "_") re += "[\\s\\S]";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "u");
}

export function d1Like(pattern, value, escape = null) {
  if (pattern === null || value === null || pattern === undefined || value === undefined) return null;
  const p = String(pattern);
  if (Buffer.byteLength(p, "utf8") > D1_LIKE_PATTERN_MAX_BYTES) {
    throw new Error("LIKE or GLOB pattern too complex");
  }
  const esc = escape === null || escape === undefined ? null : String(escape);
  return likeToRegExp(asciiLower(p), esc === null ? null : asciiLower(esc)).test(asciiLower(String(value))) ? 1 : 0;
}

export function sqliteD1({ migrations = true } = {}) {
  const db = new DatabaseSync(":memory:");
  db.function("like", { deterministic: true }, (p, v) => d1Like(p, v));
  db.function("like", { deterministic: true }, (p, v, e) => d1Like(p, v, e));
  if (migrations) {
    for (const f of readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql")).sort()) {
      db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    }
  }
  return {
    raw: db,
    prepare(sql) { return new Stmt(db, sql); },
    async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
    async exec(sql) { db.exec(sql); return { count: 1, duration: 0 }; },
  };
}

export function memoryKv() {
  const m = new Map();
  return {
    async get(k, type) { const v = m.has(k) ? m.get(k) : null; return type === "json" && v ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
  };
}
