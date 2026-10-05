// Browser routing test (FE-08: UX-06, A11Y-04, ARCH-14, LEG-13).
// Run: npm run browser (after layout.test.mjs)   Exit 0 = pass, 1 = fail.
//
// Reuses the FE-07 harness: builds dist/ with build-dist.ps1, serves it on
// 127.0.0.1:8080 with the production CSP, answers every Worker call from
// tests/fixtures/, and drives headless Chromium.
//
// Assertions, on the clean build:
//   deep-link  a fresh load of #/bills renders Bills intelligence, marks its nav
//              item current and sets the Bills title.
//   back       Overview, then Bills, then Sources by the nav; Back returns to
//              Bills and then Overview, Forward to Bills; a typed hash drives the page.
//   signal     a fresh load of #/signal/<encodeURIComponent(fixture guid)> opens
//              the drawer on that signal over the Signal inbox; closing the drawer
//              leaves the address at #/signals.
//   not-found  #/no-such-desk and #/about/no-such-section render "Page not found"
//              with links to Overview and About, set the Not found title, and do
//              not render Overview; the skip link does not route.
//   focus      every NAV desk, opened by its nav item: document.title is
//              "<label> · Parliament Pulse" with no em or en dash, all titles
//              differ, document.activeElement is the desk h1 (tabindex -1), and
//              the polite live region names the desk.
//   legacy     ?page=bills maps once to #/bills and renders Bills.
//   footer     the footer links to #/about/legal, #/about/privacy and
//              #/about/licence, and #/about/privacy scrolls to and focuses the
//              privacy section.
//
// Canaries (scratch copies of dist/ in the OS temp directory, served on 8081;
// the working tree is never touched). Each removes one control, and the named
// check must FAIL there:
//   no-hashchange   the hashchange listener removed from app.js (back)
//   no-title        the document.title write removed (focus)
//   no-focus        the h1 focus call removed (focus)
//   silent-fallback the Not found desk replaced by Overview (not-found)
//   no-legacy       the ?page= migration removed (legacy)
//   no-foot-links   the footer legal links removed (footer)
// A canary whose mutation does not apply aborts the run as untrustworthy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch, startServer, FIXTURES, FIXTURE_CLOCK, editableDistFile, CANARY_PORT } from "./harness.mjs";

const STATE = JSON.parse(fs.readFileSync(path.join(FIXTURES, "state.json"), "utf8"));
const FIXTURE_SIGNAL = STATE.blocks.signals.items[0];
const DOT = " \u00b7 Parliament Pulse";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
};

