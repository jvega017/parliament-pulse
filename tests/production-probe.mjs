// Production probe: fetch the DEPLOYED Parliament Pulse site and assert that no
// known fabrication reaches a real visitor. This is the post-deploy verification
// for the truth deploy (LB-01): the local release gate proves the working tree is
// clean, this proves the thing actually on the public URL is clean.
//
// CANARY-FIRST (non-negotiable, same law as the release gate): before it is
// allowed to report production clean, the probe proves it can detect by scanning
// an archived PRE-SWEEP bundle that genuinely contains fabrications. If that
// archive does not trip the scanner on enough distinct patterns, the probe ABORTS.
// A probe that cannot detect manufactures false confidence, which is worse than no
// probe. A "production clean" result is only admissible when the canary above it
// fired in the same run.
//
// Fail-closed: if any shipped file cannot be fetched, the probe FAILS rather than
// declaring production clean, because an unverified surface is not a clean one.
//
// Usage:
//   node tests/production-probe.mjs [baseUrl]
//   PULSE_PROD_BASE=https://parliament-pulse.pages.dev node tests/production-probe.mjs
//   node tests/production-probe.mjs --canary-only   (runs the detection proof only, no network)
// Exit 0 = production clean (canary fired, all files fetched, zero fabrications).
// Exit 1 = fabrication live, or a fetch failed, or the canary failed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, scan } from "./fabrication-patterns.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const canaryOnly = args.includes("--canary-only");
const BASE = (args.find(a => !a.startsWith("--")) || process.env.PULSE_PROD_BASE || "https://parliament-pulse.pages.dev").replace(/\/+$/, "");

// The render layer Cloudflare Pages serves. The fabrications lived in the data
// and render modules; index.html anchors the shell.
const SHIPPED_URLS = ["index.html", "data.js", "store.js", "pages.js", "entities.js", "app.js", "shell.js"];

// Minimum distinct fabrication classes the archived bundle must trip for the
// probe to trust its own detection. The pre-sweep bundle contains many; require a
// solid margin so a partial archive still proves detection without being brittle.
const CANARY_MIN_DISTINCT = 5;

// ---------------------------------------------------------------------------
// CANARY: prove detection against a real pre-sweep bundle before trusting a clean.
// ---------------------------------------------------------------------------
const CANARY_FILE = path.join(root, "archive", "parliament-pulse-beta.html");
if (!fs.existsSync(CANARY_FILE)) {
  console.error(`CANARY ABORT: archived pre-sweep bundle not found at ${CANARY_FILE}.`);
  console.error("Without a specimen that contains fabrications, the probe cannot prove it detects.");
  process.exit(1);
}
const canaryHits = scan(fs.readFileSync(CANARY_FILE, "utf8"));
const canaryDistinct = new Set(canaryHits.map(h => h.why)).size;
if (canaryDistinct < CANARY_MIN_DISTINCT) {
  console.error(`CANARY FAIL: pre-sweep bundle tripped only ${canaryDistinct} distinct pattern(s), need >= ${CANARY_MIN_DISTINCT}.`);
  console.error("The scanner cannot prove it detects real fabrications, so any clean production result is inadmissible.");
  process.exit(1);
}
console.log(`Canary PASSED: the archived pre-sweep bundle tripped ${canaryDistinct} distinct fabrication classes; the scanner detects.`);

if (canaryOnly) {
  console.log("Canary-only mode: detection proven, no network probe run.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// THE ACTUAL PRODUCTION SCAN
// ---------------------------------------------------------------------------
console.log(`Probing ${BASE} across ${SHIPPED_URLS.length} shipped files.`);
let findings = 0;
let fetchFailures = 0;

for (const file of SHIPPED_URLS) {
  const url = `${BASE}/${file}`;
  let text;
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
    if (!res.ok) {
      console.error(`FETCH FAIL   ${url} -> HTTP ${res.status}`);
      fetchFailures++;
      continue;
    }
    text = await res.text();
  } catch (err) {
    console.error(`FETCH ERROR  ${url} -> ${err instanceof Error ? err.message : err}`);
    fetchFailures++;
    continue;
  }
  const hits = scan(text);
  for (const hit of hits) {
    console.error(`FABRICATION LIVE  ${url}  ${hit.why}  /${hit.re.source}/`);
    findings++;
  }
}

if (fetchFailures > 0) {
  console.error(`\nPRODUCTION PROBE: FAIL. ${fetchFailures} file(s) could not be fetched, so production is unverified (fail-closed).`);
  process.exit(1);
}
if (findings > 0) {
  console.error(`\nPRODUCTION PROBE: FAIL. ${findings} fabrication(s) are live on ${BASE}. Deploy the truth build.`);
  process.exit(1);
}
console.log(`\nPRODUCTION PROBE: PASSED. ${SHIPPED_URLS.length} shipped files on ${BASE} carry no known fabrication.`);
