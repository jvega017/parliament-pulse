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
// Canary: the same assertions run against a copy of shell.js with the old
// literal NAV count restored (committees count 7) and against a copy with the
// CSV attribution removed, and must FAIL there. A test that cannot fail proves
// nothing.
//
// Run: node tests/honest-surfaces.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { ATTRIBUTION_TEXT } from "./attribution-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["data", "entities", "icons", "store", "shell", "pages"];
const read = f => fs.readFileSync(path.join(root, `${f}.js`), "utf8");

// ---- fixture /state ---------------------------------------------------------
const NOW = new Date().toISOString();
const COMMITTEE_FEEDS = ["Senate reports tabled", "New Senate inquiries", "Upcoming Senate hearings", "House committee inquiries", "Joint committee inquiries"];
const sig = (i, feed, kind) => ({
  guid: `https://www.aph.gov.au/fixture/${i}`, title: `Fixture item ${i}`, link: `https://www.aph.gov.au/fixture/${i}`,
  pub_date: NOW, feed_label: feed, source_group: "Senate", kind, attention: i % 3 === 0 ? "high" : "med", confidence: 3,
  scoring_explanation: "Fixture scoring.",
});
const committeeItems = Array.from({ length: 30 }, (_, i) => sig(i, COMMITTEE_FEEDS[i % COMMITTEE_FEEDS.length], "report"));
const otherItems = Array.from({ length: 4 }, (_, i) => sig(100 + i, "House media releases", "media"));
const FIXTURE_STATE = {
  meta: { generated_at: NOW, worker_version: "fixture", schema: "state-v1" },
  blocks: {
    signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items: [...committeeItems, ...otherItems] },
    connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks: [{ url: "https://www.aph.gov.au/house/rss/media_releases", checked_at: NOW, ok: 1, status: 200, error: null }] },
    threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [], note: "threads table returned no rows" },
    alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [], note: "none" },
    qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [], note: "qons table returned no rows" },
  },
};
const FIXTURE_BILLS = [{ id: "b1", title: "Fixture Bill 2026" }, { id: "b2", title: "Second Fixture Bill 2026" }];

// ---- React shim + renderer -----------------------------------------------------
function makeContext(storeRef, csvSink) {
  const Fragment = Symbol("Fragment");
  class Component { constructor(props) { this.props = props; this.state = {}; } setState() {} }
  const React = {
    Fragment, Component, StrictMode: Fragment,
    createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
    createContext: v => ({ _default: v }),
    useContext: () => storeRef.value,
    useState: init => [typeof init === "function" ? init() : init, () => {}],
    useMemo: fn => fn(), useCallback: fn => fn, useRef: v => ({ current: v }),
    useEffect: () => {}, useLayoutEffect: () => {}, useId: () => "id",
    memo: c => c, forwardRef: c => c,
  };
  const noopEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {}, click() {}, addEventListener() {} });
  const ctx = {
    React, console, Date, Math, JSON, Map, Set, Symbol, Promise, Array, Object, String, Number, RegExp, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { platform: "Win32", clipboard: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { hostname: "localhost", search: "", hash: "" },
    document: { createElement: noopEl, body: { appendChild() {} }, getElementById: () => null, addEventListener() {}, removeEventListener() {} },
    Blob: class { constructor(parts) { csvSink.push(parts.join("")); } },
    URL: { createObjectURL: () => "blob:fixture", revokeObjectURL: () => {} },
    fetch: () => new Promise(() => {}),
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
  };
  ctx.window = ctx;
  ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  return { ctx: vm.createContext(ctx), React };
}

function renderToString(el, React) {
  if (el == null || el === false || el === true) return "";
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.map(e => renderToString(e, React)).join("");
  const { type, props } = el;
  if (type === React.Fragment) return renderToString(props.children, React);
  if (typeof type === "function") {
    if (type.prototype && typeof type.prototype.render === "function") return renderToString(new type(props).render(), React);
    return renderToString(type(props), React);
  }
  const attrs = Object.entries(props)
    .filter(([k, v]) => k !== "children" && (typeof v === "string" || typeof v === "number"))
    .map(([k, v]) => ` ${k === "className" ? "class" : k}="${String(v).replace(/"/g, "&quot;")}"`).join("");
  return `<${type}${attrs}>${renderToString(props.children, React)}</${type}>`;
}

