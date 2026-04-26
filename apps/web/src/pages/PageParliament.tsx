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
            Senate upcoming hearings are sourced from the live APH RSS feed.
            House Daily Program and Senate Dynamic Red are web pages, not RSS
            feeds — House chamber data is not available without scraping and
            will not appear here until that ingest is built. Division data is
            also not yet wired.
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
            <span className="panel-kicker">Awaiting ingest</span>
          </div>
          <div className="panel-body">
            {DIVISIONS.length === 0 ? (
              <div className="empty">
                <strong>Division ingest not yet wired.</strong>
                <span>
                  Division records will populate once the House and Senate
                  division feeds resume. Meanwhile, search ParlInfo:
                </span>
                <a
                  className="btn"
                  href="https://parlinfo.aph.gov.au/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 4 }}
                >
                  <Icon name="ext" size={13} /> ParlInfo
                </a>
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
