// Review round 5 (5 Oct 2026): the UX, data and security/a11y lens findings
// fixed in the frontend, plus the Upcoming Senate hearings order once Worker
// 0.16.2 sends hearing_date. Renders the built .js against fixture /state blocks
// with the React shim used by tests/product-truth.test.mjs.
//
//   todayhear  Today's hearings lists only rows dated today in Brisbane; the
//              feed name drops its leading "Today's" beside a date.
//   hearings   with hearing_date: soonest first, the hearing date on every row,
//              past first-listed dates under "Recently held", the order note
//              only beside rows with no hearing date, and the stat counts only
//              hearings dated today or later; with no field (Worker 0.16.1) the
//              tile says "Senate hearing notices".
//   heldof     lists capped by the per-feed quota say "latest N of M".
//   program    Daily program shows the program only when its feed carried it today.
//   bills      a failing Bills Digests feed replaces the Live chip; "N of M bills";
//              the store asks for limit=200; the divisions panel is not "Related".
//   sidebar    "2 of 3 feeds healthy" when a feed fails.
//   overview   no "All priority signals actioned" with nothing actioned; the
//              newest signals show when no item is high attention; What changed
//              runs newest first; the daily brief has no bracketed URLs; the beta
//              handoff is built from live counts.
//   brief      a live brief prints its scoring line once, under "Scoring", and
//              "Attention: Medium", never "Priority: MED".
//   watchlist  the modal says "Showing 5 of N", the digest lists every match,
//              and "Save config" is gone.
//   committee  same-titled rows carry the committee read from their link; an
//              aphcms.aph.gov.au link is rewritten to www.aph.gov.au.
//   route      a route change closes an open modal (and the drawer unless the
//              route is a signal), and Back closes the phone menu.
//   live       each feed keeps its six NEWEST items; the footer claims no cadence
//              for the service; registry labels equal the Worker's feed labels.
//   threads    the date range says "first seen"; the count says "largest".
//   sources    "Items in latest poll" and "Last carried items" from meta.feeds.
//   about      Human review reads "Yours", never "On".
//   a11y/sec   en-AU, header landmark, sr-only h2 in the inbox, .btn.nav-toggle,
//              Brisbane clock, CSV formula guard, deferred revoke, iframe sandbox,
//              no /*.jsx rule, no unused CSP origins, layout and focus CSS.
//
// Canary-first: every control is removed on an in-memory scratch copy (the
// working tree is never touched) and the matching assertion must fail there;
// the unmodified bundle must pass.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { root, JSX_FILES } from "../scripts/build-config.mjs";

const SOURCES = Object.fromEntries(JSX_FILES.map(f => [f, fs.readFileSync(path.join(root, `${f}.js`), "utf8")]));
SOURCES["index.html"] = fs.readFileSync(path.join(root, "index.html"), "utf8");
SOURCES["_headers"] = fs.readFileSync(path.join(root, "_headers"), "utf8");

// ---- dates, computed with Intl directly, never with app code -------------------
const NOW_MS = Date.now();
const iso = ms => new Date(ms).toISOString();
const NOW = iso(NOW_MS);
const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
const bne = ms => { const o = {}; for (const p of new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(ms))) o[p.type] = p.value; return o; };
const T = bne(NOW_MS);
const keyAdd = n => { const d = new Date(Date.UTC(Number(T.year), Number(T.month) - 1, Number(T.day) + n)); return d.toISOString().slice(0, 10); };
const TODAY = keyAdd(0);
// Noon in Brisbane today (02:00Z), so a "today" item never straddles midnight.
const TODAY_NOON = `${TODAY}T02:00:00.000Z`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hearingText = key => { const [y, m, d] = key.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return `${WD[t.getUTCDay()]} ${d} ${MONTHS[m - 1]}${String(y) === T.year ? "" : " " + y}`; };
const dayMon = ms => { const o = bne(ms); return `${Number(o.day)} ${MONTHS[Number(o.month) - 1]}${o.year === T.year ? "" : " " + o.year}`; };

