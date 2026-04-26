import { useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import type { Signal } from "../types";

const QUEUE_TYPES: Record<string, { type: string; for: string }> = {
  high: { type: "Daily Signal Brief", for: "DDG / Director" },
  med: { type: "Watchlist Digest Note", for: "Policy team" },
  low: { type: "Archive Note", for: "Records" },
};

export function PageBriefings(): JSX.Element {
  const [sel, setSel] = useState(0);
  const { openBrief, briefStatus, setBriefStatus, liveSignals } = useStore();

  // Queue is built directly from the live signal stream, ranked by attention.
  // No fake briefs; if there are no live signals, the page shows an empty
  // state pointing at APH.
  const ranked = [...liveSignals].sort((a, b) => {
    const rank = { high: 0, med: 1, low: 2 } as const;
    return rank[a.attention] - rank[b.attention];
  });
  const queue = ranked.slice(0, 8);
  const current: Signal | undefined = queue[Math.min(sel, queue.length - 1)];
  const meta = current ? QUEUE_TYPES[current.attention] : null;
  const status = current ? (briefStatus[current.id] ?? "draft") : "draft";
  const topLiveHigh =
    liveSignals.find((s) => s.attention === "high") ?? liveSignals[0] ?? null;

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Briefings</h1>
          <div className="page-sub">
            Every brief follows: What happened · Source · Why it matters ·
            Recommended action · Evidence · Uncertainty · Human review. Queue
            is built from the live RSS stream.
          </div>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!topLiveHigh}
          title={
            topLiveHigh
              ? "Open a print-ready brief from the top live high-attention signal"
              : "Waiting for live signals"
          }
          onClick={() => {
            if (topLiveHigh) openBrief(topLiveHigh.id);
          }}
        >
          <Icon name="plus" size={13} /> New brief from top live
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="empty">
          <strong>Briefing queue is empty.</strong>
          <span>
            Queue items are built from the live RSS pump. Once the first poll
            returns items, they appear here ranked by attention.
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
        <div className="grid" style={{ gridTemplateColumns: "320px 1fr", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Queue</h3>
              <span className="panel-kicker">
                {queue.filter((s) => (briefStatus[s.id] ?? "draft") !== "approved").length} pending ·{" "}
                {queue.length} total
              </span>
            </div>
            <div>
              {queue.map((s, i) => {
                const m = QUEUE_TYPES[s.attention]!;
                const itemStatus = briefStatus[s.id] ?? "draft";
                const statusColour =
                  itemStatus === "approved"
                    ? "var(--brass)"
                    : itemStatus === "sent"
                      ? "var(--teal)"
                      : "var(--info)";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSel(i)}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--line)",
                      cursor: "pointer",
                      background: sel === i ? "#e093590c" : "transparent",
                      borderLeft:
                        sel === i ? "2px solid var(--brass)" : "2px solid transparent",
                      width: "100%",
                      textAlign: "left",
                      font: "inherit",
                      color: "inherit",
                    }}
                    aria-current={sel === i ? "true" : undefined}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.type}</div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        marginTop: 4,
                        color: statusColour,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {itemStatus} · {s.attention.toUpperCase()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {current && meta && (
            <div className="panel">
              <div className="panel-head">
                <h3 className="panel-title">{meta.type}</h3>
                <span className="panel-kicker">Preview · for {meta.for}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn ghost sm"
                    title="Open the print-ready brief and use the browser to save as PDF"
                    onClick={() => openBrief(current.id)}
                  >
                    <Icon name="download" size={12} /> Open / Save PDF
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={status === "sent" || status === "approved"}
                    onClick={() => setBriefStatus(current.id, "sent")}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={status === "approved"}
                    onClick={() => setBriefStatus(current.id, "approved")}
                  >
                    Approve
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="brief">
                  <div className="meta">
                    PARLIAMENT PULSE · {meta.type.toUpperCase()} · {current.date} {current.time}
                  </div>
                  <h3>{current.title}</h3>
                  <h5>What happened</h5>
                  <div>{current.summary}</div>
                  <h5>Source</h5>
                  <div>
                    {current.source} · {current.sourceAuthority} · validated{" "}
                    {current.date} {current.time}.
                  </div>
                  <h5>Why it matters</h5>
                  <div>{current.attentionReason}</div>
                  <h5>Recommended action</h5>
                  <div>
                    <strong>{current.action}.</strong> {current.actionReason}
                  </div>
                  <h5>Evidence</h5>
                  <ul>
                    {current.evidence.map((e) => (
                      <li key={e.url}>
                        <a href={e.url} target="_blank" rel="noopener noreferrer">
                          {e.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <h5>Uncertainty</h5>
                  <div>
                    Confidence {current.confidence}/5. Human review:{" "}
                    {current.humanReview.toLowerCase()}.
                  </div>
                  <h5>Human review</h5>
                  <div>
                    {current.humanReview === "Required"
                      ? "Required before issue."
                      : "Optional. Auto-approve eligible."}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
