// Canonical APH feed list shared by the proxy, the archival cron, and the
// connector health cron.
//
// Single source (WK-08, ARCH-13): src/jurisdictions.json. The README and
// STATUS feed tables are generated from it by scripts/feeds-table.mjs and
// tests/feeds-table.test.mjs fails when they disagree. The retired apps/web
// SPA still carries its own older feed literals (apps/web/src/lib/aphFeed.ts,
// apps/web/src/data/fixtures.ts); that copy is not built or deployed and is
// not a source for anything here.
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

// Reference landing pages (formerly "connectors"). Served as a plain list in
// /state and /healthz/connectors under reference_links; never reported as
// ok/fail. The daily cron still pings them into connector_checks as an
// internal link-rot log for the maintainer, which is not served as health.
export const APH_REFERENCE_LINKS: string[] = APH.referenceLinks;

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
