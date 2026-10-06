// Jurisdiction config accessor (portability refactor, 2026-07-10).
//
// Parliament-specific configuration (feed URLs/labels, chamber/source-group
// rules, base URLs, the WAF-satisfying browser header profile) used to be
// hardcoded across feeds.ts, index.ts, and hansard.ts. It now lives in
// jurisdictions.json, keyed by jurisdiction id, with "aph" as the sole entry
// and the default. This module is the only reader of that JSON; every other
// file keeps importing from ./feeds as before -- feeds.ts is the single
// accessor the rest of the codebase uses (see its header comment).
//
// Structure only: no other jurisdiction (e.g. a future QLD entry) is defined
// here. Adding one is a data change to jurisdictions.json, not a code change,
// once a second jurisdiction is actually needed.

import jurisdictionsData from "./jurisdictions.json";

export type FeedKind = "division" | "hearing" | "program" | "inquiry" | "report" | "digest" | "signal";

export interface JurisdictionFeedMeta {
  url: string;
  label: string;
  kind: FeedKind;
  /**
   * 0.16.11: the scheduled poll fetches this feed only when its last poll
   * (feed_health.last_polled_at) is at least this many minutes old. Absent:
   * every 30-minute poll. A manual /admin/poll-now ignores it.
   */
  pollEveryMinutes?: number;
  /**
   * 0.16.11: set on a feed whose host may refuse the Worker (HTTP 403 or 429)
   * while the source itself is fine. Such a refusal is recorded as "source
   * blocked", not as a failed feed, and the scheduled poll then retries it
   * only after this many minutes. Absent: a 403 or 429 is an ordinary failure.
   */
  blockedBackoffMinutes?: number;
}

function asMinutes(v: unknown, field: string, url: string): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`jurisdictions.json: ${field} for ${url} must be a positive integer`);
  }
  return v;
}

export interface SourceGroupRule {
  group: string;
  matchesAny: string[];
}

export interface JurisdictionConfig {
  id: string;
  label: string;
  allowedHosts: string[];
  parlinfoSearchBase: string;
  browserHeaders: Record<string, string>;
  feeds: JurisdictionFeedMeta[];
  // Landing pages a reader can follow for context. Reference only: these are
  // never polled for content and never reported as ok/fail health. Feed
  // health comes from the feeds themselves (archive.ts, feed_health table).
  referenceLinks: string[];
  sourceGroupRules: SourceGroupRule[];
  defaultSourceGroup: string;
}

const FEED_KINDS = new Set<FeedKind>(["division", "hearing", "program", "inquiry", "report", "digest", "signal"]);

function asFeedKind(kind: string): FeedKind {
  if (!FEED_KINDS.has(kind as FeedKind)) {
    throw new Error(`jurisdictions.json: unknown feed kind "${kind}"`);
  }
  return kind as FeedKind;
}

const DEFAULT_JURISDICTION_ID = "aph";
const RAW = jurisdictionsData as Record<string, Omit<JurisdictionConfig, "feeds"> & {
  feeds: Array<{ url: string; label: string; kind: string; pollEveryMinutes?: number; blockedBackoffMinutes?: number }>;
}>;

/**
 * Reads one jurisdiction's config.
 *
 * A "{year}" placeholder in a feed label is substituted here at read time.
 *
 * WARNING, and the reason no label currently uses it: in a Cloudflare Worker
 * the clock is frozen until the isolate performs I/O, so `new Date()` read
 * early in a fresh isolate can return the epoch. That shipped to production as
 * a feed publicly labelled "Bills Digests 1970" (observed in the live /state
 * payload, 2026-07-21). The substitution is kept because it is correct once
 * I/O has occurred, and any label using it must be resolved after a fetch,
 * never during module init. Prefer a label with no computed date.
 */
export function getJurisdiction(id: string = DEFAULT_JURISDICTION_ID): JurisdictionConfig {
  const entry = RAW[id];
  if (!entry) throw new Error(`Unknown jurisdiction: "${id}"`);
  const now = new Date();
  // Guard the frozen-clock case rather than rendering a 1970 label publicly.
  const year = now.getFullYear() > 2000 ? String(now.getFullYear()) : "";
  return {
    ...entry,
    feeds: entry.feeds.map((f) => ({
      url: f.url,
      label: f.label.replace("{year}", year).trim(),
      kind: asFeedKind(f.kind),
      ...(f.pollEveryMinutes !== undefined ? { pollEveryMinutes: asMinutes(f.pollEveryMinutes, "pollEveryMinutes", f.url) } : {}),
      ...(f.blockedBackoffMinutes !== undefined
        ? { blockedBackoffMinutes: asMinutes(f.blockedBackoffMinutes, "blockedBackoffMinutes", f.url) }
        : {}),
    })),
  };
}

export function sourceGroupForConfig(label: string, config: JurisdictionConfig): string {
  const lower = label.toLowerCase();
  for (const rule of config.sourceGroupRules) {
    if (rule.matchesAny.some((m) => lower.includes(m))) return rule.group;
  }
  return config.defaultSourceGroup;
}

// Per-item chamber (0.16.3, data review 5 Oct 2026). A feed's label names the
// chamber that publishes it, not the committee an item belongs to: "Today's
// House and joint hearings" carries House committee hearings, and the Senate
// feeds carry joint committee items. When an item's link names a committee
// chamber (/Committees/House|Joint|Senate/), that chamber is the item's group.
// Otherwise the feed rule applies. Library (Bills Digests) is never
// overridden. migrations/0010_item_source_group.sql applies the same rule to
// stored rows.
const COMMITTEE_CHAMBER_RE = /\/Committees\/(House|Joint|Senate)\//i;
const CHAMBER_GROUPS: Record<string, string> = { house: "House", joint: "Joint", senate: "Senate" };

export function sourceGroupForItemConfig(link: string | null | undefined, feedLabel: string, config: JurisdictionConfig): string {
  const feedGroup = sourceGroupForConfig(feedLabel, config);
  if (feedGroup === "Library" || !link) return feedGroup;
  const m = COMMITTEE_CHAMBER_RE.exec(link);
  return m ? CHAMBER_GROUPS[m[1].toLowerCase()] : feedGroup;
}
