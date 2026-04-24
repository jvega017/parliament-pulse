import { useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";

const BRIEFS = [
  { type: "Daily Signal Brief", for: "DDG Digital", status: "Drafted" as const },
  { type: "Committee Brief", for: "Procurement lead", status: "Awaiting review" as const },
  { type: "Bill Digest Note", for: "Identity policy", status: "Drafted" as const },
  { type: "Estimates Monitor Note", for: "Estimates pack", status: "In progress" as const },
];

export function PageBriefings(): JSX.Element {
  const [sel, setSel] = useState(0);
  const { toast } = useStore();
  const current = BRIEFS[sel]!;

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
          onClick={() => toast("New brief opened", "brass")}
        >
          <Icon name="plus" size={13} /> New brief
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Queue</h3>
            <span className="panel-kicker">4 pending</span>
          </div>
          <div>
            {BRIEFS.map((b, i) => (
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
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>For {b.for}</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    marginTop: 4,
                    color:
                      b.status === "Drafted"
                        ? "var(--ok)"
                        : b.status === "In progress"
                          ? "var(--caution)"
                          : "var(--info)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {b.status}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">{current.type} · preview</h3>
            <span className="panel-kicker">For {current.for}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => toast("PDF exported")}
              >
                <Icon name="download" size={12} /> PDF
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => toast("Brief sent")}
              >
                Send
              </button>
              <button
                type="button"
                className="btn primary sm"
                onClick={() => toast("Brief approved", "brass")}
              >
                Approve
              </button>
            </div>
          </div>
          <div className="panel-body">
            <div className="brief">
              <div className="meta">
                PARLIAMENT PULSE · {current.type.toUpperCase()} · 24 APR 2026 · 08:20
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
