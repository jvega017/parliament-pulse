// Canonical APH feed list shared by the proxy, the archival cron, and the
// connector health cron. Mirrors apps/web/src/lib/aphFeed.APH_FEED_URLS.
//
// Data lives in jurisdictions.json, keyed by jurisdiction id (portability
// refactor, 2026-07-10). This module is the single accessor every other file
// in the Worker imports from -- archive.ts, index.ts, and hansard.ts are
// unchanged by that refactor because the exported names and shapes below are
// identical to before. See ./jurisdictions.ts for the config reader itself.

import { getJurisdiction, sourceGroupForConfig, type JurisdictionFeedMeta } from "./jurisdictions";

const APH = getJurisdiction("aph");

export type FeedMeta = JurisdictionFeedMeta;

export const APH_FEEDS: FeedMeta[] = APH.feeds;

// Canonical 12 connector URLs; cron pings these fortnightly for liveness.
export const APH_CONNECTORS: string[] = APH.connectors;

// Browser UA + accept headers that satisfy the APH edge WAF, which 403s
// bot-identifying User-Agent strings (confirmed via the working /rss proxy
// path in index.ts, and via the pollAndArchive fix in archive.ts). Shared by
// /rss, pollAndArchive, the QON ingest, and the connector health-check cron
// so all four stay in sync with a single source instead of drifting
// independently.
export const APH_BROWSER_HEADERS: Record<string, string> = APH.browserHeaders;

// Hosts the /rss proxy is allowed to fetch from (allowlist, not an open relay).
export const APH_ALLOWED_HOSTS: string[] = APH.allowedHosts;

// ParlInfo full-text search base used by the QON ingest.
export const APH_PARLINFO_SEARCH_BASE: string = APH.parlinfoSearchBase;

export function sourceGroupFor(label: string): string {
  return sourceGroupForConfig(label, APH);
}
