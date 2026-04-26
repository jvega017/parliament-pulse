import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { DIVISIONS } from "../data/fixtures";

export function PageParliament(): JSX.Element {
  const { openModal, openSignal, liveSignals } = useStore();
  // Today-in-chamber items: anything from House Daily Program, Senate Dynamic
  // Red, or upcoming hearings feeds. Pure live derivation.
  const today = liveSignals.filter((s) => {
    const lower = s.source.toLowerCase();
    return (
      lower.includes("daily program") ||
      lower.includes("dynamic red") ||
      lower.includes("upcoming") ||
      lower.includes("hearing") ||
      lower.includes("today")
    );
  });

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Today in chamber</h1>
          <div className="page-sub">
            Senate upcoming hearings update via live APH RSS. House Daily Program
            and Senate Dynamic Red publish as web pages only — open the authoritative
            links to the right for today's full order of business and division results.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            className="btn"
            href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR/House_Daily_Program"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> House Daily Program
          </a>
          <a
            className="btn"
            href="https://parlwork.aph.gov.au/Senate/DynamicRed"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> Senate Dynamic Red
          </a>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Live chamber items</h3>
            <span className="panel-kicker">
              {today.length === 0 ? "Awaiting poll" : `${today.length} items`}
            </span>
          </div>
          <div className="panel-body">
            {today.length === 0 ? (
              <div className="empty">
                <strong>No chamber items in the current poll.</strong>
                <span>
                  Items appear when the House Daily Program, Senate Dynamic Red,
                  or upcoming-hearings feeds publish today's order of business.
                </span>
              </div>
            ) : (
              <div className="timeline">
                {today.map((s) => (
                  <div
                    key={s.id}
                    className={`tl-item${
                      s.attention === "high"
                        ? " brass"
                        : s.attention === "med"
                          ? " info"
                          : " teal"
                    }`}
                  >
                    <div className="tl-time">{s.time} · {s.sourceGroup}</div>
                    <div className="tl-body">
                      <button
                        type="button"
                        className="clk"
                        onClick={() => openSignal(s.id)}
                        style={{ padding: 0, color: "var(--ink)", textAlign: "left" }}
                      >
                        {s.title}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Recent divisions</h3>
            <span className="panel-kicker">Links to authoritative source</span>
          </div>
          <div className="panel-body">
            {DIVISIONS.length === 0 ? (
              <div className="empty">
                <strong>Division results are published by APH.</strong>
                <span>
                  House and Senate vote records update after each sitting day.
                  Open the authoritative sources below:
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                  <a
                    className="btn"
                    href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR/Divisions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> House Divisions
                  </a>
                  <a
                    className="btn"
                    href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate/Votes_and_proceedings"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> Senate Votes &amp; Proceedings
                  </a>
                </div>
              </div>
            ) : (
              DIVISIONS.map((d, i) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
