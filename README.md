# Parliament Pulse — Prometheus Policy Lab

High-fidelity interactive prototype built from the Claude Design handoff bundle (`parliament-pulse.tar.gz`, file `Civic Signal.html`). Rebranded to **Parliament Pulse** during design iteration.

## What it is

A browser-only policy-intelligence dashboard for Australian Parliament. Single-page React app (loaded via CDN Babel). No backend.

Modules:
- Overview (today's signal, priority cards, change-log, briefing queue, source health, live strip)
- Live parliament (real AUSParliamentLive YouTube embed, APH connectors panel, live RSS poller)
- Attention radar, Committees, Bills intelligence, Parliament program, QON patterns
- Briefings, Watchlists, Sources

Interactive: global search (Ctrl+K), click-through detail modals for bills, committees, members, ministers, divisions, feeds, watchlists, radar issues, inquiries, hearings. Analyst feedback and notes persist via `localStorage`.

## How to run

**Option 1: just open the single file.** Double-click `parliament-pulse.html`. Runs from the filesystem. Requires internet (CDN fonts, React, Babel; YouTube embed; APH feeds via `r.jina.ai` CORS proxy).

**Option 2: serve the multi-file source** (preferred for editing):
```
cd parliament-pulse
python -m http.server 8080
# then open http://localhost:8080/index.html
```
The multi-file version requires an HTTP origin because `<script type="text/babel" src="...">` is blocked under `file://`.

## Files

- `parliament-pulse.html` — consolidated single file, runs anywhere
- `index.html` — multi-file entry, loads the `.jsx` modules
- `data.jsx` — fixture: feeds, signals, bills, divisions, watchlists, radar, QON pattern, briefing queue
- `entities.jsx` — committees, members, ministers, bills with full detail
- `icons.jsx` — inline SVG icon set
- `store.jsx` — React context store with localStorage persistence; detail modals
- `shell.jsx` — sidebar, topbar with working global search, signal card, evidence drawer
- `pages.jsx` — all page modules including the real RSS poller
- `app.jsx` — page router

## Known limits (honest)

1. **CORS.** APH feeds do not send `Access-Control-Allow-Origin`. The Live page polls via `https://r.jina.ai/` which re-serves the payload with CORS enabled. If jina is rate-limited or offline, the live panel shows "No items returned" with direct links to the raw feeds. For production, replace with a Cloudflare Worker or Node proxy that you control.

2. **YouTube live embed.** Uses `/embed/live_stream?channel=UCvO8Qfr3etT6khGA9Zln8WA` (@AUSParliamentLive). When no chamber is broadcasting, YouTube renders its own "offline" page inside the iframe which cannot be detected from outside. A manual "NO STREAM?" toggle in the top-right of the player exposes the fallback panel (ParlView archive, APH Watch/Read/Listen, Retry).

3. **Data is fixture-backed for most modules.** Only the Live page polls real RSS. Bills, committees, members, ministers, divisions, radar, briefings, watchlists are sample data. Every URL referenced is real — clicking through opens the correct APH page — but the items shown are seeded examples, not a live pull. The scoring, provenance, and update logs are representative of what a production pipeline would record.

4. **No backend.** No auth, no persistence beyond browser `localStorage` for analyst feedback, notes, owner assignments, and custom watchlists/feeds.

## To take this to production

Smallest path to a real live version:
1. Stand up a Cloudflare Worker or equivalent proxy in front of the APH feeds (removes the jina dependency).
2. Add a server-side daily ETL that writes parsed feed items into SQLite (the scoring/provenance shape is already defined in `data.jsx`).
3. Replace the React/Babel CDN setup with a Vite or Next.js build so the JSX compiles at build time rather than in-browser.
4. Add auth (APH, whole-of-government SSO, or Auth0) before exposing analyst feedback to a shared workspace.

None of those are required to use the current prototype as a demo.

## Source

Handoff bundle: `C:\Users\jvega\civic-signal-design\parliament-pulse\`
Chat transcripts showing iteration: `chats/chat1.md`, `chats/chat2.md`
