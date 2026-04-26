// Archive ingest + query layer for Parliament Pulse.
// Cron pollers write into D1; the /archive HTTP endpoint reads from it.

import { APH_FEEDS, type FeedMeta, sourceGroupFor } from "./feeds";

export interface Env {
  CACHE: KVNamespace;
  ALLOWED_ORIGINS: string;
  ARCHIVE: D1Database;
  REQUIRE_ACCESS?: string;
}

export interface ArchiveRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_url: string;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  last_seen_at: string;
}

const USER_AGENT =
  "parliament-pulse/0.10 (+https://github.com/jvega019/parliament-pulse)";

// Naive RSS parser tuned for APH RSS 2.0 + Atom. Pure regex (no DOMParser
// in workers runtime). Returns at most 50 items per feed.
function parseFeed(xml: string, feed: FeedMeta): Array<{
  title: string;
  link: string;
  pubDate: string | null;
  guid: string;
}> {
  const out: Array<{ title: string; link: string; pubDate: string | null; guid: string }> = [];
  const itemRegex = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches.slice(0, 50)) {
    const title = pluck(block, "title");
    let link = pluck(block, "link");
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href="([^"]+)"/);
      if (hrefMatch && hrefMatch[1]) link = hrefMatch[1];
    }
    const pubText = pluck(block, "pubDate") ?? pluck(block, "updated") ?? pluck(block, "published");
    const guid = pluck(block, "guid") ?? link ?? `${feed.url}#${title}`;
    if (!title || !link) continue;
    out.push({
      title: title.trim(),
      link: link.trim(),
      pubDate: pubText ? new Date(pubText.trim()).toISOString() : null,
      guid: guid.trim(),
    });
  }
  return out;
}

function pluck(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m || !m[1]) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export async function pollAndArchive(env: Env): Promise<{
  perFeed: Array<{ feed: string; ok: boolean; new: number; seen: number; error?: string }>;
}> {
  const now = new Date().toISOString();
  const perFeed: Array<{ feed: string; ok: boolean; new: number; seen: number; error?: string }> = [];

  // Fetch all feeds concurrently with an 8-second per-feed timeout to prevent
  // a slow upstream from blocking the entire cron. Results are collected and
  // inserted into D1 after all fetches complete.
  const FETCH_TIMEOUT_MS = 8_000;
  type FetchOk = { ok: true; meta: FeedMeta; xml: string };
  type FetchErr = { ok: false; feedUrl: string; new: 0; seen: 0; error: string };
  const feedResults = await Promise.all(
    APH_FEEDS.map(async (feedMeta): Promise<FetchOk | FetchErr> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(feedMeta.url, {
          signal: controller.signal,
          headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml" },
          cf: { cacheTtl: 60, cacheEverything: true },
        }).finally(() => clearTimeout(timer));
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          console.warn("APH returned 429", { feed: feedMeta.url, retryAfter });
          return { ok: false, feedUrl: feedMeta.url, new: 0, seen: 0, error: "HTTP 429 Too Many Requests" };
        }
        if (!res.ok) {
          return { ok: false, feedUrl: feedMeta.url, new: 0, seen: 0, error: `HTTP ${res.status}` };
        }
        const xml = await res.text();
        return { ok: true, meta: feedMeta, xml };
      } catch (err) {
        return {
          ok: false, feedUrl: feedMeta.url, new: 0, seen: 0,
          error: err instanceof Error ? err.message : "unknown",
        };
      }
    }),
  );

  for (const feedResult of feedResults) {
    if (!feedResult.ok) {
      perFeed.push({ feed: feedResult.feedUrl, ok: false, new: 0, seen: 0, error: feedResult.error });
      continue;
    }
    const { meta: feed, xml } = feedResult;
    try {
      const items = parseFeed(xml, feed);
      let added = 0;
      let updated = 0;
      const sourceGroup = sourceGroupFor(feed.label);
      for (const item of items) {
        const r = await env.ARCHIVE.prepare(
          `INSERT INTO signals (guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(guid) DO UPDATE SET last_seen_at = excluded.last_seen_at, title = excluded.title`,
        )
          .bind(
            item.guid,
            item.title,
            item.link,
            item.pubDate,
            feed.url,
            feed.label,
            sourceGroup,
            feed.kind,
            now,
            now,
          )
          .run();
        if (r.meta?.changes && r.meta.changes > 0) {
          // Cannot distinguish insert vs update from D1 changes count without
          // a SELECT, so we count both and surface the total.
          if (r.meta.last_row_id && r.meta.last_row_id > 0) added += 1;
          else updated += 1;
        }
      }
      perFeed.push({ feed: feed.url, ok: true, new: added, seen: items.length });
    } catch (err) {
      perFeed.push({
        feed: feed.url,
        ok: false,
        new: 0,
        seen: 0,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return { perFeed };
}

export async function checkConnectors(env: Env, urls: string[]): Promise<{
  results: Array<{ url: string; ok: boolean; status: number; error?: string }>;
}> {
  const now = new Date().toISOString();
  const results: Array<{ url: string; ok: boolean; status: number; error?: string }> = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        cf: { cacheTtl: 0 },
      });
      const ok = res.ok;
      results.push({ url, ok, status: res.status });
      await env.ARCHIVE.prepare(
        `INSERT INTO connector_checks (url, status, ok, checked_at, error) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(url, res.status, ok ? 1 : 0, now, ok ? null : `HTTP ${res.status}`)
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      results.push({ url, ok: false, status: 0, error: msg });
      await env.ARCHIVE.prepare(
        `INSERT INTO connector_checks (url, status, ok, checked_at, error) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(url, 0, 0, now, msg)
        .run();
    }
  }
  return { results };
}

