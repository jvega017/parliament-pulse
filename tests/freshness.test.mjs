// Freshness, per-feed health and honest dates (FE-05: DATA-07, DATA-08, UX-12,
// DATA-13, DATA-16, DATA-20, PR-12, DATA-19).
//
// Renders the SHIPPED built .js against fixture /state payloads with the same
// minimal React shim as honest-surfaces.test.mjs, and asserts the strings a
// viewer reads:
//   stale     meta.stale true (last poll 40 min ago, so ONLY the Worker's flag
//             says stale): the topbar never shows the Live chip, shows
//             "Stale", and the ribbon reads "APH polling appears stalled; last
//             successful poll <time>".
//   aged      meta.stale false but last_poll_at 3 h old (a cached "fresh"
//             verdict): still stale.
//   fresh     last poll 5 min ago: Live chip with the Worker's feed count and
//             "Last APH poll 5 min ago"; no ribbon.
//   old       an older Worker: no freshness fields, landing-page checks. The app
//             renders without errors and keeps its previous behaviour.
//   signals   an undated row reads "Date not supplied, first seen D Mon YYYY";
//             a date-only row prints its date and no clock time; a timed row
//             prints its Brisbane clock time.
//   sources   one row per connectors.checks entry, never-polled feeds read
//             "Not yet polled" uncoloured, reference_links in a separate
//             uncoloured list.
//   licence   the version in docs/licence-architecture.md, APH_ATTRIBUTION,
//             APH_LICENCE_NAME, the footer and the About copy is identical.
//
// Canary: each assertion group runs against scratch copies of the built .js
// with its control removed (meta.stale ignored, the age fallback removed, a
// clock invented for date-only values, the undated label reverted, the feed
// table disabled, never-polled coloured as failed, the reference list removed,
// the licence version drifted) and must FAIL there.
//
// Run: node tests/freshness.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { readModule } from "../scripts/build-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["data", "entities", "icons", "store", "shell", "pages"];
// "store" and "pages" are module groups since FE-11 split them (ARCH-11);
// readModule joins a group's built files in load order.
const read = f => readModule(f);

// ---- fixtures ------------------------------------------------------------------
const NOW_MS = Date.now();
const iso = ms => new Date(ms).toISOString();
const NOW = iso(NOW_MS);
const MIN = 60 * 1000;

// Expected strings are computed here with Intl directly, never with app code.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parts(ms, timeZone) {
  const o = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}
const dayMonYear = (ms, tz = "Australia/Brisbane") => { const p = parts(ms, tz); return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`; };
const clock = ms => { const p = parts(ms, "Australia/Brisbane"); return `${p.hour}:${p.minute}`; };
// The card-head label (FE final): "28 Sep", with the year only outside the
// current Brisbane year; a timed item published today reads its clock instead.
const dayMon = (ms, tz = "Australia/Brisbane") => { const p = parts(ms, tz); const y = parts(NOW_MS, "Australia/Brisbane").year; return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]}${p.year === y ? "" : " " + p.year}`; };
const cardWhen = ms => (dayMonYear(ms) === dayMonYear(NOW_MS) ? clock(ms) : dayMon(ms));

const FIRST_SEEN = NOW_MS - 2 * 24 * 60 * MIN;
const TIMED = NOW_MS - 3 * 60 * MIN;
// The Worker's toISOString of a date-only value dated TODAY in Brisbane. It must be
// today: a card head shows a clock only for an item published today (FE final),
// so an invented clock on a past date-only value would never reach the card and
// the "clock invented" canary below could not fail.
const brisbaneToday = (() => { const p = parts(NOW_MS, "Australia/Brisbane"); return `${p.year}-${p.month.padStart(2, "0")}-${p.day.padStart(2, "0")}`; })();
const DATE_ONLY_ISO = `${brisbaneToday}T00:00:00.000Z`;
const DATE_ONLY_RAW = "2026-09-23";

