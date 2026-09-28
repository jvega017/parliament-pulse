// Composed GET /state endpoint — provenance-as-schema.
//
// Assembles signals (scored, from D1), connector health, alert events and QON
// deltas into one cacheable response for the frontend. Every block carries a
// mandatory `provenance` field (see stateContract.ts): a D1 query that returns
// rows is 'live'; an empty table or a failed query degrades the block to
// 'fixture' with an empty collection and a `note` explaining why. A block
// never fabricates content to look live.

import type { Env } from "./archive";
import { queryStateSignals, listAlertEvents, queryQons, queryFeedHealth, type SignalCounts } from "./archive";
import { APH_REFERENCE_LINKS } from "./feeds";
import { queryFreshness, type Freshness } from "./freshness";
import type {
  StateResponse,
  SignalsBlock,
  ConnectorsBlock,
  AlertsBlock,
  QonsBlock,
  ThreadsBlock,
  ThreadItem,
} from "./stateContract";

const ORIGIN = "d1:parliament-pulse-archive";
const WORKER_VERSION = "0.15.0";

function degradedNote(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

// Per-feed quotas (WK-04, DATA-05): every configured feed contributes up to
// PER_FEED_QUOTA rows, capped at STATE_SIGNAL_CAP in total. signal_counts is
// returned beside the block and lands in meta.signal_counts. It is omitted
// (undefined) when the query failed, because "0 available" would then be a
// claim the Worker cannot make.
async function buildSignalsBlock(env: Env, now: string): Promise<{ block: SignalsBlock; signal_counts?: SignalCounts }> {
  try {
    const { items, signal_counts } = await queryStateSignals(env);
    if (items.length === 0) {
      return { block: { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: "signals table returned no rows" }, signal_counts };
    }
    return { block: { provenance: "live", fetched_at: now, origin: ORIGIN, items }, signal_counts };
  } catch (err) {
    return { block: { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: degradedNote(err) } };
  }
}

// Connector health is feed-derived (DATA-08): one check per configured feed,
// written by the 30-minute poll into feed_health. Landing pages ride along as
// reference_links, a plain URL list that never carries ok/fail. The block is
// 'live' only once at least one feed has actually been polled; before that
// every row would be "not yet polled", which is not live health.
async function buildConnectorsBlock(env: Env, now: string): Promise<ConnectorsBlock> {
  const reference_links = [...APH_REFERENCE_LINKS];
  try {
    const checks = await queryFeedHealth(env);
    if (!checks.some((c) => c.checked_at !== null)) {
      return { provenance: "fixture", fetched_at: now, origin: ORIGIN, checks: [], reference_links, note: "feed_health table returned no rows" };
    }
    return { provenance: "live", fetched_at: now, origin: ORIGIN, checks, reference_links };
  } catch (err) {
    return { provenance: "fixture", fetched_at: now, origin: ORIGIN, checks: [], reference_links, note: degradedNote(err) };
  }
}

async function buildAlertsBlock(env: Env, now: string): Promise<AlertsBlock> {
  try {
    const { events } = await listAlertEvents(env, 20);
    if (events.length === 0) {
      return { provenance: "fixture", fetched_at: now, origin: ORIGIN, events: [], note: "alert_events table returned no rows" };
    }
    return { provenance: "live", fetched_at: now, origin: ORIGIN, events };
  } catch (err) {
    return { provenance: "fixture", fetched_at: now, origin: ORIGIN, events: [], note: degradedNote(err) };
  }
}

async function buildQonsBlock(env: Env, now: string): Promise<QonsBlock> {
  try {
    const { rows } = await queryQons(env, new URLSearchParams({ limit: "20" }));
    if (rows.length === 0) {
      return { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: "qons table returned no rows" };
    }
    return { provenance: "live", fetched_at: now, origin: ORIGIN, items: rows };
  } catch (err) {
    return { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: degradedNote(err) };
  }
}

// Top N threads by item_count (most repeat coverage first), then recency.
// item_count is served as COUNT(*) over signal_threads, never the stored
// threads.item_count column, which was inflated before 29 Sep 2026 (DATA-06)
// and is only repaired by the unapplied 0007 backfill. The served count and
// the served signal_guids are therefore always the same set.
// Each row's member signal ids come from a small per-thread follow-up query
// (thread counts are low, so this is cheap); provenance is 'derived' because
// the block is composed from two tables, not a single direct row read.
async function buildThreadsBlock(env: Env, now: string): Promise<ThreadsBlock> {
  try {
    const res = await env.ARCHIVE.prepare(
      `SELECT t.thread_id, t.title, COUNT(st.signal_guid) AS item_count, t.first_seen_at, t.last_seen_at
         FROM threads t
         LEFT JOIN signal_threads st ON st.thread_id = t.thread_id
        GROUP BY t.thread_id
        ORDER BY item_count DESC, t.last_seen_at DESC
        LIMIT 15`,
    ).all<{ thread_id: string; title: string; item_count: number; first_seen_at: string; last_seen_at: string }>();
    const rows = res.results ?? [];
    if (rows.length === 0) {
      return { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: "threads table returned no rows" };
    }
    const items: ThreadItem[] = [];
    for (const row of rows) {
      const memberRes = await env.ARCHIVE.prepare(
        `SELECT signal_guid FROM signal_threads WHERE thread_id = ?`,
      ).bind(row.thread_id).all<{ signal_guid: string }>();
      items.push({
        thread_id: row.thread_id,
        title: row.title,
        item_count: row.item_count,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        signal_guids: (memberRes.results ?? []).map((m) => m.signal_guid),
      });
    }
    return { provenance: "derived", fetched_at: now, origin: ORIGIN, items };
  } catch (err) {
    return { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: degradedNote(err) };
  }
}

// Freshness never fails the response: a query error reports nulls, stale
// true, and a note, which is the honest reading of "we cannot tell".
export async function freshnessOrDegraded(env: Env): Promise<Freshness & { freshness_note?: string }> {
  try {
    return await queryFreshness(env.ARCHIVE);
  } catch (err) {
    return { last_poll_at: null, last_new_item_at: null, feeds: [], stale: true, freshness_note: degradedNote(err) };
  }
}

export async function buildState(env: Env): Promise<StateResponse> {
  const now = new Date().toISOString();
  const [signalsResult, connectors, alerts, qons, threads, freshness] = await Promise.all([
    buildSignalsBlock(env, now),
    buildConnectorsBlock(env, now),
    buildAlertsBlock(env, now),
    buildQonsBlock(env, now),
    buildThreadsBlock(env, now),
    freshnessOrDegraded(env),
  ]);
  const { block: signals, signal_counts } = signalsResult;
  return {
    meta: {
      generated_at: now,
      worker_version: WORKER_VERSION,
      schema: "state-v1",
      ...freshness,
      ...(signal_counts ? { signal_counts } : {}),
    },
    blocks: { signals, connectors, alerts, qons, threads },
  };
}
