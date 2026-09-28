// Archive ingest + query layer for Parliament Pulse.
// Cron pollers write into D1; the /archive HTTP endpoint reads from it.

import { APH_FEEDS, type FeedMeta, sourceGroupFor, APH_BROWSER_HEADERS } from "./feeds";
import { scoreForArchive, matchAlertRules, type AlertRule, type NewItem } from "./workerScoring";
import { assignThread, buildTokenSet, type ThreadCandidate, type ThreadAssignment } from "./threads";

export interface Env {
  CACHE: KVNamespace;
  ALLOWED_ORIGINS: string;
  ARCHIVE: D1Database;
  REQUIRE_ACCESS?: string;
  RESEND_API_KEY?: string;
  DIGEST_FROM_EMAIL?: string;
  ADMIN_TOKEN?: string;
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

// Historically a bot-identifying UA; switched to APH_BROWSER_HEADERS 2026-07-10
// after confirming the APH edge WAF 403s the parlinfo.aph.gov.au Bills Digests
// feed under the bot UA (200 under the browser UA), while the six
// www.aph.gov.au feeds returned 200 under both. See commit message for the
// evidence table.

// Naive RSS parser tuned for APH RSS 2.0 + Atom. Pure regex (no DOMParser
// in workers runtime). Returns at most 50 items per feed.
function parseFeed(xml: string, feed: FeedMeta): Array<{
  title: string;
  link: string;
  pubDate: string | null;
  guid: string;
  description: string | null;
}> {
  const out: Array<{ title: string; link: string; pubDate: string | null; guid: string; description: string | null }> = [];
  const itemRegex = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches.slice(0, 50)) {
    let title = pluck(block, "title");
    let link = pluck(block, "link");
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href="([^"]+)"/);
      if (hrefMatch && hrefMatch[1]) link = hrefMatch[1];
    }
    const pubText = pluck(block, "pubDate") ?? pluck(block, "updated") ?? pluck(block, "published");
    const rawDesc = pluck(block, "description") ?? pluck(block, "summary") ?? null;
    // Fallback: if title is missing, use first 100 chars of description (up to first newline)
    if (!title && rawDesc) {
      title = rawDesc.split('\n')[0].substring(0, 100).trim();
    }
    const guid = pluck(block, "guid") ?? link ?? `${feed.url}#${title}`;
    if (!title || !link) continue;
    out.push({
      title: title.trim(),
      link: link.trim(),
      pubDate: pubText ? new Date(pubText.trim()).toISOString() : null,
      guid: guid.trim(),
      description: rawDesc ? rawDesc.trim().slice(0, 600) : null,
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

// ---- Thread layer ------------------------------------------------------------
// Groups related signals (repeat coverage of the same inquiry/bill/hearing)
// under a shared thread. See ./threads.ts for the pure tokeniser + matcher;
// everything here is D1 I/O around that pure core.

const THREAD_CANDIDATE_LIMIT = 500;

async function loadThreadCandidates(env: Env, limit = THREAD_CANDIDATE_LIMIT): Promise<ThreadCandidate[]> {
  const res = await env.ARCHIVE.prepare(
    `SELECT thread_id, fingerprint FROM threads ORDER BY last_seen_at DESC LIMIT ?`,
  ).bind(limit).all<{ thread_id: string; fingerprint: string }>();
  return (res.results ?? []).map((r) => ({
    thread_id: r.thread_id,
    fingerprint: r.fingerprint ? r.fingerprint.split(",").filter(Boolean) : [],
  }));
}

async function persistThreadAssignment(
  env: Env,
  assignment: ThreadAssignment,
  guid: string,
  title: string,
  now: string,
): Promise<void> {
  const fingerprintCsv = assignment.fingerprint.join(",");
  // item_count is never incremented. It is recomputed from signal_threads
  // after the mapping row is written, so a re-seen or re-threaded signal
  // (signal_threads is keyed on signal_guid and INSERT OR IGNORE) cannot
  // inflate it. DATA-06, 29 Sep 2026: the old `item_count + 1` fired on
  // every poll that re-saw an item, because the new-row test below it was
  // unreliable, so a thread with one signal could claim dozens of updates.
  if (assignment.created) {
    await env.ARCHIVE.prepare(
      `INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at, item_count)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(thread_id) DO UPDATE SET
         fingerprint  = excluded.fingerprint,
         last_seen_at = excluded.last_seen_at`,
    ).bind(assignment.thread_id, fingerprintCsv, title, now, now).run();
  } else {
    await env.ARCHIVE.prepare(
      `UPDATE threads SET fingerprint = ?, last_seen_at = ? WHERE thread_id = ?`,
    ).bind(fingerprintCsv, now, assignment.thread_id).run();
  }
  await env.ARCHIVE.prepare(
    `INSERT OR IGNORE INTO signal_threads (signal_guid, thread_id) VALUES (?, ?)`,
  ).bind(guid, assignment.thread_id).run();
  await env.ARCHIVE.prepare(
    `UPDATE threads
        SET item_count = (SELECT COUNT(*) FROM signal_threads st WHERE st.thread_id = threads.thread_id)
      WHERE thread_id = ?`,
  ).bind(assignment.thread_id).run();
}

// Assigns one item and keeps the in-memory candidate list in sync so later
// items in the same poll/backfill batch can join a thread created earlier in
// that same batch, without a re-query per item.
async function threadItem(
  env: Env,
  candidates: ThreadCandidate[],
  guid: string,
  title: string,
  description: string | null,
  now: string,
): Promise<void> {
  const tokens = buildTokenSet(title, description);
  const assignment = assignThread(tokens, candidates, `thread:${guid}`);
  await persistThreadAssignment(env, assignment, guid, title, now);
  const idx = candidates.findIndex((c) => c.thread_id === assignment.thread_id);
  if (idx >= 0) candidates[idx] = { thread_id: assignment.thread_id, fingerprint: assignment.fingerprint };
  else candidates.push({ thread_id: assignment.thread_id, fingerprint: assignment.fingerprint });
}

// Threads any archived signals that pollAndArchive inserted before this layer
// existed (or that failed thread assignment at ingest time). Chronological
// order so earlier items seed threads that later items join, matching how
// pollAndArchive threads items as they arrive. Idempotent: only processes
// signals with no row in signal_threads yet, so it is safe to call repeatedly
// (e.g. in a loop until `processed` comes back 0) to work through a large
// backlog in bounded batches.
export async function backfillThreads(env: Env, limit = 500): Promise<{
  processed: number;
  threadsCreated: number;
  threadsJoined: number;
}> {
  const res = await env.ARCHIVE.prepare(
    `SELECT s.guid, s.title, s.description, s.first_seen_at
       FROM signals s
       LEFT JOIN signal_threads st ON st.signal_guid = s.guid
      WHERE st.signal_guid IS NULL
      ORDER BY s.first_seen_at ASC
      LIMIT ?`,
  ).bind(limit).all<{ guid: string; title: string; description: string | null; first_seen_at: string }>();
  const rows = res.results ?? [];

  const candidates = await loadThreadCandidates(env, 1000);
  let threadsCreated = 0;
  let threadsJoined = 0;
  for (const row of rows) {
    const tokens = buildTokenSet(row.title, row.description);
    const assignment = assignThread(tokens, candidates, `thread:${row.guid}`);
    await persistThreadAssignment(env, assignment, row.guid, row.title, row.first_seen_at);
    if (assignment.created) threadsCreated += 1; else threadsJoined += 1;
    const idx = candidates.findIndex((c) => c.thread_id === assignment.thread_id);
    if (idx >= 0) candidates[idx] = { thread_id: assignment.thread_id, fingerprint: assignment.fingerprint };
    else candidates.push({ thread_id: assignment.thread_id, fingerprint: assignment.fingerprint });
  }

  return { processed: rows.length, threadsCreated, threadsJoined };
}

// ---- Feed health (DATA-08) ---------------------------------------------------
// Connector health is derived from the feeds the poller actually reads, on
// every 30-minute poll, so a reported "ok" means "this feed returned 200 and
// parsed", not "a landing page answered". One row per feed_url, upserted.
// last_success_at only moves on a successful poll, so a failing feed keeps
// the time it last worked. Never throws: a health write must not break ingest.
async function recordFeedHealth(
  env: Env,
  feed: FeedMeta,
  httpStatus: number,
  itemsParsed: number | null,
  parseError: string | null,
  now: string,
  success: boolean,
): Promise<void> {
  try {
    await env.ARCHIVE.prepare(
      `INSERT INTO feed_health
         (feed_url, feed_label, kind, last_http_status, items_parsed, parse_error, last_polled_at, last_success_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(feed_url) DO UPDATE SET
         feed_label       = excluded.feed_label,
         kind             = excluded.kind,
         last_http_status = excluded.last_http_status,
         items_parsed     = excluded.items_parsed,
         parse_error      = excluded.parse_error,
         last_polled_at   = excluded.last_polled_at,
         last_success_at  = COALESCE(excluded.last_success_at, feed_health.last_success_at)`,
    ).bind(
      feed.url, feed.label, feed.kind, httpStatus, itemsParsed, parseError, now, success ? now : null,
    ).run();
  } catch (err) {
    console.warn("feed health write failed", feed.url, err instanceof Error ? err.message : err);
  }
}

export interface FeedHealthRow {
  feed_url: string;
  feed_label: string;
  kind: string | null;
  last_http_status: number | null;
  items_parsed: number | null;
  parse_error: string | null;
  last_polled_at: string;
  last_success_at: string | null;
}

export interface FeedHealthCheck {
  url: string;
  feed_label: string;
  kind: string;
  checked_at: string | null;
  ok: number;
  status: number | null;
  error: string | null;
  last_http_status: number | null;
  items_parsed: number | null;
  parse_error: string | null;
  last_success_at: string | null;
}

export const FEED_HEALTH_SQL =
  `SELECT feed_url, feed_label, kind, last_http_status, items_parsed, parse_error, last_polled_at, last_success_at
     FROM feed_health`;

// Serves one row per CONFIGURED feed, in jurisdictions.json order, labelled
// with the configured feed_label. A configured feed with no health row yet is
// reported as never polled (ok 0, status null) rather than omitted, and a
// health row for a feed no longer configured is dropped. The ok/status/
// checked_at/error fields keep the ConnectorCheck shape the frontend already
// maps, so this is a drop-in replacement for the old connector_checks rollup.
export async function queryFeedHealth(env: Env): Promise<FeedHealthCheck[]> {
  const res = await env.ARCHIVE.prepare(FEED_HEALTH_SQL).all<FeedHealthRow>();
  const byUrl = new Map((res.results ?? []).map((r) => [r.feed_url, r]));
  return APH_FEEDS.map((feed) => {
    const r = byUrl.get(feed.url);
    const status = r?.last_http_status ?? null;
    const ok = r != null && status !== null && status >= 200 && status < 300 && !r.parse_error;
    return {
      url: feed.url,
      feed_label: feed.label,
      kind: feed.kind,
      checked_at: r?.last_polled_at ?? null,
      ok: ok ? 1 : 0,
      status,
      error: r ? (r.parse_error ?? null) : "not yet polled",
      last_http_status: status,
      items_parsed: r?.items_parsed ?? null,
      parse_error: r?.parse_error ?? null,
      last_success_at: r?.last_success_at ?? null,
    };
  });
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
  type FetchOk = { ok: true; meta: FeedMeta; xml: string; status: number };
  type FetchErr = { ok: false; meta: FeedMeta; status: number; error: string };
  const feedResults = await Promise.all(
    APH_FEEDS.map(async (feedMeta): Promise<FetchOk | FetchErr> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(feedMeta.url, {
          signal: controller.signal,
          headers: APH_BROWSER_HEADERS,
          cf: { cacheTtl: 60, cacheEverything: true },
        }).finally(() => clearTimeout(timer));
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          console.warn("APH returned 429", { feed: feedMeta.url, retryAfter });
          return { ok: false, meta: feedMeta, status: 429, error: "HTTP 429 Too Many Requests" };
        }
        if (!res.ok) {
          return { ok: false, meta: feedMeta, status: res.status, error: `HTTP ${res.status}` };
        }
        const xml = await res.text();
        return { ok: true, meta: feedMeta, xml, status: res.status };
      } catch (err) {
        return {
          ok: false, meta: feedMeta, status: 0,
          error: err instanceof Error ? err.message : "unknown",
        };
      }
    }),
  );

  // Compute kind-level momentum from D1 history before scoring.
  // One query: count each kind in the recent 7 days vs the prior 7 days.
  // Momentum = recent / prior (clamped 0-1); neutral (0.5) when no history.
  const momentumMap = new Map<string, number>();
  try {
    const sevenAgo = new Date(new Date(now).getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const fourteenAgo = new Date(new Date(now).getTime() - 14 * 24 * 3600 * 1000).toISOString();
    const momRes = await env.ARCHIVE.prepare(
      `SELECT kind,
              SUM(CASE WHEN pub_date >= ? THEN 1 ELSE 0 END)             AS recent,
              SUM(CASE WHEN pub_date >= ? AND pub_date < ? THEN 1 ELSE 0 END) AS prior
         FROM signals
         WHERE pub_date >= ?
         GROUP BY kind`,
    ).bind(sevenAgo, fourteenAgo, sevenAgo, fourteenAgo)
     .all<{ kind: string; recent: number; prior: number }>();
    for (const row of momRes.results ?? []) {
      const r = row.recent ?? 0;
      const p = row.prior ?? 0;
      if (p === 0 && r === 0) { momentumMap.set(row.kind, 0.5); continue; }
      if (p === 0) { momentumMap.set(row.kind, 0.9); continue; }
      momentumMap.set(row.kind, Math.min(1, r / p));
    }
  } catch (momErr) {
    console.warn("momentum query failed", momErr instanceof Error ? momErr.message : momErr);
  }

  // Thread candidates loaded once per poll (not per item) and kept in sync
  // in-memory as items are threaded below, mirroring the momentum map above.
  let threadCandidates: ThreadCandidate[] = [];
  try {
    threadCandidates = await loadThreadCandidates(env);
  } catch (threadLoadErr) {
    console.warn("thread candidate load failed", threadLoadErr instanceof Error ? threadLoadErr.message : threadLoadErr);
  }

  // In-poll title deduplication: tracks normalised title hashes across all feeds
  // in this cron run to prevent inserting different-GUID items with identical titles.
  const seenTitleHashes = new Set<string>();

  function normTitle(t: string): string {
    return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  }

  for (const feedResult of feedResults) {
    if (!feedResult.ok) {
      perFeed.push({ feed: feedResult.meta.url, ok: false, new: 0, seen: 0, dedup: 0, error: feedResult.error });
      await recordFeedHealth(env, feedResult.meta, feedResult.status, null, feedResult.error, now, false);
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
        const momentumHint = momentumMap.get(feed.kind) ?? 0.5;
        const scored = scoreForArchive(item.title, feed.kind, item.pubDate, nowDate, momentumHint, now);
        // NOTE: attention, confidence and scoring_explanation below are an
        // INGEST-TIME SNAPSHOT only. scoring_explanation in particular embeds a
        // relative-age phrase ("today", "3d ago") that is true only at `now`
        // above -- it is never true again after this row is written. Once an
        // item drops out of its RSS feed, the re-seen UPDATE branch below stops
        // firing for its guid, so these three columns freeze permanently.
        // Every read path that SERVES a score to a user (queryStateSignals,
        // queryArchive, queryBills, the /state signals block, the digest
        // renderer) must call scoreForArchive again at read time with a fresh
        // `now` and serve that result, never these stored columns directly.
        // These columns exist for historical analysis only (e.g. the
        // /archive/timeline day-by-day volume chart, which is deliberately an
        // ingest-time record of what was assessed on each day).
        // New-row detection (DATA-06). The previous upsert inferred "new" from
        // meta.last_row_id, but SQLite's last_insert_rowid() keeps the value
        // of the previous successful INSERT on the connection, so a re-seen
        // item whose ON CONFLICT branch fired still looked new and was
        // re-threaded on every poll. RETURNING on DO NOTHING yields a row
        // only when this statement actually inserted one.
        const inserted = await env.ARCHIVE.prepare(
          `INSERT INTO signals
             (guid, title, link, pub_date, feed_url, feed_label, source_group, kind,
              first_seen_at, last_seen_at,
              attention, confidence, score_json, entities_json, scoring_explanation, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(guid) DO NOTHING
           RETURNING guid`,
        )
          .bind(
            item.guid, item.title, item.link, item.pubDate,
            feed.url, feed.label, sourceGroup, feed.kind,
            now, now,
            scored.attention, scored.confidence,
            scored.scoreJson, scored.entitiesJson, scored.explanation,
            item.description,
          )
          .all<{ guid: string }>();
        if ((inserted.results ?? []).length > 0) {
          added += 1;
          // Thread only genuinely new rows -- a re-seen item already has a
          // signal_threads row from when it first arrived.
          try {
            await threadItem(env, threadCandidates, item.guid, item.title, item.description, now);
          } catch (threadErr) {
            console.warn("thread assignment failed", item.guid, threadErr instanceof Error ? threadErr.message : threadErr);
          }
        } else {
          await env.ARCHIVE.prepare(
            `UPDATE signals SET
               last_seen_at        = ?,
               title               = ?,
               description         = ?,
               attention           = ?,
               confidence          = ?,
               score_json          = ?,
               entities_json       = ?,
               scoring_explanation = ?
             WHERE guid = ?`,
          )
            .bind(
              now, item.title, item.description,
              scored.attention, scored.confidence,
              scored.scoreJson, scored.entitiesJson, scored.explanation,
              item.guid,
            )
            .run();
          updated += 1;
        }
      }
      perFeed.push({ feed: feed.url, ok: true, new: added, seen: items.length, dedup: dedupSkipped });
      await recordFeedHealth(env, feed, feedResult.status, items.length, null, now, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      perFeed.push({ feed: feed.url, ok: false, new: 0, seen: 0, dedup: 0, error: msg });
      await recordFeedHealth(env, feed, feedResult.status, null, msg, now, false);
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
      // GET (not HEAD) with the same browser UA/accept headers as the working
      // /rss proxy path — the APH edge WAF 403s both HEAD requests and the
      // bot-identifying UA this check previously sent. Response body is never
      // read below, so this costs nothing extra over a HEAD request.
      const res = await fetch(url, {
        method: "GET",
        headers: APH_BROWSER_HEADERS,
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

  // The /archive page (PageArchive.tsx) renders scoring_explanation directly,
  // including its relative-age phrase. Recompute attention/confidence/
  // scoring_explanation against the current instant before serving so an old
  // row never claims to have been "published today". The `attention` WHERE
  // filter above still runs against the stored ingest-time bucket -- that is
  // a coarse pre-filter D1 can do cheaply without loading every row -- so a
  // row's returned attention can occasionally differ from the bucket it was
  // filtered on if it has decayed since ingest; that is an accepted tradeoff,
  // not a fabrication, because the served value is always the honest current
  // score. entities_json is left untouched: entity extraction is a pure
  // function of title text only and does not change over time.
  const now = new Date();
  const rows = (rowsRes.results ?? []).map((row) => {
    const scored = scoreForArchive(row.title, row.kind, row.pub_date, now, 0, row.first_seen_at);
    return {
      ...row,
      attention: scored.attention,
      confidence: scored.confidence,
      scoring_explanation: scored.explanation,
    };
  });

  return { rows, total, has_more: total > offset + limit };
}

// WK-02 (SEC-02, PERF-01): analytics used to run one D1 query per term with no
// cap on the number of terms, so a single request could fan out into an
// unbounded number of queries. Terms are now capped and folded into ONE query.
export const MAX_ANALYTICS_TERMS = 10;

export class AnalyticsInputError extends Error {}

export async function watchlistAnalytics(env: Env, params: URLSearchParams): Promise<{
  series: Array<{ term: string; count: number; last_seen: string | null }>;
}> {
  const from = params.get("from");
  const to = params.get("to");
  const termsCsv = params.get("terms") ?? "";
  const terms = termsCsv.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return { series: [] };

  const uniqueTerms = [...new Set(terms)];
  if (uniqueTerms.length > MAX_ANALYTICS_TERMS) {
    throw new AnalyticsInputError(
      `too many terms: ${uniqueTerms.length} supplied, at most ${MAX_ANALYTICS_TERMS} allowed`,
    );
  }

  const cols: string[] = [];
  const binds: unknown[] = [];
  uniqueTerms.forEach((term, i) => {
    const pattern = `%${escapeLike(term)}%`;
    cols.push(`SUM(CASE WHEN LOWER(title) LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END) AS n${i}`);
    cols.push(`MAX(CASE WHEN LOWER(title) LIKE ? ESCAPE '\\' THEN pub_date END) AS l${i}`);
    binds.push(pattern, pattern);
  });
  const where: string[] = [];
  if (from) { where.push("pub_date >= ?"); binds.push(from); }
  if (to) { where.push("pub_date <= ?"); binds.push(to); }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const r = await env.ARCHIVE.prepare(`SELECT ${cols.join(", ")} FROM signals${whereSql}`)
    .bind(...binds)
    .first<Record<string, number | string | null>>();
  const series = uniqueTerms.map((term, i) => ({
    term,
    count: Number(r?.[`n${i}`] ?? 0) || 0,
    last_seen: (r?.[`l${i}`] as string | null | undefined) ?? null,
  }));
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

  // Deliberately left as the stored, ingest-time `attention` bucket, not
  // recomputed: this is a day-by-day historical volume chart ("N days · by
  // attention level" on PageArchive.tsx), an audit of how much high/med/low
  // material was assessed on each past day. Recomputing against `now` would
  // time-decay almost every past day's counts down to "low" (scoreTime and
  // scoreNovelty both collapse after a few days), destroying the comparison
  // the chart exists to show. This is the "historical record" exception noted
  // in the INSERT comment above.
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

// `attention` here is the alert_events.attention column: the level the rule
// actually fired against at fired_at. It is a point-in-time audit record of
// why the alert fired, not a live signal score, so it is deliberately left
// as stored -- recomputing it against `now` would misrepresent the reason
// the alert fired in the past. This is the other "historical record"
// exception noted in the INSERT comment in pollAndArchive.
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

// ---- Bills (archive view) ---------------------------------------------------

export async function queryBills(env: Env, params: URLSearchParams): Promise<{
  rows: Array<{ guid: string; title: string; link: string; pub_date: string | null; description: string | null; attention: string | null; confidence: number | null }>;
  total: number;
}> {
  const q = params.get("q");
  const limit = Math.min(parseInt(params.get("limit") ?? "100", 10) || 100, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = ["kind = 'digest'"];
  const binds: unknown[] = [];
  if (q) {
    where.push("LOWER(title) LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(q.toLowerCase())}%`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const total = (await env.ARCHIVE.prepare(`SELECT COUNT(*) AS n FROM signals ${whereSql}`)
    .bind(...binds).first<{ n: number }>())?.n ?? 0;

  const rows = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, description, attention, confidence
       FROM signals ${whereSql}
       ORDER BY COALESCE(pub_date, first_seen_at) DESC
       LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<{ guid: string; title: string; link: string; pub_date: string | null; description: string | null; attention: string | null; confidence: number | null }>();

  // PageBills.tsx renders `attention` as a coloured chip per row. kind is
  // always 'digest' here (see the WHERE clause above). Recompute at read time
  // for the same reason as queryStateSignals/queryArchive: the stored value is
  // an ingest-time snapshot that freezes once the bill drops out of its feed.
  const now = new Date();
  const scoredRows = (rows.results ?? []).map((row) => {
    const scored = scoreForArchive(row.title, "digest", row.pub_date, now);
    return { ...row, attention: scored.attention, confidence: scored.confidence };
  });

  return { rows: scoredRows, total };
}

// ---- QONs -------------------------------------------------------------------

export interface QonRow {
  id: string;
  asked_at: string;
  member: string | null;
  chamber: string | null;
  target: string | null;
  question: string | null;
  hansard_url: string;
  ingested_at: string;
}

export async function queryQons(env: Env, params: URLSearchParams): Promise<{
  rows: QonRow[];
  total: number;
}> {
  const q = params.get("q");
  const chamber = params.get("chamber");
  const limit = Math.min(parseInt(params.get("limit") ?? "100", 10) || 100, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) {
    where.push("(LOWER(member) LIKE ? ESCAPE '\\' OR LOWER(question) LIKE ? ESCAPE '\\')");
    const pat = `%${escapeLike(q.toLowerCase())}%`;
    binds.push(pat, pat);
  }
  if (chamber) { where.push("chamber = ?"); binds.push(chamber); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (await env.ARCHIVE.prepare(`SELECT COUNT(*) AS n FROM qons ${whereSql}`)
    .bind(...binds).first<{ n: number }>())?.n ?? 0;

  const rows = await env.ARCHIVE.prepare(
    `SELECT id, asked_at, member, chamber, target, question, hansard_url, ingested_at
       FROM qons ${whereSql}
       ORDER BY asked_at DESC
       LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<QonRow>();

  return { rows: rows.results ?? [], total };
}

// ---- Members ----------------------------------------------------------------

export interface MemberRow {
  mpid: string;
  name: string;
  chamber: string;
  party: string | null;
  state: string | null;
  role: string | null;
  profile_url: string;
  updated_at: string;
}

const PARTY_RE = /\b(ALP|Labor|Labour|LNP|Liberal|LPA|NPA|National|GRN|Greens?|UAP|ONP|Pauline|IND|Independent|CLP|KAP|CA|Centre Alliance)\b/i;
const STATE_RE = /\b(NSW|New South Wales|VIC|Victoria|QLD|Queensland|SA|South Australia|WA|Western Australia|TAS|Tasmania|ACT|Australian Capital Territory|NT|Northern Territory)\b/i;
const STATE_ABBR: Record<string, string> = {
  "new south wales": "NSW", "victoria": "VIC", "queensland": "QLD",
  "south australia": "SA", "western australia": "WA", "tasmania": "TAS",
  "australian capital territory": "ACT", "northern territory": "NT",
};
const PARTY_ABBR: Record<string, string> = {
  "labor": "ALP", "labour": "ALP", "liberal": "LIB", "lpa": "LIB",
  "national": "NAT", "npa": "NAT", "greens": "GRN", "green": "GRN",
  "independent": "IND", "pauline": "ONP",
};

function normaliseParty(raw: string): string {
  const lo = raw.toLowerCase();
  return PARTY_ABBR[lo] ?? raw.toUpperCase().slice(0, 8);
}
function normaliseState(raw: string): string {
  const lo = raw.toLowerCase();
  return STATE_ABBR[lo] ?? raw.toUpperCase().slice(0, 8);
}

export async function ingestMembers(env: Env): Promise<{ added: number; updated: number }> {
  const now = new Date().toISOString();
  // Pull senators_details archive items — these have title=senator name, link=APH profile
  const res = await env.ARCHIVE.prepare(
    `SELECT title, link, description FROM signals
     WHERE feed_label LIKE '%senator%' AND link LIKE '%Parliamentarian%MPID%'
     ORDER BY last_seen_at DESC LIMIT 500`,
  ).all<{ title: string; link: string; description: string | null }>();

  let added = 0;
  let updated = 0;
  const items = res.results ?? [];

  for (const row of items) {
    // Extract MPID from link: ?MPID=283869
    const mpidMatch = row.link.match(/[?&]MPID=([A-Za-z0-9]+)/i);
    if (!mpidMatch || !mpidMatch[1]) continue;
    const mpid = mpidMatch[1];

    // Name: strip "Senator " / "The Hon. " prefix
    const rawName = row.title.replace(/^(Senator|The Hon\.|Hon\.|Dr\.|Prof\.)\s+/i, "").trim();
    if (!rawName) continue;

    // Party and state from description (e.g. "ALP, NSW")
    const desc = row.description ?? "";
    const partyMatch = desc.match(PARTY_RE) ?? row.title.match(PARTY_RE);
    const stateMatch = desc.match(STATE_RE) ?? row.title.match(STATE_RE);
    const party = partyMatch ? normaliseParty(partyMatch[1]) : null;
    const state = stateMatch ? normaliseState(stateMatch[1]) : null;
    const role = row.title.toLowerCase().startsWith("senator") ? "Senator" : "Member";

    const r = await env.ARCHIVE.prepare(
      `INSERT INTO members (mpid, name, chamber, party, state, role, profile_url, updated_at)
       VALUES (?, ?, 'Senate', ?, ?, ?, ?, ?)
       ON CONFLICT(mpid) DO UPDATE SET
         name = excluded.name, party = COALESCE(excluded.party, party),
         state = COALESCE(excluded.state, state), profile_url = excluded.profile_url,
         updated_at = excluded.updated_at`,
    ).bind(mpid, rawName, party, state, role, row.link, now).run();

    if (r.meta?.last_row_id && r.meta.last_row_id > 0) added += 1;
    else updated += 1;
  }

  return { added, updated };
}

export async function queryMembers(env: Env, params: URLSearchParams): Promise<{
  members: MemberRow[];
  total: number;
}> {
  const q = params.get("q");
  const party = params.get("party");
  const chamber = params.get("chamber");
  const limit = Math.min(parseInt(params.get("limit") ?? "200", 10) || 200, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) { where.push("LOWER(name) LIKE ? ESCAPE '\\'"); binds.push(`%${escapeLike(q.toLowerCase())}%`); }
  if (party) { where.push("party = ?"); binds.push(party); }
  if (chamber) { where.push("chamber = ?"); binds.push(chamber); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (await env.ARCHIVE.prepare(`SELECT COUNT(*) AS n FROM members ${whereSql}`)
    .bind(...binds).first<{ n: number }>())?.n ?? 0;

  const rows = await env.ARCHIVE.prepare(
    `SELECT mpid, name, chamber, party, state, role, profile_url, updated_at
       FROM members ${whereSql}
       ORDER BY name ASC LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<MemberRow>();

  return { members: rows.results ?? [], total };
}

// ---- Top signals (composed /state endpoint) ---------------------------------
// Ordered by a freshly recomputed score (high first) then recency. Distinct
// from queryArchive: no filters, no pagination -- just the current
// top-of-inbox view for the composed /state response.
//
// LB-03 fix (2026-07-22): this used to ORDER BY the stored `attention`
// column, which is an ingest-time snapshot that freezes the moment an item
// drops out of its RSS feed (see the INSERT comment in pollAndArchive). A
// stale item scored "high" weeks ago would then pin the top of the inbox
// forever, and its persisted scoring_explanation would go on claiming
// "Published today" indefinitely. Fixed by selecting candidates by recency
// only, rescoring every candidate against the current instant, and sorting
// by that fresh score instead.
//
// WK-04 fix (DATA-05, 29 Sep 2026): a single global LIMIT 30 let the busiest
// feeds (inquiries, hearings) take every row, so divisions, media releases,
// reports and digests received nothing and their desks sat empty. Selection
// is now per feed: one query ranks each configured feed_label's rows by
// recency with ROW_NUMBER() OVER (PARTITION BY feed_label ...) and keeps a
// per-feed candidate window; each feed's candidates are rescored and the top
// PER_FEED_QUOTA kept; the union is sorted globally and capped at
// STATE_SIGNAL_CAP. COUNT(*) OVER the same partition gives `available` for
// meta.signal_counts, so the UI can say "latest N held" honestly.

/** Rows each configured feed contributes to /state at most. */
export const PER_FEED_QUOTA = 10;
/** Hard ceiling on the /state signals block (13 feeds x 10 = 130 today). */
export const STATE_SIGNAL_CAP = 150;
/** Recency window per feed that is rescored before the quota is applied. */
const PER_FEED_CANDIDATES = PER_FEED_QUOTA * 4;

export interface TopSignalRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  attention: string | null;
  confidence: number | null;
  scoring_explanation: string | null;
}

/** held = rows served in the block; available = rows archived for the feed. */
export type SignalCounts = Record<string, { held: number; available: number }>;

export interface StateSignals {
  items: TopSignalRow[];
  signal_counts: SignalCounts;
}

interface TopSignalCandidate {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  feed_available: number;
}

interface Rescored {
  row: TopSignalCandidate;
  overallPct: number;
  attention: string | null;
  confidence: number | null;
  explanation: string | null;
}

function byScoreThenRecency(a: Rescored, b: Rescored): number {
  if (b.overallPct !== a.overallPct) return b.overallPct - a.overallPct;
  const aKey = a.row.pub_date ?? a.row.first_seen_at;
  const bKey = b.row.pub_date ?? b.row.first_seen_at;
  return bKey.localeCompare(aKey); // ISO-8601 strings sort correctly lexically
}

export async function queryStateSignals(
  env: Env,
  opts: { perFeed?: number; cap?: number; feeds?: string[] } = {},
): Promise<StateSignals> {
  const perFeed = opts.perFeed ?? PER_FEED_QUOTA;
  const cap = opts.cap ?? STATE_SIGNAL_CAP;
  const labels = opts.feeds ?? APH_FEEDS.map((f) => f.label);
  const candidatesPerFeed = Math.max(perFeed, PER_FEED_CANDIDATES);

  const signal_counts: SignalCounts = {};
  for (const l of labels) signal_counts[l] = { held: 0, available: 0 };
  if (labels.length === 0) return { items: [], signal_counts };

  // One query for every feed. Candidates are ranked by RECENCY only, never by
  // the stored `attention` column (the LB-03 half: ordering by a frozen value
  // is what let a stale item pin the inbox). guid breaks recency ties so the
  // window is deterministic.
  const placeholders = labels.map(() => "?").join(", ");
  const res = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, feed_label, source_group, kind, first_seen_at, feed_available
       FROM (
         SELECT guid, title, link, pub_date, feed_label, source_group, kind, first_seen_at,
                ROW_NUMBER() OVER (PARTITION BY feed_label ORDER BY COALESCE(pub_date, first_seen_at) DESC, guid) AS feed_rank,
                COUNT(*) OVER (PARTITION BY feed_label) AS feed_available
           FROM signals
          WHERE feed_label IN (${placeholders})
       )
      WHERE feed_rank <= ?`,
  ).bind(...labels, candidatesPerFeed).all<TopSignalCandidate>();
  const candidates = res.results ?? [];

  // One `now` for the whole batch so every candidate is scored against the
  // same instant. Captured here, after the D1 query above has already forced
  // the isolate to perform I/O, so it cannot read back the frozen epoch
  // clock (do not hoist this above the query or to module scope).
  const now = new Date();

  const byFeed = new Map<string, Rescored[]>();
  for (const row of candidates) {
    const scored = scoreForArchive(row.title, row.kind, row.pub_date, now, 0, row.first_seen_at);
    const list = byFeed.get(row.feed_label) ?? [];
    list.push({ row, overallPct: scored.overallPct, attention: scored.attention, confidence: scored.confidence, explanation: scored.explanation });
    byFeed.set(row.feed_label, list);
    signal_counts[row.feed_label].available = Number(row.feed_available);
  }

  const merged: Rescored[] = [];
  for (const list of byFeed.values()) {
    list.sort(byScoreThenRecency);
    merged.push(...list.slice(0, perFeed));
  }
  merged.sort(byScoreThenRecency);
  const kept = merged.slice(0, cap);
  for (const r of kept) signal_counts[r.row.feed_label].held += 1;

  const items = kept.map(({ row, attention, confidence, explanation }): TopSignalRow => ({
    guid: row.guid,
    title: row.title,
    link: row.link,
    pub_date: row.pub_date,
    feed_label: row.feed_label,
    source_group: row.source_group,
    kind: row.kind,
    first_seen_at: row.first_seen_at,
    attention,
    confidence,
    scoring_explanation: explanation,
  }));
  return { items, signal_counts };
}

// ---- Watchlist 7-day trend --------------------------------------------------
// Returns signal counts per day for the last 7 days matching any of the given
// keyword terms. Days with zero matches are included so the chart has a stable
// 7-bar shape. Accepts up to 5 terms.

export async function watchlistTrend(env: Env, params: URLSearchParams): Promise<{
  days: Array<{ day: string; count: number }>;
}> {
  const rawTerms = params.get("terms") ?? "";
  const terms = rawTerms.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5);
  if (terms.length === 0) return { days: buildEmptyWeek() };

  const termConditions = terms.map(() => `LOWER(title) LIKE ?`).join(" OR ");
  const termBinds = terms.map(t => `%${t.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`);

  const rows = await env.ARCHIVE.prepare(
    `SELECT DATE(pub_date) AS day, COUNT(*) AS count
       FROM signals
      WHERE (${termConditions})
        AND pub_date >= datetime('now', '-7 days')
      GROUP BY DATE(pub_date)
      ORDER BY day ASC`,
  ).bind(...termBinds).all<{ day: string; count: number }>();

  const result = buildEmptyWeek();
  for (const row of rows.results ?? []) {
    const entry = result.find(d => d.day === row.day);
    if (entry) entry.count = row.count;
  }
  return { days: result };
}

function buildEmptyWeek(): Array<{ day: string; count: number }> {
  const days: Array<{ day: string; count: number }> = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  return days;
}
