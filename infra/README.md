# Infra notes

Non-secret provisioning steps for the Cloudflare resources this repo depends on. Follow these once when first setting up the account; thereafter everything runs from CI.

## 1. KV namespace for the Worker cache

```bash
cd workers/aph-proxy
wrangler kv namespace create CACHE
# Wrangler prints:
#   [[kv_namespaces]]
#   binding = "CACHE"
#   id = "abcdef0123456789"
# Copy the id into wrangler.toml under [[kv_namespaces]].
```

## 2. First Worker deploy

```bash
pnpm --filter aph-proxy deploy
# Worker URL: https://aph-proxy.<your-subdomain>.workers.dev
curl "https://aph-proxy.<subdomain>.workers.dev/healthz"
```

Record the subdomain; it goes into the `VITE_API_BASE` GitHub variable.

## 3. Cloudflare Pages project

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

## 4. GitHub secrets and variables

Repo Settings → Secrets and variables → Actions.

Secrets (hidden):
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Variables (visible in logs):
- `VITE_API_BASE` — same value as used in the Pages dashboard

## 5. After first successful deploy

Add the Pages URL to the Worker's CORS allowlist. Edit `workers/aph-proxy/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173,https://parliament-pulse.pages.dev"
```

Redeploy the Worker (`pnpm --filter aph-proxy deploy`) or push to main and let CI handle it.
