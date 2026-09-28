// Fabrication scanner self-test: proves tests/fabrication-patterns.mjs both
// DETECTS and stays SILENT, offline, before any gate trusts a clean scan.
//
//  1. Detection: every banned pattern trips on its own canary.
//  2. Restraint: honest copy the app legitimately ships (dated-feed wording,
//     "no records" empty states, sourced dates) trips nothing. A scanner that
//     flags honest copy gets switched off, which is as bad as one that misses.
//  3. Real specimen: the archived pre-sweep bundle (archive/parliament-pulse-
//     beta.html), which genuinely contains fabrications, still trips at least
//     CANARY_MIN_DISTINCT distinct classes. This is the same specimen the
//     production probe uses, checked here without the network.
//  4. Sitting-date regression (FE-02): the exact constructs the 5 Sep audit
//     removed are caught, each by the pattern written for it.
//
// Run: node tests/fabrication-selftest.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, scan } from "./fabrication-patterns.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANARY_MIN_DISTINCT = 5;
let failures = 0;
const fail = (m) => { console.error(`FAIL  ${m}`); failures++; };

// 1. Detection
let detected = 0;
for (const b of BANNED) {
  if (typeof b.canary !== "string" || !b.canary) { fail(`no canary for "${b.why}" /${b.re.source}/`); continue; }
  if (b.re.test(b.canary)) detected++;
  else fail(`/${b.re.source}/ missed its own canary ${JSON.stringify(b.canary)}`);
}

// 2. Restraint
const HONEST = [
  "No divisions records are available in this app for the House. This does not establish whether the chamber is sitting. Check the official source for current proceedings.",
  "Parliament returns according to the official sitting calendar. See aph.gov.au.",
  "Sitting calendar: source aph.gov.au, fetched 2026-09-29.",
  "const nextSitting = state.calendar?.next ?? null;",
  "Divisions resume when the chamber next sits.",
  "Today",
  "Updated 11:05 from the live feed",
];
for (const h of HONEST) {
  const hits = scan(h);
  if (hits.length) fail(`false positive on honest copy ${JSON.stringify(h)}: ${hits.map(x => x.why).join(", ")}`);
}

// 3. Real specimen
const archive = path.join(root, "archive", "parliament-pulse-beta.html");
let distinct = 0;
if (!fs.existsSync(archive)) fail(`archived pre-sweep bundle missing: ${archive}`);
else {
  distinct = new Set(scan(fs.readFileSync(archive, "utf8")).map(h => h.why)).size;
  if (distinct < CANARY_MIN_DISTINCT) fail(`archived bundle tripped ${distinct} distinct classes, need >= ${CANARY_MIN_DISTINCT}`);
}

// 4. Sitting-date regression: the removed constructs, each caught by its own rule.
const REGRESSION = [
  ['const NEXT_SITTING_DATE = "11 August 2026";', "hardcoded next-sitting-date constant"],
  ["Divisions resume when Parliament returns on 11 August 2026.", "hardcoded Parliament return date"],
  ["No hearings are listed until Parliament returns on ${NEXT_SITTING_DATE}.", "hardcoded recess-until copy"],
];
for (const [text, why] of REGRESSION) {
  if (!scan(text).some(h => h.why === why)) fail(`sitting-date regression not caught by "${why}": ${JSON.stringify(text)}`);
}

if (failures) {
  console.error(`\nFABRICATION SELF-TEST: FAIL (${failures}).`);
  process.exit(1);
}
console.log(`FABRICATION SELF-TEST: PASSED. ${detected}/${BANNED.length} canaries detected; ${HONEST.length} honest specimens silent; archived pre-sweep bundle tripped ${distinct} distinct classes; ${REGRESSION.length} sitting-date regressions caught.`);
