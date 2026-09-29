// Copy and token gates (FE-09: UX-18, UX-20, PR-17). Run after npm run build.
// Exit 0 = pass, 1 = fail.
//
//   em-dash  no U+2014 (literal, — escape, &mdash; or &#8212;) in any string
//            literal, template literal or JSX text of the built bundle (the seven
//            .js files), with comments excluded; and none in index.html outside
//            HTML and CSS comments. That covers <title>, the description, OG and
//            Twitter meta and every inline string. Missing values render as
//            NOT_SUPPLIED ("Not supplied") or NO_VALUE (a middle dot).
//   raw-hex  index.html: outside the tokens:begin / tokens:end block, no hex
//            colour except #fff and #000 (and #ffffff, #000000), and a
//            theme-color meta may carry a hex only if it is a brand token; inside
//            the block, every hex must appear in tests/brand-hex-allowlist.json,
//            generated from 04_Templates/brand-tokens.json by
//            scripts/sync-brand-hex.mjs. Built .js: no hex other than #fff/#000.
//   streak   the word "streak" appears nowhere in the built .js (PR-17: the
//            reading-streak state and its localStorage key are gone).
//
// Canaries (in-memory scratch copies; the working tree is never touched). Each
// must FAIL for its named reason, and the restraint specimens must PASS:
//   fail: em dash in a pages-today.js string, — escape in a shell.js string, em
//         dash in the <title>, em dash in og:title, em dash in JSX text;
//         raw hex in a CSS rule outside the token block, off-allowlist hex inside
//         the block, off-token theme-color, hex in an inline style of store.js;
//         the streak state restored in shell.js.
//   pass: em dash in a JS comment, in an HTML comment, in a CSS comment; #fff
//         and #000 in a CSS rule.
import fs from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";
import { root, JSX_FILES } from "../scripts/build-config.mjs";

const read = f => fs.readFileSync(path.join(root, f), "utf8");
const ALLOW = new Set(JSON.parse(read("tests/brand-hex-allowlist.json")).hex.map(h => h.toLowerCase()));
const EXEMPT = new Set(["#fff", "#000", "#ffffff", "#000000"]);
const DASH = /—|\\u2014|&mdash;|&#8212;|&#x2014;/i;
const HEX = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b/g;

// esbuild's whitespace minifier drops every comment and keeps every string,
// template and JSX-compiled text, so what is left is exactly the shipped copy.
function code(js) { return transformSync(js, { loader: "js", minifyWhitespace: true, legalComments: "none" }).code; }
function lineOf(text, idx) { return text.slice(0, idx).split("\n").length; }
function stripHtmlAndCssComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "))
             .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
}

function assertions({ js, html }) {
  const f = [];
  // em-dash
  for (const [name, src] of Object.entries(js)) {
    let c;
    try { c = code(src); } catch (e) { f.push(`${name}.js does not parse: ${e.message.split("\n")[0]}`); continue; }
    const m = c.match(DASH);
    if (m) {
      const i = c.indexOf(m[0]);
      f.push(`em-dash: ${name}.js ships an em dash in copy: ...${c.slice(Math.max(0, i - 40), i + 20)}...`);
    }
    if (/streak/i.test(src)) f.push(`streak: ${name}.js mentions "streak"`);
    for (const h of c.match(HEX) || []) {
      // Only colour-like contexts: a quoted string or a style value. Hash routes
      // (#/about) never match HEX because "/" is not hex.
      if (!EXEMPT.has(h.toLowerCase())) f.push(`raw-hex: ${name}.js ships the colour ${h}; use a token variable`);
    }
  }
  const bare = stripHtmlAndCssComments(html);
  const dm = bare.match(DASH);
  if (dm) f.push(`em-dash: index.html line ${lineOf(bare, bare.indexOf(dm[0]))} carries an em dash outside comments`);
  // raw-hex in index.html
  const start = html.indexOf("/* tokens:begin");
  const end = html.indexOf("/* tokens:end */");
  if (start < 0 || end < start) { f.push("raw-hex: index.html has no tokens:begin / tokens:end block"); return f; }
  const inside = stripHtmlAndCssComments(html.slice(start, end));
  const outside = stripHtmlAndCssComments(html.slice(0, start) + " ".repeat(end - start) + html.slice(end));
  for (const m of inside.matchAll(HEX)) {
    const h = m[0].toLowerCase();
    if (!ALLOW.has(h) && !EXEMPT.has(h)) f.push(`raw-hex: token block defines ${m[0]}, which is not in brand-tokens.json (tests/brand-hex-allowlist.json)`);
  }
  for (const m of outside.matchAll(HEX)) {
    const h = m[0].toLowerCase();
    if (EXEMPT.has(h)) continue;
    const lineStart = outside.lastIndexOf("\n", m.index) + 1;
    const line = outside.slice(lineStart, outside.indexOf("\n", m.index));
    if (/<meta name="theme-color"/.test(line) && ALLOW.has(h)) continue;
    f.push(`raw-hex: index.html line ${lineOf(outside, m.index)} uses ${m[0]} outside the token block`);
  }
  return f;
}

