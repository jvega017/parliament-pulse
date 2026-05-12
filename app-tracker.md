# Parliament Pulse — app tracker
<!-- Updated by: manual or session review | Format: DATE | agent/manual -->
Last updated: 2026-05-08 | Updated by: manual (session init)

## Status
AMBER — prototype enhanced (2026-05-10); local CORS proxy, keyboard nav, brief gen, CSV export, theme toggle all implemented

## What it is
Browser-only policy-intelligence dashboard for Australian Parliament.
Single-page React app (CDN Babel). No build step required.
Affiliation: Prometheus Policy Lab — not QPS.

## Current capability
- Single file `parliament-pulse.html` — opens in browser, runs from filesystem
- Live page polls real APH RSS (via r.jina.ai CORS proxy)
- All other modules (Bills, Committees, Members, Radar, Briefings, Watchlists) use fixture data
- Global search (Ctrl+K), click-through detail modals, localStorage persistence for analyst notes
- Real YouTube live embed (@AUSParliamentLive) with offline fallback panel

## Last milestone completed
High-fidelity prototype built from Claude Design handoff bundle (Civic Signal.html → Parliament Pulse).
All 8 modules interactive. Full README written. Date: prior to 2026-05-08.

## Next milestone
Production path (smallest viable):
1. Cloudflare Worker proxy for APH feeds (removes jina.ai dependency)
2. Server-side daily ETL writing feed items to SQLite (schema already in data.jsx)
3. Vite/Next.js build replacing CDN Babel (JSX compiles at build time)
4. Auth layer (APH SSO or Auth0) for analyst feedback persistence

Target: no firm date set — production path on hold pending EmberCore concept validation.

## Key metrics
| Metric | Value | As of |
|---|---|---|
| Prototype completeness | ~90% (fixture data) | 2026-05-08 |
| Live data modules | 1 of 8 (Live RSS) | 2026-05-08 |
| Backend | None | — |
| Demo available | Yes — open parliament-pulse.html | 2026-05-08 |
| Citable as a product | Yes — demo-ready | 2026-05-08 |

## Active blockers
- CORS: jina.ai proxy is a third-party dependency — replace with own Cloudflare Worker for production
- No auth layer — limits sharing to trusted individuals only
- All non-Live data is fixture-backed — production requires ETL pipeline

## How to run (quick reference)
Option 1: Open `parliament-pulse-updated.html` in browser (single file, no server needed; Live page needs proxy)
Option 2: `python -m http.server 8080` in this folder, then open `http://localhost:8080/index.html`
Option 3 (Live RSS): also run `node proxy-server.js` — serves local CORS proxy at localhost:3001

## Recent improvements (2026-05-10)
- TASK 1: proxy-server.js — local Node.js CORS proxy replacing jina.ai dependency
- TASK 2: Keyboard nav in drawer — j/k navigate signals, b brief, w watchlist
- TASK 3: Generate brief button — copies markdown brief to clipboard
- TASK 4: Export CSV button in Overview header — downloads signal data
- TASK 5: Dark/light theme toggle — sun/moon button in topbar, persists to localStorage
- TASK 6: parliament-pulse-updated.html — consolidated single-file distribution (183 KB)

## Source
Handoff bundle: `C:\Users\jvega\civic-signal-design\parliament-pulse\`
Inbox zip: `C:\Users\jvega\Claude-Workspace\09_Inbox\parliament-pulse-main.zip`

## Update instructions
Update this file after any significant code change or production milestone.
Keep under 60 lines.
