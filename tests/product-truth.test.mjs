// Product truth test (round 1 of the finalised-product pass). Run after npm run build.
// Exit 0 = pass, 1 = fail.
//
// Renders the built .js (in index.html load order) and asserts what a reader sees:
//   fetched   the store stamps liveBills.fetchedAt (and liveState.fetchedAt) with
//             Date.now(), a millisecond number. fmtFetchedAt must read it as a
//             Brisbane clock, and a header with no fetch time omits the whole
//             "fetched ... AEST" clause: the Bills header never reads
//             "fetched Not supplied AEST". The /bills fixture carries no timestamp,
//             so this is the only gate that exercises the number path.
//   sort      the Signal inbox default sort ("Newest first") orders dated items by
//             publication time, newest first, with undated items last. The Worker
//             sends score-then-recency order, so "15 Sep" used to sit below "5 Jul".
//   addfeed   the Add feed form has no simulated check: no "Validate" button and no
//             "Simulated" or "A real check would" lines ship; a Save feed button does.
//   sources   the Sources "Not yet connected" panel carries no commercial wording
//             ("Optional bundle", "Internal executive briefings", "backlog request")
//             and no Request button; each row links to its official aph.gov.au page.
//   nowrap    the signal card-head date (.sig-time) never wraps ("16 / Sep" at 390 px),
//             and the head itself wraps so a long "Date not supplied" drops a line
//             instead of running past the card.
//   livecount the Live page count says "items", never "tabled items": the count
//             includes media releases, which are not tabled.
// Round 2:
//   carddate  an undated card head reads only "Date not supplied" (the long
//             "first seen" label ran past the card at 390 and 320 px); the card's
//             drawer date keeps "Date not supplied, first seen D Mon YYYY".
//   refresh   the Sources refresh button calls the store's refreshLiveState (one
//             /state request) and is labelled "Refresh health"; it used to depend
//             on the Live page's poller and could only say "Open Live parliament".
//   checktime the Sources "Healthy" tile reads the latest feed check time, never
//             the page's fetch time, and drops the clause when no check has a time.
//   livesort  Live "Recent items" run newest first with undated items last, and
//             the poller applies that sort before the 30-item cap.
// Round 3:
//   committees  Committees "Upcoming Senate hearings" and "Inquiries and reports"
//             run newest first with undated items last (they kept the Worker's
//             score order).
//   recentpanel the Daily program note places the "Recent items · APH RSS" panel
//             "on this page", never "beside this player" (false at 390 px).
//   inflight  a refresh pressed while the store's /state fetch is running gets
//             that fetch's promise back, never an already-settled one, and the
//             Sources button says "reloaded" only after a request has come back:
//             with no request to wait on it says it cannot reload.
//   checkday  the Healthy tile's check time carries its day when the check was
//             not made today in Brisbane ("last check 28 Sep 09:55 AEST").
// Round 4:
//   hearingorder the Upcoming Senate hearings list states its real order. No row
//             carries a hearing date (/state sends none; the APH feed keeps it in
//             <description>), so the note never claims hearing order: dated rows
//             read "newest published first", and all-undated rows (the live shape)
//             say the feed gives no dates and keep the Worker's score order.
//
// Canary-first: each control is removed on an in-memory scratch copy of the built
// .js or index.html (the working tree is never touched) and the matching assertion
// must fail there; the unmodified bundle must pass (restraint).

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { root, JSX_FILES } from "../scripts/build-config.mjs";

const SOURCES = Object.fromEntries(JSX_FILES.map(f => [f, fs.readFileSync(path.join(root, `${f}.js`), "utf8")]));
SOURCES["index.html"] = fs.readFileSync(path.join(root, "index.html"), "utf8");

// ---- fixtures ------------------------------------------------------------------
const NOW_MS = Date.now();
const iso = ms => new Date(ms).toISOString();
const NOW = iso(NOW_MS);
const MIN = 60 * 1000;
// Expected clock computed with Intl directly, never with app code.
const clock = ms => {
  const o = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms))) o[p.type] = p.value;
  return `${o.hour}:${o.minute}`;
};
const FETCHED_MS = NOW_MS - 7 * MIN;
// Feed checks: the latest check (CHECK_A) is 12 minutes old, never the fetch time.
const CHECK_A = NOW_MS - 12 * MIN, CHECK_B = NOW_MS - 31 * MIN;
const feedCheck = (label, at, extra) => ({ url: `https://www.aph.gov.au/truth/feed/${label.replace(/\W+/g, "_")}`, feed_label: label, kind: "signal", checked_at: at, ok: 1, status: 200, error: null, last_http_status: 200, items_parsed: 4, parse_error: null, last_success_at: at, ...extra });
const NEVER = { ok: 0, status: null, last_http_status: null, items_parsed: null, last_success_at: null };
const CHECKS = [feedCheck("House media releases", iso(CHECK_B)), feedCheck("Senate committee reports", iso(CHECK_A)), feedCheck("House news", null, NEVER)];
const CHECKS_UNTIMED = [feedCheck("House news", null, NEVER)];
// A latest check two days old: its clause must carry the day.
const CHECK_OLD = NOW_MS - 2 * 24 * 60 * MIN;
const CHECKS_OLD = [feedCheck("Senate committee reports", iso(CHECK_OLD))];
// Expected short date computed with Intl directly, never with app code.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMon = ms => {
  const o = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(ms))) o[p.type] = p.value;
  const nowYear = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", year: "numeric" }).format(new Date(NOW_MS));
  return `${Number(o.day)} ${MONTHS[Number(o.month) - 1]}${o.year === nowYear ? "" : " " + o.year}`;
};

