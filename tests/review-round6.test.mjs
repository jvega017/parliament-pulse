// Review round 6 (5 Oct 2026): frontend defects 8 to 12 of the round-6 review,
// rendered from the built .js against fixture /state blocks with the React shim
// of tests/review-round5.test.mjs. Every surface is checked against BOTH the live
// Worker shape (0.16.1: no hearing rule change, no thread publication dates, no
// threads.total) and the new Worker (0.16.3).
//
//   restline  Overview "N more signals in the inbox" leaves out the three
//             newest signals already shown above it when no item is high
//             attention, and keeps the full count when priority items show.
//   hearcopy  Upcoming Senate hearings describes the Worker's own date rule:
//             0.16.3 and later "its next listed hearing", held rows labelled
//             "Last hearing" and "Every hearing the feed lists ... has passed";
//             0.16.2 and earlier keep "the first one the feed lists" and
//             "First listed". Versions compare numerically (0.16.10 > 0.16.3).
//   items     a one-item thread reads "1 item", never "1 items".
//   threadpub with first_pub_date/last_pub_date the range reads "published A
//             to B" and no ingest time shows; without them (0.16.1, or a
//             hearing thread with no pubDate) it falls back to "first seen /
//             last seen"; with threads.total it says "the N largest of T
//             threads", and without it "the N largest threads".
//   billsempty an empty Bills list says why from the feed's health: a feed that
//             never succeeded is not "returned no bills just now".
//   health    the Overview Source health tile and the topbar Live chip name the
//             failing feed instead of reading a flat "13 feeds".
//
// Canary-first: every control is removed on an in-memory scratch copy (the
// working tree is never touched) and the matching assertion must fail there;
// the unmodified bundle must pass.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { root, JSX_FILES } from "../scripts/build-config.mjs";

const SOURCES = Object.fromEntries(JSX_FILES.map(f => [f, fs.readFileSync(path.join(root, `${f}.js`), "utf8")]));

// ---- dates, computed with Intl directly, never with app code -------------------
const NOW_MS = Date.now();
const iso = ms => new Date(ms).toISOString();
const NOW = iso(NOW_MS);
const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
const bne = ms => { const o = {}; for (const p of new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(ms))) o[p.type] = p.value; return o; };
const T = bne(NOW_MS);
const keyAdd = n => { const d = new Date(Date.UTC(Number(T.year), Number(T.month) - 1, Number(T.day) + n)); return d.toISOString().slice(0, 10); };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hearingText = key => { const [y, m, d] = key.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return `${WD[t.getUTCDay()]} ${d} ${MONTHS[m - 1]}${String(y) === T.year ? "" : " " + y}`; };

