// WK-08 (DATA-09): the empty QON and member pipelines say why they are empty.
// Runs against a real in-memory SQLite with every migration applied.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/unavailable.test.mjs
//
// Measured to fail when the control is removed (scratch copy, 29 Sep 2026):
//  - restoring the old "qons table returned no rows" note fails the /state test;
//  - returning the raw query result from /qons and /members (no tableProvenance
//    spread) fails both endpoint tests and the restraint test (3 of 5);
//  - making tableProvenance return 'fixture' for every total of 0 (no
//    whole-table count) fails the "search miss is still live" test.

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { buildState, QONS_UNAVAILABLE_NOTE, MEMBERS_UNAVAILABLE_NOTE } = await import("../src/state.ts");
const { default: worker } = await import("../src/index.ts");

console.warn = () => {};
console.log = () => {};

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

function ctx() {
  return { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
}

async function get(e, path) {
  const res = await worker.fetch(new Request(`https://w.test${path}`), e, ctx());
  assert.equal(res.status, 200, `${path} answers 200`);
  return res.json();
}

test("notes name ParlInfo and the Senators' details feed, not a table name", () => {
  assert.match(QONS_UNAVAILABLE_NOTE, /ParlInfo/);
  assert.match(QONS_UNAVAILABLE_NOTE, /zero rows/);
  assert.match(MEMBERS_UNAVAILABLE_NOTE, /Senators' details/);
  assert.doesNotMatch(QONS_UNAVAILABLE_NOTE, /table returned/);
});

test("/state: an empty qons table is fixture, empty, with the ParlInfo note", async () => {
  const state = await buildState(env());
  const q = state.blocks.qons;
  assert.equal(q.provenance, "fixture");
  assert.deepEqual(q.items, []);
  assert.equal(q.note, QONS_UNAVAILABLE_NOTE);
});

test("/qons: empty table carries provenance fixture and the note", async () => {
  const body = await get(env(), "/qons");
  assert.deepEqual(body.rows, []);
  assert.equal(body.total, 0);
  assert.equal(body.provenance, "fixture");
  assert.equal(body.note, QONS_UNAVAILABLE_NOTE);
});

test("/members: empty table carries provenance fixture and the note", async () => {
  const body = await get(env(), "/members");
  assert.deepEqual(body.members, []);
  assert.equal(body.provenance, "fixture");
  assert.equal(body.note, MEMBERS_UNAVAILABLE_NOTE);
});

test("restraint: a search miss over a populated table is still live, with no note", async () => {
  const e = env();
  e.ARCHIVE.raw.prepare(
    `INSERT INTO qons (id, asked_at, member, chamber, target, question, hansard_url, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("q1", "2026-09-01T00:00:00Z", "Senator Test", "Senate", null, "About widgets", "https://parlinfo.aph.gov.au/x", "2026-09-01T00:00:00Z");
  const hit = await get(e, "/qons");
  assert.equal(hit.total, 1);
  assert.equal(hit.provenance, "live");
  assert.equal(hit.note, undefined);
  const miss = await get(e, "/qons?q=nomatchatall");
  assert.equal(miss.total, 0);
  assert.equal(miss.provenance, "live", "a filter that matches nothing is not a dead pipeline");
  assert.equal(miss.note, undefined);
});
