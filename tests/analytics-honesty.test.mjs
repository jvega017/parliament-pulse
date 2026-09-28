// Analytics honesty (FE-06: UX-03, PR-11, DATA-12, DATA-14, DATA-15, UX-08).
//
// Renders the SHIPPED built .js with the same minimal React shim as
// freshness.test.mjs and asserts the strings a viewer reads:
//   uniform   every bill MEDIUM and Confidence 2: the Bills table has no
//             Attention or Confidence column and shows "All N items currently
//             score Medium attention; the score does not yet separate them."
//             Every signal MEDIUM: the inbox and the Activity-by-source desk
//             hide attention and show the same line.
//   mixed     mixed attention and confidence: the columns render, and
//             confidence reads "Confidence n of 5", never a bare n/5 or a bar.
//   radar     the Activity-by-source desk names Source group, Items and Feeds
//             and contains none of "momentum", "issue" or "suggested action".
//   disclose  every attention badge carries the heuristic disclosure as its
//             tooltip, naming the Worker's dimensions, and About has the
//             paragraph.
//   scope     the Bills page-sub names the Bills Digest scope and links to the
//             APH bills search.
//   action    a live signal (action "") carries no "Recommended action" in its
//             brief.
//   search    the palette, rendered with a fixture bill title as its query,
//             returns a Bills group from the live /bills cache, labels each
//             group with its real scope, and has no Members group.
//
// Canary: each assertion group runs against scratch copies of the built .js
// with its control removed and must FAIL there; the honest build must pass.
//
// Run: node tests/analytics-honesty.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["data", "entities", "icons", "store", "shell", "pages"];
const read = f => fs.readFileSync(path.join(root, `${f}.js`), "utf8");

// ---- fixtures ------------------------------------------------------------------
const NOW = new Date().toISOString();
const bill = (n, attention, confidence) => ({
  guid: `https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22legislation%2Fbillsdgs%2Ffx${n}%22`,
  title: `Fixture Harbour Safety Amendment Bill 2026 number ${n}`,
  link: `https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22legislation%2Fbillsdgs%2Ffx${n}%22`,
  pub_date: NOW, description: null, attention, confidence,
});
const BILLS_UNIFORM = [bill(1, "med", 2), bill(2, "med", 2), bill(3, "med", 2)];
const BILLS_MIXED = [bill(1, "med", 2), bill(2, "high", 3), bill(3, "low", 2)];
const SEARCH_TERM = "harbour safety amendment";

const sig = (id, group, attention, confidence, extra) => ({
  guid: `https://www.aph.gov.au/fe06/${id}`, title: `Analytics item ${id}`, link: `https://www.aph.gov.au/fe06/${id}`,
  pub_date: NOW, first_seen_at: NOW, feed_label: `${group} feed ${id % 2}`, source_group: group, kind: "hearing",
  attention, confidence,
  scoring_explanation: "Medium attention (50/100). Source: hearing (authority 85/100). Published today. Scored on authority, recency, novelty, scrutiny.",
  ...extra,
});
const SIGNALS_UNIFORM = [sig(1, "Senate", "med", 3), sig(2, "Senate", "med", 3), sig(3, "House", "med", 3)];
const SIGNALS_MIXED = [sig(1, "Senate", "high", 3), sig(2, "Senate", "med", 2), sig(3, "House", "low", 1)];
const blocks = items => ({
  signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items },
  connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks: [] },
  threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [] },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
});
const META = { generated_at: NOW, worker_version: "fixture", schema: "state-v1" };
const VARIANTS = {
  uniform: { signals: SIGNALS_UNIFORM, bills: BILLS_UNIFORM },
  mixed: { signals: SIGNALS_MIXED, bills: BILLS_MIXED },
};

