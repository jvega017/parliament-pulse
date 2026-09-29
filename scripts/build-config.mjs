// Single source of truth for how each .jsx becomes its shipped .js.
//
// Used by scripts/build.mjs (npm run build) and by tests/release-gate.mjs (the
// content-based jsx/js sync check). build-jsx.ps1 passes the same flags to the
// same pinned binary. If you change a flag here, change it in build-jsx.ps1.
//
// NO minify and NO bundle: each file keeps its top-level declarations in the
// shared global lexical scope (SIGNALS, useStore, Icon and so on are referenced
// across files), exactly as the old in-browser Babel pipeline did.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load order: index.html loads the built .js in exactly this order (FE-11 split
// pages.jsx and store.jsx, ARCH-11). tests/asset-manifest.test.mjs checks that
// index.html agrees, and tests/global-scope.test.mjs loads the minified dist copies
// in this order.
export const JSX_FILES = [
  "data", "entities", "icons",
  "store", "store-detail",
  "shell",
  "pages-shared", "pages-today", "pages-workspace", "pages-reference",
  "app",
];

// Logical modules for tests that address source by concern: "store" and "pages"
// were single files before FE-11. readModule() joins a group's files in load order
// with the same newline-semicolon-newline separator the render harnesses use, so a canary that
// mutates text inside the group behaves as it did against the single file.
export const MODULE_GROUPS = {
  store: ["store", "store-detail"],
  pages: ["pages-shared", "pages-today", "pages-workspace", "pages-reference"],
};
export const GROUP_JOIN = "\n;\n";
export function moduleFiles(name) { return MODULE_GROUPS[name] || [name]; }
export function readModule(name, ext = "js") {
  return moduleFiles(name).map(f => fs.readFileSync(path.join(root, `${f}.${ext}`), "utf8")).join(GROUP_JOIN);
}

export const ESBUILD_FLAGS = ["--target=es2018", "--loader:.jsx=jsx"];

// The pinned local binary (package.json devDependency, exact version). Invoked
// through node so it behaves the same on Windows and Linux CI.
export const ESBUILD_BIN = path.join(root, "node_modules", "esbuild", "bin", "esbuild");

// Compile one .jsx (path relative to root) to an absolute outfile. Runs from the
// repo root with a relative entry point, as build-jsx.ps1 does, so any path the
// compiler might embed is identical between the build and the sync check.
export function compile(base, outfile) {
  if (!fs.existsSync(ESBUILD_BIN)) {
    return { ok: false, error: `pinned esbuild not installed at ${ESBUILD_BIN}. Run npm ci.` };
  }
  const r = spawnSync(process.execPath, [ESBUILD_BIN, `${base}.jsx`, `--outfile=${outfile}`, ...ESBUILD_FLAGS, "--log-level=warning"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || `exit ${r.status}`).trim() };
  return { ok: true };
}

// FE-11 (PR-16): the dist copies of the built .js are minified by
// scripts/dist-finalise.mjs, never the committed .js (tests/release-gate.mjs
// byte-compares those). Whitespace and syntax only: NO --minify-identifiers, NO
// --bundle and NO --format, so each file stays a classic script whose top-level
// declarations share the one global lexical scope. The target matches
// ESBUILD_FLAGS so syntax minification never emits newer syntax than the build.
// tests/global-scope.test.mjs proves the minified files still resolve every
// cross-file name.
export const MINIFY_FLAGS = ["--minify-whitespace", "--minify-syntax", "--target=es2018", "--legal-comments=none"];

// Minify one .js file to an outfile with the pinned esbuild. extraFlags exists
// for the global-scope canary only.
export function minify(infile, outfile, extraFlags = []) {
  if (!fs.existsSync(ESBUILD_BIN)) {
    return { ok: false, error: `pinned esbuild not installed at ${ESBUILD_BIN}. Run npm ci.` };
  }
  const r = spawnSync(process.execPath, [ESBUILD_BIN, infile, `--outfile=${outfile}`, ...MINIFY_FLAGS, ...extraFlags, "--log-level=warning"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || `exit ${r.status}`).trim() };
  return { ok: true };
}
