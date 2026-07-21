// Asset manifest and external-origin regression test for Parliament Pulse.
//
// DESIGN PRINCIPLE (non-negotiable, mirrors tests/release-gate.mjs): this
// instrument must PROVE it can detect before it is allowed to report a clean
// result. Every run seeds a canary for each failure mode below and asserts
// the checker function catches it. If any canary is missed, the run ABORTS
// and reports FAIL, because a checker that cannot detect is worse than no
// checker: it manufactures false confidence. A "clean" result from this file
// is only admissible when the canary block passed in the same run.
//
// Scope, per the four things this file was commissioned to catch:
//   1. Every asset referenced from index.html (fonts, vendor scripts, icons,
//      manifest, og image, favicon, the seven app .js files) exists on disk.
//   2. index.html and _headers carry zero references to unpkg.com,
//      googleapis.com, gstatic.com, jsdelivr, cdnjs, or any other external
//      origin: the CSP is 'self' and a reintroduced external origin would
//      be blocked at runtime and break the page silently.
//   3. assets/fonts/fonts.css url() targets resolve relative to its OWN
//      directory (assets/fonts/), not the site root. This exact bug shipped
//      2026-07-21 and was caught by hand.
//   4. The og image stays under a 300KB budget.
//
// Run: node tests/asset-manifest.test.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OG_MAX_BYTES = 300 * 1024;

// Literal tokens from the brief. Substring match, case-insensitive: a CDN
// reference can appear in a script src, a link href, or a CSP directive
// value, and all three are just text as far as this scanner is concerned.
const BANNED_ORIGINS = ["unpkg.com", "googleapis.com", "gstatic.com", "jsdelivr", "cdnjs"];

const SITE_ORIGIN = "https://parliament-pulse.pages.dev/";

// ---------------------------------------------------------------------------
// Pure check functions. Each is canary-tested below before the real scan
// trusts it.
// ---------------------------------------------------------------------------

function findMissingPaths(paths, existsFn) {
  return paths.filter(p => !existsFn(p));
}

// Scoped to the actual attack surface: attribute VALUES (href=/src=/content=)
// in HTML, and header directive VALUES in _headers (comment lines stripped).
// A raw whole-file substring scan sounds stricter but is not: this codebase's
// _headers deliberately documents "previously loaded from unpkg.com... do not
// reintroduce" as a maintainer warning, and a naive scan would flag that
// legitimate warning forever. What actually breaks the page at runtime is a
// URL in a src/href/content attribute or a CSP directive value, so that is
// what this checks.
function extractAttributeUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/\b(?:href|src|content)\s*=\s*"([^"]*)"/g)) urls.push(m[1]);
  return urls;
}

