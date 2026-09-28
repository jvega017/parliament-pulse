# Parliament Pulse: service status

Last updated 29 September 2026, from probes of production run between
09:31:50 and 09:36:38 AEST (2026-09-28T23:31:50Z to 23:36:38Z) with a
browser user-agent, and from a read of the `upgrade/commercial-ready`
branch code. Replaces the 28 April 2026 version, which claimed eight feeds,
client-side scoring, and QON and member data as live.

Labels used below:

- **live**: the surface returned real rows from APH or from the D1 archive at probe time.
- **derived**: computed from live rows (for example, threads grouped from signals).
- **empty**: the surface answers, but returned no rows. The frontend shows an honest empty state, never sample content.
- **not built**: the surface does not exist in that code line.

## Production (deployed)

Worker `https://aph-proxy.jvega019.workers.dev`, version `0.15.0`
(scoring engine `v1.1-deterministic`). Frontend
`https://parliament-pulse.pages.dev` answered HTTP 200. The custom domain
`pulse.prometheuspolicylab.com` did not resolve (curl returned no HTTP status).

| Surface | Endpoint or `/state` block | Label | Probe result, 29 Sep 2026 |
|---|---|---|---|
| Liveness | `GET /healthz` | live | 200, `ok: true`, `resend_wired: false` |
| Job-run readiness | `GET /healthz/deep` | not built | 404 `not found` (exists on the branch only) |
| Signals | `/state` `signals` | live | 30 items, provenance `live`, drawn from 4 of 13 configured feeds: Upcoming Senate hearings 16, Joint committee inquiries 10, New Senate inquiries 3, House committee inquiries 1. Undated items are scored `high` (the pre-WK-01 behaviour). `meta` carries no freshness fields. |
| Connector checks | `/state` `connectors`, `GET /healthz/connectors` | live | 12 checks, 11 OK, `https://parlinfo.aph.gov.au/` 403, last checked 2026-09-28T05:01Z. These are pings of 12 reference landing pages, not per-feed health (the branch replaces them). |
| Threads | `/state` `threads` | derived | 15 threads, provenance `derived` |
| Alert events | `/state` `alerts`, `GET /alerts/events` | empty | provenance `fixture`, note "alert_events table returned no rows"; `/alerts` returns `{"rules":[]}`. Alert rule writes are disabled (LB-04). |
| Questions on notice | `/state` `qons`, `GET /qons` | empty | provenance `fixture`, note "qons table returned no rows"; `/qons` returns `{"rows":[],"total":0}` |
| Member roster | `GET /members` | empty | `{"members":[],"total":0}` |
| Bills Digests | `GET /bills` | live | 52 rows, total 52 |
| Archive | `GET /archive`, `GET /archive/timeline` | live | rows returned; timeline days run from 2025-07-23 |
| RSS proxy | `GET /rss?u=<configured feed>` | live | New Senate inquiries feed returned 200 XML |
| Email digest | `POST /digest/subscribe`, 19:00 UTC cron | not built | not probed (POST); `resend_wired: false`, and subscription is disabled in code (LB-05) |

Why QON and member data are empty (probed 29 Sep 2026):

- **Questions on notice.** The daily ingest scrapes a ParlInfo search page.
  ParlInfo does not return search results to automated requests: from the
  Worker the ParlInfo root answers 403 (connector check above), and a
  browser-user-agent request for the exact search URL the ingest uses
  returned HTTP 200 with a search form and no result entries. The ingest
  therefore stores zero rows.
- **Member roster.** The roster is derived from Senators' details feed items
  that link to an APH profile (`MPID`). The feed held one item at probe time,
  a contact-guidelines link, so the derivation stores zero rows.

## Branch `upgrade/commercial-ready` (awaiting deploy)

Nothing below is live until the owner merges to `main` and the CI-gated
deploy runs. New migrations `0006_feed_health.sql`,
`0007_backfill_thread_item_count.sql` and `0008_job_runs.sql` are not applied
to the remote D1; the deploy runbook must apply them first. Remote migration
state was not queried in this session.

