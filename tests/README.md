# Parliament Pulse test suite

Since FE-02 (29 Sep 2026) the repo root has a `package.json` with esbuild
pinned to an exact version. One-time setup, then one command:

```sh
npm ci          # installs the pinned esbuild from package-lock.json
npm run gate    # rebuild every .jsx, then run every local gate below; stops at the first failure
npm run probe   # production probe against the deployed site (network; not part of the gate)
```

`npm run build` alone rebuilds the seven `.js` files (the cross-platform
equivalent of `build-jsx.ps1`, which now calls the same pinned binary).
`node tests/deploy-integrity.test.mjs` runs `build-dist.ps1` and inspects
`dist/`; it needs PowerShell, so it runs locally before a deploy and is not
in `npm run gate` or CI. CI (`.github/workflows/ci.yml`) runs `npm ci`,
`npm run gate`, then `git diff --exit-code -- '*.js'` on every push and PR.

## What each gate checks

| File | Checks | Canary-proven |
|---|---|---|
| `fabrication-selftest.test.mjs` | The scanner itself: every banned pattern trips its own canary, honest copy trips nothing, the archived pre-sweep bundle still trips at least 5 classes, and the removed sitting-date constructs are each caught | Yes (it is the canary) |
| `release-gate.mjs` | Zero-fabrication scan of the shipped bundle (no invented parliamentary content, including hardcoded sitting or return dates), plus a content-based jsx/js sync check: each `.jsx` is rebuilt with the pinned esbuild into a temp directory and byte-compared with the committed `.js`; and the LEG-03 licence attribution check (`attribution-check.mjs`): the CC BY-NC-ND 4.0 sentence must reach the site footer, the CSV builder and both brief templates, in `.jsx` and `.js` | Yes |
| `honest-surfaces.test.mjs` | Renders the built bundle against a fixture `/state` with a small React shim: nav badges come from `selectCounts()` (Committees 30, no badge on empty Threads or Daily program desks), the About ledger Signals count equals `signals.items.length`, the activation matrix shows Bills as Live, no owner identity or retired overclaim ships, and an exported CSV carries the attribution | Yes |
| `state-contract.test.mjs` | Worker `GET /state` payload shape; a degraded block never fabricates content | No (assertion-based, not canary-based) |
| `beta-contract.test.mjs` | No public-facing "demo" wording; beta-evidence UI elements are present | No (assertion-based, not canary-based) |
| `asset-manifest.test.mjs` | Every asset `index.html` references exists on disk; zero external-origin references in functional `src`/`href`/`content` attributes or `_headers` directive values; `assets/fonts/fonts.css` URLs resolve relative to their own directory; the og image stays under 300KB | Yes |
| `a11y.test.mjs` | **Static structural approximation only** (see the file's header comment; no local `playwright`/`axe-core` yet). Skip link, `<main id="pp-content">` landmark, toast container ARIA roles, image alt text, icon-only-button aria-labels, form-control labels, no positive tabindex | Yes |

## Real axe-core run: still owed

`a11y.test.mjs` is a source-level approximation, not a rendered-DOM or
colour-contrast check. To get a real `axe-core` scan across the app's routes:

1. `npm install -D playwright axe-core` and `npx playwright install chromium`.
2. Write a script that launches the built `index.html` (a local static server
   or `file://`), injects `axe-core`, calls `axe.run()` per route (`overview`,
   `signals`, `bills`, `committees`, `briefings`, `about`, …), and asserts zero
   `critical`/`serious` violations.

The root `package.json` now exists (FE-02), so this is unblocked; it remains
owed as a separate package.
