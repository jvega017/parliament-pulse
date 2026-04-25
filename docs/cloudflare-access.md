# Cloudflare Access — gating Archive and Status

Cloudflare Access can put SSO + email-allowlist in front of any URL on the
Pages deployment without code changes. Free for under 50 seats. Use it once
the archive contains anything that should not be public.

## Recommended policy

Apply to:
* `parliament-pulse.pages.dev/?page=archive*`
* `parliament-pulse.pages.dev/?page=status*`
* The Worker `/archive*` endpoints (separate Access app on the Worker route)

Leave open:
* Everything else — the live signal stream, sources, watchlists,
  briefings preview. These work off public APH RSS only.

## Steps

1. Cloudflare dashboard → Zero Trust → Access → Applications → Add an application
2. Self-hosted, application name `parliament-pulse-internal`
3. Application domain: `parliament-pulse.pages.dev`, path: `/?page=archive`
4. Identity provider: Google (one-time setup) or One-time PIN to email
5. Policy: include `Emails` → list the @qld.gov.au or @anthropic.com addresses you want
6. Save. Within 60s the URL prompts for SSO.

## What the app sees

Cloudflare Access injects a `CF-Access-Authenticated-User-Email` header on
each request. The Worker can validate the JWT in
`CF-Access-JWT-Assertion` for sensitive endpoints. The Service worker's
allowlist for static assets needs no changes — Access enforces at the edge.

## Backout

Disable the application from the Zero Trust dashboard. Pages and the Worker
keep functioning.
