# Parliament Pulse test suite

Since FE-02 (29 Sep 2026) the repo root has a `package.json` with esbuild
pinned to an exact version. One-time setup, then one command:

```sh
npm ci          # installs the pinned esbuild from package-lock.json
npm run gate    # rebuild every .jsx, then run every local gate below; stops at the first failure
npm run probe   # production probe against the deployed site (network; not part of the gate)
```

`npm run build` alone rebuilds the eleven `.js` files listed in `JSX_FILES`
(`scripts/build-config.mjs`; the cross-platform equivalent of `build-jsx.ps1`,
which calls the same pinned binary). Tests that address source by concern read
the `store` and `pages` module groups through `readModule()` in the same file.
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
| `asset-manifest.test.mjs` | Every asset `index.html` references exists on disk; `index.html` loads the app scripts in exactly `JSX_FILES` order; zero external-origin references in functional `src`/`href`/`content` attributes or `_headers` directive values; `assets/fonts/fonts.css` URLs resolve relative to their own directory; the og image stays under 300KB | Yes |
| `global-scope.test.mjs` | FE-11. Parses the unminified built .js for top-level function, const, let and class names another file references (82 of 193 today), builds a scratch dist with `scripts/build-dist.mjs`, loads its minified, hash-named scripts in `index.html` order into one `node:vm` context, and asserts every one of those names resolves; then runs the honest-surfaces render (`honest-surfaces-lib.mjs`) against the minified bundle. Parser self-checks: every reported name resolves unminified, and no global function declaration is missed | Yes (scope-breaking builds `--format=iife`, `--bundle --minify-identifiers` and `--minify-identifiers --format=iife` must fail. Measured: `--minify-identifiers` alone keeps top-level names of a classic script in esbuild 0.28.2, so that build is run and reported, not required to fail) |
| `dist-output.test.mjs` | FE-11. On a scratch dist (and on `dist/` when built): no localhost or 127.0.0.1 origin in `dist/_headers` while the repo copy keeps them; every served path matches at most one Cache-Control rule (Pages concatenates matching rules); hashed scripts get `public, max-age=31536000, immutable`, `/` and `/index.html` get `public, max-age=0, must-revalidate`; `index.html` loads only hashed scripts that exist and carry their own content hash; no plain-named app .js or any .jsx ships; brotli JS after is smaller than before and than the pre-FE-11 baseline; every woff2 is referenced by fonts.css, keeps `font-display: swap`, and none is a byte-identical copy; every image dist ships is referenced by `index.html` or `manifest.webmanifest` (an unreferenced screenshot showing retired content once shipped); `.gitattributes` gives `_headers`, every `.html`, the manifest and `fonts.css` `eol=lf`, so a fresh Windows clone (core.autocrlf=true) cannot turn the planted-defect checks' exact LF strings into misses | Yes (11 planted defects, including the old `/assets/fonts/*` overlap, a duplicated font file and an unreferenced screenshot; the line-ending check must read an unruled path as not lf) |
| `finalise.test.mjs` | FE final. Renders the built .js against the current and the older Worker shape: a timed card published today reads its Brisbane clock and one from an earlier day reads "28 Sep"; the Overview "more signals" line counts only timed items in any "last 24 hours" figure; no empty state says "records are available in this app" and Today's hearings names its window ("dated today"); no surface or shipped string claims a fixed 30-minute check or a false-positive measurement; About drops the Official feeds cell when no feed count is reported, and the privacy "Last updated" date and a hash of the privacy text move together; no shipped code formats a month outside the shared formatter and nothing prints "Sept"; the Add feed inputs start empty with placeholders; no copy claims ParlInfo "refuses automated access" | Yes (11 scratch-copy canaries, each required to fail for its own reason) |
| `a11y.test.mjs` | Static structural approximation (the rendered-DOM scan is `npm run a11y`, below). Skip link, `<main id="pp-content">` landmark, toast container ARIA roles, image alt text, icon-only-button aria-labels, form-control labels, no positive tabindex | Yes |
| `keyboard-static.test.mjs` | FE-10 (A11Y-01, WCAG 2.1.1). No `onClick` or `onMouseDown` on a non-interactive element (div, span, tr, td, li and the rest) unless it also has `role`, `tabIndex={0}` and `onKeyDown`. Two marked exemptions, each verified: `a11y-exempt: backdrop` (the scrim must be `aria-hidden`) and `a11y-exempt: stop` (the handler may only stop propagation). `SCAN_ROOT=<dir>` points it at a scratch copy | Yes (9 seeded mouse-only specimens caught, 6 compliant specimens left alone) |

