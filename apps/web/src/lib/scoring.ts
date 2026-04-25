// Live scoring engine.
// Converts a raw APH RSS FeedItem into a scored Signal using watchlist
// keyword matches, recency, and source authority. Runs entirely in the
// browser; no backend scoring service.
//
// This replaces the prototype's fixture signals with real RSS items that
// inherit a transparent, auditable score. The per-dimension breakdown is
// the same shape the drawer already renders, so the UI does not change.

import type {
  AttentionLevel,
  ScoreDimensions,
  Signal,
  Tag,
  Watchlist,
} from "../types";
import type { FeedItem } from "./aphFeed";

export interface ScoringResult {
  score: ScoreDimensions;
  overall: number;
  attention: AttentionLevel;
  matchedWatchlists: string[];
  confidence: number;
}

const WEIGHTS: Record<keyof ScoreDimensions, number> = {
  authority: 0.2,
  portfolio: 0.3,
  novelty: 0.1,
  momentum: 0.05,
  time: 0.2,
  scrutiny: 0.1,
  ops: 0.05,
};

function ageHours(pub: Date | null, now: Date): number {
  if (!pub) return 48;
  return (now.getTime() - pub.getTime()) / 3_600_000;
}

function scoreTime(hours: number): number {
  if (hours < 4) return 1;
  if (hours < 24) return 0.85;
  if (hours < 48) return 0.6;
  if (hours < 24 * 7) return 0.35;
  return 0.15;
}

function scoreNovelty(hours: number): number {
  if (hours < 6) return 1;
  if (hours < 24) return 0.8;
  if (hours < 24 * 3) return 0.5;
  return 0.2;
}

function scorePortfolio(
  haystack: string,
  watchlists: Watchlist[],
): { score: number; matched: string[] } {
  const matched: string[] = [];
  for (const w of watchlists) {
    for (const term of w.terms) {
      if (term && haystack.includes(term.toLowerCase())) {
        matched.push(w.name);
        break;
      }
    }
  }
  // 0 matches → 0.0, 1 → 0.7, 2 → 0.85, 3+ → 0.95. Diminishing returns.
  const score = matched.length === 0 ? 0 : Math.min(0.95, 0.5 + 0.2 * matched.length);
  return { score, matched };
}

function scoreScrutiny(haystack: string, kind: FeedItem["kind"]): number {
  const kindWeight: Record<FeedItem["kind"], number> = {
    inquiry: 0.9,
    hearing: 0.8,
    division: 0.85,
    digest: 0.7,
    report: 0.75,
    program: 0.5,
    signal: 0.4,
  };
  const base = kindWeight[kind] ?? 0.4;
  const scrutinyWords = ["estimates", "inquiry", "hearing", "scrutiny", "review", "report", "audit"];
  const bump = scrutinyWords.some((w) => haystack.includes(w)) ? 0.1 : 0;
  return Math.min(1, base + bump);
}

function attentionFrom(overall: number): AttentionLevel {
  if (overall >= 0.65) return "high";
  if (overall >= 0.4) return "med";
  return "low";
}

function confidenceFrom(portfolio: number, matched: number): number {
  if (matched >= 2 && portfolio >= 0.8) return 5;
  if (matched >= 1 && portfolio >= 0.7) return 4;
  if (matched >= 1) return 3;
  return 2;
}

