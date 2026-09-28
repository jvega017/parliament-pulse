// Ingest freshness: when did the poller last see anything, and when did it
// last add something new? Served in /state meta and /healthz so a reader can
// tell a quiet parliament from a stalled poller.
//
// One query over `signals`, grouped by feed_label. The global maxima are
// derived from the per-feed rows, so the three figures cannot disagree.
//
// last_seen_at is refreshed on every poll that re-sees an item (the INSERT in
// archive.ts upserts it), so MAX(last_seen_at) is the last successful poll
// that returned at least one item. A poll where every feed failed or returned
// nothing leaves it unchanged, which is exactly what the stale flag reports.
//
// No runtime imports: this module is unit-tested directly under
// `node --experimental-strip-types`.

// A poll that has not produced a sighting for longer than this is stale.
export const STALE_AFTER_MINUTES = 90;

export interface FeedFreshness {
  feed_label: string;
  last_seen_at: string | null;
}

export interface Freshness {
  last_poll_at: string | null;
  last_new_item_at: string | null;
  feeds: FeedFreshness[];
  stale: boolean;
}

// The subset of the D1 binding this module uses, so a test can pass a mock.
export interface FreshnessDb {
  prepare(sql: string): {
    all<T = unknown>(): Promise<{ results?: T[] }>;
  };
}

export const FRESHNESS_SQL =
  `SELECT feed_label, MAX(last_seen_at) AS last_seen_at, MAX(first_seen_at) AS first_seen_at
     FROM signals
    GROUP BY feed_label
    ORDER BY feed_label`;

// D1 stores timestamps as ISO-8601 text; normalise whatever comes back to a
// canonical ISO string, or null when it is absent or unparseable.
function toIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function maxIso(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) if (v && (best === null || v > best)) best = v;
  return best;
}

export function isStale(lastPollAt: string | null, now: Date): boolean {
  if (!lastPollAt) return true;
  return now.getTime() - new Date(lastPollAt).getTime() > STALE_AFTER_MINUTES * 60_000;
}

export async function queryFreshness(db: FreshnessDb, now: Date = new Date()): Promise<Freshness> {
  const res = await db.prepare(FRESHNESS_SQL)
    .all<{ feed_label: string; last_seen_at: string | null; first_seen_at: string | null }>();
  const rows = res.results ?? [];
  const feeds = rows.map((r) => ({ feed_label: r.feed_label, last_seen_at: toIso(r.last_seen_at) }));
  const last_poll_at = maxIso(feeds.map((f) => f.last_seen_at));
  const last_new_item_at = maxIso(rows.map((r) => toIso(r.first_seen_at)));
  return { last_poll_at, last_new_item_at, feeds, stale: isStale(last_poll_at, now) };
}
