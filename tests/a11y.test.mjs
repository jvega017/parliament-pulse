// Accessibility regression test for Parliament Pulse.
//
// *** STATIC STRUCTURAL APPROXIMATION. A real axe-core scan is still owed. ***
// Tooling check performed 2026-07-21 in this environment:
//   - No package.json exists anywhere in the repo (`npm ls` -> empty tree).
//   - `require("playwright")` and `require("axe-core")` both fail: neither is
//     a dependency of this project. Chromium binaries happen to be cached on
//     this machine (C:\Users\jvega\AppData\Local\ms-playwright) and `npx
//     playwright --version` resolves, but that is an artefact of an unrelated
//     global MCP tool install, not something this project can rely on, and
//     `npx -p playwright -p axe-core` does not make those packages requirable
//     from a separately spawned `node` process, so there is no reliable,
//     reproducible way to run a real browser + axe scan without adding a
//     package.json and installing dependencies, which is out of scope for a
//     tests/-only change (see tests/README.md for the wiring note).
//   - Until a real axe run is wired (needs a package.json + `npm i -D
//     playwright axe-core` + browser install), THIS FILE is a source-level
//     approximation only: it proves structural preconditions for
//     accessibility (landmarks, ARIA roles, labels, tab order) from the .jsx
//     source, not actual rendered-DOM or colour-contrast conformance.
//
// DESIGN PRINCIPLE (non-negotiable, mirrors tests/release-gate.mjs): every
// check function here is canary-tested against a seeded violation before its
// clean result on the real source is trusted.
//
// Run: node tests/a11y.test.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Pure check functions, operating on source text.
// ---------------------------------------------------------------------------

function hasSkipLink(appJsxText) {
  return /<a\b[^>]*className="skip-link"[^>]*href="#pp-content"[^>]*>/.test(appJsxText)
      || /<a\b[^>]*href="#pp-content"[^>]*className="skip-link"[^>]*>/.test(appJsxText);
}

function hasMainLandmark(appJsxText) {
  return /<main\b[^>]*\bid="pp-content"[^>]*>/.test(appJsxText);
}

function toastContainerHasAriaRoles(storeJsxText) {
  const m = storeJsxText.match(/<div\s+className="toast-wrap"([^>]*)>/);
  if (!m) return false;
  const attrs = m[1];
  return /role="status"/.test(attrs) && /aria-live="polite"/.test(attrs);
}

// Find balanced `<tag ...>...</tag>` blocks, JSX-brace-aware so an arrow
// function inside a `{...}` attribute expression (which contains a literal
// `>`) does not terminate the tag early.
function findTagEnd(text, start) {
  let depth = 0;
  for (let j = start; j < text.length; j++) {
    const ch = text[j];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth <= 0) return j;
  }
  return -1;
}

function findImagesMissingAlt(text) {
  const hits = [];
  let i = 0;
  while (true) {
    const start = text.indexOf("<img", i);
    if (start === -1) break;
    const nextChar = text[start + 4];
    if (nextChar && /[a-zA-Z0-9]/.test(nextChar)) { i = start + 4; continue; }
    const end = findTagEnd(text, start);
    if (end === -1) { i = start + 4; continue; }
    const tag = text.slice(start, end + 1);
    if (!/\balt\s*=/.test(tag)) hits.push({ index: start, tag });
    i = end + 1;
  }
  return hits;
}

