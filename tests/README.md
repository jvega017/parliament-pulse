# Parliament Pulse test suite

No `package.json` exists at the repo root (confirmed 2026-07-21: `npm ls` on
this directory returns an empty tree), so there are no `npm test` scripts to
run. Until one is added, run the four gates directly, in this order, from the
repo root. Rebuild first: every test after the first one reads the shipped
`.js` files, and a stale build produces stale (mis-)results, not just a
`release-gate.mjs` failure.

```sh
powershell -NoProfile -ExecutionPolicy Bypass -File ./build-jsx.ps1
node tests/release-gate.mjs
node tests/state-contract.test.mjs
node tests/beta-contract.test.mjs
node tests/asset-manifest.test.mjs
node tests/a11y.test.mjs
```

All six commands must exit 0 before a deploy ships. The single command below
runs the same six steps and stops at the first failure (POSIX shells / Git
Bash; `&&` short-circuits so a broken build never lets a later check paper
over it):

```sh
powershell -NoProfile -ExecutionPolicy Bypass -File ./build-jsx.ps1 \
  && node tests/release-gate.mjs \
  && node tests/state-contract.test.mjs \
  && node tests/beta-contract.test.mjs \
  && node tests/asset-manifest.test.mjs \
  && node tests/a11y.test.mjs
```

## What each gate checks

| File | Checks | Canary-proven |
|---|---|---|
| `release-gate.mjs` | Zero-fabrication scan of the shipped bundle (no invented parliamentary content), plus a jsx/js staleness check | Yes |
| `state-contract.test.mjs` | Worker `GET /state` payload shape; a degraded block never fabricates content | No (assertion-based, not canary-based) |
| `beta-contract.test.mjs` | No public-facing "demo" wording; beta-evidence UI elements are present | No (assertion-based, not canary-based) |
| `asset-manifest.test.mjs` | Every asset `index.html` references exists on disk; zero external-origin references in functional `src`/`href`/`content` attributes or `_headers` directive values; `assets/fonts/fonts.css` URLs resolve relative to their own directory; the og image stays under 300KB | Yes |
| `a11y.test.mjs` | **Static structural approximation only** (see the file's header comment for why: no `package.json`, no local `playwright`/`axe-core`). Skip link, `<main id="pp-content">` landmark, toast container ARIA roles, image alt text, icon-only-button aria-labels, form-control labels, no positive tabindex | Yes |

## Real axe-core run: still owed

`a11y.test.mjs` is a source-level approximation, not a rendered-DOM or
colour-contrast check. To get a real `axe-core` scan across the app's routes:

1. Add a `package.json` at the repo root.
2. `npm install -D playwright axe-core` and `npx playwright install chromium`.
3. Write a script that launches the built `index.html` (a local static server
   or `file://`), injects `axe-core`, calls `axe.run()` per route (`overview`,
   `signals`, `bills`, `committees`, `briefings`, `about`, …), and asserts zero
   `critical`/`serious` violations.

This was not done here because it is outside the tests/-only scope of this
change and because introducing a root `package.json` is a decision that
touches the whole project, not just the test suite.
