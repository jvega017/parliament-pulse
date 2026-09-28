# Live /state contract (verified 2026-07-19)

Source: `https://aph-proxy.jvega019.workers.dev/state` (Worker v0.15.0, schema `state-v1`). Probed live this session. `WORKER_BASE_URL` is defined at `data.jsx:24`.

## Shape

```
{
  meta:   { generated_at, worker_version, schema, signal_counts? },
  blocks: {
    signals:    { provenance, fetched_at, origin, items: [ ... 31 ... ] },
    connectors: { provenance, fetched_at, origin, checks: [ ... 11 ... ] },
    threads:    { provenance, fetched_at, origin, items: [ ... 16 ... ] },
    alerts:     { provenance, fetched_at, origin, events: [], note },
    qons:       { provenance, fetched_at, origin, items: [], note }
  }
}
```

## Field names (verified from live payload)

- **signals.items[]**: `guid`, `title`, `link`, `pub_date`, `feed_label`, `source_group`, `kind`, `attention`, `confidence`, `scoring_explanation`
- **connectors.checks[]**: `url`, `checked_at`, `ok`, `status`, `error`
- **threads.items[]**: `thread_id`, `title`, `item_count`, `first_seen_at`, `last_seen_at`, `signal_guids`

## Signals block: per-feed quotas (Worker WK-04, 29 Sep 2026, merged on branch, not yet deployed)

Before WK-04 the Worker served one global top 30, so the busiest feeds took every row and quieter feeds (divisions, media releases, reports, digests) often had none (review finding DATA-05). From WK-04:

- `blocks.signals.items` holds up to **10 rows per configured feed** (`PER_FEED_QUOTA`), chosen by fresh score then recency, merged and sorted globally, with a hard total cap of **150** (`STATE_SIGNAL_CAP`). With 13 feeds the ceiling today is 130. Item fields are unchanged and `items` is still an array, so `state-v1` consumers keep parsing.
- `meta.signal_counts` (additive, optional): `{ "<feed_label>": { "held": n, "available": m } }`, one key per configured feed. `held` is the number of that feed's rows in `items`; `available` is the number archived in D1. A desk can therefore say "latest {held} of {available} held". A feed with no rows reports `{ held: 0, available: 0 }` and its desk shows an honest empty state. The key is absent when the signals query failed, because zero would then be an unverified claim.
- Rows whose `feed_label` is not a configured feed (for example legacy labels kept by archived rows) are not served in this block.
- The Worker KV cache key moved from `state:v1` to `state:v2`, so a cached 30-row body cannot be served after the deploy.

Source of truth for the shape: `workers/aph-proxy/src/stateContract.ts` in the Worker monorepo.

## What is live vs not (the honesty boundary)

| Data | Live block | Wire to desks |
|---|---|---|
| Signals (31 real) | `blocks.signals.items` | Overview, Signal inbox (already), Attention radar, Watchlists, Briefings |
| Feed health (11 real) | `blocks.connectors.checks` | Sources page becomes a real status surface |
| Threads/clusters (16 real) | `blocks.threads.items` (Worker labels this `derived`, the Worker's own clustering, updated 2026-07-19) | QON patterns / thread views, shown with a Derived chip |
| Divisions | none (not served) | stay honestly representative, labelled |
| Questions on notice | `blocks.qons.items` EMPTY (parlinfo 403) | stay representative, labelled; do not assert live |
| Bills, Committees | no dedicated block (referenced inside signals.source_group) | derive from signals where honest, else representative |

## Facts-and-links treatment (per docs/licence-architecture.md)

Each live signal renders as: the product's own attention/confidence score and `scoring_explanation` (product's own work), the `title` shown only as a linked identifier to `link` (the APH source, attribution + deep link), and `feed_label`/`source_group`/`pub_date` as factual metadata. The title is never presented as the product's own standalone prose; it is always the click target to aph.gov.au. The strict decomposed-fact-headline (generated from structured fields) is a Worker-side enhancement for later; the linked-identifier treatment is the deployable-today interim and keeps the source link primary.

## Provenance

Each block carries its own `provenance` (`live` | representative) and `fetched_at`. Every wired desk must surface a provenance chip from its block, exactly as `PageSignals` already does (`pages.jsx:1946`). A desk with no live block shows a Representative chip and never claims live.

`resend_wired: false` on the Worker: the digest is built but inert until `RESEND_API_KEY` is set (Juan's action).
