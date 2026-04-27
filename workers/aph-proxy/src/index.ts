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
  timelineArchive,
  listAlertRules,
  createAlertRule,
  deleteAlertRule,
  listAlertEvents,
  queryBills,
  queryQons,
  queryMembers,
  ingestMembers,
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
      return jsonResponse({ ok: true, version: "0.12.0", scoring_engine: "v1.1-deterministic" }, 200, cors);
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
      const requireAccess = env.REQUIRE_ACCESS === "true";
      if (requireAccess && !req.headers.get("cf-access-jwt-assertion")) {
        return jsonResponse({ error: "access required" }, 401, cors);
      }
      try {
        const result = await queryArchive(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/archive", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ error: "archive temporarily unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/archive/analytics") {
      try {
        const result = await watchlistAnalytics(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/archive/analytics", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ error: "analytics temporarily unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/archive/timeline") {
      try {
        const result = await timelineArchive(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/archive/timeline", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ error: "timeline temporarily unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/digest/subscribe" && req.method === "POST") {
      // Simple per-IP rate limit: max 3 subscribe attempts per minute via KV.
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      const rlKey = `ratelimit:sub:${ip}`;
      const rlRaw = await env.CACHE.get(rlKey);
      const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0;
      if (rlCount >= 3) {
        return jsonResponse({ error: "too many requests, try again in a minute" }, 429, cors);
      }
      await env.CACHE.put(rlKey, String(rlCount + 1), { expirationTtl: 60 });

      try {
        const body = (await req.json()) as {
          email?: string;
          watchlists?: string;
          attention_min?: string;
        };
        if (!body.email || !/^[^@]+@[^@]+\.[^@]+$/.test(body.email)) {
          return jsonResponse({ error: "valid email required" }, 400, cors);
        }
        // Deduplicate watchlist terms on insert.
        const watchlists = body.watchlists
          ? [...new Set(body.watchlists.split(",").map((t) => t.trim()).filter(Boolean))].join(",")
          : "";
        await env.ARCHIVE.prepare(
          `INSERT INTO digest_subscribers (email, watchlists, attention_min, created_at, active)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(email) DO UPDATE SET watchlists = excluded.watchlists,
                                            attention_min = excluded.attention_min,
                                            active = 1`,
        )
          .bind(body.email, watchlists, body.attention_min ?? "high", new Date().toISOString())
          .run();
        return jsonResponse({ ok: true }, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/digest/subscribe", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ error: "subscribe temporarily unavailable" }, 503, cors);
      }
    }

    // Alert rules ----------------------------------------------------------
    if (url.pathname === "/alerts") {
      if (req.method === "GET") {
        try {
          const result = await listAlertRules(env);
          return jsonResponse(result, 200, cors);
        } catch (err) {
          return jsonResponse({ error: "alerts unavailable" }, 503, cors);
        }
      }
      if (req.method === "POST") {
        try {
          const body = (await req.json()) as { name?: string; terms?: string; attention_min?: string; source_group?: string; kind?: string };
          if (!body.name?.trim()) return jsonResponse({ error: "name required" }, 400, cors);
          const result = await createAlertRule(env, { ...body, name: body.name! });
          return jsonResponse(result, 201, cors);
        } catch (err) {
          return jsonResponse({ error: "create failed" }, 503, cors);
        }
      }
      return jsonResponse({ error: "method not allowed" }, 405, cors);
    }

    if (/^\/alerts\/(\d+)$/.test(url.pathname)) {
      const id = parseInt(url.pathname.split("/")[2] ?? "0", 10);
      if (req.method === "DELETE") {
        try {
          await deleteAlertRule(env, id);
          return jsonResponse({ ok: true }, 200, cors);
        } catch (err) {
          return jsonResponse({ error: "delete failed" }, 503, cors);
        }
      }
      return jsonResponse({ error: "method not allowed" }, 405, cors);
    }

    // Bills (archive view — kind=digest) ----------------------------------------
    if (url.pathname === "/bills") {
      try {
        const result = await queryBills(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/bills", error: err instanceof Error ? err.message : err });
        return jsonResponse({ error: "bills temporarily unavailable" }, 503, cors);
      }
    }

    // QONs -----------------------------------------------------------------------
    if (url.pathname === "/qons") {
      try {
        const result = await queryQons(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/qons", error: err instanceof Error ? err.message : err });
        return jsonResponse({ error: "qons temporarily unavailable" }, 503, cors);
      }
    }

    // Members --------------------------------------------------------------------
    if (url.pathname === "/members") {
      try {
        const result = await queryMembers(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/members", error: err instanceof Error ? err.message : err });
        return jsonResponse({ error: "members temporarily unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/alerts/events") {
      try {
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
        const result = await listAlertEvents(env, limit);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        return jsonResponse({ error: "events unavailable" }, 503, cors);
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
      // Re-derive member roster from senators_details archive on every RSS poll.
      ctx.waitUntil(ingestMembers(env).then((r) => {
        console.log("member ingest", JSON.stringify(r));
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