## Browser harness, layout test (FE-07) and routing test (FE-08)

```sh
npx playwright install chromium   # once; playwright itself is pinned in package.json
npm run browser                   # layout, routing, design, then keyboard.test.mjs
npm run a11y                      # axe.test.mjs: the real axe-core scan (FE-10)
```

`tests/browser/harness.mjs` is the shared harness (FE-09 and FE-10 reuse it). It
runs `build-dist.ps1`, serves `dist/` on 127.0.0.1:8080 through `node:http` with
the production CSP from `dist/_headers`, and loads pages from
`http://pulse.localhost:8080/` (Chromium resolves `*.localhost` to loopback), so
the app takes its production path under the production CSP, which since FE-11 no
longer allows the local dev proxy. It answers the Worker's `/state`, `/bills`,
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

`design.test.mjs` (FE-09) also carries the FE-11 fonts check: on the Overview at
1280 x 800 and 390 x 844, first visit and returning, every font file that renders
text inside the first viewport (mapped from the computed family and weight through
fonts.css with the CSS weight-matching rules) is preloaded, every preload renders
text there, and no font file is fetched under two URLs. Canaries: the Serif 600
preload removed, an unused Serif 700 preload added, the Sans preload under a
second URL.
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

## Real axe-core scan and keyboard test (FE-10)

`npm run a11y` runs `tests/browser/axe.test.mjs`: `@axe-core/playwright` (pinned
exact) on the harness, tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa, over
64 states: every NAV desk, the open signal drawer, the Sources feed modal and the
search results in both themes at 1280 and 390 px, plus the phone navigation open
and closed at 390 px. Off-screen `.signal` cards are painted for the scan
(`content-visibility: visible`), so their contrast is measured. It fails on any
serious or critical violation and writes the full result, including axe's
"needs review" nodes, to `tests/browser/out/axe.json` (gitignored). Canary: a
scratch copy of dist/ with a nameless button and an image without alt injected
must fail on button-name and image-alt before the clean build is trusted. It also
checks the About accessibility section (`#/about/accessibility`) against the run:
state count, axe-core version and tags must match, and the stated scan date must
not be later than the run (it prints a note when they differ, so re-issue
`A11Y_SCAN` in pages-reference.jsx after a clean run on a changed UI).

Canary edits on a scratch dist go through `editableDistFile(dir, "shell.js")`:
it resolves the plain name through the scratch copy's `build-info.json`
`js_map` and swaps the minified file for the committed unminified source on the
first edit, so canary snippets keep matching the readable code.

`tests/browser/keyboard.test.mjs` (in `npm run browser`) checks: Tab from the top
of the Signal inbox reaches every card's Open button (distinct "Open <title>"
names), Enter opens the drawer on it, Esc closes it and returns focus; every card
is an `<article>` named by its title with no link inside a button; the closed
phone navigation has 0 focusable descendants and 0 Tab stops, Esc closes the open
one to its toggle; the closed drawer is out of the accessibility tree; j works,
is typed in a field, Ctrl+A does not archive, a archives with Undo, and turning
the single-key shortcuts off stops j and survives a reload; every visible control
on every desk, the drawer and the modal is at least 24 x 24 CSS px; no visible
text is under 12 px. Seven scratch-copy canaries each remove one control and must
fail their check. `KBD_ONLY=targets,text` runs a subset (printed SKIP for the
rest) without the canaries.