// ---- fixtures -------------------------------------------------------------------
const sig = (id, extra) => ({
  guid: `https://www.aph.gov.au/r5/${id}`, title: `Round five item ${id}`, link: `https://www.aph.gov.au/r5/${id}`,
  feed_label: "House media releases", source_group: "House", kind: "signal", attention: "med", confidence: 3,
  scoring_explanation: "Medium attention (45/100). Source: signal (authority 60/100). Scored on authority, recency, novelty, scrutiny.",
  first_seen_at: NOW, pub_date: iso(NOW_MS - 60 * MIN), ...extra,
});
const H = (id, hearing_date, extra) => sig(id, { feed_label: "Upcoming Senate hearings", source_group: "Senate", kind: "hearing", pub_date: null, hearing_date, ...extra });
// Worker order (score): past, later, undated, next, today, past2.
const HEARINGS = [
  H("uh-past", keyAdd(-20), { attention: "high" }), H("uh-later", keyAdd(10)), H("uh-none", null), H("uh-next", keyAdd(1)),
  H("uh-today", keyAdd(0)), H("uh-past2", keyAdd(-5)),
];
const EXPECT_UPCOMING = ["uh-today", "uh-next", "uh-later"];
const EXPECT_HELD = ["uh-past2", "uh-past"];
const COMMITTEE_ROWS = [
  sig("th-today", { feed_label: "Today's House and joint hearings", source_group: "Joint", kind: "hearing", pub_date: TODAY_NOON }),
  sig("th-old", { feed_label: "Today's House and joint hearings", source_group: "Joint", kind: "hearing", pub_date: "2026-09-17T02:00:00.000Z" }),
  sig("rep-a", { feed_label: "Senate reports tabled", source_group: "Senate", kind: "report", title: "Annual reports (No. 2 of 2026)", link: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Community_Affairs/Annual_reports_No_2_of_2026", guid: "rep-a" }),
  sig("rep-b", { feed_label: "Senate reports tabled", source_group: "Senate", kind: "report", title: "Annual reports (No. 2 of 2026)", link: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Education_and_Employment/Progress_report", guid: "rep-b" }),
  sig("aphcms", { feed_label: "New Senate inquiries", source_group: "Senate", kind: "inquiry", link: "https://aphcms.aph.gov.au/Parliamentary_Business/Committees/Joint/Corporations_and_Financial_Services/OversightASIC/Public_Hearings", guid: "aphcms" }),
];
// Overview: no high item; What changed must run newest first.
const OVERVIEW = [
  sig("ov-old", { pub_date: iso(NOW_MS - 9 * DAY) }), sig("ov-new", { pub_date: iso(NOW_MS - 2 * MIN) }),
  sig("ov-mid", { pub_date: iso(NOW_MS - 3 * DAY) }), sig("ov-undated", { pub_date: null }), sig("ov-mid2", { pub_date: iso(NOW_MS - 5 * DAY) }),
];
const EXPECT_NEWEST3 = ["ov-new", "ov-mid", "ov-mid2"];
// Seven watchlist matches, so the modal shows 5 of 7.
const WATCH_ROWS = [...OVERVIEW, sig("wl-x1", { pub_date: iso(NOW_MS - 20 * DAY) }), sig("wl-x2", { pub_date: iso(NOW_MS - 21 * DAY) })];
const EXPECT_TIMELINE = ["ov-new", "ov-mid", "ov-mid2", "ov-old", "ov-undated"];
const feedCheck = (label, extra) => ({ url: `https://www.aph.gov.au/r5/feed/${label.replace(/\W+/g, "_")}`, feed_label: label, kind: "signal", checked_at: NOW, ok: 1, status: 200, error: null, last_http_status: 200, items_parsed: 4, parse_error: null, last_success_at: NOW, ...extra });
const DIGEST_LAST_OK = "2026-10-03T21:32:42.389Z";
const CHECKS = [feedCheck("House media releases"), feedCheck("Senate reports tabled", { items_parsed: 0 }), feedCheck("Bills Digests", { ok: 0, status: 403, last_http_status: 403, last_success_at: DIGEST_LAST_OK, error: "HTTP 403" })];
const PROGRAM_OLD_SEEN = "2026-09-17T03:00:22.443Z";
const META = (programSeen = PROGRAM_OLD_SEEN) => ({
  generated_at: NOW, worker_version: "0.16.2", schema: "state-v1", last_poll_at: NOW, last_new_item_at: NOW, stale: false,
  feeds: [{ feed_label: "House daily program", last_seen_at: programSeen }, { feed_label: "Senate reports tabled", last_seen_at: "2026-09-20T13:30:25.842Z" }],
  signal_counts: { "Upcoming Senate hearings": { held: 6, available: 21 }, "Senate reports tabled": { held: 2, available: 68 }, "New Senate inquiries": { held: 1, available: 75 } },
});
const PROGRAM = sig("prog", { feed_label: "House daily program", kind: "program", title: "Daily Program: Wednesday, 16 September 2026", pub_date: "2026-08-10T22:30:38.000Z" });
const THREADS = [{ thread_id: "t1", title: "Round five thread", item_count: 2, first_seen_at: "2026-04-26T01:00:00.000Z", last_seen_at: "2026-04-28T01:00:00.000Z", signal_guids: [] }];
const blocks = (items, { checks = CHECKS, threads = [] } = {}) => ({
  signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items },
  connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks },
  threads: { provenance: threads.length ? "derived" : "fixture", fetched_at: NOW, origin: "fixture", items: threads },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [] },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
});
const BILL = { guid: "https://parlinfo.aph.gov.au/r5/bill1", title: "Round Five Amendment Bill 2026", link: "https://parlinfo.aph.gov.au/r5/bill1", pub_date: "2026-09-28T04:00:00.000Z", description: null, attention: "med", confidence: 3 };
const WATCH = { name: "Round five watch", keywordList: ["round"], created: true };
const CLONE = v => JSON.parse(JSON.stringify(v));

// ---- React shim + renderer (as tests/product-truth.test.mjs) ------------------------
function makeContext(storeRef, clip) {
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
  const timers = [];
  const ctx = {
    React, console, ReactDOM: { createRoot: () => ({ render() {} }) },
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { platform: "Win32", clipboard: { writeText: t => { clip.push(String(t)); return Promise.resolve(); } } },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { hostname: "localhost", search: "", hash: "", protocol: "https:" },
    history: { pushState() {}, replaceState() {} },
    document: { createElement: noopEl, body: { appendChild() {} }, getElementById: () => null, querySelector: () => null, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} }, visibilityState: "visible" },
    Blob: class { constructor() {} },
    URL: Object.assign(class extends URL {}, { createObjectURL: () => "blob:test", revokeObjectURL: () => { ctx.__revoked = (ctx.__revoked || 0) + 1; } }),
    fetch: () => new Promise(() => {}),
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  };
  ctx.window = ctx;
  ctx.addEventListener = () => {}; ctx.removeEventListener = () => {};
  ctx.__timers = timers;
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
// The ids of the r5 rows linked inside an html slice, in order.
const ids = html => [...html.matchAll(/href="https:\/\/www\.aph\.gov\.au\/r5\/([^"]+)"/g)].map(m => m[1]);
const between = (html, a, b) => { const i = html.indexOf(a); if (i < 0) return ""; const j = b ? html.indexOf(b, i + a.length) : -1; return html.slice(i, j < 0 ? undefined : j); };

