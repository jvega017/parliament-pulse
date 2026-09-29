// Browser layout test (FE-07: UX-05, UX-07, UX-13, UX-15, PR-15, LEG-05,
// reflow at 320 px). Run: npm run browser   Exit 0 = pass, 1 = fail.
//
// Builds dist/ with build-dist.ps1, serves it on 127.0.0.1:8080 with the
// production CSP, answers every Worker call from tests/fixtures/, and drives
// headless Chromium (playwright, pinned in package.json).
//
// Assertions, on the clean build:
//   overflow    every NAV desk at 320, 390, 820, 1024 and 1280 px, dark and light:
//               document.documentElement.scrollWidth <= innerWidth + 1.
//   live-clip   Live at 390 and 320 px: the heading, the chamber links, the
//               player card heading and its buttons sit inside the viewport and
//               inside every clipping ancestor, and no text is truncated.
//   first-sig   Overview at 390 px, returning and first visit: the first
//               .signal starts above 700 px.
//   tables      at 390 px the Bills and Sources tables stack (one card per row)
//               and every cell names its column from data-label; Activity by
//               source shows its per-value labels. At 1280 px the tables are
//               ordinary tables and the labels are hidden (restraint).
//   sources-fit Sources with both Worker shapes (tests/fixtures/state.json and
//               state-legacy.json): the table fits its panel at 1280 px and
//               stacks at 390 px, in both themes.
//   player      Live on first load has NO iframe and has made NO request to
//               YouTube; after "Load YouTube player" exactly one iframe exists,
//               its URL is the verified channel's live_stream embed with no
//               autoplay=1, and it is labelled "APH live stream", never as a
//               chamber; each chamber link opens ParlView.
//
// Canaries (scratch copies of dist/ in the OS temp directory, served on 8081;
// the working tree is never touched). Each removes one control, or injects one
// defect, and the matching assertion must FAIL there:
//   wide-element   a 2,000 px wide element injected into index.html (overflow)
//   tablet-topbar  the 1100 px topbar and top-right wraps removed (overflow on Overview at 820 px)
//   ux05-controls  the .g-overview > * { min-width: 0 } rule, the .ds-url wrap and
//                  the lead-cell wrap removed (overflow on Sources at 1280 px;
//                  each alone suffices)
//   lead-wrap      the lead-cell wrap removed (sources-fit: the older-shape Sources
//                  table no longer fits its panel at 1280 px)
//   stack-css      the 640 px stacked-table media block removed (tables)
//   overview-order the page-overview class removed from the Overview (first-sig)
//   card-clip      the Live card's overflow set back to hidden (live-clip)
//   eager-embed    the player starting in embed mode (player)
//   autoplay       autoplay=1 restored on the embed URL (player)
// A canary whose mutation does not apply aborts the run as untrustworthy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch, openDesk, navDesks, startServer } from "./harness.mjs";

// 320, 390 and 1280 are the FE-07 acceptance widths; 820 (tablet portrait) and
// 1024 cover the 781 to 1100 px band where the topbar used to overflow.
const WIDTHS = [320, 390, 820, 1024, 1280];
const THEMES = ["dark", "light"];
const CHANNEL = "UCzx6ti0rql6Q2Dc2zSAPmuA";   // verified 29 Sep 2026 (PR-15)
const PARLVIEW = "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
};

// ---- measurements (each returns a list of problems; empty = pass) -------------
async function overflowProblems(page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  return r.sw <= r.vw + 1 ? [] : [`scrollWidth ${r.sw} > innerWidth ${r.vw}`];
}

