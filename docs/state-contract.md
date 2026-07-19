# Live /state contract (verified 2026-07-19)

Source: `https://aph-proxy.jvega019.workers.dev/state` (Worker v0.15.0, schema `state-v1`). Probed live this session. `WORKER_BASE_URL` is defined at `data.jsx:24`.

## Shape

```
{
  meta:   { generated_at, worker_version, schema },
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
