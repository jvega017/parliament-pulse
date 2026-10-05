// Unit tests for the pure tokeniser + thread matcher in ../src/threads.ts.
//
// Run: node --experimental-strip-types tests/threads.test.mjs
// (or: npm test)
//
// Node's built-in test runner + TS type-stripping (Node >=22.6, stable flag
// name may vary by Node version) let this import the .ts source directly --
// no build step, no ts-node/tsx dependency, matching the repo's "no test
// framework yet" state. A MODULE_TYPELESS_PACKAGE_JSON warning on stderr is
// expected and harmless (package.json intentionally has no "type" field,
// since wrangler's own bundler resolves the Worker's TS independently of it).

import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, buildTokenSet, jaccardSimilarity, assignThread, assignThreadKeyed, canonicalThreadKey, SIMILARITY_THRESHOLD } from "../src/threads.ts";

test("tokenize drops stopwords, short tokens, and punctuation", () => {
  const tokens = tokenize("The Senate Inquiry into Small Business Energy Relief Bill 2026");
  assert.ok(!tokens.includes("the"));
  assert.ok(!tokens.includes("into"));
  assert.ok(!tokens.includes("bill")); // dropped as near-universal in this corpus
  assert.ok(tokens.includes("senate"));
  assert.ok(!tokens.includes("inquiry")); // 0.16.3: committee vocabulary is a stopword
  assert.ok(tokens.includes("business"));
  assert.ok(tokens.includes("energy"));
  assert.ok(tokens.includes("relief"));
});

test("jaccardSimilarity of identical sets is 1", () => {
  const a = new Set(["energy", "relief", "business"]);
  assert.equal(jaccardSimilarity(a, new Set(a)), 1);
});

test("jaccardSimilarity is 0 whenever either set is empty", () => {
  assert.equal(jaccardSimilarity(new Set(), new Set(["x"])), 0);
  assert.equal(jaccardSimilarity(new Set(["x"]), new Set()), 0);
  assert.equal(jaccardSimilarity(new Set(), new Set()), 0);
});

test("exact-duplicate title joins the existing thread", () => {
  const title = "Small Business Energy Bill Relief Amendment 2026";
  const seedTokens = buildTokenSet(title);
  const existing = [{ thread_id: "thread:seed-1", fingerprint: [...seedTokens] }];

  const dupeTokens = buildTokenSet(title); // same title arrives again from a different feed
  const result = assignThread(dupeTokens, existing, "thread:new-2");

  assert.equal(result.created, false);
  assert.equal(result.thread_id, "thread:seed-1");
  assert.equal(result.similarity, 1);
});

test("an unrelated title creates a new thread", () => {
  const existing = [{
    thread_id: "thread:seed-1",
    fingerprint: [...buildTokenSet("Small Business Energy Bill Relief Amendment 2026")],
  }];

  const unrelated = buildTokenSet("Fisheries Export Licensing Reform Torres Strait Inquiry");
  const result = assignThread(unrelated, existing, "thread:new-3");

  assert.equal(result.created, true);
  assert.equal(result.thread_id, "thread:new-3");
  assert.equal(result.similarity, 0);
  assert.deepEqual(result.fingerprint, [...unrelated]);
});

test("threshold boundary: similarity exactly at SIMILARITY_THRESHOLD joins", () => {
  // 0.16.3: threshold 0.6. intersection={alpha,beta,gamma}=3,
  // union={alpha,beta,gamma,delta,epsilon}=5 -> 3/5 = 0.6 exactly.
  const a = new Set(["alpha", "beta", "gamma"]);
  const b = new Set(["alpha", "beta", "gamma", "delta", "epsilon"]);
  assert.equal(jaccardSimilarity(a, b), 0.6);
  assert.equal(SIMILARITY_THRESHOLD, 0.6);

  const existing = [{ thread_id: "thread:boundary", fingerprint: [...b] }];
  const result = assignThread(a, existing, "thread:new-boundary");
  assert.equal(result.created, false, "similarity exactly at the threshold must join, not create");
  assert.equal(result.thread_id, "thread:boundary");
});

test("threshold boundary: similarity just below SIMILARITY_THRESHOLD creates a new thread", () => {
  // intersection={alpha}=1, union={alpha,beta,gamma,delta,zeta}=5 -> 1/5 = 0.2, well under 0.6.
  const a = new Set(["alpha", "zeta"]);
  const b = new Set(["alpha", "beta", "gamma", "delta"]);
  assert.ok(jaccardSimilarity(a, b) < SIMILARITY_THRESHOLD);

  const existing = [{ thread_id: "thread:boundary", fingerprint: [...b] }];
  const result = assignThread(a, existing, "thread:new-below");
  assert.equal(result.created, true);
  assert.equal(result.thread_id, "thread:new-below");
});

test("empty title is safe: no tokens, never joins an existing thread, creates its own empty-fingerprint thread", () => {
  const existing = [{
    thread_id: "thread:seed-1",
    fingerprint: [...buildTokenSet("Small Business Energy Bill Relief Amendment 2026")],
  }];

  const emptyTokens = buildTokenSet("");
  const result = assignThread(emptyTokens, existing, "thread:new-empty");

  assert.equal(result.created, true);
  assert.equal(result.thread_id, "thread:new-empty");
  assert.deepEqual(result.fingerprint, []);

  // And a second empty-title item must NOT join the first empty-title thread either.
  const secondEmpty = buildTokenSet("", null);
  const secondResult = assignThread(secondEmpty, [
    ...existing,
    { thread_id: result.thread_id, fingerprint: result.fingerprint },
  ], "thread:new-empty-2");
  assert.equal(secondResult.created, true);
  assert.equal(secondResult.thread_id, "thread:new-empty-2");
});

