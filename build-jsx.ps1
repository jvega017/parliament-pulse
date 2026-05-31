# Precompile JSX -> classic JS via esbuild (no in-browser Babel).
# Each file transforms JSX to React.createElement and keeps top-level
# declarations in the shared global lexical scope, exactly as the old
# type="text/babel" pipeline did. NO minify: minification would rename
# top-level globals and break cross-file references (SIGNALS, useStore, etc.).
$ErrorActionPreference = "Stop"
$files = @("data","entities","icons","store","shell","pages","app")
foreach ($f in $files) {
  Write-Host "compiling $f.jsx -> $f.js"
  npx --yes esbuild "$f.jsx" --outfile="$f.js" --target=es2018 --loader:.jsx=jsx
  if ($LASTEXITCODE -ne 0) { throw "esbuild failed on $f.jsx" }
}
Write-Host "JSX precompile complete: 7 files"
