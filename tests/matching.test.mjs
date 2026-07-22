// Watchlist matching gate: proves match counts are not inflated by substring
// collisions, and that no watchlist advertises a keyword count it cannot back
// with real terms.
//
// WHY THIS EXISTS. The matcher used String.includes, so the term "ai" matched
// "said", "Australia", "chair" and "Chairman"; "state" matched "statement";
// "data" matched "update". Every watchlist match count on the public product was
// silently inflated. That is a fabricated statistic produced by a bug rather
// than by hand, and it is invisible to tests/release-gate.mjs, which scans for
// known fabricated STRINGS and cannot see a number that is wrong by arithmetic.
//
// CANARY-FIRST, per the standing rule that any "clean" report is void unless the
// instrument catches a seeded specimen in the same run. This file first proves
// it can detect substring inflation by running the OLD includes-based matcher
// against the collision corpus and asserting it reports a false positive. If the
// canary does not fire, the run aborts: an instrument that cannot detect must
// never report clean.
//
// Run: node tests/matching.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storeSrc = fs.readFileSync(path.join(root, "store.jsx"), "utf8");
const dataSrc = fs.readFileSync(path.join(root, "data.jsx"), "utf8");

// Extract the three declarations under test straight from the shipped source, so
// the test cannot drift from what actually ships.
function extract(src, startPattern, label) {
  const start = src.indexOf(startPattern);
  if (start === -1) throw new Error(`could not find ${label} in source (looked for: ${startPattern})`);
  // Walk braces from the first { after the start to find the balanced end.
  const openIdx = src.indexOf("{", start);
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${label}`);
}

const kwConst = extract(storeSrc, "const WATCHLIST_KEYWORDS =", "WATCHLIST_KEYWORDS");
const kwFn = extract(storeSrc, "function watchlistKeywords", "watchlistKeywords");
const reFn = extract(storeSrc, "function watchlistTermRegex", "watchlistTermRegex");
const matchFn = extract(storeSrc, "function watchlistMatches", "watchlistMatches");
const reMapDecl = "const WATCHLIST_TERM_RE = new Map();";

const sandbox = { SIGNALS: [], console };
vm.createContext(sandbox);
vm.runInContext([kwConst, kwFn, reMapDecl, reFn, matchFn].join("\n"), sandbox);
const { watchlistMatches, watchlistKeywords } = sandbox;

// A corpus of real-shaped titles that contain the COLLISION substrings but none
// of the actual terms as words. A correct matcher returns zero for every one.
const COLLISION_CORPUS = [
  { title: "Australia said the chairman would update the statement", tags: [] },
  { title: "The Chair said Australia's estate remains understated", tags: [] },
  { title: "Portfolio update: the candidate said nothing further", tags: [] },
  { title: "Certain aims contained in the mainstream data-free report", tags: [] },
];
// "ai" collides with said/Australia/chair/chairman/certain/aims/mainstream
// "state" collides with statement/estate/understated
// "data" collides with update/candidate  (note: the last row contains "data-free",
// which SHOULD match, since a hyphen is a word boundary; it is excluded below.)
const COLLISION_ONLY = COLLISION_CORPUS.slice(0, 3);

let failures = 0;

// ---------------------------------------------------------------------------
// CANARY: prove the instrument detects. Run the OLD substring matcher and
// assert it produces the false positives this gate exists to prevent.
// ---------------------------------------------------------------------------
function legacyIncludesMatcher(w, signals) {
  const terms = watchlistKeywords(w);
  return signals.filter(s => {
    const title = (s.title || "").toLowerCase();
    return terms.some(term => title.includes(term.toLowerCase()));
  });
}
const aiList = { name: "AI & automation" };
const stateList = { name: "Queensland federal signals" };

const canaryAi = legacyIncludesMatcher(aiList, COLLISION_ONLY).length;
const canaryState = legacyIncludesMatcher(stateList, COLLISION_ONLY).length;
if (canaryAi === 0 || canaryState === 0) {
  console.error("CANARY FAIL: the substring matcher did not produce the collisions this gate detects.");
  console.error(`  legacy 'ai' matches on collision corpus: ${canaryAi} (expected > 0)`);
  console.error(`  legacy 'state' matches on collision corpus: ${canaryState} (expected > 0)`);
  console.error("The instrument cannot prove it detects, so any clean result is inadmissible.");
  process.exit(1);
}
console.log(`Canary self-test PASSED: substring matcher produced ${canaryAi} false 'ai' and ${canaryState} false 'state' matches on the collision corpus, and the gate detects them.`);

// ---------------------------------------------------------------------------
// THE ACTUAL CHECKS
// ---------------------------------------------------------------------------

// 1. No false positives from collisions.
for (const list of [aiList, stateList, { name: "Data sharing & privacy" }]) {
  const hits = watchlistMatches(list, COLLISION_ONLY);
  if (hits.length > 0) {
    console.error(`INFLATED MATCH  "${list.name}" matched ${hits.length} collision-only title(s):`);
    for (const h of hits) console.error(`    ${h.title}`);
    failures++;
  }
}

// 2. True positives still match: the fix must not break real matching.
const TRUE_POSITIVES = [
  { list: "AI & automation", title: "Inquiry into AI assurance in regulated services" },
  { list: "AI & automation", title: "Report on automation in the public service" },
  { list: "Cyber security", title: "Cyber Security Legislation Amendment Bill" },
  { list: "Digital identity", title: "Digital ID Amendment (Assurance) Bill 2026" },
  { list: "Procurement", title: "Commonwealth procurement rules updated" },
  { list: "Queensland federal signals", title: "Brisbane infrastructure funding announced" },
];
for (const tp of TRUE_POSITIVES) {
  const hits = watchlistMatches({ name: tp.list }, [{ title: tp.title, tags: [] }]);
  if (hits.length !== 1) {
    console.error(`MISSED MATCH  "${tp.list}" failed to match a genuine title: "${tp.title}"`);
    failures++;
  }
}

// 3. No watchlist may advertise a keyword count it cannot back with real terms.
// The fixture previously hardcoded 24/18/21/14 against lists of 4 to 6 terms.
const literalCounts = [...dataSrc.matchAll(/name:\s*"([^"]+)",\s*keywords:\s*(\d+)/g)];
for (const [, name, n] of literalCounts) {
  const real = watchlistKeywords({ name }).length;
  console.error(`FABRICATED COUNT  "${name}" hardcodes keywords: ${n}, real term list holds ${real}`);
  failures++;
}

if (failures > 0) {
  console.error(`\nMATCHING GATE: FAIL. ${failures} finding(s).`);
  process.exit(1);
}
console.log(`Checked ${COLLISION_ONLY.length} collision titles, ${TRUE_POSITIVES.length} true positives, and every watchlist keyword count.`);
console.log("MATCHING GATE: PASSED. Match counts are word-boundary accurate and no count is hardcoded.");
