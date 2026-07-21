// Release gate: the zero-fabrication scanner for Parliament Pulse.
//
// DESIGN PRINCIPLE (non-negotiable): this instrument must PROVE it can detect
// before it is allowed to report a clean result. Every run seeds a canary
// containing each banned pattern and asserts the scanner catches it. If the
// canary is not caught, the run ABORTS and reports FAIL, because a scanner
// that cannot detect is worse than no scanner: it manufactures false
// confidence. A "clean" result from this file is only admissible when the
// canary block immediately above it passed in the same run.
//
// Scope: the shipped bundle. Both the .jsx sources and the built .js artefacts
// are scanned, because Cloudflare Pages serves the .js and a fabrication that
// survives only in the built artefact still reaches the public.
//
// Run: node tests/release-gate.mjs
// Exit 0 = gate PASSED. Exit 1 = gate FAILED.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that reach the public. .assetsignore keeps docs and scripts out of the
// deploy, so this list is the shipped render layer plus the shell.
const SHIPPED = [
  "index.html",
  "data.jsx", "entities.jsx", "icons.jsx", "store.jsx", "shell.jsx", "pages.jsx", "app.jsx",
  "data.js", "entities.js", "icons.js", "store.js", "shell.js", "pages.js", "app.js",
];

// Each banned pattern is a specific fabrication found in the 2026-07-21 survey,
// or a class of invented content. A pattern here means: this exact string must
// never render to a member of the public, because it is invented parliamentary
// content on a provenance-first product.
const BANNED = [
  // Fabricated inquiry record (store.jsx InquiryDetail)
  { re: /Submissions close/i, why: "invented inquiry submission date" },
  { re: /30 August 2026/, why: "invented inquiry reporting date" },
  { re: /19 May 2026/, why: "invented inquiry submission deadline" },
  { re: /Any related matters/i, why: "invented terms of reference" },
  { re: /digital programs over \$100m/i, why: "invented inquiry scope" },
  { re: /\$100m/, why: "invented procurement threshold used across fabrications" },

  // Fabricated witness list (store.jsx HearingDetail)
  { re: /First Assistant Secretary/i, why: "invented hearing witness" },
  { re: /Industry peak body/i, why: "invented hearing witness" },

  // Fabricated QON scrutiny cluster (data.jsx QON_PATTERN)
  { re: /ANAO report tabled/i, why: "invented analytical trigger" },
  { re: /FY23[-–]24/, why: "invented question-on-notice text" },

  // Fabricated provenance/audit log (data.jsx SIGNALS provenance[])
  { re: /08:14:04/, why: "invented audit-log timestamp" },
  { re: /Attention = 0\.86/, why: "invented scoring log line" },

  // Fabricated statistic (pages.jsx)
  { re: /5 of 38/, why: "fabricated watchlist total" },

  // Fabricated legislative content
  { re: /state-level identity exchanges/i, why: "invented bill provision" },
  { re: /Negatived \(\d+/, why: "invented division tally" },

  // Fabricated news and member activity
  { re: /Speaker announces procedural changes/i, why: "invented news headline" },
  { re: /Lodged QON on digital procurement/i, why: "invented member activity" },

  // Time claims that are false by construction: a hardcoded "Today" claims a
  // hearing is happening today on every date the page is ever opened.
  { re: /"Today, \d{1,2}:\d{2}"/, why: "hardcoded 'Today' schedule claim" },
  { re: /Today, 10:00/, why: "hardcoded 'Today' schedule claim" },
];

function scan(text) {
  const hits = [];
  for (const b of BANNED) {
    if (b.re.test(text)) hits.push(b);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// CANARY GATE. Prove the instrument detects before trusting it to report clean.
// ---------------------------------------------------------------------------
let canaryFailures = 0;
for (const b of BANNED) {
  // Build a string that should trip exactly this pattern.
  const specimen = {
    "invented inquiry submission date": "Submissions close: 19 May 2026",
    "invented inquiry reporting date": "Reporting: by 30 August 2026",
    "invented inquiry submission deadline": "Submissions close 19 May 2026",
    "invented terms of reference": "4. Any related matters",
    "invented inquiry scope": "governance for digital programs over $100m",
    "invented procurement threshold used across fabrications": "programs over $100m since",
    "invented hearing witness": b.re.source.includes("First")
      ? "Department (First Assistant Secretary)" : "Industry peak body",
    "invented analytical trigger": "Trigger likely: ANAO report tabled 22 Apr",
    "invented question-on-notice text": "contracts since FY23-24",
    "invented audit-log timestamp": "08:14:04 · enrichment",
    "invented scoring log line": "Attention = 0.86 → HIGH",
    "fabricated watchlist total": "5 of 38 watchlisted",
    "invented bill provision": "scope expanded to cover state-level identity exchanges",
    "invented division tally": "Negatived (64-78)",
    "invented news headline": "Speaker announces procedural changes to question time",
    "invented member activity": "Lodged QON on digital procurement · 23 Apr",
    "hardcoded 'Today' schedule claim": b.re.source.includes("\\d{1,2}")
      ? 'when: "Today, 10:00"' : "Today, 10:00",
  }[b.why];

  if (specimen === undefined) {
    console.error(`CANARY BUILD ERROR: no specimen defined for "${b.why}"`);
    canaryFailures++;
    continue;
  }
  if (!b.re.test(specimen)) {
    console.error(`CANARY MISS: pattern /${b.re.source}/ failed to detect its own specimen: ${JSON.stringify(specimen)}`);
    canaryFailures++;
  }
}

// Seed a whole synthetic "file" containing every fabrication and confirm the
// scanner returns a hit for each one. This tests scan() end to end, rather
// than testing each regex in isolation.
const seededFile = [
  "Submissions close: 19 May 2026", "Reporting: by 30 August 2026",
  "4. Any related matters", "digital programs over $100m",
  "Department (First Assistant Secretary)", "Industry peak body",
  "Trigger likely: ANAO report tabled 22 Apr", "contracts since FY23-24",
  "08:14:04 · enrichment", "Attention = 0.86 → HIGH",
  "5 of 38 watchlisted", "state-level identity exchanges",
  "Negatived (64-78)", "Speaker announces procedural changes",
  "Lodged QON on digital procurement · 23 Apr", 'when: "Today, 10:00"',
].join("\n");

const seededHits = scan(seededFile);
if (seededHits.length !== BANNED.length) {
  const caught = new Set(seededHits.map(h => h.why));
  const missed = BANNED.filter(b => !caught.has(b.why));
  console.error(`CANARY FAIL: seeded file should trip all ${BANNED.length} patterns, tripped ${seededHits.length}.`);
  for (const m of missed) console.error(`  undetected: ${m.why}  /${m.re.source}/`);
  canaryFailures++;
}

if (canaryFailures > 0) {
  console.error("\nRELEASE GATE: FAIL (instrument self-test failed).");
  console.error("The scanner cannot prove it detects, so any clean result is inadmissible.");
  process.exit(1);
}
console.log(`Canary self-test PASSED: all ${BANNED.length} patterns detected their seeded specimen.`);

// ---------------------------------------------------------------------------
// THE ACTUAL SCAN
// ---------------------------------------------------------------------------
let findings = 0;
for (const file of SHIPPED) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`MISSING shipped file: ${file}`);
    findings++;
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  for (const hit of scan(text)) {
    // Report the line number so the fix is one click away.
    const lines = text.split(/\r?\n/);
    const n = lines.findIndex(l => hit.re.test(l));
    console.error(`FABRICATION  ${file}:${n + 1}  ${hit.why}  /${hit.re.source}/`);
    if (n >= 0) console.error(`             ${lines[n].trim().slice(0, 140)}`);
    findings++;
  }
}

// Sync check: a fabrication removed from .jsx but left in the built .js still
// ships. Catch a stale build, which is the specific failure mode this repo's
// dual .jsx/.js layout invites.
const PAIRS = ["data", "entities", "icons", "store", "shell", "pages", "app"];
for (const base of PAIRS) {
  const jsx = path.join(root, `${base}.jsx`);
  const js = path.join(root, `${base}.js`);
  if (!fs.existsSync(jsx) || !fs.existsSync(js)) continue;
  if (fs.statSync(jsx).mtimeMs > fs.statSync(js).mtimeMs + 1000) {
    console.error(`STALE BUILD  ${base}.js is older than ${base}.jsx. Run build-jsx.ps1 before shipping.`);
    findings++;
  }
}

if (findings > 0) {
  console.error(`\nRELEASE GATE: FAIL. ${findings} finding(s).`);
  process.exit(1);
}
console.log(`Scanned ${SHIPPED.length} shipped files against ${BANNED.length} fabrication patterns.`);
console.log("RELEASE GATE: PASSED. No known fabrication reaches the public bundle.");