// ---- React shim + renderer ---------------------------------------------------------
// seed: when set, useState("") returns seed.q and useState(false) returns true, so
// the Topbar renders with its search open on a query. Only the palette run seeds.
function makeContext(storeRef, seed) {
  const Fragment = Symbol("Fragment");
  class Component { constructor(props) { this.props = props; this.state = {}; } setState() {} }
  const React = {
    Fragment, Component, StrictMode: Fragment,
    createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
    createContext: v => ({ _default: v }),
    useContext: () => storeRef.value,
    useState: init => {
      if (seed && init === "") return [seed.q, () => {}];
      if (seed && init === false) return [true, () => {}];
      return [typeof init === "function" ? init() : init, () => {}];
    },
    useMemo: fn => fn(), useCallback: fn => fn, useRef: v => ({ current: v }),
    useEffect: () => {}, useLayoutEffect: () => {}, useId: () => "id",
    memo: c => c, forwardRef: c => c, cloneElement: (el, extra) => ({ ...el, props: { ...el.props, ...extra } }),
  };
  const noopEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {}, click() {}, addEventListener() {} });
  const ctx = {
    React, console, Date, Math, JSON, Map, Set, Symbol, Promise, Array, Object, String, Number, RegExp, Error, Intl,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { platform: "Win32", clipboard: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { hostname: "localhost", search: "", hash: "", protocol: "https:" },
    document: { createElement: noopEl, body: { appendChild() {} }, getElementById: () => null, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} } },
    Blob: class { constructor() {} },
    URL: Object.assign(class extends URL {}, { createObjectURL: () => "blob:test", revokeObjectURL: () => {} }),
    fetch: () => new Promise(() => {}),
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
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
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

function run(variant, overrides = {}, seed = null) {
  const storeRef = { value: null };
  const { ctx, React } = makeContext(storeRef, seed);
  const src = FILES.map(f => overrides[f] ?? read(f)).join("\n;\n");
  vm.runInContext(src, ctx, { filename: "bundle.js" });
  const v = VARIANTS[variant];
  const mapped = ctx.mapLiveBlocks(JSON.parse(JSON.stringify(blocks(v.signals))), META);
  storeRef.value = {
    state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
    liveState: { status: "ready", meta: META, blocks: mapped, fetchedAt: Date.now(), isRefreshing: false },
    liveBills: { status: "ready", items: JSON.parse(JSON.stringify(v.bills)), fetchedAt: Date.now(), isRefreshing: false },
    navigate: () => {}, toast: () => {}, openModal: () => {}, openSignal: () => {}, closeSignal: () => {},
    isWatched: () => false, addFeed: () => {}, requestLiveRefresh: () => {}, consumeLiveRefresh: () => false,
    refreshLiveState: () => Promise.resolve(), setSignalSearchQuery: () => {}, setVisibleSignalOrder: () => {},
    signalSearchQuery: "", modal: null, signalId: null,
  };
  const h = React.createElement;
  const r = (C, p = {}) => renderToString(h(C, p), React);
  if (seed) return { topbar: r(ctx.Topbar, { mobileNavOpen: false, setMobileNavOpen: () => {} }) };
  const liveSig = mapped.signals.items[0];
  return {
    bills: r(ctx.PageBills),
    signals: r(ctx.PageSignals),
    radar: r(ctx.PageRadar),
    about: r(ctx.PageAbout),
    briefMd: ctx.generateBriefMarkdown(liveSig, true),
    liveAction: liveSig.action,
  };
}

// ---- assertion groups ------------------------------------------------------------
const LINE = (n, level) => `All ${n} items currently score ${level}; the score does not yet separate them.`;
const DISCLOSURE = "Attention is a transparent heuristic (source authority, recency, novelty and scrutiny keyword match). It has not yet been validated against practitioner judgement.";
const thead = html => (html.match(/<thead>[\s\S]*?<\/thead>/) || [""])[0];