// ---- fixtures -------------------------------------------------------------------
const sig = (id, extra) => ({
  guid: `https://www.aph.gov.au/r6/${id}`, title: `Round six item ${id}`, link: `https://www.aph.gov.au/r6/${id}`,
  feed_label: "House media releases", source_group: "House", kind: "signal", attention: "med", confidence: 3,
  scoring_explanation: "Medium attention (45/100). Source: signal (authority 60/100). Scored on authority, recency, novelty, scrutiny.",
  first_seen_at: NOW, pub_date: iso(NOW_MS - 60 * MIN), ...extra,
});
// Five non-high signals: three newest show, two remain.
const OVERVIEW = [
  sig("ov-a", { pub_date: iso(NOW_MS - 9 * DAY) }), sig("ov-b", { pub_date: iso(NOW_MS - 2 * MIN) }),
  sig("ov-c", { pub_date: iso(NOW_MS - 3 * DAY) }), sig("ov-d", { pub_date: null }), sig("ov-e", { pub_date: iso(NOW_MS - 5 * DAY) }),
];
const OVERVIEW_HIGH = [...OVERVIEW, sig("ov-high", { attention: "high" })];
const H = (id, hearing_date) => sig(id, { feed_label: "Upcoming Senate hearings", source_group: "Senate", kind: "hearing", pub_date: null, hearing_date });
const PAST = keyAdd(-5);
const HEARINGS = [H("uh-next", keyAdd(2)), H("uh-past", PAST)];
const feedCheck = (label, extra) => ({ url: `https://www.aph.gov.au/r6/feed/${label.replace(/\W+/g, "_")}`, feed_label: label, kind: "signal", checked_at: NOW, ok: 1, status: 200, error: null, last_http_status: 200, items_parsed: 4, parse_error: null, last_success_at: NOW, ...extra });
const HEALTHY = [feedCheck("House media releases"), feedCheck("Senate reports tabled"), feedCheck("Bills Digests")];
const DIGEST_LAST_OK = "2026-10-03T21:32:42.389Z";
const FAILING = [feedCheck("House media releases"), feedCheck("Senate reports tabled"), feedCheck("Bills Digests", { ok: 0, status: 403, last_http_status: 403, last_success_at: DIGEST_LAST_OK, error: "HTTP 403" })];
// A feed that timed out on every check and never succeeded.
const NEVER = [feedCheck("House media releases"), feedCheck("Senate reports tabled"), feedCheck("Bills Digests", { ok: 0, status: null, last_http_status: null, last_success_at: null, error: "timeout" })];
const META = v => ({ generated_at: NOW, worker_version: v, schema: "state-v1", last_poll_at: NOW, last_new_item_at: NOW, stale: false, feeds: [], signal_counts: {} });
const THREAD_OLD = [
  { thread_id: "t1", title: "Round six thread one", item_count: 1, first_seen_at: "2026-04-26T01:00:00.000Z", last_seen_at: "2026-04-28T01:00:00.000Z", signal_guids: [] },
  { thread_id: "t2", title: "Round six thread two", item_count: 3, first_seen_at: "2026-04-20T01:00:00.000Z", last_seen_at: "2026-04-29T01:00:00.000Z", signal_guids: [] },
];
const THREAD_NEW = [
  { ...THREAD_OLD[0], first_seen_at: NOW, last_seen_at: NOW, first_pub_date: "2026-06-23T04:00:00.000Z", last_pub_date: "2026-08-14T04:00:00.000Z" },
  // A hearing thread: its members carry no pubDate.
  { ...THREAD_OLD[1], first_seen_at: "2026-10-01T01:00:00.000Z", last_seen_at: "2026-10-02T01:00:00.000Z", first_pub_date: null, last_pub_date: null },
];
const blocks = (items, { checks = HEALTHY, threads = [], threadsTotal } = {}) => ({
  signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items },
  connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks },
  threads: { provenance: threads.length ? "derived" : "fixture", fetched_at: NOW, origin: "fixture", items: threads, ...(threadsTotal != null ? { total: threadsTotal } : {}) },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [] },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
});
const CLONE = v => JSON.parse(JSON.stringify(v));

// ---- React shim + renderer (as tests/review-round5.test.mjs) ------------------------
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
    React, console, ReactDOM: { createRoot: () => ({ render() {} }) },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { platform: "Win32", clipboard: { writeText: () => Promise.resolve() } },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { hostname: "localhost", search: "", hash: "", protocol: "https:" },
    history: { pushState() {}, replaceState() {} },
    document: { createElement: noopEl, body: { appendChild() {} }, getElementById: () => null, querySelector: () => null, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} }, visibilityState: "visible" },
    Blob: class { constructor() {} },
    URL: Object.assign(class extends URL {}, { createObjectURL: () => "blob:test", revokeObjectURL: () => {} }),
    fetch: () => new Promise(() => {}),
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
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
const between = (html, a, b) => { const i = html.indexOf(a); if (i < 0) return ""; const j = b ? html.indexOf(b, i + a.length) : -1; return html.slice(i, j < 0 ? undefined : j); };