test("fingerprint union is capped at MAX_FINGERPRINT_TOKENS on join", async () => {
  const { MAX_FINGERPRINT_TOKENS } = await import("../src/threads.ts");
  const bigFingerprint = Array.from({ length: MAX_FINGERPRINT_TOKENS }, (_, i) => `token${i}`);
  const existing = [{ thread_id: "thread:big", fingerprint: bigFingerprint }];
  // Overlap enough of bigFingerprint to clear the threshold, plus a few new tokens.
  const overlap = bigFingerprint.slice(0, 20);
  const itemTokens = new Set([...overlap, "newtoken1", "newtoken2"]);
  const result = assignThread(itemTokens, existing, "thread:new-cap");
  assert.equal(result.created, false);
  assert.ok(result.fingerprint.length <= MAX_FINGERPRINT_TOKENS);
});

// ---- 0.16.3: canonical keys and title-only matching (data review 5 Oct 2026) ----
// Titles and links below are copied from the live /state of 5 Oct 2026.

const SENATE = "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate";

test("0.16.3 key: same-title reports from different committees get different keys", () => {
  const a = canonicalThreadKey("Annual reports (No. 2 of 2026)", `${SENATE}/Economics/Annualreports2_2026`, "report");
  const b = canonicalThreadKey("Annual reports (No. 2 of 2026)", `${SENATE}/Finance_and_Public_Administration/Annualreports2_2026`, "report");
  assert.ok(a && b);
  assert.notEqual(a, b);
});

test("0.16.3 key: a hearing and a report of one inquiry share a key", () => {
  const hearing = canonicalThreadKey("Income management - review 2", `${SENATE}/Community_Affairs/Incomemanagementr2/Public_Hearings`, "hearing");
  const report = canonicalThreadKey("Income management - review 2", `${SENATE}/Community_Affairs/Incomemanagementr2`, "report");
  assert.equal(hearing, "key:inquiry/senate/community_affairs/incomemanagementr2");
  assert.equal(hearing, report);
});

test("0.16.3 key: procedural divisions are never merged; bill divisions share the bill", () => {
  const d289 = canonicalThreadKey("Division 289 - Suspension of standing and sessional orders: That the motion be agreed to", "https://www.aph.gov.au/divisions/Details?id=2813", "division");
  const d288 = canonicalThreadKey("Division 288 - Suspension of standing and sessional orders: That the motion be agreed to", "https://www.aph.gov.au/divisions/Details?id=2812", "division");
  assert.equal(d289, "key:division/2813");
  assert.notEqual(d289, d288);
  const t = "Private Health Insurance Amendment (Modernising the Private Health Insurance Rebate) Bill 2026";
  const d286 = canonicalThreadKey(`Division 286 - ${t}: Second reading: That the bill be now read a second time`, "https://www.aph.gov.au/divisions/Details?id=2810", "division");
  const d285 = canonicalThreadKey(`Division 285 - ${t}: Consideration in detail: That the amendments be agreed to`, "https://www.aph.gov.au/divisions/Details?id=2809", "division");
  const digest = canonicalThreadKey(t, "https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=x", "digest");
  assert.equal(d286, d285);
  assert.equal(d286, digest, "a division on a bill joins that bill's digest");
});

test("0.16.3 key: different Treasury Laws bills get different keys", () => {
  const a = canonicalThreadKey("Treasury Laws Amendment (Financial Reporting System Reform) Bill 2026", "https://parlinfo.aph.gov.au/a", "digest");
  const b = canonicalThreadKey("Treasury Laws Amendment (Tax Reform No. 2) Bill 2026", "https://parlinfo.aph.gov.au/b", "digest");
  assert.notEqual(a, b);
});

test("0.16.3 assign: a keyed item never joins a thread by word overlap", () => {
  const key = canonicalThreadKey("Budget Estimates 2026–27", `${SENATE}/Economics/Budget2026-27`, "report");
  const other = [{ thread_id: "t2:other", fingerprint: ["key:inquiry/senate/community_affairs/budget2026-27", ...buildTokenSet("Budget Estimates 2026–27")] }];
  const r = assignThreadKeyed(buildTokenSet("Budget Estimates 2026–27"), key, other, "t2:new");
  assert.equal(r.created, true, "identical title, different committee: a new thread");
  assert.equal(r.fingerprint[0], key, "the key leads the fingerprint");
  const same = assignThreadKeyed(buildTokenSet("Budget Estimates 2026–27"), key, [{ thread_id: "t2:new", fingerprint: r.fingerprint }], "t2:x");
  assert.equal(same.created, false);
  assert.equal(same.thread_id, "t2:new");
});

test("0.16.3 tokens: committee vocabulary is a stopword and descriptions are ignored", () => {
  assert.deepEqual(tokenize("Standing Committee on Education Inquiry Annual Report Review"), ["education"]);
  assert.deepEqual([...buildTokenSet("Hemp industry", "Rural and Regional Affairs Committee have tabled a report")], ["hemp", "industry"]);
});

test("0.16.3 assign: an unkeyed item still joins by title overlap at 0.6", () => {
  const existing = [{ thread_id: "t2:a", fingerprint: ["key:inquiry/house/economics/rba", "reserve", "bank", "australia", "rba"] }];
  const r = assignThreadKeyed(new Set(["reserve", "bank", "australia"]), null, existing, "t2:b");
  assert.equal(r.created, false, "3/4 word overlap joins; the key token is not counted");
  assert.equal(r.fingerprint[0], "key:inquiry/house/economics/rba", "the joined thread keeps its key");
});
