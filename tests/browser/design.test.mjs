// Browser design test (FE-09: UX-14, UX-16, PR-13, UX-18).
// Run: npm run browser (after routing.test.mjs)   Exit 0 = pass, 1 = fail.
//
// Reuses the FE-07 harness: builds dist/ with build-dist.ps1, serves it on
// 127.0.0.1:8080 with the production CSP, answers every Worker call from
// tests/fixtures/, and drives headless Chromium.
//
// Assertions, on the clean build:
//   live-nav    the Live parliament nav badge reads "Live" with data-live-state
//               "live" while the poll is fresh, and "Stale" (data-live-state
//               "stale") with the browser clock a day past the fixture poll; in
//               neither state is it the old red fill (UX-16).
//   committees  on the Committees desk every APH item link appears once (UX-14).
//   print       with a brief generated from the first signal, the Briefings desk
//               under print media: the sidebar, topbar and buttons are hidden,
//               the brief and its APH attribution line are visible, the site
//               footer attribution is visible, and every source link inside the
//               brief prints its URL after the link text (PR-13). A PDF of that
//               print preview is written to tests/browser/out/print-brief.pdf.
//   title       document.title and the OG and Twitter titles carry no em dash.
//   phone-cols  at 390 px the second column still shows on Sources (Add RSS feed)
//               and Daily program (Recent divisions); the Overview alone defers
//               its context rail (restraint: the rail stays hidden there).
//
// Canaries (scratch copies of dist/ in the OS temp directory, served on 8081;
// the working tree is never touched). Each removes one control and the named
// check must FAIL there:
//   no-live-state  liveNavState always returns "live" (live-nav)
//   strip-back     the combined committee strip restored above the two lists (committees)
//   no-print       the print stylesheet disabled (print)
//   no-print-urls  the printed-URL rule removed (print)
//   rail-unscoped  the phone rail rule applied to every .g-overview again (phone-cols)
// A canary whose mutation does not apply aborts the run as untrustworthy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch, openDesk, startServer, root, FIXTURE_CLOCK } from "./harness.mjs";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
};

async function liveNavProblems(h, baseUrl) {
  const out = [];
  for (const [label, clock, want] of [["fresh", FIXTURE_CLOCK, "live"], ["stalled", FIXTURE_CLOCK + 24 * 3600 * 1000, "stale"]]) {
    const page = await h.newPage();
    await openDesk(page, "overview", { baseUrl });
    await page.clock.setFixedTime(clock);
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(".nav-item");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const el = document.querySelector("#main-navigation .nav-live");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { text: el.textContent.trim(), state: el.dataset.liveState, bg: cs.backgroundColor };
    });
    if (!r) { out.push(`${label}: no live badge on the Live parliament nav item`); continue; }
    if (r.state !== want) out.push(`${label}: badge state "${r.state}" (text "${r.text}"), expected "${want}"`);
    const wantText = want === "live" ? "Live" : "Stale";
    if (r.text !== wantText) out.push(`${label}: badge reads "${r.text}", expected "${wantText}"`);
    if (r.bg !== "rgba(0, 0, 0, 0)" && r.bg !== "transparent") out.push(`${label}: badge has a filled background (${r.bg}); it must be a neutral outline`);
  }
  return out;
}

async function committeeProblems(h, baseUrl) {
  const page = await h.newPage();
  await openDesk(page, "committees", { baseUrl });
  const r = await page.evaluate(() => {
    const hrefs = [...document.querySelectorAll("main a[href*='aph.gov.au/Parliamentary_Business/Committees/']")].map(a => a.href);
    const seen = {}; for (const u of hrefs) seen[u] = (seen[u] || 0) + 1;
    return { total: hrefs.length, dupes: Object.entries(seen).filter(([, n]) => n > 1) };
  });
  const out = [];
  if (r.total === 0) out.push("no committee item links rendered (the fixture should give 20)");
  if (r.dupes.length) out.push(`${r.dupes.length} committee item link(s) appear more than once, e.g. ${r.dupes[0][0]} x${r.dupes[0][1]}`);
  return out;
}

