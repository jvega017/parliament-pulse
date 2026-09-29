// The served Worker version equals package.json "version", on both surfaces
// a post-deploy probe reads: GET /healthz `version` and GET /state
// `meta.worker_version`. A bump that touches one declaration and not the
// other, or a hard-coded string left in a handler, fails here.
//
// Run: node --experimental-strip-types --experimental-sqlite tests/version.test.mjs

import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sqliteD1, memoryKv } from "./support/sqlite-d1.mjs";

register("./support/ts-resolve-hooks.mjs", import.meta.url);

const { default: worker } = await import("../src/index.ts");
const { WORKER_VERSION, STATE_CACHE_KEY } = await import("../src/version.ts");

console.warn = () => {};
console.log = () => {};
console.error = () => {};

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
const srcText = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

function env() {
  return { ALLOWED_ORIGINS: "", CACHE: memoryKv(), ARCHIVE: sqliteD1() };
}

function ctx() {
  return { pending: [], waitUntil(p) { this.pending.push(p); }, passThroughOnException() {} };
}

test("package.json declares a semver version", () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test("src/version.ts WORKER_VERSION equals package.json version", () => {
  assert.equal(WORKER_VERSION, pkg.version);
});

test("/healthz serves version equal to package.json version", async () => {
  const res = await worker.fetch(new Request("https://w.test/healthz"), env(), ctx());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).version, pkg.version);
});

test("/state serves meta.worker_version equal to package.json version", async () => {
  const res = await worker.fetch(new Request("https://w.test/state"), env(), ctx());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).meta.worker_version, pkg.version);
});

test("a /state body cached by the previous Worker is not served after a bump", async () => {
  const e = env();
  // What the 0.15.0 Worker wrote under its unversioned key.
  await e.CACHE.put("state:v2", JSON.stringify({ meta: { worker_version: "0.15.0" } }));
  const res = await worker.fetch(new Request("https://w.test/state"), e, ctx());
  assert.equal(res.headers.get("x-cache"), "MISS");
  assert.equal((await res.json()).meta.worker_version, pkg.version);
  assert.ok(STATE_CACHE_KEY.endsWith(pkg.version), "cache key carries the version");
});

test("no handler hard-codes a version string outside src/version.ts", () => {
  for (const rel of ["src/index.ts", "src/state.ts"]) {
    const text = srcText(rel);
    assert.doesNotMatch(text, /version:\s*"\d+\.\d+\.\d+"/, `${rel} hard-codes a served version`);
    assert.doesNotMatch(text, /WORKER_VERSION\s*=\s*"/, `${rel} redeclares WORKER_VERSION`);
  }
});
