// Static keyboard-operability gate (FE-10: A11Y-01, WCAG 2.1.1 Level A).
// Run: node tests/keyboard-static.test.mjs   Exit 0 = pass, 1 = fail.
//
// A mouse-only click target is an onClick (or onMouseDown) on an element a
// keyboard cannot reach or activate. This scans every shipped .jsx for an
// opening tag of a non-interactive element (div, span, tr, td, th, li, ul, ol,
// p, section, article, aside, header, footer, img, svg, label, strong, em,
// code, h1 to h6) that carries onClick or onMouseDown but not all three of:
//   role="...", tabIndex={0} (or tabIndex="0"), and an onKeyDown handler.
// Native <button>, <a href>, <input>, <select>, <textarea>, <summary> and the
// components (capitalised JSX names) are out of scope: the first group is
// keyboard-operable by the platform, and components are checked where they
// render their own element.
//
// Two exemptions, each marked in the source with a comment on the line above
// the tag, so an exemption is always a visible, reviewable decision:
//   {/* a11y-exempt: backdrop */}   a click-outside scrim whose action (close)
//                                   is also on Escape and on a visible Close
//                                   button; the scrim itself is aria-hidden.
//   {/* a11y-exempt: stop */}       an onClick that only calls
//                                   e.stopPropagation() and performs no action.
// The detector verifies each exemption: a "backdrop" must be aria-hidden and a
// "stop" handler must contain nothing but stopPropagation.
//
// CANARY-FIRST (mirrors tests/a11y.test.mjs): the detector is run against seeded
// violations and compliant specimens before its result on the real source is
// trusted. A canary miss aborts the gate as untrustworthy.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILES = ["app.jsx", "shell.jsx", "pages.jsx", "store.jsx", "entities.jsx", "data.jsx", "icons.jsx"];
const NON_INTERACTIVE = new Set(["div", "span", "tr", "td", "th", "li", "ul", "ol", "p", "section", "article", "aside", "header", "footer", "img", "svg", "label", "strong", "em", "code", "h1", "h2", "h3", "h4", "h5", "h6", "nav", "main", "table", "tbody"]);

// JSX-brace-aware end of an opening tag, so a `>` inside {...} does not end it.
function findTagEnd(text, start) {
  let depth = 0, quote = null;
  for (let j = start; j < text.length; j++) {
    const ch = text[j];
    if (quote) { if (ch === quote && text[j - 1] !== "\\") quote = null; continue; }
    if (depth > 0 && (ch === '"' || ch === "'" || ch === "`")) { quote = ch; continue; }
    if (depth === 0 && ch === '"') { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth <= 0) return j;
  }
  return -1;
}

