# Precompile JSX -> classic JS via esbuild (no in-browser Babel).
# Each file transforms JSX to React.createElement and keeps top-level
# declarations in the shared global lexical scope, exactly as the old
# type="text/babel" pipeline did. NO minify: minification would rename
# top-level globals and break cross-file references (SIGNALS, useStore, etc.).
#
# Uses the esbuild version pinned in package.json (run `npm ci` once), never
# `npx --yes esbuild`, which fetched whatever version was latest that day.
# Flags must match scripts/build-config.mjs: tests/release-gate.mjs rebuilds
# with those flags and byte-compares, so any drift fails the gate.
# `npm run build` is the cross-platform equivalent of this script.
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$esbuild = Join-Path $PSScriptRoot "node_modules\esbuild\bin\esbuild"
if (-not (Test-Path -LiteralPath $esbuild)) { throw "Pinned esbuild not found at $esbuild. Run: npm ci" }
$files = @("data","entities","icons","store","shell","pages","app")
foreach ($f in $files) {
  Write-Host "compiling $f.jsx -> $f.js"
  & node $esbuild "$f.jsx" "--outfile=$f.js" --target=es2018 --loader:.jsx=jsx --log-level=warning
  if ($LASTEXITCODE -ne 0) { throw "esbuild failed on $f.jsx" }
}
Write-Host "JSX precompile complete: 7 files"
