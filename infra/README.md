# Infra notes

Non-secret provisioning steps for the Cloudflare resources this repo depends on.
Follow these once when first setting up the account; thereafter everything runs from CI.

## 1. KV namespace for the Worker cache

```bash
cd workers/aph-proxy
wrangler kv namespace create CACHE
# Copy the printed id into wrangler.toml under [[kv_namespaces]].
```

## 2. D1 database

```bash
cd workers/aph-proxy
wrangler d1 create parliament-pulse-archive
# Copy the printed database_id into wrangler.toml under [[d1_databases]].
wrangler d1 migrations apply ARCHIVE --remote
```

## 3. First Worker deploy

```bash
pnpm --filter aph-proxy deploy
curl "https://aph-proxy.<subdomain>.workers.dev/healthz"
```

Record the subdomain; it goes into the `VITE_API_BASE` GitHub Actions variable.

## 4. Cloudflare Pages project

Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.

- Repository: `jvega019/parliament-pulse`
- Production branch: `main`
- Build command: `pnpm --filter web build`
- Build output directory: `apps/web/dist`
- Root directory: `/`
- Environment variables (Production and Preview):
  - `VITE_API_BASE` = `https://aph-proxy.<subdomain>.workers.dev`
  - `NODE_VERSION` = `22`

Save. Cloudflare triggers the first deploy.

## 5. GitHub secrets and variables

Repo Settings → Secrets and variables → Actions.

Secrets (hidden):
- `CLOUDFLARE_API_TOKEN`  — needs Workers + Pages + D1 edit permissions
- `CLOUDFLARE_ACCOUNT_ID`

Variables (visible in logs):
- `VITE_API_BASE` — same value as used in the Pages dashboard

## 6. After first successful deploy

Add the Pages URL to the Worker's CORS allowlist in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173,https://parliament-pulse.pages.dev"
```

Redeploy the Worker: `pnpm --filter aph-proxy deploy`.

---

## Production launch checklist

Run through this before any public or restricted-audience exposure.

### Access control (decide one)

**Option A — public tool (default)**
Leave `REQUIRE_ACCESS = "false"` in `wrangler.toml`. Archive data is publicly readable;
rate limits protect against bulk extraction (120 req/min on /archive).

**Option B — restricted access**
1. Set `REQUIRE_ACCESS = "true"` in `wrangler.toml [vars]`
2. In Cloudflare dashboard → Zero Trust → Access → Applications:
   - Add application → Self-hosted
   - Domain: `aph-proxy.<subdomain>.workers.dev`
   - Policy: allow listed emails / GitHub org / Okta group
3. Deploy the Worker with the updated config.

### Email digest activation

```bash
cd workers/aph-proxy
wrangler secret put SENDGRID_API_KEY      # paste your SendGrid API key
wrangler secret put DIGEST_FROM_EMAIL     # e.g. alerts@prometheuspolicylab.com
```

The sender domain must be verified in SendGrid (Domain Authentication).
Subscribers collected in D1 will receive their first digest at 05:00 AEST
after the secrets are set.

### Custom domain

1. Add domain in Cloudflare Pages dashboard → Custom domains.
2. Add the domain to `ALLOWED_ORIGINS` in `wrangler.toml`:
   ```toml
   ALLOWED_ORIGINS = "...existing...,https://pulse.prometheuspolicylab.com"
   ```
3. Push to `main` — CI redeploys the Worker with the updated CORS header.

### Momentum scoring weight

The `W_MOM` constant in `workers/aph-proxy/src/workerScoring.ts` is currently `0`
(display only). Once 14+ days of D1 signal history have accumulated, enable it:

```typescript
// workerScoring.ts
const W_MOM  = 0.05;   // was 0
const W_AUTH_ADJ = W_AUTH - 0.025;  // rebalance: 0.385 → 0.36
const W_TIME     = 0.308 - 0.025;   // rebalance: 0.308 → 0.283
```

Re-run `wrangler deploy` after changing. The attention threshold (high ≥ 0.65)
remains unchanged so existing bookmarks and alert rules continue to fire correctly.

### D1 migration after schema changes

```bash
cd workers/aph-proxy
wrangler d1 migrations apply ARCHIVE --remote
```

Always apply migrations before deploying the Worker that depends on the new schema.