// Returns every mouse-only opening tag: { index, tag, open }.
export function findMouseOnly(text) {
  const hits = [];
  const re = /<([a-z][a-z0-9]*)\b/g;
  let m;
  while ((m = re.exec(text))) {
    const tag = m[1];
    if (!NON_INTERACTIVE.has(tag)) continue;
    const end = findTagEnd(text, m.index);
    if (end === -1) continue;
    const open = text.slice(m.index, end + 1);
    if (!/\bon(Click|MouseDown)\s*=/.test(open)) continue;
    const before = text.slice(Math.max(0, text.lastIndexOf("\n", text.lastIndexOf("\n", m.index - 1) - 1)), m.index);
    const exempt = before.match(/a11y-exempt:\s*(backdrop|stop)/);
    if (exempt) {
      if (exempt[1] === "backdrop" && /aria-hidden\s*=\s*("true"|\{true\})/.test(open)) continue;
      if (exempt[1] === "stop") {
        const h = open.match(/onClick\s*=\s*\{([\s\S]*?)\}\s*(?:[a-zA-Z-]+=|\/?>)/);
        const body = h ? h[1].replace(/\s+/g, "") : "";
        if (/^\(?e\)?=>e\.stopPropagation\(\)$/.test(body)) continue;
      }
    }
    const hasRole = /\brole\s*=\s*["{]/.test(open);
    const hasTab = /\btabIndex\s*=\s*(\{\s*0\s*\}|"0")/.test(open);
    const hasKey = /\bonKeyDown\s*=/.test(open);
    if (hasRole && hasTab && hasKey) continue;
    hits.push({ index: m.index, tag, open: open.replace(/\s+/g, " ").slice(0, 160) });
  }
  return hits;
}

// ---- canaries ------------------------------------------------------------------
let miss = 0;
const canary = (label, ok) => { if (!ok) { console.error(`CANARY MISS: ${label}`); miss++; } };
canary("a div with onClick and nothing else was not flagged", findMouseOnly('<div className="x" onClick={() => go()}>x</div>').length === 1);
canary("a tr with onClick was not flagged", findMouseOnly('<tr onClick={() => open(r.id)}><td>x</td></tr>').length === 1);
canary("a span with onClick and role but no tabIndex was not flagged", findMouseOnly('<span role="button" onClick={f}>x</span>').length === 1);
canary("a li with role and tabIndex but no onKeyDown was not flagged", findMouseOnly('<li role="button" tabIndex={0} onClick={f}>x</li>').length === 1);
canary("an onMouseDown div option was not flagged", findMouseOnly('<div role="option" onMouseDown={e => pick(e)}>x</div>').length === 1);
canary("an arrow with > inside the handler hid a mouse-only div", findMouseOnly('<div onClick={e => { if (a > b) go(); }} className="x">x</div>').length === 1);
canary("a string attribute containing > hid a mouse-only td", findMouseOnly('<td title="a > b" onClick={f}>x</td>').length === 1);
canary("a backdrop exemption without aria-hidden was honoured", findMouseOnly('{/* a11y-exempt: backdrop */}\n<div className="back" onClick={close} />').length === 1);
canary("a stop exemption on a handler that does work was honoured", findMouseOnly('{/* a11y-exempt: stop */}\n<div onClick={e => { e.stopPropagation(); go(); }}>x</div>').length === 1);
canary("a button was flagged", findMouseOnly('<button onClick={f}>x</button>').length === 0);
canary("an anchor was flagged", findMouseOnly('<a href="#/x" onClick={f}>x</a>').length === 0);
canary("a component was flagged", findMouseOnly('<Card onClick={f} />').length === 0);
canary("a fully keyboard-operable div was flagged", findMouseOnly('<div role="button" tabIndex={0} onClick={f} onKeyDown={k}>x</div>').length === 0);
canary("a verified backdrop exemption was flagged", findMouseOnly('{/* a11y-exempt: backdrop */}\n<div className="back" onClick={close} aria-hidden="true" />').length === 0);
canary("a verified stop exemption was flagged", findMouseOnly('{/* a11y-exempt: stop */}\n<div className="modal" onClick={e => e.stopPropagation()} role="dialog">x</div>').length === 0);
if (miss) {
  console.error(`\nKEYBOARD STATIC GATE: FAIL (instrument self-test failed, ${miss} canary miss(es)). A clean result is inadmissible.`);
  process.exit(1);
}
console.log("Canary self-test PASSED: 9 seeded mouse-only specimens caught, 6 compliant specimens left alone.");

// ---- scan ------------------------------------------------------------------------
// SCAN_ROOT lets a scratch-copy mutation test point the gate at another folder.
const scanRoot = process.env.SCAN_ROOT ? path.resolve(process.env.SCAN_ROOT) : root;
let total = 0;
for (const f of SOURCE_FILES) {
  const text = fs.readFileSync(path.join(scanRoot, f), "utf8");
  for (const h of findMouseOnly(text)) {
    const line = text.slice(0, h.index).split(/\r?\n/).length;
    console.error(`MOUSE-ONLY  ${f}:${line}  <${h.tag}> ${h.open}`);
    total++;
  }
}
if (total) {
  console.error(`\nKEYBOARD STATIC GATE: FAIL. ${total} onClick/onMouseDown on a non-interactive element without role, tabIndex={0} and onKeyDown.`);
  process.exit(1);
}
console.log(`Scanned ${SOURCE_FILES.length} source files: 0 mouse-only click targets on non-interactive elements.`);
console.log("KEYBOARD STATIC GATE: PASSED.");
