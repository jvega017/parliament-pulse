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

## Measured Performance & Accuracy (Warrantos Evaluation)

### Corpus Statistics

| Metric | Count |
|--------|-------|
| Total sentences | 500+ |
| Numeric claims | 150 |
| Statute/legal claims | 50 |
| Attribution claims | 50 |
| Non-claims (rhetoric/methodology) | 100 |
| Adversarial (injection-adjacent, unicode edge cases) | 75 |
| Real-world policy-brief sentences | 75 |

### Claim Detection Accuracy

Per-class precision/recall/F1 scores are computed via `eval/calibrate.py` against the evaluation corpus. Target: load-bearing claim recall ≥ 0.90 for production readiness.

| Claim Class | Precision | Recall | F1 Score | Status |
|-------------|-----------|--------|----------|--------|
| Numeric | - | - | - | Run `python eval/calibrate.py` |
| Statute | - | - | - | Run `python eval/calibrate.py` |
| Attribution | - | - | - | Run `python eval/calibrate.py` |
| Non-claims | - | - | - | Run `python eval/calibrate.py` |
| Adversarial | - | - | - | Run `python eval/calibrate.py` |
| **Load-bearing recall** | - | - | - | Run `python eval/calibrate.py` |

### Performance Benchmarks

Throughput and latency measurements from `eval/bench.py`. Budget assertion: 10k-word document must complete in <10 seconds.

| Metric | Value | Status |
|--------|-------|--------|
| 1k word document | - | Run `python eval/bench.py` |
| 10k word document | - | Run `python eval/bench.py` |
| 100k word document | - | Run `python eval/bench.py` |
| **10k word budget** | <10s target | Run `python eval/bench.py` |
| Ledger write throughput | - claims/sec | Run `python eval/bench.py` |
| Merkle root (10k entries) | - seconds | Run `python eval/bench.py` |

### Security Review

External security review checklist available in `SECURITY.md`. All critical items verified:

- Envelope & attestation: signature binds prose_sha256 and cbom_sha256
- SSRF & network safety: URL scheme validation, IP whitelist, redirect caps
- Injection surfaces: subprocess safety, JSON parsing, path containment
- Append-only ledger: SQLite triggers prevent UPDATE/DELETE
- Exception handling: all errors logged to stderr, no silent swallows
- Cryptographic implementation: SHA-256 hashing, constant-time comparison

### How to Generate Metrics

1. **Calibration (accuracy per class):**
   ```bash
   cd eval && python3 calibrate.py
   # Outputs: calibrate_results.json with per-class precision/recall/F1
   ```

2. **Benchmarks (throughput & latency):**
   ```bash
   cd eval && python3 bench.py
   # Outputs: bench_results.json with throughput and latency measurements
   ```

3. **CI Integration:**
   - `.github/workflows/eval.yml` runs calibration and benchmarks on every PR
   - Results posted as PR comments for easy review
   - Artifacts uploaded for trend analysis over time
