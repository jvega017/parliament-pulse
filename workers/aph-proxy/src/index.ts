// APH RSS proxy + archive Worker.
// Endpoints:
//   GET /rss?u=<absolute-aph-url>      proxied RSS with KV cache
//   GET /healthz                        liveness probe
//   GET /healthz/connectors             last connector-check rollup
//   GET /archive?from=&to=&kind=&q=&source_group=&limit=&offset=
//   GET /archive/analytics?terms=ai,cyber&from=&to=
//   POST /digest/subscribe              {email, watchlists, attention_min}
//
// Cron triggers (configured in wrangler.toml):
//   */30 * * * *   poll APH feeds and upsert into D1
//   0 0 */14 * *   re-verify the 12 connector URLs every 14 days

import { APH_CONNECTORS } from "./feeds";
import {
  checkConnectors,
  pollAndArchive,
  queryArchive,
  watchlistAnalytics,
  type Env,
} from "./archive";
import { ingestQons } from "./hansard";
import { sendDailyDigest } from "./digest";

const TTL_SECONDS = 300; // 5 minutes
const USER_AGENT =
  "parliament-pulse/0.10 (+https://github.com/jvega019/parliament-pulse)";

const ALLOWED_HOSTS = new Set<string>([
  "www.aph.gov.au",
  "aph.gov.au",
  "parlinfo.aph.gov.au",
  "parlwork.aph.gov.au",
  "www.youtube.com",
]);

function corsHeaders(origin: string, allowed: string): HeadersInit {
  const list = allowed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const accepted = list.includes(origin) ? origin : list[0] ?? "*";
  return {
    "access-control-allow-origin": accepted,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, extra: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...extra, "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/healthz") {
      return jsonResponse({ ok: true, version: "0.10.0" }, 200, cors);
    }

    if (url.pathname === "/healthz/connectors") {
      try {
        const rows = await env.ARCHIVE.prepare(
          `SELECT url, MAX(checked_at) AS checked_at, ok, status, error
             FROM connector_checks
             GROUP BY url
             ORDER BY url`,
        ).all();
        return jsonResponse({ ok: true, connectors: rows.results ?? [] }, 200, cors);
      } catch (err) {
        return jsonResponse(
          { ok: false, reason: err instanceof Error ? err.message : "d1 unavailable" },
          200,
          cors,
        );
      }
    }

    if (url.pathname === "/archive") {
      // If the env has REQUIRE_ACCESS=true, demand a Cloudflare Access JWT
      // header. Cloudflare Access injects this when a Zero Trust application
      // protects this Worker route. We do NOT verify the JWT signature here
      // (Access is validating at the edge); we only require the header so
      // direct curl access without Access still bounces.
      const requireAccess = (env as unknown as { REQUIRE_ACCESS?: string }).REQUIRE_ACCESS === "true";
      if (requireAccess && !req.headers.get("cf-access-jwt-assertion")) {
        return jsonResponse({ error: "access required" }, 401, cors);
      }
      try {
        const result = await queryArchive(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : "archive query failed" },
          500,
          cors,
        );
      }
    }

    if (url.pathname === "/archive/analytics") {
      try {
        const result = await watchlistAnalytics(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : "analytics failed" },
          500,
          cors,
        );
      }
    }

    if (url.pathname === "/digest/subscribe" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          email?: string;
          watchlists?: string;
          attention_min?: string;
        };
        if (!body.email || !/^[^@]+@[^@]+\.[^@]+$/.test(body.email)) {
          return jsonResponse({ error: "valid email required" }, 400, cors);
        }
        await env.ARCHIVE.prepare(
          `INSERT INTO digest_subscribers (email, watchlists, attention_min, created_at, active)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(email) DO UPDATE SET watchlists = excluded.watchlists,
                                            attention_min = excluded.attention_min,
                                            active = 1`,
        )
          .bind(
            body.email,
            body.watchlists ?? "",
            body.attention_min ?? "high",
            new Date().toISOString(),
          )
          .run();
        return jsonResponse({ ok: true }, 200, cors);
      } catch (err) {
        return jsonResponse(
          { error: err instanceof Error ? err.message : "subscribe failed" },
          500,
          cors,
        );
      }
    }

    if (url.pathname !== "/rss") {
      return jsonResponse({ error: "not found" }, 404, cors);
    }

    if (req.method !== "GET") {
      return jsonResponse({ error: "method not allowed" }, 405, cors);
    }

    const target = url.searchParams.get("u");
    if (!target) {
      return jsonResponse({ error: "missing required query param: u" }, 400, cors);
    }

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return jsonResponse({ error: "invalid url" }, 400, cors);
    }

    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
      return jsonResponse({ error: "host not allowed", host: parsed.hostname }, 403, cors);
    }

    const cacheKey = `rss:${parsed.toString()}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          ...cors,
          "content-type": "application/xml; charset=utf-8",
          "cache-control": `public, max-age=${TTL_SECONDS}`,
          "x-cache": "HIT",
        },
      });
    }

    let upstream: Response;
    try {
      upstream = await fetch(parsed.toString(), {
        headers: {
          accept: "application/rss+xml, application/xml, text/xml, */*",
          "user-agent": USER_AGENT,
        },
        cf: { cacheTtl: TTL_SECONDS, cacheEverything: true },
      });
    } catch (err) {
      return jsonResponse(
        { error: "upstream fetch failed", reason: err instanceof Error ? err.message : "unknown" },
        502,
        cors,
      );
    }

    if (!upstream.ok) {
      return jsonResponse({ error: "upstream status", status: upstream.status }, 502, cors);
    }

    const body = await upstream.text();
    ctx.waitUntil(env.CACHE.put(cacheKey, body, { expirationTtl: TTL_SECONDS }));

    return new Response(body, {
      headers: {
        ...cors,
        "content-type": "application/xml; charset=utf-8",
        "cache-control": `public, max-age=${TTL_SECONDS}`,
        "x-cache": "MISS",
      },
    });
  },

  // Cron handler. The cron schedule is wired in wrangler.toml; this handler
  // dispatches based on the schedule string.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "*/30 * * * *") {
      ctx.waitUntil(pollAndArchive(env).then((r) => {
        console.log("archive poll", JSON.stringify(r));
      }));
      return;
    }
    if (event.cron === "0 0 */14 * *") {
      ctx.waitUntil(checkConnectors(env, APH_CONNECTORS).then((r) => {
        console.log("connector check", JSON.stringify(r));
      }));
      return;
    }
    if (event.cron === "0 19 * * *") {
      // 19:00 UTC = 05:00 AEST next day. QON ingest + digest delivery.
      ctx.waitUntil(ingestQons(env).then((r) => {
        console.log("qon ingest", JSON.stringify(r));
      }));
      ctx.waitUntil(sendDailyDigest(env).then((r) => {
        console.log("digest", JSON.stringify(r));
      }));
      return;
    }
  },
} satisfies ExportedHandler<Env>;
