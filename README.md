# Parliament Pulse

Policy intelligence dashboard for the Australian Parliament. Built by Prometheus Policy Lab.

## What it does

- Polls twelve official APH RSS feeds every two minutes via a Cloudflare Worker proxy
- Embeds the live AUSParliamentLive YouTube broadcast with a proper offline fallback
- Tracks bills, committees, members, ministers, divisions, watchlists, and QON patterns
- Produces structured analyst briefings with explicit provenance and human-review gates
- Persists analyst feedback, notes, and ownership assignments per-signal

## Repo layout

```
apps/web/             Vite 6 + React 18 + TypeScript SPA
workers/aph-proxy/    Cloudflare Worker: APH RSS proxy with KV cache
infra/                Cloudflare Pages config and provisioning notes
docs/                 Architecture docs and ADRs
.github/workflows/    CI and deploy pipelines
```

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Terminal 1
pnpm dev:worker
# Terminal 2
pnpm dev:web
```

Open `http://localhost:5173`.

## Deployment

- **Frontend**: Cloudflare Pages, auto-deployed from `main` via GitHub Actions
- **Backend**: Cloudflare Worker `aph-proxy`, auto-deployed via `wrangler-action`
- **Cache**: Cloudflare KV, 5-minute TTL on RSS responses
- **Region**: Cloudflare edge (Sydney POP for Australian latency)

## Status

Migration in progress from the original JSX-in-browser prototype at `Claude-Workspace/08_Outputs/parliament-pulse/`.

## Licence

MIT. See `LICENSE`.
