// Keyboard, target-size and text-size browser test (FE-10: A11Y-02, A11Y-03,
// A11Y-05, A11Y-other:drawer-in-tree, A11Y-other:target-size,
// A11Y-other:10px-text). Run: npm run browser (after design.test.mjs).
// Exit 0 = pass, 1 = fail.
//
// Reuses the FE-07 harness (dist/ built by build-dist.ps1, production CSP,
// fixture Worker, headless Chromium).
//
// Assertions, on the clean build:
//   walk        Signal inbox at 1280 px, keyboard only: Tab from the top of the
//               page reaches every rendered signal card's Open button; each is
//               named "Open <title>" and the names are distinct; Enter on one
//               opens the drawer on that signal; Esc closes it and focus is
//               back on the same Open button.
//   card        every card is an <article> named by its title, and no card
//               holds a link inside a button (the old nested source link).
//   nav-closed  at 390 px the closed phone navigation contributes 0 Tab stops
//               and 0 focusable descendants; opened, it holds its 12 desks; Esc
//               closes it and returns focus to the toggle.
//   drawer-tree the closed drawer is not in the accessibility tree (no dialog
//               named "Signal detail"); the open drawer is.
//   shortcuts   j moves to the next signal; with focus in the note field j is
//               typed, not obeyed; Ctrl+A does not archive; a archives and the
//               notice offers Undo, which restores the card; turning the
//               single-key shortcuts off in the settings stops j, and the
//               choice survives a reload (pp-shortcuts = "off").
//   targets     every visible button, link and form control on every NAV desk,
//               the open drawer and the open modal, at 1280 and 390 px, is at
//               least 24 x 24 CSS px (WCAG 2.5.8). A link inside a line of text
//               (the WCAG inline exception) and a checkbox inside a label of 24
//               px or more are not counted.
//   text        no visible text on any NAV desk, the drawer or the modal is
//               smaller than 12 px.
//
// Canaries (scratch copies of dist/ in the OS temp directory, served on 8081;
// the working tree is never touched). Each removes one control and the named
// check must FAIL there:
//   nav-visible   the closed phone navigation's visibility:hidden removed (nav-closed)
//   drawer-tree   the closed drawer's visibility:hidden and aria-hidden removed (drawer-tree)
//   ctrl-a        the Ctrl/Cmd/Alt guard removed from shortcutBlocked (shortcuts)
//   no-toggle     the settings toggle ignored by shortcutBlocked (shortcuts)
//   focus-return  the drawer's focus return removed (walk)
//   target-floor  the 24 px minimum on the reset buttons removed (targets)
//   text-floor    --t-micro set back to 10px (text)
// A canary whose mutation does not apply aborts the run as untrustworthy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launch, openDesk, navDesks, startServer, editableDistFile } from "./harness.mjs";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
};

// ---- measurements run inside the page ----------------------------------------------
// Describe document.activeElement so a Tab walk can recognise where it is.
const activeInfo = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { body: true };
  return {
    tag: a.tagName, cls: a.className && String(a.className), name: a.getAttribute("aria-label") || (a.textContent || "").trim().slice(0, 80),
    open: a.matches(".signal .sig-open") ? a.getAttribute("data-kbd-i") : null,
    inSide: !!a.closest("aside.side"), inDrawer: !!a.closest("aside.drawer"),
  };
});