async function run(sources) {
  const storeRef = { value: null };
  const { ctx, React } = makeContext(storeRef);
  JSX_FILES.forEach(f => vm.runInContext(sources[f], ctx, { filename: `${f}.js` }));
  const setStore = (items, { version = "0.16.1", checks, threads, threadsTotal, bills = { status: "ready", items: [], total: 0, fetchedAt: NOW_MS } } = {}) => {
    const meta = META(version);
    storeRef.value = {
      state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
      liveState: { status: "ready", meta, blocks: ctx.mapLiveBlocks(CLONE(blocks(items, { checks, threads, threadsTotal })), CLONE(meta)), fetchedAt: NOW_MS, isRefreshing: false },
      liveBills: bills,
      navigate: () => {}, toast: () => {}, openModal: () => {}, openSignal: () => {}, closeSignal: () => {}, closeModal: () => {},
      isWatched: () => false, addFeed: () => {}, requestLiveRefresh: () => {}, consumeLiveRefresh: () => false,
      refreshLiveState: () => new Promise(() => {}), setSignalSearchQuery: () => {}, signalSearchQuery: "",
      setVisibleSignalOrder: () => {}, modal: null, signalId: null,
    };
  };
  const r = (C, p = {}) => renderToString(React.createElement(C, p), React);
  const out = {};
  setStore(OVERVIEW); out.overview = r(ctx.PageOverview);
  setStore(OVERVIEW_HIGH); out.overviewHigh = r(ctx.PageOverview);
  for (const v of ["0.16.1", "0.16.2", "0.16.3", "0.16.10", "0.17.0"]) { setStore(HEARINGS, { version: v }); out[`hear-${v}`] = r(ctx.PageCommittees); }
  setStore(OVERVIEW, { threads: THREAD_OLD }); out.threadsOld = r(ctx.PagePatterns);
  setStore(OVERVIEW, { version: "0.16.3", threads: THREAD_NEW, threadsTotal: 40 }); out.threadsNew = r(ctx.PagePatterns);
  setStore(OVERVIEW, { checks: NEVER }); out.billsNever = r(ctx.PageBills);
  setStore(OVERVIEW, { checks: FAILING }); out.billsFailing = r(ctx.PageBills);
  out.overviewFailing = r(ctx.PageOverview);
  out.topFailing = r(ctx.Topbar, { mobileNavOpen: false, setMobileNavOpen: () => {} });
  setStore(OVERVIEW, { checks: HEALTHY }); out.billsHealthy = r(ctx.PageBills);
  out.overviewHealthy = r(ctx.PageOverview);
  out.topHealthy = r(ctx.Topbar, { mobileNavOpen: false, setMobileNavOpen: () => {} });
  return out;
}