async function clipProblems(page, selectors) {
  return page.evaluate(selectors => {
    const out = [];
    const vw = window.innerWidth;
    const found = new Set();
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (!els.length) out.push(`missing: ${sel}`);
      els.forEach(el => found.add(el));
    }
    for (const el of found) {
      const r = el.getBoundingClientRect();
      const name = `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 32)}"`;
      if (r.width === 0 || r.height === 0) { out.push(`${name} has no box`); continue; }
      if (r.left < -1 || r.right > vw + 1) out.push(`${name} outside viewport (left ${Math.round(r.left)}, right ${Math.round(r.right)}, width ${vw})`);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible") out.push(`${name} truncates its text`);
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        const clips = [cs.overflowX, cs.overflowY].some(v => v !== "visible");
        if (!clips) continue;
        const ar = a.getBoundingClientRect();
        if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1) {
          out.push(`${name} clipped by <${a.tagName.toLowerCase()} class="${a.className}">`);
          break;
        }
      }
    }
    return out;
  }, selectors);
}
const LIVE_CLIP_TARGETS = [
  "main .page-title", "[data-live-actions] > *",
  "[data-live-player] .live-card-title", "[data-live-player] .btn",
];

async function firstSignalTop(page) {
  return page.evaluate(() => {
    const s = document.querySelector("main .signal");
    return s ? Math.round(s.getBoundingClientRect().top + window.scrollY) : null;
  });
}

async function tableProblems(page, { stacked }) {
  return page.evaluate(stacked => {
    const out = [];
    const tables = document.querySelectorAll("main table.ds");
    if (!tables.length) out.push("no table.ds on the desk");
    tables.forEach((t, ti) => {
      if (!t.classList.contains("ds-stack")) out.push(`table ${ti} lacks .ds-stack`);
      const trDisplay = getComputedStyle(t.querySelector("tbody tr") || t).display;
      if (stacked && trDisplay !== "block") out.push(`table ${ti} rows do not stack (tr display ${trDisplay})`);
      if (!stacked && trDisplay !== "table-row") out.push(`table ${ti} rows are not table rows at desktop width (${trDisplay})`);
      if (stacked && t.scrollWidth > t.parentElement.clientWidth + 1) out.push(`table ${ti} is wider than its container (${t.scrollWidth} > ${t.parentElement.clientWidth})`);
      t.querySelectorAll("tbody td").forEach((td, i) => {
        const label = td.getAttribute("data-label");
        if (!label) { out.push(`table ${ti} cell ${i} has no data-label`); return; }
        const before = getComputedStyle(td, "::before").content;
        const shows = before && before !== "none" && before !== "normal";
        if (stacked && !td.classList.contains("ds-lead") && before !== JSON.stringify(label)) out.push(`table ${ti} cell ${i} does not show its label "${label}" (::before ${before})`);
        if (!stacked && shows) out.push(`table ${ti} cell ${i} shows a label at desktop width`);
      });
    });
    return out.slice(0, 8);
  }, stacked);
}

async function radarLabelProblems(page, { stacked }) {
  return page.evaluate(stacked => {
    const labels = [...document.querySelectorAll("main .radar-row:not(.radar-head) .radar-mlabel")];
    if (!labels.length) return ["no Activity by source rows with per-value labels"];
    const shown = labels.filter(l => getComputedStyle(l).display !== "none").length;
    if (stacked && shown !== labels.length) return [`${labels.length - shown} of ${labels.length} per-value labels hidden at phone width`];
    if (!stacked && shown) return [`${shown} per-value labels shown at desktop width`];
    return [];
  }, stacked);
}