const sig = (id, extra) => ({
  guid: `https://www.aph.gov.au/truth/${id}`, title: `Truth item ${id}`, link: `https://www.aph.gov.au/truth/${id}`,
  feed_label: "House media releases", source_group: "House", kind: "signal", attention: "med", confidence: 1,
  scoring_explanation: "Deterministic score from source and keyword rules.", first_seen_at: NOW, ...extra,
});
// Worker order: score first, then recency. The oldest item and an undated one lead.
const SIGNALS = [
  sig("jul", { pub_date: "2026-07-05", attention: "high" }),
  sig("undated", { pub_date: null, attention: "high" }),
  sig("sep15", { pub_date: "2026-09-15T02:00:00.000Z" }),
  sig("recent", { pub_date: iso(NOW_MS - 5 * MIN), attention: "low" }),
  sig("undated2", { pub_date: null, attention: "low" }),
];
const EXPECT_ORDER = ["recent", "sep15", "jul", "undated", "undated2"];
// Committee feeds, in Worker (score) order: the oldest and an undated item lead.
const COMMITTEE_SIGNALS = [
  sig("c-jul", { feed_label: "Senate reports tabled", pub_date: "2026-07-05", attention: "high" }),
  sig("c-undated", { feed_label: "New Senate inquiries", pub_date: null, attention: "high" }),
  sig("c-sep15", { feed_label: "House committee inquiries", pub_date: "2026-09-15T02:00:00.000Z" }),
  sig("c-recent", { feed_label: "Joint committee inquiries", pub_date: iso(NOW_MS - 5 * MIN), attention: "low" }),
  sig("h-old", { feed_label: "Upcoming Senate hearings", pub_date: "2026-08-01T00:00:00.000Z", attention: "high" }),
  sig("h-undated", { feed_label: "Upcoming Senate hearings", pub_date: null, attention: "high" }),
  sig("h-new", { feed_label: "Upcoming Senate hearings", pub_date: iso(NOW_MS - 60 * MIN), attention: "low" }),
];
const EXPECT_COMMITTEE_RECENT = ["c-recent", "c-sep15", "c-jul", "c-undated"];
const EXPECT_COMMITTEE_HEARINGS = ["h-new", "h-old", "h-undated"];
// The live shape (30 Sep 2026 /state probe): every Upcoming Senate hearings row
// has pub_date null and no hearing date, so they keep the Worker's score order.
const COMMITTEE_SIGNALS_UNDATED = [
  sig("h-first", { feed_label: "Upcoming Senate hearings", pub_date: null, attention: "high" }),
  sig("h-second", { feed_label: "Upcoming Senate hearings", pub_date: null }),
  sig("h-third", { feed_label: "Upcoming Senate hearings", pub_date: null, attention: "low" }),
];
const EXPECT_COMMITTEE_HEARINGS_UNDATED = ["h-first", "h-second", "h-third"];
const BILL = { guid: "https://parlinfo.aph.gov.au/truth/bill1", title: "Truth Amendment Bill 2026", link: "https://parlinfo.aph.gov.au/truth/bill1", pub_date: "2026-09-28T04:00:00.000Z", description: null, attention: "high", confidence: 1 };
const BLOCKS = {
  signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items: SIGNALS },
  connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks: CHECKS },
  threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [] },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
};
const META = { generated_at: NOW, worker_version: "fixture", schema: "state-v1", last_poll_at: NOW, last_new_item_at: NOW, stale: false };

// ---- React shim + renderer (as tests/finalise.test.mjs) ------------------------
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
    React, console,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { platform: "Win32", clipboard: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { hostname: "localhost", search: "", hash: "", protocol: "https:" },
    document: { createElement: noopEl, body: { appendChild() {} }, getElementById: () => null, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} }, visibilityState: "visible" },
    Blob: class { constructor() {} },
    URL: Object.assign(class extends URL {}, { createObjectURL: () => "blob:test", revokeObjectURL: () => {} }),
    fetch: () => new Promise(() => {}),
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
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
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

