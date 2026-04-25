import { useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
interface BriefRow {
  type: string;
  for: string;
  signalId: string;
  isLive: boolean;
}

// Static queue templates; signalId is filled in dynamically below from
// liveSignals when available, so the queue stays connected to real data
// instead of permanently pointing at the same fixture ids.
const QUEUE_TEMPLATE = [
  { type: "Daily Signal Brief", for: "DDG Digital" },
  { type: "Committee Brief", for: "Procurement lead" },
  { type: "Bill Digest Note", for: "Identity policy" },
  { type: "Estimates Monitor Note", for: "Estimates pack" },
];

const SAMPLE_FALLBACK_IDS = ["CS-0412", "CS-0409", "CS-0410", "CS-0408"];

export function PageBriefings(): JSX.Element {
  const [sel, setSel] = useState(0);
  const { openBrief, briefStatus, setBriefStatus, liveSignals } = useStore();

  // Build the queue from live signals where possible; fall back to the
  // sample fixture ids so the page renders before the first poll lands.
  const liveByAttention = [...liveSignals].sort((a, b) => {
    const rank = { high: 0, med: 1, low: 2 } as const;
    return rank[a.attention] - rank[b.attention];
  });
  const briefs: BriefRow[] = QUEUE_TEMPLATE.map((t, i) => {
    const live = liveByAttention[i];
    if (live) return { ...t, signalId: live.id, isLive: true };
    return { ...t, signalId: SAMPLE_FALLBACK_IDS[i] ?? SAMPLE_FALLBACK_IDS[0]!, isLive: false };
  });
  const current = briefs[sel]!;
  const status = briefStatus[current.signalId] ?? "draft";
  const topLiveHigh =
    liveSignals.find((s) => s.attention === "high") ?? liveSignals[0] ?? null;

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Briefings</h1>
          <div className="page-sub">
            Every brief follows a required structure: What happened, Source, Why
            it matters, Recommended action, Evidence, Uncertainty, Human review.
          </div>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!topLiveHigh}
          title={
            topLiveHigh
              ? "Open a new brief from the top live high-attention signal"
              : "Waiting for live signals"
          }
          onClick={() => {
            if (topLiveHigh) openBrief(topLiveHigh.id);
          }}
        >
          <Icon name="plus" size={13} /> New brief from top live
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Queue</h3>
            <span className="panel-kicker">
              {briefs.filter((b) => (briefStatus[b.signalId] ?? "draft") !== "approved").length} pending ·{" "}
              {briefs.length} total
            </span>
          </div>
          <div>
            {briefs.map((b, i) => {
              const itemStatus = briefStatus[b.signalId] ?? "draft";
              const statusColour =
                itemStatus === "approved"
                  ? "var(--brass)"
                  : itemStatus === "sent"
                    ? "var(--teal)"
                    : "var(--info)";
              return (
                <button
                  key={i}
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
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{b.type}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    For {b.for} ·{" "}
                    <span style={{ color: b.isLive ? "var(--teal)" : "var(--ink-4)" }}>
                      {b.isLive ? "live signal" : "sample"}
                    </span>
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
                    {itemStatus}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">{current.type}</h3>
            <span className="panel-kicker">Preview · for {current.for}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn ghost sm"
                title="Open the print-ready brief and use the browser to save as PDF"
                onClick={() => openBrief(current.signalId)}
              >
                <Icon name="download" size={12} /> Open / Save PDF
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={status === "sent" || status === "approved"}
                onClick={() => setBriefStatus(current.signalId, "sent")}
              >
                Send
              </button>
              <button
                type="button"
                className="btn primary sm"
                disabled={status === "approved"}
                onClick={() => setBriefStatus(current.signalId, "approved")}
              >
                Approve
              </button>
            </div>
          </div>
          <div className="panel-body">
            <div className="brief">
              <div className="meta">
                PARLIAMENT PULSE · {current.type.toUpperCase()} ·{" "}
                {new Date().toLocaleString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </div>
              <h3>New Senate inquiry: Digital procurement governance</h3>
              <h5>What happened</h5>
              <div>
                The Finance and Public Administration References Committee has
                opened an inquiry into Commonwealth procurement and contract
                governance for digital programs over $100m. Submissions close 19
                May.
              </div>
              <h5>Source</h5>
              <div>
                APH Senate New Inquiries RSS · Official · validated 24 Apr 08:15.
              </div>
              <h5>Why it matters</h5>
              <div>
                The inquiry directly overlaps two watchlists (Digital procurement,
                Procurement) and follows last week's ANAO report tabling.
                Preliminary scrutiny pattern detected on the same topic (4 QONs,
                3 members, 48h).
              </div>
              <h5>Recommended action</h5>
              <div>
                <strong>Assign policy owner.</strong> Draft submission plan by 02
                May. Coordinate with Legal on contract-variation data scope.
              </div>
              <h5>Evidence</h5>
              <ul>
                <li>APH, inquiry listing (primary)</li>
                <li>ANAO, performance audit report 2025-26/41</li>
                <li>Internal, existing procurement governance framework v4.2</li>
              </ul>
              <h5>Uncertainty</h5>
              <div>
                The inquiry's terms of reference may expand during hearings.
                Confidence: Medium.
              </div>
              <h5>Human review</h5>
              <div>Required, to be cleared by Director, Digital Strategy.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