async function playerProblems(page) {
  const out = [];
  const before = await page.evaluate(() => ({
    iframes: document.querySelectorAll("iframe").length,
    yt: document.querySelectorAll('iframe[src*="youtube"]').length,
    card: !!document.querySelector('[data-live-player="card"]'),
    chambers: [...document.querySelectorAll("[data-chamber-link]")].map(a => ({ id: a.dataset.chamberLink, href: a.href, text: a.textContent.trim() })),
  }));
  if (before.iframes !== 0) out.push(`${before.iframes} iframe(s) in the DOM before the load button is pressed`);
  if (!before.card) out.push("the pre-load card is not shown on first load");
  if (page.fixtureLog.youtube.length) out.push(`YouTube contacted before load: ${page.fixtureLog.youtube[0]}`);
  const ids = before.chambers.map(c => c.id).sort().join(",");
  if (ids !== "federation,house,senate") out.push(`chamber links are "${ids}", expected federation,house,senate`);
  for (const c of before.chambers) if (c.href !== PARLVIEW) out.push(`chamber link ${c.id} opens ${c.href}, not ParlView`);
  const btn = page.locator("[data-load-player]");
  if (await btn.count() !== 1) { out.push("no single 'Load YouTube player' button"); return out; }
  const btnText = (await btn.textContent()).trim();
  if (btnText !== "Load YouTube player") out.push(`load button reads "${btnText}"`);
  await btn.click();
  await page.waitForSelector("iframe", { timeout: 3000 }).catch(() => {});
  const after = await page.evaluate(() => [...document.querySelectorAll("iframe")].map(f => ({ src: f.getAttribute("src"), title: f.getAttribute("title") || "", allow: f.getAttribute("allow") || "" })));
  if (after.length !== 1) { out.push(`${after.length} iframes after pressing load, expected 1`); return out; }
  const f = after[0];
  if (f.src !== `https://www.youtube-nocookie.com/embed/live_stream?channel=${CHANNEL}`) out.push(`embed URL is ${f.src}`);
  if (/autoplay=1/.test(f.src)) out.push("embed URL carries autoplay=1");
  if (/autoplay/.test(f.allow)) out.push(`iframe allow grants autoplay (${f.allow})`);
  if (!/^APH live stream/.test(f.title) || /senate|federation|house of rep/i.test(f.title)) out.push(`embed labelled "${f.title}"`);
  const badge = await page.evaluate(() => (document.querySelector("[data-live-player]") || {}).textContent || "");
  if (/senate|federation chamber|house of rep/i.test(badge)) out.push(`player labels a chamber: "${badge.slice(0, 80)}"`);
  return out;
}

// ---- the clean-build suite -----------------------------------------------------
async function runSuite(h, { baseUrl, only } = {}) {
  const results = {};
  const page = await h.newPage();
  const open = (id, opts) => openDesk(page, id, { ...opts, ...(baseUrl ? { baseUrl } : {}) });

  if (!only || only.includes("overflow")) {
    await open("overview");
    const desks = await navDesks(page);
    const bad = [];
    for (const d of desks) for (const width of WIDTHS) for (const theme of THEMES) {
      await open(d.id, { width, theme });
      const p = await overflowProblems(page);
      if (p.length) bad.push(`${d.id} ${width}px ${theme}: ${p.join("; ")}`);
    }
    results.overflow = { problems: bad, desks: desks.length };
  }
  if (!only || only.includes("live-clip")) {
    const bad = [];
    for (const width of [390, 320]) for (const theme of THEMES) {
      await open("live", { width, theme });
      for (const p of await clipProblems(page, LIVE_CLIP_TARGETS)) bad.push(`${width}px ${theme}: ${p}`);
    }
    results["live-clip"] = { problems: bad };
  }
  if (!only || only.includes("first-sig")) {
    const bad = [];
    const tops = {};
    for (const firstVisit of [false, true]) {
      await open("overview", { width: 390, firstVisit });
      const top = await firstSignalTop(page);
      tops[firstVisit ? "first" : "returning"] = top;
      if (top == null || top >= 700) bad.push(`390px ${firstVisit ? "first visit" : "returning"}: first .signal top ${top}`);
    }
    await open("overview", { width: 320 });
    tops.returning320 = await firstSignalTop(page);
    results["first-sig"] = { problems: bad, tops };
  }
  if (!only || only.includes("tables")) {
    const bad = [];
    for (const [width, stacked] of [[390, true], [1280, false]]) {
      for (const id of ["bills", "sources"]) {
        await open(id, { width });
        for (const p of await tableProblems(page, { stacked })) bad.push(`${id} ${width}px: ${p}`);
      }
      await open("radar", { width });
      for (const p of await radarLabelProblems(page, { stacked })) bad.push(`radar ${width}px: ${p}`);
    }
    results.tables = { problems: bad };
  }
  if (!only || only.includes("sources-fit")) {
    // Both Worker shapes: at 1280 px the Sources table fits its panel without an
    // inner scrollbar; at 390 px it stacks; neither widens the page.
    const bad = [];
    for (const stateFile of ["state.json", "state-legacy.json"]) {
      const p = await h.newPage({ stateFile });
      for (const theme of THEMES) for (const width of [1280, 390]) {
        await openDesk(p, "sources", { width, theme, ...(baseUrl ? { baseUrl } : {}) });
        for (const x of await overflowProblems(p)) bad.push(`${stateFile} ${width}px ${theme}: ${x}`);
        const fit = await p.evaluate(() => [...document.querySelectorAll("main table.ds")].map(t => [t.scrollWidth, t.parentElement.clientWidth]));
        if (!fit.length) bad.push(`${stateFile} ${width}px: no Sources table`);
        for (const [tw, cw] of fit) if (tw > cw + 1) bad.push(`${stateFile} ${width}px ${theme}: table ${tw} px in a ${cw} px panel`);
        if (width === 390) for (const x of await tableProblems(p, { stacked: true })) bad.push(`${stateFile} 390px: ${x}`);
      }
    }
    results["sources-fit"] = { problems: bad };
  }
  if (!only || only.includes("player")) {
    const fresh = await h.newPage();   // a new context: its request log starts empty
    await openDesk(fresh, "live", { width: 1280, ...(baseUrl ? { baseUrl } : {}) });
    results.player = { problems: await playerProblems(fresh) };
    results.player.pageErrors = fresh.pageErrors.slice();
  }
  results.pageErrors = page.pageErrors.slice();
  return results;
}

