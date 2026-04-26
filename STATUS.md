# Parliament Pulse — Service Status

Last updated 2026-04-26 (Wave 14). Live infrastructure state:
[`/?page=status`](https://parliament-pulse.pages.dev/?page=status).

## Live data sources

All data on the production site is pulled from official APH endpoints
through the `aph-proxy` Cloudflare Worker. No fabricated records.

| Surface | Data source | Refresh |
|---|---|---|
| Today's signals | APH RSS (8 feeds) scored client-side | Every 10 min, on-demand |
| Live parliament | YouTube channel RSS (chamber-matched) | Every 10 min |
| Attention radar | Derived from live signals (cluster on watchlist tag) | Per poll |
| Briefings queue | Derived from live signals, ranked by attention | Per poll |
| Today in chamber | Live signals filtered by source label | Per poll |
| Committees · activity | Live signals filtered by kind=inquiry/hearing/report | Per poll |
| Committees · directory | Verified APH committee names + canonical URLs | Static |
| Bills monitor | Bills Digests (kind=digest) from ParlInfo RSS 2026 | Per poll |
| Watchlists | Keyword sets matched against live RSS titles | Per poll |
| Sources | Real feed status from `liveFeedResult.feedStatus` | Per poll |
| Archive | D1 archive of every poll observation | Cron every 30 min |
| Status | Worker `/healthz`, connector check D1, digest signups | On load |

## Backend (D1 + cron, Worker `aph-proxy`)

| Job | Cron | Job |
|---|---|---|
| Archive poll | `*/30 * * * *` | Reads each APH RSS, upserts into `signals` table by guid |
| Connector verify | `0 0 */14 * *` | Pings the 12 canonical APH connector URLs, writes to `connector_checks` |
| Hansard QON ingest | `0 19 * * *` | ParlInfo full-text scrape into `qons` (skeleton; richer NER pending) |
| Digest delivery | `0 19 * * *` | SendGrid email to subscribers with last 24h items (gated by SENDGRID_API_KEY) |

## Activation checklist

The following one-time steps activate the backend:

```
# Create D1 archive
wrangler d1 create parliament-pulse-archive
# replace database_id in workers/aph-proxy/wrangler.toml with the printed value

# Apply schema
wrangler d1 migrations apply parliament-pulse-archive --remote

# (optional) Activate digest delivery
wrangler secret put SENDGRID_API_KEY
wrangler secret put DIGEST_FROM_EMAIL

# (optional) Activate Sentry
# add VITE_SENTRY_DSN to apps/web/.env.production and rebuild

# (optional) Activate Cloudflare Access on /archive
# see docs/cloudflare-access.md, then set Worker var REQUIRE_ACCESS=true
```

## Deferred ingest surfaces

| Surface | Why deferred | CTA target |
|---|---|---|
| Bills detail | Bills Search ingest not built | aph.gov.au/Parliamentary_Business/Bills_Legislation |
| Member detail | Senators and Members roster ingest not built | aph.gov.au/Senators_and_Members |
| Minister detail | Ministry list ingest not built | pmc.gov.au/government/ministries |
| Divisions | APH division feeds dormant | parlinfo.aph.gov.au |
| Hansard QON pattern engine | Skeleton ingest live; richer NER pending | ParlInfo |

## Frontend services

* PWA: manifest + service worker for offline shell
* Theme: dark / light, system-aware default, persisted in localStorage
* Sentry: opt-in via `VITE_SENTRY_DSN`; falls back to console-only handler
* Smoke: Playwright suite in `e2e/`, runs against production on every push to main
* Confirm modal: replaces native `window.confirm`

## Worker

* Endpoint: `https://aph-proxy.jvega019.workers.dev`
* Health: `/healthz`, `/healthz/connectors`
* Archive: `/archive`, `/archive/analytics`
* Digest: `POST /digest/subscribe`
* Allowlist for `/rss?u=`: `www.aph.gov.au`, `aph.gov.au`,
  `parlinfo.aph.gov.au`, `parlwork.aph.gov.au`, `www.youtube.com`
* Cache: KV, 5 min TTL per upstream URL
* Storage: D1 `parliament-pulse-archive`

## Versioning

The app version is read at build time from `apps/web/package.json` and shown
in the DemoBanner footer. Status page shows both frontend and Worker version.
