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

export const JSX_FILES = ["data", "entities", "icons", "store", "shell", "pages", "app"];

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
