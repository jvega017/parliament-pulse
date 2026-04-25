import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { DIVISIONS } from "../data/fixtures";

export function PageParliament(): JSX.Element {
  const { openModal } = useStore();
  const program: Array<[string, string, string | null]> = [
    ["09:30", "House meets", null],
    [
      "10:00",
      "Government business: 2nd reading — Cyber Security Legislation Amendment Bill 2026",
      "BILL-2026-041",
    ],
    ["11:15", "Matter of public importance", null],
    ["12:00", "Question time", null],
    ["14:00", "Private members' business", null],
    ["16:30", "Adjournment debate", null],
  ];

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Today in chamber</h1>
          <div className="page-sub">
            Daily program, divisions, and chamber-relevant items from official
            APH feeds.
          </div>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">House · daily program</h3>
            <span className="panel-kicker">24 Apr 2026</span>
          </div>
          <div className="panel-body">
            <div className="timeline">
              {program.map(([t, body, billRef], i) => (
                <div key={i} className={`tl-item${billRef ? "" : " teal"}`}>
                  <div className="tl-time">{t}</div>
                  <div className="tl-body">
                    {billRef ? (
                      <button
                        type="button"
                        className="clk"
                        onClick={() => openModal({ kind: "bill", id: billRef })}
                        style={{ padding: 0, color: "var(--ink)" }}
                      >
                        {body}
                      </button>
                    ) : (
                      body
                    )}
                    {billRef && (
                      <span className="tag brass" style={{ marginLeft: 8 }}>
                        Watchlist · Cyber
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Recent divisions</h3>
            <span className="panel-kicker">House</span>
          </div>
          <div className="panel-body">
            {DIVISIONS.map((d, i) => (
              <button
                key={i}
                type="button"
                className="clk"
                onClick={() => openModal({ kind: "division", id: d })}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 8px",
                  borderBottom:
                    i < DIVISIONS.length - 1 ? "1px solid var(--line)" : 0,
                  borderRadius: 6,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {d.when} · {d.bill}
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{d.q}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: d.result.startsWith("Agreed")
                      ? "var(--ok)"
                      : "var(--escalate)",
                    marginTop: 2,
                  }}
                >
                  {d.result}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
