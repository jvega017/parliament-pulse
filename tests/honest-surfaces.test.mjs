// Honest-surfaces test (FE-03: UX-02, UX-10, UX-11, LEG-03).
//
// Renders the SHIPPED built .js (data, entities, icons, store, shell, pages)
// against a fixture /state payload, using a minimal React shim: createElement
// builds a plain tree, hooks return their initial values, and a tiny renderer
// walks function components to HTML. No DOM and no npm dependency, so it runs
// in `npm run gate` on any machine. It asserts:
//   (b) the Committees nav badge equals the committee items in /state (30), the
//       About ledger Signals count equals signals.items.length, and no badge
//       renders for the Threads (QON) or Daily program desks when their blocks
//       are empty;
//   (c) no retired overclaim or owner identity survives in the built bundle;
//   (d) an exported CSV carries the APH attribution line;
//   and the About activation matrix shows Bills as Live from the same counts.
//
// The fixture, shim, renderer and assertions live in honest-surfaces-lib.mjs
// (FE-11), shared with tests/global-scope.test.mjs, which runs the same render
// against the minified dist bundle.
//
// Canary: the same assertions run against a copy of shell.js with the old
// literal NAV count restored (committees count 7) and against a copy with the
// CSV attribution removed, and must FAIL there. A test that cannot fail proves
// nothing.
//
// Run: node tests/honest-surfaces.test.mjs   Exit 0 = pass, 1 = fail.

import { readModule } from "../scripts/build-config.mjs";
import { renderSurfaces, honestAssertions } from "./honest-surfaces-lib.mjs";

const FILES = ["data", "entities", "icons", "store", "shell", "pages"];
// "store" and "pages" are module groups since FE-11 split them (ARCH-11);
// readModule joins a group's built files in load order.
const read = f => readModule(f);

// Load the bundle (optionally with one module's source overridden) and render.
const run = (overrides = {}) => renderSurfaces(FILES.map(f => overrides[f] ?? read(f)));

let failures = 0;

// ---- canaries: the assertions must fail on broken copies -------------------------
const shellSrc = read("shell");
const pagesSrc = read("pages");
const canaries = [
  { why: "literal committees count restored", over: { shell: shellSrc.replace("committees: counts.committees,", "committees: 7,") } },
  { why: "Threads badge from a fixture count", over: { shell: shellSrc.replace("patterns: counts.threads,", "patterns: 1,") } },
  { why: "CSV attribution removed", over: { pages: pagesSrc.replace("[APH_ATTRIBUTION]]", "[]]") } },
  { why: "About ledger reads the empty fixture", over: { pages: pagesSrc.replace("value: dash(counts.signals)", "value: SIGNALS.length") } },
];
for (const c of canaries) {
  const changed = Object.entries(c.over).some(([k, v]) => v !== read(k));
  if (!changed) { console.error(`CANARY BUILD ERROR: mutation "${c.why}" did not apply; the source moved.`); failures++; continue; }
  if (honestAssertions(run(c.over)).length === 0) { console.error(`CANARY MISS: "${c.why}" passed the assertions.`); failures++; }
}
if (failures > 0) { console.error("HONEST SURFACES: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${canaries.length} seeded regressions each failed the assertions.`);

// ---- the real bundle ---------------------------------------------------------
const realOut = run();
if (process.env.PP_DEBUG) {
  console.log(realOut.sidebar.match(/<nav[\s\S]*?<\/nav>/)[0].replace(/<svg[\s\S]*?<\/svg>/g, ""));
  console.log(realOut.about.match(/data-module[^>]*>.*?coverage-state[^>]*>[^<]*/g));
  console.log(realOut.about.match(/data-metric[^>]*>.*?<strong>[^<]*/g));
  console.log(realOut.csv);
}
const real = honestAssertions(realOut);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }

// (c) retired strings must not survive in any built .js.
const RETIRED = /Juan Vega|QON pattern engine|0\.78 on embedding|run server-side, so matches land/;
for (const f of [...FILES, "app"]) {
  const hit = read(f).match(RETIRED);
  if (hit) { console.error(`FAIL  ${f}.js still contains retired text: ${hit[0]}`); failures++; }
}

if (failures > 0) { console.error(`\nHONEST SURFACES: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("HONEST SURFACES: PASSED. Counts are single-source, empty desks show no badge, no retired overclaim or owner identity ships, and CSV exports carry the APH attribution.");
