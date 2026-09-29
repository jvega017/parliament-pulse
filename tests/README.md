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
| `unsourced-surfaces.test.mjs` | FE-04. Renders every NAV desk, About, the signal drawer and the member and committee modals, with live rows and with no live data. With `SITE_CONFIG.showUnsourcedSurfaces` false: no "Representative data", "Sample data", "Illustrative", "Fixture" or "(representative)" text and no gated surface (Parliamentary lines, processing log, score breakdown, alert rules, Estimates note); no `[CONFIRM]` in any built .js; About lists every `SITE_CONFIG.unavailable` entry with its APH link; the contact line is the interim sentence while unset and a link once set; the privacy text names every localStorage key the bundle uses; members are empty; every desk with no data states why and links to aph.gov.au | Yes (7 scratch-copy canaries, including the flag flipped to true, each caught for its own reason; restraint on the honest build) |
| `freshness.test.mjs` | FE-05. Renders the topbar, Overview, Sources, a signal card, the footer and About against four `/state` variants: `meta.stale` true (topbar never shows the Live chip, shows Stale and the ribbon "APH polling appears stalled; last successful poll <time>"), a 3-hour-old poll with `stale` false (still stale), a fresh poll ("Last APH poll 5 min ago", the Worker's feed count), and the older Worker shape with no freshness fields (renders unchanged). An undated item reads "Date not supplied, first seen D Mon YYYY"; a date-only `pub_date` prints no clock time; Sources has one row per `connectors.checks` entry, "Not yet polled" uncoloured, and `reference_links` in a separate uncoloured list; the licence version in docs/licence-architecture.md, `APH_LICENCE_NAME`, `APH_ATTRIBUTION`, the footer and About is identical | Yes (8 scratch-copy canaries: meta.stale ignored, age fallback removed, invented date-only clock, undated dash, feed table disabled, never-polled coloured failed, reference list removed, licence drift) |
| `analytics-honesty.test.mjs` | FE-06. Renders Bills, the Signal inbox, Activity by source (the old radar), About and the search palette against an all-MEDIUM fixture and a mixed fixture: with one shared value the Attention and Confidence columns disappear and "All N items currently score Medium attention; the score does not yet separate them." renders; with mixed values the columns render; confidence reads "Confidence n of 5", never n/5 or a bar; Activity by source has Source group, Items and Feeds and none of "momentum", "issue" or "suggested action"; every attention badge carries the heuristic disclosure tooltip and About has the paragraph; the Bills page-sub names the Bills Digest scope and links to the APH bills search; a live signal's brief has no empty "Recommended action"; a search for a fixture bill title returns a Bills group from the live /bills cache, every group label states its real scope, and no Members group renders | Yes (10 scratch-copy canaries: uniform detection removed, uniform detection forced, confidence n/5, momentum column, issue wording, tooltip removed, scope sentence removed, empty action restored, search bills source removed, scope label removed) |
| `state-contract.test.mjs` | Worker `GET /state` payload shape; a degraded block never fabricates content | No (assertion-based, not canary-based) |
| `beta-contract.test.mjs` | No public-facing "demo" wording; beta-evidence UI elements are present | No (assertion-based, not canary-based) |
| `asset-manifest.test.mjs` | Every asset `index.html` references exists on disk; zero external-origin references in functional `src`/`href`/`content` attributes or `_headers` directive values; `assets/fonts/fonts.css` URLs resolve relative to their own directory; the og image stays under 300KB | Yes |
| `a11y.test.mjs` | **Static structural approximation only** (see the file's header comment; `playwright` is now pinned for the browser tests, `axe-core` is not installed). Skip link, `<main id="pp-content">` landmark, toast container ARIA roles, image alt text, icon-only-button aria-labels, form-control labels, no positive tabindex | Yes |

## Browser harness, layout test (FE-07) and routing test (FE-08)

```sh
npx playwright install chromium   # once; playwright itself is pinned in package.json
npm run browser                   # layout.test.mjs, then routing.test.mjs
```

`tests/browser/harness.mjs` is the shared harness (FE-09 and FE-10 reuse it). It
runs `build-dist.ps1`, serves `dist/` on 127.0.0.1:8080 through `node:http` with
the production CSP from `dist/_headers`, answers the Worker's `/state`, `/bills`,
`/rss` (and the local dev proxy) and `/alerts` from `tests/fixtures/`, refuses
every other external request, and pins the browser clock to the fixture time,
so runs are deterministic and offline. `openDesk(page, id, { theme, width, firstVisit })`
opens any NAV desk. `h.newPage({ stateFile: "state-legacy.json" })` serves the
older Worker shape the deployed Worker still returns. Fixtures are synthetic
("Fixture ..." titles) and regenerate with `node tests/fixtures/make-fixtures.mjs`;
none ships (dist/ is an allowlist).

`layout.test.mjs` checks: no horizontal scroll on every NAV desk at 320, 390,
820, 1024 and 1280 px in both themes; the Live heading, chamber links, player
heading and buttons unclipped at 390 and 320 px; the first Overview signal above
700 px at 390 px (returning and first visit); Bills and Sources stack with
`data-label` at 390 px and stay tables at 1280 px; Sources fits its panel with
both Worker shapes; Live has no iframe and makes no YouTube request until
"Load YouTube player", then embeds the verified channel with no `autoplay=1`.
Nine scratch-copy canaries (served on 8081) each remove one control and must be
caught.

`routing.test.mjs` (FE-08: UX-06, A11Y-04, ARCH-14, LEG-13) checks: a fresh
load of `#/bills` renders Bills intelligence with its nav item current and its
title; Overview, Bills, Sources by the nav, then Back to Bills and Overview and
Forward to Bills, and a typed hash drives the desk; `#/signal/<encodeURIComponent(guid)>`
for the first fixture signal opens its drawer over the Signal inbox, and closing
it leaves `#/signals`; `#/no-such-desk` and `#/about/no-such-section` render
"Page not found" with Overview and About links and the Not found title, and the
skip link does not route; on every NAV desk the title is
"<label> · Parliament Pulse" (no em or en dash, all distinct), focus is on the
desk h1 and the live region names the desk; `?page=bills` becomes `#/bills`;
the footer links to `#/about/legal`, `#/about/privacy` and `#/about/licence`,
and the privacy link focuses its section. Six canaries: the `hashchange`
listener removed (Back fails), the title write removed, the h1 focus removed,
Not found replaced by Overview, the `?page=` migration removed, and a footer
link removed. CI runs both files as the `browser` job.

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
