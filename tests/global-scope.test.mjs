// Global-scope proof for the minified dist bundle (FE-11: PR-16, ARCH-11).
//
// The app is eleven classic scripts that share ONE global lexical scope: a
// top-level const in data.js (SIGNALS) or a function in store.js (useStore) is
// read directly by later files. Minification that renamed or wrapped those
// top-level names would break the app silently at runtime, so this test proves
// they survive:
//   (a) parse the unminified built .js for top-level function, const, let and
//       class names, and keep the ones another file references;
//   (b) build a scratch dist with the real pipeline (scripts/build-dist.mjs),
//       load its minified, hash-named files in index.html order into one
//       node:vm context with a React shim, and assert that each of those names
//       resolves;
//   (c) run the honest-surfaces render (tests/honest-surfaces-lib.mjs) against
//       that minified bundle and require the same clean result as the committed
//       .js;
//   (d) canary: a scratch build that breaks the shared scope must FAIL (b).
//
// Parser self-checks (the instrument must prove itself before it is trusted):
//   restraint: every name the parser reports resolves in the UNMINIFIED bundle,
//              so it invents nothing;
//   coverage:  every function the unminified bundle leaves on the global object
//              is in the parser's list, so it misses no function declaration.
//
// Run: node tests/global-scope.test.mjs   Exit 0 = pass, 1 = fail.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { root, JSX_FILES } from "../scripts/build-config.mjs";
import { buildDist } from "../scripts/build-dist.mjs";
import { renderSurfaces, honestAssertions } from "./honest-surfaces-lib.mjs";

let failures = 0;
const fail = m => { console.error(`FAIL  ${m}`); failures++; };

// ---- (a) top-level names --------------------------------------------------------
const IDENT = "[A-Za-z_$][\\w$]*";
export function topLevelNames(src) {
  const names = new Set();
  for (const line of src.split("\n")) {
    let m;
    if ((m = line.match(new RegExp(`^(?:async\\s+)?function\\*?\\s+(${IDENT})`)))) names.add(m[1]);
    else if ((m = line.match(new RegExp(`^class\\s+(${IDENT})`)))) names.add(m[1]);
    else if ((m = line.match(/^(?:const|let|var)\s*\{([^}]*)\}\s*=/))) {
      for (const part of m[1].split(",")) {
        const n = part.split(":").pop().split("=")[0].trim();
        if (new RegExp(`^${IDENT}$`).test(n)) names.add(n);
      }
    } else if ((m = line.match(new RegExp(`^(?:const|let|var)\\s+(${IDENT})`)))) names.add(m[1]);
  }
  return names;
}
const stripComments = src => transformSync(src, { loader: "js", minifyWhitespace: true, legalComments: "none" }).code;

const plain = Object.fromEntries(JSX_FILES.map(f => [f, fs.readFileSync(path.join(root, `${f}.js`), "utf8")]));
const code = Object.fromEntries(JSX_FILES.map(f => [f, stripComments(plain[f])]));
const declared = new Map(); // name -> declaring file
for (const f of JSX_FILES) for (const n of topLevelNames(plain[f])) declared.set(n, f);
const crossFile = [...declared].filter(([n, owner]) => JSX_FILES.some(f => f !== owner && new RegExp(`(^|[^\\w$.])${n.replace(/\$/g, "\\$")}([^\\w$]|$)`).test(code[f]))).map(([n]) => n);

// ---- the loader: classic scripts in order, one context --------------------------
function loadContext(sources) {
  const Fragment = Symbol("Fragment");
  const noop = () => {};
  const React = {
    Fragment, StrictMode: Fragment, Component: class { constructor(p) { this.props = p; } },
    createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
    createContext: v => ({ _default: v }), useContext: () => null,
    useState: i => [typeof i === "function" ? i() : i, noop], useMemo: fn => fn(), useCallback: fn => fn,
    useRef: v => ({ current: v }), useEffect: noop, useLayoutEffect: noop, useId: () => "id",
    memo: c => c, forwardRef: c => c,
  };
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, remove: noop, addEventListener: noop });
  const g = {
    React, ReactDOM: { createRoot: () => ({ render: noop }) }, console, Date, Math, JSON, Map, Set, Symbol, Promise,
    Array, Object, String, Number, RegExp, Error, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    navigator: { platform: "Win32", clipboard: {} },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    location: { hostname: "parliament-pulse.pages.dev", search: "", hash: "", pathname: "/" },
    history: { replaceState: noop, pushState: noop },
    document: { createElement: el, body: { appendChild: noop }, getElementById: () => el(), addEventListener: noop, removeEventListener: noop },
    fetch: () => new Promise(noop), addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
  };
  g.window = g;
  const ctx = vm.createContext(g);
  const baseline = new Set(Object.keys(g));
  sources.forEach(({ name, src }) => vm.runInContext(src, ctx, { filename: name }));
  return { ctx, baseline };
}
function unresolved(ctx, names) {
  return names.filter(n => {
    try { return vm.runInContext(`typeof ${n}`, ctx) === "undefined"; } catch { return true; }
  });
}

