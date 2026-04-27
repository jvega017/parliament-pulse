// Archive ingest + query layer for Parliament Pulse.
// Cron pollers write into D1; the /archive HTTP endpoint reads from it.

import { APH_FEEDS, type FeedMeta, sourceGroupFor } from "./feeds";
import { scoreForArchive, matchAlertRules, type AlertRule, type NewItem } from "./workerScoring";

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
  attention: string | null;
  confidence: number | null;
  entities_json: string | null;
  scoring_explanation: string | null;
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
  perFeed: Array<{ feed: string; ok: boolean; new: number; seen: number; dedup: number; error?: string }>;
}> {
  const now = new Date().toISOString();
  const perFeed: Array<{ feed: string; ok: boolean; new: number; seen: number; dedup: number; error?: string }> = [];

  // Fetch all feeds concurrently with an 8-second per-feed timeout to prevent
  // a slow upstream from blocking the entire cron. Results are collected and
  // inserted into D1 after all fetches complete.
  const FETCH_TIMEOUT_MS = 8_000;
  type FetchOk = { ok: true; meta: FeedMeta; xml: string };
  type FetchErr = { ok: false; feedUrl: string; new: 0; seen: 0; dedup: 0; error: string };
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
          return { ok: false, feedUrl: feedMeta.url, new: 0, seen: 0, dedup: 0, error: "HTTP 429 Too Many Requests" };
        }
        if (!res.ok) {
          return { ok: false, feedUrl: feedMeta.url, new: 0, seen: 0, dedup: 0, error: `HTTP ${res.status}` };
        }
        const xml = await res.text();
        return { ok: true, meta: feedMeta, xml };
      } catch (err) {
        return {
          ok: false, feedUrl: feedMeta.url, new: 0, seen: 0, dedup: 0,
          error: err instanceof Error ? err.message : "unknown",
        };
      }
    }),
  );

  // In-poll title deduplication: tracks normalised title hashes across all feeds
  // in this cron run to prevent inserting different-GUID items with identical titles.
  const seenTitleHashes = new Set<string>();

  function normTitle(t: string): string {
    return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  }

  for (const feedResult of feedResults) {
    if (!feedResult.ok) {
      perFeed.push({ feed: feedResult.feedUrl, ok: false, new: 0, seen: 0, dedup: 0, error: feedResult.error });
      continue;
    }
    const { meta: feed, xml } = feedResult;
    try {
      const items = parseFeed(xml, feed);
      let added = 0;
      let updated = 0;
      let dedupSkipped = 0;
      const sourceGroup = sourceGroupFor(feed.label);
      const nowDate = new Date(now);
      for (const item of items) {
        const titleHash = normTitle(item.title);
        if (seenTitleHashes.has(titleHash)) { dedupSkipped += 1; continue; }
        seenTitleHashes.add(titleHash);
        const scored = scoreForArchive(item.title, feed.kind, item.pubDate, nowDate);
        const r = await env.ARCHIVE.prepare(
          `INSERT INTO signals
             (guid, title, link, pub_date, feed_url, feed_label, source_group, kind,
              first_seen_at, last_seen_at,
              attention, confidence, score_json, entities_json, scoring_explanation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(guid) DO UPDATE SET
             last_seen_at        = excluded.last_seen_at,
             title               = excluded.title,
             attention           = excluded.attention,
             confidence          = excluded.confidence,
             score_json          = excluded.score_json,
             entities_json       = excluded.entities_json,
             scoring_explanation = excluded.scoring_explanation`,
        )
          .bind(
            item.guid, item.title, item.link, item.pubDate,
            feed.url, feed.label, sourceGroup, feed.kind,
            now, now,
            scored.attention, scored.confidence,
            scored.scoreJson, scored.entitiesJson, scored.explanation,
          )
          .run();
        if (r.meta?.changes && r.meta.changes > 0) {
          if (r.meta.last_row_id && r.meta.last_row_id > 0) added += 1;
          else updated += 1;
        }
      }
      perFeed.push({ feed: feed.url, ok: true, new: added, seen: items.length, dedup: dedupSkipped });
    } catch (err) {
      perFeed.push({
        feed: feed.url, ok: false, new: 0, seen: 0, dedup: 0,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // Evaluate alert rules against items seen in this poll window.
  // Watermark stored in KV prevents re-firing on re-poll of the same items.
  try {
    const wmKey = "alert:watermark";
    const watermark = (await env.CACHE.get(wmKey)) ?? new Date(0).toISOString();
    const rulesRes = await env.ARCHIVE.prepare(
      `SELECT id, name, terms, attention_min, source_group, kind, active FROM alert_rules WHERE active = 1`,
    ).all<AlertRule>();
    const rules = rulesRes.results ?? [];
    if (rules.length > 0) {
      const newItemsRes = await env.ARCHIVE.prepare(
        `SELECT guid, title, link, kind, source_group, attention FROM signals WHERE first_seen_at > ? AND first_seen_at <= ?`,
      ).bind(watermark, now).all<NewItem>();
      const newItems = newItemsRes.results ?? [];
      if (newItems.length > 0) {
        const events = matchAlertRules(rules, newItems, now);
        for (const ev of events) {
          // INSERT OR IGNORE: UNIQUE index on (rule_id, signal_guid) prevents duplication.
          await env.ARCHIVE.prepare(
            `INSERT OR IGNORE INTO alert_events (rule_id, signal_guid, fired_at, title, link, attention)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(ev.rule_id, ev.signal_guid, ev.fired_at, ev.title, ev.link, ev.attention).run();
        }
      }
    }
    await env.CACHE.put(wmKey, now, { expirationTtl: 60 * 60 * 24 * 7 });
  } catch (alertErr) {
    console.warn("alert evaluation failed", alertErr instanceof Error ? alertErr.message : alertErr);
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

  const attention = params.get("attention");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (from) { where.push("pub_date >= ?"); binds.push(from); }
  if (to) { where.push("pub_date <= ?"); binds.push(to); }
  if (kind) { where.push("kind = ?"); binds.push(kind); }
  if (group) { where.push("source_group = ?"); binds.push(group); }
  if (attention) { where.push("attention = ?"); binds.push(attention); }
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
    `SELECT guid, title, link, pub_date, feed_url, feed_label, source_group, kind,
            first_seen_at, last_seen_at, attention, confidence, entities_json, scoring_explanation
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

export async function timelineArchive(env: Env, params: URLSearchParams): Promise<{
  days: Array<{ day: string; total: number; high: number; med: number; low: number }>;
}> {
  const from = params.get("from");
  const to   = params.get("to");
  const kind = params.get("kind");
  const group = params.get("source_group");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (from)  { where.push("COALESCE(pub_date, first_seen_at) >= ?"); binds.push(from); }
  if (to)    { where.push("COALESCE(pub_date, first_seen_at) <= ?"); binds.push(`${to}T23:59:59`); }
  if (kind)  { where.push("kind = ?"); binds.push(kind); }
  if (group) { where.push("source_group = ?"); binds.push(group); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const res = await env.ARCHIVE.prepare(
    `SELECT
       DATE(COALESCE(pub_date, first_seen_at)) AS day,
       COUNT(*) AS total,
       SUM(CASE WHEN attention = 'high' THEN 1 ELSE 0 END) AS high,
       SUM(CASE WHEN attention = 'med'  THEN 1 ELSE 0 END) AS med,
       SUM(CASE WHEN attention = 'low' OR attention IS NULL THEN 1 ELSE 0 END) AS low
     FROM signals
     ${whereSql}
     GROUP BY day
     ORDER BY day`,
  ).bind(...binds).all<{ day: string; total: number; high: number; med: number; low: number }>();

  return { days: res.results ?? [] };
}

// ---- Alert rules CRUD -------------------------------------------------------

export async function listAlertRules(env: Env): Promise<{ rules: AlertRule[] }> {
  const res = await env.ARCHIVE.prepare(
    `SELECT id, name, terms, attention_min, source_group, kind, created_at, active FROM alert_rules ORDER BY id DESC`,
  ).all<AlertRule & { created_at: string }>();
  return { rules: (res.results ?? []) as unknown as AlertRule[] };
}

export async function createAlertRule(env: Env, body: {
  name: string;
  terms?: string;
  attention_min?: string;
  source_group?: string | null;
  kind?: string | null;
}): Promise<{ id: number }> {
  const now = new Date().toISOString();
  const res = await env.ARCHIVE.prepare(
    `INSERT INTO alert_rules (name, terms, attention_min, source_group, kind, created_at, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(
      body.name,
      body.terms ?? "",
      body.attention_min ?? "high",
      body.source_group ?? null,
      body.kind ?? null,
      now,
    )
    .run();
  return { id: res.meta.last_row_id ?? 0 };
}

export async function deleteAlertRule(env: Env, id: number): Promise<void> {
  await env.ARCHIVE.prepare(`DELETE FROM alert_rules WHERE id = ?`).bind(id).run();
}

export async function listAlertEvents(env: Env, limit = 50): Promise<{
  events: Array<{ id: number; rule_id: number; rule_name: string; signal_guid: string; fired_at: string; title: string; link: string; attention: string }>;
}> {
  const res = await env.ARCHIVE.prepare(
    `SELECT e.id, e.rule_id, r.name AS rule_name, e.signal_guid, e.fired_at, e.title, e.link, e.attention
       FROM alert_events e
       JOIN alert_rules r ON r.id = e.rule_id
       ORDER BY e.fired_at DESC
       LIMIT ?`,
  ).bind(limit).all<{ id: number; rule_id: number; rule_name: string; signal_guid: string; fired_at: string; title: string; link: string; attention: string }>();
  return { events: res.results ?? [] };
}
