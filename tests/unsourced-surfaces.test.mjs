// Unsourced-surfaces test (FE-04: DATA-09, DATA-10, UX-11, UX-17, PR-06, PR-07,
// LEG-04, SEC-09, LEG-10).
//
// Renders the SHIPPED built .js with the same minimal React shim as
// honest-surfaces.test.mjs (createElement builds a plain tree, hooks return their
// initial values, a tiny renderer walks function components to HTML). Every desk
// in NAV, the About page, the signal drawer and the member and committee detail
// modals are rendered twice: against a /state with live rows, and against a
// /state that never loaded. It asserts:
//   (a) with SITE_CONFIG.showUnsourcedSurfaces false, no rendered text or title
//       carries "Representative data", "Sample data", "Illustrative",
//       "Fixture" or "(representative)", and none of the gated surfaces
//       (Parliamentary lines, Processing log, Attention score breakdown, alert
//       rules, Draft Estimates monitor note) renders;
//   (b) no built .js holds "[CONFIRM]", and, outside comments, none holds
//       "Representative data", "(representative)" or "qons: 14";
//   the About page lists every SITE_CONFIG.unavailable entry with its reason and
//   an https://www.aph.gov.au/ link; the contact line renders the interim sentence
//   while SITE_CONFIG.contact is null and a mailto: link once it is set; the
//   privacy text names every localStorage key the bundle uses; the search
//   palette's member source is empty and MemberDetail links to the APH Senators
//   and Members page; and, with no live data, every desk renders a reason and an
//   aph.gov.au link rather than a blank panel.
//
// (c) Canary: the same assertions run against scratch copies of the built bundle
//     (in memory; no file is written) and must FAIL on each: the flag flipped to
//     true, a "[CONFIRM]" placeholder restored, one localStorage key dropped from
//     the privacy list, one unavailable entry dropped from the About page, and the
//     Threads no-data empty state removed.
// (d) Restraint: the committed honest build must PASS, so the instrument is shown
//     to stay silent on a known-good specimen as well as to fire on a bad one.
//
// Run: node tests/unsourced-surfaces.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { readModule } from "../scripts/build-config.mjs";
import { transformSync } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["data", "entities", "icons", "store", "shell", "pages"];
const ALL_FILES = [...FILES, "app"];
// "store" and "pages" are module groups since FE-11 split them (ARCH-11);
// readModule joins a group's built files in load order.
const read = f => readModule(f);

// ---- /state payloads (neutral titles: the word "fixture" must not leak into text) ----
const NOW = new Date().toISOString();
const FEEDS = [
  ["Senate reports tabled", "report"], ["New Senate inquiries", "inquiry"], ["Upcoming Senate hearings", "hearing"],
  ["House committee inquiries", "inquiry"], ["Joint committee inquiries", "inquiry"], ["House divisions", "division"],
  ["House media releases", "media"], ["House daily program", "program"],
];
const sig = (i, [feed, kind]) => ({
  guid: `https://www.aph.gov.au/test-item/${i}`, title: `Test item ${i}`, link: `https://www.aph.gov.au/test-item/${i}`,
  pub_date: NOW, feed_label: feed, source_group: "Senate", kind, attention: ["high", "med", "low"][i % 3], confidence: 3,
  scoring_explanation: "Deterministic score from source and keyword rules.",
});
const LIVE_STATE = {
  signals: { provenance: "live", fetched_at: NOW, origin: "test", items: Array.from({ length: 24 }, (_, i) => sig(i, FEEDS[i % FEEDS.length])) },
  connectors: { provenance: "live", fetched_at: NOW, origin: "test", checks: [{ url: "https://www.aph.gov.au/house/rss/media_releases", checked_at: NOW, ok: 1, status: 200, error: null }] },
  threads: { provenance: "derived", fetched_at: NOW, origin: "test", items: [{ id: "t1", title: "Thread one", item_count: 2, signal_guids: ["https://www.aph.gov.au/test-item/0", "https://www.aph.gov.au/test-item/8"], first_seen_at: NOW, last_seen_at: NOW }] },
  alerts: { provenance: "fixture", fetched_at: NOW, origin: "test", events: [], note: "none" },
  qons: { provenance: "fixture", fetched_at: NOW, origin: "test", items: [], note: "qons table returned no rows" },
};
const LIVE_BILLS = [{ id: "b1", title: "Test Bill 2026", link: "https://www.aph.gov.au/test-bill/1" }];