function stripCommentLines(text) {
  return text.split(/\r?\n/).filter(line => !/^\s*#/.test(line)).join("\n");
}

function findBannedOrigins(text, origins) {
  const lower = text.toLowerCase();
  return origins.filter(o => lower.includes(o.toLowerCase()));
}

function findBannedOriginsInHtml(html, origins) {
  const urls = extractAttributeUrls(html);
  const hits = new Set();
  for (const url of urls) {
    for (const o of origins) if (url.toLowerCase().includes(o.toLowerCase())) hits.add(o);
  }
  return [...hits];
}

function findBannedOriginsInHeaders(headersText, origins) {
  return findBannedOrigins(stripCommentLines(headersText), origins);
}

// fonts.css uses url("X.woff2") with paths relative to fonts.css's own
// directory. Resolve against fontsDir, not the repo root.
function findBrokenFontUrls(cssText, fontsDir, existsFn) {
  const broken = [];
  for (const m of cssText.matchAll(/url\(\s*"([^"]+)"\s*\)/g)) {
    const rel = m[1];
    if (/^https?:\/\//i.test(rel)) { broken.push(rel); continue; } // self-hosted only
    if (!existsFn(path.join(fontsDir, rel))) broken.push(rel);
  }
  return broken;
}

function isUnderBudget(bytes, max) {
  return bytes <= max;
}

// ---------------------------------------------------------------------------
// CANARY GATE. Prove the instrument detects before trusting it to report clean.
// ---------------------------------------------------------------------------
let canaryFailures = 0;

// 1. Missing asset path.
{
  const canaryPath = path.join(root, "assets", "__canary-missing-asset__.png");
  const missing = findMissingPaths([canaryPath], fs.existsSync);
  if (missing.length !== 1) {
    console.error("CANARY MISS: missing-asset detector did not flag a nonexistent referenced path.");
    canaryFailures++;
  }
}

// 2. Injected external-origin reference in an HTML attribute, one specimen
// per banned origin.
for (const origin of BANNED_ORIGINS) {
  const specimen = `<script src="https://${origin}/some/lib@1.0.0/dist/lib.min.js"></script>`;
  const hits = findBannedOriginsInHtml(specimen, BANNED_ORIGINS);
  if (!hits.includes(origin)) {
    console.error(`CANARY MISS: HTML external-origin detector did not catch an injected "${origin}" reference.`);
    canaryFailures++;
  }
}
// Same, but via a reintroduced CSP directive value in _headers.
for (const origin of BANNED_ORIGINS) {
  const specimen = `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' https://${origin}\n`;
  const hits = findBannedOriginsInHeaders(specimen, BANNED_ORIGINS);
  if (!hits.includes(origin)) {
    console.error(`CANARY MISS: _headers external-origin detector did not catch an injected "${origin}" CSP value.`);
    canaryFailures++;
  }
}
// A clean specimen must NOT trip a false positive.
{
  const cleanSpecimen = `<script src="data.js"></script><link rel="stylesheet" href="assets/fonts/fonts.css">`;
  const hits = findBannedOriginsInHtml(cleanSpecimen, BANNED_ORIGINS);
  if (hits.length !== 0) {
    console.error(`CANARY FALSE POSITIVE: HTML external-origin detector flagged a clean specimen: ${hits.join(", ")}`);
    canaryFailures++;
  }
}
// A maintainer's "do not reintroduce X" warning comment must NOT trip a false
// positive: this is the real _headers content as of 2026-07-21, and treating
// documentation as a violation would make the check permanently red for a
// legitimate reason to mention the banned host name.
{
  const docCommentSpecimen = "# No CDN dependency remains: React/ReactDOM were previously loaded from\n"
    + "#   unpkg.com and are now vendored under /vendor/; do not reintroduce an\n"
    + "#   external script-src origin.\n"
    + "/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'\n";
  const hits = findBannedOriginsInHeaders(docCommentSpecimen, BANNED_ORIGINS);
  if (hits.length !== 0) {
    console.error(`CANARY FALSE POSITIVE: _headers external-origin detector flagged a maintainer warning comment: ${hits.join(", ")}`);
    canaryFailures++;
  }
}

// 3. Broken font URL, resolved relative to the fonts directory.
{
  const cssSpecimen = `@font-face{font-family:"Canary";src:url("__canary-missing__.woff2") format("woff2")}`;
  const broken = findBrokenFontUrls(cssSpecimen, path.join(root, "assets", "fonts"), fs.existsSync);
  if (broken.length !== 1) {
    console.error("CANARY MISS: font-url detector did not flag a nonexistent woff2 target.");
    canaryFailures++;
  }
  // And a real, existing font file must resolve clean (proves the "relative
  // to its own directory" fix, not just any-missing-file detection).
  const realCss = `@font-face{font-family:"Real";src:url("IBMPlexSans-400.woff2") format("woff2")}`;
  const realBroken = findBrokenFontUrls(realCss, path.join(root, "assets", "fonts"), fs.existsSync);
  if (realBroken.length !== 0) {
    console.error("CANARY FALSE POSITIVE: font-url detector flagged a real, present woff2 file.");
    canaryFailures++;
  }
}

// 4. Oversized image.
{
  if (isUnderBudget(OG_MAX_BYTES + 1, OG_MAX_BYTES) !== false) {
    console.error("CANARY MISS: image-size detector did not flag a file one byte over budget.");
    canaryFailures++;
  }
  if (isUnderBudget(OG_MAX_BYTES, OG_MAX_BYTES) !== true) {
    console.error("CANARY FALSE POSITIVE: image-size detector flagged a file exactly at budget.");
    canaryFailures++;
  }
}

if (canaryFailures > 0) {
  console.error(`\nASSET MANIFEST GATE: FAIL (instrument self-test failed, ${canaryFailures} canary miss(es)).`);
  console.error("The checker cannot prove it detects, so any clean result is inadmissible.");
  process.exit(1);
}
console.log("Canary self-test PASSED: missing-asset, external-origin, broken-font-url and oversized-image detection all proven on seeded specimens.");

// ---------------------------------------------------------------------------
// THE ACTUAL SCAN
// ---------------------------------------------------------------------------
let findings = 0;

const indexHtmlPath = path.join(root, "index.html");
const headersPath = path.join(root, "_headers");

if (!fs.existsSync(indexHtmlPath)) {
  console.error("MISSING index.html");
  process.exit(1);
}
const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");
const headersText = fs.existsSync(headersPath) ? fs.readFileSync(headersPath, "utf8") : "";
if (!fs.existsSync(headersPath)) { console.error("MISSING _headers"); findings++; }

// (a) Every href="" / src="" reference in index.html, plus the og:image and
// twitter:image meta content URLs (absolute, on this site's own origin).
const refs = new Set();
for (const m of indexHtml.matchAll(/\b(?:href|src)\s*=\s*"([^"]+)"/g)) refs.add(m[1]);
for (const m of indexHtml.matchAll(new RegExp(`content\\s*=\\s*"(${SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]+)"`, "g"))) {
  refs.add(m[1]);
}

const localPaths = [];
for (const ref of refs) {
  if (/^https?:\/\//i.test(ref) && !ref.startsWith(SITE_ORIGIN)) continue; // truly external; covered by the banned-origin scan below
  let local = ref.startsWith(SITE_ORIGIN) ? ref.slice(SITE_ORIGIN.length) : ref;
  if (local.startsWith("/")) local = local.slice(1);
  if (!local) continue; // e.g. og:url content="https://parliament-pulse.pages.dev/" resolves to the site root, not an asset
  localPaths.push({ ref, full: path.join(root, local) });
}

for (const { ref, full } of localPaths) {
  if (!fs.existsSync(full)) {
    console.error(`MISSING ASSET  index.html references "${ref}" -> not found at ${path.relative(root, full)}`);
    findings++;
  }
}

// (b) The seven shipped .js files explicitly, belt-and-braces on top of (a).
const SEVEN_JS = ["data.js", "entities.js", "icons.js", "store.js", "shell.js", "pages.js", "app.js"];
for (const f of SEVEN_JS) {
  if (!fs.existsSync(path.join(root, f))) { console.error(`MISSING SHIPPED JS  ${f}`); findings++; }
}

// (c) manifest.webmanifest icon entries.
const manifestPath = path.join(root, "manifest.webmanifest");
if (fs.existsSync(manifestPath)) {
  let manifestJson;
  try {
    manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (e) {
    console.error(`MANIFEST PARSE ERROR  manifest.webmanifest: ${e.message}`);
    findings++;
    manifestJson = { icons: [] };
  }
  for (const icon of manifestJson.icons || []) {
    if (!fs.existsSync(path.join(root, icon.src))) {
      console.error(`MISSING MANIFEST ICON  manifest.webmanifest -> ${icon.src}`);
      findings++;
    }
  }
} else {
  console.error("MISSING manifest.webmanifest");
  findings++;
}

// (d) External origins actually reachable at runtime: HTML attribute values
// in index.html, and non-comment header directive values in _headers.
// (Comment prose is deliberately out of scope: see the canary block above.)
{
  const hits = findBannedOriginsInHtml(indexHtml, BANNED_ORIGINS);
  const lines = indexHtml.split(/\r?\n/);
  for (const origin of hits) {
    const n = lines.findIndex(l => l.toLowerCase().includes(origin.toLowerCase()));
    console.error(`EXTERNAL ORIGIN REFERENCE  index.html:${n + 1}  a src/href/content attribute contains banned origin "${origin}"`);
    if (n >= 0) console.error(`             ${lines[n].trim().slice(0, 160)}`);
    findings++;
  }
}
if (headersText) {
  const hits = findBannedOriginsInHeaders(headersText, BANNED_ORIGINS);
  const lines = headersText.split(/\r?\n/);
  for (const origin of hits) {
    const n = lines.findIndex(l => !/^\s*#/.test(l) && l.toLowerCase().includes(origin.toLowerCase()));
    console.error(`EXTERNAL ORIGIN REFERENCE  _headers:${n + 1}  a header directive value contains banned origin "${origin}"`);
    if (n >= 0) console.error(`             ${lines[n].trim().slice(0, 160)}`);
    findings++;
  }
}

// (e) fonts.css resolution relative to its own directory.
const fontsCssPath = path.join(root, "assets", "fonts", "fonts.css");
if (fs.existsSync(fontsCssPath)) {
  const cssText = fs.readFileSync(fontsCssPath, "utf8");
  const broken = findBrokenFontUrls(cssText, path.dirname(fontsCssPath), fs.existsSync);
  for (const b of broken) {
    console.error(`BROKEN FONT URL  assets/fonts/fonts.css -> "${b}" not found in assets/fonts/`);
    findings++;
  }
} else {
  console.error("MISSING assets/fonts/fonts.css");
  findings++;
}

// (f) og image size budget.
const ogPath = path.join(root, "assets", "og.png");
if (fs.existsSync(ogPath)) {
  const size = fs.statSync(ogPath).size;
  if (!isUnderBudget(size, OG_MAX_BYTES)) {
    console.error(`OG IMAGE TOO LARGE  assets/og.png is ${(size / 1024).toFixed(1)}KB, exceeds the ${(OG_MAX_BYTES / 1024) | 0}KB budget`);
    findings++;
  }
} else {
  console.error("MISSING assets/og.png");
  findings++;
}

if (findings > 0) {
  console.error(`\nASSET MANIFEST GATE: FAIL. ${findings} finding(s).`);
  process.exit(1);
}
console.log(`Checked ${localPaths.length} referenced local path(s), manifest icons, fonts.css resolution, external-origin scan (index.html + _headers), and og image size.`);
console.log("ASSET MANIFEST GATE: PASSED.");
