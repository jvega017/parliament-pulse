// APH RSS proxy + archive Worker.
// Endpoints:
//   GET /rss?u=<absolute-aph-url>      proxied RSS with KV cache
//   GET /healthz                        liveness probe
//   GET /healthz/connectors             last connector-check rollup
//   GET /archive?from=&to=&kind=&q=&source_group=&limit=&offset=
//   GET /archive/analytics?terms=ai,cyber&from=&to=
//   GET /state                          composed signals+connectors+alerts+qons, provenance-as-schema
//   POST /digest/subscribe              {email, watchlists, attention_min}
//
// Cron triggers (configured in wrangler.toml):
//   */30 * * * *   poll APH feeds and upsert into D1
//   0 0 */14 * *   re-verify the 12 connector URLs every 14 days

import { APH_CONNECTORS, APH_ALLOWED_HOSTS, APH_BROWSER_HEADERS } from "./feeds";
import {
  checkConnectors,
  pollAndArchive,
  queryArchive,
  watchlistAnalytics,
  timelineArchive,
  watchlistTrend,
  listAlertRules,
  createAlertRule,
  deleteAlertRule,
  listAlertEvents,
  queryBills,
  queryQons,
  queryMembers,
  ingestMembers,
  backfillThreads,
  type Env,
} from "./archive";
import { ingestQons } from "./hansard";
import { sendDailyDigest } from "./digest";
import { buildState } from "./state";

const TTL_SECONDS = 300; // 5 minutes
// APH's edge WAF 403s non-browser user-agents, so the proxy presents the
// shared browser header profile (jurisdictions.json via ./feeds). The proxy
// is allowlisted to APH feed hosts only (ALLOWED_HOSTS), so this is not an
// open relay.
const ALLOWED_HOSTS = new Set<string>(APH_ALLOWED_HOSTS);

function corsHeaders(origin: string, allowed: string): HeadersInit {
  const list = allowed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const accepted = list.includes(origin) ? origin : null;
  const headers: HeadersInit = {
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
  if (accepted) headers["access-control-allow-origin"] = accepted;
  return headers;
}

const SECURITY_HEADERS: HeadersInit = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

function jsonResponse(body: unknown, status: number, extra: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, ...extra, "content-type": "application/json; charset=utf-8" },
  });
}

