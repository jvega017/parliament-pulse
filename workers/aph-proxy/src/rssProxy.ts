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

/** Reads a response body as text, aborting once it passes maxBytes. */
export async function readCappedText(res: Response, maxBytes: number = RSS_MAX_BYTES): Promise<string> {
  const declared = parseInt(res.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    try { await res.body?.cancel(); } catch { /* ignore */ }
    throw new BodyTooLargeError();
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
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