// NAV desks that must stay on the public build (package FE-04), plus About.
const DESKS = {
  overview: "PageOverview", live: "PageLive", signals: "PageSignals", radar: "PageRadar",
  committees: "PageCommittees", bills: "PageBills", parliament: "PageParliament", patterns: "PagePatterns",
  briefings: "PageBriefings", watchlists: "PageWatchlists", sources: "PageSources", about: "PageAbout",
};
// Desks whose content is the viewer's own work or configuration: their empty state
// explains itself without an APH link. Every other desk must link to aph.gov.au.
const OWN_CONTENT_DESKS = new Set(["briefings", "watchlists"]);

// ---- React shim + renderer (same design as honest-surfaces.test.mjs) ----------
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
    React, console, Date, Math, JSON, Map, Set, Symbol, Promise, Array, Object, String, Number, RegExp, Error,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: { platform: "Win32", clipboard: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { hostname: "localhost", search: "", hash: "" },
    document: { createElement: noopEl, body: { appendChild() {} }, getElementById: () => null, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {} } },
    Blob: class { constructor() {} },
    // A real URL constructor: safeHttpUrl() parses hosts with it, so live links render.
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

// Visible text plus title/aria-label attributes: what a viewer can read. Class
// names (chip-fixture) are styling, not copy, so they are excluded.
function readable(html) {
  const titles = [...html.matchAll(/\s(?:title|aria-label|placeholder)="([^"]*)"/g)].map(m => m[1]);
  const text = html.replace(/<[^>]+>/g, " ");
  return (text + " " + titles.join(" ")).replace(/&quot;/g, '"').replace(/\s+/g, " ");
}

// Load the bundle (optionally with files overridden) and render every surface.
function run(overrides = {}) {
  const src = FILES.map(f => overrides[f] ?? read(f)).join("\n;\n");
  const render = (live) => {
    const storeRef = { value: null };
    const { ctx, React } = makeContext(storeRef);
    vm.runInContext(src, ctx, { filename: "bundle.js" });
    const blocks = live ? ctx.mapLiveBlocks(LIVE_STATE) : null;
    const firstId = live ? blocks.signals.items[0].id : null;
    storeRef.value = {
      state: { ...vm.runInContext("STORE_DEFAULTS", ctx) },
      liveState: live
        ? { status: "ready", blocks, fetchedAt: Date.now(), isRefreshing: false }
        : { status: "error", blocks: null, fetchedAt: null, isRefreshing: false },
      liveBills: live
        ? { status: "ready", items: LIVE_BILLS, fetchedAt: Date.now(), isRefreshing: false }
        : { status: "error", items: null, fetchedAt: null, isRefreshing: false },
      signalId: firstId, modal: null, toasts: [], signalSearchQuery: "", visibleSignalOrder: [],
      navigate: () => {}, toast: () => {}, openModal: () => {}, closeModal: () => {}, openSignal: () => {}, closeSignal: () => {},
      isWatched: () => false, setState: () => {}, setVisibleSignalOrder: () => {}, setSignalSearchQuery: () => {},
      requestLiveRefresh: () => {}, consumeLiveRefresh: () => {}, refreshLiveState: () => {}, refreshLiveBills: () => {},
      liveStateDegradation: ctx.liveStateDegradation,
      assignOwner: () => {}, saveFeedback: () => {}, archive: () => {}, unarchive: () => {}, addWatchlist: () => {},
      removeWatchlist: () => {}, createWatchlist: () => {}, generateBrief: () => {}, addFeed: () => {}, saveNote: () => {},
    };
    const h = React.createElement;
    const out = { desks: {}, errors: [] };
    for (const [id, comp] of Object.entries(DESKS)) {
      try { out.desks[id] = renderToString(h(ctx[comp], {}), React); }
      catch (e) { out.errors.push(`${comp} (${live ? "live" : "no live data"}) threw: ${e.message}`); out.desks[id] = ""; }
    }
    const extra = {
      drawer: () => h(ctx.Drawer, {}),
      sidebar: () => h(ctx.Sidebar, { page: "overview", onNavigate: () => {}, mobileOpen: false }),
      member: () => h(ctx.MemberDetail, { id: "any-member" }),
      committee: () => h(ctx.CommitteeDetail, { id: "econ" }),
    };
    for (const [k, fn] of Object.entries(extra)) {
      try { out[k] = renderToString(fn(), React); }
      catch (e) { out.errors.push(`${k} (${live ? "live" : "no live data"}) threw: ${e.message}`); out[k] = ""; }
    }
    out.siteConfig = vm.runInContext("SITE_CONFIG", ctx);
    out.localKeys = vm.runInContext("typeof LOCAL_STORAGE_KEYS === 'undefined' ? [] : LOCAL_STORAGE_KEYS.map(k => k.key)", ctx);
    out.memberCount = Object.keys(vm.runInContext("ENTITIES.members", ctx)).length;
    out.nav = vm.runInContext("NAV.map(n => n.id)", ctx);
    return out;
  };
  return { live: render(true), empty: render(false), sources: Object.fromEntries(ALL_FILES.map(f => [f, overrides[f] ?? read(f)])) };
}

