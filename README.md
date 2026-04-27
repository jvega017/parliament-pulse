# Parliament Pulse

Policy intelligence dashboard for the Australian Parliament. Built by Prometheus Policy Lab.

## What it does

Polls eight official APH RSS feeds every 30 minutes via a Cloudflare Worker, scores
each item against configurable watchlists, and surfaces the result as a ranked
attention signal for policy analysts.

### Live (real data flowing)

| Surface | Source |
|---|---|
| Overview — attention-ranked signals | 8 APH RSS feeds, polled every 30 min |
| Live parliament — today's chamber items | Senate upcoming hearings RSS |
| Attention radar | Live signal scoring (7-dimension deterministic) |
| Briefings — briefability queue | Score × confidence × recency |
| Bills Digests | Parliamentary Library ParlInfo RSS (2026 session) |
| Committees — inquiry and report items | Senate + House + Joint inquiry RSS |
| Watchlists — keyword scoring bias | localStorage; drives portfolio dimension |
| Archive — D1-backed signal history | Server-side scoring, attention filter, timeline |
| Alert rules engine | D1-backed, KV watermark dedup, cron-evaluated |
| Sources — APH connector health | Fortnightly liveness check (12 endpoints) |
| QON patterns | ParlInfo daily ingest; clustered by target |
| Member roster | Senators from senators_details RSS → D1 |

### Deferred (honest empty state, links to authoritative source)

| Surface | Why deferred |
|---|---|
| House Daily Program | APH publishes as HTML page only (no RSS) |
| Senate Dynamic Red | APH publishes as HTML page only (no RSS) |
| Divisions | APH divisions RSS returns empty containers |
| House member roster | members_updates RSS returns empty containers |
| Ministry portfolios | No structured feed; derived from member data where available |
| QON metadata | ParlInfo HTML parsing; questioner/topic extracted where page structure allows |
| Email digest delivery | Subscription stored in D1; requires SendGrid credentials to activate |
| Momentum/ops scoring | Weight = 0 pending D1 time-series frequency data |

## Repo layout

```
apps/web/             Vite 6 + React 18 + TypeScript SPA
workers/aph-proxy/    Cloudflare Worker: APH RSS proxy, archive, scoring, alerts
  migrations/         D1 schema (0001–0004)
  src/archive.ts      Ingest + query layer
  src/workerScoring.ts  Server-side scoring engine
  src/hansard.ts      QON ingest from ParlInfo
infra/                Cloudflare Pages config
docs/                 Architecture docs and ADRs
.github/workflows/    CI and deploy pipelines
e2e/                  Playwright smoke tests
```

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Terminal 1 — Worker with D1
pnpm dev:worker
# Terminal 2 — Vite SPA
pnpm dev:web
```

Open `http://localhost:5173`.

## Deployment

- **Frontend**: Cloudflare Pages, auto-deployed from `main` via GitHub Actions
- **Worker**: `aph-proxy`, auto-deployed via `wrangler-action` on every push to `main`
- **D1**: `ARCHIVE` database; run `wrangler d1 migrations apply ARCHIVE --remote` after schema changes
- **KV**: 5-minute TTL cache on RSS responses; also stores alert watermarks

## Cron schedule

| Schedule | Action |
|---|---|
| `*/30 * * * *` | Poll 8 APH RSS feeds, score, archive to D1; re-derive member roster |
| `0 19 * * *` | Ingest QONs from ParlInfo; send daily digest (if SendGrid configured) |
| `0 0 */14 * *` | Re-verify 12 APH connector URLs |

## Licence

MIT. See `LICENSE`.