export function scoreFeedItem(
  item: FeedItem,
  watchlists: Watchlist[],
  now: Date = new Date(),
): ScoringResult {
  const haystack = item.title.toLowerCase();
  const hours = ageHours(item.pubDate, now);

  const portfolio = scorePortfolio(haystack, watchlists);
  const time = scoreTime(hours);
  const novelty = scoreNovelty(hours);
  const scrutiny = scoreScrutiny(haystack, item.kind);

  const score: ScoreDimensions = {
    authority: 0.95,
    portfolio: portfolio.score,
    novelty,
    momentum: 0.5,
    time,
    scrutiny,
    ops: 0.5,
  };

  let overall = 0;
  (Object.keys(WEIGHTS) as Array<keyof ScoreDimensions>).forEach((k) => {
    overall += score[k] * WEIGHTS[k];
  });

  return {
    score,
    overall,
    attention: attentionFrom(overall),
    matchedWatchlists: portfolio.matched,
    confidence: confidenceFrom(portfolio.score, portfolio.matched.length),
  };
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortId(link: string, idx: number): string {
  try {
    const u = new URL(link);
    const hash = (u.pathname + u.search).split("").reduce((acc, ch) => {
      return ((acc << 5) - acc + ch.charCodeAt(0)) | 0;
    }, 0);
    return `PP-${(hash >>> 0).toString(36).slice(0, 6).toUpperCase()}`;
  } catch {
    return `PP-${idx.toString(36).padStart(4, "0").toUpperCase()}`;
  }
}

function actionFor(
  attention: AttentionLevel,
  kind: FeedItem["kind"],
  matched: string[],
): { action: string; reason: string } {
  if (attention === "high") {
    if (kind === "inquiry") {
      return {
        action: "Assign policy owner",
        reason: `${matched.length} watchlist match(es). New inquiry with submission window; a named owner reduces the risk of a missed date.`,
      };
    }
    if (kind === "digest") {
      return {
        action: "Draft Executive Brief",
        reason: `Bills Digest touching ${matched.length} watchlist(s). DDG-level awareness warranted before the next reading.`,
      };
    }
    return {
      action: "Monitor and prepare lines",
      reason: `Matches ${matched.length} watchlist(s). Time-sensitive; prepare draft lines before chamber action.`,
    };
  }
  if (attention === "med") {
    return {
      action: "Add to watchlist digest",
      reason: "Contextual relevance; aggregate into the daily digest rather than a standalone brief.",
    };
  }
  return {
    action: "No action required / archive",
    reason: "Below the attention threshold for this analyst.",
  };
}

// Source group derived from the feed label, not the kind.
// Earlier versions inferred from kind, which mis-routed Senate inquiries and
// Library digests to "House". The label is canonical because it is set in
// APH_FEED_URLS and matches the publishing chamber/department exactly.
function sourceGroupFor(item: FeedItem): Signal["sourceGroup"] {
  const label = item.sourceLabel.toLowerCase();
  if (label.includes("library") || label.includes("flagpost") || label.includes("digest")) {
    return "Library";
  }
  if (label.includes("senate") || label.includes("senators")) return "Senate";
  if (label.includes("joint") || label.includes("committee")) return "Custom";
  return "House";
}

function tagsFor(result: ScoringResult, kind: FeedItem["kind"]): Tag[] {
  const tags: Tag[] = [];
  if (result.matchedWatchlists.length > 0) {
    tags.push({ l: result.matchedWatchlists[0]!, c: "brass" });
    if (result.matchedWatchlists.length > 1) {
      tags.push({ l: `+${result.matchedWatchlists.length - 1}`, c: "info" });
    }
  }
  tags.push({ l: kind, c: "teal" });
  return tags;
}

/**
 * Transform a live RSS FeedItem into the Signal shape the UI renders.
 * Every field except `id` is derived from the item or the scoring result.
 */
export function signalFromFeedItem(
  item: FeedItem,
  watchlists: Watchlist[],
  idx: number,
  now: Date = new Date(),
): Signal {
  const result = scoreFeedItem(item, watchlists, now);
  const { action, reason } = actionFor(result.attention, item.kind, result.matchedWatchlists);
  const id = shortId(item.link, idx);

  return {
    id,
    time: fmtTime(item.pubDate),
    date: fmtDate(item.pubDate),
    source: item.sourceLabel,
    sourceGroup: sourceGroupFor(item),
    title: item.title,
    summary: `Live from ${item.sourceLabel}. Opened via Parliament of Australia RSS.`,
    tags: tagsFor(result, item.kind),
    attention: result.attention,
    attentionReason:
      result.matchedWatchlists.length > 0
        ? `Matched watchlist(s): ${result.matchedWatchlists.join(", ")}. Source authority: Official APH RSS.`
        : "No watchlist match. Low baseline attention assigned by time sensitivity and source authority only.",
    action,
    actionReason: reason,
    confidence: result.confidence,
    sourceAuthority: "Official",
    humanReview: result.attention === "high" ? "Required" : "Optional",
    evidence: [
      { label: `Open item: ${item.title.slice(0, 60)}${item.title.length > 60 ? "..." : ""}`, url: item.link },
      { label: `${item.sourceLabel} (RSS feed)`, url: item.sourceUrl },
      { label: "ParlInfo full-text search", url: "https://parlinfo.aph.gov.au/" },
      { label: "APH RSS feed directory", url: "https://www.aph.gov.au/Help/RSS_feeds" },
    ],
    score: result.score,
    provenance: [
      { ts: `${fmtDate(now)} ${fmtTime(now)}`, by: "parser", event: `Fetched via aph-proxy Worker from ${item.sourceLabel}` },
      { ts: `${fmtDate(now)} ${fmtTime(now)}`, by: "enrichment", event: `Keyword scan -> ${result.matchedWatchlists.length} watchlist match(es)` },
      { ts: `${fmtDate(now)} ${fmtTime(now)}`, by: "scoring", event: `Attention score ${result.overall.toFixed(2)} -> ${result.attention.toUpperCase()}` },
      { ts: `${fmtDate(now)} ${fmtTime(now)}`, by: "publish", event: `Published as ${id}` },
    ],
    updates: [],
    members: [],
  };
}
