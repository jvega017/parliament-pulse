# Build the deployable dist/ folder from an explicit ALLOWLIST.
#
# Why this exists (FE-01, findings DATA-01 / ARCH-01 / SEC-04 / OPS-01):
# `wrangler pages deploy .` published the whole working folder, so internal
# notes (*.md), build scripts (*.ps1, build.py), JSX sources and stale
# single-file bundles were all publicly downloadable. .assetsignore did not
# stop it. dist/ is rebuilt from scratch on every run and receives ONLY the
# files named below; anything not on the list cannot reach production.
#
# It also writes dist/build-info.json: the git SHA the build came from, the
# build time, and a sha256 for every file in dist/ (build-info.json itself
# excepted, since a file cannot carry its own hash). tests/production-probe.mjs
# compares the deployed files against this manifest to detect deploy drift.
#
# Usage (repo root):  ./build-dist.ps1
# Then deploy (Juan's step):
#   npx wrangler@4 pages deploy dist --project-name=parliament-pulse --branch=main --commit-hash=<sha>
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dist = Join-Path $root "dist"

# The allowlist. Add a file here deliberately, never by widening a wildcard.
$files = @(
  "index.html",
  "data.js", "entities.js", "icons.js", "store.js", "shell.js", "pages.js", "app.js",
  "_headers",
  "manifest.webmanifest",
  "favicon.ico"
)
$dirs = @("vendor", "assets")
# Files inside allowlisted directories that must still never ship.
$excluded = @("assets/asset-forge.html")

# Stale-build guard: always recompile the JSX first, so dist/ can never ship a
# .js that lags its .jsx (commit e616227 did exactly that to entities.js).
# Skip with -SkipCompile only when the .js files were just rebuilt.
if (-not ($args -contains "-SkipCompile")) {
  Push-Location $root
  try { & (Join-Path $root "build-jsx.ps1") } finally { Pop-Location }
}

if (Test-Path $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null

foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path -LiteralPath $src)) { throw "allowlisted file missing: $f" }
  Copy-Item -LiteralPath $src -Destination (Join-Path $dist $f)
}
foreach ($d in $dirs) {
  $srcDir = Join-Path $root $d
  if (-not (Test-Path -LiteralPath $srcDir)) { throw "allowlisted directory missing: $d" }
  Get-ChildItem -LiteralPath $srcDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace("\", "/")
    if ($excluded -contains $rel) { return }
    $dest = Join-Path $dist $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $_.FullName -Destination $dest
  }
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

# 404 page. Its presence also makes Pages answer unknown paths with a real
# HTTP 404 instead of falling back to index.html with a 200. No inline script
# (CSP script-src 'self'); inline style is permitted by style-src.
$notFound = @"
<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found - Parliament Pulse</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #07080e; color: #e8e9ee; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 32rem; padding: 2rem 1rem; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
  p { color: #a9acb8; line-height: 1.5; }
  a { color: #7fb2ff; }
  a:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <h1>Page not found</h1>
  <p>This address is not part of Parliament Pulse.</p>
  <p><a href="/">Return to Parliament Pulse</a></p>
</main>
</body>
</html>
"@
[System.IO.File]::WriteAllText((Join-Path $dist "404.html"), $notFound.Replace("`r`n", "`n"), $utf8)

$robots = "User-agent: *`nAllow: /`nDisallow: /build-info.json`n"
[System.IO.File]::WriteAllText((Join-Path $dist "robots.txt"), $robots, $utf8)

# Provenance manifest.
$sha = (& git -C $root rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or -not $sha) { throw "git rev-parse HEAD failed" }
$dirty = (& git -C $root status --porcelain --untracked-files=no)
$hashes = [ordered]@{}
Get-ChildItem -LiteralPath $dist -Recurse -File | Sort-Object FullName | ForEach-Object {
  $rel = $_.FullName.Substring($dist.Length + 1).Replace("\", "/")
  $hashes[$rel] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}
$info = [ordered]@{
  git_sha = $sha
  git_dirty = [bool]$dirty
  built_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
  files = $hashes
}
[System.IO.File]::WriteAllText((Join-Path $dist "build-info.json"), ($info | ConvertTo-Json -Depth 5), $utf8)

Write-Host "dist/ built from $sha$(if ($dirty) { ' (working tree has uncommitted changes)' }): $($hashes.Count) files plus build-info.json"
