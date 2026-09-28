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
import os from "node:os";
import { BANNED, scan } from "./fabrication-patterns.mjs";
import { JSX_FILES, compile } from "../scripts/build-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that reach the public. .assetsignore keeps docs and scripts out of the
// deploy, so this list is the shipped render layer plus the shell.
const SHIPPED = [
  "index.html",
  "data.jsx", "entities.jsx", "icons.jsx", "store.jsx", "shell.jsx", "pages.jsx", "app.jsx",
  "data.js", "entities.js", "icons.js", "store.js", "shell.js", "pages.js", "app.js",
];

// BANNED patterns and scan() now live in ./fabrication-patterns.mjs, shared with
// tests/production-probe.mjs so the local gate and the deployed-site probe can
// never drift apart on what counts as a fabrication.

// ---------------------------------------------------------------------------
// CANARY GATE. Prove the instrument detects before trusting it to report clean.
// ---------------------------------------------------------------------------
let canaryFailures = 0;
for (const b of BANNED) {
  // Each pattern carries its own specimen in fabrication-patterns.mjs, so a
  // pattern added without one fails here instead of passing untested.
  const specimen = b.canary;
  if (typeof specimen !== "string" || specimen.length === 0) {
    console.error(`CANARY BUILD ERROR: no specimen defined for "${b.why}" /${b.re.source}/`);
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
const seededFile = BANNED.map(b => b.canary || "").join("\n");

const seededHits = scan(seededFile);
if (seededHits.length !== BANNED.length) {
  const caught = new Set(seededHits.map(h => h.re));
  const missed = BANNED.filter(b => !caught.has(b.re));
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
// ships. Content-based (FE-02, replacing the old mtime comparison): rebuild
// every .jsx with the pinned esbuild and the exact flags of the real build into
// a temp directory, then byte-compare with the committed .js. mtime was both
// blind (a stale .js with a newer timestamp passed) and noisy (a clone, a
// checkout or a bare touch of a .jsx failed the gate with nothing changed).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pp-sync-"));
try {
  for (const base of JSX_FILES) {
    const js = path.join(root, `${base}.js`);
    if (!fs.existsSync(path.join(root, `${base}.jsx`)) || !fs.existsSync(js)) continue;
    const out = path.join(tmp, `${base}.js`);
    const r = compile(base, out);
    if (!r.ok) {
      console.error(`SYNC CHECK ERROR  could not rebuild ${base}.jsx: ${r.error}`);
      findings++;
      continue;
    }
    const expected = fs.readFileSync(out);
    const actual = fs.readFileSync(js);
    if (!expected.equals(actual)) {
      // Name the first differing line so the drift is one look away.
      const e = expected.toString("utf8").split("\n");
      const a2 = actual.toString("utf8").split("\n");
      let n = 0;
      while (n < Math.max(e.length, a2.length) && e[n] === a2[n]) n++;
      console.error(`CONTENT MISMATCH  ${base}.js does not match a fresh build of ${base}.jsx (first difference at line ${n + 1}). Run npm run build before shipping.`);
      findings++;
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`Sync check: ${JSX_FILES.length} .jsx files rebuilt with the pinned esbuild and byte-compared with the committed .js.`);

if (findings > 0) {
  console.error(`\nRELEASE GATE: FAIL. ${findings} finding(s).`);
  process.exit(1);
}
console.log(`Scanned ${SHIPPED.length} shipped files against ${BANNED.length} fabrication patterns.`);
console.log("RELEASE GATE: PASSED. No known fabrication reaches the public bundle.");
