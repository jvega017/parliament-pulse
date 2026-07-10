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
} from "./stateContract";

const ORIGIN = "d1:parliament-pulse-archive";
const WORKER_VERSION = "0.14.0";

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

export async function buildState(env: Env): Promise<StateResponse> {
  const now = new Date().toISOString();
  const [signals, connectors, alerts, qons] = await Promise.all([
    buildSignalsBlock(env, now),
    buildConnectorsBlock(env, now),
    buildAlertsBlock(env, now),
    buildQonsBlock(env, now),
  ]);
  return {
    meta: { generated_at: now, worker_version: WORKER_VERSION, schema: "state-v1" },
    blocks: { signals, connectors, alerts, qons },
  };
}
