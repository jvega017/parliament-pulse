# Architecture

Updated 29 September 2026 (WK-08) to match the code on `upgrade/commercial-ready`.
The earlier version described a browser SPA in `apps/web` calling a bare RSS
proxy; that SPA is retired and the Worker now archives, scores and composes.

```
+---------------------------+          +--------------------------------------+
|  Browser                  |  GET     |  Cloudflare Worker  aph-proxy        |
|  Frontend (separate repo: +--------->+  /state   composed, provenance/block  |
|  03_Projects/             |  /state  |  /bills /qons /members /archive/*    |
|  parliament-pulse),       |  /rss    |  /rss?u=<configured feed only>       |
|  served by Cloudflare     |<---------+  /healthz /healthz/deep /connectors  |
|  Pages                    |          +-----+-------------------+------------+
+---------------------------+                |                   |
                                   KV CACHE  |                   | D1 ARCHIVE
                                   (5 min    |                   | signals, feed_health,
                                   bodies,   |                   | threads, qons, members,
                                   rate      |                   | alert_*, job_runs,
                                   limits)   |                   | connector_checks
                                             v                   ^
                                  +----------+-------------------+----------+
                                  | Cron: */30 poll feeds > signals,        |
                                  |       feed_health; re-derive members    |
                                  |       0 5 reference-link pings          |
                                  |       0 19 QON ingest, digest (dormant) |
                                  +--------------------+--------------------+
                                                       | GET, browser UA
                                                       v
                                        www.aph.gov.au, parlinfo.aph.gov.au
```

## Why this shape

- The browser cannot call APH directly (no `Access-Control-Allow-Origin`), and
  the APH edge WAF refuses non-browser user-agents, so every upstream fetch
  goes through the Worker with the browser header profile in
  `src/jurisdictions.json`.
- Polling on a cron and serving from D1 decouples page loads from APH
  availability and keeps upstream load to one fetch per feed per 30 minutes.
- `/state` is provenance-as-schema (`src/stateContract.ts`): each block is
  `live`, `derived` or `fixture`, and a `fixture` block is always empty with a
  `note`. The frontend renders its honesty chip from that value.
- Scoring runs server-side (`src/workerScoring.ts`), recomputed on read.

## Files in play

| Concern | File |
|---|---|
| Feed list and APH config (single source) | `workers/aph-proxy/src/jurisdictions.json` |
| Worker entry and routes | `workers/aph-proxy/src/index.ts` |
| `/state` composition and contract | `workers/aph-proxy/src/state.ts`, `src/stateContract.ts` |
| Ingest and queries | `workers/aph-proxy/src/archive.ts`, `src/hansard.ts` |
| Job-run log | `workers/aph-proxy/src/jobs.ts` |
| Worker config | `workers/aph-proxy/wrangler.toml` |
| CI | `.github/workflows/ci.yml` |
| Worker deploy (after CI on `main`) | `.github/workflows/deploy-worker.yml` |
| D1 backup | `.github/workflows/d1-backup.yml`, `workers/aph-proxy/RESTORE.md` |
| Retired SPA deploy (manual only) | `.github/workflows/deploy-web.yml` |

## Secrets

| Name | Where stored | Used by |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub repo secret | Worker deploy, dry run, D1 backup |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub repo secret | Worker deploy, dry run, D1 backup |
| `ADMIN_TOKEN` | Worker secret (every `/admin/*` call is refused when unset) | `/admin/*` routes |
| `RESEND_API_KEY` | Worker secret (not set; digest dormant) | Digest delivery |
