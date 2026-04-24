// APH RSS proxy — Cloudflare Worker.
// Exposes GET /rss?u=<absolute-aph-url> and returns the upstream XML with CORS headers.
// Caches in Workers KV for TTL_SECONDS to stay within APH acceptable-use bounds.

export interface Env {
  CACHE: KVNamespace;
  ALLOWED_ORIGINS: string;
}

const TTL_SECONDS = 300; // 5 minutes
const USER_AGENT =
  "parliament-pulse/0.1 (+https://github.com/jvega019/parliament-pulse)";

const ALLOWED_HOSTS = new Set<string>([
  "www.aph.gov.au",
  "aph.gov.au",
  "parlinfo.aph.gov.au",
]);

function corsHeaders(origin: string, allowed: string): HeadersInit {
  const list = allowed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const accepted = list.includes(origin) ? origin : list[0] ?? "*";
  return {
    "access-control-allow-origin": accepted,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  extra: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...extra, "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/healthz") {
      return jsonResponse({ ok: true }, 200, cors);
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
      return jsonResponse(
        { error: "host not allowed", host: parsed.hostname },
        403,
        cors,
      );
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
        {
          error: "upstream fetch failed",
          reason: err instanceof Error ? err.message : "unknown",
        },
        502,
        cors,
      );
    }

    if (!upstream.ok) {
      return jsonResponse(
        { error: "upstream status", status: upstream.status },
        502,
        cors,
      );
    }

    const body = await upstream.text();
    // Fire and forget: do not block the response on the KV write.
    await env.CACHE.put(cacheKey, body, { expirationTtl: TTL_SECONDS });

    return new Response(body, {
      headers: {
        ...cors,
        "content-type": "application/xml; charset=utf-8",
        "cache-control": `public, max-age=${TTL_SECONDS}`,
        "x-cache": "MISS",
      },
    });
  },
} satisfies ExportedHandler<Env>;