// An icon-only button: a <button> with no aria-label/aria-labelledby whose
// entire rendered body, once every <Icon .../> child is stripped out, is
// empty (no visible text, no other content that could supply an accessible
// name).
function findIconOnlyButtonsMissingAriaLabel(text) {
  const hits = [];
  let i = 0;
  while (true) {
    const start = text.indexOf("<button", i);
    if (start === -1) break;
    const nextChar = text[start + 7];
    if (nextChar && /[a-zA-Z0-9]/.test(nextChar)) { i = start + 7; continue; }
    const openEnd = findTagEnd(text, start);
    const closeStart = text.indexOf("</button>", openEnd === -1 ? start : openEnd);
    if (openEnd === -1 || closeStart === -1) { i = start + 7; continue; }
    const openTag = text.slice(start, openEnd + 1);
    const body = text.slice(openEnd + 1, closeStart);
    const hasAriaLabel = /aria-label(ledby)?\s*=/.test(openTag);
    const stripped = body
      .replace(/<Icon\b[^>]*\/>/g, "")
      .replace(/<Icon\b[^>]*>[\s\S]*?<\/Icon>/g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .trim();
    const iconOnly = stripped.length === 0 && /<Icon\b/.test(body);
    if (iconOnly && !hasAriaLabel) {
      hits.push({ index: start, openTag: openTag.replace(/\s+/g, " ").slice(0, 160) });
    }
    i = closeStart + 9;
  }
  return hits;
}

// A form control (<input>, <select>, <textarea>) needs an accessible name:
// aria-label, aria-labelledby, or an id matched by some <label htmlFor="id">
// in the same source set.
function collectLabelForIds(text) {
  const ids = new Set();
  for (const m of text.matchAll(/htmlFor\s*=\s*"([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

function findUnlabelledFormControls(text, labelForIds) {
  const hits = [];
  for (const tagName of ["input", "select", "textarea"]) {
    let i = 0;
    while (true) {
      const start = text.indexOf(`<${tagName}`, i);
      if (start === -1) break;
      const nextChar = text[start + tagName.length + 1];
      if (nextChar && /[a-zA-Z0-9]/.test(nextChar)) { i = start + tagName.length + 1; continue; }
      const end = findTagEnd(text, start);
      if (end === -1) { i = start + tagName.length + 1; continue; }
      const openTag = text.slice(start, end + 1);
      const hasAria = /aria-label(ledby)?\s*=/.test(openTag);
      const idMatch = openTag.match(/\bid\s*=\s*"([^"]+)"/);
      const hasMatchingLabel = !!(idMatch && labelForIds.has(idMatch[1]));
      if (!hasAria && !hasMatchingLabel) {
        hits.push({ index: start, tag: tagName, openTag: openTag.replace(/\s+/g, " ").slice(0, 200) });
      }
      i = end + 1;
    }
  }
  return hits;
}

// Positive tabindex breaks natural tab order (WCAG 2.4.3). -1 (removes from
// tab order) and 0 (natural order) are fine; any integer >= 1 is a hit.
function findPositiveTabIndex(text) {
  const hits = [];
  for (const m of text.matchAll(/tabIndex\s*=\s*\{?\s*"?(-?\d+)"?\s*\}?/g)) {
    const n = parseInt(m[1], 10);
    if (n >= 1) hits.push({ index: m.index, value: n, match: m[0] });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// CANARY GATE. Prove each detector catches a seeded violation, and does not
// false-positive on the compliant pattern actually used in this codebase,
// before trusting any of them against the real source.
// ---------------------------------------------------------------------------
let canaryFailures = 0;

function assertCanary(label, condition) {
  if (!condition) {
    console.error(`CANARY MISS: ${label}`);
    canaryFailures++;
  }
}

// Skip link
assertCanary("skip-link detector did not find a real skip link",
  hasSkipLink('<a className="skip-link" href="#pp-content">Skip to content</a>'));
assertCanary("skip-link detector false-flagged a page with no skip link as having one",
  !hasSkipLink('<div className="app">no skip link here</div>'));

// Main landmark
assertCanary("main-landmark detector did not find a real #pp-content main",
  hasMainLandmark('<main className="content" id="pp-content" tabIndex={-1}>x</main>'));
assertCanary("main-landmark detector false-flagged markup with no id=pp-content as having one",
  !hasMainLandmark('<div className="content">x</div>'));

// Toast container ARIA
assertCanary("toast-container detector did not find role=status + aria-live=polite on a compliant toast-wrap",
  toastContainerHasAriaRoles('<div className="toast-wrap" role="status" aria-live="polite" aria-atomic="false">'));
assertCanary("toast-container detector false-passed a toast-wrap missing aria-live",
  !toastContainerHasAriaRoles('<div className="toast-wrap" role="status">'));
assertCanary("toast-container detector false-passed a toast-wrap missing role",
  !toastContainerHasAriaRoles('<div className="toast-wrap" aria-live="polite">'));

// Images without alt
{
  const bad = findImagesMissingAlt('<img src="canary.png" />');
  assertCanary("img-alt detector did not flag an <img> with no alt attribute", bad.length === 1);
  const good = findImagesMissingAlt('<img src="canary.png" alt="" />');
  assertCanary("img-alt detector false-flagged an <img> with alt=\"\" (valid for decorative images)", good.length === 0);
}

// Icon-only buttons without aria-label
{
  const bad = findIconOnlyButtonsMissingAriaLabel('<button onClick={f}><Icon name="close" size={14} /></button>');
  assertCanary("icon-only-button detector did not flag a bare icon button with no aria-label", bad.length === 1);
  const goodLabelled = findIconOnlyButtonsMissingAriaLabel('<button aria-label="Close" onClick={f}><Icon name="close" size={14} /></button>');
  assertCanary("icon-only-button detector false-flagged an aria-labelled icon button", goodLabelled.length === 0);
  const goodTextButton = findIconOnlyButtonsMissingAriaLabel('<button onClick={f}><Icon name="close" size={14} /> Close</button>');
  assertCanary("icon-only-button detector false-flagged a button with visible text alongside its icon", goodTextButton.length === 0);
}

// Unlabelled form controls
{
  const badInput = findUnlabelledFormControls('<input value={v} onChange={e=>set(e.target.value)} placeholder="canary" />', new Set());
  assertCanary("form-label detector did not flag an <input> with no aria-label and no matching <label>", badInput.length === 1);
  const goodAria = findUnlabelledFormControls('<input aria-label="Canary field" value={v} onChange={e=>set(e.target.value)} />', new Set());
  assertCanary("form-label detector false-flagged an aria-labelled input", goodAria.length === 0);
  const src = '<label htmlFor="canary-id">Canary</label><input id="canary-id" value={v} onChange={e=>set(e.target.value)} />';
  const ids = collectLabelForIds(src);
  const goodHtmlFor = findUnlabelledFormControls(src, ids);
  assertCanary("form-label detector false-flagged an input with a matching <label htmlFor>", goodHtmlFor.length === 0);
  const badSelect = findUnlabelledFormControls('<select value={v} onChange={e=>set(e.target.value)}><option>x</option></select>', new Set());
  assertCanary("form-label detector did not flag an unlabelled <select>", badSelect.length === 1);
  const badTextarea = findUnlabelledFormControls('<textarea value={v} onChange={e=>set(e.target.value)} placeholder="canary" rows={3} />', new Set());
  assertCanary("form-label detector did not flag an unlabelled <textarea>", badTextarea.length === 1);
  // The exact shape used throughout this codebase for onChange handlers
  // (arrow functions containing a literal `>`) must not defeat tag-end
  // detection and hide a genuinely unlabelled control.
  const arrowHeavy = findUnlabelledFormControls('<input value={v} onChange={e=>{ if (e.target.value.length>3) set(e.target.value); }} placeholder="canary" />', new Set());
  assertCanary("form-label detector's tag-end scan was defeated by a `>` inside an onChange arrow function", arrowHeavy.length === 1);
}

// Positive tabindex
{
  const bad = findPositiveTabIndex('<div tabIndex={1}>x</div>');
  assertCanary("tabindex detector did not flag tabIndex={1}", bad.length === 1);
  const badString = findPositiveTabIndex('<div tabIndex="3">x</div>');
  assertCanary("tabindex detector did not flag string tabIndex=\"3\"", badString.length === 1);
  const goodNeg = findPositiveTabIndex('<main tabIndex={-1}>x</main>');
  assertCanary("tabindex detector false-flagged tabIndex={-1} (valid: programmatic focus target)", goodNeg.length === 0);
  const goodZero = findPositiveTabIndex('<div role="button" tabIndex={0}>x</div>');
  assertCanary("tabindex detector false-flagged tabIndex={0} (valid: natural tab order)", goodZero.length === 0);
}

if (canaryFailures > 0) {
  console.error(`\nA11Y GATE: FAIL (instrument self-test failed, ${canaryFailures} canary miss(es)).`);
  console.error("The checker cannot prove it detects, so any clean result is inadmissible.");
  process.exit(1);
}
console.log("Canary self-test PASSED: all 7 structural a11y check categories (skip link, main landmark, toast ARIA, image alt, icon-button label, form-control label, tabindex) proven on seeded specimens (violation caught, compliant pattern not false-flagged).");

// ---------------------------------------------------------------------------
// THE ACTUAL SCAN
// ---------------------------------------------------------------------------
let findings = 0;
const inFlightNotes = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

const appJsx = read("app.jsx");
const storeJsx = read("store.jsx");
const SOURCE_FILES = ["app.jsx", "shell.jsx", "pages.jsx", "store.jsx", "entities.jsx", "data.jsx", "icons.jsx"];

// 1. Skip link
if (!hasSkipLink(appJsx)) {
  console.error("MISSING  app.jsx has no skip link (<a className=\"skip-link\" href=\"#pp-content\">).");
  inFlightNotes.push("Skip link: per the task brief this was being added by another agent concurrently; rerun if this just failed.");
  findings++;
}

// 2. Main landmark
if (!hasMainLandmark(appJsx)) {
  console.error("MISSING  app.jsx has no <main id=\"pp-content\"> landmark.");
  inFlightNotes.push("Main landmark: per the task brief this was being added by another agent concurrently; rerun if this just failed.");
  findings++;
}

// 3. Toast container ARIA roles
if (!toastContainerHasAriaRoles(storeJsx)) {
  console.error("MISSING  store.jsx toast-wrap container lacks role=\"status\" + aria-live=\"polite\".");
  findings++;
}

// 4-7: scan every shipped source file
const labelForIds = new Set();
for (const f of SOURCE_FILES) collectLabelForIds(read(f)).forEach(id => labelForIds.add(id));

for (const f of SOURCE_FILES) {
  const text = read(f);
  const lines = text.split(/\r?\n/);
  const lineOf = idx => text.slice(0, idx).split(/\r?\n/).length;

  for (const hit of findImagesMissingAlt(text)) {
    console.error(`MISSING ALT  ${f}:${lineOf(hit.index)}  <img> has no alt attribute: ${hit.tag.slice(0, 120)}`);
    findings++;
  }

  for (const hit of findIconOnlyButtonsMissingAriaLabel(text)) {
    console.error(`MISSING ARIA-LABEL  ${f}:${lineOf(hit.index)}  icon-only <button> has no accessible name: ${hit.openTag}`);
    findings++;
  }

  for (const hit of findUnlabelledFormControls(text, labelForIds)) {
    console.error(`MISSING LABEL  ${f}:${lineOf(hit.index)}  <${hit.tag}> has no aria-label and no matching <label htmlFor>: ${hit.openTag}`);
    findings++;
  }

  for (const hit of findPositiveTabIndex(text)) {
    console.error(`POSITIVE TABINDEX  ${f}:${lineOf(hit.index)}  ${hit.match} breaks natural tab order (WCAG 2.4.3)`);
    findings++;
  }
}

if (inFlightNotes.length) {
  console.error("\nNote: some failures above may be an in-flight dependency, not a defect:");
  for (const n of inFlightNotes) console.error(`  - ${n}`);
}

if (findings > 0) {
  console.error(`\nA11Y GATE: FAIL. ${findings} finding(s).`);
  console.error("Reminder: this is a static structural approximation. A real axe-core scan is still owed (see header comment).");
  process.exit(1);
}
console.log(`Scanned ${SOURCE_FILES.length} source files: skip link, main landmark, toast ARIA roles, image alt text, icon-only-button labels, form-control labels, tabindex.`);
console.log("A11Y GATE (static structural approximation): PASSED. A real axe-core scan is still owed.");