// Walk an element tree, expanding function components, and return the first host
// element whose props pass `pred` (so a test can call its onClick).
function findEl(el, React, pred) {
  if (el == null || typeof el !== "object") return null;
  if (Array.isArray(el)) { for (const e of el) { const r = findEl(e, React, pred); if (r) return r; } return null; }
  const { type, props } = el;
  if (type === React.Fragment) return findEl(props.children, React, pred);
  if (typeof type === "function") {
    const out = type.prototype && typeof type.prototype.render === "function" ? new type(props).render() : type(props);
    return findEl(out, React, pred);
  }
  if (pred(props || {})) return el;
  return findEl(props && props.children, React, pred);
}

async function run(sources, billsFetchedAt, checks = CHECKS, { refreshReturns = "pending" } = {}) {
  const storeRef = { value: null };
  const { ctx, React } = makeContext(storeRef);
  JSX_FILES.filter(f => f !== "app").forEach(f => vm.runInContext(sources[f], ctx, { filename: `${f}.js` }));
  const blocks = JSON.parse(JSON.stringify(BLOCKS));
  blocks.connectors.checks = JSON.parse(JSON.stringify(checks));
  const mapped = ctx.mapLiveBlocks(blocks, JSON.parse(JSON.stringify(META)));
  const calls = { refresh: 0, toasts: [] };
  storeRef.value = {
    state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
    liveState: { status: "ready", meta: META, blocks: mapped, fetchedAt: FETCHED_MS, isRefreshing: false },
    liveBills: { status: "ready", items: [BILL], fetchedAt: billsFetchedAt, isRefreshing: false },
    navigate: () => {}, toast: m => { calls.toasts.push(String(m)); }, openModal: () => {}, openSignal: () => {}, closeSignal: () => {}, closeModal: () => {},
    isWatched: () => false, addFeed: () => {}, requestLiveRefresh: () => {}, consumeLiveRefresh: () => false,
    refreshLiveState: () => { calls.refresh++; return refreshReturns === "none" ? undefined : new Promise(() => {}); }, setSignalSearchQuery: () => {}, signalSearchQuery: "",
    setVisibleSignalOrder: () => {}, modal: null, signalId: null,
  };
  const r = (C, p = {}) => renderToString(React.createElement(C, p), React);
  // Press the Sources refresh button (found by its label) and record what it did.
  const btn = findEl(React.createElement(ctx.PageSources), React, p => typeof p.onClick === "function" && /Refresh (all|health)/.test(renderToString(p.children, React)));
  const refresh = { found: !!btn, label: btn ? text(renderToString(btn.props.children, React)) : null };
  if (btn) { btn.props.onClick({ preventDefault() {} }); await new Promise(res => setImmediate(res)); refresh.calls = calls.refresh; refresh.toasts = calls.toasts.slice(); }
  const undated = (mapped.signals.items || []).find(x => /\/undated$/.test(x.id));
  const T = ms => ({ getTime: () => ms });
  const liveEvents = typeof ctx.sortLiveEventsNewestFirst === "function" ? ctx.sortLiveEventsNewestFirst([
    { title: "feed0-a", date: T(NOW_MS - 3 * 24 * 60 * MIN), feedIdx: 0, itemIdx: 0 },
    { title: "feed0-b", date: null, feedIdx: 0, itemIdx: 1 },
    { title: "feed1-a", date: T(NOW_MS - 5 * MIN), feedIdx: 1, itemIdx: 0 },
    { title: "feed1-b", date: T(NOW_MS - 90 * 24 * 60 * MIN), feedIdx: 1, itemIdx: 1 },
    { title: "feed2-a", date: null, feedIdx: 2, itemIdx: 0 },
    { title: "feed2-b", date: T(NOW_MS - 2 * 24 * 60 * MIN), feedIdx: 2, itemIdx: 1 },
  ]).map(e => e.title) : null;
  const out = {
    refresh, undatedDate: undated ? undated.date : null, liveEvents,
    bills: r(ctx.PageBills), signals: r(ctx.PageSignals), sources: r(ctx.PageSources),
    fmtNumber: ctx.fmtFetchedAt(FETCHED_MS), fmtIso: ctx.fmtFetchedAt(iso(FETCHED_MS)), fmtNull: ctx.fmtFetchedAt(null),
  };
  // Committees, from the committee-feed fixture.
  const cBlocks = JSON.parse(JSON.stringify(BLOCKS));
  cBlocks.signals.items = JSON.parse(JSON.stringify(COMMITTEE_SIGNALS));
  storeRef.value = { ...storeRef.value, liveState: { ...storeRef.value.liveState, blocks: ctx.mapLiveBlocks(cBlocks, JSON.parse(JSON.stringify(META))) } };
  out.committees = r(ctx.PageCommittees);
  const uBlocks = JSON.parse(JSON.stringify(BLOCKS));
  uBlocks.signals.items = JSON.parse(JSON.stringify(COMMITTEE_SIGNALS_UNDATED));
  storeRef.value = { ...storeRef.value, liveState: { ...storeRef.value.liveState, blocks: ctx.mapLiveBlocks(uBlocks, JSON.parse(JSON.stringify(META))) } };
  out.committeesUndated = r(ctx.PageCommittees);
  return out;
}