const BANNED_TEXT = [/Representative data/i, /Sample data/i, /Illustrative/i, /\bFixture\b/i, /\(representative\)/i];
// Matched on the rendered headings and button text, so the About page's
// "Not yet available" list (which names Parliamentary lines) is not a false hit.
const GATED_SURFACES = [/<h2 class="panel-title">Parliamentary lines<\/h2>/, /<h3>Processing log<\/h3>/, /<h3>Attention score breakdown/, /<h2 class="panel-title">Alert rules<\/h2>/, /Draft Estimates monitor note/];
const REQUIRED_DESKS = ["overview", "live", "signals", "radar", "committees", "bills", "parliament", "patterns", "briefings", "watchlists", "sources"];

function stripComments(code) {
  return transformSync(code, { loader: "js", minifyWhitespace: true, legalComments: "none" }).code;
}

function assertions(out) {
  const f = [];
  for (const mode of ["live", "empty"]) {
    const o = out[mode];
    f.push(...o.errors);
    const surfaces = { ...Object.fromEntries(Object.entries(o.desks).map(([k, v]) => [`desk ${k}`, v])), drawer: o.drawer, sidebar: o.sidebar, member: o.member, committee: o.committee };
    for (const [name, html] of Object.entries(surfaces)) {
      const text = readable(html);
      for (const re of BANNED_TEXT) if (re.test(text)) f.push(`${name} (${mode}) renders "${text.match(re)[0]}"`);
      for (const re of GATED_SURFACES) if (re.test(html)) f.push(`${name} (${mode}) renders the unsourced surface ${re}`);
    }
    // Every public desk stays in NAV.
    for (const d of REQUIRED_DESKS) if (!o.nav.includes(d)) f.push(`NAV lost the ${d} desk`);
    // Members: no invented records reach search or the modal.
    if (o.memberCount !== 0) f.push(`ENTITIES.members holds ${o.memberCount} record(s); the search palette would surface them`);
    if (!o.member.includes('href="https://www.aph.gov.au/Senators_and_Members"')) f.push(`MemberDetail (${mode}) does not link to the APH Senators and Members page`);
    if (/QONs \(30d\)|Hansard mentions/.test(o.member)) f.push(`MemberDetail (${mode}) still renders invented activity counts`);
  }

  // About: every unavailable entry, with its reason and an APH link.
  const about = out.live.desks.about;
  const cfg = out.live.siteConfig;
  if (!cfg || cfg.showUnsourcedSurfaces !== false) f.push(`SITE_CONFIG.showUnsourcedSurfaces is ${cfg && cfg.showUnsourcedSurfaces}, expected false`);
  const unavailable = (cfg && Array.isArray(cfg.unavailable)) ? cfg.unavailable : [];
  const needIds = ["qon", "hansard", "members", "alerts", "lines"];
  for (const id of needIds) if (!unavailable.some(u => u.id === id)) f.push(`SITE_CONFIG.unavailable has no "${id}" entry`);
  for (const u of unavailable) {
    if (!/^https:\/\/www\.aph\.gov\.au\//.test(u.aphUrl || "")) f.push(`unavailable "${u.id}" aphUrl is not an https://www.aph.gov.au/ URL`);
    if (!about.includes(`data-unavailable="${u.id}"`) || !about.includes(u.name) || !about.includes(u.reason) || !about.includes(`href="${u.aphUrl}"`)) {
      f.push(`About page does not list unavailable "${u.id}" with its name, reason and APH link`);
    }
  }

  // Contact: interim sentence while null; nothing else claims a channel.
  if (cfg && cfg.contact == null) {
    if (!about.includes("A public corrections address is being set up. Until it is published, check any item against the linked official APH source.")) f.push("About does not render the interim contact sentence while SITE_CONFIG.contact is null");
    if (/mailto:/.test(about)) f.push("About renders a mailto: link although SITE_CONFIG.contact is null");
  }

  // Privacy: every localStorage key the bundle uses is named, and no streak claim.
  const used = new Set();
  for (const f2 of ALL_FILES) {
    const code = stripComments(out.sources[f2]);
    // A key is any string literal passed to a storage accessor, or assigned to a
    // local `key` that is then passed to one (BetaNotice, OnboardingGuide).
    for (const m of code.matchAll(/(?:LocalStorage|getItem|setItem|removeItem)\(\s*"([^"]+)"/g)) used.add(m[1]);
    for (const m of code.matchAll(/\bkey\s*=\s*"([^"]+)"/g)) used.add(m[1]);
  }
  for (const k of used) {
    if (!out.live.localKeys.includes(k)) f.push(`localStorage key "${k}" is used by the bundle but missing from the privacy list`);
    else if (!about.includes(`>${k}<`)) f.push(`privacy text does not render the localStorage key "${k}"`);
  }
  if (/reading streak/i.test(readable(about))) f.push("privacy text still mentions a reading streak");
  if (!/contacts YouTube \(youtube-nocookie\.com\) only after you press "Load YouTube player"/.test(readable(about))) f.push("privacy text does not state when the YouTube embed contacts YouTube");

  // UX-17: with no live data, every desk says why and links to the APH source.
  for (const d of REQUIRED_DESKS) {
    const html = out.empty.desks[d] || "";
    if (readable(html).trim().length < 40) f.push(`desk ${d} renders a blank panel with no live data`);
    if (!OWN_CONTENT_DESKS.has(d) && !/href="https:\/\/(www\.|parlview\.)?aph\.gov\.au/.test(html)) f.push(`desk ${d} has no aph.gov.au link in its no-live-data state`);
  }
  if (!/No threads held/.test(out.empty.desks.patterns)) f.push("Threads desk shows no empty state when no threads are held");

  // Built bundle text checks.
  for (const f2 of ALL_FILES) {
    const raw = out.sources[f2];
    if (raw.includes("[CONFIRM]")) f.push(`${f2}.js contains "[CONFIRM]"`);
    const code = stripComments(raw);
    for (const lit of ["Representative data", "(representative)", "qons: 14", "qons:14"]) {
      if (code.includes(lit)) f.push(`${f2}.js contains "${lit}" outside comments`);
    }
  }
  return f;
}

let failures = 0;

// ---- (c) canaries: scratch copies of the built bundle must FAIL ----------------
const dataSrc = read("data");
const pagesSrc = read("pages");
const shellSrc = read("shell");
const canaries = [
  { why: "showUnsourcedSurfaces flipped to true", expect: "Parliamentary lines", over: { data: dataSrc.replace("showUnsourcedSurfaces: false", "showUnsourcedSurfaces: true") } },
  { why: "[CONFIRM] placeholder restored", expect: "[CONFIRM]", over: { pages: pagesSrc.replace("A public corrections address is being set up.", "[CONFIRM] A public corrections address is being set up.") } },
  { why: "a localStorage key dropped from the privacy list", expect: "pp-onboarded", over: { pages: pagesSrc.replace(/\{\s*key: "pp-onboarded",[^}]*\},?/, "") } },
  { why: "an unavailable entry dropped from the About page", expect: "unavailable \"qon\"", over: { pages: pagesSrc.replace("items.map((u, i) =>", "items.slice(1).map((u, i) =>") } },
  { why: "Threads empty state removed", expect: "Threads desk shows no empty state", over: { pages: pagesSrc.replace("!threads.items && ", "false && ") } },
  { why: "the Watchlists 'Fixture' chip restored", expect: "renders \"Fixture\"", over: { pages: pagesSrc.replace('"Your keywords"', '"Fixture"') } },
  { why: "drawer processing log ungated", expect: "Processing log", over: { shell: shellSrc.replace(/SITE_CONFIG\.showUnsourcedSurfaces && \/\* @__PURE__ \*\/ React\.createElement\("div", \{ className: "drawer-section" \}, \/\* @__PURE__ \*\/ React\.createElement\("h3", null, "Processing log"\)/, 'true && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Processing log")') } },
];
for (const c of canaries) {
  const changed = Object.entries(c.over).some(([k, v]) => v !== read(k));
  if (!changed) { console.error(`CANARY BUILD ERROR: mutation "${c.why}" did not apply; the source moved.`); failures++; continue; }
  // Each canary must be caught for ITS reason, not by an unrelated failure.
  const got = assertions(run(c.over));
  const hit = got.find(m => m.includes(c.expect));
  if (!hit) { console.error(`CANARY MISS: "${c.why}" was not caught for its own reason (${got.length} other finding(s)${got.length ? ": " + got[0] : ""}).`); failures++; }
  else if (process.env.PP_DEBUG) console.log(`canary "${c.why}" caught: ${hit}`);
}
if (failures > 0) { console.error("UNSOURCED SURFACES: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Canary self-test PASSED: ${canaries.length} scratch-copy regressions each failed the assertions.`);

// ---- behaviour: a configured contact renders as a link ---------------------------
{
  const withMail = run({ data: dataSrc.replace(/contact: null/, 'contact: "corrections@example.org"') });
  if (!withMail.live.desks.about.includes('href="mailto:corrections@example.org"')) { console.error("FAIL  a configured email contact does not render as a mailto: link"); failures++; }
  const withUrl = run({ data: dataSrc.replace(/contact: null/, 'contact: "https://example.org/corrections"') });
  if (!withUrl.live.desks.about.includes('href="https://example.org/corrections"')) { console.error("FAIL  a configured https contact does not render as a link"); failures++; }
}

// ---- (d) restraint: the honest build must pass ------------------------------------
const honest = run();
if (process.env.PP_DEBUG) {
  for (const mode of ["live", "empty"]) {
    const o = honest[mode];
    console.log(mode, Object.fromEntries([...Object.entries(o.desks), ["drawer", o.drawer], ["member", o.member], ["committee", o.committee]].map(([k, v]) => [k, readable(v).length])));
  }
  console.log("drawer shows the live item:", honest.live.drawer.includes("Test item 0"));
}
if (process.env.PP_DUMP) {
  const o = honest[process.env.PP_DUMP_MODE || "live"];
  console.log(readable(o.desks[process.env.PP_DUMP] ?? o[process.env.PP_DUMP] ?? ""));
}
// The renderer must actually reach desk content, or a pass proves nothing.
if (!honest.live.drawer.includes("Test item 0")) { console.error("FAIL  the drawer did not render the live signal; the harness is not reaching it"); failures++; }
if (!honest.live.desks.signals.includes("Test item")) { console.error("FAIL  the Signals desk did not render live rows; the harness is not reaching it"); failures++; }
const real = assertions(honest);
for (const m of real) { console.error(`FAIL  ${m}`); failures++; }

if (failures > 0) { console.error(`\nUNSOURCED SURFACES: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("UNSOURCED SURFACES: PASSED. No sample or illustrative surface renders with the flag off, every desk states why it is empty and links to APH, About lists every unavailable source with its APH link, the contact line is honest, and the privacy text names every localStorage key.");
