import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { QON_PATTERN } from "../data/fixtures";

export function PagePatterns(): JSX.Element {
  const { openBrief, liveSignals } = useStore();
  const topLiveHigh = liveSignals.find((s) => s.attention === "high") ?? liveSignals[0] ?? null;

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence · Scrutiny</div>
          <h1 className="page-title">QON pattern engine</h1>
          <div className="page-sub">
            Detects clustered scrutiny across members, topics and targets.
            Requires a live Hansard QON ingest, which is not yet wired.
          </div>
        </div>
      </div>

      {QON_PATTERN === null ? (
        <div className="empty">
          <strong>No QON cluster detected yet.</strong>
          <span>
            The pattern engine activates once the Hansard Questions on Notice
            ingest is connected. Until then, search live QONs on ParlInfo:
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            <a
              className="btn primary"
              href="https://parlinfo.aph.gov.au/parlInfo/search/search.w3p;query=Dataset%3Aqon"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="ext" size={13} /> Search QONs on ParlInfo
            </a>
            <a
              className="btn"
              href="https://www.aph.gov.au/Parliamentary_Business/Hansard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="ext" size={13} /> Open Hansard hub
            </a>
            {topLiveHigh && (
              <button
                type="button"
                className="btn"
                onClick={() => openBrief(topLiveHigh.id)}
                title="Build a print-ready brief from the top live signal"
              >
                <Icon name="brief" size={13} /> Draft brief from top live signal
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
