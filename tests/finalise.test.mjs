// Finalisation surface test (FE final). Run after npm run build.
// Exit 0 = pass, 1 = fail.
//
// Renders the built .js (in index.html load order) against two /state shapes,
// the current Worker (one connector check per configured feed) and the older
// Worker the deployed service still runs (landing-page checks, no feed count),
// and asserts what a reader sees:
//   when       a timed card published today reads its Brisbane clock; one from
//              an earlier day reads its date ("28 Sep"), never a bare clock;
//              date-only and undated cards print no clock.
//   rest       the Overview "more signals" line counts the inbox honestly: any
//              "in the last 24 hours" figure counts only timed items inside that
//              window, never undated or date-only ones.
//   empty      no empty state says "records are available in this app"; the
//              Today's hearings empty text names its window ("dated today"), so
//              it cannot contradict the Upcoming Senate hearings listed below it.
//   cadence    Sources (both shapes), the feed dialog, About, Overview, the
//              topbar and the Alerts desk claim no fixed "every 30 minutes"
//              check, and nothing promises a false-positive measurement.
//   about      the Official feeds cell is left out when the Worker reports no
//              feed count (no bare dot) and shows the count when it does; the
//              privacy "Last updated" date is PRIVACY_RECORD.date, and the
//              privacy text still hashes to PRIVACY_RECORD.sha256. Change the
//              privacy text and this fails until the date and hash both move.
//   months     no shipped code formats a date with toLocaleDateString or a
//              { month: } option (one formatter, store.jsx), and no rendered
//              surface prints "Sept".
//   addfeed    the Add feed form renders empty inputs with placeholders, never a
//              prefilled real feed.
//   qon        no shipped copy claims ParlInfo "refuses automated access"
//              (re-verified 29 Sep 2026: HTTP 200 to a Chrome user-agent).
//
// Canary-first: each control is removed on an in-memory scratch copy of the
// built .js (the working tree is never touched) and the matching assertion must
// fail there; the unmodified bundle must pass (restraint).

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { transformSync } from "esbuild";
import { root, JSX_FILES } from "../scripts/build-config.mjs";

const readJs = f => fs.readFileSync(path.join(root, `${f}.js`), "utf8");
const SOURCES = Object.fromEntries(JSX_FILES.map(f => [f, readJs(f)]));

// The privacy, terms and disclaimer text as rendered, and the date it carries.
// When the text changes on purpose: set PRIVACY_UPDATED in pages-reference.jsx
// to the date of the change, run this test, and copy the new hash it prints here.
const PRIVACY_RECORD = {
  date: "29 September 2026",
  sha256: "c42ff31957b0f431312f5568d8e4be6665803a86e4da67fcb87c5009ff46fc72",
};

// ---- fixtures ------------------------------------------------------------------
const NOW_MS = Date.now();
const iso = ms => new Date(ms).toISOString();
const NOW = iso(NOW_MS);
const MIN = 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Expected strings are computed here with Intl directly, never with app code.
function parts(ms, timeZone = "Australia/Brisbane") {
  const o = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}