async function printProblems(h, baseUrl, { pdf = false } = {}) {
  const page = await h.newPage();
  // Generate brief copies the brief to the clipboard first; grant it so the
  // brief lands in the queue as it does for a reader.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseUrl).origin });
  await openDesk(page, "signals", { baseUrl });
  await page.click(".signal .sig-open");
  await page.waitForSelector("aside.drawer.on");
  await page.click("aside.drawer button:has-text('Generate brief')");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { location.hash = "#/briefings"; });
  await page.waitForSelector(".brief");
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const vis = el => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
    const brief = document.querySelector(".brief");
    const links = brief ? [...brief.querySelectorAll("a[href^='http']")] : [];
    return {
      side: vis(document.querySelector(".side")),
      topbar: vis(document.querySelector(".topbar")),
      buttons: [...document.querySelectorAll("main button")].filter(vis).length,
      brief: vis(brief),
      briefBg: brief ? getComputedStyle(brief).backgroundColor : null,
      attrib: vis(document.querySelector("[data-brief-attribution]")) ? document.querySelector("[data-brief-attribution]").textContent : null,
      footer: vis(document.querySelector("footer.site-foot")) ? document.querySelector("footer.site-foot").textContent : null,
      links: links.length,
      linksWithUrl: links.filter(a => (getComputedStyle(a, "::after").content || "").includes(a.getAttribute("href"))).length,
    };
  });
  const out = [];
  if (r.side) out.push("print: the sidebar is visible");
  if (r.topbar) out.push("print: the topbar is visible");
  if (r.buttons) out.push(`print: ${r.buttons} button(s) visible`);
  if (!r.brief) out.push("print: the brief is not visible");
  if (r.briefBg !== "rgb(255, 255, 255)") out.push(`print: the brief prints on ${r.briefBg}, not white paper`);
  if (!r.attrib || !/Parliament of Australia/.test(r.attrib)) out.push("print: the brief's APH attribution line is not visible");
  if (!r.footer || !/Parliament of Australia website, licensed under/.test(r.footer)) out.push("print: the site footer attribution is not visible");
  if (r.links === 0) out.push("print: the brief has no source links");
  else if (r.linksWithUrl !== r.links) out.push(`print: ${r.links - r.linksWithUrl} of ${r.links} source link(s) do not print their URL`);
  if (pdf) {
    const dir = path.join(root, "tests", "browser", "out");
    fs.mkdirSync(dir, { recursive: true });
    await page.pdf({ path: path.join(dir, "print-brief.pdf"), format: "A4", printBackground: true });
    await page.screenshot({ path: path.join(dir, "print-brief.png"), fullPage: true });
  }
  return out;
}

async function titleProblems(h, baseUrl) {
  const page = await h.newPage();
  await openDesk(page, "overview", { baseUrl });
  const t = await page.evaluate(() => [document.title, ...[...document.querySelectorAll("meta[property^='og:'], meta[name^='twitter:'], meta[name='description']")].map(m => m.content)]);
  return t.filter(s => /—/.test(s)).map(s => `em dash in "${s}"`);
}

async function phoneColumnProblems(h, baseUrl) {
  const out = [];
  const visibleHeading = async (page, text) => page.evaluate(t => {
    const el = [...document.querySelectorAll("main .panel-title")].find(e => e.textContent.trim() === t);
    return !!el && el.getBoundingClientRect().height > 0;
  }, text);
  for (const [desk, heading] of [["sources", "Add RSS feed"], ["parliament", "Recent divisions"]]) {
    const page = await h.newPage();
    await openDesk(page, desk, { width: 390, baseUrl });
    if (!(await visibleHeading(page, heading))) out.push(`${desk} at 390 px hides its "${heading}" panel`);
  }
  const page = await h.newPage();
  await openDesk(page, "overview", { width: 390, baseUrl });
  const railShown = await page.evaluate(() => {
    const rail = document.querySelector(".page-overview .g-overview > div:last-child");
    return !!rail && getComputedStyle(rail).display !== "none";
  });
  if (railShown) out.push("restraint: the Overview context rail shows at 390 px");
  return out;
}

