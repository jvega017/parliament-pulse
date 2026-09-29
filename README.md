# Parliament Pulse

A free, public parliamentary-intelligence web app for the Australian federal Parliament, by
Prometheus Policy Lab. It reads official Parliament of Australia (APH) feeds through a
Cloudflare Worker, groups and scores the items, and links every item back to aph.gov.au.
It is not affiliated with the Parliament of Australia.

- Public entry: https://parliament-pulse.pages.dev/ (the custom domain
  pulse.prometheuspolicylab.com does not resolve; DNS is an open owner decision).
- Worker: https://aph-proxy.jvega019.workers.dev, source in the separate monorepo
  `C:\Users\jvega\parliament-pulse\workers\aph-proxy`.

This file describes what the code does as at 29 September 2026 (FE-08). Where it states that a
surface is honest, it names the gate that checks it.

## Architecture

- Browser-only React app. `index.html` loads React and ReactDOM from `vendor/` (production
  builds) and seven precompiled scripts in order: `data.js`, `entities.js`, `icons.js`,
  `store.js`, `shell.js`, `pages.js`, `app.js`. There is no Babel in the browser.
- The `.jsx` files are the source. `npm run build` (or `build-jsx.ps1`) compiles each one with
  the pinned esbuild (`package.json`, no minification, so the shared top-level names survive).
  The committed `.js` must match a fresh build; the release gate and CI both check it.
- The CSP in `_headers` is `script-src 'self'`, with no `unsafe-eval` and no `unsafe-inline`.
  `connect-src` allows only the Worker and the local dev proxy on port 3001.
- Data comes from the Worker: `GET /state` (signals, connectors, threads and freshness,
  refreshed every five minutes while the tab is visible), `GET /bills` (Bills Digests),
  and `GET /rss?u=<feed>` for the Live page. On `localhost` the Live page uses the dev proxy
  instead (see "Run locally").
- Browser storage holds only the keys listed in `LOCAL_STORAGE_KEYS` (`pages.jsx`), which the
  About page prints; `tests/unsourced-surfaces.test.mjs` fails if the bundle uses a key that is
  not on that list.

## Routes

Every desk has an address (`store.jsx` `parseRoute`, `app.jsx` `App`):

| Address | Opens |
|---|---|
| `#/<deskId>` (empty hash = `#/overview`) | a desk from `NAV` in `shell.jsx` |
| `#/signal/<encodeURIComponent(guid)>` | the signal drawer over the Signal inbox; closing it leaves `#/signals` |
| `#/about/legal`, `#/about/privacy`, `#/about/not-yet-available`, `#/about/licence` | About the data, scrolled to that section |
| anything else under `#/` | a "Page not found" desk with links to Overview and About |
| `?page=<deskId>` (old form) | rewritten once to `#/<deskId>` |

Navigation writes the hash with `history.pushState` and a `hashchange` listener drives the page,
so Back, Forward and shared links work. On each route change the document title becomes
`<Desk label> · Parliament Pulse`, focus moves to the desk heading, and a polite live region
announces the desk. The footer on every desk links to the legal, privacy and licence sections.
`tests/browser/routing.test.mjs` checks all of this.

## Desks

The navigation (`NAV` in `shell.jsx`) holds twelve desks. Each renders live data or an honest
empty state that says why and links to the official APH page.

| Desk (id) | What it shows |
|---|---|
| Overview (`overview`) | Priority signals and counts from `/state` |
| Live parliament (`live`) | Recent APH RSS items; a branded card that loads the APH YouTube live stream only when the reader presses "Load YouTube player"; ParlView links per chamber |
| Signal inbox (`signals`) | Every live signal from `/state`, with triage, notes and archive held in browser storage |
| Activity by source (`radar`) | Live signals counted by source group and feed |
| Committees (`committees`) | Committee items from `/state` |
| Bills intelligence (`bills`) | Bills Digests from `/bills` (the Digest series only, stated on the page) |
| Daily program (`parliament`) | Chamber and division items derived from live signals |
| Threads (`patterns`) | Threads the Worker derives from signals |
| Briefings (`briefings`) | Briefs the reader generates from a signal, in the browser |
| Watchlists (`watchlists`) | Twelve topic lists matched against live signal titles and tags in the browser |
| Sources (`sources`) | One row per configured feed from `connectors.checks`, with poll health |
| About the data (`about`) | Coverage, scoring disclosure, what is not yet available, privacy, terms and licence |