// Load the bundle (optionally with one file's source overridden) and render.
function run(overrides = {}) {
  const storeRef = { value: null };
  const csv = [];
  const { ctx, React } = makeContext(storeRef, csv);
  const src = FILES.map(f => overrides[f] ?? read(f)).join("\n;\n");
  vm.runInContext(src, ctx, { filename: "bundle.js" });
  const blocks = ctx.mapLiveBlocks(FIXTURE_STATE.blocks);
  storeRef.value = {
    state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
    liveState: { status: "ready", blocks, fetchedAt: Date.now(), isRefreshing: false },
    liveBills: { status: "ready", items: FIXTURE_BILLS, fetchedAt: Date.now(), isRefreshing: false },
    navigate: () => {}, toast: () => {}, openModal: () => {}, openSignal: () => {}, isWatched: () => false,
  };
  const h = React.createElement;
  const sidebar = renderToString(h(ctx.Sidebar, { page: "overview", onNavigate: () => {}, mobileOpen: false }), React);
  const footer = renderToString(h(ctx.SiteFooter, {}), React);
  const about = renderToString(h(ctx.PageAbout, {}), React);
  vm.runInContext(`exportRowsCSV(["id","title"], [["1","Fixture"]], "fixture.csv")`, ctx);
  return { sidebar, footer, about, csv: csv[0] || "" };
}

function navBadge(html, id) {
  const m = html.match(new RegExp(`data-nav-count="${id}">(\\d+)<`));
  return m ? Number(m[1]) : null;
}

function assertions(out) {
  const f = [];
  const signalsLen = FIXTURE_STATE.blocks.signals.items.length;
  if (navBadge(out.sidebar, "committees") !== 30) f.push(`committees nav badge is ${navBadge(out.sidebar, "committees")}, expected 30`);
  if (navBadge(out.sidebar, "bills") !== FIXTURE_BILLS.length) f.push(`bills nav badge is ${navBadge(out.sidebar, "bills")}, expected ${FIXTURE_BILLS.length}`);
  if (navBadge(out.sidebar, "patterns") !== null) f.push("Threads (QON) desk shows a badge although its block is empty");
  if (navBadge(out.sidebar, "parliament") !== null) f.push("Daily program desk shows a badge although no division block has rows");
  if (!/<span>Threads<\/span>/.test(out.sidebar)) f.push("nav label 'Threads' not rendered");
  if (/Juan Vega|>JV</.test(out.sidebar)) f.push("owner identity still rendered in the sidebar");
  if (!out.sidebar.includes("Prometheus Policy Lab · free beta")) f.push("sidebar foot does not read 'Prometheus Policy Lab · free beta'");
  const sigMetric = out.about.match(/data-metric="Signals">.*?<strong>([^<]*)<\/strong>/);
  if (!sigMetric || Number(sigMetric[1]) !== signalsLen) f.push(`About ledger Signals is ${sigMetric && sigMetric[1]}, expected ${signalsLen}`);
  const billsRow = out.about.match(/data-module="Bills intelligence">.*?class="coverage-state [^"]*">([^<]*)</);
  if (!billsRow || billsRow[1] !== "Live") f.push(`About activation matrix shows Bills as ${billsRow && billsRow[1]}, expected Live`);
  if (!out.footer.includes("Parliament of Australia website") || !out.footer.includes("https://creativecommons.org/licenses/by-nc-nd/4.0/")) f.push("site footer does not carry the attribution and licence link");
  if (!out.csv.includes(ATTRIBUTION_TEXT)) f.push("exported CSV does not contain the attribution line");
  return f;
}

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
  if (assertions(run(c.over)).length === 0) { console.error(`CANARY MISS: "${c.why}" passed the assertions.`); failures++; }
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
const real = assertions(realOut);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }

// (c) retired strings must not survive in any built .js.
const RETIRED = /Juan Vega|QON pattern engine|0\.78 on embedding|run server-side, so matches land/;
for (const f of [...FILES, "app"]) {
  const hit = read(f).match(RETIRED);
  if (hit) { console.error(`FAIL  ${f}.js still contains retired text: ${hit[0]}`); failures++; }
}

if (failures > 0) { console.error(`\nHONEST SURFACES: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("HONEST SURFACES: PASSED. Counts are single-source, empty desks show no badge, no retired overclaim or owner identity ships, and CSV exports carry the APH attribution.");