const GROUPS = {
  // Test (a): all-MEDIUM fixture hides the Attention column and shows the line.
  uniform(o) {
    const f = [];
    const bt = text(o.bills);
    if (/Attention/.test(text(thead(o.bills)))) f.push("uniform: Bills table still has an Attention column");
    if (/Confidence/.test(text(thead(o.bills)))) f.push("uniform: Bills table still has a Confidence column");
    if (/data-col="attention"/.test(o.bills)) f.push("uniform: Bills rows still carry an attention cell");
    if (!bt.includes(LINE(BILLS_UNIFORM.length, "Medium attention"))) f.push("uniform: Bills does not show the one-line attention explanation");
    if (!bt.includes(LINE(BILLS_UNIFORM.length, "Confidence 2 of 5"))) f.push("uniform: Bills does not show the one-line confidence explanation");
    const st = text(o.signals);
    if (!st.includes(LINE(SIGNALS_UNIFORM.length, "Medium attention"))) f.push("uniform: Signal inbox does not show the one-line attention explanation");
    if (/class="att med"/.test(o.signals)) f.push("uniform: Signal cards still show a per-card attention badge");
    if (!st.includes(LINE(SIGNALS_UNIFORM.length, "Confidence 3 of 5"))) f.push("uniform: Signal inbox does not show the one-line confidence explanation");
    if (/data-col="attention"/.test(o.radar)) f.push("uniform: Activity by source still has an attention column");
    if (!text(o.radar).includes(LINE(2, "Medium attention"))) f.push("uniform: Activity by source does not show the one-line explanation");
    return f;
  },
  // Test (b): mixed values show the column; confidence reads "Confidence n of 5".
  mixed(o) {
    const f = [];
    if (!/Attention/.test(text(thead(o.bills)))) f.push("mixed: Bills table hides the Attention column");
    if (!/Confidence/.test(text(thead(o.bills)))) f.push("mixed: Bills table hides the Confidence column");
    if ((o.bills.match(/data-col="attention"/g) || []).length !== BILLS_MIXED.length + 1) f.push("mixed: Bills attention cells do not match the rows");
    if (/All \d+ items currently score/.test(text(o.bills))) f.push("mixed: Bills shows the uniform line on mixed data");
    const bt = text(o.bills);
    for (const n of [2, 3]) if (!bt.includes(`Confidence ${n} of 5`)) f.push(`mixed: Bills does not read "Confidence ${n} of 5"`);
    for (const [k, html] of Object.entries({ bills: o.bills, signals: o.signals })) {
      if (/\b\d\/5\b/.test(text(html))) f.push(`mixed: ${k} renders a bare n/5 confidence`);
      if (/class="conf"/.test(html)) f.push(`mixed: ${k} renders the confidence bar`);
    }
    const st = text(o.signals);
    for (const n of [1, 2, 3]) if (!st.includes(`Confidence ${n} of 5`)) f.push(`mixed: Signal cards do not read "Confidence ${n} of 5"`);
    if (!/class="att high"/.test(o.signals)) f.push("mixed: Signal cards hide attention on mixed data");
    if (!/data-col="attention"/.test(o.radar)) f.push("mixed: Activity by source hides attention on mixed data");
    return f;
  },
  radar(o) {
    const f = [];
    for (const html of [o.radar]) {
      const low = html.toLowerCase();
      for (const bad of ["momentum", "issue", "suggested action"]) if (low.includes(bad)) f.push(`radar: page contains "${bad}"`);
      const t = text(html);
      if (!t.includes("Activity by source")) f.push("radar: title is not 'Activity by source'");
      for (const col of ["Source group", "Items", "Feeds"]) if (!t.includes(col)) f.push(`radar: no ${col} column`);
    }
    return f;
  },
  disclose(o) {
    const f = [];
    const badges = [...o.signals.matchAll(/<span class="att (?:high|med|low)"[^>]*>/g), ...o.bills.matchAll(/<span class="att (?:high|med|low)"[^>]*>/g)];
    if (badges.length === 0) f.push("disclose: no attention badge rendered to check");
    for (const b of badges) if (!b[0].includes(`title="${DISCLOSURE}"`)) { f.push(`disclose: attention badge without the disclosure tooltip: ${b[0].slice(0, 80)}`); break; }
    if (!text(o.about).includes(DISCLOSURE)) f.push("disclose: About has no attention disclosure paragraph");
    if (!text(o.bills).includes(DISCLOSURE)) f.push("disclose: Bills desk does not state the disclosure");
    if (!text(o.signals).includes(DISCLOSURE)) f.push("disclose: Signal inbox does not state the disclosure");
    return f;
  },
  scope(o) {
    const f = [];
    const sub = (o.bills.match(/data-bills-scope="">([\s\S]*?)<\/div>/) || [])[1] || "";
    if (!/Bills Digest in the Parliamentary Library feed, not every bill before Parliament/.test(text(sub))) f.push("scope: Bills page-sub does not name the Bills Digest scope");
    if (!sub.includes('href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"')) f.push("scope: Bills page-sub does not link to the APH bills search");
    return f;
  },
  action(o) {
    const f = [];
    if (o.liveAction !== "") f.push(`action: fixture signal carries an action (${JSON.stringify(o.liveAction)}); test premise broken`);
    if (/Recommended action/.test(o.briefMd)) f.push("action: a live brief with no action still prints 'Recommended action'");
    if (/Recommended action/.test(o.signals)) f.push("action: Signal inbox prints an empty 'Recommended action'");
    return f;
  },
};

