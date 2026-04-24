# ADR 0002: Cloudflare over Vercel

**Status**: Accepted, 2026-04-24

## Context

Parliament Pulse needs a static host for the SPA and an edge compute runtime for the APH RSS proxy. Australia-based users need low latency. Free tier is a hard requirement until the tool has institutional funding.

## Decision

Use Cloudflare end to end:

- **Pages** for the SPA
- **Workers** for the `aph-proxy`
- **KV** for the 5-minute RSS cache
- Same vendor, single API token, single dashboard

## Consequences

- Sub-20ms latency from Brisbane to the Sydney POP.
- $0 on free tier: 100k Worker requests/day, unlimited Pages requests, 1GB KV.
- Single secret (`CLOUDFLARE_API_TOKEN`) covers both frontend and backend deploys.
- Vendor coupling: migrating later to Vercel or Netlify + AWS Lambda requires proxying the Worker separately.

## Rejected alternatives

- **Vercel + Cloudflare Worker**: two vendors, two dashboards, two free-tier quotas to watch. Vercel Edge is good but the pricing model is aggressive once the Hobby limits tick over.
- **Fly.io / Railway**: always-on containers; pay even when idle; latency unpredictable vs Cloudflare edge.
- **AWS Lambda + CloudFront**: overkill for a RSS proxy; Australian region latency still worse than Cloudflare Sydney.