async function assertAll(sources) {
  const f = [];
  const o = await run(sources);
  // restline
  const rest = text(between(o.overview, "data-rest-line", "</span>"));
  if (!/^\S*\s*2 more signals in the inbox/.test(rest.replace(/^[^0-9]*/, ""))) f.push(`restline: with the three newest shown above, the rest line reads ${JSON.stringify(rest)}, expected "2 more signals in the inbox"`);
  const restHigh = text(between(o.overviewHigh, "data-rest-line", "</span>")).replace(/^[^0-9]*/, "");
  if (!/^5 more signals in the inbox/.test(restHigh)) f.push(`restline: with a priority item shown and no newest list, the rest line reads ${JSON.stringify(restHigh)}, expected "5 more signals in the inbox"`);
  // hearcopy
  for (const v of ["0.16.3", "0.16.10", "0.17.0"]) {
    const h = o[`hear-${v}`], t = text(h), held = text(between(h, "data-hearings-held", "data-hearings-undated"));
    if (!t.includes("the date shown is its next listed hearing")) f.push(`hearcopy: Worker ${v} does not say "the date shown is its next listed hearing"`);
    if (!held.includes(`Last hearing ${hearingText(PAST)}`)) f.push(`hearcopy: Worker ${v} held row is not labelled "Last hearing ${hearingText(PAST)}" (${JSON.stringify(held.slice(0, 200))})`);
    if (!held.includes("Every hearing the feed lists for these inquiries has passed")) f.push(`hearcopy: Worker ${v} held note does not say every listed hearing has passed`);
    if (/First listed|first one the feed lists|first hearing date the feed lists/.test(t)) f.push(`hearcopy: Worker ${v} still describes the 0.16.2 first-listed rule`);
  }
  for (const v of ["0.16.1", "0.16.2"]) {
    const h = o[`hear-${v}`], t = text(h);
    if (!t.includes("the date shown is the first one the feed lists") || !t.includes(`First listed ${hearingText(PAST)}`)) f.push(`hearcopy: Worker ${v} lost the first-listed wording its rule needs`);
    if (/next listed hearing|Last hearing/.test(t)) f.push(`hearcopy: Worker ${v} shows the 0.16.3 wording`);
  }
  // items
  const tOld = text(o.threadsOld), tNew = text(o.threadsNew);
  if (/\b1 items\b/.test(tOld) || !/\b1 item\b/.test(tOld) || !/\b3 items\b/.test(tOld)) f.push(`items: a one-item thread does not read "1 item" (${JSON.stringify(tOld.slice(0, 160))})`);
  // threadpub
  if (!/published 23 Jun to 14 Aug/.test(tNew)) f.push(`threadpub: with first_pub_date/last_pub_date the range does not read "published 23 Jun to 14 Aug"`);
  const rowNew1 = text(between(o.threadsNew, "Round six thread one", "Round six thread two"));
  const spanNew1 = between(o.threadsNew, 'data-thread-span="published"', "</span>");
  if (!spanNew1 || /first seen/.test(text(spanNew1))) f.push("threadpub: a thread with publication dates still prints its ingest times");
  if (!/first seen 1 Oct · last seen 2 Oct/.test(tNew)) f.push("threadpub: a thread whose members carry no pubDate does not fall back to first seen / last seen");
  if (!/first seen 26 Apr · last seen 28 Apr/.test(tOld)) f.push("threadpub: Worker 0.16.1 threads lost their first seen / last seen range");
  if (!/the 2 largest of 40 threads/.test(tNew)) f.push("threadpub: with threads.total the kicker does not say \"the 2 largest of 40 threads\"");
  if (!/the 2 largest threads/.test(tOld) || /largest of/.test(tOld)) f.push("threadpub: Worker 0.16.1 (no total) does not say \"the 2 largest threads\"");
  void rowNew1;
  // billsempty
  const bn = text(o.billsNever), bf = text(o.billsFailing), bh = text(o.billsHealthy);
  if (/returned no bills just now/.test(bn) || !/has not answered a check successfully yet \(latest: timeout\)/.test(bn)) f.push(`billsempty: a Bills Digest feed that never succeeded reads ${JSON.stringify(text(between(o.billsNever, "data-bills-empty", "</span>")))}`);
  if (/list as at its last success/.test(bn)) f.push("billsempty: the header chip claims a last success the feed never had");
  if (/returned no bills just now/.test(bf) || !/latest check failed \(HTTP 403\)\. It last answered at/.test(bf)) f.push("billsempty: a failing Bills Digest feed with a past success does not say so in the empty state");
  if (!/The Bills Digest feed returned no bills just now/.test(bh)) f.push("billsempty: a healthy feed with no bills lost its plain empty state");
  // health
  const tileF = text(between(o.overviewFailing, "data-source-health", "data-poll-line"));
  if (!/2 of 3 feeds healthy/.test(tileF) || !/Failing: Bills Digests/.test(tileF)) f.push(`health: the Source health tile ignores the failing feed (${JSON.stringify(tileF)})`);
  const tileH = text(between(o.overviewHealthy, "data-source-health", "data-poll-line"));
  if (!/3 feeds/.test(tileH) || /healthy|Failing/.test(tileH)) f.push(`health: the healthy Source health tile changed (${JSON.stringify(tileH)})`);
  const chipF = text(between(o.topFailing, 'data-live-chip="live"', "</button>"));
  if (!/3 feeds, 1 failing/.test(chipF)) f.push(`health: the Live chip ignores the failing feed (${JSON.stringify(chipF)})`);
  const chipH = text(between(o.topHealthy, 'data-live-chip="live"', "</button>"));
  if (!/· 3 feeds$/.test(chipH)) f.push(`health: the healthy Live chip changed (${JSON.stringify(chipH)})`);
  return f;
}

