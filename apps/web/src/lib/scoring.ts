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
import { extractEntities } from "./entityExtract";

export interface ScoringResult {
  score: ScoreDimensions;
  overall: number;
  attention: AttentionLevel;
  matchedWatchlists: string[];
  confidence: number;
}

// Weight table for the scoring formula. momentum and ops are zeroed because
// their values cannot be derived from a single RSS item in isolation:
//   - momentum requires time-series signal frequency (not yet ingested)
//   - ops requires operational risk context (not yet wired)
// The 10% previously allocated to those dimensions is redistributed to
// authority (+5%) and portfolio (+5%) to preserve the 100% total.
const WEIGHTS: Record<keyof ScoreDimensions, number> = {
  authority: 0.25,
  portfolio: 0.35,
  novelty: 0.10,
  momentum: 0,    // zeroed: no time-series data
  time: 0.20,
  scrutiny: 0.10,
  ops: 0,         // zeroed: no operational context
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
): { score: number; matched: string[]; termHits: number } {
  const matched: string[] = [];
  let termHits = 0;
  for (const w of watchlists) {
    let wHits = 0;
    for (const term of w.terms) {
      if (term && haystack.includes(term.toLowerCase())) {
        wHits++;
      }
    }
    if (wHits > 0) {
      matched.push(w.name);
      termHits += wHits;
    }
  }
  // Gentler curve than the old 0.5+0.2n formula:
  // 0 matches → 0, 1 → 0.60, 2 → 0.78, 3+ → 0.90
  // Term-frequency bonus: extra keyword hits beyond 1-per-watchlist add up to 0.05
  const base = matched.length === 0 ? 0 : Math.min(0.90, 0.45 + 0.18 * matched.length);
  const freqBonus = termHits > matched.length ? Math.min(0.05, (termHits - matched.length) * 0.012) : 0;
  return { score: Math.min(0.95, base + freqBonus), matched, termHits };
}

