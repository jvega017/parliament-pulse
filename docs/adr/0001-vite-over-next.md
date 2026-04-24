# ADR 0001: Vite over Next.js for the web app

**Status**: Accepted, 2026-04-24

## Context

Parliament Pulse is a client-rendered dashboard. There is no SEO requirement, no server-rendered content, no per-route data loading that benefits from framework conventions. Users authenticate once (future) and hold a persistent session; every page interaction is state-local.

## Decision

Use Vite 6 with React 18 and TypeScript. Deploy as static assets to Cloudflare Pages. Keep all dynamic behaviour in the SPA and behind the `aph-proxy` Worker.

## Consequences

- Build is a single `vite build` pass; output is static `dist/`.
- No Next.js runtime tax; Pages deploy is free and instantaneous.
- Lose Next's `app router` ergonomics; no issue for ten pages with simple client routing.
- Easier to migrate later to any other host (Netlify, S3) without vendor coupling.

## Rejected alternatives

- **Next.js**: pays for SSR and route loaders we do not use. Deploy to Cloudflare requires the `@cloudflare/next-on-pages` adapter, which is still beta for App Router features.
- **Remix**: good framework, same argument as Next: we are client-only.
- **Plain HTML + JSX via Babel**: what we had. Unmaintainable at scale, no typing, no lint.
