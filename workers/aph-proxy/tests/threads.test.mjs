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
import { tokenize, buildTokenSet, jaccardSimilarity, assignThread, SIMILARITY_THRESHOLD } from "../src/threads.ts";

test("tokenize drops stopwords, short tokens, and punctuation", () => {
  const tokens = tokenize("The Senate Inquiry into Small Business Energy Relief Bill 2026");
  assert.ok(!tokens.includes("the"));
  assert.ok(!tokens.includes("into"));
  assert.ok(!tokens.includes("bill")); // dropped as near-universal in this corpus
  assert.ok(tokens.includes("senate"));
  assert.ok(tokens.includes("inquiry"));
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
  // intersection={alpha,beta}=2, union={alpha,beta,gamma,delta}=4 -> 2/4 = 0.5 exactly.
  const a = new Set(["alpha", "beta"]);
  const b = new Set(["alpha", "beta", "gamma", "delta"]);
  assert.equal(jaccardSimilarity(a, b), 0.5);
  assert.equal(SIMILARITY_THRESHOLD, 0.5);

  const existing = [{ thread_id: "thread:boundary", fingerprint: [...b] }];
  const result = assignThread(a, existing, "thread:new-boundary");
  assert.equal(result.created, false, "similarity exactly at the threshold must join, not create");
  assert.equal(result.thread_id, "thread:boundary");
});

test("threshold boundary: similarity just below SIMILARITY_THRESHOLD creates a new thread", () => {
  // intersection={alpha}=1, union={alpha,beta,gamma,delta,epsilon}=5 -> 1/5 = 0.2, well under 0.5.
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