// The store's own refresh: two presses while one /state fetch is running (the
// fixture fetch never settles) must hand back that same running promise.
function storeInflight(sources) {
  const storeRef = { value: null };
  const { ctx, React } = makeContext(storeRef);
  JSX_FILES.filter(f => f !== "app").forEach(f => vm.runInContext(sources[f], ctx, { filename: `${f}.js` }));
  const el = ctx.StoreProvider({ children: null });
  const value = el && el.props && el.props.value;
  if (!value || typeof value.refreshLiveState !== "function") return { found: false };
  const first = value.refreshLiveState();
  const second = value.refreshLiveState();
  return { found: true, firstThenable: !!first && typeof first.then === "function", same: first === second };
}

const shipped = src => transformSync(src, { loader: "js", minifyWhitespace: true, legalComments: "none" }).code;
const billsKicker = html => { const m = html.match(/Tracked bills<\/h2><span class="panel-kicker">([^<]*)</); return m ? m[1] : null; };
const cssRule = (html, sel) => { const m = html.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`)); return m ? m[1] : null; };

// ---- assertions ------------------------------------------------------------------
async function assertAll(sources) {
  const f = [];
  let withTime, noTime, untimed, oldCheck, noRequest, inflight;
  try {
    withTime = await run(sources, FETCHED_MS); noTime = await run(sources, null); untimed = await run(sources, FETCHED_MS, CHECKS_UNTIMED);
    oldCheck = await run(sources, FETCHED_MS, CHECKS_OLD); noRequest = await run(sources, FETCHED_MS, CHECKS, { refreshReturns: "none" });
    inflight = storeInflight(sources);
  }
  catch (e) { return [`render threw ${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e}`]; }
  // fetched
  const want = clock(FETCHED_MS);
  if (withTime.fmtNumber !== want) f.push(`fetched: fmtFetchedAt(number) reads "${withTime.fmtNumber}", expected "${want}"`);
  if (withTime.fmtIso !== want) f.push(`fetched: fmtFetchedAt(ISO) reads "${withTime.fmtIso}", expected "${want}"`);
  const k1 = billsKicker(withTime.bills);
  if (k1 !== `1 bill · fetched ${want} AEST`) f.push(`fetched: Bills header reads ${JSON.stringify(k1)}, expected "1 bill · fetched ${want} AEST"`);
  const k0 = billsKicker(noTime.bills);
  if (k0 !== "1 bill") f.push(`fetched: Bills header with no fetch time reads ${JSON.stringify(k0)}, expected "1 bill" (clause omitted)`);
  for (const [name, html] of Object.entries({ bills: withTime.bills + noTime.bills, signals: withTime.signals })) {
    if (/fetched Not supplied|Not supplied AEST/.test(text(html))) f.push(`fetched: ${name} prints "fetched Not supplied AEST"`);
  }
  // sort
  const order = [...withTime.signals.matchAll(/data-signal-id="https:\/\/www\.aph\.gov\.au\/truth\/([^"]+)"/g)].map(m => m[1]);
  if (order.join(",") !== EXPECT_ORDER.join(",")) f.push(`sort: default inbox order is ${order.join(",")}, expected ${EXPECT_ORDER.join(",")} (newest first, undated last)`);
  const opt = (withTime.signals.match(/<option value="time">([^<]*)</) || [])[1];
  if (!opt) f.push("sort: no time option in the Sort control");
  // addfeed
  const src = text(withTime.sources);
  if (/<button[^>]*>\s*(Validate|Testing…)\s*</.test(withTime.sources)) f.push("addfeed: a Validate button renders");
  if (!/<button[^>]*data-save-feed[^>]*>Save feed</.test(withTime.sources)) f.push("addfeed: no Save feed button");
  const refCode = shipped(sources["pages-reference"]);
  if (/Simulated example only|A real check would|Example only · this feed/.test(refCode)) f.push("addfeed: pages-reference.js ships simulated check lines");
  // sources
  if (/Optional bundle|Internal executive briefings|backlog request/i.test(src)) f.push("sources: Not yet connected carries commercial wording");
  if (/<button[^>]*>\s*Request\s*</.test(withTime.sources)) f.push("sources: a Request button renders with nowhere to send it");
  for (const code of Object.values(sources)) if (/copyBacklogRequest/.test(code)) { f.push("sources: copyBacklogRequest still ships"); break; }
  const rows = [...withTime.sources.matchAll(/data-not-connected-row="([^"]+)"([\s\S]*?)(?=data-not-connected-row=|$)/g)];
  if (rows.length < 3) f.push(`sources: Not yet connected lists ${rows.length} rows, expected Hansard, questions on notice and member profiles`);
  for (const [, id, body] of rows) if (!/href="https:\/\/www\.aph\.gov\.au\/[^"]+"/.test(body)) f.push(`sources: ${id} row has no aph.gov.au link`);
  // nowrap
  const rule = cssRule(sources["index.html"], ".sig-time");
  if (!rule || !/white-space:\s*nowrap/.test(rule)) f.push("nowrap: .sig-time can wrap (no white-space: nowrap)");
  // An unwrappable date needs a head that wraps, or "Date not supplied" runs past the card.
  const head = cssRule(sources["index.html"], ".sig-head");
  if (!head || !/flex-wrap:\s*wrap/.test(head)) f.push("nowrap: .sig-head cannot wrap, so an unwrappable date overflows the card at 390 px");
  // livecount
  const today = shipped(sources["pages-today"]);
  if (/tabled items/.test(today)) f.push('livecount: Live page counts media releases as "tabled items"');
  if (!/\$\{events\.length\} item\$\{/.test(today)) f.push("livecount: Live page item count template not found");
  // carddate
  const card = (withTime.signals.match(/data-signal-id="https:\/\/www\.aph\.gov\.au\/truth\/undated"[\s\S]*?data-sig-when="">([^<]*)</) || [])[1];
  if (card !== "Date not supplied") f.push(`carddate: undated card head reads ${JSON.stringify(card)}, expected "Date not supplied" (the first-seen label overflows the card at 390 px)`);
  if (!/^Date not supplied, first seen \d{1,2} [A-Z][a-z]{2} \d{4}$/.test(withTime.undatedDate || "")) f.push(`carddate: the drawer date reads ${JSON.stringify(withTime.undatedDate)}, expected "Date not supplied, first seen D Mon YYYY"`);
  // refresh
  const rf = withTime.refresh;
  if (!rf.found) f.push("refresh: no Sources refresh button");
  else {
    if (rf.label !== "Refresh health") f.push(`refresh: the Sources button reads ${JSON.stringify(rf.label)}, expected "Refresh health"`);
    if (rf.calls !== 1) f.push(`refresh: pressing it made ${rf.calls} store refresh call(s), expected 1 (a /state request)`);
    if (rf.toasts.some(m => /Open Live parliament/.test(m))) f.push('refresh: pressing it only says "Open Live parliament to refresh the feeds"');
  }
  // checktime
  const meta = html => { const m = html.match(/data-healthy-meta="">([^<]*)</); return m ? m[1] : null; };
  const mTimed = meta(withTime.sources);
  const wantCheck = `last check ${clock(CHECK_A)} AEST`;
  if (mTimed == null) f.push("checktime: no Healthy meta line on Sources");
  else {
    if (!mTimed.includes(wantCheck)) f.push(`checktime: Healthy reads ${JSON.stringify(mTimed)}, expected it to carry "${wantCheck}" (the latest check)`);
    if (mTimed.includes(clock(FETCHED_MS))) f.push(`checktime: Healthy prints the page fetch time ${clock(FETCHED_MS)}`);
  }
  const mUntimed = meta(untimed.sources);
  if (mUntimed == null || /last check|as at|Not supplied/.test(mUntimed)) f.push(`checktime: with no check times Healthy reads ${JSON.stringify(mUntimed)}, expected the clause dropped`);
  // livesort
  const wantLive = ["feed1-a", "feed2-b", "feed0-a", "feed1-b", "feed0-b", "feed2-a"];
  if (!withTime.liveEvents || withTime.liveEvents.join(",") !== wantLive.join(",")) f.push(`livesort: Live items order ${JSON.stringify(withTime.liveEvents)}, expected ${wantLive.join(",")} (newest first, undated last in feed order)`);
  if (!/setEvents\(sortLiveEventsNewestFirst\(all\)\.slice\(0,\s*30\)\)/.test(today)) f.push("livesort: the Live poller does not sort before the 30-item cap");
  // committees
  const cHtml = withTime.committees;
  const hAt = cHtml.indexOf("Upcoming Senate hearings</h2>"), rAt = cHtml.indexOf("Inquiries and reports</h2>");
  const ids = seg => [...seg.matchAll(/href="https:\/\/www\.aph\.gov\.au\/truth\/([ch]-[^"]+)"/g)].map(m => m[1]);
  if (hAt < 0 || rAt < hAt) f.push("committees: the Upcoming Senate hearings and Inquiries and reports panels were not found in order");
  else {
    const hearings = ids(cHtml.slice(hAt, rAt)), recent = ids(cHtml.slice(rAt));
    if (hearings.join(",") !== EXPECT_COMMITTEE_HEARINGS.join(",")) f.push(`committees: Upcoming Senate hearings order is ${hearings.join(",")}, expected ${EXPECT_COMMITTEE_HEARINGS.join(",")} (newest first, undated last)`);
    if (recent.join(",") !== EXPECT_COMMITTEE_RECENT.join(",")) f.push(`committees: Inquiries and reports order is ${recent.join(",")}, expected ${EXPECT_COMMITTEE_RECENT.join(",")} (newest first, undated last)`);
  }
  // hearingorder
  const orderNote = html => { const m = html.match(/data-hearing-order="">([^<]*)</); return m ? m[1] : null; };
  const HEARING_ORDER_CLAIM = /soonest|next hearing first|in hearing order|by hearing date|hearing date order/i;
  const NOT_HEARING_ORDER = "This is not the order the hearings will be held";
  const nDated = orderNote(withTime.committees), nUndated = orderNote(withTime.committeesUndated);
  if (nDated == null || nUndated == null) f.push(`hearingorder: no order note on Upcoming Senate hearings (dated ${JSON.stringify(nDated)}, undated ${JSON.stringify(nUndated)})`);
  else {
    if (!/newest published first/.test(nDated)) f.push(`hearingorder: dated rows read ${JSON.stringify(nDated)}, expected "newest published first"`);
    if (/newest published/.test(nUndated)) f.push(`hearingorder: undated rows claim a publication order they do not have (${JSON.stringify(nUndated)})`);
    if (!/no dates/.test(nUndated)) f.push(`hearingorder: undated rows read ${JSON.stringify(nUndated)}, expected it to say the feed gives no dates`);
    for (const n of [nDated, nUndated]) {
      if (HEARING_ORDER_CLAIM.test(n)) f.push(`hearingorder: the note claims hearing order with no hearing date in the data (${JSON.stringify(n)})`);
      if (!n.includes(NOT_HEARING_ORDER)) f.push(`hearingorder: the note does not say the list is not hearing order (${JSON.stringify(n)})`);
    }
  }
  const uAt = withTime.committeesUndated.indexOf("Upcoming Senate hearings</h2>"), urAt = withTime.committeesUndated.indexOf("Inquiries and reports</h2>");
  const uIds = uAt < 0 ? [] : [...withTime.committeesUndated.slice(uAt, urAt).matchAll(/href="https:\/\/www\.aph\.gov\.au\/truth\/(h-[^"]+)"/g)].map(m => m[1]);
  if (uIds.join(",") !== EXPECT_COMMITTEE_HEARINGS_UNDATED.join(",")) f.push(`hearingorder: undated hearings order is ${uIds.join(",")}, expected the Worker's score order ${EXPECT_COMMITTEE_HEARINGS_UNDATED.join(",")}`);
  // recentpanel
  if (/beside this player/.test(today)) f.push('recentpanel: the Daily program note says the Recent items panel is "beside this player", which is false at 390 px');
  if (!/Recent items \\xB7 APH RSS" panel on this page/.test(today)) f.push('recentpanel: the Daily program note does not place the Recent items · APH RSS panel "on this page"');
  // inflight
  if (!inflight.found) f.push("inflight: StoreProvider exposes no refreshLiveState");
  else if (!inflight.firstThenable || !inflight.same) f.push(`inflight: a second refresh during a running /state fetch did not get that fetch's promise back (thenable ${inflight.firstThenable}, same ${inflight.same}), so a caller can report "reloaded" before anything reloaded`);
  if (withTime.refresh.found && withTime.refresh.toasts.some(m => /health reloaded/.test(m))) f.push("inflight: Refresh health says reloaded while the /state request is still running");
  if (noRequest.refresh.found) {
    if (noRequest.refresh.toasts.some(m => /health reloaded/.test(m))) f.push("refresh: with no request to wait on, Refresh health still says reloaded");
    if (!noRequest.refresh.toasts.some(m => /cannot be reloaded/.test(m))) f.push(`refresh: with no request to wait on, Refresh health does not say it cannot reload (toasts ${JSON.stringify(noRequest.refresh.toasts)})`);
  }
  // checkday
  const mOld = meta(oldCheck.sources);
  const wantOld = `last check ${dayMon(CHECK_OLD)} ${clock(CHECK_OLD)} AEST`;
  if (mOld == null || !mOld.includes(wantOld)) f.push(`checkday: an older check reads ${JSON.stringify(mOld)}, expected it to carry "${wantOld}"`);
  if (mTimed != null && /last check \d{1,2} [A-Z][a-z]{2}/.test(mTimed)) f.push(`checkday: today's check carries a day it does not need (${JSON.stringify(mTimed)})`);
  return f;
}

// ---- canaries --------------------------------------------------------------------
const mut = (file, a, b) => ({ file, a, b });
const CANARIES = [
  { why: "fmtFetchedAt rejects a millisecond number again", expect: "fetched:", m: mut("store", 'if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : NaN;', 'if (typeof v === "number") return NaN;') },
  { why: "the Bills header keeps the clause with no fetch time", expect: "fetched: Bills header with no fetch time", m: mut("pages-workspace", '[`${bills.length} bill${bills.length !== 1 ? "s" : ""}`, fetchedClause(live.fetchedAt)].filter(Boolean).join(" \\xB7 ")', '`${bills.length} bill${bills.length !== 1 ? "s" : ""} \\xB7 fetched ${fmtFetchedAt(live.fetchedAt)} AEST`') },
  { why: "the time sort is a no-op again", expect: "sort:", m: mut("pages-today", 'else if (sort === "time") sigs = sortSignalsNewestFirst(sigs);', "") },
  { why: "the time sort runs oldest first", expect: "sort:", m: mut("pages-today", "return tb - ta;", "return ta - tb;") },
  { why: "undated items sort first", expect: "sort:", m: mut("pages-today", "if (ta == null) return 1;\n    if (tb == null) return -1;", "if (ta == null) return -1;\n    if (tb == null) return 1;") },
  { why: "the Validate button restored", expect: "addfeed:", m: mut("pages-reference", '"data-save-feed": "" }, "Save feed")', '"data-save-feed": "" }, "Validate")') },
  { why: "a simulated check line restored", expect: "addfeed:", m: mut("pages-reference", '"Kept on this device \\xB7 not checked"', '"Simulated example only \\xB7 no request was sent to this URL"') },
  { why: "commercial wording restored", expect: "sources:", m: mut("pages-reference", '"Use the official APH page instead"', '"Optional bundle, later"') },
  { why: "the Not yet connected rows dropped", expect: "sources:", m: mut("pages-reference", 'const NOT_CONNECTED_IDS = ["hansard", "qon", "members"];', "const NOT_CONNECTED_IDS = [];") },
  { why: "a Request button restored", expect: "sources:", m: mut("pages-reference", '"Open on aph.gov.au ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }))', '"Open on aph.gov.au ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm" }, "Request")') },
  { why: "card-head date allowed to wrap", expect: "nowrap:", m: mut("index.html", "font-variant-numeric: tabular-nums; white-space: nowrap; }", "font-variant-numeric: tabular-nums; }") },
  { why: "card head cannot wrap, so a long date overflows", expect: "nowrap: .sig-head", m: mut("index.html", ".sig-head { display:flex; flex-wrap: wrap;", ".sig-head { display:flex;") },
  { why: "the Live count says tabled items", expect: "livecount:", m: mut("pages-today", '`${events.length} item${events.length !== 1 ? "s" : ""} \\xB7', "`${events.length} tabled items \\xB7") },
  // round 2
  { why: "the card head carries the long first-seen label again", expect: "carddate: undated card head", m: mut("store", 'return { dateKind: "none", time: "", date, when: "Date not supplied", pubAt: null };', 'return { dateKind: "none", time: "", date, when: date, pubAt: null };') },
  { why: "the drawer loses its first-seen date", expect: "carddate: the drawer date", m: mut("store", "`Date not supplied, first seen ${fmtDayMonYear(seen)}`", '"Date not supplied"') },
  { why: "Refresh all depends on the Live poller again", expect: "refresh:", m: mut("pages-reference", "onClick: refreshHealth }", 'onClick: () => { if (typeof window.__refreshLiveFeeds === "function") { window.__refreshLiveFeeds(); toast("Live feeds re-polled"); } else { toast("Open Live parliament to refresh the feeds"); } } }') },
  { why: "Healthy reads the page fetch time again", expect: "checktime:", m: mut("pages-reference", "latestCheckClause(feedChecks)]", "`as at ${fmtFetchedAt(health.fetchedAt)} AEST`]") },
  { why: "the check clause picks the earliest check", expect: "checktime:", m: mut("store", "t > latest)) latest = t;", "t < latest)) latest = t;") },
  { why: "the check clause prints a placeholder with no check time", expect: "checktime: with no check times", m: mut("store", 'if (Number.isNaN(latest)) return "";', "if (Number.isNaN(latest)) return `last check ${NOT_SUPPLIED} AEST`;") },
  { why: "Live items back in feed order", expect: "livesort:", m: mut("pages-today", "if (ea != null && eb != null && ea !== eb) return eb - ea;", "") },
  { why: "Live undated items sort first", expect: "livesort:", m: mut("pages-today", "if (ea == null && eb != null) return 1;\n    if (eb == null && ea != null) return -1;", "if (ea == null && eb != null) return -1;\n    if (eb == null && ea != null) return 1;") },
  { why: "the Live poller skips the sort", expect: "livesort: the Live poller", m: mut("pages-today", "setEvents(sortLiveEventsNewestFirst(all).slice(0, 30));", "setEvents(all.slice(0, 30));") },
  // round 3
  { why: "Committees reports keep the Worker order", expect: "committees: Inquiries and reports", m: mut("pages-workspace", "sortSignalsNewestFirst(items.filter((s) => COMMITTEE_RECENT_LABELS.has(s.source)))", "items.filter((s) => COMMITTEE_RECENT_LABELS.has(s.source))") },
  { why: "Committees hearings keep the Worker order", expect: "committees: Upcoming Senate hearings", m: mut("pages-workspace", 'sortSignalsNewestFirst(items.filter((s) => s.source === "Upcoming Senate hearings"))', 'items.filter((s) => s.source === "Upcoming Senate hearings")') },
  { why: "the Daily program note says beside this player again", expect: "recentpanel:", m: mut("pages-today", "panel on this page whenever", "panel beside this player whenever") },
  { why: "the store answers an in-flight refresh with nothing", expect: "inflight: a second refresh", m: mut("store", "if (inFlightRef.current) return inFlightRef.current;", "if (inFlightRef.current) return Promise.resolve();") },
  { why: "Refresh health toasts reloaded with no request", expect: "refresh: with no request", m: mut("pages-reference", 'if (!pending || typeof pending.then !== "function") {\n      toast("Feed health cannot be reloaded right now", "error");\n      return;\n    }\n    pending.then(', "Promise.resolve(pending).then(") },
  { why: "an older check prints its clock time with no day", expect: "checkday: an older check", m: mut("store", 'const day = fmtDayMonYear(latest) === fmtDayMonYear(now) ? "" : `${fmtDayMon(latest, PP_TZ, now)} `;', 'const day = "";') },
  { why: "every check prints its day, today's too", expect: "checkday: today's check", m: mut("store", 'const day = fmtDayMonYear(latest) === fmtDayMonYear(now) ? "" : `${fmtDayMon(latest, PP_TZ, now)} `;', "const day = `${fmtDayMon(latest, PP_TZ, now)} `;") },
  // round 4
  { why: "the hearings order note is gone", expect: "hearingorder: no order note", m: mut("pages-workspace", "if (!rows || rows.length === 0) return null;", "return null;") },
  { why: "undated hearings claim newest published order", expect: "hearingorder: undated rows claim", m: mut("pages-workspace", 'rows.some((s) => s.dateKind !== "none") ?', "true ?") },
  { why: "the note claims hearing order", expect: "hearingorder: the note claims hearing order", m: mut("pages-workspace", "This is not the order the hearings will be held,", "Soonest hearing first,") },
  { why: "undated hearings lose the Worker order", expect: "hearingorder: undated hearings order", m: mut("pages-today", "if (ta == null && tb == null) return 0;", "if (ta == null && tb == null) return String(b.id).localeCompare(String(a.id));") },
];

let failures = 0;
for (const c of CANARIES) {
  const src = SOURCES[c.m.file];
  if (src.split(c.m.a).length - 1 !== 1) { console.error(`CANARY BUILD ERROR: "${c.why}" did not apply once to ${c.m.file}; the source moved.`); failures++; continue; }
  const got = await assertAll({ ...SOURCES, [c.m.file]: src.replace(c.m.a, c.m.b) });
  if (process.env.PP_DEBUG) console.log(`canary "${c.why}":\n  ${got.join("\n  ")}`);
  if (!got.some(m => m.startsWith(c.expect))) { console.error(`CANARY MISS: "${c.why}" did not fail with "${c.expect}" (got ${JSON.stringify(got)}).`); failures++; }
}
if (failures) { console.error("PRODUCT TRUTH: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${CANARIES.length} scratch-copy regressions each failed the assertions.`);

const real = await assertAll(SOURCES);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }
if (failures) { console.error(`\nPRODUCT TRUTH: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("PRODUCT TRUTH: PASSED. Fetch times read from numbers and the clause is omitted without one; the inbox sorts newest first with undated items last; no simulated feed check; the Not yet connected panel links to APH with no commercial wording or dead Request button; card-head dates do not wrap; the Live count says items; undated card heads read \"Date not supplied\" with first seen kept for the drawer; Refresh health reloads /state; Healthy reads the latest check time; Live items run newest first; Committees lists run newest first; the Daily program note places Recent items on this page; an in-flight refresh awaits the running fetch and \"reloaded\" waits for a request; an older check time carries its day; the Upcoming Senate hearings list states its real order and never claims hearing order.");