// Authority reflects the formal standing of the feed source, not the item
// content. Inquiry and report feeds carry the highest institutional weight;
// media releases the lowest. Values intentionally differ between types.
function authorityFromKind(kind: FeedItem["kind"]): number {
  const map: Record<FeedItem["kind"], number> = {
    inquiry: 0.90,
    report: 0.90,
    hearing: 0.85,
    division: 0.75,
    digest: 0.75,
    program: 0.65,
    signal: 0.65,
  };
  return map[kind] ?? 0.65;
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

function confidenceFrom(portfolio: number, matched: number, termHits: number): number {
  if (matched >= 2 && portfolio >= 0.8 && termHits >= 3) return 5;
  if (matched >= 2 && portfolio >= 0.8) return 4;
  if (matched >= 1 && portfolio >= 0.6) return 3;
  if (matched >= 1) return 2;
  return 1; // no portfolio match — authority-only signal
}

export function scoreFeedItem(
  item: FeedItem,
  watchlists: Watchlist[],
  now: Date = new Date(),
  momentumHint = 0,
): ScoringResult {
  // Include description in keyword matching — RSS descriptions often contain
  // more context than the title alone (committee name, portfolio keywords, etc.)
  const haystack = (item.title + " " + item.description).toLowerCase();
  const hours = ageHours(item.pubDate, now);

  const portfolio = scorePortfolio(haystack, watchlists);
  const time = scoreTime(hours);
  const novelty = scoreNovelty(hours);
  const scrutiny = scoreScrutiny(haystack, item.kind);

  // authority: derived from feed kind. Formal committee outputs (inquiry/report)
  // are highest; media releases are lowest. This replaces the former constant
  // 0.95 which inflated scores uniformly across all feeds.
  // momentum and ops cannot be derived from a single RSS item in isolation
  // (momentum requires time-series data; ops requires operational context);
  // both are held at 0.50 as neutral mid-point pending richer data ingestion.
  const authority = authorityFromKind(item.kind);
  const score: ScoreDimensions = {
    authority,
    portfolio: portfolio.score,
    novelty,
    momentum: momentumHint, // derived from live batch co-occurrence; weight still 0
    time,
    scrutiny,
    ops: 0,
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
    confidence: confidenceFrom(portfolio.score, portfolio.matched.length, portfolio.termHits),
  };
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  // Include year only when it differs from the current year
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-AU", opts);
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
    if (matched.length === 0) {
      return {
        action: "Situational awareness — log and monitor",
        reason: `High-authority ${kind} from official feed. No watchlist match, but source weight and recency elevated attention. Review against current portfolio before archiving.`,
      };
    }
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
    if (matched.length > 0) {
      return {
        action: "Add to watchlist digest",
        reason: `${matched.length} watchlist match(es). Aggregate into the daily digest; escalate if frequency increases.`,
      };
    }
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

function buildScoringExplanation(
  result: ScoringResult,
  item: FeedItem,
  hours: number,
  overallPct: number,
  momentumPct: number,
): string {
  const attWord = result.attention === "high" ? "High" : result.attention === "med" ? "Medium" : "Low";
  const parts: string[] = [`${attWord} attention (${overallPct}/100).`];

  if (result.matchedWatchlists.length > 0) {
    const list = result.matchedWatchlists.slice(0, 2).join(", ");
    const extra = result.matchedWatchlists.length > 2 ? ` +${result.matchedWatchlists.length - 2} more` : "";
    parts.push(`Watchlist match: ${list}${extra}.`);
  } else {
    parts.push("No watchlist match — elevated by authority and recency.");
  }

  const auth = Math.round(result.score.authority * 100);
  parts.push(`Source type: ${item.kind} (authority ${auth}/100).`);

  if (hours < 1) parts.push("Breaking: published within 1h.");
  else if (hours < 4) parts.push("Published within 4h.");
  else if (hours < 24) parts.push("Published today.");
  else if (hours < 48) parts.push("Published yesterday.");
  else parts.push(`Published ${Math.round(hours / 24)}d ago.`);

  if (momentumPct > 0) parts.push(`Batch momentum ${momentumPct}% (${item.kind} frequency in this poll).`);
  parts.push("Scored deterministically — no AI involved in this output.");
  return parts.join(" ");
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
  momentumHint = 0,
): Signal {
  const result = scoreFeedItem(item, watchlists, now, momentumHint);
  const { action, reason } = actionFor(result.attention, item.kind, result.matchedWatchlists);
  const id = shortId(item.link, idx);
  const hours = ageHours(item.pubDate, now);
  const overallPct = Math.round(result.overall * 100);
  const momentumPct = Math.round(momentumHint * 100);

  return {
    id,
    time: fmtTime(item.pubDate),
    date: fmtDate(item.pubDate),
    pubMs: item.pubDate?.getTime(),
    source: item.sourceLabel,
    sourceGroup: sourceGroupFor(item),
    title: item.title,
    summary:
      result.matchedWatchlists.length > 0
        ? `Matches: ${result.matchedWatchlists.join(", ")}. ${item.sourceLabel}.`
        : `${item.sourceLabel} · ${item.kind}. Published ${fmtDate(item.pubDate) !== "—" ? fmtDate(item.pubDate) : "recently"}.`,
    tags: tagsFor(result, item.kind),
    attention: result.attention,
    attentionReason:
      result.matchedWatchlists.length > 0
        ? `Matched watchlist(s): ${result.matchedWatchlists.join(", ")}. Source authority: Official APH RSS.`
        : "No watchlist terms matched. Scored on recency and source authority only. Add keywords on the Watchlists page to bias scoring toward your portfolio.",
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
      { ts: `${fmtDate(now)} ${fmtTime(now)}`, by: "scoring", event: `Attention score ${result.overall.toFixed(2)} -> ${result.attention.toUpperCase()} (deterministic, engine v1.1)` },
      { ts: `${fmtDate(now)} ${fmtTime(now)}`, by: "publish", event: `Published as ${id}` },
    ],
    updates: [],
    members: [],
    entities: extractEntities(item.title, item.description),
    scoringExplanation: buildScoringExplanation(result, item, hours, overallPct, momentumPct),
  };
}