// ---- canaries --------------------------------------------------------------------
const CANARIES = [
  ["restline: with the three newest shown", ["pages-today", "const shownIds = new Set(newestShown ? newest.map((s) => s.id) : []);", "const shownIds = new Set([]);"]],
  ["restline: with a priority item shown", ["pages-today", "const newestShown = !!live.items && priority.length === 0 && newest.length > 0;", "const newestShown = !!live.items && newest.length > 0;"]],
  ["hearcopy: Worker 0.16.3 does not say", ["pages-workspace", 'const hCopy = hearingCopy(useWorkerVersionAtLeast("0.16.3"));', "const hCopy = hearingCopy(false);"]],
  ["hearcopy: Worker 0.16.1 lost", ["pages-workspace", 'const hCopy = hearingCopy(useWorkerVersionAtLeast("0.16.3"));', "const hCopy = hearingCopy(true);"]],
  ["hearcopy: Worker 0.16.10 does not say", ["store", "return have[i] > need[i];", "return String(have[i]) > String(need[i]);"]],
  ["hearcopy: Worker 0.16.3 held row", ["pages-workspace", "hearingLabel: hCopy.heldLabel", 'hearingLabel: "First listed"']],
  ["items: a one-item thread", ["pages-workspace", 't.itemCount, " item", t.itemCount !== 1 ? "s" : "")', 't.itemCount, " items")']],
  ["threadpub: with first_pub_date", ["store", "firstPubDate: row.first_pub_date || null,", "firstPubDate: null,"], { also: ["store", "lastPubDate: row.last_pub_date || null,", "lastPubDate: null,"] }],
  ["threadpub: with threads.total", ["store", "if (Number.isFinite(block.total)) out.total = block.total;", ""]],
  ["threadpub: with threads.total", ["store", "total: Number.isFinite(block == null ? void 0 : block.total) ? block.total : null,", "total: null,"]],
  ["threadpub: a thread whose members", ["pages-workspace", "if (a || b) {", "if (true) {"]],
  ["billsempty: a Bills Digest feed that never", ["pages-workspace", "const emptyBills = digestFailing ?", "const emptyBills = false ?"]],
  ["billsempty: the header chip", ["pages-workspace", '"Bills Digest feed failing; no successful check yet"', '"Bills Digest feed failing; list as at its last success"']],
  ["health: the Source health tile", ["pages-today", "feedHealth && feedHealth.failed > 0 ?", "false ?"]],
  ["health: the Live chip", ["store", 'return items.filter((c) => c && c.isFeed && feedHealthState(c) === "failed").map((c) => c.feedLabel).filter(Boolean);', "return [];"]],
];

let failures = 0;
for (const [expect, mm, opt] of CANARIES) {
  const list = Array.isArray(mm[0]) ? mm : [mm];
  if (opt && opt.also) list.push(opt.also);
  const changed = { ...SOURCES };
  let ok = true;
  for (const [file, a, b] of list) {
    if (changed[file].split(a).length - 1 !== 1) { console.error(`CANARY BUILD ERROR: "${expect}" mutation did not apply once to ${file}: ${JSON.stringify(a.slice(0, 90))}`); failures++; ok = false; break; }
    changed[file] = changed[file].replace(a, b);
  }
  if (!ok) continue;
  let got;
  try { got = await assertAll(changed); } catch (e) { got = [`THREW ${e.message}`]; }
  if (process.env.PP_DEBUG) console.log(`canary "${expect}":\n  ${got.join("\n  ")}`);
  if (!got.some(m => m.startsWith(expect))) { console.error(`CANARY MISS: "${expect}" (got ${JSON.stringify(got)})`); failures++; }
}
if (failures) { console.error("REVIEW ROUND 6: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${CANARIES.length} scratch-copy regressions each failed the assertions for their own reason.`);

const real = await assertAll(SOURCES);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }
if (failures) { console.error(`\nREVIEW ROUND 6: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("REVIEW ROUND 6: PASSED. The Overview rest line leaves out the signals shown above it; the hearing copy follows the Worker's own date rule by version; a one-item thread reads 1 item; thread ranges use publication dates when the Worker sends them and say first seen otherwise, with the largest-of-total count; an empty Bills list says why from the feed's health; and the Source health tile and Live chip name a failing feed.");
