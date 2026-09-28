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

export function sqliteD1({ migrations = true } = {}) {
  const db = new DatabaseSync(":memory:");
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
