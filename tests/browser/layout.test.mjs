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
//   phone       FE final, 390 px, dark and light: the topbar controls (theme
//               toggle included) share one row; every card's "Confidence n of 5"
//               reads on one line and does not run under the Open button; in the
//               signal drawer the evidence label reads on one line with its
//               address below it at least half the row wide, and the drawer date
//               never breaks inside itself.
//   card-date   round 2, with the Worker 0.16-shaped fixture (tests/fixtures/state.json:
//               8 undated items with a first-seen date): on Overview and Signals at
//               390 and 320 px every card-head date sits inside its card, and in the
//               drawer the date and its "first seen" clause sit inside the drawer.
//               Round 3: at the same widths every drawer footer button (Close
//               included) sits inside the drawer and the viewport, and the footer
//               does not scroll sideways; at 320 px Close used to be clipped.
//   search      round 2, state.json (the poll line shows): at 1280 px the topbar
//               search input is at least 200 px wide on Overview and Sources, and
//               the page does not scroll sideways.
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
//   tablet-topbar  the 1100 px topbar and top-right wraps removed (overflow on Overview at 781 px)
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
//   phone-topbar   the rule that takes Alerts out of the phone topbar removed (phone)
//   phone-conf     the phone two-column card footer removed (phone)
//   ev-row         the evidence label and address put back side by side (phone)
//   drawer-date    the drawer date allowed to break inside itself (phone)
//   card-when      the card head given the long "first seen" label again (card-date)
//   drawer-seen    the drawer date and its first-seen clause joined in one
//                  unbreakable span again (card-date)
//   search-min     the topbar search min-width removed (search)
//   foot-wrap      the drawer footer's flex-wrap removed (card-date: Close clipped at 320 px)
// A canary whose mutation does not apply aborts the run as untrustworthy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch, openDesk, navDesks, startServer, editableDistFile, CANARY_PORT } from "./harness.mjs";

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

