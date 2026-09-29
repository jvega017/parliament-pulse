// Shared render harness for the honest-surfaces assertions (FE-03), extracted in
// FE-11 so the same render can run against two bundles: the committed built .js
// (tests/honest-surfaces.test.mjs) and the minified, hash-named dist copies
// (tests/global-scope.test.mjs). One definition of the fixture, the React shim,
// the renderer and the assertions, so the two runs cannot drift apart.
//
// A minimal React shim: createElement builds a plain tree, hooks return their
// initial values, and a tiny renderer walks function components to HTML. No DOM
// and no npm dependency.

import vm from "node:vm";
import { ATTRIBUTION_TEXT } from "./attribution-check.mjs";

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
export const FIXTURE_STATE = {
  meta: { generated_at: NOW, worker_version: "fixture", schema: "state-v1" },
  blocks: {
    signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items: [...committeeItems, ...otherItems] },
    connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks: [{ url: "https://www.aph.gov.au/house/rss/media_releases", checked_at: NOW, ok: 1, status: 200, error: null }] },
    threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [], note: "threads table returned no rows" },
    alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [], note: "none" },
    qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [], note: "qons table returned no rows" },
  },
};
export const FIXTURE_BILLS = [{ id: "b1", title: "Fixture Bill 2026" }, { id: "b2", title: "Second Fixture Bill 2026" }];

// ---- React shim + renderer -----------------------------------------------------
export function makeContext(storeRef, csvSink) {
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

export function renderToString(el, React) {
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

// Load the given sources (in load order) and render the surfaces under test.
// Each source runs as its own classic script in one context, as a browser does.
export function renderSurfaces(sources) {
  const storeRef = { value: null };
  const csv = [];
  const { ctx, React } = makeContext(storeRef, csv);
  sources.forEach((src, i) => vm.runInContext(src, ctx, { filename: `bundle-${i}.js` }));
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

export function honestAssertions(out) {
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
