import { useMemo } from "react";
import { Att } from "../shell/common";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { Icon } from "../icons";
import type { AttentionLevel, Signal } from "../types";

interface RadarRow {
  issue: string;
  att: AttentionLevel;
  reason: string;
  sources: number;
  momentum: number;
  confidence: number;
  signals: Signal[];
}

// Derive radar issues from the live signal stream by clustering on the
// dominant brass-tagged label (the watchlist match). Pure runtime — no
// fixture seeding. Issues without a watchlist tag fall back to source.
function clusterLiveSignals(signals: Signal[]): RadarRow[] {
  const buckets = new Map<string, Signal[]>();
  for (const s of signals) {
    const key =
      s.tags.find((t) => t.c === "brass")?.l ?? s.source ?? "Unscoped";
    const list = buckets.get(key) ?? [];
    list.push(s);
    buckets.set(key, list);
  }

  const rows: RadarRow[] = [];
  for (const [issue, list] of buckets.entries()) {
    const high = list.filter((s) => s.attention === "high").length;
    const med = list.filter((s) => s.attention === "med").length;
    const att: AttentionLevel = high > 0 ? "high" : med > 0 ? "med" : "low";
    const momentum = Math.min(1, list.length / 6);
    const confidence =
      list.reduce((acc, s) => acc + s.confidence, 0) / (list.length * 5);
    const reason =
      `${list.length} live ${list.length === 1 ? "signal" : "signals"}` +
      (high > 0 ? `, ${high} high attention` : "") +
      (med > 0 ? `, ${med} medium` : "");
    rows.push({ issue, att, reason, sources: list.length, momentum, confidence, signals: list });
  }
  rows.sort((a, b) => {
    const ord = { high: 0, med: 1, low: 2 } as const;
    if (ord[a.att] !== ord[b.att]) return ord[a.att] - ord[b.att];
    return b.sources - a.sources;
  });
  return rows;
}

export function PageRadar(): JSX.Element {
  const { openSignal, liveSignals } = useStore();
  const rows = useMemo(() => clusterLiveSignals(liveSignals), [liveSignals]);

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Attention radar</h1>
          <div className="page-sub">
            Live clusters from the APH RSS pump grouped by watchlist match.
            Click any cluster to open the lead signal.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Active clusters</h3>
          <span className="panel-kicker">
            {rows.length === 0 ? "Awaiting first poll" : `${rows.length} clusters · live`}
          </span>
        </div>
        <div className="panel-body">
          {rows.length === 0 ? (
            <div className="empty">
              <strong>No clusters yet.</strong>
              <span>
                Clusters appear once the APH RSS pump returns items that match
                a watchlist or share a source. Try refreshing, or open the live
                feed directly.
              </span>
              <a
                className="btn"
                href="https://www.aph.gov.au/Help/RSS_feeds"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 4 }}
              >
                <Icon name="ext" size={13} /> APH RSS directory
              </a>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 80px 120px 140px",
                  padding: "4px 0 10px",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <HeaderCell>Cluster</HeaderCell>
                <HeaderCell>Attention</HeaderCell>
                <HeaderCell align="right">Signals</HeaderCell>
                <HeaderCell>Volume</HeaderCell>
                <HeaderCell>Confidence</HeaderCell>
              </div>
              {rows.map((r, i) => (
                <button
                  key={r.issue}
                  type="button"
                  className="clk"
                  onClick={() => {
                    const lead = r.signals[0];
                    if (lead) openSignal(lead.id);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 80px 120px 140px",
                    padding: "14px 8px",
                    borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : 0,
                    gap: 14,
                    alignItems: "center",
                    borderRadius: 6,
                    width: "100%",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.issue}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                      {r.reason}
                    </div>
                  </div>
                  <div>
                    <Att level={r.att} />
                  </div>
                  <div className="mono" style={{ textAlign: "right", color: "var(--ink-2)" }}>
                    {r.sources}
                  </div>
                  <div>
                    <div className="bar">
                      <div className="fill" style={{ width: `${r.momentum * 100}%` }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      className="ring"
                      style={{ ["--p" as string]: Math.round(r.confidence * 100) } as React.CSSProperties}
                      data-p={Math.round(r.confidence * 100)}
                    />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}): JSX.Element {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10.5,
        color: "var(--ink-3)",
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
}
