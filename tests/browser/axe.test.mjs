// Real axe-core accessibility scan (FE-10: A11Y-other:no-axe-gate).
// Run: npm run a11y   Exit 0 = pass, 1 = fail.
//
// Reuses the FE-07 harness: builds dist/ with build-dist.ps1, serves it on
// 127.0.0.1:8080 with the production CSP, answers every Worker call from
// tests/fixtures/, and drives headless Chromium with @axe-core/playwright
// (pinned exact in package.json).
//
// States scanned, each in the dark and the light theme at 1280 and 390 CSS px:
//   every NAV desk (read from the running app's NAV, so it cannot drift)
//   the open signal drawer (first card on the Signal inbox)
//   one open modal (the first feed on Sources)
//   the search palette open with results
//   the mobile navigation open and closed (390 px only: at 1280 px the
//   navigation is a permanent sidebar and has no open or closed state)
// Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa.
// Fails on any violation of impact "serious" or "critical". Moderate and minor
// violations are recorded in the JSON and printed, but do not fail the run.
// The full result is written to tests/browser/out/axe.json (gitignored).
//
// Canary (instruments must prove detection AND restraint): a scratch copy of
// dist/ in the OS temp directory gets a nameless button and an image with no
// alt injected into index.html, is served on 8081, and the same scan must FAIL
// there on button-name and image-alt. The clean build is the restraint half:
// it must pass with zero serious or critical violations. A canary whose
// injection does not apply, or that the scan does not catch, aborts the run as
// untrustworthy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { AxeBuilder } from "@axe-core/playwright";
import { launch, openDesk, navDesks, startServer, root } from "./harness.mjs";

const require = createRequire(import.meta.url);
const AXE_VERSION = require("axe-core/package.json").version;
export const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["dark", "light"];
const WIDTHS = [1280, 390];
const FAIL_IMPACTS = new Set(["serious", "critical"]);
const OUT_DIR = path.join(root, "tests", "browser", "out");
const OUT = path.join(OUT_DIR, "axe.json");

// The Brisbane calendar date of this run, as YYYY-MM-DD.
const brisbaneDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// .signal uses content-visibility: auto, which leaves off-screen cards unpainted,
// and axe cannot measure the contrast of unpainted text. Paint every card for the
// scan, so the whole list is measured, not only the first screen.
const PAINT_ALL = ".signal { content-visibility: visible !important; }";

async function scan(page, { incomplete } = {}) {
  await page.addStyleTag({ content: PAINT_ALL });
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  if (incomplete) incomplete.push(...r.incomplete.map(v => {
    // Why axe could not decide, per node (for contrast: bgGradient, bgImage,
    // bgOverlap, pseudoContent and so on), so the JSON says what was not measured.
    const reasons = {};
    for (const n of v.nodes) for (const c of [...(n.any || []), ...(n.all || []), ...(n.none || [])]) {
      const k = (c.data && c.data.messageKey) || c.id;
      reasons[k] = (reasons[k] || 0) + 1;
    }
    return { id: v.id, impact: v.impact, nodes: v.nodes.length, reasons, sample: v.nodes.slice(0, 3).map(n => n.target.join(" ")) };
  }));
  return r.violations.map(v => ({
    id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags,
    nodes: v.nodes.map(n => ({ target: n.target, summary: (n.failureSummary || "").slice(0, 400), html: (n.html || "").slice(0, 240) })),
  }));
}

