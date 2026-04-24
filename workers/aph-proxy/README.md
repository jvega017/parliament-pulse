# aph-proxy

Cloudflare Worker that fronts the Australian Parliament House RSS feeds with CORS and a 5-minute KV cache.

## Endpoints

| Method | Path       | Description                                                    |
| ------ | ---------- | -------------------------------------------------------------- |
| GET    | `/healthz` | Returns `{ ok: true }`                                         |
| GET    | `/rss?u=`  | Fetches the given APH URL, caches for 5 min, returns XML       |
| OPTIONS| any        | CORS preflight                                                 |

The `u` query param must be an `https://` URL whose host is one of:

- `www.aph.gov.au`
- `aph.gov.au`
- `parlinfo.aph.gov.au`

Anything else returns 403.

## Dev

```bash
pnpm --filter aph-proxy dev
# Worker runs on http://127.0.0.1:8787
curl "http://127.0.0.1:8787/healthz"
curl "http://127.0.0.1:8787/rss?u=https%3A%2F%2Fwww.aph.gov.au%2Fsenate%2Frss%2Fnew_inquiries"
```

## Deploy

First time only:

```bash
wrangler kv namespace create CACHE
# Paste the returned id into wrangler.toml under [[kv_namespaces]]
```

Then:

```bash
pnpm --filter aph-proxy deploy
```

## Config

`wrangler.toml` holds the non-secret config.

- `ALLOWED_ORIGINS` — comma-separated list of origins permitted for CORS. Update after the first Pages deploy to include the `pages.dev` URL and any custom domain.
- KV binding `CACHE` — RSS payload cache with 5-minute TTL.

## Security

- Only `https://` URLs accepted.
- Only the three APH hosts are allowed.
- Upstream timeout defaults to Cloudflare's global (~30s). No retry loop.
- No auth on the Worker; rate limits applied at Cloudflare edge if abuse is observed.
