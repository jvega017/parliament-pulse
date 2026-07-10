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
  connectors: string[];
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
  feeds: Array<{ url: string; label: string; kind: string }>;
}>;

/**
 * Reads one jurisdiction's config. The Bills Digests feed label carries a
 * "{year}" placeholder in the JSON (a computed value cannot live in static
 * JSON); it is substituted here at read time, matching the original code's
 * `Bills Digests ${new Date().getFullYear()}` evaluated once at module load.
 */
export function getJurisdiction(id: string = DEFAULT_JURISDICTION_ID): JurisdictionConfig {
  const entry = RAW[id];
  if (!entry) throw new Error(`Unknown jurisdiction: "${id}"`);
  const year = String(new Date().getFullYear());
  return {
    ...entry,
    feeds: entry.feeds.map((f) => ({
      url: f.url,
      label: f.label.replace("{year}", year),
      kind: asFeedKind(f.kind),
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
