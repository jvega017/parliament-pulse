// Production probe: fetch the DEPLOYED Parliament Pulse site and assert that no
// known fabrication reaches a real visitor, that production is byte-for-byte the
// local dist/ build, and that no internal file is served.
//
// FABRICATION SCAN (LB-01): the local release gate proves the working tree is
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
// DEPLOY INTEGRITY (FE-01): the probe also proves WHAT is deployed.
//   (a) Provenance: every file in the local dist/build-info.json (written by
//       build-dist.ps1) is fetched from production and its sha256 compared; any
//       drift fails. The deployed /build-info.json git_sha must match the local one.
//   (b) Denylist: internal notes, sources, scripts and stale bundles must answer
//       404 or only the not-found fallback page. Anything else fails.
//   (c) Self-canary: before any network call, the denylist verdict function is
//       fed a mocked 200 carrying README.md's real bytes and must call it EXPOSED,
//       while a mocked 404 and a fallback page must stay silent. Otherwise ABORT.
// Every request sends a browser user-agent: Pages returns 403 to a bare scripted UA.
//
// Fail-closed: if any file cannot be fetched, the probe FAILS rather than
// declaring production clean, because an unverified surface is not a clean one.
//
// Usage:
//   ./build-dist.ps1            (first: writes the local dist/build-info.json)
//   node tests/production-probe.mjs [baseUrl]
//   PULSE_PROD_BASE=https://parliament-pulse.pages.dev node tests/production-probe.mjs
//   node tests/production-probe.mjs --canary-only   (runs both detection proofs only, no network)
// Exit 0 = production clean (both canaries fired, all files fetched, zero
//          fabrications, no hash drift, no denylisted path served).
// Exit 1 = fabrication live, a fetch failed, drift, an exposed path, or a canary failed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, scan } from "./fabrication-patterns.mjs";
import { BROWSER_UA, DENYLIST, classifyDenied, compareProvenance } from "./deploy-probe-lib.mjs";

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
// CANARY 1: prove fabrication detection against a real pre-sweep bundle.
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

// ---------------------------------------------------------------------------
// CANARY 2: prove the denylist verdict detects a leak and stays silent on a 404.
// ---------------------------------------------------------------------------
{
  const readme = fs.readFileSync(path.join(root, "README.md"));
  const fallback = Buffer.from("<!doctype html><title>Parliament Pulse</title>");
  const leak = classifyDenied({ status: 200, body: readme }, readme, [fallback]);
  const gone = classifyDenied({ status: 404, body: Buffer.from("") }, readme, [fallback]);
  const spa = classifyDenied({ status: 200, body: fallback }, readme, [fallback]);
  if (!leak.exposed || gone.exposed || spa.exposed) {
    console.error("DENYLIST CANARY FAIL: the verdict did not flag README.md bytes as exposed, or flagged a 404 or the fallback page.");
    console.error(`  leak=${JSON.stringify(leak)} 404=${JSON.stringify(gone)} fallback=${JSON.stringify(spa)}`);
    process.exit(1);
  }
  console.log("Denylist canary PASSED: a mocked 200 carrying README.md is flagged EXPOSED; a 404 and the fallback page stay silent.");
}

if (canaryOnly) {
  console.log("Canary-only mode: detection proven, no network probe run.");
  process.exit(0);
}