| Package | Change in the code | Effect on surfaces |
|---|---|---|
| WK-01 | Undated items are no longer scored as fresh; `/state` `meta` adds `last_poll_at`, `last_new_item_at`, per-feed `feeds`, `stale` | Signals carry an honest freshness reading |
| WK-02 | `/rss` accepts only the exact configured feed URLs; per-IP read limits | RSS proxy is no longer a host-wide relay |
| WK-03 | `connectors` becomes one row per configured feed from the `feed_health` table (HTTP status, items parsed, last success); the 12 landing pages move to `reference_links` and are never reported as health. Thread counts are computed, not stored. Deploys run only through CI. | Connector checks become real feed health |
| WK-04 | Signals block holds up to 10 rows per feed, capped at 150, with `meta.signal_counts` | Quieter feeds are no longer starved by a global top 30 |
| WK-05 | Every cron job writes a `job_runs` row; `GET /healthz/deep` returns 503 when the poll is over 75 minutes old or a daily job over 26 hours | Job-run readiness becomes live |
| WK-06 | Constant-time admin token compare, error messages no longer served, CORS and LIKE escaping fixes, digest stays dormant | No surface change |
| WK-07 | D1 export with a manifest and a tested restore drill (`RESTORE.md`) | No surface change |
| WK-08 | Empty QON and member surfaces keep provenance `fixture` and carry a plain reason in `note`; `/qons` and `/members` add `provenance` and `note`; feed tables generated from `src/jurisdictions.json` | Empty desks say why they are empty |

On the branch the QON and member surfaces stay **empty**. The crons keep
running and record their zero-row outcomes as counts in `job_runs.detail`
(`qons`: `added`/`attempted`; `members`: `added`/`updated`). `/healthz/deep`
reports only each job's last ok time, last outcome and overdue flag, so a
zero-row run shows there as `ok`; the counts are read from D1.

## Configured feeds

Generated from `workers/aph-proxy/src/jurisdictions.json` (the single
source); `tests/feeds-table.test.mjs` fails if this table drifts.

<!-- feeds-table:start (generated by workers/aph-proxy/scripts/feeds-table.mjs from src/jurisdictions.json; do not edit by hand) -->
13 configured feeds (Australian Parliament House), polled every 30 minutes by the `*/30` cron.

| # | Feed label | Kind | URL |
|---|---|---|---|
| 1 | New Senate inquiries | inquiry | `https://www.aph.gov.au/senate/rss/new_inquiries` |
| 2 | Senate reports tabled | report | `https://www.aph.gov.au/senate/rss/reports` |
| 3 | Upcoming Senate hearings | hearing | `https://www.aph.gov.au/senate/rss/upcoming_hearings` |
| 4 | Senators' details updates | signal | `https://www.aph.gov.au/senate/rss/senators_details` |
| 5 | House media releases | signal | `https://www.aph.gov.au/house/rss/media_releases` |
| 6 | House committee inquiries | inquiry | `https://www.aph.gov.au/house/rss/house_inquiries` |
| 7 | Joint committee inquiries | inquiry | `https://www.aph.gov.au/house/rss/joint_inquiries` |
| 8 | Bills Digests | digest | `https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=0;query=Date%3AthisYear%20Dataset%3Abillsdgs;resCount=100` |
| 9 | House divisions | division | `https://www.aph.gov.au/house/rss/divisions` |
| 10 | House daily program | program | `https://www.aph.gov.au/house/rss/daily_program` |
| 11 | Today's House and joint hearings | hearing | `https://www.aph.gov.au/house/rss/todays_hearings` |
| 12 | Today's Senate hearings | hearing | `https://www.aph.gov.au/senate/rss/red` |
| 13 | House news | signal | `https://www.aph.gov.au/house/rss/house_news` |
<!-- feeds-table:end -->

A configured feed is not necessarily a populated feed. House divisions,
daily program and today's hearings feeds carry items only in sitting weeks.

## Scheduled jobs (branch code, `wrangler.toml`)

| Cron (UTC) | Job | Notes |
|---|---|---|
| `*/30 * * * *` | `poll`, `members` | Polls every configured feed into `signals`; re-derives the Senate roster |
| `0 5 * * *` | `connectors` | Pings the 12 reference landing pages into `connector_checks` (internal link-rot log, not served as health); prunes `job_runs` older than 30 days |
| `0 19 * * *` | `qons`, `digest` | 05:00 AEST. QON ingest (stores zero rows, see above); digest is dormant |

## Not in this repository

The deployed frontend is the separate `Claude-Workspace/03_Projects/parliament-pulse`
repository. `apps/web` here is retired (frozen 30 May 2026, not built or
deployed); its `deploy-web.yml` workflow is manual-dispatch only.
