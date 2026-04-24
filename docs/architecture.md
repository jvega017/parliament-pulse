# Architecture

```
+----------------------+           +---------------------------+
|   Browser (Pages)    |           |   Cloudflare Worker       |
|                      |  GET      |   aph-proxy               |
|   React SPA          +---------->+   /rss?u=<aph-url>        |
|   (apps/web)         |  /rss     |                           |
|                      |<----------+   + KV cache (5-min TTL)  |
+----------+-----------+           +-------------+-------------+
           ^                                     |
           | static assets                       | GET (cached upstream)
           |                                     v
    +------+-----------+                +--------+--------+
    |  Cloudflare CDN  |                |  www.aph.gov.au |
    |  Pages           |                |  parlinfo.aph   |
    +------------------+                +-----------------+
```

## Why this shape

- Browser cannot call APH directly (no `Access-Control-Allow-Origin`).
- Worker in Sydney POP gives Brisbane users sub-20ms round trip.
- KV cache respects APH polite-scraping expectations and protects against rate limits.
- Pages handles preview deploys automatically per PR, no extra config.

## Files in play

| Concern               | File                                                     |
|-----------------------|----------------------------------------------------------|
| SPA entry             | `apps/web/src/main.tsx`                                  |
| Design tokens         | `apps/web/src/styles/tokens.css`                         |
| Worker entry          | `workers/aph-proxy/src/index.ts`                         |
| Worker config         | `workers/aph-proxy/wrangler.toml`                        |
| CI                    | `.github/workflows/ci.yml`                               |
| Pages deploy          | `.github/workflows/deploy-web.yml`                       |
| Worker deploy         | `.github/workflows/deploy-worker.yml`                    |

## Secrets

| Name                    | Where stored                | Used by                        |
|-------------------------|-----------------------------|--------------------------------|
| `CLOUDFLARE_API_TOKEN`  | GitHub repo secret          | Pages + Worker deploy actions  |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub repo secret          | Pages + Worker deploy actions  |
| `VITE_API_BASE`         | GitHub repo variable        | Web build step                 |