// Test (c): the palette, rendered with a fixture bill title as its query.
function searchGroup(overrides) {
  const f = [];
  let out;
  try { out = run("mixed", overrides, { q: SEARCH_TERM }); }
  catch (e) { return [`search: render threw ${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e}`]; }
  const html = out.topbar;
  const bills = (html.match(/data-sr-group="bills">([^<]*)</) || [])[1];
  if (!bills) f.push("search: no Bills result group for a fixture bill title");
  else if (!bills.includes(`Bills (latest ${BILLS_MIXED.length} with a Bills Digest)`)) f.push(`search: Bills group label "${bills}" does not state its scope`);
  const hits = html.match(/data-sr-bill=""/g) || [];
  if (hits.length !== BILLS_MIXED.length) f.push(`search: ${hits.length} bill results, expected ${BILLS_MIXED.length}`);
  if (!text(html).includes(BILLS_MIXED[0].title)) f.push("search: the fixture bill title is not in the results");
  if (/>\s*Members\b/.test(html) || /data-sr-group="members"/.test(html)) f.push("search: a Members group renders");
  // A signal query labels its group with the live count held.
  let sigOut;
  try { sigOut = run("mixed", overrides, { q: "analytics item" }).topbar; } catch (e) { return [...f, `search: signal render threw ${e}`]; }
  const sg = (sigOut.match(/data-sr-group="signals">([^<]*)</) || [])[1] || "";
  if (!sg.includes(`Signals (latest ${SIGNALS_MIXED.length} held)`)) f.push(`search: Signals group label "${sg}" does not state its real scope`);
  return f;
}

const PLAN = [["uniform", "uniform"], ["mixed", "mixed"], ["uniform", "radar"], ["mixed", "radar"], ["mixed", "disclose"], ["mixed", "scope"], ["mixed", "action"]];
function assertAll(overrides = {}) {
  const f = [];
  const cache = {};
  for (const [variant, group] of PLAN) {
    try {
      cache[variant] = cache[variant] || run(variant, overrides);
      f.push(...GROUPS[group](cache[variant]));
    } catch (e) {
      f.push(`${variant}/${group}: render threw ${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e}`);
    }
  }
  f.push(...searchGroup(overrides));
  return f;
}

// ---- canaries (d) ------------------------------------------------------------------
const store = read("store"), shell = read("shell"), pages = read("pages");
const mut = (src, a, b) => src.split(a).join(b);
const CANARIES = [
  { why: "uniform detection removed (columns always shown)", over: { store: mut(store, "}) ? first : void 0;", "}) ? void 0 : void 0;") } },
  { why: "uniform detection always true (columns always hidden)", over: { store: mut(store, "}) ? first : void 0;", "}) ? first : first;") } },
  { why: "confidence reverted to n/5", over: { store: mut(store, "`Confidence ${n} of 5`", "`${n}/5`") } },
  { why: "radar momentum column restored", over: { pages: mut(pages, "\"Highest attention\"", "\"Momentum\"") } },
  { why: "radar issue wording restored", over: { pages: mut(pages, "\"Source group\")", "\"Issue\")") } },
  { why: "attention tooltip removed", over: { shell: mut(shell, "{ className: \"att \" + level, title: tip,", "{ className: \"att \" + level,") } },
  { why: "Bills Digest scope removed from the page-sub", over: { pages: mut(pages, "Lists bills that have a Bills Digest in the Parliamentary Library feed, not every bill before Parliament.", "Live from the Worker's /bills endpoint.") } },
  { why: "empty recommended action restored", over: { shell: mut(shell, "recommendedAction: s.action ? {", "recommendedAction: true ? {") } },
  { why: "search bills source removed", over: { shell: mut(shell, "bills: liveBills.items,", "bills: [],") } },
  { why: "search group scope label removed", over: { store: mut(store, "`Signals (latest ${sigSource.length} held)`", "`Signals`") } },
];
let failures = 0;
for (const c of CANARIES) {
  const changed = Object.entries(c.over).some(([k, v]) => v !== read(k));
  if (!changed) { console.error(`CANARY BUILD ERROR: mutation "${c.why}" did not apply; the source moved.`); failures++; continue; }
  const got = assertAll(c.over);
  if (process.env.PP_DEBUG) console.log(`canary "${c.why}":\n  ${got.join("\n  ")}`);
  if (got.length === 0) { console.error(`CANARY MISS: "${c.why}" passed the assertions.`); failures++; }
}
if (failures > 0) { console.error("ANALYTICS HONESTY: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${CANARIES.length} scratch-copy regressions each failed the assertions.`);

// ---- the real bundle -----------------------------------------------------------------
const real = assertAll();
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }
if (failures > 0) { console.error(`\nANALYTICS HONESTY: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log(`ANALYTICS HONESTY: PASSED. ${PLAN.length + 1} surface checks: a column every row shares collapses to one honest line, mixed values keep it, confidence reads "Confidence n of 5", Activity by source claims no trend or issue, every attention value carries the heuristic disclosure, Bills names its Bills Digest scope, a live signal has no empty recommended action, and search finds live bills under scoped group labels.`);