const ymd = (ms, tz) => { const p = parts(ms, tz); return `${p.year}-${p.month.padStart(2, "0")}-${p.day.padStart(2, "0")}`; };
const clock = ms => { const p = parts(ms); return `${p.hour}:${p.minute}`; };
const dayMon = (ms, tz = "Australia/Brisbane") => { const p = parts(ms, tz); return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]}${p.year === parts(NOW_MS).year ? "" : " " + p.year}`; };
const BRIS_MIDNIGHT = Date.parse(`${ymd(NOW_MS)}T00:00:00+10:00`);

const TODAY_TIMED = Math.max(BRIS_MIDNIGHT + MIN, NOW_MS - 5 * MIN);
const YESTERDAY_TIMED = BRIS_MIDNIGHT - 2 * 60 * MIN;        // 22:00 yesterday, Brisbane
const OLD_TIMED = NOW_MS - 3 * 24 * 60 * MIN;
const DATE_ONLY = "2026-09-20";

const sig = (id, extra) => ({
  guid: `https://www.aph.gov.au/finalise/${id}`, title: `Finalise item ${id}`, link: `https://www.aph.gov.au/finalise/${id}`,
  feed_label: "House media releases", source_group: "House", kind: "signal", attention: "med", confidence: 1,
  scoring_explanation: "Deterministic score from source and keyword rules.", first_seen_at: NOW, ...extra,
});
const SIGNALS = [
  sig("high", { pub_date: iso(TODAY_TIMED), attention: "high" }),
  sig("today", { pub_date: iso(TODAY_TIMED) }),
  sig("yesterday", { pub_date: iso(YESTERDAY_TIMED) }),
  sig("old", { pub_date: iso(OLD_TIMED) }),
  sig("undated1", { pub_date: null }),
  sig("undated2", { pub_date: null }),
  sig("dateonly", { pub_date: DATE_ONLY }),
  // Upcoming Senate hearings are listed, and no "Today's ... hearings" item is held.
  sig("upcoming", { pub_date: iso(OLD_TIMED), feed_label: "Upcoming Senate hearings", source_group: "Senate", kind: "hearing" }),
];
const EXPECT_WHEN = {
  today: clock(TODAY_TIMED),
  yesterday: dayMon(YESTERDAY_TIMED),
  old: dayMon(OLD_TIMED),
  dateonly: dayMon(Date.parse(DATE_ONLY), "UTC"),
};
// Non-high items: every signal except "high". Timed inside 24 hours: today, and
// yesterday when 22:00 yesterday is within 24 hours of now.
const REST = SIGNALS.filter(s => s.attention !== "high");
const RECENT = [TODAY_TIMED, YESTERDAY_TIMED, OLD_TIMED].filter(t => NOW_MS - t <= 24 * 60 * MIN).length;

const FEED_CHECKS = [
  { url: "https://www.aph.gov.au/house/rss/media_releases", feed_label: "House media releases", kind: "signal", checked_at: NOW, ok: 1, status: 200, error: null, last_http_status: 200, items_parsed: 12, parse_error: null, last_success_at: NOW },
  { url: "https://www.aph.gov.au/senate/rss/upcoming_hearings", feed_label: "Upcoming Senate hearings", kind: "hearing", checked_at: NOW, ok: 1, status: 200, error: null, last_http_status: 200, items_parsed: 4, parse_error: null, last_success_at: NOW },
];
const LEGACY_CHECKS = [
  { url: "https://parlinfo.aph.gov.au/", checked_at: NOW, ok: 0, status: 403, error: "HTTP 403" },
  { url: "https://www.aph.gov.au/Help/RSS_feeds", checked_at: NOW, ok: 1, status: 200, error: null },
];
const blocks = checks => ({
  signals: { provenance: "live", fetched_at: NOW, origin: "fixture", items: SIGNALS },
  connectors: { provenance: "live", fetched_at: NOW, origin: "fixture", checks },
  threads: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "fixture", events: [] },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "fixture", items: [] },
});
const VARIANTS = {
  current: { blocks: blocks(FEED_CHECKS), meta: { generated_at: NOW, worker_version: "fixture", schema: "state-v1", last_poll_at: iso(NOW_MS - 5 * MIN), last_new_item_at: iso(NOW_MS - 20 * MIN), stale: false } },
  legacy: { blocks: blocks(LEGACY_CHECKS), meta: { generated_at: NOW, worker_version: "0.15.0", schema: "state-v1" } },
};

// ---- React shim + renderer (as tests/freshness.test.mjs) ------------------------
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