async function run(sources) {
  const storeRef = { value: null };
  const clip = [];
  const { ctx, React } = makeContext(storeRef, clip);
  JSX_FILES.forEach(f => vm.runInContext(sources[f], ctx, { filename: `${f}.js` }));
  const calls = { closeModal: 0, closeSignal: 0 };
  const setStore = (items, { meta = META(), checks, threads, bills = { status: "ready", items: [BILL], total: 52, fetchedAt: NOW_MS } } = {}) => {
    storeRef.value = {
      state: { ...vm.runInContext("STORE_DEFAULTS", ctx), watchlistCreated: [WATCH] },
      liveState: { status: "ready", meta, blocks: ctx.mapLiveBlocks(CLONE(blocks(items, { checks, threads })), CLONE(meta)), fetchedAt: NOW_MS, isRefreshing: false },
      liveBills: bills,
      navigate: () => {}, toast: () => {}, openModal: () => {}, openSignal: () => {}, closeSignal: () => { calls.closeSignal++; }, closeModal: () => { calls.closeModal++; },
      isWatched: () => false, addFeed: () => {}, requestLiveRefresh: () => {}, consumeLiveRefresh: () => false,
      refreshLiveState: () => new Promise(() => {}), setSignalSearchQuery: () => {}, signalSearchQuery: "",
      setVisibleSignalOrder: () => {}, modal: null, signalId: null,
    };
  };
  const r = (C, p = {}) => renderToString(React.createElement(C, p), React);
  const press = async (C, pred) => { const el = findEl(React.createElement(C), React, pred); if (!el) return null; clip.length = 0; el.props.onClick({ preventDefault() {} }); await new Promise(res => setImmediate(res)); return clip.slice(); };
  const out = {};
  // Committees with Worker 0.16.2 hearing dates, and without the field (0.16.1).
  setStore([...COMMITTEE_ROWS, ...HEARINGS]);
  out.committees = r(ctx.PageCommittees);
  setStore([...COMMITTEE_ROWS, ...HEARINGS.filter(h => h.hearing_date)]);
  out.committeesAllDated = r(ctx.PageCommittees);
  setStore([...COMMITTEE_ROWS, ...HEARINGS.map(h => { const { hearing_date, ...rest } = h; return rest; })]);
  out.committeesOld = r(ctx.PageCommittees);
  // Daily program: feed last carried an item on 17 Sep, then today.
  setStore([PROGRAM]);
  out.programOld = r(ctx.PageParliament);
  setStore([PROGRAM], { meta: META(NOW) });
  out.programToday = r(ctx.PageParliament);
  // Bills, sidebar, sources, about, threads.
  setStore(OVERVIEW, { threads: THREADS });
  out.bills = r(ctx.PageBills);
  out.sidebar = r(ctx.Sidebar, { page: "overview", onNavigate: () => {}, mobileOpen: false });
  out.sources = r(ctx.PageSources);
  out.about = r(ctx.ProvenanceMetricsBand, { navigate: () => {} });
  out.threads = r(ctx.PagePatterns);
  out.signals = r(ctx.PageSignals);
  out.overview = r(ctx.PageOverview);
  out.dailyBrief = await press(ctx.PageOverview, p => typeof p.onClick === "function" && /Generate daily brief/.test(renderToString(p.children, React)));
  out.handoff = await press(ctx.PageOverview, p => typeof p.onClick === "function" && p["data-copy-handoff"] === "");
  out.radar = r(ctx.PageRadar);
  // Watchlist modal: seven rows, every one matching "round".
  setStore(WATCH_ROWS);
  out.watch = r(ctx.WatchlistDetail, { id: WATCH.name, titleId: "t", closeButtonRef: { current: null } });
  out.digest = await press(() => ctx.WatchlistDetail({ id: WATCH.name, titleId: "t", closeButtonRef: { current: null } }), p => typeof p.onClick === "function" && /Copy digest/.test(renderToString(p.children, React)));
  // Brief markdown for a live item.
  const live = ctx.mapWorkerSignalToCard(CLONE(OVERVIEW[0]));
  out.brief = ctx.generateBriefMarkdown(live, true);
  out.card = r(ctx.SignalCard, { s: ctx.mapWorkerSignalToCard(CLONE(COMMITTEE_ROWS[1])) });
  out.aphcms = ctx.mapWorkerSignalToCard(CLONE(COMMITTEE_ROWS[4])).link;
  // Live: newest six of an unordered feed.
  const D = ms => new Date(ms);
  out.latest = typeof ctx.latestFeedItems === "function" ? ctx.latestFeedItems([
    { title: "a", date: D(NOW_MS - 40 * DAY) }, { title: "b", date: null }, { title: "c", date: D(NOW_MS - 1 * DAY) },
    { title: "d", date: D(NOW_MS - 300 * DAY) }, { title: "e", date: D(NOW_MS - 2 * DAY) }, { title: "f", date: D(NOW_MS - 3 * DAY) },
    { title: "g", date: D(NOW_MS - 4 * DAY) }, { title: "h", date: D(NOW_MS - 5 * DAY) },
  ]).map(e => e.title).join("") : null;
  out.live = r(ctx.PageLive);
  out.registry = (ctx.SOURCE_REGISTRY || []).map(x => x.label);
  out.csv = typeof ctx.csvEscape === "function" ? ["=SUM(A1)", "+1", "-2", "@x", "plain", "a,b"].map(ctx.csvEscape) : null;
  ctx.__revoked = 0; ctx.__timers.length = 0;
  ctx.exportRowsCSV(["a"], [["b"]], "x.csv");
  out.revokedAtOnce = ctx.__revoked;
  ctx.__timers.forEach(fn => fn());
  out.revokedLater = ctx.__revoked;
  // RouteOverlaySync: effects run on call; one ref persists across renders.
  const ref = { current: true };
  const saved = { useEffect: React.useEffect, useRef: React.useRef };
  React.useEffect = fn => { fn(); }; React.useRef = () => ref;
  calls.closeModal = 0; calls.closeSignal = 0;
  const route = { page: "signals" };
  if (typeof ctx.RouteOverlaySync === "function") {
    ctx.RouteOverlaySync({ routeKey: "#/watchlists", route: { page: "watchlists" } });
    const first = { ...calls };
    ctx.RouteOverlaySync({ routeKey: "#/signals", route });
    const second = { ...calls };
    ctx.RouteOverlaySync({ routeKey: "#/signal/x", route: { page: "signals", signal: "x" } });
    out.route = { first, second, third: { ...calls } };
  } else out.route = null;
  Object.assign(React, saved);
  return out;
}