function scratchCopy(dist, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pp-fe09-${name}-`));
  fs.cpSync(dist, dir, { recursive: true });
  return dir;
}
function mutate(dir, file, from, to) {
  const p = path.join(dir, file);
  const s = fs.readFileSync(p, "utf8");
  if (!s.includes(from)) throw new Error(`canary mutation did not apply to ${file}: ${from.slice(0, 80)}`);
  fs.writeFileSync(p, s.replace(from, to));
}
const CANARIES = [
  { name: "no-live-state", run: liveNavProblems,
    apply: d => mutate(d, "shell.js", 'if (fresh && fresh.known && fresh.stale) return "stale";', "") },
  { name: "strip-back", run: committeeProblems,
    apply: d => mutate(d, "pages.js", 'React.createElement(TodaysHearingsPanel, null)',
      'React.createElement(LiveFeedStrip, { title: "Latest committee activity", items: (liveSignalsState.items || []).filter((s) => COMMITTEE_STRIP_LABELS.has(s.source)), fetchedAt: liveSignalsState.fetchedAt }), React.createElement(TodaysHearingsPanel, null)') },
  { name: "rail-unscoped", run: phoneColumnProblems,
    apply: d => mutate(d, "index.html", ".page-overview .g-overview > div:last-child { display: none; }", ".g-overview > div:last-child { display: none; }") },
  { name: "no-print", run: printProblems,
    apply: d => mutate(d, "index.html", "  @media print {\n    @page", "  @media not all {\n    @page") },
  { name: "no-print-urls", run: printProblems,
    apply: d => mutate(d, "index.html", 'content: " (" attr(href) ")";', "content: none;") },
];

const h = await launch();
try {
  console.log("\n=== clean build (restraint: every check must pass) ===");
  const base = h.baseUrl;
  const ln = await liveNavProblems(h, base);
  check(ln.length === 0, "Live parliament nav badge follows freshness: Live when fresh, Stale when the poll has stalled, never a red fill", ln.join("\n      "));
  const cm = await committeeProblems(h, base);
  check(cm.length === 0, "Committees: every APH committee item link appears once", cm.join("\n      "));
  const pr = await printProblems(h, base, { pdf: true });
  check(pr.length === 0, "Briefings print: chrome hidden, brief on white paper, APH attribution in the brief and footer, every source link prints its URL (PDF in tests/browser/out/)", pr.join("\n      "));
  const pc = await phoneColumnProblems(h, base);
  check(pc.length === 0, "390 px: Sources keeps Add RSS feed and Daily program keeps Recent divisions; only the Overview defers its rail", pc.join("\n      "));
  const tt = await titleProblems(h, base);
  check(tt.length === 0, "document.title, description, OG and Twitter meta carry no em dash", tt.join("\n      "));

  console.log("\n=== canaries (each must FAIL its check) ===");
  for (const c of CANARIES) {
    const dir = scratchCopy(h.distDir, c.name);
    try {
      try { c.apply(dir); } catch (e) { console.error(`CANARY BUILD ERROR (${c.name}): ${e.message}`); failures++; continue; }
      const server = await startServer(dir, { port: 8081 });
      try {
        const got = await c.run(h, server.url);
        check(got.length > 0, `canary ${c.name} is caught${got.length ? `: ${got[0]}` : ""}`, "the check passed with the control removed");
      } finally { await server.close(); }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
} finally {
  await h.close();
}
if (failures) { console.error(`\nDESIGN BROWSER TEST: FAILED (${failures}).`); process.exit(1); }
console.log("\nDESIGN BROWSER TEST: PASSED.");
