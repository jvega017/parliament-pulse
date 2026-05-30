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

**Preferred: serve the multi-file source over HTTP.** This is the only build that Cloudflare Pages serves and the only one that should be distributed.
```
cd parliament-pulse
python -m http.server 8080
# then open http://localhost:8080/index.html
```
The multi-file version requires an HTTP origin because `<script type="text/babel" src="...">` is blocked under `file://`. The app also detects `file://` and shows guidance to serve over http.

**Live RSS locally.** The Live page needs a CORS proxy in front of the APH feeds. In a second terminal:
```
node proxy-server.js
# local CORS proxy at http://localhost:3001/proxy?url=...
```
In production the Live page calls the Cloudflare Worker instead (see "Production architecture" below). No local proxy is needed once deployed.

**Single-file artefacts are not served and should not be distributed.** `parliament-pulse-updated.html` and `parliament-pulse-beta.html` are gitignored stale bundles. Cloudflare Pages serves the multi-file source, not these files. They embed a localhost-only proxy path and an outdated build. If you ever need a single-file distribution, rebuild it with `python build.py` first, never hand it out as-is.

## Files

- `index.html` — multi-file entry, loads the `.jsx` modules (this is what Pages serves)
- `data.jsx` — fixture: feeds, signals, bills, divisions, watchlists, radar, QON pattern, briefing queue
- `entities.jsx` — committees, members, ministers, bills with full detail
- `icons.jsx` — inline SVG icon set
- `store.jsx` — React context store with localStorage persistence; detail modals
- `shell.jsx` — sidebar, topbar with working global search, signal card, evidence drawer
- `pages.jsx` — all page modules including the real RSS poller
- `app.jsx` — page router

## Known limits (honest)

1. **CORS.** APH feeds do not send `Access-Control-Allow-Origin`, so a proxy is mandatory. Locally the Live page uses `node proxy-server.js` at `localhost:3001`. In production it uses the Cloudflare Worker `aph-proxy` (see "Production architecture"). The third-party `r.jina.ai` dependency has been retired. If the proxy is offline or a feed fails, the Live panel surfaces the per-feed status and gives direct links to the raw feeds.

2. **YouTube live embed.** Uses `/embed/live_stream?channel=UCvO8Qfr3etT6khGA9Zln8WA` (@AUSParliamentLive). When no chamber is broadcasting, YouTube renders its own "offline" page inside the iframe which cannot be detected from outside. A manual "NO STREAM?" toggle in the top-right of the player exposes the fallback panel (ParlView archive, APH Watch/Read/Listen, Retry).

3. **Data is fixture-backed for most modules.** Only the Live page polls real RSS. Bills, committees, members, ministers, divisions, radar, briefings, watchlists are sample data. Every URL referenced is real — clicking through opens the correct APH page — but the items shown are seeded examples, not a live pull. The scoring, provenance, and update logs are representative of what a production pipeline would record.

4. **No backend.** No auth, no persistence beyond browser `localStorage` for analyst feedback, notes, owner assignments, and custom watchlists/feeds.

## Production architecture

The deployment mechanism is split:

- **Cloudflare Pages** serves the multi-file frontend. Project `parliament-pulse`, account `ccc93b2330067a401bf57fc9ac736e7a`. There is no `wrangler.toml` for the Pages side; configuration is the dashboard plus `_headers` (MIME types for `.jsx`/`.js`, and security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). Production origins are `https://parliament-pulse.pages.dev` and the custom domain `https://pulse.prometheuspolicylab.com`.
- **Cloudflare Worker** `aph-proxy` (separate folder `C:\Users\jvega\parliament-pulse\workers\aph-proxy`, its own `wrangler.toml`) is the production proxy. It allowlists the exact verified APH feed URLs, adds the CORS headers the feeds lack, caches each feed 5 to 10 minutes, and injects the TheyVoteForYou key server-side. Its CORS `ALLOWED_ORIGINS` list must contain every origin that calls it: the two production origins above, plus `localhost:8080`/`127.0.0.1:8080` and `localhost:5173`/`127.0.0.1:5173` for development.

The frontend calls the Worker at `https://aph-proxy.jvega019.workers.dev/rss?u=<feed-url>`. The `/rss?u=` path and parameter name are what the Worker serves; an earlier `/proxy?url=` mismatch was a deploy blocker and has been corrected in `pages.jsx`. [VERIFY] the `jvega019` workers.dev subdomain with `cf-worker-url.ps1` before relying on it.

### Deploy steps

Fix the two blockers before deploying or the Live page stays dark:
1. Frontend route in `pages.jsx` must be `/rss?u=` (matches the Worker), handled in the frontend package.
2. Worker `ALLOWED_ORIGINS` in `wrangler.toml` must include the production origins and `localhost:8080` (done).

Frontend (Cloudflare Pages, the multi-file source that actually serves):
```
cd C:\Users\jvega\Claude-Workspace\03_Projects\parliament-pulse
npx wrangler@4 pages deploy . --project-name=parliament-pulse
```

Worker (separate folder, its own wrangler.toml):
```
cd C:\Users\jvega\parliament-pulse\workers\aph-proxy
npx wrangler d1 migrations apply parliament-pulse-archive --remote   # first deploy only
npx wrangler secret put TVFY_KEY                                      # TheyVoteForYou key, server-side only
npx wrangler secret put RESEND_API_KEY                               # optional, email digest only
npx wrangler deploy
```

Optional single-file rebuild (only if distributing the gitignored `.html` artefacts, which Pages does not serve):
```
python build.py
```

### Production-launch hardening (document only, do before public launch)

These are not run by the deploy commands above. Acceptable to defer for a soft launch, mandatory for a public one:
1. Switch the CDN React and ReactDOM from `react.development.js` / `react-dom.development.js` to `react.production.min.js` / `react-dom.production.min.js`, and regenerate the SRI `integrity` hashes for the new files (the current ones in `index.html` are for the development builds).
2. Precompile JSX with Vite or esbuild so Babel standalone is no longer loaded in the browser. Once JSX is precompiled, tighten the `_headers` CSP `script-src` by dropping `'unsafe-eval'` and `'unsafe-inline'`.
3. Confirm the deployed Pages origin matches both the Worker `ALLOWED_ORIGINS` list and the non-localhost branch in `pages.jsx`.
4. Provision the TheyVoteForYou key as a Worker secret and confirm a real authenticated 200 before marking any TheyVoteForYou-backed module as live.

Remaining limitations (ETL pipeline for non-Live modules, auth for shared analyst feedback) are out of scope for a 90% deploy. Modules without a verified feed stay representative and carry a visible "Representative data" chip.

## Source

Handoff bundle: `C:\Users\jvega\civic-signal-design\parliament-pulse\`
Chat transcripts showing iteration: `chats/chat1.md`, `chats/chat2.md`