function run(sources, variant) {
  const storeRef = { value: null };
  const { ctx, React } = makeContext(storeRef);
  // app.js mounts React into the DOM at load, so the render harness stops before it.
  JSX_FILES.filter(f => f !== "app").forEach(f => vm.runInContext(sources[f], ctx, { filename: `${f}.js` }));
  const v = VARIANTS[variant];
  const mapped = ctx.mapLiveBlocks(JSON.parse(JSON.stringify(v.blocks)), JSON.parse(JSON.stringify(v.meta)));
  storeRef.value = {
    state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
    liveState: { status: "ready", meta: v.meta, blocks: mapped, fetchedAt: NOW_MS, isRefreshing: false },
    liveBills: { status: "ready", items: [], fetchedAt: NOW_MS, isRefreshing: false },
    navigate: () => {}, toast: () => {}, openModal: () => {}, openSignal: () => {}, closeSignal: () => {}, closeModal: () => {},
    isWatched: () => false, addFeed: () => {}, requestLiveRefresh: () => {}, consumeLiveRefresh: () => false,
    refreshLiveState: () => Promise.resolve(), setSignalSearchQuery: () => {}, modal: null, signalId: null,
  };
  const h = React.createElement;
  const r = (C, p = {}) => renderToString(h(C, p), React);
  const cards = {};
  for (const s of mapped.signals.items || []) cards[s.id.split("/").pop()] = r(ctx.SignalCard, { s });
  const feedId = vm.runInContext("APH_FEEDS[0] && APH_FEEDS[0].id", ctx);
  return {
    cards,
    overview: r(ctx.PageOverview), committees: r(ctx.PageCommittees), parliament: r(ctx.PageParliament),
    sources: r(ctx.PageSources), about: r(ctx.PageAbout), topbar: r(ctx.Topbar, { mobileNavOpen: false, setMobileNavOpen: () => {} }),
    alerts: r(ctx.PageWatchlists), feed: feedId ? r(ctx.FeedDetail, { id: feedId, titleId: "t", closeButtonRef: { current: null } }) : "",
    legal: r(ctx.LegalNoticePanel), privacyUpdated: vm.runInContext("PRIVACY_UPDATED", ctx),
  };
}

// Shipped copy only: esbuild's whitespace minifier drops comments, keeps strings.
const shipped = src => transformSync(src, { loader: "js", minifyWhitespace: true, legalComments: "none" }).code;
const sigWhen = html => { const m = html.match(/data-sig-when="">([^<]*)</); return m ? m[1] : null; };
const CLOCK = /\b\d{1,2}:\d{2}\b/;
export function privacyText(legalHtml) {
  return text(legalHtml).replace(/Last updated [^.]*\./, "").trim();
}