const baseSig = (id, extra) => ({
  guid: `https://www.aph.gov.au/freshness/${id}`, title: `Freshness item ${id}`, link: `https://www.aph.gov.au/freshness/${id}`,
  feed_label: "Upcoming Senate hearings", source_group: "Senate", kind: "hearing", attention: "med", confidence: 3,
  scoring_explanation: "Deterministic score from source and keyword rules.", ...extra,
});
const SIGNALS = [
  baseSig("undated", { pub_date: null, first_seen_at: iso(FIRST_SEEN) }),
  baseSig("dateonly", { pub_date: DATE_ONLY_ISO, first_seen_at: NOW }),
  baseSig("dateonlyraw", { pub_date: DATE_ONLY_RAW, first_seen_at: NOW }),
  baseSig("timed", { pub_date: iso(TIMED), first_seen_at: NOW, feed_label: "House media releases" }),
];
const EXPECT = {
  undated: `Date not supplied, first seen ${dayMonYear(FIRST_SEEN)}`,
  dateonly: dayMon(Date.parse(DATE_ONLY_ISO), "UTC"),
  dateonlyraw: dayMon(Date.parse(DATE_ONLY_RAW), "UTC"),
  timed: cardWhen(TIMED),
};

const FEED_CHECKS = [
  { url: "https://www.aph.gov.au/house/rss/media_releases", feed_label: "House media releases", kind: "signal", checked_at: NOW, ok: 1, status: 200, error: null, last_http_status: 200, items_parsed: 12, parse_error: null, last_success_at: NOW },
  { url: "https://www.aph.gov.au/senate/rss/red", feed_label: "Today's Senate hearings", kind: "hearing", checked_at: NOW, ok: 0, status: 500, error: "HTTP 500", last_http_status: 500, items_parsed: 0, parse_error: "HTTP 500", last_success_at: iso(NOW_MS - 26 * 60 * MIN) },
  { url: "https://www.aph.gov.au/house/rss/house_news", feed_label: "House news", kind: "signal", checked_at: null, ok: 0, status: null, error: "not yet polled", last_http_status: null, items_parsed: null, parse_error: null, last_success_at: null },
];
const REFERENCE_LINKS = ["https://www.aph.gov.au/Help/RSS_feeds", "https://www.aph.gov.au/Parliamentary_Business/Hansard"];

const blocksNew = () => ({
  signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items: SIGNALS },
  connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks: FEED_CHECKS, reference_links: REFERENCE_LINKS },
  threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [], note: "none" },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [], note: "none" },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [], note: "none" },
});
const meta = (pollMsAgo, stale) => ({
  generated_at: NOW, worker_version: "fixture", schema: "state-v1",
  last_poll_at: iso(NOW_MS - pollMsAgo), last_new_item_at: iso(NOW_MS - pollMsAgo - 60 * MIN), stale,
  feeds: FEED_CHECKS.map(c => ({ feed_label: c.feed_label, last_seen_at: c.last_success_at })),
});
const VARIANTS = {
  stale: { blocks: blocksNew(), meta: meta(40 * MIN, true), pollMs: NOW_MS - 40 * MIN },
  aged:  { blocks: blocksNew(), meta: meta(180 * MIN, false), pollMs: NOW_MS - 180 * MIN },
  fresh: { blocks: blocksNew(), meta: meta(5 * MIN, false), pollMs: NOW_MS - 5 * MIN },
  old: {
    meta: { generated_at: NOW, worker_version: "0.15.0", schema: "state-v1" },
    blocks: {
      signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items: [{ guid: "https://www.aph.gov.au/old/1", title: "Old shape item", link: "https://www.aph.gov.au/old/1", pub_date: null, feed_label: "Upcoming Senate hearings", source_group: "Senate", kind: "hearing", attention: "med", confidence: 3, scoring_explanation: "x" }] },
      connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks: [
        { url: "https://parlinfo.aph.gov.au/", checked_at: NOW, ok: 0, status: 403, error: "HTTP 403" },
        { url: "https://www.aph.gov.au/house/rss/media_releases", checked_at: NOW, ok: 1, status: 200, error: null },
      ] },
      threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
      alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [] },
      qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
    },
  },
};
const stamp = ms => `${clock(ms)} AEST, ${dayMonYear(ms)}`;

