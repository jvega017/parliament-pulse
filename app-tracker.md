# Parliament Pulse — app tracker
<!-- Updated by: manual or session review | Format: DATE | agent/manual -->
Last updated: 2026-05-31 | Updated by: deploy session (Sprint 7)

## Status
GREEN — DEPLOYED LIVE 2026-05-31 (Sprint 7). Production-readiness pass driven by an 8-dimension
multi-agent review (87 findings: 18 P1, all fixed). ALL P1s done + most P2/P3. Reviewed/built with
Codex (Worker security + 2 frontend passes) and Claude (design, mobile, PERF-1, deploy). Verified
live on production apex: production React, Sources=6 (no fabrication), real APH data 22 items / 5-of-6
feeds. Frontend commit 3eba693+, Worker version 4678538d.
Shipped this sprint: data-honesty (killed all 13/15 fabrications, derive counts from the 6-feed
registry, Representative chips in modals/provenance, relabel fake "connectors" to source links);
modal a11y parity (focus trap + accessible name) + contrast/forms/headings; RSS link scheme guard +
fail-closed CORS + HSTS + manual-redirect revalidation + digest href escaping; error boundary +
watchlist crash guard; React production.min + regenerated SRI; bounded-concurrency poller
(mapPool 3 + abort + inFlight); interaction (Track/Watch persist, search reach, filter-aware drawer,
stable keys); mobile (grids collapse, horizontal nav strip, full-width overlays); ember restraint +
neutral fixture chips + opacity-only animations.
REMAINING POLISH (queued for Codex on reset, non-user-blocking): polished mobile hamburger,
render-memoisation (PERF-4/5), nav refactor off window.__ (MAINT-2), CSV/brief dedup (MAINT-3),
font-CLS preload (PERF-6), iframe debounce (PERF-9), and the L-effort design-system refactors
(type-scale + spacing utilities DESIGN-3/4, light-theme tokenisation DESIGN-7), EmptyState (DESIGN-5),
glyph-to-SVG (DESIGN-10). Plus a cross-family (Codex/Gemini) final review. Full backlog:
REVIEW-BACKLOG-2026-05-31.md.

Live URLs:
- Frontend (Cloudflare Pages): https://parliament-pulse.pages.dev
- Proxy Worker: https://aph-proxy.jvega019.workers.dev (route /rss?u=<encoded feed>)

Two deployment facts learned this session (do not relose):
1. Pages PRODUCTION branch is `main`, not `master`. The local git branch is `master`, so a plain `wrangler pages deploy` lands on a PREVIEW alias and does NOT update the public apex. Always deploy with `--branch=main` to hit production.
2. APH's edge WAF returns 403 to non-browser user-agents. The Worker MUST send a real browser UA (now set in workers/aph-proxy src/index.ts, committed 0ae4a2f) or every upstream feed 502s. Do not revert it to the bot UA.

Known minor follow-ups (non-blocking):
- The Live page fires all feed fetches concurrently; under heavy concurrent load a couple can hit browser ERR_INSUFFICIENT_RESOURCES. Add a small fetch concurrency cap (e.g. 3) if it recurs.
- YouTube live channel id is [VERIFY]-flagged; embed shows the honest offline fallback until confirmed.
- TheyVoteForYou key (TVFY_KEY) and D1 migrations still needed before per-member-vote / archive features go live.

## What it is
Browser-only policy-intelligence dashboard for Australian Parliament.
Multi-file React-over-Babel app (CDN React, ReactDOM, Babel standalone). No build step at runtime.
Affiliation: Prometheus Policy Lab — not QPS.

## Production architecture
Deployment is split across two Cloudflare products:
- Cloudflare Pages serves the multi-file frontend (project `parliament-pulse`, account `ccc93b2330067a401bf57fc9ac736e7a`). No Pages-side wrangler.toml; config is the dashboard plus `_headers` (MIME for .jsx/.js, plus CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). Origins: parliament-pulse.pages.dev and pulse.prometheuspolicylab.com.
- Cloudflare Worker `aph-proxy` (folder `C:\Users\jvega\parliament-pulse\workers\aph-proxy`) is the production proxy: allowlisted APH feed URLs, adds CORS, caches 5-10 min, injects TheyVoteForYou key server-side. ALLOWED_ORIGINS now includes localhost:8080 / 127.0.0.1:8080 alongside the 5173 dev origins and the two production origins.
- Frontend calls the Worker at `https://aph-proxy.jvega019.workers.dev/rss?u=<feed>`. The old `/proxy?url=` path was a deploy blocker, corrected in pages.jsx (WP-C). [VERIFY] the jvega019 workers.dev subdomain.

## Current capability
- Multi-file source (`index.html` + .jsx modules) is the served and distributable build
- Live page polls real APH RSS via the local Node proxy (dev) or the aph-proxy Worker (production)
- Other modules use representative (fixture) data and carry a "Representative data" chip
- Global search (Ctrl+K), click-through detail modals, localStorage persistence for analyst notes
- Real YouTube live embed (@AUSParliamentLive) with offline fallback panel

## Single-file artefacts (NOT served)
`parliament-pulse-updated.html` and `parliament-pulse-beta.html` are gitignored stale bundles. Cloudflare Pages does not serve them. They embed a localhost-only proxy path and an outdated build. Do not distribute as-is. If a single-file copy is ever needed, rebuild with `python build.py` first.

## Next milestone
Production-launch hardening (document only at this stage; defer for soft launch, mandatory for public):
1. Switch CDN React/ReactDOM to .production.min.js with regenerated SRI hashes
2. Precompile JSX (Vite/esbuild) to drop Babel-in-browser; then tighten CSP script-src
3. Provision TheyVoteForYou key as a Worker secret; confirm a real 200 before marking any TVFY-backed module live
4. Apply D1 migrations on first Worker deploy

## Key metrics
| Metric | Value | As of |
|---|---|---|
| Build grade (pre-remediation) | 72/100 | 2026-05-30 |
| Live data modules (target) | 4+ of 14 via Worker proxy | 2026-05-30 |
| Backend | Cloudflare Worker (proxy + KV cache + D1 archive) | 2026-05-30 |
| Demo available | Yes — serve index.html over http | 2026-05-30 |

## Active blockers
- Route mismatch (/proxy vs /rss): corrected in pages.jsx (WP-C)
- CORS allowlist gap: localhost:8080 added to Worker ALLOWED_ORIGINS (WP-F, done)
- Non-Live data fixture-backed: representative modules flagged honestly; ETL out of scope for 90%
- TheyVoteForYou key not provisioned: no authenticated 200 exercised yet

## How to run (quick reference)
Option 1 (preferred): `python -m http.server 8080` in this folder, then open `http://localhost:8080/index.html`
Option 2 (Live RSS locally): also run `node proxy-server.js` — local CORS proxy at localhost:3001
Note: do not open the single-file .html artefacts; they are stale and localhost-only.

## Deploy commands (do not run blind; verify origins first)
Pages: `npx wrangler@4 pages deploy . --project-name=parliament-pulse`
Worker: `cd workers\aph-proxy` then `npx wrangler deploy` (first deploy also: d1 migrations apply, secret put TVFY_KEY)

## Source
Handoff bundle: `C:\Users\jvega\civic-signal-design\parliament-pulse\`
Remediation plan: `REMEDIATION-PLAN.md` (this folder)

## Update instructions
Update this file after any significant code change or production milestone. Keep under 70 lines.