// Every visible interactive element smaller than 24 x 24 CSS px, with the two
// WCAG exceptions this app uses: a link inside a line of text, and a checkbox
// whose label is itself at least 24 px tall.
function smallTargets() {
  const out = [];
  const els = document.querySelectorAll("button, a[href], input, select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=tab]");
  for (const el of els) {
    if (!el.checkVisibility || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    if (el.closest("[aria-hidden=true]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width >= 23.5 && r.height >= 23.5) continue;
    if (el.matches("a")) {
      const cs = getComputedStyle(el);
      const parent = el.parentElement;
      const inline = cs.display === "inline" && parent && (parent.textContent || "").trim().length > (el.textContent || "").trim().length + 1;
      if (inline) continue;
    }
    if (el.matches("input[type=checkbox], input[type=radio]")) {
      const lab = el.closest("label") || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (lab && lab.getBoundingClientRect().height >= 23.5) continue;
    }
    if (el.matches(".skip-link")) continue;  // off-screen until focused, then full size
    const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    out.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).trim().split(/\s+/).join(".") : ""} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
}

// Every visible text node set below 12 px.
function smallText() {
  const out = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || !el.checkVisibility || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    if (el.closest("[aria-hidden=true], .sr-only, svg")) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 11.95) {
      const k = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} ${px}px`;
      out.set(k, (out.get(k) || 0) + 1);
    }
  }
  return [...out.entries()].map(([k, v]) => `${k} x${v}`);
}

// ---- checks ---------------------------------------------------------------------------
async function walk(h, baseUrl) {
  const out = [];
  const page = await h.newPage();
  await openDesk(page, "signals", { baseUrl });
  const cards = await page.evaluate(() => {
    const bs = [...document.querySelectorAll(".signal .sig-open")];
    bs.forEach((b, i) => b.setAttribute("data-kbd-i", String(i)));
    return bs.map(b => b.getAttribute("aria-label"));
  });
  if (cards.length === 0) { out.push("no signal card Open buttons rendered"); await page.context().close(); return out; }
  if (new Set(cards).size !== cards.length) out.push(`Open button names are not distinct: ${cards.length} buttons, ${new Set(cards).size} names`);
  if (cards.some(n => !/^Open \S/.test(n || ""))) out.push(`an Open button is not named "Open <title>": ${cards.find(n => !/^Open \S/.test(n || ""))}`);
  // Keyboard only from the top of the document.
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  const seen = new Set();
  let stops = 0;
  for (; stops < 600 && seen.size < cards.length; stops++) {
    await page.keyboard.press("Tab");
    const a = await activeInfo(page);
    if (a.open != null) seen.add(a.open);
  }
  if (seen.size !== cards.length) out.push(`Tab reached ${seen.size} of ${cards.length} Open buttons in ${stops} stops`);
  // Enter on the third card (or the last if fewer), Esc back.
  const target = String(Math.min(2, cards.length - 1));
  await page.focus(`.sig-open[data-kbd-i="${target}"]`);
  await page.keyboard.press("Enter");
  const opened = await page.waitForSelector("aside.drawer.on", { timeout: 4000 }).then(() => true, () => false);
  if (!opened) out.push("Enter on an Open button did not open the drawer");
  else {
    const want = cards[Number(target)].replace(/^Open /, "");
    const head = await page.evaluate(() => (document.querySelector("aside.drawer.on h2") || {}).textContent || "");
    if (!head.includes(want.slice(0, 30))) out.push(`the drawer opened on "${head.slice(0, 60)}", expected "${want.slice(0, 60)}"`);
    await page.waitForTimeout(100);
    const inDrawer = (await activeInfo(page)).inDrawer;
    if (!inDrawer) out.push("focus did not move into the open drawer");
    await page.keyboard.press("Escape");
    const closed = await page.waitForFunction(() => !document.querySelector("aside.drawer.on"), null, { timeout: 3000 }).then(() => true, () => false);
    if (!closed) out.push("Esc did not close the drawer");
    await page.waitForTimeout(100);
    const back = await activeInfo(page);
    if (back.open !== target) out.push(`after Esc focus is on ${JSON.stringify(back)}, not the Open button that opened the drawer`);
  }
  await page.context().close();
  return out;
}

async function cardShape(h, baseUrl) {
  const out = [];
  const page = await h.newPage();
  await openDesk(page, "signals", { baseUrl });
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".signal")];
    return {
      n: cards.length,
      notArticle: cards.filter(c => c.tagName !== "ARTICLE").length,
      unnamed: cards.filter(c => { const id = c.getAttribute("aria-labelledby"); const t = id && document.getElementById(id); return !t || !t.textContent.trim(); }).length,
      nested: document.querySelectorAll(".signal button a, .signal [role=button] a, .signal a button").length,
      roleButtonCards: cards.filter(c => c.getAttribute("role") === "button").length,
    };
  });
  if (!r.n) out.push("no signal cards rendered");
  if (r.notArticle) out.push(`${r.notArticle} card(s) are not <article>`);
  if (r.unnamed) out.push(`${r.unnamed} card(s) are not named by a title element`);
  if (r.nested) out.push(`${r.nested} link(s) nested in a button inside a card`);
  if (r.roleButtonCards) out.push(`${r.roleButtonCards} card(s) are still role="button"`);
  await page.context().close();
  return out;
}

async function navClosed(h, baseUrl) {
  const out = [];
  const page = await h.newPage();
  await openDesk(page, "overview", { baseUrl, width: 390 });
  const focusables = await page.evaluate(() => [...document.querySelectorAll("aside.side a[href], aside.side button, aside.side input, aside.side [tabindex]")]
    .filter(el => el.tabIndex >= 0 && el.checkVisibility({ checkVisibilityCSS: true })).length);
  if (focusables !== 0) out.push(`the closed phone navigation has ${focusables} focusable descendant(s)`);
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
  let inSide = 0;
  for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); if ((await activeInfo(page)).inSide) inSide++; }
  if (inSide) out.push(`40 Tab presses landed in the closed phone navigation ${inSide} time(s)`);
  await page.click(".nav-toggle");
  await page.waitForSelector("aside.side.mobile-open");
  await page.waitForTimeout(350);
  const openCount = await page.evaluate(() => [...document.querySelectorAll("aside.side .nav-item")].filter(el => el.checkVisibility({ checkVisibilityCSS: true })).length);
  const desks = (await navDesks(page)).length;
  if (openCount !== desks) out.push(`the open phone navigation shows ${openCount} of ${desks} desks`);
  await page.keyboard.press("Escape");
  const closed = await page.waitForFunction(() => !document.querySelector("aside.side.mobile-open"), null, { timeout: 2000 }).then(() => true, () => false);
  if (!closed) out.push("Esc did not close the open phone navigation");
  const onToggle = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("nav-toggle"));
  if (closed && !onToggle) out.push("after Esc focus is not on the navigation toggle");
  await page.context().close();
  return out;
}

async function drawerTree(h, baseUrl) {
  const out = [];
  const page = await h.newPage();
  await openDesk(page, "signals", { baseUrl });
  const closedCount = await page.getByRole("dialog", { name: "Signal detail" }).count();
  if (closedCount !== 0) out.push(`the closed drawer is in the accessibility tree (${closedCount} dialog named "Signal detail")`);
  const closedFocus = await page.evaluate(() => [...document.querySelectorAll("aside.drawer a[href], aside.drawer button, aside.drawer [tabindex]")].filter(el => el.checkVisibility({ checkVisibilityCSS: true })).length);
  if (closedFocus) out.push(`the closed drawer holds ${closedFocus} visible focusable element(s)`);
  await page.click(".signal .sig-open");
  await page.waitForSelector("aside.drawer.on");
  await page.waitForTimeout(400);
  const openCount = await page.getByRole("dialog", { name: "Signal detail" }).count();
  if (openCount !== 1) out.push(`the open drawer is not exposed as one dialog named "Signal detail" (${openCount})`);
  await page.context().close();
  return out;
}

async function shortcuts(h, baseUrl) {
  const out = [];
  const page = await h.newPage();
  await openDesk(page, "signals", { baseUrl });
  const title = () => page.evaluate(() => (document.querySelector("aside.drawer.on h2") || {}).textContent || "");
  const cardCount = () => page.evaluate(() => document.querySelectorAll(".signal").length);
  const n0 = await cardCount();
  await page.click(".signal .sig-open");
  await page.waitForSelector("aside.drawer.on");
  await page.waitForTimeout(150);
  const t0 = await title();
  // j moves to the next signal.
  await page.keyboard.press("j");
  await page.waitForTimeout(150);
  const t1 = await title();
  if (t1 === t0) out.push("j did not move to the next signal");
  // j typed into the note field is text, not a shortcut.
  await page.focus("aside.drawer textarea");
  await page.keyboard.press("j");
  await page.waitForTimeout(100);
  const t2 = await title();
  const note = await page.evaluate(() => document.querySelector("aside.drawer textarea").value);
  if (t2 !== t1) out.push("j pressed in the note field moved to another signal");
  if (!note.endsWith("j")) out.push("j pressed in the note field was not typed into it");
  // Ctrl+A on the drawer's close button must not archive.
  await page.focus("aside.drawer .drawer-head button[aria-label='Close signal detail']");
  await page.keyboard.press("Control+a");
  await page.waitForTimeout(150);
  if (await title() !== t1) out.push("Ctrl+A moved the drawer to another signal (it archived)");
  const archivedAfterCtrl = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem("cs-state-v1") || "{}"); return Object.keys(s.archived || {}).length; } catch { return -1; } });
  if (archivedAfterCtrl > 0) out.push(`Ctrl+A archived ${archivedAfterCtrl} signal(s)`);
  // a archives, with Undo.
  await page.keyboard.press("a");
  await page.waitForTimeout(200);
  const undo = page.locator(".toast-wrap button", { hasText: "Undo" });
  if (await undo.count() === 0) out.push("a did not archive with an Undo in the notice");
  else {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    if (await cardCount() !== n0 - 1) out.push(`after a the inbox shows ${await cardCount()} cards, expected ${n0 - 1}`);
    await undo.first().click();
    await page.waitForTimeout(200);
    if (await cardCount() !== n0) out.push(`Undo did not restore the archived card (${await cardCount()} of ${n0})`);
  }
  // Turn the single-key shortcuts off in the settings.
  if (await page.locator("aside.drawer.on").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
  await page.click("button[aria-label='Keyboard shortcuts and settings']");
  const toggle = page.locator("[data-shortcut-toggle]");
  if (!(await toggle.isChecked())) out.push("the single-key shortcuts toggle does not start on");
  await toggle.uncheck();
  const stored = await page.evaluate(() => localStorage.getItem("pp-shortcuts"));
  if (stored !== "off") out.push(`turning shortcuts off stored pp-shortcuts=${JSON.stringify(stored)}, expected "off"`);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(".signal .sig-open");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.click("button[aria-label='Keyboard shortcuts and settings']");
  if (await page.locator("[data-shortcut-toggle]").isChecked()) out.push("the off setting did not survive a reload");
  await page.click("[data-shortcut-settings] button:has-text('Close')");
  await page.click(".signal .sig-open");
  await page.waitForSelector("aside.drawer.on");
  await page.waitForTimeout(150);
  const u0 = await title();
  await page.keyboard.press("j");
  await page.waitForTimeout(150);
  if (await title() !== u0) out.push("with shortcuts turned off, j still moved to the next signal");
  await page.keyboard.press("Escape");
  await page.context().close();
  return out;
}

// Every NAV desk, the drawer and the modal, at 1280 and 390 px.
async function sizes(h, baseUrl, fn) {
  const out = [];
  const page = await h.newPage();
  await openDesk(page, "overview", { baseUrl });
  const desks = await navDesks(page);
  for (const width of [1280, 390]) {
    for (const d of desks) {
      await openDesk(page, d.id, { baseUrl, width });
      for (const x of await page.evaluate(fn)) out.push(`${d.id} ${width}px: ${x}`);
    }
    await openDesk(page, "signals", { baseUrl, width });
    await page.click(".signal .sig-open");
    await page.waitForSelector("aside.drawer.on");
    await page.waitForTimeout(400);
    for (const x of await page.evaluate(fn)) out.push(`drawer ${width}px: ${x}`);
    await openDesk(page, "sources", { baseUrl, width });
    await page.click("[data-feed-open]");
    await page.waitForSelector(".modal");
    await page.waitForTimeout(300);
    for (const x of await page.evaluate(fn)) out.push(`modal ${width}px: ${x}`);
  }
  await page.context().close();
  return out;
}

async function runAll(h, baseUrl, only) {
  const want = k => !only || only.includes(k);
  return {
    walk: want("walk") ? await walk(h, baseUrl) : null,
    card: want("card") ? await cardShape(h, baseUrl) : null,
    navClosed: want("navClosed") ? await navClosed(h, baseUrl) : null,
    drawerTree: want("drawerTree") ? await drawerTree(h, baseUrl) : null,
    shortcuts: want("shortcuts") ? await shortcuts(h, baseUrl) : null,
    targets: want("targets") ? await sizes(h, baseUrl, smallTargets) : null,
    text: want("text") ? await sizes(h, baseUrl, smallText) : null,
  };
}

// ---- canaries ---------------------------------------------------------------------------
const CANARIES = [
  { name: "nav-visible", check: "navClosed", file: "index.html", from: "      visibility: hidden;  /* FE-10 (A11Y-03): zero focus stops while closed */", to: "" },
  { name: "drawer-tree", check: "drawerTree", edits: [
    { file: "index.html", from: "    visibility: hidden;  /* FE-10: out of the accessibility tree and focus order while closed */", to: "" },
    { file: "shell.js", from: ` "aria-hidden": on ? void 0 : "true"`, to: "" },
  ] },
  { name: "ctrl-a", check: "shortcuts", file: "shell.js", from: "if (e.ctrlKey || e.metaKey || e.altKey) return true;", to: "" },
  { name: "no-toggle", check: "shortcuts", file: "shell.js", from: "if (!singleKeyShortcutsOn()) return true;", to: "" },
  { name: "focus-return", check: "walk", file: "shell.js", from: "if (back.isConnected) back.focus();", to: "" },
  { name: "target-floor", check: "targets", file: "index.html", from: "    min-height: 24px; min-width: 24px;\n", to: "\n", crlf: true },
  { name: "text-floor", check: "text", file: "index.html", from: "    --t-micro:    12px;", to: "    --t-micro:    10px;" },
];

function mutate(distDir, c) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pp-kbd-${c.name}-`));
  fs.cpSync(distDir, dir, { recursive: true });
  for (const e of c.edits || [c]) {
    const p = editableDistFile(dir, e.file);
    const src = fs.readFileSync(p, "utf8");
    const from = src.includes("\r\n") ? e.from.replace(/\n/g, "\r\n") : e.from;
    const to = src.includes("\r\n") ? e.to.replace(/\n/g, "\r\n") : e.to;
    if (!src.includes(from)) throw new Error(`canary ${c.name}: mutation did not apply to ${e.file} (${e.from.slice(0, 60)})`);
    fs.writeFileSync(p, src.split(from).join(to));
  }
  return dir;
}