// ---- real run ------------------------------------------------------------------
const JS = Object.fromEntries(JSX_FILES.map(n => [n, read(`${n}.js`)]));
const HTML = read("index.html");
for (const n of JSX_FILES) {
  if (fs.statSync(path.join(root, `${n}.jsx`)).mtimeMs > fs.statSync(path.join(root, `${n}.js`)).mtimeMs + 1000) {
    console.error(`STALE BUILD: ${n}.jsx is newer than ${n}.js; run npm run build`);
    process.exit(1);
  }
}
let failures = 0;
const real = assertions({ js: JS, html: HTML });
if (real.length) { console.error("COPY GATES FAILED:\n  " + real.join("\n  ")); failures++; }

// ---- canaries --------------------------------------------------------------------
const E = "—";
function mutJs(name, from, to) {
  const src = JS[name];
  if (typeof src !== "string" || !src.includes(from)) return null;
  return { js: { ...JS, [name]: src.replace(from, to) }, html: HTML };
}
function mutHtml(from, to) {
  if (!HTML.includes(from)) return null;
  return { js: JS, html: HTML.replace(from, to) };
}
const tokenLine = HTML.match(/--t-parliament:\s*#[0-9a-fA-F]{6};/);
const canaries = [
  { why: "em dash in a pages-today.js string", expect: "em-dash: pages-today.js", specimen: mutJs("pages-today", '"Priority signals"', `"Priority ${E} signals"`) },
  { why: "\\u2014 escape in a shell.js string", expect: "em-dash: shell.js", specimen: mutJs("shell", '"Live data unavailable"', '"Live data \\u2014 unavailable"') },
  { why: "the NOT_SUPPLIED sentinel set back to an em dash", expect: "em-dash: data.js", specimen: mutJs("data", 'const NOT_SUPPLIED = "Not supplied";', `const NOT_SUPPLIED = "${E}";`) },
  { why: "em dash in <title>", expect: "em-dash: index.html", specimen: mutHtml("<title>Parliament Pulse · Prometheus Policy Lab</title>", `<title>Parliament Pulse ${E} Prometheus Policy Lab</title>`) },
  { why: "em dash in og:title", expect: "em-dash: index.html", specimen: mutHtml('content="Parliament Pulse · Prometheus Policy Lab" />', `content="Parliament Pulse ${E} Prometheus Policy Lab" />`) },
  { why: "raw hex in a CSS rule outside the token block", expect: "outside the token block", specimen: mutHtml(".site-foot a { color: var(--link); }", ".site-foot a { color: #f08a3c; }") },
  { why: "off-token hex inside the token block", expect: "not in brand-tokens.json", specimen: tokenLine ? mutHtml(tokenLine[0], "--t-parliament: #f08a3c;") : null },
  { why: "off-token theme-color", expect: "outside the token block", specimen: mutHtml('<meta name="theme-color" content="#06070d"', '<meta name="theme-color" content="#07080e"') },
  { why: "hex in a store-detail.js inline style", expect: "raw-hex: store-detail.js", specimen: mutJs("store-detail", "color-mix(in srgb, #000 75%, transparent)", "#000000bf") },
  { why: "streak state restored", expect: "streak: shell.js", specimen: mutJs("shell", "function liveNavState(", "const streakCount = 0;\nfunction liveNavState(") },
];
const restraints = [
  { why: "em dash in a JS comment", specimen: mutJs("pages-workspace", "function PageBriefings() {", `// Briefings ${E} the queue\nfunction PageBriefings() {`) },
  { why: "em dash in an HTML comment", specimen: mutHtml("<!-- register: b -->", `<!-- register: b ${E} Fire House -->`) },
  { why: "em dash in a CSS comment", specimen: mutHtml("/* ---------- Print (PR-13) ----------", `/* ---------- Print ${E} PR-13 ----------`) },
  { why: "#fff and #000 in a CSS rule", specimen: mutHtml(".site-foot a { color: var(--link); }", ".site-foot a { color: var(--link); outline-color: #fff; border-color: #000; }") },
];
for (const c of canaries) {
  if (!c.specimen) { console.error(`CANARY BUILD ERROR: "${c.why}" did not apply; the source moved.`); failures++; continue; }
  const got = assertions(c.specimen);
  if (!got.some(m => m.includes(c.expect))) { console.error(`CANARY NOT CAUGHT: ${c.why} (expected a failure containing "${c.expect}"; got ${JSON.stringify(got)})`); failures++; }
}
for (const r of restraints) {
  if (!r.specimen) { console.error(`RESTRAINT BUILD ERROR: "${r.why}" did not apply; the source moved.`); failures++; continue; }
  const got = assertions(r.specimen);
  if (got.length) { console.error(`RESTRAINT FAILED: ${r.why} was flagged: ${got.join("; ")}`); failures++; }
}
if (failures) { console.error(`\nCOPY GATES: FAILED (${failures}).`); process.exit(1); }
console.log(`Canary self-test PASSED: ${canaries.length} planted defects each failed, ${restraints.length} known-good specimens passed.`);
console.log("COPY GATES: PASSED. No em dash in shipped copy or index.html, no raw hex outside the brand token block, no streak state.");
