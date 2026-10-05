// KV-backed fixed-window rate limiter (WK-02: ARCH-08, PERF-01).
//
// Returns true when the request is allowed; false when the per-IP window
// budget has been exhausted. Key format: rl:{endpoint}:{ip}:{window_bucket}
//
// Race condition: the GET and the PUT are not atomic, and the PUT now runs in
// ctx.waitUntil off the request path. Concurrent requests in the same window
// can each read the same count, so the limiter UNDER-counts under a burst: it
// is a soft ceiling against casual abuse, not an exact quota. Anything that
// needs an exact quota must use a Durable Object or the Workers rate-limiting
// binding instead.
//
// Availability: the limiter FAILS OPEN. KV is a convenience guard here, so a
// KV outage (get or put throwing, or put rejecting later) must never turn a
// read endpoint into a 500. Failures are logged without the client IP.

export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

function logFailure(endpoint: string, stage: string, err: unknown): void {
  try {
    console.warn({
      event: "rate_limit.fail_open",
      endpoint,
      stage,
      error: err instanceof Error ? err.message : String(err),
      ts: new Date().toISOString(),
    });
  } catch {
    // Logging must never be the thing that throws.
  }
}

/** The Workers Rate Limiting binding surface this module calls. */
export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * The binding for a per-minute budget, by name: RL_30, RL_60 or RL_120
 * (wrangler.toml [[ratelimits]], 0.16.3). Undefined when not declared, as in
 * `wrangler dev --env dev` and the tests, which then use the KV limiter.
 */
export function rateLimitBinding(env: object, maxPerMinute: number): RateLimiterBinding | undefined {
  const b = (env as Record<string, unknown>)[`RL_${maxPerMinute}`];
  return b && typeof (b as RateLimiterBinding).limit === "function" ? (b as RateLimiterBinding) : undefined;
}

// 0.16.3 (security review 5 Oct 2026): measured live, 36 back-to-back GETs to
// /healthz/deep (limit 30) all got through, because every request in the
// burst read the same KV count before any write landed. When a Rate Limiting
// binding is passed, it decides instead: its counter is held by Cloudflare
// per location, not read back from KV, and costs no KV write per request.
// The binding also fails open: if limit() throws, the request is allowed.
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  endpoint: string,
  maxPerWindow: number,
  windowSec: number,
  ctx?: WaitUntilContext,
  binding?: RateLimiterBinding,
): Promise<boolean> {
  if (binding) {
    try {
      const { success } = await binding.limit({ key: `${endpoint}:${ip}` });
      return success;
    } catch (err) {
      logFailure(endpoint, "binding", err);
      return true;
    }
  }
  try {
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const key = `rl:${endpoint}:${ip}:${bucket}`;
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= maxPerWindow) return false;
    const write = Promise.resolve()
      .then(() => kv.put(key, String(count + 1), { expirationTtl: windowSec * 2 }))
      .catch((err) => logFailure(endpoint, "put", err));
    if (ctx) ctx.waitUntil(write);
    return true;
  } catch (err) {
    logFailure(endpoint, "get", err);
    return true;
  }
}

/** Client IP for rate-limit keys only; never logged. */
export function clientIp(req: Request): string {
  try {
    return req.headers.get("cf-connecting-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}