// ---- assertions ------------------------------------------------------------------
function assertAll(sources) {
  const f = [];
  let out;
  try { out = { current: run(sources, "current"), legacy: run(sources, "legacy") }; }
  catch (e) { return [`render threw ${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e}`]; }
  const c = out.current;
  // when
  for (const [k, want] of Object.entries(EXPECT_WHEN)) {
    const got = sigWhen(c.cards[k] || "");
    if (got !== want) f.push(`when: ${k} card reads ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }
  for (const k of ["yesterday", "old", "dateonly", "undated1"]) if (CLOCK.test(sigWhen(c.cards[k] || "") || "")) f.push(`when: ${k} card (not from today) prints a clock`);
  // rest
  const rest = (c.overview.match(/data-rest-line="">([\s\S]*?)<\/span>/) || [])[1];
  if (!rest) f.push("rest: Overview has no more-signals line");
  else {
    const t = text(rest);
    const lead = Number((t.match(/^(\d+) more signal/) || [])[1]);
    if (lead !== REST.length) f.push(`rest: line reads "${t}", expected ${REST.length} more signals in the inbox`);
    const m24 = t.match(/(\d+)[^\d]*in the last 24/);
    if (m24 && Number(m24[1]) !== RECENT) f.push(`rest: line reads "${t}"; only ${RECENT} timed item(s) fall in the last 24 hours`);
    if (/^\d+ more signals? in the last 24/.test(t)) f.push(`rest: line counts every non-priority item as the last 24 hours: "${t}"`);
  }
  // empty
  for (const [name, html] of Object.entries({ committees: c.committees, parliament: c.parliament })) {
    const t = text(html);
    if (/records are available in this app|No [a-z ]+ records are available/i.test(t)) f.push(`empty: ${name} says "records are available in this app"`);
    if (/No verified hearings held/.test(t)) f.push(`empty: ${name} kicker "No verified hearings held" contradicts listed hearings`);
    if (!/list no hearings dated today/.test(t)) f.push(`empty: ${name} Today's hearings empty text does not name its window ("dated today")`);
  }
  if (!/Finalise item upcoming/.test(c.committees)) f.push("empty: fixture broken, the upcoming hearing is not listed on Committees");
  // cadence
  const CADENCE = /every 30 minutes|30-minute|checked every 30/i;
  const FPR = /false.positive|measured after 30 days/i;
  for (const [variant, o] of Object.entries(out)) {
    for (const [name, html] of Object.entries({ sources: o.sources, feed: o.feed, about: o.about, overview: o.overview, alerts: o.alerts })) {
      const t = text(html) + " " + (html.match(/title="[^"]*"/g) || []).join(" ");
      if (CADENCE.test(t)) f.push(`cadence: ${variant} ${name} claims a fixed 30-minute check`);
      if (FPR.test(t)) f.push(`cadence: ${variant} ${name} promises a false-positive measurement`);
    }
    if (CADENCE.test(o.topbar)) f.push(`cadence: ${variant} topbar claims a fixed 30-minute check`);
  }
  for (const [file, src] of Object.entries(sources)) {
    const code = shipped(src);
    if (CADENCE.test(code)) f.push(`cadence: ${file}.js ships a fixed 30-minute check claim`);
    if (FPR.test(code)) f.push(`cadence: ${file}.js ships a false-positive measurement promise`);
    // months
    if (/toLocaleDateString|toLocaleString\([^)]*month|month\s*:\s*"(short|long)"/.test(code)) f.push(`months: ${file}.js formats a month outside the shared formatter`);
    // qon
    if (/refuses automated access|403 to automated access/i.test(code)) f.push(`qon: ${file}.js still claims ParlInfo refuses automated access`);
  }
  for (const [variant, o] of Object.entries(out)) for (const [name, html] of Object.entries(o)) {
    if (typeof html === "string" && /\bSept\b/.test(html)) f.push(`months: ${variant} ${name} prints "Sept"`);
  }
  // about
  const cell = html => /data-metric="Official feeds"/.test(html);
  if (cell(out.legacy.about)) f.push("about: Official feeds cell renders although the Worker reports no feed count");
  const curCell = out.current.about.match(/data-metric="Official feeds">[\s\S]*?<strong>([^<]*)<\/strong>/);
  if (!curCell || curCell[1] !== String(FEED_CHECKS.length)) f.push(`about: Official feeds cell reads ${curCell && curCell[1]}, expected ${FEED_CHECKS.length}`);
  if (/<strong>\s*·\s*<\/strong>/.test(out.legacy.about)) f.push("about: a provenance cell shows a bare dot");
  const upd = (c.legal.match(/data-privacy-updated="">([^<]*)</) || [])[1];
  if (upd !== `Last updated ${PRIVACY_RECORD.date}.`) f.push(`about: privacy reads "${upd}", expected "Last updated ${PRIVACY_RECORD.date}."`);
  if (c.privacyUpdated !== PRIVACY_RECORD.date) f.push(`about: PRIVACY_UPDATED is "${c.privacyUpdated}", the recorded privacy date is "${PRIVACY_RECORD.date}"`);
  const hash = crypto.createHash("sha256").update(privacyText(c.legal)).digest("hex");
  if (hash !== PRIVACY_RECORD.sha256) f.push(`about: privacy text changed (sha256 ${hash}); update PRIVACY_UPDATED to the date of the change and PRIVACY_RECORD in this test`);
  // addfeed
  for (const id of ["new-feed-name", "new-feed-url"]) {
    const tag = (c.sources.match(new RegExp(`<input id="${id}"[^>]*>`)) || [""])[0];
    if (!tag) { f.push(`addfeed: no #${id} input`); continue; }
    const val = (tag.match(/ value="([^"]*)"/) || [])[1];
    if (val) f.push(`addfeed: #${id} is prefilled with "${val}"`);
    if (!/ placeholder="[^"]+"/.test(tag)) f.push(`addfeed: #${id} has no placeholder`);
  }
  return f;
}

// ---- canaries --------------------------------------------------------------------
const mut = (file, a, b) => ({ file, a, b });
const CANARIES = [
  { why: "card head shows the clock for every timed item", expect: "when:", m: mut("store", "if (s.dateKind === \"datetime\") return fmtWhenShort(s.pubAt, now);", "if (s.dateKind === \"datetime\") return fmtClockHM(s.pubAt);") },
  { why: "24-hour figure counts every non-priority item", expect: "rest:", m: mut("pages-today", "`, ${restRecent} published in the last 24 hours`", "`, ${rest.length} published in the last 24 hours`") },
  { why: "the old Today's hearings empty sentence", expect: "empty:", m: mut("pages-workspace", "\"The APH feeds of today's House, joint and Senate hearings list no hearings dated today.\"", "\"No hearing records are available in this app for Parliament.\"") },
  { why: "a fixed 30-minute claim on Sources", expect: "cadence:", m: mut("pages-reference", "\"Page reachability\"", "\"Checked every 30 minutes\"") },
  { why: "the false-positive column restored", expect: "cadence:", m: mut("pages-reference", "\"Today\"), /* @__PURE__ */ React.createElement(\"th\", null, \"Check\")", "\"Today\"), /* @__PURE__ */ React.createElement(\"th\", null, \"False positives, measured after 30 days\"), /* @__PURE__ */ React.createElement(\"th\", null, \"Check\")") },
  { why: "Official feeds cell kept with no feed count", expect: "about: Official feeds cell renders", m: mut("pages-reference", "...typeof feedCount === \"number\" ? [{ label: \"Official feeds\", value: feedCount,", "...true ? [{ label: \"Official feeds\", value: feedCount == null ? NO_VALUE : feedCount,") },
  { why: "privacy text edited without moving the date", expect: "about: privacy text changed", m: mut("pages-reference", "and the site sets no cookies.", "and the site sets only essential cookies.") },
  { why: "privacy date moved without a text change", expect: "about: privacy reads", m: mut("pages-reference", "const PRIVACY_UPDATED = \"29 September 2026\";", "const PRIVACY_UPDATED = \"23 July 2026\";") },
  { why: "a locale month formatter in the shared date helper", expect: "months:", m: mut("store", "return withYear ? fmtDayMonYear(t) : fmtDayMon(t);", "return new Date(t).toLocaleDateString(\"en-AU\", { day: \"numeric\", month: \"short\" });") },
  { why: "the Add feed URL prefilled", expect: "addfeed:", m: mut("pages-reference", "const [newUrl, setNewUrl] = useState(\"\");", "const [newUrl, setNewUrl] = useState(\"https://www.aph.gov.au/.../FlagPost/Blog_entries\");") },
  { why: "the ParlInfo refusal claim restored", expect: "qon:", m: mut("data", "\"Parliament Pulse's search of ParlInfo returns no questions on notice, so none are held here.\"", "\"ParlInfo's questions on notice search refuses automated access, so no machine-readable feed can be fetched.\"") },
];

let failures = 0;
if (PRIVACY_RECORD.sha256 === "PENDING") {
  const out = run(SOURCES, "current");
  console.log(`privacy sha256: ${crypto.createHash("sha256").update(privacyText(out.legal)).digest("hex")}`);
}
for (const c of CANARIES) {
  const src = SOURCES[c.m.file];
  if (src.split(c.m.a).length - 1 !== 1) { console.error(`CANARY BUILD ERROR: "${c.why}" did not apply once to ${c.m.file}.js; the source moved.`); failures++; continue; }
  const got = assertAll({ ...SOURCES, [c.m.file]: src.replace(c.m.a, c.m.b) });
  if (process.env.PP_DEBUG) console.log(`canary "${c.why}":\n  ${got.join("\n  ")}`);
  // Caught only when it fails for its own reason, never on a side effect.
  if (!got.some(m => m.startsWith(c.expect))) { console.error(`CANARY MISS: "${c.why}" did not fail with "${c.expect}" (got ${JSON.stringify(got)}).`); failures++; }
}
if (failures) { console.error("FINALISE: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${CANARIES.length} scratch-copy regressions each failed the assertions.`);

const real = assertAll(SOURCES);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }
if (failures) { console.error(`\nFINALISE: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("FINALISE: PASSED. Card heads show the clock only for today and the date otherwise; the 24-hour count excludes undated items; empty states name their window; no fixed 30-minute or false-positive claim ships; About drops the empty feed cell and dates its privacy text truly; one month formatter; the Add feed form uses placeholders; no ParlInfo refusal claim.");
