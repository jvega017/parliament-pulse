# Parliament Pulse: app tracker
<!-- Updated by: manual or session review | Format: DATE | agent/manual -->
Last updated: 2026-09-29 | Updated by: FE-08 (routing and docs package), rewritten from the code

## Status
Free public web app, never charged for (owner decision, 21 July 2026, restated 29 September 2026).
Branch `upgrade/commercial-ready` carries the 29 September readiness packages FE-01 to FE-08
(frontend) and WK-01 to WK-03 (Worker). They reach the public site only when the owner deploys
`dist/` from this branch; nothing in this file claims they are live.

Review of record: `Claude-Workspace/08_Outputs/reviews/parliament-pulse-commercial-readiness-2026-09-29.md`.
Earlier status notes in this file (May to July 2026) claimed the build was clear of invented
content; those claims were not backed by a gate and have been removed. What is now checked, and
by which gate, is listed below.

## What ships
- Twelve desks in `NAV` (`shell.jsx`): Overview, Live parliament, Signal inbox, Activity by source,
  Committees, Bills intelligence, Daily program, Threads, Briefings, Watchlists, Sources, About the data.
- Not yet available, listed on About from `SITE_CONFIG.unavailable` (`data.jsx`) with the official
  APH page for each: Questions on notice, Hansard, Member profiles, Alert rules and email digests,
  Parliamentary lines.
- `SITE_CONFIG.showUnsourcedSurfaces` is false; no surface without a live source renders.
- Routes: `#/<deskId>`, `#/signal/<guid>`, `#/about/<legal|privacy|not-yet-available|licence>`,
  a Not found desk for anything else, and a one-time `?page=` migration (README "Routes").
- Data: Worker `/state`, `/bills` and `/rss?u=`; browser storage only for the keys About lists.

## Gates (what backs each claim)
| Claim | Gate |
|---|---|
| No known invented parliamentary content in the shipped bundle (22 banned patterns) | `tests/release-gate.mjs`, proven by `tests/fabrication-selftest.test.mjs` |
| Committed `.js` matches its `.jsx` | release gate sync check; CI `git diff --exit-code -- '*.js'` |
| No sample or illustrative surface renders; empty desks say why and link to APH | `tests/unsourced-surfaces.test.mjs` |
| Counts are single-source; no owner identity | `tests/honest-surfaces.test.mjs` |
| Poll freshness and dates are stated honestly | `tests/freshness.test.mjs` |
| Scores that separate nothing collapse to one line | `tests/analytics-honesty.test.mjs` |
| APH attribution on footer, CSV and briefs | `tests/attribution-check.mjs` |
| No horizontal scroll, Live player loads on request only | `tests/browser/layout.test.mjs` |
| Deep links, Back, Not found, per-desk title and focus | `tests/browser/routing.test.mjs` |
| Deployed files match `dist/build-info.json`; internal paths 404 | `tests/production-probe.mjs` (`npm run probe`) |

## Deploy facts (do not relose)
1. Deploy `dist/` only: `./build-dist.ps1`, then
   `npx wrangler@4 pages deploy dist --project-name=parliament-pulse --branch=main --commit-hash=<sha>`,
   then `node tests/production-probe.mjs`. Deploying the repo root published internal files.
2. The Pages production branch is `main`; any other branch lands on a preview alias.
3. Worker CORS is fail-closed: only the production origins and local dev origins are allowed, so
   preview hostnames get no live data.
4. The APH edge answers non-browser user agents with 403; the Worker sends a browser user agent
   (LEG-07 in the review questions this).

## Open items
- `SITE_CONFIG.contact` is `info@prometheuspolicylab.com` (Juan, 7 October 2026), linked from
  the About corrections paragraph, the accessibility statement and the footer.
- No custom domain yet (Juan, 7 October 2026: the app is still a beta). The site lives at
  parliament-pulse.pages.dev; `pulse.prometheuspolicylab.com` does not resolve.
- A real axe-core run is still owed (`tests/README.md`).
- Monitoring and D1 backups (review ARCH-06, ARCH-07, PR-10) need owner-approved accounts.

## Source
Handoff bundle: `C:\Users\jvega\civic-signal-design\parliament-pulse\`.
Historical plans and backlogs: `docs/internal/` (REMEDIATION-PLAN.md, REVIEW-BACKLOG-2026-05-31.md,
CODEX-TASKS.md, design-elevation-spec.json, legacy build.py).

## Update instructions
Rewrite from the code, not from commit messages. Name the gate behind any honesty claim.