// KV-backed fixed-window rate limiter. Returns true when the request is
// allowed; false when the per-IP window budget has been exhausted.
// Key format: rl:{endpoint}:{ip}:{window_bucket}
// Race condition (GET then PUT) is intentional — over-counting is harmless
// and under-counting would be worse for a policy audience.
async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  endpoint: string,
  maxPerWindow: number,
  windowSec: number,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${endpoint}:${ip}:${bucket}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= maxPerWindow) return false;
  await kv.put(key, String(count + 1), { expirationTtl: windowSec * 2 });
  return true;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/healthz") {
      return jsonResponse({
        ok: true,
        version: "0.15.0",
        scoring_engine: "v1.1-deterministic",
        resend_wired: !!env.RESEND_API_KEY,
        digest_from: env.DIGEST_FROM_EMAIL ?? null,
      }, 200, cors);
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
      // Rate limit: 120 requests per minute per IP.
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkRateLimit(env.CACHE, ip, "archive", 120, 60))) {
        return jsonResponse({ error: "rate limit exceeded — max 120/min" }, 429, cors);
      }
      // Optional Cloudflare Access gate. Enable by setting REQUIRE_ACCESS = "true"
      // in wrangler.toml [vars] and creating a Cloudflare Zero Trust policy.
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

    if (url.pathname === "/archive/watchlist-trend") {
      try {
        const result = await watchlistTrend(env, url.searchParams);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/archive/watchlist-trend", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ days: [] }, 200, cors);
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
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkRateLimit(env.CACHE, ip, "bills", 60, 60))) {
        return jsonResponse({ error: "rate limit exceeded — max 60/min" }, 429, cors);
      }
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
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkRateLimit(env.CACHE, ip, "qons", 30, 60))) {
        return jsonResponse({ error: "rate limit exceeded — max 30/min" }, 429, cors);
      }
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
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkRateLimit(env.CACHE, ip, "members", 30, 60))) {
        return jsonResponse({ error: "rate limit exceeded — max 30/min" }, 429, cors);
      }
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

    // Admin: one-run-per-call backfill of the thread layer over already-archived
    // signals. Fails closed by default: disabled until ADMIN_TOKEN is set via
    // `wrangler secret put ADMIN_TOKEN`, then requires the matching x-admin-token
    // header. Call repeatedly (?limit=500 default) until `processed` is 0.
    if (url.pathname === "/admin/backfill-threads" && req.method === "POST") {
      if (!env.ADMIN_TOKEN || req.headers.get("x-admin-token") !== env.ADMIN_TOKEN) {
        return jsonResponse({ error: "admin token required" }, 401, cors);
      }
      try {
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "500", 10) || 500, 2000);
        const result = await backfillThreads(env, limit);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        console.error({ endpoint: "/admin/backfill-threads", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ error: "backfill failed" }, 503, cors);
      }
    }

    // Admin: run one archive poll on demand and return the per-feed results.
    // Same fail-closed ADMIN_TOKEN gate as backfill-threads. Exists so poll
    // failures can be diagnosed directly instead of waiting on cron log tails.
    if (url.pathname === "/admin/poll-now" && req.method === "POST") {
      if (!env.ADMIN_TOKEN || req.headers.get("x-admin-token") !== env.ADMIN_TOKEN) {
        return jsonResponse({ error: "admin token required" }, 401, cors);
      }
      try {
        const result = await pollAndArchive(env);
        return jsonResponse(result, 200, cors);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error({ endpoint: "/admin/poll-now", error: msg, ts: new Date().toISOString() });
        return jsonResponse({ error: "poll failed", detail: msg }, 503, cors);
      }
    }

    // Composed state view (signals + connectors + alerts + qons), provenance-as-schema.
    if (url.pathname === "/state") {
      if (req.method !== "GET") return jsonResponse({ error: "method not allowed" }, 405, cors);
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await checkRateLimit(env.CACHE, ip, "state", 60, 60))) {
        return jsonResponse({ error: "rate limit exceeded — max 60/min" }, 429, cors);
      }
      const cacheKey = "state:v1";
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            ...SECURITY_HEADERS,
            ...cors,
            "content-type": "application/json; charset=utf-8",
            "cache-control": `public, max-age=${TTL_SECONDS}`,
            "x-cache": "HIT",
          },
        });
      }
      try {
        const state = await buildState(env);
        const body = JSON.stringify(state);
        ctx.waitUntil(env.CACHE.put(cacheKey, body, { expirationTtl: TTL_SECONDS }));
        return new Response(body, {
          headers: {
            ...SECURITY_HEADERS,
            ...cors,
            "content-type": "application/json; charset=utf-8",
            "cache-control": `public, max-age=${TTL_SECONDS}`,
            "x-cache": "MISS",
          },
        });
      } catch (err) {
        console.error({ endpoint: "/state", error: err instanceof Error ? err.message : err, ts: new Date().toISOString() });
        return jsonResponse({ error: "state temporarily unavailable" }, 503, cors);
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
          ...SECURITY_HEADERS,
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
        headers: APH_BROWSER_HEADERS,
        redirect: "manual",
        cf: { cacheTtl: TTL_SECONDS, cacheEverything: true },
      });

      let redirectCount = 0;
      while (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("Location");
        if (!location) {
          return jsonResponse({ error: "upstream redirect missing location" }, 502, cors);
        }
        const redirected = new URL(location, upstream.url || parsed.toString());
        if (redirected.protocol !== "https:" || !ALLOWED_HOSTS.has(redirected.hostname)) {
          return jsonResponse({ error: "upstream redirect not allowed", host: redirected.hostname }, 502, cors);
        }
        redirectCount += 1;
        if (redirectCount > 5) {
          return jsonResponse({ error: "upstream redirect limit exceeded" }, 502, cors);
        }
        upstream = await fetch(redirected.toString(), {
          headers: APH_BROWSER_HEADERS,
          redirect: "manual",
          cf: { cacheTtl: TTL_SECONDS, cacheEverything: true },
        });
      }
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
        ...SECURITY_HEADERS,
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