// ---- helpers -----------------------------------------------------------------
// A real (not same-document) load of base + suffix, returning-visitor storage.
async function freshLoad(page, baseUrl, suffix = "") {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(FIXTURE_CLOCK);
  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("pp-theme", "dark");
    localStorage.setItem("pp-nav-open", "false");
    localStorage.setItem("pp-beta-ack", "1");
    localStorage.setItem("pp-onboarded", "1");
  });
  await page.goto("about:blank");
  await page.goto(baseUrl + suffix, { waitUntil: "load" });
  await page.waitForSelector("#pp-content h1", { timeout: 5000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}
const h1 = page => page.evaluate(() => (document.querySelector("#pp-content h1") || {}).textContent || "");
const hash = page => page.evaluate(() => location.hash);
async function clickNav(page, id) {
  const ok = await page.evaluate(id => {
    const i = NAV.findIndex(n => n.id === id);
    const el = document.querySelectorAll("#main-navigation .nav-item")[i];
    if (!el) return false;
    el.click();
    return true;
  }, id);
  if (!ok) throw new Error(`no nav item for ${id}`);
}
// Waits for the desk h1 to read `text`; returns false on timeout rather than throwing.
const waitH1 = (page, text, timeout = 2500) =>
  page.waitForFunction(t => ((document.querySelector("#pp-content h1") || {}).textContent || "") === t, text, { timeout })
    .then(() => true, () => false);
async function labels(page) {
  return page.evaluate(() => Object.fromEntries(NAV.map(n => [n.id, n.label])));
}

// ---- checks (each returns a list of problems; empty = pass) -------------------
async function deepLinkProblems(page, baseUrl) {
  const out = [];
  await freshLoad(page, baseUrl, "#/bills");
  const L = await labels(page);
  if (await h1(page) !== "Bills intelligence") out.push(`#/bills rendered "${await h1(page)}"`);
  const cur = await page.evaluate(() => [...document.querySelectorAll('#main-navigation .nav-item[aria-current="page"]')].map(e => e.textContent.trim()));
  if (cur.length !== 1 || !cur[0].startsWith(L.bills)) out.push(`current nav item is ${JSON.stringify(cur)}`);
  const title = await page.title();
  if (title !== L.bills + DOT) out.push(`title "${title}"`);
  return out;
}

async function backProblems(page, baseUrl) {
  const out = [];
  await freshLoad(page, baseUrl);
  const L = await labels(page);
  const overviewH1 = await h1(page);
  await clickNav(page, "bills");
  if (!await waitH1(page, "Bills intelligence")) out.push("nav click did not open Bills");
  await clickNav(page, "sources");
  if (!await waitH1(page, "Sources")) out.push("nav click did not open Sources");
  if (await hash(page) !== "#/sources") out.push(`after two navigations the hash is ${await hash(page)}`);
  await page.evaluate(() => history.back());
  if (!await waitH1(page, "Bills intelligence")) out.push(`Back from Sources shows "${await h1(page)}" (hash ${await hash(page)}), expected Bills intelligence`);
  await page.evaluate(() => history.back());
  if (!await waitH1(page, overviewH1)) out.push(`second Back shows "${await h1(page)}", expected Overview "${overviewH1}"`);
  await page.evaluate(() => history.forward());
  if (!await waitH1(page, "Bills intelligence")) out.push(`Forward shows "${await h1(page)}", expected Bills intelligence`);
  if (await page.title() !== L.bills + DOT) out.push(`after Forward the title is "${await page.title()}"`);
  await page.evaluate(() => { location.hash = "#/sources"; });
  if (!await waitH1(page, "Sources")) out.push(`a typed #/sources shows "${await h1(page)}"`);
  return out;
}

async function signalProblems(page, baseUrl) {
  const out = [];
  await freshLoad(page, baseUrl, "#/signal/" + encodeURIComponent(FIXTURE_SIGNAL.guid));
  if (await h1(page) !== "Signal inbox") out.push(`the drawer opened over "${await h1(page)}", expected Signal inbox`);
  const drawer = await page.waitForSelector("aside.drawer.on", { timeout: 4000 }).then(() => true, () => false);
  if (!drawer) { out.push("no open drawer after a #/signal/ deep link"); return out; }
  const head = await page.evaluate(() => (document.querySelector("aside.drawer.on h2") || {}).textContent || "");
  if (!head.includes(FIXTURE_SIGNAL.title)) out.push(`drawer heading "${head.slice(0, 80)}" is not the fixture signal "${FIXTURE_SIGNAL.title}"`);
  await page.keyboard.press("Escape");
  const closed = await page.waitForFunction(() => !document.querySelector("aside.drawer.on"), null, { timeout: 2500 }).then(() => true, () => false);
  if (!closed) out.push("Escape did not close the routed drawer");
  const after = await hash(page);
  if (after !== "#/signals") out.push(`after closing, the hash is ${after}, expected #/signals`);
  return out;
}

async function notFoundProblems(page, baseUrl) {
  const out = [];
  for (const suffix of ["#/no-such-desk", "#/about/no-such-section"]) {
    await freshLoad(page, baseUrl, suffix);
    const r = await page.evaluate(() => ({
      h1: (document.querySelector("#pp-content h1") || {}).textContent || "",
      marker: !!document.querySelector("[data-page-not-found]"),
      overview: !!document.querySelector("#pp-content .page-overview"),
      links: [...document.querySelectorAll("[data-page-not-found] a")].map(a => a.getAttribute("href")),
      title: document.title,
    }));
    if (r.h1 !== "Page not found" || !r.marker) out.push(`${suffix} rendered "${r.h1}"`);
    if (r.overview) out.push(`${suffix} rendered the Overview`);
    if (!r.links.includes("#/overview") || !r.links.includes("#/about")) out.push(`${suffix} links are ${JSON.stringify(r.links)}`);
    if (r.title !== "Page not found" + DOT) out.push(`${suffix} title "${r.title}"`);
  }
  // Following the Overview link routes back to a real desk.
  const link = page.locator('[data-page-not-found] a[href="#/overview"]');
  if (await link.count() === 1) {
    await link.click({ timeout: 3000 });
    if (!await waitH1(page, "Today's signals")) out.push(`the Overview link opened "${await h1(page)}"`);
  } else out.push("no Overview link to follow on the Not found desk");
  // The skip link is an in-page anchor, never a route.
  await page.focus(".skip-link");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  if (await h1(page) === "Page not found") out.push("the skip link routed to Page not found");
  return out;
}

async function focusProblems(page, baseUrl) {
  const out = [];
  await freshLoad(page, baseUrl);
  const L = await labels(page);
  const titles = new Set();
  const ids = Object.keys(L);
  // Start from About so that Overview, the first desk, is also a route change.
  await clickNav(page, "about");
  await page.waitForTimeout(150);
  for (const id of ids) {
    await clickNav(page, id);
    const focused = await page.waitForFunction(() => {
      const a = document.activeElement;
      return a && a.matches("#pp-content h1") && a.getAttribute("tabindex") === "-1";
    }, null, { timeout: 2500 }).then(() => true, () => false);
    const r = await page.evaluate(() => ({
      title: document.title,
      active: document.activeElement ? `${document.activeElement.tagName} "${(document.activeElement.textContent || "").trim().slice(0, 30)}"` : "none",
      announce: (document.querySelector("[data-route-announcer]") || {}).textContent || "",
    }));
    if (r.title !== L[id] + DOT) out.push(`${id}: title "${r.title}"`);
    if (/[\u2014\u2013]/.test(r.title)) out.push(`${id}: title carries a dash "${r.title}"`);
    if (!focused) out.push(`${id}: focus is on ${r.active}, not the desk h1`);
    const announced = await page.waitForFunction(t => ((document.querySelector("[data-route-announcer]") || {}).textContent || "") === t, L[id], { timeout: 1500 }).then(() => true, () => false);
    if (!announced) out.push(`${id}: live region reads "${r.announce}"`);
    titles.add(r.title);
  }
  if (titles.size !== ids.length) out.push(`${titles.size} distinct titles for ${ids.length} desks`);
  return out;
}

async function legacyProblems(page, baseUrl) {
  const out = [];
  await freshLoad(page, baseUrl, "?page=bills");
  const url = new URL(page.url());
  if (url.hash !== "#/bills") out.push(`?page=bills left the hash at "${url.hash}"`);
  if (url.searchParams.has("page")) out.push("?page= is still in the address after migration");
  if (await h1(page) !== "Bills intelligence") out.push(`?page=bills rendered "${await h1(page)}"`);
  return out;
}

async function footerProblems(page, baseUrl) {
  const out = [];
  await freshLoad(page, baseUrl);
  const hrefs = await page.evaluate(() => [...document.querySelectorAll("footer.site-foot a")].map(a => a.getAttribute("href")));
  for (const want of ["#/about/legal", "#/about/privacy", "#/about/licence"]) if (!hrefs.includes(want)) out.push(`footer has no ${want} link (has ${JSON.stringify(hrefs)})`);
  if (!hrefs.includes("#/about/privacy")) return out;
  await page.click('footer.site-foot a[href="#/about/privacy"]');
  if (!await waitH1(page, "About the data")) { out.push(`the privacy link opened "${await h1(page)}"`); return out; }
  const focused = await page.waitForFunction(() => document.activeElement && document.activeElement.id === "about-privacy", null, { timeout: 2500 }).then(() => true, () => false);
  if (!focused) out.push(`the privacy link left focus on ${await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName))}`);
  const inView = await page.evaluate(() => { const r = document.getElementById("about-privacy").getBoundingClientRect(); return r.top >= -1 && r.top < innerHeight; });
  if (!inView) out.push("the privacy section is not scrolled into view");
  return out;
}

const CHECKS = {
  "deep-link": deepLinkProblems, back: backProblems, signal: signalProblems,
  "not-found": notFoundProblems, focus: focusProblems, legacy: legacyProblems, footer: footerProblems,
};

// ---- canaries --------------------------------------------------------------------
function scratchCopy(dist, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pp-fe08-${name}-`));
  fs.cpSync(dist, dir, { recursive: true });
  return dir;
}
function mutate(dir, file, from, to) {
  const p = editableDistFile(dir, file);
  const s = fs.readFileSync(p, "utf8");
  if (!s.includes(from)) throw new Error(`canary mutation did not apply to ${file}: ${from}`);
  fs.writeFileSync(p, s.split(from).join(to));
}
const CANARIES = [
  { name: "no-hashchange", check: "back",
    apply: d => mutate(d, "app.js", 'window.addEventListener("hashchange", onHash);', "") },
  { name: "no-title", check: "focus",
    apply: d => mutate(d, "app.js", "document.title = routeTitle(route);", "") },
  { name: "no-focus", check: "focus",
    apply: d => mutate(d, "app.js", "h1.focus({ preventScroll: true });", "") },
  { name: "silent-fallback", check: "not-found",
    apply: d => mutate(d, "app.js", "React.createElement(PageNotFound, { path: route.path })", "React.createElement(PageOverview, null)") },
  { name: "no-legacy", check: "legacy",
    apply: d => mutate(d, "app.js", "migrateLegacyPageQuery(window.location, window.history);", "") },
  { name: "no-foot-links", check: "footer",
    apply: d => mutate(d, "shell.js", 'href: "#/about/privacy"', 'href: "#/about"') },
];

// ---- main ---------------------------------------------------------------------------
const h = await launch();
try {
  console.log("\n=== clean build (restraint: every check must pass) ===");
  const page = await h.newPage();
  const results = {};
  for (const [name, fn] of Object.entries(CHECKS)) {
    try { results[name] = await fn(page, h.baseUrl); }
    catch (e) { results[name] = [`threw: ${e.message}`]; }
  }
  check(results["deep-link"].length === 0, "deep link: a fresh load of #/bills renders Bills intelligence with its nav item current and its title", results["deep-link"].join("\n      "));
  check(results.back.length === 0, "Back and Forward: Overview > Bills > Sources, Back to Bills then Overview, Forward to Bills; a typed hash drives the desk", results.back.join("\n      "));
  check(results.signal.length === 0, `signal deep link: #/signal/<guid> opens the drawer on "${FIXTURE_SIGNAL.title.slice(0, 40)}" over the Signal inbox; closing leaves #/signals`, results.signal.join("\n      "));
  check(results["not-found"].length === 0, "unknown route: #/no-such-desk and #/about/no-such-section render Page not found with Overview and About links and the Not found title, never Overview", results["not-found"].join("\n      "));
  check(results.focus.length === 0, "every NAV desk: title '<label> · Parliament Pulse' (no dash, all distinct), focus on the h1, live region names the desk", results.focus.slice(0, 8).join("\n      "));
  check(results.legacy.length === 0, "legacy ?page=bills maps once to #/bills and renders Bills", results.legacy.join("\n      "));
  check(results.footer.length === 0, "footer links to #/about/legal, #/about/privacy and #/about/licence; the privacy link scrolls to and focuses its section", results.footer.join("\n      "));
  const errs = page.pageErrors.filter(e => !/net::ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(e));
  check(errs.length === 0, "no page errors or console errors across the routing run", errs.slice(0, 4).join("\n      "));

  console.log("\n=== canaries (each must be caught) ===");
  for (const c of CANARIES) {
    const dir = scratchCopy(h.distDir, c.name);
    let problems;
    try {
      c.apply(dir);
      const server = await startServer(dir, { port: CANARY_PORT });
      try {
        const p = await h.newPage();
        problems = await CHECKS[c.check](p, server.url).catch(e => [`threw: ${e.message}`]);
      } finally { await server.close(); }
    } catch (e) {
      check(false, `canary ${c.name}: could not run (untrustworthy)`, e.message);
      continue;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    check(problems.length > 0, `canary ${c.name}: the ${c.check} check fails on the mutated build`, "the check stayed silent on a build with its control removed");
    if (problems.length) console.log(`      caught: ${problems[0]}`);
  }
} finally {
  await h.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL BROWSER ROUTING CHECKS PASSED");
process.exit(failures ? 1 : 0);