function escapeLike(s: string): string {
  // Escape SQLite LIKE special chars so user input is treated as literal.
  return s.replace(/[%_\\]/g, "\\$&");
}

export async function queryArchive(env: Env, params: URLSearchParams): Promise<{
  rows: ArchiveRow[];
  total: number;
  has_more: boolean;
}> {
  const from = params.get("from");
  const to = params.get("to");
  const kind = params.get("kind");
  const group = params.get("source_group");
  const q = params.get("q");
  const limit = Math.min(parseInt(params.get("limit") ?? "100", 10) || 100, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (from) { where.push("pub_date >= ?"); binds.push(from); }
  if (to) { where.push("pub_date <= ?"); binds.push(to); }
  if (kind) { where.push("kind = ?"); binds.push(kind); }
  if (group) { where.push("source_group = ?"); binds.push(group); }
  if (q) {
    where.push("LOWER(title) LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(q.toLowerCase())}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalStmt = await env.ARCHIVE.prepare(
    `SELECT COUNT(*) AS n FROM signals ${whereSql}`,
  )
    .bind(...binds)
    .first<{ n: number }>();
  const total = totalStmt?.n ?? 0;

  const rowsRes = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, feed_url, feed_label, source_group, kind, first_seen_at, last_seen_at
       FROM signals
       ${whereSql}
       ORDER BY COALESCE(pub_date, first_seen_at) DESC
       LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<ArchiveRow>();

  return { rows: rowsRes.results ?? [], total, has_more: total > offset + limit };
}

export async function watchlistAnalytics(env: Env, params: URLSearchParams): Promise<{
  series: Array<{ term: string; count: number; last_seen: string | null }>;
}> {
  const from = params.get("from");
  const to = params.get("to");
  const termsCsv = params.get("terms") ?? "";
  const terms = termsCsv.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return { series: [] };

  const uniqueTerms = [...new Set(terms)];
  const series: Array<{ term: string; count: number; last_seen: string | null }> = [];
  for (const term of uniqueTerms) {
    const where: string[] = ["LOWER(title) LIKE ? ESCAPE '\\'"];
    const binds: unknown[] = [`%${escapeLike(term)}%`];
    if (from) { where.push("pub_date >= ?"); binds.push(from); }
    if (to) { where.push("pub_date <= ?"); binds.push(to); }
    const r = await env.ARCHIVE.prepare(
      `SELECT COUNT(*) AS n, MAX(pub_date) AS last_seen FROM signals WHERE ${where.join(" AND ")}`,
    )
      .bind(...binds)
      .first<{ n: number; last_seen: string | null }>();
    series.push({ term, count: r?.n ?? 0, last_seen: r?.last_seen ?? null });
  }
  return { series };
}
