// Composed GET /state endpoint — provenance-as-schema.
//
// Assembles signals (scored, from D1), connector health, alert events and QON
// deltas into one cacheable response for the frontend. Every block carries a
// mandatory `provenance` field (see stateContract.ts): a D1 query that returns
// rows is 'live'; an empty table or a failed query degrades the block to
// 'fixture' with an empty collection and a `note` explaining why. A block
// never fabricates content to look live.

import type { Env } from "./archive";
import { queryTopSignals, listAlertEvents, queryQons } from "./archive";
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

async function buildSignalsBlock(env: Env, now: string): Promise<SignalsBlock> {
  try {
    const rows = await queryTopSignals(env, 30);
    if (rows.length === 0) {
      return { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: "signals table returned no rows" };
    }
    return { provenance: "live", fetched_at: now, origin: ORIGIN, items: rows };
  } catch (err) {
    return { provenance: "fixture", fetched_at: now, origin: ORIGIN, items: [], note: degradedNote(err) };
  }
}

async function buildConnectorsBlock(env: Env, now: string): Promise<ConnectorsBlock> {
  try {
    const res = await env.ARCHIVE.prepare(
      `SELECT url, MAX(checked_at) AS checked_at, ok, status, error
         FROM connector_checks
         GROUP BY url
         ORDER BY url`,
    ).all<{ url: string; checked_at: string; ok: number; status: number; error: string | null }>();
    const checks = res.results ?? [];
    if (checks.length === 0) {
      return { provenance: "fixture", fetched_at: now, origin: ORIGIN, checks: [], note: "connector_checks table returned no rows" };
    }
    return { provenance: "live", fetched_at: now, origin: ORIGIN, checks };
  } catch (err) {
    return { provenance: "fixture", fetched_at: now, origin: ORIGIN, checks: [], note: degradedNote(err) };
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
// Each row's member signal ids come from a small per-thread follow-up query
// (thread counts are low, so this is cheap); provenance is 'derived' because
// the block is composed from two tables, not a single direct row read.
async function buildThreadsBlock(env: Env, now: string): Promise<ThreadsBlock> {
  try {
    const res = await env.ARCHIVE.prepare(
      `SELECT thread_id, title, item_count, first_seen_at, last_seen_at
         FROM threads
        ORDER BY item_count DESC, last_seen_at DESC
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

export async function buildState(env: Env): Promise<StateResponse> {
  const now = new Date().toISOString();
  const [signals, connectors, alerts, qons, threads] = await Promise.all([
    buildSignalsBlock(env, now),
    buildConnectorsBlock(env, now),
    buildAlertsBlock(env, now),
    buildQonsBlock(env, now),
    buildThreadsBlock(env, now),
  ]);
  return {
    meta: { generated_at: now, worker_version: WORKER_VERSION, schema: "state-v1" },
    blocks: { signals, connectors, alerts, qons, threads },
  };
}
