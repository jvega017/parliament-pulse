# Build the deployable dist/ folder from an explicit ALLOWLIST.
#
# Why this exists (FE-01, findings DATA-01 / ARCH-01 / SEC-04 / OPS-01):
# `wrangler pages deploy .` published the whole working folder, so internal
# notes (*.md), build scripts (*.ps1, build.py), JSX sources and stale
# single-file bundles were all publicly downloadable. .assetsignore did not
# stop it. dist/ is rebuilt from scratch on every run and receives ONLY the
# allowlisted files; anything not on the list cannot reach production.
#
# FE-11 (PR-16, SEC-13, ARCH-11): the assembly now lives in
# scripts/build-dist.mjs, so the tests can run the exact same pipeline on a
# scratch directory. That script holds the allowlist (DIST_FILES, DIST_DIRS,
# DIST_EXCLUDED) and, for dist/ only:
#   - minifies each app .js with the pinned esbuild (whitespace and syntax only,
#     no identifier renaming), renames it to <name>.<sha256-8>.js and rewrites
#     the script tags in dist/index.html; the committed .js stay unminified;
#   - gives each hashed .js a year-long immutable Cache-Control rule in
#     dist/_headers and strips the localhost dev proxy origins from connect-src;
#   - writes dist/build-info.json: the git SHA, the build time, a sha256 for
#     every file (build-info.json itself excepted, since a file cannot carry its
#     own hash), the hashed-name map and the brotli sizes before and after.
# tests/production-probe.mjs compares the deployed files against this manifest
# to detect deploy drift, and takes the hashed script names from it.
#
# Usage (repo root):  ./build-dist.ps1
# Then deploy (Juan's step):
#   npx wrangler@4 pages deploy dist --project-name=parliament-pulse --branch=main --commit-hash=<sha>
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Stale-build guard: always recompile the JSX first, so dist/ can never ship a
# .js that lags its .jsx (commit e616227 did exactly that to entities.js).
# Skip with -SkipCompile only when the .js files were just rebuilt.
if (-not ($args -contains "-SkipCompile")) {
  Push-Location $root
  try { & (Join-Path $root "build-jsx.ps1") } finally { Pop-Location }
}

Push-Location $root
try {
  & node (Join-Path $root "scripts/build-dist.mjs") (Join-Path $root "dist")
  if ($LASTEXITCODE -ne 0) { throw "scripts/build-dist.mjs failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