async function get(url) {
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache", "user-agent": BROWSER_UA }, redirect: "follow" });
    return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// THE FABRICATION SCAN
// ---------------------------------------------------------------------------
console.log(`Probing ${BASE} across ${SHIPPED_URLS.length} shipped files.`);
let findings = 0;
let fetchFailures = 0;

for (const file of SHIPPED_URLS) {
  const url = `${BASE}/${file}`;
  const res = await get(url);
  if (res.error) {
    console.error(`FETCH ERROR  ${url} -> ${res.error}`);
    fetchFailures++;
    continue;
  }
  if (res.status < 200 || res.status >= 300) {
    console.error(`FETCH FAIL   ${url} -> HTTP ${res.status}`);
    fetchFailures++;
    continue;
  }
  for (const hit of scan(res.body.toString("utf8"))) {
    console.error(`FABRICATION LIVE  ${url}  ${hit.why}  /${hit.re.source}/`);
    findings++;
  }
}

// ---------------------------------------------------------------------------
// (a) DEPLOY PROVENANCE
// ---------------------------------------------------------------------------
let provenanceFailures = 0;
const readJson = buf => JSON.parse(buf.toString("utf8").replace(/^﻿/, ""));
const localInfoPath = path.join(root, "dist", "build-info.json");
if (!fs.existsSync(localInfoPath)) {
  console.error(`\nPROVENANCE FAIL: ${localInfoPath} not found. Run ./build-dist.ps1 first; without a local manifest drift cannot be measured (fail-closed).`);
  provenanceFailures++;
} else {
  const localInfo = readJson(fs.readFileSync(localInfoPath));
  console.log(`\nProvenance: local dist built from ${localInfo.git_sha}${localInfo.git_dirty ? " (dirty tree)" : ""} at ${localInfo.built_at}, ${Object.keys(localInfo.files).length} files.`);
  const remoteInfo = await get(`${BASE}/build-info.json`);
  let remoteParsed = null;
  if (!remoteInfo.error && remoteInfo.status === 200) {
    try { remoteParsed = readJson(remoteInfo.body); } catch { remoteParsed = null; }
  }
  if (!remoteParsed || !remoteParsed.git_sha || !remoteParsed.files) {
    console.error(`PROVENANCE FAIL  ${BASE}/build-info.json is missing or not a manifest (${remoteInfo.error || "HTTP " + remoteInfo.status}); production was not deployed from build-dist.ps1.`);
    provenanceFailures++;
  } else {
    console.log(`Deployed build-info.json: git_sha ${remoteParsed.git_sha}, built ${remoteParsed.built_at}.`);
    if (remoteParsed.git_sha !== localInfo.git_sha) {
      console.error(`PROVENANCE FAIL  deployed git_sha ${remoteParsed.git_sha} != local ${localInfo.git_sha}.`);
      provenanceFailures++;
    }
  }
  // The local manifest is the authority on what SHOULD be live; every file it
  // lists is fetched and hashed. Files only the deployed manifest lists fail too.
  const fetched = new Map();
  for (const f of Object.keys(localInfo.files)) fetched.set(f, await get(`${BASE}/${f}`));
  const drift = compareProvenance(localInfo, fetched);
  if (remoteParsed && remoteParsed.files) {
    for (const f of Object.keys(remoteParsed.files)) {
      if (!(f in localInfo.files)) drift.push({ file: f, reason: "listed in the deployed manifest but not in the local build" });
    }
  }
  for (const d of drift) console.error(`HASH DRIFT  /${d.file}  ${d.reason}`);
  provenanceFailures += drift.length;
  if (drift.length === 0) console.log(`Provenance: all ${fetched.size} manifest files are served byte for byte as built.`);
}

// ---------------------------------------------------------------------------
// (b) DENYLIST: internal files must not be served
// ---------------------------------------------------------------------------
console.log(`\nDenylist: ${DENYLIST.length} paths must answer 404 or only the not-found fallback.`);
// What Pages returns for a path it does not have: the SPA fallback (index.html,
// when no 404.html is deployed) or the 404 page. Only these bodies are benign.
const rootPage = await get(`${BASE}/`);
const missingPage = await get(`${BASE}/__pulse-probe-missing-${Date.now()}`);
const fallbacks = [rootPage, missingPage].filter(r => !r.error).map(r => r.body);
let exposedCount = 0;
for (const entry of DENYLIST) {
  const localPath = entry.local ? path.join(root, entry.local) : null;
  const localBody = localPath && fs.existsSync(localPath) ? fs.readFileSync(localPath) : null;
  const res = await get(`${BASE}${entry.path}`);
  const verdict = res.error
    ? { exposed: true, reason: `fetch error ${res.error}: unverifiable, treated as exposed` }
    : classifyDenied(res, localBody, fallbacks);
  if (verdict.exposed) {
    console.error(`EXPOSED     ${entry.path}  ${verdict.reason}`);
    exposedCount++;
  }
}
if (exposedCount === 0) console.log(`Denylist: none of the ${DENYLIST.length} paths is served.`);

// ---------------------------------------------------------------------------
// VERDICT
// ---------------------------------------------------------------------------
const reasons = [];
if (fetchFailures > 0) reasons.push(`${fetchFailures} shipped file(s) could not be fetched (fail-closed)`);
if (findings > 0) reasons.push(`${findings} fabrication(s) live`);
if (provenanceFailures > 0) reasons.push(`${provenanceFailures} provenance failure(s): production is not the local dist build`);
if (exposedCount > 0) reasons.push(`${exposedCount} internal path(s) exposed`);
if (reasons.length) {
  console.error(`\nPRODUCTION PROBE: FAIL on ${BASE}. ${reasons.join("; ")}.`);
  process.exit(1);
}
console.log(`\nPRODUCTION PROBE: PASSED. ${BASE} serves exactly the local dist build, carries no known fabrication (of ${BANNED.length} patterns) and exposes none of the ${DENYLIST.length} denylisted paths.`);