// A check skipped by KBD_ONLY prints SKIP, never a PASS it did not earn.
const report = (problems, label) => {
  if (problems === null) { console.log(`SKIP  ${label}`); return; }
  check(problems.length === 0, label, problems.join("\n      "));
};

const h = await launch();
const scratch = [];
try {
  // KBD_ONLY=targets,text runs a subset while developing; the canaries run only on a full run.
  const ONLY = process.env.KBD_ONLY ? process.env.KBD_ONLY.split(",") : null;
  const r = await runAll(h, h.baseUrl, ONLY);
  report(r.walk, "walk: Tab reaches every signal card's Open button (distinct \"Open <title>\" names); Enter opens the drawer on it; Esc closes it and returns focus");
  report(r.card, "card: every signal card is an article named by its title, with no link nested in a button");
  report(r.navClosed, "nav-closed: the closed phone navigation has 0 focusable descendants and 0 Tab stops; opened it lists every desk; Esc closes it to the toggle");
  report(r.drawerTree, "drawer-tree: the closed drawer is out of the accessibility tree; the open drawer is one dialog named Signal detail");
  report(r.shortcuts, "shortcuts: j works, is typed in a field, Ctrl+A does not archive, a archives with Undo, and the off setting stops j and survives a reload");
  report(r.targets, `targets: every visible control on every desk, the drawer and the modal is at least 24 x 24 CSS px at 1280 and 390 px`);
  report(r.text, "text: no visible text below 12 px on any desk, the drawer or the modal");
  if (!ONLY && failures === 0) {
    for (const c of CANARIES) {
      const dir = mutate(h.distDir, c);
      scratch.push(dir);
      const srv = await startServer(dir, { port: 8081 });
      try {
        const cr = await runAll(h, srv.url, [c.check]);
        check(Array.isArray(cr[c.check]) && cr[c.check].length > 0, `canary ${c.name}: removing the control fails the ${c.check} check`, "the check still passed with the control removed");
      } finally {
        await srv.close();
      }
    }
  } else if (failures) {
    console.log("      (canaries skipped: the clean build already fails)");
  }
} finally {
  await h.close();
  for (const d of scratch) fs.rmSync(d, { recursive: true, force: true });
}

if (failures) {
  console.error(`\nKEYBOARD TEST: FAIL (${failures} check(s)).`);
  process.exit(1);
}
console.log("\nKEYBOARD TEST: PASS.");
