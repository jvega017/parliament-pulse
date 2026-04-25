# Parliament Pulse — Service Status

This page documents what is live, what is deferred, and the data integrity
guarantees behind every surface in the app. Last updated 2026-04-25.

## Live data sources

All data on the production site is pulled from official APH endpoints
through the `aph-proxy` Cloudflare Worker. There are no fabricated
records.

| Surface | Data source | Refresh |
|---|---|---|
| Today's signals | APH RSS (5 feeds) scored client-side | Every 10 min, on-demand |
| Live parliament | YouTube channel RSS (chamber-matched) | Every 10 min |
| Attention radar | Derived from live signals (cluster on watchlist tag) | Per poll |
| Briefings queue | Derived from live signals, ranked by attention | Per poll |
| Today in chamber | Live signals filtered by source label | Per poll |
| Committees · activity | Live signals filtered by kind=inquiry/hearing/report | Per poll |
| Committees · directory | Verified APH committee names + canonical URLs | Static |
| Watchlists | User keyword sets, matched against live RSS titles | Per poll |
| Sources | The five APH endpoints we poll, with live status from `feedStatus` | Per poll |
| QON patterns | Empty until Hansard QON ingest lands | n/a |

## Deferred ingests

These surfaces show empty states with deep links to the canonical APH page
until the corresponding ingest is built. None of them carry fabricated
data.

| Surface | Why deferred | CTA target |
|---|---|---|
| Bills detail | Bills Search ingest not built | `aph.gov.au/Parliamentary_Business/Bills_Legislation` |
| Member detail | Senators and Members roster ingest not built | `aph.gov.au/Senators_and_Members` |
| Minister detail | Ministry list ingest not built | `pmc.gov.au/government/ministries` |
| Divisions | Division feeds dormant on APH | `parlinfo.aph.gov.au` |
| QON pattern engine | Hansard QON ingest not built | ParlInfo full-text |

## Connector audit

The 12 APH connector URLs surfaced on the Live page were last verified to
resolve against the live site on 2026-04-24. They are re-checked manually
each fortnight; failures are caught by the worker `/healthz` probe and the
Topbar source-health chip.

## Worker

* Endpoint: `https://aph-proxy.jvega019.workers.dev`
* Health: `/healthz`
* Allowlist: `www.aph.gov.au`, `aph.gov.au`, `parlinfo.aph.gov.au`,
  `parlwork.aph.gov.au`, `www.youtube.com`
* Cache: KV, 5 min TTL per upstream URL

## Versioning

The app version is read at build time from `apps/web/package.json` and
shown in the DemoBanner footer alongside the deployed commit SHA.
