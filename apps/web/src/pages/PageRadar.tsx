import { Att } from "../shell/common";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { RADAR } from "../data/fixtures";

export function PageRadar(): JSX.Element {
  const { openModal } = useStore();

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Attention radar</h1>
          <div className="page-sub">
            Transparent categories, no fake precision scores. Click any issue
            for momentum detail and suggested actions.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Active issues</h3>
          <span className="panel-kicker">Last 7 days</span>
        </div>
        <div className="panel-body">
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
            <HeaderCell>Issue</HeaderCell>
            <HeaderCell>Attention</HeaderCell>
            <HeaderCell align="right">Sources</HeaderCell>
            <HeaderCell>Momentum</HeaderCell>
            <HeaderCell>Confidence</HeaderCell>
          </div>
          {RADAR.map((r, i) => (
            <button
              key={i}
              type="button"
              className="clk"
              onClick={() => openModal({ kind: "radar", id: r.issue })}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 80px 120px 140px",
                padding: "14px 8px",
                borderBottom:
                  i < RADAR.length - 1 ? "1px solid var(--line)" : 0,
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
