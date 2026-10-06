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
  // Ingest freshness (additive, 2026-09-29). last_poll_at = MAX(last_seen_at),
  // last_new_item_at = MAX(first_seen_at), both ISO-8601 or null when the
  // signals table is empty or unreadable. stale is true when last_poll_at is
  // missing or older than 90 minutes.
  last_poll_at?: string | null;
  last_new_item_at?: string | null;
  feeds?: Array<{ feed_label: string; last_seen_at: string | null }>;
  stale?: boolean;
  freshness_note?: string;
  // Per-feed signal counts (additive, WK-04, 29 Sep 2026). One key per
  // configured feed_label. held = rows of that feed in blocks.signals.items
  // (at most PER_FEED_QUOTA = 10); available = rows archived for that feed in
  // D1. The UI can therefore say "latest {held} of {available} held". The
  // block is capped at STATE_SIGNAL_CAP = 150 rows in total. Absent when the
  // signals query failed.
  signal_counts?: Record<string, { held: number; available: number }>;
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
  first_seen_at: string;
  attention: string | null;
  confidence: number | null;
  scoring_explanation: string | null;
  // Additive, 0.16.2 (5 Oct 2026). The hearing's civil date, YYYY-MM-DD, as
  // printed at the start of the APH item description ("Thursday, 1 October
  // 2026 - venue"). The feed states no time zone: this is the local day at
  // the venue, never shifted through UTC. Set only on kind "hearing" rows
  // whose description parses with a weekday that agrees with the calendar;
  // null otherwise. No time of day is served: no APH hearing description
  // observed so far carries one. pub_date is unchanged (null for the
  // Upcoming Senate hearings feed, which has no <pubDate>).
  hearing_date: string | null;
}

// One row per configured RSS feed, derived from the 30-minute poll
// (feed_health table). url/checked_at/ok/status/error keep the original
// shape the frontend maps; the rest is the feed-level detail. checked_at and
// status are null for a configured feed that has not been polled yet.
export interface ConnectorCheck {
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
  // 0.16.11: "ok" | "failed" | "source_blocked" | "not_polled". A
  // source_blocked feed answered 403/429 to the Worker (the host refused it)
  // and is retried on its backoff; it is not counted as a failed feed.
  state: FeedState;
  // 0.16.11: earliest time the scheduled poll fetches this feed again, for a
  // feed with its own cadence (jurisdictions.json); null for an every-poll feed.
  next_poll_at: string | null;
}

export type FeedState = "ok" | "failed" | "source_blocked" | "not_polled";

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

// items: up to PER_FEED_QUOTA (10) rows per configured feed, each feed's rows
// chosen by fresh score then recency from its most recent candidates, merged
// and sorted globally by the same order, hard-capped at STATE_SIGNAL_CAP
// (150). Before WK-04 this was a single global top 30, which starved the
// quieter feeds (DATA-05). Item shape is unchanged.
export interface SignalsBlock extends StateBlockBase {
  items: SignalItem[];
}

export interface ConnectorsBlock extends StateBlockBase {
  checks: ConnectorCheck[];
  // Reference landing pages. Plain URLs, never an ok/fail health claim.
  reference_links: string[];
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
  // first_seen_at / last_seen_at are INGEST times: when the archive first and
  // last wrote the thread, not when APH published anything.
  first_seen_at: string;
  last_seen_at: string;
  // 0.16.3, additive: the earliest and latest APH publication date among the
  // member signals (MIN/MAX signals.pub_date), ISO-8601, or null when no
  // member carries a pub_date (Upcoming Senate hearings has none).
  first_pub_date: string | null;
  last_pub_date: string | null;
  signal_guids: string[];
}

export interface ThreadsBlock extends StateBlockBase {
  items: ThreadItem[];
  // 0.16.3, additive: threads in the archive. `items` is the top 15 by
  // repeat coverage, so a UI can say "top 15 of N".
  total?: number;
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
