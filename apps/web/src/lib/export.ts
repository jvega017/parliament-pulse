// Pure-client export helpers for CSV and Markdown.
// All downloads go through Blob + URL.createObjectURL so no backend is involved.

import type { Signal } from "../types";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename: string, body: string, mime: string): void {
  const blob = new Blob([body], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSignalCsv(signal: Signal, owner?: string, feedback?: string): void {
  // Single-signal evidence matrix. One row per evidence link plus a header
  // with the score breakdown so the analyst can paste it into a brief.
  const headers = [
    "signal_id",
    "title",
    "date",
    "time",
    "source",
    "source_group",
    "attention",
    "confidence",
    "score_authority",
    "score_portfolio",
    "score_novelty",
    "score_momentum",
    "score_time",
    "score_scrutiny",
    "score_ops",
    "owner",
    "feedback",
    "evidence_label",
    "evidence_url",
  ];
  const baseRow = [
    signal.id,
    signal.title,
    signal.date,
    signal.time,
    signal.source,
    signal.sourceGroup,
    signal.attention,
    signal.confidence,
    signal.score.authority,
    signal.score.portfolio,
    signal.score.novelty,
    signal.score.momentum,
    signal.score.time,
    signal.score.scrutiny,
    signal.score.ops,
    owner ?? "",
    feedback ?? "",
  ];
  const rows: string[][] = [headers];
  if (signal.evidence.length === 0) {
    rows.push([...baseRow.map(String), "", ""]);
  } else {
    for (const e of signal.evidence) {
      rows.push([...baseRow.map(String), e.label, e.url]);
    }
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(`${signal.id}-evidence.csv`, csv, "text/csv");
}

// Relative time formatter for RSS item ages — "3 min ago", "2 h ago", etc.
export function formatRelative(d: Date | null, now: Date = new Date()): string {
  if (!d) return "—";
  const diffMs = now.getTime() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function exportSignalsDigestCsv(filename: string, signals: Signal[]): void {
  const headers = [
    "signal_id",
    "title",
    "attention",
    "confidence",
    "source",
    "date",
    "time",
    "action",
    "first_evidence_url",
  ];
  const rows = [headers];
  for (const s of signals) {
    rows.push([
      s.id,
      s.title,
      s.attention,
      String(s.confidence),
      s.source,
      s.date,
      s.time,
      s.action,
      s.evidence[0]?.url ?? "",
    ]);
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(filename, csv, "text/csv");
}

export function buildBriefMarkdown(
  signal: Signal,
  scoreLabels: Record<string, string>,
): string {
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lines: string[] = [];
  lines.push(`# ${signal.title}`);
  lines.push("");
  lines.push(
    `**Parliament Pulse · Executive brief** · ${today} · ${signal.id} · Confidence ${signal.confidence}/5 · Attention **${signal.attention.toUpperCase()}**`,
  );
  lines.push("");
  lines.push("## Recommended action (BLUF)");
  lines.push(`**${signal.action}.** ${signal.actionReason}`);
  lines.push("");
  lines.push("## Why it matters");
  lines.push(signal.attentionReason);
  lines.push("");
  lines.push("## Summary");
  lines.push(signal.summary);
  lines.push("");
  lines.push("## What happened");
  const watchlistMatches = signal.tags.filter((t) => t.c === "brass").map((t) => t.l).join(", ");
  lines.push(
    `${signal.source} published this item on ${signal.date} at ${signal.time}. ` +
    `Source authority: ${signal.sourceAuthority}. ` +
    (watchlistMatches ? `Matched watchlists: ${watchlistMatches}. ` : "No watchlist terms matched. ") +
    `Access the primary source via the Evidence links below.`,
  );
  lines.push("");
  lines.push("## Evidence");
  for (const e of signal.evidence) {
    lines.push(`- [${e.label}](${e.url})`);
  }
  lines.push("");
  lines.push("## Attention score breakdown");
  lines.push("| Dimension | Score |");
  lines.push("|---|---:|");
  for (const [k, v] of Object.entries(signal.score)) {
    lines.push(`| ${scoreLabels[k] ?? k} | ${Math.round(v * 100)} / 100 |`);
  }
  lines.push("");
  if (signal.provenance.length > 0) {
    lines.push("## Provenance");
    lines.push("| Time | By | Event |");
    lines.push("|---|---|---|");
    for (const p of signal.provenance) {
      lines.push(`| ${p.ts} | ${p.by} | ${p.event} |`);
    }
    lines.push("");
  }
  lines.push("## Uncertainty");
  lines.push(
    `Source authority: ${signal.sourceAuthority}. Analyst confidence: ${signal.confidence}/5. This brief is generated from an automated scoring pipeline and requires human review before release.`,
  );
  lines.push("");
  lines.push("## Human review");
  lines.push(`**${signal.humanReview}.** To be cleared by the nominated policy owner before issue.`);
  lines.push("");
  lines.push("---");
  lines.push("Source: Parliament of Australia website. Generated by Parliament Pulse.");
  return lines.join("\n");
}