async function assertAll(sources) {
  const f = [];
  const o = await run(sources);
  // todayhear
  const today = between(o.committees, "Today's hearings</h2>", "</h2>");
  const todayIds = ids(today);
  if (!todayIds.includes("th-today")) f.push(`todayhear: a hearing dated today is missing from Today's hearings (${todayIds.join(",")})`);
  if (todayIds.includes("th-old")) f.push("todayhear: a hearing dated 17 Sep is listed under Today's hearings");
  if (/Today&#39;s House and joint hearings|Today's House and joint hearings<\/span>/.test(today)) f.push("todayhear: the row label still reads \"Today's House and joint hearings\" beside its date");
  // hearings (0.16.2)
  const up = between(o.committees, "data-hearings-upcoming", "data-hearings-held");
  const held = between(o.committees, "data-hearings-held", "data-hearings-undated");
  const undated = between(o.committees, "data-hearings-undated", "Inquiries and reports</h2>");
  if (ids(up).join(",") !== EXPECT_UPCOMING.join(",")) f.push(`hearings: upcoming order is ${ids(up).join(",")}, expected soonest first ${EXPECT_UPCOMING.join(",")}`);
  if (ids(held).join(",") !== EXPECT_HELD.join(",")) f.push(`hearings: Recently held is ${ids(held).join(",")}, expected ${EXPECT_HELD.join(",")}`);
  if (!/Recently held/.test(held)) f.push("hearings: past first-listed hearings are not under a \"Recently held\" heading");
  if (ids(undated).join(",") !== "uh-none") f.push(`hearings: the no-date section holds ${ids(undated).join(",")}, expected uh-none`);
  for (const h of HEARINGS.filter(x => x.hearing_date)) {
    if (!o.committees.includes(`data-hearing-date="${h.hearing_date}"`)) f.push(`hearings: row ${h.guid.split("/").pop()} shows no hearing date`);
  }
  if (!text(up).includes(`Hearing ${hearingText(keyAdd(1))}`)) f.push(`hearings: the next hearing does not read "Hearing ${hearingText(keyAdd(1))}"`);
  const notes = (o.committees.match(/data-hearing-order=""/g) || []).length;
  if (notes !== 1 || !undated.includes('data-hearing-order=""')) f.push(`hearings: the order note shows ${notes} time(s), expected once, beside the undated rows only`);
  if (/data-hearing-order=""/.test(o.committeesAllDated)) f.push("hearings: the order note shows with no undated row");
  const tile = between(o.committees, 'data-stat="hearings"', 'data-stat="inquiries"');
  if (!/Upcoming Senate hearings/.test(tile) || !/>3</.test(tile)) f.push(`hearings: the stat tile does not count the 3 hearings dated today or later (${JSON.stringify(text(tile))})`);
  const oldTile = text(between(o.committeesOld, 'data-stat="hearings"', 'data-stat="inquiries"'));
  if (!/Senate hearing notices/.test(oldTile)) f.push(`hearings: with no hearing_date (Worker 0.16.1) the tile reads ${JSON.stringify(oldTile)}, expected "Senate hearing notices"`);
  if (/Recently held|data-hearings-upcoming/.test(o.committeesOld)) f.push("hearings: Worker 0.16.1 rows render the dated view");
  if (!/data-hearing-order=""/.test(o.committeesOld)) f.push("hearings: Worker 0.16.1 rows lost the order note");
  // heldof
  if (!/latest 3 of 143/.test(text(o.committees))) f.push(`heldof: Inquiries and reports does not say "latest 3 of 143" (${JSON.stringify(text(between(o.committees, 'data-stat="inquiries"', "</div></div>")))})`);
  if (!/latest 6 of 21/.test(text(o.committeesOld))) f.push("heldof: Senate hearing notices does not say \"latest 6 of 21\"");
  // committee
  const reps = text(between(o.committees, "Inquiries and reports</h2>"));
  if (!reps.includes("Senate · Community Affairs") || !reps.includes("Senate · Education and Employment")) f.push("committee: same-titled reports carry no committee name");
  if (o.aphcms !== "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Corporations_and_Financial_Services/OversightASIC/Public_Hearings") f.push(`committee: an aphcms link maps to ${o.aphcms}`);
  // program
  if (o.programOld.includes("Daily Program: Wednesday, 16 September 2026")) f.push("program: a program last carried on 17 Sep shows as current");
  if (!text(o.programOld).includes(`seen on ${dayMon(Date.parse(PROGRAM_OLD_SEEN))}`)) f.push("program: the empty state does not name the day the program was last seen");
  if (!o.programToday.includes("Daily Program: Wednesday, 16 September 2026")) f.push("program: a program the feed carried today is hidden");
  // bills
  const stamp = (() => { const t = Date.parse(DIGEST_LAST_OK); const p = {}; for (const x of new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t))) p[x.type] = x.value; const b = bne(t); return `${p.hour}:${p.minute} AEST, ${Number(b.day)} ${MONTHS[Number(b.month) - 1]} ${b.year}`; })();
  if (!text(o.bills).includes(`Bills Digest feed failing since ${stamp}; list as at then`)) f.push(`bills: a failing Bills Digests feed does not say "failing since ${stamp}"`);
  if (/class="chip-fixture chip-live"/.test(between(o.bills, "page-head", "Tracked bills"))) f.push("bills: the Live chip shows while the Bills Digests feed fails");
  if (!text(o.bills).includes("1 of 52 bills")) f.push("bills: the header does not say \"1 of 52 bills\" when the Worker holds 52");
  if (!/\/bills\?limit=200/.test(sources.store)) f.push("bills: the store does not request limit=200");
  if (/Related divisions/.test(o.bills) || !/Recent House divisions/.test(o.bills)) f.push("bills: the divisions panel still claims to be related to the bills");
  // sidebar
  if (!text(o.sidebar).includes("2 of 3 feeds healthy")) f.push(`sidebar: with one feed failing it does not say "2 of 3 feeds healthy"`);
  if (/Official feeds connected/.test(o.sidebar)) f.push("sidebar: says Official feeds connected while a feed fails");
  // overview
  const ov = text(o.overview);
  if (/All priority signals actioned/.test(ov) || /PRIORITY CLEAR|Priority clear/.test(ov)) f.push("overview: says all priority signals actioned with nothing actioned");
  if (!ov.includes("No high-attention items in the current feeds.")) f.push("overview: the empty priority state does not say there are no high-attention items");
  if (/<span class="unit">clear<\/span>/.test(o.overview)) f.push("overview: the hero unit still reads clear");
  const newest = ids(between(o.overview, "data-newest-signals", "panel-foot"));
  if (newest.join(",") !== EXPECT_NEWEST3.join(",")) f.push(`overview: Newest signals is ${newest.join(",")}, expected ${EXPECT_NEWEST3.join(",")}`);
  const tl = ids(between(o.overview, 'class="timeline"', "Briefing queue"));
  if (tl.join(",") !== EXPECT_TIMELINE.join(",")) f.push(`overview: What changed runs ${tl.join(",")}, expected newest first ${EXPECT_TIMELINE.join(",")}`);
  const brief = (o.dailyBrief || [])[0] || "";
  if (!brief) f.push("overview: Generate daily brief copied nothing");
  if (/^- \[https?:|^### https?:/m.test(brief)) f.push("overview: the daily brief leads lines with a bracketed raw URL");
  const handoff = (o.handoff || [])[0] || "";
  if (!handoff) f.push("overview: Copy beta handoff copied nothing");
  if (/Six official APH RSS feeds|Representative until pipeline activation|Keep representative chips/.test(handoff)) f.push("overview: the beta handoff carries the old fixed text");
  if (!/3 official APH feeds are polled by the Parliament Pulse service; 2 were healthy at the latest check, 1 failing/.test(handoff)) f.push(`overview: the beta handoff does not state the live feed health (${JSON.stringify(handoff.split("\n").slice(3, 6))})`);
  // brief
  const scoringLine = OVERVIEW[0].scoring_explanation;
  if (o.brief.split(scoringLine).length - 1 !== 1) f.push(`brief: the live scoring line prints ${o.brief.split(scoringLine).length - 1} times, expected once`);
  if (!/^## Scoring$/m.test(o.brief)) f.push("brief: a live item's summary is not titled Scoring");
  if (/Priority: MED/.test(o.brief) || !/Attention: Medium/.test(o.brief)) f.push("brief: the header reads Priority: MED instead of Attention: Medium");
  // watchlist
  if (!text(o.watch).includes(`Showing 5 of ${WATCH_ROWS.length}`)) f.push("watchlist: no Showing N of M line");
  if (ids(o.watch).length !== 5) f.push(`watchlist: the modal lists ${ids(o.watch).length} rows, expected 5 before Show all`);
  const digest = (o.digest || [])[0] || "";
  if (!digest) f.push("watchlist: Copy digest copied nothing");
  for (const s of WATCH_ROWS) if (!digest.includes(s.link)) { f.push(`watchlist: the digest leaves out ${s.guid.split("/").pop()}`); break; }
  if (/Save config/.test(o.watch) || /Save config/.test(sources["store-detail"])) f.push("watchlist: Save config still ships");
  if (/r5\/ov-[a-z0-9]+ \xB7/.test(text(o.watch))) f.push("watchlist: a row's metadata line is its raw URL");
  // route
  if (!o.route) f.push("route: no RouteOverlaySync in app.js");
  else {
    if (o.route.first.closeModal !== 0) f.push("route: the first render closed a modal");
    if (o.route.second.closeModal !== 1 || o.route.second.closeSignal !== 1) f.push(`route: a route change did not close the modal and drawer (${JSON.stringify(o.route.second)})`);
    if (o.route.third.closeSignal !== 1) f.push("route: a #/signal/ route closed the drawer it opens");
  }
  if (!/const onHash = \(\) => \{[\s\S]{0,200}setMobileNavOpen\(false\)/.test(sources.app)) f.push("route: Back does not close the phone menu");
  // live
  if (o.latest !== "cefgha") f.push(`live: each feed keeps ${JSON.stringify(o.latest)}, expected its six newest, "cefgha"`);
  if (!/return latestFeedItems\(out\);/.test(sources["pages-today"])) f.push("live: the feed parser does not keep each feed's newest items");
  if (/Today's House and joint hearings/.test(o.card) || !/House and joint hearings/.test(o.card)) f.push("todayhear: a signal card labels a 17 Sep hearing with the feed name \"Today's ...\"");
  if (/refreshes every 2 min/.test(o.live)) f.push("live: the footer still says the feeds refresh every 2 min");
  const WORKER_LABELS = new Set(["New Senate inquiries", "Senate reports tabled", "Upcoming Senate hearings", "Senators' details updates", "House media releases", "House committee inquiries", "Joint committee inquiries", "Bills Digests", "House divisions", "House daily program", "Today's House and joint hearings", "Today's Senate hearings", "House news"]);
  const odd = o.registry.filter(l => !WORKER_LABELS.has(l));
  if (odd.length) f.push(`live: registry labels the Worker never sends: ${odd.join(", ")}`);
  // threads
  if (!/first seen 26 Apr · last seen 28 Apr/.test(text(o.threads))) f.push(`threads: the range is not labelled first seen / last seen`);
  if (!/the 1 largest threads/.test(text(o.threads))) f.push("threads: the count does not say these are the largest threads");
  // sources
  if (!/Items in latest poll/.test(o.sources) || /<th class="num">Items parsed<\/th>/.test(o.sources)) f.push("sources: the column is not \"Items in latest poll\"");
  if (!text(between(o.sources, 'data-feed-row="Senate reports tabled"', "</tr>")).includes("items last seen 20 Sep")) f.push("sources: the row does not say when its feed last carried items");
  // about
  if (/<strong>On<\/strong><span>Human review/.test(o.about) || !/<strong>Yours<\/strong><span>Human review/.test(o.about)) f.push("about: Human review still reads On");
  // radar is canaried in analytics-honesty.test.mjs
  // a11y / security, static
  const html = sources["index.html"];
  if (!/<html lang="en-AU">/.test(html)) f.push("a11y: <html lang> is not en-AU");
  if (!/\.btn\.nav-toggle \{ display: none;/.test(html) || !/\.btn\.nav-toggle \{ display: inline-flex; \}/.test(html)) f.push("a11y: .nav-toggle loses to the later .btn rule, so it shows at desktop widths");
  if (!/\.page-title:focus-visible \{[^}]*width: fit-content/.test(html)) f.push("a11y: the heading focus box spans the content width");
  if (!/\.g-overview \{ grid-template-columns: 2\.4fr 1fr; align-items: start; \}/.test(html) || !/\.g-2 \{ grid-template-columns: repeat\(2, 1fr\); align-items: start; \}/.test(html)) f.push("layout: two-column grids stretch the short column");
  if (!/React\.createElement\("header", \{ className: "topbar" \}/.test(sources.shell)) f.push("a11y: the top bar is not a header landmark");
  const inbox = o.signals;
  const h2 = inbox.indexOf('<h2 class="sr-only">Signals</h2>'), h3 = inbox.indexOf("<h3 ");
  if (h2 < 0 || (h3 >= 0 && h2 > h3)) f.push("a11y: the Signal inbox jumps from h1 to h3");
  if (!/function fmtClock\(\) \{\s*return \(\/\* @__PURE__ \*\/ new Date\(\)\)\.toLocaleTimeString\("en-AU", \{ timeZone: "Australia\/Brisbane"/.test(sources.shell)) f.push("clock: the top-bar clock reads the viewer's zone");
  if (!/" AEST"|\{clock\} AEST|clock, " AEST"/.test(sources.shell)) f.push("clock: the top-bar clock carries no AEST label");
  if (!o.csv || o.csv.join("|") !== `'=SUM(A1)|'+1|'-2|'@x|plain|"a,b"`) f.push(`csv: formula cells are not neutralised (${JSON.stringify(o.csv)})`);
  if (o.revokedAtOnce !== 0 || o.revokedLater !== 1) f.push(`csv: the download URL is revoked straight after the click (at once ${o.revokedAtOnce}, later ${o.revokedLater})`);
  if (!/sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups"/.test(sources["pages-today"])) f.push("sec: the YouTube iframe has no sandbox");
  const hdr = sources["_headers"];
  if (/^\/\*\.jsx$/m.test(hdr)) f.push("sec: _headers still serves /*.jsx as text/javascript");
  if (/ytimg\.com/.test(hdr) || /frame-src[^;]*https:\/\/www\.youtube\.com/.test(hdr)) f.push("sec: the CSP allows YouTube origins the page never uses");
  if (!/frame-src https:\/\/www\.youtube-nocookie\.com;/.test(hdr)) f.push("sec: the CSP no longer allows the nocookie embed");
  return f;
}

// ---- canaries --------------------------------------------------------------------
// m: [file, from, to] or a list of them, applied to the in-memory sources.
const CANARIES = [
  ["todayhear: a hearing dated 17 Sep", ["pages-workspace", "HEARING_LABELS.has(s.source) && hearingDayKey(s) === today", "HEARING_LABELS.has(s.source)"]],
  ["todayhear: the row label", ["store", "return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : l;", "return l;"]],
  ["hearings: upcoming order", ["pages-workspace", "upcoming: dated.filter((s) => s.hearingDate >= today).sort((a, b) => a.hearingDate.localeCompare(b.hearingDate))", "upcoming: dated.filter((s) => s.hearingDate >= today)"]],
  ["hearings: upcoming order", ["pages-workspace", "upcoming: dated.filter((s) => s.hearingDate >= today)", "upcoming: dated.filter((s) => true)"]],
  ["todayhear: a signal card", ["shell", '"\\xB7 ", feedDisplayName(s.source))', '"\\xB7 ", s.source)']],
  ["hearings: row uh-past", ["store", 'hearingDate: parseHearingDay(row.hearing_date),', "hearingDate: null,"]],
  ["hearings: the next hearing", ["pages-workspace", "const hearing = s.hearingDate ? fmtHearingDay(s.hearingDate) : null;", "const hearing = null;"]],
  ["hearings: past first-listed", ["pages-workspace", '"Recently held")', '"Earlier")']],
  ["hearings: the order note shows", [["pages-workspace", "hearings.undated.length > 0 && /* @__PURE__ */", "true && /* @__PURE__ */"], ["pages-workspace", "const hearingsOrder = hearingOrderNote(upcomingHearings);", "const hearingsOrder = hearingOrderNote(hearingRows);"]]],
  ["hearings: the stat tile", ["pages-workspace", '"dated today or later")', '"dated")'], { also: ["pages-workspace", "hearings.upcoming.length), /* @__PURE__ */ React.createElement(\"div\", { className: \"stat-meta\" }", "hearingRows.length), /* @__PURE__ */ React.createElement(\"div\", { className: \"stat-meta\" }"] }],
  ["hearings: with no hearing_date", ["pages-workspace", '"Senate hearing notices"', '"Upcoming Senate hearings"']],
  ["heldof: Inquiries", ["store", 'if (!known || !(available > held)) return "";', 'return "";']],
  ["committee: same-titled", ["store", "committee: committeeFromLink(link),", "committee: null,"]],
  ["committee: an aphcms link", ["store", "const link = safeHttpUrl(canonicalAphLink(row.link));", "const link = safeHttpUrl(row.link);"]],
  ["program: a program last carried", ["pages-workspace", "const programToday = !programKnown ||", "const programToday = true ||"]],
  ["bills: a failing Bills Digests", ["pages-workspace", 'const digestFailing = !!digestCheck && feedHealthState(digestCheck) === "failed";', "const digestFailing = false;"]],
  ["bills: the header does not say", ["pages-workspace", "live.total != null && live.total > bills.length ?", "false ?"]],
  ["bills: the store does not request", ["store", "/bills?limit=200", "/bills?limit=50"]],
  ["bills: the divisions panel", ["pages-workspace", '"Recent House divisions"', '"Related divisions"']],
  ["sidebar: with one feed failing", ["shell", "const allHealthy = !health || health.failed === 0 && health.pending === 0;", "const allHealthy = true;"]],
  ["overview: says all priority", ["pages-today", '{ icon: "check", kicker: "None" }, "No high-attention items in the current feeds.")', '{ icon: "check", kicker: "Priority clear" }, "All priority signals actioned.")']],
  ["overview: Newest signals", ["pages-today", "priority.length === 0 && newest.length > 0 &&", "false &&"]],
  ["overview: What changed runs", ["pages-today", "sortSignalsNewestFirst(live.items).slice(0, 6)", "live.items.slice(0, 6)"]],
  ["overview: the daily brief leads", ["pages-today", "return `- ${brief.isLive ? \"\" : `[${brief.meta.id}] `}", "return `- ${false ? \"\" : `[${brief.meta.id}] `}"]],
  ["overview: the beta handoff does not state", ["pages-today", "const feedLine = health ?", "const feedLine = false ?"]],
  ["brief: the live scoring line", ["shell", "whyItMatters: s.attentionReason && s.attentionReason !== s.summary ? s.attentionReason : \"\",", "whyItMatters: s.attentionReason,"]],
  ["brief: a live item's summary", ["shell", 'summaryHeading: isLive ? "Scoring" : "Summary"', 'summaryHeading: "Summary"']],
  ["brief: the header reads", ["shell", "Attention: ${attentionWord(brief.meta.attention) || NOT_SUPPLIED}", "Priority: ${(brief.meta.attention || NOT_SUPPLIED).toUpperCase()}"]],
  ["watchlist: no Showing", ["store-detail", "matchingAll.length > matchingSignals.length &&", "false &&"]],
  ["watchlist: the digest leaves out", ["store-detail", "${matchingAll.map((s) => `- ${s.link ?", "${matchingSignals.map((s) => `- ${s.link ?"]],
  ["watchlist: Save config", ["store-detail", '/* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => {', '/* @__PURE__ */ React.createElement("button", { className: "btn" }, "Save config"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => {']],
  ["route: a route change did not close", ["app", "    closeModal();\n    if (!route.signal) closeSignal();", "    if (!route.signal) closeSignal();"]],
  ["route: a #/signal/ route closed", ["app", "if (!route.signal) closeSignal();", "closeSignal();"]],
  ["route: Back does not close", ["app", "      if (r) setRoute(r);\n      setMobileNavOpen(false);", "      if (r) setRoute(r);"]],
  ["live: the feed parser does not keep", ["pages-today", "return latestFeedItems(out);", "return out.slice(0, 6);"]],
  ["watchlist: a row's metadata line", ["store-detail", '[feedDisplayName(s.source), s.committee, signalWhen(s)].filter(Boolean).join(" \\xB7 ")', '`${s.id} \\xB7 ${s.source}`']],
  ["live: each feed keeps", ["pages-today", "return (a.t == null) - (b.t == null) || ((_a = b.t) != null ? _a : 0) - ((_b = a.t) != null ? _b : 0) || a.i - b.i;", "return 0;"]],
  ["live: the footer still says", ["pages-today", "This panel re-reads the APH feeds every 2 min, apart from the service's own poll", "Official APH RSS feeds \\xB7 refreshes every 2 min"]],
  ["live: registry labels", ["data", 'label: "Senate reports tabled"', 'label: "Senate Committee Reports Tabled"']],
  ["threads: the range is not labelled", ["pages-workspace", '"first seen ", fmtSpanDate(t.firstSeenAt), " \\xB7 last seen "', 'fmtSpanDate(t.firstSeenAt), " \\u2192 "']],
  ["threads: the count does not say", ["pages-workspace", "`the ${threads.items.length} largest threads`", "`${threads.items.length} threads`"]],
  ["sources: the column is not", ["pages-reference", '{ className: "num" }, "Items in latest poll")', '{ className: "num" }, "Items parsed")']],
  ["sources: the row does not say", ["pages-reference", "const at = feedLastSeenAt(fresh, c.feedLabel);", "const at = null;"]],
  ["about: Human review still reads On", ["pages-reference", 'value: "Yours"', 'value: "On"']],
  ["a11y: <html lang>", ["index.html", '<html lang="en-AU">', '<html lang="en">']],
  ["a11y: .nav-toggle loses", ["index.html", "  .btn.nav-toggle { display: none; flex: none; }", "  .nav-toggle { display: none; flex: none; }"]],
  ["a11y: the heading focus box", ["index.html", "border-radius: 2px; width: fit-content; }", "border-radius: 2px; }"]],
  ["layout: two-column grids", ["index.html", ".g-2 { grid-template-columns: repeat(2, 1fr); align-items: start; }", ".g-2 { grid-template-columns: repeat(2, 1fr); }"]],
  ["a11y: the top bar is not a header", ["shell", 'React.createElement("header", { className: "topbar" }', 'React.createElement("div", { className: "topbar" }']],
  ["a11y: the Signal inbox jumps", ["pages-today", '/* @__PURE__ */ React.createElement("h2", { className: "sr-only" }, "Signals"), ', ""]],
  ["clock: the top-bar clock reads", ["shell", '{ timeZone: "Australia/Brisbane", hour12: false', "{ hour12: false"]],
  ["csv: formula cells", ["pages-shared", "if (/^[=+\\-@\\t\\r]/.test(text)) text = \"'\" + text;", ""]],
  ["csv: the download URL is revoked", ["pages-shared", "if (url) setTimeout(() => URL.revokeObjectURL(url), 0);", "if (url) URL.revokeObjectURL(url);"]],
  ["sec: the YouTube iframe has no sandbox", ["pages-today", 'sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",', ""]],
  ["sec: _headers still serves /*.jsx", ["_headers", "\n/*.js\n", "\n/*.jsx\n  Content-Type: text/javascript; charset=utf-8\n\n/*.js\n"]],
  ["sec: the CSP allows YouTube origins", ["_headers", "img-src 'self' data:;", "img-src 'self' data: https://i.ytimg.com;"]],
];

let failures = 0;
for (const [expect, mm, opt] of CANARIES) {
  const list = Array.isArray(mm[0]) ? mm : [mm];
  if (opt && opt.also) list.push(opt.also);
  const changed = { ...SOURCES };
  let ok = true;
  for (const [file, a, b] of list) {
    if (changed[file].split(a).length - 1 !== 1) { console.error(`CANARY BUILD ERROR: "${expect}" mutation did not apply once to ${file}: ${JSON.stringify(a.slice(0, 80))}`); failures++; ok = false; break; }
    changed[file] = changed[file].replace(a, b);
  }
  if (!ok) continue;
  let got;
  try { got = await assertAll(changed); } catch (e) { got = [`THREW ${e.message}`]; }
  if (process.env.PP_DEBUG) console.log(`canary "${expect}":\n  ${got.join("\n  ")}`);
  if (!got.some(m => m.startsWith(expect))) { console.error(`CANARY MISS: "${expect}" (got ${JSON.stringify(got)})`); failures++; }
}
if (failures) { console.error("REVIEW ROUND 5: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${CANARIES.length} scratch-copy regressions each failed the assertions for their own reason.`);

const real = await assertAll(SOURCES);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }
if (failures) { console.error(`\nREVIEW ROUND 5: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("REVIEW ROUND 5: PASSED. Today's hearings holds only today's rows; Senate hearings run soonest first with their dates, past first-listed hearings under Recently held, the order note only beside undated rows, and Worker 0.16.1 still renders; capped lists say latest N of M; the Daily program shows only today's program; a failing Bills Digests feed replaces the Live chip; the sidebar counts healthy feeds; the Overview, briefs, handoff and watchlist modal state only what is true; a route change closes overlays; Live keeps each feed's newest items; and the a11y and security fixes hold.");
