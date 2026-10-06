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
import { AsyncLocalStorage } from "node:async_hooks";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations/", import.meta.url));

function norm(args) {
  return args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a));
}

// D1 platform limits this stand-in enforces (developers.cloudflare.com/d1/
// platform/limits, read 6 Oct 2026). Stock SQLite allows far more of each, so
// without these a query production rejects passes here (see the LIKE limit
// below). 0.16.9 added the first two.
//
// 0.16.10 enforces the third: "Queries per Worker invocation ... 1000
// (Workers Paid)", and each statement in a batch counts. The count is per
// SIMULATED INVOCATION. One shim instance often serves several invocations
// (a test seeds through one request and reads through another), so the
// count is kept per invocation, never per instance:
//   - inside `invocation(fn)`, every query fn makes, including work it hands
//     to ctx.waitUntil, counts against that call's own counter
//     (AsyncLocalStorage, so two invocations running at once do not share
//     one);
//   - outside it, queries count against the instance counter, which
//     `resetQueries()` restarts; a test marks an invocation boundary with it.
// The 1,001st query of an invocation throws, as production would refuse it.
export const D1_MAX_BOUND_PARAMS = 100;
export const D1_MAX_SQL_BYTES = 100_000;
export const D1_MAX_QUERIES_PER_INVOCATION = 1000;
export const D1_QUERY_LIMIT_MESSAGE = "Too many queries by single Worker invocation";

const invocationStore = new AsyncLocalStorage();

function checkLimits(sql, args) {
  if (args.length > D1_MAX_BOUND_PARAMS) {
    throw new Error(`too many SQL variables: ${args.length} bound, D1 allows ${D1_MAX_BOUND_PARAMS}`);
  }
  if (Buffer.byteLength(sql, "utf8") > D1_MAX_SQL_BYTES) {
    throw new Error("SQL statement too long");
  }
}

class Stmt {
  constructor(db, sql, args = [], counter = null) { this.db = db; this.sql = sql; this.args = args; this.counter = counter; }
  bind(...args) { return new Stmt(this.db, this.sql, norm(args), this.counter); }
  count() {
    checkLimits(this.sql, this.args);
    if (!this.counter) return;
    const c = invocationStore.getStore()?.get(this.counter) ?? this.counter;
    if (c.queries >= D1_MAX_QUERIES_PER_INVOCATION) {
      c.refused += 1;
      throw new Error(`${D1_QUERY_LIMIT_MESSAGE}: D1 allows ${D1_MAX_QUERIES_PER_INVOCATION}`);
    }
    c.queries += 1;
  }
  async run() {
    this.count();
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async all() {
    this.count();
    const rows = this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r }));
    return { success: true, results: rows, meta: {} };
  }
  async first(col) {
    this.count();
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
  const counter = { queries: 0, refused: 0 };
  return {
    raw: db,
    /** Statements executed through prepare() outside invocation() since the last reset (each batch member counts, as on D1). */
    get queries() { return counter.queries; },
    /** Queries refused at the per-invocation limit outside invocation() since the last reset. */
    get refused() { return counter.refused; },
    resetQueries() { counter.queries = 0; counter.refused = 0; },
    /**
     * Runs fn as one simulated Worker invocation with its own query count.
     * Resolves to { result, queries, refused } once fn settles; pass the
     * promises fn hands to ctx.waitUntil back through fn so they count too.
     */
    async invocation(fn) {
      const own = { queries: 0, refused: 0 };
      const map = new Map(invocationStore.getStore() ?? []);
      map.set(counter, own);
      const result = await invocationStore.run(map, fn);
      return { result, queries: own.queries, refused: own.refused };
    },
    prepare(sql) { return new Stmt(db, sql, [], counter); },
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