// ---- parser self-checks on the unminified bundle ----------------------------------
{
  const { ctx, baseline } = loadContext(JSX_FILES.map(f => ({ name: `${f}.js`, src: plain[f] })));
  const invented = unresolved(ctx, [...declared.keys()]);
  if (invented.length) fail(`parser restraint: ${invented.length} reported name(s) do not resolve in the unminified bundle: ${invented.join(", ")}`);
  const globalFns = Object.keys(ctx).filter(k => !baseline.has(k) && typeof ctx[k] === "function" && k !== "window");
  // A global function the parser did not report, declared at top level in a file
  // (the regex below is looser than the parser: any indentation-free declaration).
  const missed = globalFns.filter(k => !declared.has(k) && JSX_FILES.some(f => new RegExp(`^\\s*(?:async\\s+)?function\\s+${k.replace(/\$/g, "\\$")}\\b`, "m").test(plain[f])));
  if (missed.length) fail(`parser coverage: function declaration(s) not found by the parser: ${missed.join(", ")}`);
  if (declared.size < 100 || crossFile.length < 40) fail(`parser found only ${declared.size} top-level names, ${crossFile.length} cross-file; expected far more (parser broken?)`);
}
if (failures) { console.error("\nGLOBAL SCOPE: FAIL (instrument self-test)."); process.exit(1); }
console.log(`Parser self-check PASSED: ${declared.size} top-level names across ${JSX_FILES.length} files, ${crossFile.length} referenced from another file; all resolve unminified and no function declaration was missed.`);

// ---- (b) + (c) against a scratch dist built by the real pipeline ------------------
function distSources(dir) {
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*"([^"]+)"/g)].map(m => m[1]).filter(s => !s.startsWith("vendor/"));
  return srcs.map(s => ({ name: s, src: fs.readFileSync(path.join(dir, s), "utf8") }));
}
function scopeProblems(dir) {
  const problems = [];
  const sources = distSources(dir);
  let loaded;
  try { loaded = loadContext(sources); } catch (e) { return [`the bundle throws while loading: ${e.message}`]; }
  const lost = unresolved(loaded.ctx, crossFile);
  if (lost.length) problems.push(`${lost.length} cross-file name(s) do not resolve: ${lost.slice(0, 12).join(", ")}${lost.length > 12 ? ", ..." : ""}`);
  return problems;
}
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scope-"));
const canaryDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scope-canary-"));
try {
  const info = buildDist(scratch, { writeBuildInfo: false });
  const sources = distSources(scratch);
  const expectOrder = JSX_FILES.map(f => info.js_map[`${f}.js`]);
  if (JSON.stringify(sources.map(s => s.name)) !== JSON.stringify(expectOrder)) fail(`dist index.html script order ${sources.map(s => s.name).join(", ")} does not follow JSX_FILES`);
  if (!sources.every(s => /^[\w-]+\.[0-9a-f]{8}\.js$/.test(s.name))) fail("dist index.html loads a script that is not content-hashed");
  const minified = sources.every(s => !/\n\s{2,}\S/.test(s.src));
  if (!minified) fail("dist scripts still carry indentation: the minify step did not run");

  // (d) canaries first: each scope-breaking build must fail the scope check.
  //
  // MEASURED 29 Sep 2026 with the pinned esbuild 0.28.2: --minify-identifiers on
  // its own does NOT break this bundle. Without --format or --bundle, esbuild
  // treats a file's top-level names as globals of a classic script and keeps them;
  // it renames only locals. So a build with --minify-identifiers alone resolves
  // every cross-file name, and requiring it to fail would make this canary lie.
  // The scope-breaking builds are the ones that give each file its own function
  // scope: --format=iife, and --bundle (which defaults to an IIFE for a browser
  // target), each alone or combined with --minify-identifiers. Those must fail.
  // The --minify-identifiers-only build is still run and its result printed, so a
  // future esbuild that starts renaming top-level names shows up here.
  const CANARIES = [
    { why: "--minify-identifiers --format=iife", flags: ["--minify-identifiers", "--format=iife"], mustFail: true },
    { why: "--format=iife", flags: ["--format=iife"], mustFail: true },
    { why: "--bundle --minify-identifiers", flags: ["--bundle", "--minify-identifiers"], mustFail: true },
    { why: "--minify-identifiers alone (measured safe; reported, not required to fail)", flags: ["--minify-identifiers"], mustFail: false },
  ];
  for (const c of CANARIES) {
    buildDist(canaryDir, { writeBuildInfo: false, extraMinifyFlags: c.flags });
    const p = scopeProblems(canaryDir);
    console.log(`canary ${c.why}: ${p.length ? "caught" : "not caught"} (${p[0] || "every cross-file name resolves"})`);
    if (c.mustFail && !p.length) fail(`canary ${c.why}: a scope-breaking build passed the scope check`);
  }
  if (failures) { console.error("\nGLOBAL SCOPE: FAIL (canary)."); process.exit(1); }

  // (b) the real minified build.
  for (const p of scopeProblems(scratch)) fail(`minified dist: ${p}`);
  console.log(`(b) ${crossFile.length} cross-file names resolve in the ${sources.length} minified, hash-named dist scripts loaded in index.html order.`);

  // (c) honest-surfaces render against the minified bundle (app.js excluded, as in
  // tests/honest-surfaces.test.mjs: it mounts the React root at load).
  const bundle = sources.filter(s => !s.name.startsWith("app.")).map(s => s.src);
  let out;
  try { out = renderSurfaces(bundle); } catch (e) { fail(`honest-surfaces render throws on the minified bundle: ${e.message}`); }
  if (out) {
    const f = honestAssertions(out);
    for (const m of f) fail(`honest-surfaces on minified dist: ${m}`);
    if (!f.length) console.log("(c) honest-surfaces render PASSED against the minified dist bundle.");
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(canaryDir, { recursive: true, force: true });
}

if (failures) { console.error(`\nGLOBAL SCOPE: FAIL. ${failures} finding(s).`); process.exit(1); }
console.log("GLOBAL SCOPE: PASSED. Minification keeps every cross-file top-level name in the shared global scope, and the minified bundle renders the same honest surfaces.");