Not yet available (`SITE_CONFIG.unavailable` in `data.jsx`, listed on About with a link to the
official page): Questions on notice, Hansard, Member profiles, Alert rules and email digests,
and Parliamentary lines.

`SITE_CONFIG.showUnsourcedSurfaces` is `false` in every public build. Surfaces with no live
source render only when it is true; `tests/unsourced-surfaces.test.mjs` fails the gate if one
renders while it is false.

## Run locally

```sh
npm ci                 # pinned esbuild and playwright
npm run build          # compile the .jsx
./build-dist.ps1       # PowerShell: build the deployable dist/
python -m http.server 8080 --directory dist    # or any static server on dist/
```

Serve over HTTP: under `file://` the app does not fetch live data. For live RSS on `localhost`,
also run the dev proxy: `node proxy-server.js` (a CORS proxy at
`http://localhost:3001/proxy?url=...`). On `localhost`, or with `?debug` in the address, the Live
page shows developer detail (proxy instructions, raw feed errors); elsewhere it shows a
reconnecting message.

## Tests and gates

- `npm run gate`: rebuild, then eleven local gates (fabrication-pattern self-test, release gate
  with jsx/js sync and attribution, asset manifest, static a11y, beta wording, watchlist matching,
  state contract, honest surfaces, unsourced surfaces, freshness, analytics honesty). Each
  canary-proven gate seeds the defect it claims to catch and aborts if it misses it.
- `npm run browser`: the Playwright layout test and the routing test, against a fresh `dist/`
  served with the production CSP and fixture Worker responses.
- `npm run probe`: the production probe (network): fabrication scan, deployed files against
  `dist/build-info.json`, and denylisted internal paths answering 404.

Details and each gate's canaries: `tests/README.md`. CI (`.github/workflows/ci.yml`) runs
`npm run gate`, the committed-js check and `npm run browser`.

## Deploy (owner step)

Deploy only `dist/`, never the repo root. From a committed tree, in PowerShell:

```powershell
./build-dist.ps1
npx wrangler@4 pages deploy dist --project-name=parliament-pulse --branch=main --commit-hash=<sha>
node tests/production-probe.mjs
```

`build-dist.ps1` recompiles the JSX, rebuilds `dist/` from an explicit allowlist, and adds
`404.html`, `robots.txt` and `build-info.json` (git SHA, build time, sha256 per file). `<sha>`
is the SHA it prints. The Pages production branch is `main`; any other branch lands on a
preview alias, and preview hostnames are not in the Worker's CORS allowlist. The probe must
exit 0 straight after the deploy.

The Worker deploys from its own folder with its own `wrangler.toml`; see that repo's README.

## Repository layout

- `index.html`, `_headers`, `manifest.webmanifest`, `favicon.ico`, `vendor/`, `assets/`: shipped.
- `*.jsx`: source; `*.js`: generated from it and committed.
- `scripts/`: build and gate runners. `tests/`: gates, fixtures and the browser harness.
- `docs/`: specifications (`state-contract.md`, `licence-architecture.md`, `live-wiring-spec.md`,
  `design-scale-uplift-spec.md`). `docs/internal/`: historical plans and backlogs, and the
  legacy Babel-era `build.py`, kept as a record and not used by any build.
- `proxy-server.js`: the local dev proxy. `archive/`: old single-file bundles; the production
  probe uses `archive/parliament-pulse-beta.html` as a canary specimen, so do not edit it.
- `build-dist.ps1`, `build-jsx.ps1`, `verify.ps1`, `cf-list.ps1`, `cf-worker-url.ps1`,
  `check2.ps1`, `check3.ps1`: local PowerShell helpers; none ships.

## Licence and attribution

Source material is from the Parliament of Australia website under CC BY-NC-ND 4.0. Titles are
reproduced unmodified with attribution and a link to the source; scores and summaries are
Parliament Pulse analysis. `tests/attribution-check.mjs` (run by the release gate) fails if the
attribution sentence leaves the footer, the CSV export or the brief templates. The display
contract is `docs/licence-architecture.md`.