// ---- canaries --------------------------------------------------------------------
function scratchCopy(dist, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pp-fe07-${name}-`));
  fs.cpSync(dist, dir, { recursive: true });
  return dir;
}
function mutate(dir, file, from, to) {
  const p = path.join(dir, file);
  const s = fs.readFileSync(p, "utf8");
  const n = from instanceof RegExp ? (s.match(new RegExp(from.source, from.flags.includes("g") ? from.flags : from.flags + "g")) || []).length : s.split(from).length - 1;
  if (n < 1) throw new Error(`canary mutation did not apply to ${file}: ${from}`);
  fs.writeFileSync(p, s.replace(from, to));
}
const CANARIES = [
  { name: "wide-element", check: "overflow", only: "overview-390",
    apply: d => mutate(d, "index.html", "<body>", '<body><div data-canary="wide" style="width:2000px;height:1px"></div>') },
  // UX-05 has three independent controls, each sufficient on its own at 1280 px
  // (measured 29 Sep 2026): the grid-item min-width:0 lets the table scroll
  // inside its panel, .ds-url wraps the long feed URLs and the lead cell wraps
  // its label. Removing all three must bring the Sources overflow back.
  { name: "ux05-controls", check: "overflow", only: "sources-1280",
    apply: d => {
      mutate(d, "index.html", ".g-overview > *, .g-briefings > *, .g-live-main > * { min-width: 0; }", "");
      mutate(d, "index.html", ".ds-url { overflow-wrap: anywhere; }", "");
      mutate(d, "index.html", "table.ds td.ds-lead { overflow-wrap: anywhere; min-width: 12rem; }", "");
    } },
  { name: "tablet-topbar", check: "overflow", only: "overview-820",
    apply: d => {
      mutate(d, "index.html", ".topbar { flex-wrap: wrap; row-gap: 8px; }", "");
      mutate(d, "index.html", ".top-right { flex-wrap: wrap; justify-content: flex-end; min-width: 0; }", "");
    } },
  { name: "lead-wrap", check: "sources-fit",
    apply: d => mutate(d, "index.html", "table.ds td.ds-lead { overflow-wrap: anywhere; min-width: 12rem; }", "") },
  { name: "stack-css", check: "tables",
    apply: d => mutate(d, "index.html", "@media (max-width: 640px) {\n    .table-scroll table.ds.ds-stack", "@media (max-width: 1px) {\n    .table-scroll table.ds.ds-stack") },
  { name: "overview-order", check: "first-sig",
    apply: d => mutate(d, "pages.js", 'className: "page page-overview"', 'className: "page"') },
  { name: "card-clip", check: "live-clip",
    apply: d => mutate(d, "index.html", "aspect-ratio: 16 / 9; overflow: visible;", "aspect-ratio: 16 / 9; overflow: hidden;") },
  { name: "eager-embed", check: "player",
    apply: d => mutate(d, "pages.js", 'React.useState("card")', 'React.useState("embed")') },
  { name: "autoplay", check: "player",
    apply: d => mutate(d, "pages.js", "live_stream?channel=${APH_YT_CHANNEL}`", "live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1`") },
];

async function runCanary(h, c) {
  const dir = scratchCopy(h.distDir, c.name);
  try {
    c.apply(dir);
    const server = await startServer(dir, { port: 8081 });
    try {
      if (c.only) {
        // A single desk and width, enough to prove the instrument sees the defect.
        const [id, w] = c.only.split("-");
        const page = await h.newPage();
        await openDesk(page, id, { width: Number(w), baseUrl: server.url });
        return { problems: await overflowProblems(page) };
      }
      const r = await runSuite(h, { baseUrl: server.url, only: [c.check] });
      return r[c.check];
    } finally { await server.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- main ---------------------------------------------------------------------------
const h = await launch();
try {
  console.log("\n=== clean build (restraint: every check must pass) ===");
  const r = await runSuite(h);
  check(r.overflow.problems.length === 0, `no horizontal scroll on any of ${r.overflow.desks} NAV desks at ${WIDTHS.join(", ")} px in ${THEMES.join(" and ")} (${r.overflow.desks * WIDTHS.length * THEMES.length} loads)`, r.overflow.problems.slice(0, 6).join("\n      "));
  check(r["live-clip"].problems.length === 0, "Live at 390 and 320 px: heading, chamber links, player heading and buttons unclipped", r["live-clip"].problems.slice(0, 6).join("\n      "));
  check(r["first-sig"].problems.length === 0, `Overview at 390 px: first signal starts above 700 px (returning ${r["first-sig"].tops.returning}, first visit ${r["first-sig"].tops.first}; 320 px returning ${r["first-sig"].tops.returning320})`, r["first-sig"].problems.join("\n      "));
  check(r.tables.problems.length === 0, "Bills and Sources stack with data-label at 390 px and stay tables at 1280 px; Activity by source labels follow the width", r.tables.problems.join("\n      "));
  check(r["sources-fit"].problems.length === 0, "Sources, current and older Worker shapes: the table fits its panel at 1280 px and stacks at 390 px, both themes", r["sources-fit"].problems.slice(0, 6).join("\n      "));
  check(r.player.problems.length === 0, "Live: no iframe and no YouTube request before 'Load YouTube player'; one APH live stream embed after, verified channel, no autoplay; chambers link to ParlView", r.player.problems.join("\n      "));
  const errs = [...r.pageErrors, ...r.player.pageErrors].filter(e => !/net::ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(e));
  check(errs.length === 0, "no page errors or console errors across the run", errs.slice(0, 4).join("\n      "));

  console.log("\n=== canaries (each must be caught) ===");
  for (const c of CANARIES) {
    let res;
    try { res = await runCanary(h, c); }
    catch (e) { check(false, `canary ${c.name}: could not run (untrustworthy)`, e.message); continue; }
    check(res.problems.length > 0, `canary ${c.name}: the ${c.check} check fails on the mutated build`, "the check stayed silent on a build with its control removed");
    if (res.problems.length) console.log(`      caught: ${res.problems[0]}`);
  }
} finally {
  await h.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL BROWSER LAYOUT CHECKS PASSED");
process.exit(failures ? 1 : 0);