// FE final phone polish: one measurement per defect named in the 390 px review.
async function phoneProblems(page, label) {
  const out = await page.evaluate(() => {
    const bad = [];
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none"; };
    const lines = el => { const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6; return Math.round(el.getBoundingClientRect().height / lh); };
    const ctrls = [...document.querySelectorAll(".top-right > *")].filter(el => vis(el) && !el.classList.contains("top-poll"));
    const tops = ctrls.map(el => Math.round(el.getBoundingClientRect().top));
    if (!ctrls.length) bad.push("topbar: no visible controls");
    else if (Math.max(...tops) - Math.min(...tops) > 4) bad.push(`topbar: controls sit on ${new Set(tops).size} rows (tops ${tops.join(", ")}); the theme toggle wraps`);
    if (!document.querySelector(".top-right [aria-label^='Switch to']")) bad.push("topbar: no theme toggle");
    const confs = [...document.querySelectorAll("main .signal .sig-action [data-conf]")];
    if (!confs.length) bad.push("cards: no confidence label on the desk");
    for (const c of confs) {
      if (lines(c) > 1) { bad.push(`cards: "${c.textContent}" wraps onto ${lines(c)} lines`); break; }
      const open = c.parentElement.querySelector(".sig-open");
      const range = document.createRange(); range.selectNodeContents(c); const tr = range.getBoundingClientRect();
      const or = open && open.getBoundingClientRect();
      if (or && tr.right > or.left - 2 && tr.bottom > or.top && tr.top < or.bottom) { bad.push(`cards: "${c.textContent}" runs under the Open button (text right ${Math.round(tr.right)}, Open left ${Math.round(or.left)})`); break; }
      if (tr.right > c.closest(".signal").getBoundingClientRect().right) { bad.push(`cards: "${c.textContent}" overflows its card`); break; }
    }
    return bad;
  });
  // The drawer, opened from the first card.
  await page.click("main .signal .sig-open");
  await page.waitForSelector("aside.drawer.on .ev-link", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  out.push(...await page.evaluate(() => {
    const bad = [];
    const lines = el => { const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6; return Math.round(el.getBoundingClientRect().height / lh); };
    const link = document.querySelector("aside.drawer.on .ev-link");
    if (!link) return ["drawer: no evidence row"];
    const lab = link.querySelector(".ev-label"), url = link.querySelector(".ev-url");
    if (!lab || !url) return ["drawer: evidence row has no label or address"];
    if (lines(lab) > 1) bad.push(`drawer: evidence label "${lab.textContent}" wraps onto ${lines(lab)} lines`);
    if (url.getBoundingClientRect().width < link.getBoundingClientRect().width * 0.5) bad.push(`drawer: evidence address is ${Math.round(url.getBoundingClientRect().width)} px in a ${Math.round(link.getBoundingClientRect().width)} px row`);
    const d = document.querySelector("aside.drawer.on [data-drawer-date]");
    if (!d) bad.push("drawer: no date in the kicker");
    else if (lines(d) > 1) bad.push(`drawer: the date "${d.textContent}" breaks across lines`);
    return bad;
  }));
  await page.keyboard.press("Escape");
  return out.map(x => `${label}: ${x}`);
}

// Round 2: card-head dates inside their cards, and the drawer date inside the drawer.
async function cardDateProblems(page) {
  return page.evaluate(() => {
    const bad = [];
    const times = [...document.querySelectorAll("main .signal .sig-time")];
    if (!times.length) bad.push("no card-head dates on the desk");
    if (!times.some(t => /Date not supplied/.test(t.textContent))) bad.push("no undated card on the desk (the fixture must carry one)");
    for (const t of times) {
      const card = t.closest(".signal").getBoundingClientRect();
      const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect();
      if (tr.right > card.right - 1 || tr.left < card.left) bad.push(`card date "${t.textContent}" runs past its card (text right ${Math.round(tr.right)}, card right ${Math.round(card.right)})`);
    }
    return bad.slice(0, 6);
  });
}
async function drawerDateProblems(page) {
  await page.click("main .signal .sig-open");
  await page.waitForSelector("aside.drawer.on [data-drawer-date]", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const bad = await page.evaluate(() => {
    const out = [];
    const drawer = document.querySelector("aside.drawer.on");
    if (!drawer) return ["drawer did not open"];
    const dr = drawer.getBoundingClientRect();
    const parts = [...drawer.querySelectorAll("[data-drawer-date], [data-drawer-seen]")];
    const all = parts.map(p => p.textContent).join(" ");
    if (!/first seen \d{1,2} [A-Z][a-z]{2} \d{4}/.test(all)) out.push(`drawer date "${all}" carries no first-seen date (first card must be undated)`);
    for (const p of parts) {
      const r = p.getBoundingClientRect();
      if (r.right > Math.min(dr.right, window.innerWidth) + 1) out.push(`drawer date part "${p.textContent}" runs past the drawer (right ${Math.round(r.right)}, drawer right ${Math.round(dr.right)})`);
    }
    // Round 3: the footer buttons, Close included, sit inside the drawer.
    const foot = drawer.querySelector(".drawer-foot");
    if (!foot) out.push("drawer foot: no .drawer-foot in the open drawer");
    else {
      const btns = [...foot.querySelectorAll("button")];
      if (!btns.some(b => /Close/.test(b.textContent))) out.push("drawer foot: no Close button");
      const right = Math.min(dr.right, window.innerWidth) + 1, left = Math.max(dr.left, 0) - 1;
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (r.right > right || r.left < left) out.push(`drawer foot: "${b.textContent.trim()}" runs past the drawer (left ${Math.round(r.left)}, right ${Math.round(r.right)}, drawer ${Math.round(dr.left)} to ${Math.round(dr.right)})`);
        if (b.scrollWidth > b.clientWidth + 1) out.push(`drawer foot: "${b.textContent.trim()}" is truncated`);
      }
      if (foot.scrollWidth > foot.clientWidth + 1) out.push(`drawer foot: the footer scrolls sideways (${foot.scrollWidth} > ${foot.clientWidth})`);
    }
    return out;
  });
  await page.keyboard.press("Escape");
  return bad;
}
async function searchWidthProblems(page) {
  return page.evaluate(() => {
    const i = document.querySelector(".topbar .search input");
    if (!i) return ["no topbar search input"];
    const w = i.getBoundingClientRect().width;
    const out = [];
    if (!document.querySelector(".topbar [data-poll-line]")) out.push("no poll line in the topbar (the fixture must show one)");
    if (w < 200) out.push(`topbar search input is ${Math.round(w)} px wide, expected at least 200`);
    return out;
  });
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
  if (!only || only.includes("phone")) {
    const bad = [];
    for (const theme of THEMES) {
      await open("overview", { width: 390, theme });
      bad.push(...await phoneProblems(page, `390px ${theme}`));
    }
    results.phone = { problems: bad };
  }
  if (!only || only.includes("card-date")) {
    const bad = [];
    for (const width of [390, 320]) {
      for (const id of ["overview", "signals"]) {
        await open(id, { width });
        for (const p of await cardDateProblems(page)) bad.push(`${id} ${width}px: ${p}`);
      }
      await open("overview", { width });
      for (const p of await drawerDateProblems(page)) bad.push(`drawer ${width}px: ${p}`);
    }
    results["card-date"] = { problems: bad };
  }
  if (!only || only.includes("search")) {
    const bad = [];
    for (const id of ["overview", "sources"]) for (const theme of THEMES) {
      await open(id, { width: 1280, theme });
      for (const p of await searchWidthProblems(page)) bad.push(`${id} 1280px ${theme}: ${p}`);
      for (const p of await overflowProblems(page)) bad.push(`${id} 1280px ${theme}: ${p}`);
    }
    results.search = { problems: bad };
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
  const p = editableDistFile(dir, file);
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
  // Round 5: 781 px, not 820. The menu button no longer shows above 780 px, so
  // without the wraps the topbar first overflows just above the phone breakpoint.
  { name: "tablet-topbar", check: "overflow", only: "overview-781",
    apply: d => {
      mutate(d, "index.html", ".topbar { flex-wrap: wrap; row-gap: 8px; }", "");
      mutate(d, "index.html", ".top-right { flex-wrap: wrap; justify-content: flex-end; min-width: 0; }", "");
    } },
  { name: "lead-wrap", check: "sources-fit",
    apply: d => mutate(d, "index.html", "table.ds td.ds-lead { overflow-wrap: anywhere; min-width: 12rem; }", "") },
  { name: "stack-css", check: "tables",
    apply: d => mutate(d, "index.html", "@media (max-width: 640px) {\n    .table-scroll table.ds.ds-stack", "@media (max-width: 1px) {\n    .table-scroll table.ds.ds-stack") },
  { name: "overview-order", check: "first-sig",
    apply: d => mutate(d, "pages-today.js", 'className: "page page-overview"', 'className: "page"') },
  { name: "card-clip", check: "live-clip",
    apply: d => mutate(d, "index.html", "aspect-ratio: 16 / 9; overflow: visible;", "aspect-ratio: 16 / 9; overflow: hidden;") },
  { name: "eager-embed", check: "player",
    apply: d => mutate(d, "pages-today.js", 'React.useState("card")', 'React.useState("embed")') },
  { name: "autoplay", check: "player",
    apply: d => mutate(d, "pages-today.js", "live_stream?channel=${APH_YT_CHANNEL}`", "live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1`") },
  { name: "phone-topbar", check: "phone",
    expect: "topbar:", apply: d => mutate(d, "index.html", ".top-right .tb-alerts, .top-right .tb-feeds { display: none; }", "") },
  { name: "phone-conf", check: "phone",
    // The four phone .sig-action rules act together (measured: removing the grid
    // rule alone leaves the explicit placements holding the layout), so the
    // canary removes all four.
    expect: "cards:", apply: d => mutate(d, "index.html", /    \.sig-action \{ grid-template-columns: minmax\(0, 1fr\) auto; row-gap: 4px; \}\n[\s\S]*?\.sig-action > \.sig-open \{[^}]*\}\n/, "") },
  { name: "ev-row", check: "phone",
    expect: "drawer: evidence", apply: d => mutate(d, "shell.js", 'className: "ev-text", style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }', 'className: "ev-text", style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "row", gap: 10 }') },
  { name: "drawer-date", check: "phone",
    expect: "drawer: the date", apply: d => mutate(d, "shell.js", '"data-drawer-date": "", style: { whiteSpace: "nowrap" }', '"data-drawer-date": "", style: { whiteSpace: "normal", display: "inline-block", width: 40 }') },
  // Round 2.
  { name: "card-when", check: "card-date",
    expect: "runs past its card", apply: d => mutate(d, "store.js", 'return { dateKind: "none", time: "", date, when: "Date not supplied", pubAt: null };', 'return { dateKind: "none", time: "", date, when: date, pubAt: null };') },
  { name: "drawer-seen", check: "card-date",
    expect: "runs past the drawer", apply: d => mutate(d, "shell.js", 'const [day, seen] = String(s.date || "").split(", first seen ");', 'const [day, seen] = [String(s.date || ""), ""];') },
  // Round 3.
  { name: "foot-wrap", check: "card-date",
    expect: "drawer foot:", apply: d => mutate(d, "index.html", ".drawer-foot { padding: 12px 20px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap;", ".drawer-foot { padding: 12px 20px; border-top: 1px solid var(--line); display: flex;") },
  { name: "search-min", check: "search",
    expect: "topbar search input is", apply: d => mutate(d, "index.html", ".topbar .search { min-width: 320px; }", "") },
];

async function runCanary(h, c) {
  const dir = scratchCopy(h.distDir, c.name);
  try {
    c.apply(dir);
    const server = await startServer(dir, { port: CANARY_PORT });
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
  check(r.phone.problems.length === 0, "Overview and drawer at 390 px, both themes: topbar controls on one row with the theme toggle, confidence on one line clear of Open, evidence label on one line above a wide address, drawer date unbroken", r.phone.problems.slice(0, 6).join("\n      "));
  check(r["card-date"].problems.length === 0, "Overview and Signals at 390 and 320 px with the 0.16-shaped fixture: every card-head date sits inside its card; the drawer date and its first-seen clause sit inside the drawer; every drawer footer button, Close included, sits inside the drawer", r["card-date"].problems.slice(0, 6).join("\n      "));
  check(r.search.problems.length === 0, "Topbar at 1280 px with the poll line showing, Overview and Sources, both themes: the search input is at least 200 px wide and the page does not scroll sideways", r.search.problems.slice(0, 6).join("\n      "));
  check(r.player.problems.length === 0, "Live: no iframe and no YouTube request before 'Load YouTube player'; one APH live stream embed after, verified channel, no autoplay; chambers link to ParlView", r.player.problems.join("\n      "));
  const errs = [...r.pageErrors, ...r.player.pageErrors].filter(e => !/net::ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(e));
  check(errs.length === 0, "no page errors or console errors across the run", errs.slice(0, 4).join("\n      "));

  console.log("\n=== canaries (each must be caught) ===");
  for (const c of CANARIES) {
    let res;
    try { res = await runCanary(h, c); }
    catch (e) { check(false, `canary ${c.name}: could not run (untrustworthy)`, e.message); continue; }
    // A canary with `expect` counts only when it fails for its own reason.
    const own = c.expect ? res.problems.some(p => p.includes(c.expect)) : res.problems.length > 0;
    check(own, `canary ${c.name}: the ${c.check} check fails on the mutated build${c.expect ? ` with "${c.expect}"` : ""}`, c.expect ? `got ${JSON.stringify(res.problems.slice(0, 3))}` : "the check stayed silent on a build with its control removed");
    if (res.problems.length) console.log(`      caught: ${(c.expect && res.problems.find(p => p.includes(c.expect))) || res.problems[0]}`);
  }
} finally {
  await h.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL BROWSER LAYOUT CHECKS PASSED");
process.exit(failures ? 1 : 0);
