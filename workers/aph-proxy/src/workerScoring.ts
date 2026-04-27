// Server-side scoring engine — authority + recency only (no portfolio/watchlists).
//
// Portfolio scoring (0.35 weight) cannot run server-side because watchlists are
// stored client-side in localStorage.  The remaining four dimensions are
// renormalised to fill the 0-1 range so attention thresholds work as expected.
//
// Renormalised weights (portfolio excluded):
//   authority 0.25/0.65 ≈ 0.385   time 0.20/0.65 ≈ 0.308
//   novelty   0.10/0.65 ≈ 0.154   scrutiny 0.10/0.65 ≈ 0.154
//
// Thresholds unchanged: high ≥ 0.65, med ≥ 0.40.

const W_AUTH = 0.385;
const W_TIME = 0.308;
const W_NOV  = 0.154;
const W_SCR  = 0.154;

export type AttentionLevel = "high" | "med" | "low";

export interface WorkerScoreResult {
  attention:   AttentionLevel;
  confidence:  number;   // 1-3 (authority-only; no watchlist data)
  overallPct:  number;   // 0-100
  scoreJson:   string;
  entitiesJson: string;
  explanation: string;
}

function ageHours(pubDate: string | null, now: Date): number {
  if (!pubDate) return 48;
  return (now.getTime() - new Date(pubDate).getTime()) / 3_600_000;
}

function scoreTime(h: number): number {
  if (h < 4)      return 1;
  if (h < 24)     return 0.85;
  if (h < 48)     return 0.60;
  if (h < 24 * 7) return 0.35;
  return 0.15;
}

function scoreNovelty(h: number): number {
  if (h < 6)      return 1;
  if (h < 24)     return 0.8;
  if (h < 24 * 3) return 0.5;
  return 0.2;
}

function authorityFromKind(kind: string): number {
  const map: Record<string, number> = {
    inquiry: 0.90, report: 0.90, hearing: 0.85,
    division: 0.75, digest: 0.75, program: 0.65, signal: 0.65,
  };
  return map[kind] ?? 0.65;
}

function scoreScrutiny(title: string, kind: string): number {
  const kindW: Record<string, number> = {
    inquiry: 0.9, hearing: 0.8, division: 0.85, digest: 0.7,
    report: 0.75, program: 0.5, signal: 0.4,
  };
  const base = kindW[kind] ?? 0.4;
  const bump = /estimates|inquiry|hearing|scrutiny|review|report|audit/i.test(title) ? 0.1 : 0;
  return Math.min(1, base + bump);
}

function confidenceFromKind(kind: string): number {
  if (["inquiry", "report", "hearing"].includes(kind)) return 3;
  if (["digest", "division"].includes(kind)) return 2;
  return 1;
}

function extractEntities(title: string): Array<{ kind: string; text: string }> {
  const out: Array<{ kind: string; text: string }> = [];
  const seen = new Set<string>();
  const billRe = /\b([A-Z][A-Za-z ,()&'\-]{3,80}?Bill\s+\d{4})\b/g;
  const dollarRe = /\$[\d,]+(?:\.\d+)?\s*(?:million|billion|trillion|[mMbBkK])\b/gi;
  for (const m of title.matchAll(billRe)) {
    const t = (m[1] ?? "").trim();
    if (t && !seen.has(t)) { seen.add(t); out.push({ kind: "bill", text: t }); }
  }
  for (const m of title.matchAll(dollarRe)) {
    const t = m[0].trim();
    if (!seen.has(t)) { seen.add(t); out.push({ kind: "dollar", text: t }); }
  }
  return out.slice(0, 5);
}

// Momentum: 0-1 frequency trend. Computed server-side from D1 history by
// pollAndArchive and passed in. Weight is 0 so it does not move attention
// levels — it populates the score breakdown display only.
// Enable the weight by setting W_MOM > 0 and reducing other weights by the
// same amount once 14+ days of D1 history have accumulated (target: early May 2026).
const W_MOM = 0; // weight zero — display only
const W_AUTH_ADJ = W_AUTH; // unchanged until W_MOM is enabled

export function scoreForArchive(
  title: string,
  kind: string,
  pubDate: string | null,
  now: Date = new Date(),
  momentumHint = 0,
): WorkerScoreResult {
  const h = ageHours(pubDate, now);
  const auth = authorityFromKind(kind);
  const time = scoreTime(h);
  const nov  = scoreNovelty(h);
  const scr  = scoreScrutiny(title, kind);
  const mom  = Math.max(0, Math.min(1, momentumHint));

  const overall = auth * W_AUTH_ADJ + time * W_TIME + nov * W_NOV + scr * W_SCR + mom * W_MOM;
  const overallPct = Math.round(overall * 100);
  const attention: AttentionLevel = overall >= 0.65 ? "high" : overall >= 0.40 ? "med" : "low";
  const confidence = confidenceFromKind(kind);

  const scoreObj = {
    authority: Math.round(auth * 100) / 100,
    portfolio: 0,
    novelty:   Math.round(nov  * 100) / 100,
    momentum:  Math.round(mom  * 100) / 100,
    time:      Math.round(time * 100) / 100,
    scrutiny:  Math.round(scr  * 100) / 100,
    ops:       0,
  };

  const entities = extractEntities(title);
  const attWord = attention === "high" ? "High" : attention === "med" ? "Medium" : "Low";
  const ageStr  = h < 1 ? "within 1h" : h < 4 ? "within 4h" : h < 24 ? "today"
    : h < 48 ? "yesterday" : `${Math.round(h / 24)}d ago`;
  const momStr  = mom > 0 ? ` Momentum ${Math.round(mom * 100)}/100 (kind frequency trend).` : "";
  const explanation =
    `${attWord} attention (${overallPct}/100). Source: ${kind} (authority ${Math.round(auth * 100)}/100). ` +
    `Published ${ageStr}.${momStr} Portfolio scored client-side from watchlists.`;

  return {
    attention, confidence, overallPct,
    scoreJson: JSON.stringify(scoreObj),
    entitiesJson: JSON.stringify(entities),
    explanation,
  };
}

// Evaluate alert rules against a batch of newly-seen items.
// Returns (rule_id, signal_guid, fired_at, title, link, attention) tuples to insert.
const ATTN_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

export interface AlertRule {
  id: number;
  name: string;
  terms: string;
  attention_min: string;
  source_group: string | null;
  kind: string | null;
  active: number;
}

export interface NewItem {
  guid: string;
  title: string;
  link: string;
  kind: string;
  source_group: string;
  attention: AttentionLevel;
}

export function matchAlertRules(
  rules: AlertRule[],
  items: NewItem[],
  firedAt: string,
): Array<{ rule_id: number; signal_guid: string; fired_at: string; title: string; link: string; attention: string }> {
  const events: Array<{ rule_id: number; signal_guid: string; fired_at: string; title: string; link: string; attention: string }> = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    const terms = rule.terms.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const minRank = ATTN_RANK[rule.attention_min] ?? 0;
    for (const item of items) {
      if ((ATTN_RANK[item.attention] ?? 2) > minRank) continue;
      if (rule.source_group && item.source_group !== rule.source_group) continue;
      if (rule.kind && item.kind !== rule.kind) continue;
      if (terms.length > 0) {
        const lower = item.title.toLowerCase();
        if (!terms.some((t) => lower.includes(t))) continue;
      }
      events.push({ rule_id: rule.id, signal_guid: item.guid, fired_at: firedAt, title: item.title, link: item.link, attention: item.attention });
    }
  }
  return events;
}