// ---- React shim + renderer (as honest-surfaces.test.mjs; style is serialised) ----
function makeContext(storeRef) {
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
    .filter(([k, v]) => k !== "children" && (typeof v === "string" || typeof v === "number" || (k === "style" && v && typeof v === "object")))
    .map(([k, v]) => {
      const val = k === "style" ? Object.entries(v).map(([a, b]) => `${a}:${b}`).join(";") : String(v);
      return ` ${k === "className" ? "class" : k}="${val.replace(/"/g, "&quot;")}"`;
    }).join("");
  return `<${type}${attrs}>${renderToString(props.children, React)}</${type}>`;
}
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

// Render every surface for one variant.
function run(variant, overrides = {}) {
  const storeRef = { value: null };
  const { ctx, React } = makeContext(storeRef);
  const src = FILES.map(f => overrides[f] ?? read(f)).join("\n;\n");
  vm.runInContext(src, ctx, { filename: "bundle.js" });
  const v = VARIANTS[variant];
  const blocks = ctx.mapLiveBlocks(JSON.parse(JSON.stringify(v.blocks)), JSON.parse(JSON.stringify(v.meta)));
  storeRef.value = {
    state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
    liveState: { status: "ready", meta: v.meta, blocks, fetchedAt: Date.now(), isRefreshing: false },
    liveBills: { status: "ready", items: [], fetchedAt: Date.now(), isRefreshing: false },
    navigate: () => {}, toast: () => {}, openModal: () => {}, openSignal: () => {}, closeSignal: () => {},
    isWatched: () => false, addFeed: () => {}, requestLiveRefresh: () => {}, consumeLiveRefresh: () => false,
    refreshLiveState: () => Promise.resolve(), setSignalSearchQuery: () => {}, modal: null, signalId: null,
  };
  const h = React.createElement;
  const r = (C, p = {}) => renderToString(h(C, p), React);
  const cards = {};
  for (const s of blocks.signals.items || []) {
    cards[s.id.split("/").pop()] = r(ctx.SignalCard, { s });
  }
  return {
    topbar: r(ctx.Topbar, { mobileNavOpen: false, setMobileNavOpen: () => {} }),
    overview: r(ctx.PageOverview),
    sources: r(ctx.PageSources),
    footer: r(ctx.SiteFooter),
    about: r(ctx.PageAbout),
    attribution: vm.runInContext("APH_ATTRIBUTION", ctx),
    licenceName: vm.runInContext("APH_LICENCE_NAME", ctx),
    cards,
  };
}

// ---- assertion groups ------------------------------------------------------------
const CLOCK_RE = /\b\d{1,2}:\d{2}\b/;
const sigWhen = html => { const m = html.match(/data-sig-when="">([^<]*)</); return m ? m[1] : null; };
const rows = (html, attr) => [...html.matchAll(new RegExp(`<tr [^>]*${attr}="([^"]*)"[^>]*>([\\s\\S]*?)</tr>`, "g"))];

