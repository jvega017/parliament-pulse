// Deploy-integrity test (FE-01). Two halves:
//   1. The production probe's verdict functions (deploy-probe-lib.mjs), driven
//      with mocked responses: each must DETECT its canary and stay SILENT on a
//      known-good specimen. The real functions are called, not copies of them.
//   2. build-dist.ps1 is run for real and dist/ is inspected: only allowlisted
//      files, no internal file types, a correct sha256 for every file, and the
//      current HEAD SHA in build-info.json.
// Usage: node tests/deploy-integrity.test.mjs   (Windows; needs powershell and git)

import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DENYLIST, classifyDenied, compareProvenance, sha256, shippedUrls } from "./deploy-probe-lib.mjs";
import { JSX_FILES } from "../scripts/build-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

// ---- 1. verdict functions -------------------------------------------------
const readme = fs.readFileSync(path.join(root, "README.md"));
const fallback = Buffer.from("<!doctype html><html><title>Parliament Pulse</title></html>");
const crlfReadme = Buffer.from(readme.toString("utf8").replace(/\r?\n/g, "\r\n"));

check(classifyDenied({ status: 200, body: readme }, readme, [fallback]).exposed === true,
  "denylist canary: 200 carrying README.md bytes is EXPOSED");
check(classifyDenied({ status: 200, body: crlfReadme }, readme, [fallback]).exposed === true,
  "denylist canary: 200 carrying README.md with CRLF endings is EXPOSED");
check(classifyDenied({ status: 200, body: Buffer.from("# an older README") }, readme, [fallback]).exposed === true,
  "denylist canary: 200 carrying a different, non-fallback body is EXPOSED");
check(classifyDenied({ status: 403, body: Buffer.from("forbidden") }, readme, [fallback]).exposed === true,
  "denylist fail-closed: a 403 is unverifiable and treated as EXPOSED");
check(classifyDenied({ status: 404, body: Buffer.from("not found") }, readme, [fallback]).exposed === false,
  "denylist restraint: a 404 is not exposed");
check(classifyDenied({ status: 200, body: fallback }, readme, [fallback]).exposed === false,
  "denylist restraint: the SPA/404 fallback body is not exposed");
check(DENYLIST.length >= 19 && DENYLIST.some(d => d.path === "/cf-list.ps1") && DENYLIST.some(d => d.path === "/parliament-pulse-beta"),
  "denylist covers the 19 FE-01 paths including /cf-list.ps1 and /parliament-pulse-beta");

const good = Buffer.from("console.log('built');");
const info = { files: { "app.js": sha256(good), "_headers": sha256(Buffer.from("x")) } };
check(compareProvenance(info, new Map([["app.js", { status: 200, body: good }]])).length === 0,
  "provenance restraint: identical served bytes report no drift (and _headers is not fetched)");
const drift = compareProvenance(info, new Map([["app.js", { status: 200, body: Buffer.from("console.log('old');") }]]));
check(drift.length === 1 && drift[0].file === "app.js",
  "provenance canary: changed served bytes report drift on app.js");
check(compareProvenance(info, new Map([["app.js", { error: "ECONNRESET" }]])).length === 1,
  "provenance fail-closed: a failed fetch counts as drift");

// shippedUrls: hashed names come from build-info.json's js_map (FE-11).
{
  const map = { "app.js": "app.0123abcd.js", "data.js": "data.89abcdef.js" };
  const urls = shippedUrls({ js_map: map }, ["data.js", "app.js"]);
  check(JSON.stringify(urls) === JSON.stringify(["index.html", "data.89abcdef.js", "app.0123abcd.js"]),
    "shippedUrls restraint: index.html plus each hashed name, in the order asked");
  let threw = false;
  try { shippedUrls({ files: {} }, ["app.js"]); } catch { threw = true; }
  check(threw, "shippedUrls fail-closed: a manifest without js_map throws instead of falling back to plain names");
  threw = false;
  try { shippedUrls({ js_map: { "app.js": "app.js" } }, ["app.js"]); } catch { threw = true; }
  check(threw, "shippedUrls canary: an unhashed name in js_map is refused");
}

// ---- 2. build-dist.ps1 output ---------------------------------------------
if (process.platform !== "win32") {
  console.log("SKIP  build-dist.ps1 checks need Windows PowerShell");
} else {
  const run = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "build-dist.ps1"), "-SkipCompile"],
    { cwd: root, encoding: "utf8" });
  check(run.status === 0, `build-dist.ps1 exits 0${run.status === 0 ? "" : ": " + (run.stderr || run.stdout).slice(0, 400)}`);

  const dist = path.join(root, "dist");
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(dist, path.join(dir, e.name)).replace(/\\/g, "/")]);
  const built = fs.existsSync(dist) ? walk(dist) : [];

  const allowTop = new Set(["index.html", "_headers", "manifest.webmanifest", "favicon.ico", "404.html", "robots.txt", "build-info.json"]);
  // App scripts ship only under content-hashed names (FE-11).
  const hashedApp = new RegExp(`^(${JSX_FILES.join("|")})\\.[0-9a-f]{8}\\.js$`);
  const stray = built.filter(f => !(allowTop.has(f) || hashedApp.test(f) || f.startsWith("vendor/") || f.startsWith("assets/")));
  check(built.length > 0 && stray.length === 0, `dist/ holds only allowlisted files${stray.length ? ": stray " + stray.join(", ") : ""}`);
  const denied = built.filter(f => /\.(md|jsx|ps1|mjs|py)$/i.test(f) || /(^|\/)parliament-pulse[^/]*\.html$/i.test(f) || f === "assets/asset-forge.html");
  check(denied.length === 0, `dist/ carries no .md/.jsx/.ps1/.mjs/.py, bundle or asset-forge file${denied.length ? ": " + denied.join(", ") : ""}`);
  for (const f of ["index.html", "404.html", "robots.txt", "build-info.json", "vendor/react.production.min.js", "assets/fonts/fonts.css"]) {
    check(built.includes(f), `dist/${f} present`);
  }

  let bi = null;
  try { bi = JSON.parse(fs.readFileSync(path.join(dist, "build-info.json"), "utf8").replace(/^﻿/, "")); } catch { bi = null; }
  check(!!bi, "dist/build-info.json parses");
  if (bi) {
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    check(bi.git_sha === head, `build-info git_sha equals HEAD (${head.slice(0, 12)})`);
    check(typeof bi.built_at === "string" && !Number.isNaN(Date.parse(bi.built_at)), "build-info built_at is an ISO timestamp");
    const expected = built.filter(f => f !== "build-info.json");
    const missing = expected.filter(f => !(f in bi.files));
    check(missing.length === 0, `build-info lists every dist file${missing.length ? ": missing " + missing.join(", ") : ""}`);
    const wrong = Object.entries(bi.files).filter(([f, h]) => !built.includes(f) || sha256(fs.readFileSync(path.join(dist, f))) !== h);
    check(wrong.length === 0, `every build-info sha256 matches the file on disk${wrong.length ? ": " + wrong.map(w => w[0]).join(", ") : ""}`);
  }
}

console.log(failures ? `\nDEPLOY INTEGRITY: FAIL (${failures} check(s)).` : "\nDEPLOY INTEGRITY: PASSED.");
process.exit(failures ? 1 : 0);