// Gradient re-measure. axe cannot decide the contrast of text over a gradient
// (it reports "incomplete: bgGradient"), and most panels and cards here have one.
// So after the main scan, every gradient background is replaced, in place, by a
// flat colour: pass 0 uses each gradient's first colour stop, pass 1 its second,
// and so on up to its last (a stop with transparency is composited over the
// element's own background colour first). axe's color-contrast rule then runs on
// each pass, and a serious or critical result on any pass fails the state. Text
// over a gradient is therefore measured against every colour the gradient passes
// through at its stops. The page is reloaded by the next state's opener.
async function flattenPrepare(page) {
  return page.evaluate(() => {
    const parse = c => {
      let m = c.match(/^rgba?\(([^)]*)\)$/);
      if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
      m = c.match(/^color\(srgb ([^)]*)\)$/);
      if (m) { const v = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v.length > 3 ? v[3] : 1]; }
      if (c === "transparent") return [0, 0, 0, 0];
      return null;
    };
    const over = (top, base) => {
      if (!base || base[3] === 0 || top[3] >= 1) return top;
      const a = top[3] + base[3] * (1 - top[3]);
      const ch = i => (top[i] * top[3] + base[i] * base[3] * (1 - top[3])) / a;
      return [ch(0), ch(1), ch(2), a];
    };
    const css = c => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${+c[3].toFixed(3)})`;
    const list = [];
    let maxStops = 0;
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (!cs.backgroundImage || !cs.backgroundImage.includes("gradient")) continue;
      const stops = (cs.backgroundImage.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)|transparent/g) || []).map(parse).filter(Boolean);
      if (!stops.length) continue;
      const base = parse(cs.backgroundColor);
      list.push({ el, stops: stops.map(x => css(over(x, base))) });
      maxStops = Math.max(maxStops, stops.length);
    }
    window.__ppFlat = list;
    return { elements: list.length, maxStops: Math.min(maxStops, 6) };
  });
}
async function flattenPass(page, i) {
  // Transitions off first: .btn animates its background, and axe would otherwise
  // read a colour halfway between the gradient's old paint and the flat stop.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  await page.evaluate(i => {
    for (const { el, stops } of window.__ppFlat || []) {
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("background-color", stops[Math.min(i, stops.length - 1)], "important");
    }
  }, i);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const r = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  return {
    violations: r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, summary: (n.failureSummary || "").slice(0, 400) })) })),
    undecided: r.incomplete.reduce((n, v) => n + v.nodes.length, 0),
  };
}
async function gradientRemeasure(page) {
  const prep = await flattenPrepare(page);
  const passes = [];
  for (let i = 0; i < prep.maxStops; i++) passes.push({ stop: i, ...(await flattenPass(page, i)) });
  return { gradients: prep.elements, passes };
}

// Every state, in a fixed order. Each opener leaves the page in the state to scan.
function stateList(desks) {
  const list = [];
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      for (const d of desks) list.push({ name: `desk:${d.id}`, theme, width, open: page => openDesk(page, d.id, { theme, width }) });
      list.push({ name: "drawer", theme, width, open: async page => {
        await openDesk(page, "signals", { theme, width });
        await page.click(".signal .sig-open");
        await page.waitForSelector("aside.drawer.on");
        await page.waitForTimeout(400);
      } });
      list.push({ name: "modal", theme, width, open: async page => {
        await openDesk(page, "sources", { theme, width });
        await page.click("[data-feed-open]");
        await page.waitForSelector(".modal", { timeout: 5000 });
        await page.waitForTimeout(400);
      } });
      list.push({ name: "search-palette", theme, width, open: async page => {
        await openDesk(page, "overview", { theme, width });
        await page.fill(".search input", "Fixture");
        await page.waitForSelector("#search-listbox [data-sr-focus]", { timeout: 5000 });
        await page.waitForTimeout(150);
      } });
      if (width === 390) {
        list.push({ name: "mobile-nav-closed", theme, width, open: page => openDesk(page, "overview", { theme, width }) });
        list.push({ name: "mobile-nav-open", theme, width, open: async page => {
          await openDesk(page, "overview", { theme, width });
          await page.click(".nav-toggle");
          await page.waitForSelector("aside.side.mobile-open");
          await page.waitForTimeout(400);
        } });
      }
    }
  }
  return list;
}

const summarise = results => {
  let blocking = 0, other = 0;
  for (const r of results) for (const v of r.violations) (FAIL_IMPACTS.has(v.impact) ? blocking++ : other++);
  return { blocking, other };
};

// ---- canary --------------------------------------------------------------------
function canaryDist(distDir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-axe-canary-"));
  fs.cpSync(distDir, dir, { recursive: true });
  const idx = path.join(dir, "index.html");
  const html = fs.readFileSync(idx, "utf8");
  const specimen = '<button type="button" data-axe-canary="button"></button><img src="favicon.ico" data-axe-canary="img">'
    + '<p data-axe-canary="gradient" style="background-image:linear-gradient(rgb(255,255,255), rgb(250,250,250));color:rgb(200,200,200);margin:0">Canary text on a gradient</p>';
  const next = html.replace(/<body([^>]*)>/i, `<body$1>${specimen}`);
  if (next === html) throw new Error("canary injection did not apply: no <body> tag in dist/index.html");
  fs.writeFileSync(idx, next);
  return dir;
}

// ---- main ----------------------------------------------------------------------
let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
};

const h = await launch();
let canaryDir = null;
try {
  // 1. Canary: the scan must catch an injected nameless button and alt-less image.
  canaryDir = canaryDist(h.distDir);
  const cServer = await startServer(canaryDir, { port: 8081 });
  try {
    const cBase = cServer.url;
    const page = await h.newPage();
    await openDesk(page, "overview", { baseUrl: cBase });
    const present = await page.evaluate(() => document.querySelectorAll("[data-axe-canary]").length);
    if (present !== 3) throw new Error(`canary specimen not in the served page (found ${present} of 3)`);
    const v = await scan(page);
    const g = await gradientRemeasure(page);
    await page.context().close();
    const gradCaught = g.passes.some(ps => ps.violations.some(x => x.id === "color-contrast" && FAIL_IMPACTS.has(x.impact) && x.nodes.some(n => n.target.join(" ").includes("data-axe-canary"))));
    const mainCaughtGradient = v.some(x => x.id === "color-contrast" && x.nodes.some(n => n.target.join(" ").includes('data-axe-canary="gradient"')));
    if (!gradCaught) {
      console.error("CANARY MISS: the gradient re-measure did not flag low-contrast text on an injected gradient. Its clean result is inadmissible.");
      process.exit(1);
    }
    console.log(`PASS  canary: the gradient re-measure fails on grey text over an injected white gradient (the main axe pass ${mainCaughtGradient ? "also flagged it" : "left it undecided, which is why the re-measure exists"})`);
    const ids = new Set(v.filter(x => FAIL_IMPACTS.has(x.impact)).map(x => x.id));
    const caught = ids.has("button-name") && ids.has("image-alt");
    if (!caught) {
      console.error(`CANARY MISS: the scan did not flag the injected specimen as serious or critical (got: ${[...ids].join(", ") || "none"}). The instrument cannot prove detection, so a clean result is inadmissible.`);
      process.exit(1);
    }
    console.log("PASS  canary: the scan fails on an injected nameless button (button-name) and an image with no alt (image-alt)");
  } finally {
    await cServer.close();
  }

  // 2. The clean build: every state, both themes, both widths.
  const page = await h.newPage();
  await openDesk(page, "overview");
  const desks = await navDesks(page);
  const states = stateList(desks);
  const results = [];
  for (const s of states) {
    await s.open(page);
    const incomplete = [];
    const violations = await scan(page, { incomplete });
    const gradient = await gradientRemeasure(page);
    results.push({ state: s.name, theme: s.theme, width: s.width, violations, needsReview: incomplete, gradient });
    const gradBad = [];
    for (const ps of gradient.passes) for (const v of ps.violations.filter(v => FAIL_IMPACTS.has(v.impact))) gradBad.push({ ...v, id: `${v.id} (gradient stop ${ps.stop})` });
    const bad = [...violations.filter(v => FAIL_IMPACTS.has(v.impact)), ...gradBad];
    const detail = bad.map(v => `${v.impact} ${v.id} (${v.nodes.length}): ${v.help}\n        e.g. ${v.nodes[0].target.join(" ")}  ${v.nodes[0].summary.split("\n").slice(0, 3).join(" | ")}`).join("\n      ");
    check(bad.length === 0, `${s.name} ${s.theme} ${s.width}px: ${bad.length} serious or critical`, detail);
    const minor = violations.filter(v => !FAIL_IMPACTS.has(v.impact));
    for (const m of minor) console.log(`      note: ${m.impact} ${m.id} (${m.nodes.length} nodes): ${m.help}`);
  }
  const { blocking, other } = summarise(results);
  const scannedAt = new Date().toISOString();
  const report = {
    tool: "axe-core", axeVersion: AXE_VERSION, tags: TAGS, failImpacts: [...FAIL_IMPACTS],
    scanDate: brisbaneDate(), scannedAt,
    stateCount: results.length,
    desks: desks.map(d => d.id),
    states: [...new Set(states.map(s => s.name))],
    themes: THEMES, widths: WIDTHS,
    totals: {
      serious_or_critical: blocking, moderate_or_minor: other,
      // axe "incomplete": nodes it could not decide automatically (for example text
      // over a gradient). They are not violations and need a human look.
      needs_review_nodes: results.reduce((n, r) => n + r.needsReview.reduce((m, x) => m + x.nodes, 0), 0),
      needs_review_by_rule: results.reduce((acc, r) => { for (const x of r.needsReview) acc[x.id] = (acc[x.id] || 0) + x.nodes; return acc; }, {}),
      // The gradient re-measure: serious or critical contrast failures on any
      // flattened stop, and the contrast nodes axe still could not decide once
      // no gradient remained (the worst pass per state, summed).
      gradient_serious_or_critical: results.reduce((n, r) => n + r.gradient.passes.reduce((m, ps) => m + ps.violations.filter(v => FAIL_IMPACTS.has(v.impact)).length, 0), 0),
      contrast_undecided_after_remeasure: results.reduce((n, r) => n + Math.max(0, ...r.gradient.passes.map(ps => ps.undecided)), 0),
    },
    pageErrors: page.pageErrors,
    results,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${path.relative(root, OUT)}: ${results.length} scanned states, ${blocking} serious or critical, ${other} moderate or minor; ${report.totals.needs_review_nodes} nodes axe could not decide automatically ${JSON.stringify(report.totals.needs_review_by_rule)}; gradient re-measure: ${report.totals.gradient_serious_or_critical} serious or critical, ${report.totals.contrast_undecided_after_remeasure} contrast nodes still undecided`);

  // 3. The About accessibility statement must state this scan's scope truthfully.
  await openDesk(page, "about");
  const stmt = await page.evaluate(() => {
    const el = document.getElementById("about-accessibility");
    if (!el) return null;
    return {
      date: (el.querySelector("[data-axe-scan-date]") || {}).dataset?.axeScanDate || null,
      states: Number((el.querySelector("[data-axe-state-count]") || {}).dataset?.axeStateCount || NaN),
      axe: (el.querySelector("[data-axe-version]") || {}).dataset?.axeVersion || null,
      tags: (el.querySelector("[data-axe-tags]") || {}).dataset?.axeTags || null,
      unmeasured: (el.querySelector("[data-axe-unmeasured]") || {}).dataset?.axeUnmeasured || null,
    };
  });
  check(!!stmt, "About has an accessibility section (#about-accessibility)");
  if (stmt) {
    check(stmt.states === results.length, `About states the scanned state count (${stmt.states}) that this run scanned (${results.length})`);
    check(stmt.axe === AXE_VERSION, `About names the axe-core version (${stmt.axe}) this run used (${AXE_VERSION})`);
    check(stmt.tags === TAGS.join(" "), `About names the rule tags this run used`, `About: ${stmt.tags}; run: ${TAGS.join(" ")}`);
    const residual = report.totals.contrast_undecided_after_remeasure;
    const wantUnmeasured = residual > 0 ? "some" : "none";
    check(stmt.unmeasured === wantUnmeasured, `About says ${stmt.unmeasured === "some" ? "some elements" : "no element"} could not be measured automatically, which matches this run (${residual} contrast nodes undecided after the gradient re-measure)`, `About data-axe-unmeasured=${stmt.unmeasured}, run needs ${wantUnmeasured}`);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(stmt.date || "");
    check(valid && stmt.date <= report.scanDate, `About's scan date (${stmt.date}) is a real date no later than this run (${report.scanDate})`);
    if (valid && stmt.date !== report.scanDate) console.log(`      note: About states the scan of ${stmt.date}; this run is ${report.scanDate}. Update A11Y_SCAN in pages-reference.jsx when the statement is re-issued.`);
    else if (valid) console.log(`PASS  About's scan date matches axe.json scanDate (${report.scanDate})`);
  }
  check(page.pageErrors.length === 0, "no page errors during the scan", page.pageErrors.join("\n      "));
} finally {
  await h.close();
  if (canaryDir) fs.rmSync(canaryDir, { recursive: true, force: true });
}

if (failures) {
  console.error(`\nAXE SCAN: FAIL (${failures} check(s)).`);
  process.exit(1);
}
console.log("\nAXE SCAN: PASS. Zero serious or critical violations in every scanned state; the canary proved detection.");
