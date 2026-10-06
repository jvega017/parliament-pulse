// /rss proxy hardening (WK-02: SEC-01, SEC-02, SEC-03).
//
// The proxy used to accept any https URL on an allowed HOST, which made it a
// general relay for every page on aph.gov.au (and, while www.youtube.com sat
// in allowedHosts, for YouTube). It now accepts only the exact feed URLs
// configured in jurisdictions.json (APH_FEEDS). Redirects are still re-checked
// against the host allowlist, because APH feeds legitimately redirect between
// its own hosts.

export const RSS_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/** Canonical form used for both the allowlist comparison and the cache key. */
export function canonicalFeedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  u.hash = "";
  return u.toString();
}

export function buildFeedAllowlist(feedUrls: string[]): Set<string> {
  const out = new Set<string>();
  for (const f of feedUrls) {
    const c = canonicalFeedUrl(f);
    if (c) out.add(c);
  }
  return out;
}

/**
 * Cache key with the query string removed, so a caller cannot mint unlimited
 * cache entries (and upstream fetches) with ?bust=N. Configured APH feeds
 * carry no query string (ParlInfo uses ;-separated matrix params in the path).
 */
export function rssCacheKey(canonical: string): string {
  const u = new URL(canonical);
  return `rss:${u.origin}${u.pathname}`;
}

export function isXmlContentType(ct: string | null): boolean {
  if (!ct) return false;
  const lower = ct.toLowerCase();
  return lower.includes("xml") || lower.includes("rss");
}

export class BodyTooLargeError extends Error {
  constructor() {
    super("upstream body exceeds cap");
  }
}

/**
 * Reads a response body as text, aborting once it passes maxBytes. With a
 * signal (0.16.9), an abort during the read cancels the reader and throws,
 * so a body that stops arriving cannot hold the caller past its deadline.
 * The runtime also errors the body stream when the fetch's own signal
 * aborts; the explicit cancel does not depend on that.
 */
export async function readCappedText(
  res: Response,
  maxBytes: number = RSS_MAX_BYTES,
  signal?: AbortSignal,
): Promise<string> {
  const declared = parseInt(res.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    try { await res.body?.cancel(); } catch { /* ignore */ }
    throw new BodyTooLargeError();
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const onAbort = () => { reader.cancel().catch(() => { /* ignore */ }); };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    return await readAll(reader, maxBytes, signal);
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

function abortedError(signal: AbortSignal): Error {
  const r: unknown = signal.reason;
  if (r instanceof Error) return r;
  const e = new Error("The operation was aborted");
  e.name = "AbortError";
  return e;
}

async function readAll(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    // A cancelled reader resolves done: true; that is an abort, not the end
    // of the body, so the partial text is never returned as if complete.
    if (signal?.aborted) throw abortedError(signal);
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    joined.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(joined);
}

/** Per-request deadline for scheduled upstream fetches (0.16.9). */
export const UPSTREAM_TIMEOUT_MS = 8_000;

export type DeadlineFetch =
  | { ok: true; status: number; headers: Headers; text: string | null }
  | { ok: false; status: number; headers: Headers | null; error: string };

/**
 * One upstream GET with a deadline that covers the WHOLE exchange (0.16.9):
 * headers and, when readBody is set, the body, read through readCappedText.
 * 0.16.8 cleared its abort timer once headers arrived, so a body APH stopped
 * sending mid-response held res.text() with no limit and the scheduled run
 * never finished (production, from 30 Sep 2026). An unread body (a non-ok
 * status, or readBody false) is cancelled rather than left open for the
 * runtime to drain. Never throws. The error is a fixed
 * string ("fetch timed out", "fetch failed", "body too large" or
 * "HTTP <status>"); the raw message goes to the log only (SEC-11).
 */
export async function fetchWithDeadline(
  url: string,
  init: RequestInit,
  opts: { timeoutMs?: number; readBody: boolean; maxBytes?: number; logLabel: string },
): Promise<DeadlineFetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS);
  let headers: Headers | null = null;
  let status = 0;
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    headers = res.headers;
    status = res.status;
    if (!res.ok || !opts.readBody) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return res.ok
        ? { ok: true, status, headers, text: null }
        : { ok: false, status, headers, error: `HTTP ${status}` };
    }
    const text = await readCappedText(res, opts.maxBytes ?? RSS_MAX_BYTES, controller.signal);
    return { ok: true, status, headers, text };
  } catch (err) {
    console.warn(opts.logLabel, url, err instanceof Error ? err.message : err);
    const error = controller.signal.aborted
      ? "fetch timed out"
      : err instanceof BodyTooLargeError ? "body too large" : "fetch failed";
    // status 0: no usable response (the stored feed_health status for a
    // failed fetch has always been 0).
    return { ok: false, status: 0, headers, error };
  } finally {
    clearTimeout(timer);
  }
}