const GROUPS = {
  stale(out, name) {
    const f = [];
    const t = text(out.topbar);
    const v = VARIANTS[name];
    if (/data-live-chip="live"/.test(out.topbar) || /Live beta/.test(t)) f.push(`${name}: topbar shows the Live chip while polling is stalled`);
    if (!/data-live-chip="stale"/.test(out.topbar) || !/Stale · polling stalled/.test(t)) f.push(`${name}: topbar chip does not read Stale`);
    const want = `APH polling appears stalled; last successful poll ${stamp(v.pollMs)}`;
    if (!t.includes(want)) f.push(`${name}: stale ribbon does not read "${want}"`);
    if (!/class="stale-banner"[^>]*data-stale-reason="poll"/.test(out.topbar)) f.push(`${name}: stale ribbon absent or not poll-driven`);
    if (!text(out.overview).includes(want)) f.push(`${name}: Overview source health does not show the stall text`);
    return f;
  },
  fresh(out) {
    const f = [];
    const t = text(out.topbar);
    if (!/data-live-chip="live"/.test(out.topbar) || !t.includes(`Live beta · ${FEED_CHECKS.length} feeds`)) f.push(`fresh: topbar chip is not "Live beta · ${FEED_CHECKS.length} feeds"`);
    if (!t.includes("Last APH poll 5 min ago")) f.push("fresh: topbar does not show 'Last APH poll 5 min ago'");
    if (/stale-banner/.test(out.topbar) || /polling appears stalled/.test(t)) f.push("fresh: stale ribbon shows on fresh data");
    if (!text(out.overview).includes("Last APH poll 5 min ago")) f.push("fresh: Overview does not show 'Last APH poll 5 min ago'");
    const tile = out.about.match(/data-metric="Official feeds">[\s\S]*?<strong>([^<]*)<\/strong>/);
    if (!tile || tile[1] !== String(FEED_CHECKS.length)) f.push(`fresh: Official feeds tile reads ${tile && tile[1]}, expected the Worker feed count ${FEED_CHECKS.length}`);
    return f;
  },
  old(out) {
    const f = [];
    const t = text(out.topbar);
    if (!/data-live-chip="live"/.test(out.topbar) || !/Live beta/.test(t)) f.push("old: topbar chip does not keep its previous Live beta reading");
    if (/Live beta · \d+ feeds/.test(t)) f.push("old: topbar prints a registry feed count the Worker did not report");
    if (/data-poll-line/.test(out.topbar) || /stale-banner/.test(out.topbar)) f.push("old: freshness surfaces render with no freshness fields");
    if (/data-feed-table/.test(out.sources)) f.push("old: feed table renders for landing-page checks");
    if (sigWhen(out.cards["1"]) !== "Date not supplied") f.push(`old: undated old-shape card reads ${JSON.stringify(sigWhen(out.cards["1"]))}, expected "Date not supplied"`);
    return f;
  },
  signals(out) {
    const f = [];
    for (const [k, want] of Object.entries(EXPECT)) {
      const got = sigWhen(out.cards[k] || "");
      if (got !== want) f.push(`signals: ${k} card reads ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
    for (const k of ["undated", "dateonly", "dateonlyraw"]) {
      if (CLOCK_RE.test(text(out.cards[k] || ""))) f.push(`signals: ${k} card prints a clock time`);
      if (/Published|>\s*—\s*</.test(out.cards[k] || "")) f.push(`signals: ${k} card reads Published or a bare dash`);
    }
    return f;
  },
  sources(out) {
    const f = [];
    const r = rows(out.sources, "data-feed-row");
    if (r.length !== FEED_CHECKS.length) f.push(`sources: ${r.length} feed rows, expected ${FEED_CHECKS.length} (one per check)`);
    const byLabel = new Map(r.map(m => [m[1], m[0]]));
    for (const c of FEED_CHECKS) if (!byLabel.has(c.feed_label)) f.push(`sources: no row labelled ${c.feed_label}`);
    const pending = byLabel.get("House news") || "";
    if (!/data-feed-state="pending"/.test(pending) || !text(pending).includes("Not yet polled")) f.push("sources: never-polled feed does not read 'Not yet polled'");
    if (/escalate|Failed/.test(pending)) f.push("sources: never-polled feed is coloured or labelled as failed");
    const failed = byLabel.get("Today's Senate hearings") || "";
    if (!/data-feed-state="failed"/.test(failed) || !text(failed).includes("HTTP 500")) f.push("sources: failed feed does not show its status and parse error");
    const ok = byLabel.get("House media releases") || "";
    if (!text(ok).includes("12") || !text(ok).includes("200")) f.push("sources: ok feed does not show items parsed and HTTP status");
    const refPanel = (out.sources.match(/data-reference-pages=""[\s\S]*?<\/ul>/) || [""])[0];
    const refs = refPanel.match(/data-reference-link=""/g) || [];
    if (refs.length !== REFERENCE_LINKS.length) f.push(`sources: ${refs.length} reference pages listed, expected ${REFERENCE_LINKS.length}`);
    if (/escalate|--teal|OK|Failed|data-feed-state/.test(refPanel)) f.push("sources: reference pages carry ok/fail colouring");
    if (/\b6 official feeds|of 13\b/.test(text(out.sources))) f.push("sources: a hardcoded feed count survives");
    return f;
  },
  licence(out) {
    const f = [];
    const doc = fs.readFileSync(path.join(root, "docs", "licence-architecture.md"), "utf8");
    const rec = doc.match(/Licence version record \(PR-12\)[\s\S]*?follows the stated copyright text, \*\*(CC BY-NC-ND [^*]+)\*\*/);
    const ver = s => { const m = String(s).match(/CC BY-NC-ND \d\.\d(?: AU)?/); return m ? m[0] : null; };
    const versions = {
      doc: rec ? rec[1] : null,
      APH_LICENCE_NAME: out.licenceName,
      APH_ATTRIBUTION: ver(out.attribution),
      footer: ver(text(out.footer)),
      about: ver((text(out.about).match(/under the Parliament's (CC BY-NC-ND [^ ]+(?: AU)?) licence/) || [])[1]),
    };
    const distinct = new Set(Object.values(versions));
    if (distinct.size !== 1 || distinct.has(null) || distinct.has(undefined)) f.push(`licence: versions disagree ${JSON.stringify(versions)}`);
    return f;
  },
};
const PLAN = [
  ["stale", "stale"], ["aged", "stale"], ["fresh", "fresh"], ["old", "old"],
  ["fresh", "signals"], ["fresh", "sources"], ["fresh", "licence"],
];
function assertAll(overrides = {}) {
  const f = [];
  const cache = {};
  for (const [variant, group] of PLAN) {
    try {
      cache[variant] = cache[variant] || run(variant, overrides);
      f.push(...GROUPS[group](cache[variant], variant));
    } catch (e) {
      f.push(`${variant}/${group}: render threw ${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e}`);
    }
  }
  return f;
}

// ---- canaries ----------------------------------------------------------------------
const store = read("store"), pages = read("pages"), data = read("data");
const mut = (src, a, b) => src.split(a).join(b);
const CANARIES = [
  { why: "meta.stale ignored", over: { store: mut(store, "stale: m.stale === true", "stale: false") } },
  { why: "age fallback removed", over: { store: mut(store, "return now - t > POLL_STALE_AFTER_MS;", "return false;") } },
  { why: "clock invented for date-only values", over: { store: mut(store, "if (pubDateHasClock(raw))", "if (true)") } },
  { why: "undated label reverted to a dash", over: { store: mut(store, "`Date not supplied, first seen ${fmtDayMonYear(seen)}`", '"\\u2014"') } },
  { why: "feed table disabled (registry list)", over: { pages: mut(pages, "const feedShape = feedChecks.length > 0;", "const feedShape = false;") } },
  { why: "never-polled coloured as failed", over: { store: mut(store, "if (!c || c.neverPolled) return \"pending\";", "if (!c) return \"pending\";") } },
  { why: "reference pages list removed", over: { pages: mut(pages, "referenceLinks.length > 0 &&", "false &&") } },
  { why: "licence version drifted", over: { data: mut(data, 'const APH_LICENCE_NAME = "CC BY-NC-ND 4.0";', 'const APH_LICENCE_NAME = "CC BY-NC-ND 3.0 AU";') } },
];
let failures = 0;
for (const c of CANARIES) {
  const changed = Object.entries(c.over).some(([k, v]) => v !== read(k));
  if (!changed) { console.error(`CANARY BUILD ERROR: mutation "${c.why}" did not apply; the source moved.`); failures++; continue; }
  const got = assertAll(c.over);
  if (process.env.PP_DEBUG) console.log(`canary "${c.why}":\n  ${got.join("\n  ")}`);
  if (got.length === 0) { console.error(`CANARY MISS: "${c.why}" passed the assertions.`); failures++; }
}
if (failures > 0) { console.error("FRESHNESS: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${CANARIES.length} scratch-copy regressions each failed the assertions.`);

// ---- the real bundle -----------------------------------------------------------------
const real = assertAll();
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }
if (failures > 0) { console.error(`\nFRESHNESS: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log(`FRESHNESS: PASSED. ${PLAN.length} surface checks over 4 /state variants: a stalled poll never shows Live, fresh data shows its poll age, the old Worker shape renders unchanged, undated and date-only items print no invented time, Sources lists one row per configured feed with reference pages apart, and the licence version agrees everywhere.`);
