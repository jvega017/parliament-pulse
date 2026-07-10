// Shared contract for the composed GET /state endpoint (schema "state-v1").
//
// This is the provenance-as-schema thesis applied to Parliament Pulse: every
// data block the Worker hands the UI carries a mandatory `provenance` field.
// The frontend renders its honesty chip mechanically from this value — it
// cannot hand-place a "live" label over data that did not come from D1.
//
// provenance is a closed union:
//   live    — the block's rows came from a D1 query that returned results.
//   derived — the block was computed from live data but is not a direct row
//             read (reserved for future blocks; nothing on this endpoint
//             currently emits it).
//   fixture — the source table was empty or the query failed. `items`/`checks`/
//             `events` is then always an empty array and `note` carries the
//             reason. A degraded block must never be filled with placeholder
//             content.

export type Provenance = "live" | "derived" | "fixture";

export interface StateMeta {
  generated_at: string;
  worker_version: string;
  schema: "state-v1";
}

// Base shape shared by every block. Individual blocks add their own
// item/collection field (items, checks, events) on top of this.
export interface StateBlockBase {
  provenance: Provenance;
  fetched_at: string;
  origin: string;
  note?: string;
}

export interface SignalItem {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_label: string;
  source_group: string;
  kind: string;
  attention: string | null;
  confidence: number | null;
  scoring_explanation: string | null;
}

export interface ConnectorCheck {
  url: string;
  checked_at: string;
  ok: number;
  status: number;
  error: string | null;
}

export interface AlertEventItem {
  id: number;
  rule_id: number;
  rule_name: string;
  signal_guid: string;
  fired_at: string;
  title: string;
  link: string;
  attention: string;
}

export interface QonItem {
  id: string;
  asked_at: string;
  member: string | null;
  chamber: string | null;
  target: string | null;
  question: string | null;
  hansard_url: string;
}

export interface SignalsBlock extends StateBlockBase {
  items: SignalItem[];
}

export interface ConnectorsBlock extends StateBlockBase {
  checks: ConnectorCheck[];
}

export interface AlertsBlock extends StateBlockBase {
  events: AlertEventItem[];
}

export interface QonsBlock extends StateBlockBase {
  items: QonItem[];
}

// Thread item: a group of related signals (repeat coverage of the same
// inquiry, bill, or hearing) surfaced as one row. Always `derived` when
// populated -- it is computed from the `threads` + `signal_threads` D1
// tables, never a direct pass-through of a single query's rows.
export interface ThreadItem {
  thread_id: string;
  title: string;
  item_count: number;
  first_seen_at: string;
  last_seen_at: string;
  signal_guids: string[];
}

export interface ThreadsBlock extends StateBlockBase {
  items: ThreadItem[];
}

export interface StateResponse {
  meta: StateMeta;
  blocks: {
    signals: SignalsBlock;
    connectors: ConnectorsBlock;
    alerts: AlertsBlock;
    qons: QonsBlock;
    // Additive, optional: existing consumers that do not know about threads
    // are unaffected. Added 2026-07-10.
    threads?: ThreadsBlock;
  };
}
