import { useMemo } from "react";
import { Icon } from "../icons";
import { Att } from "../shell/common";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { ENTITIES } from "../data/entities";
import type { Signal } from "../types";

// Derive committee-level activity from the live signal stream. Anything
// matching kind=inquiry/hearing/report and tagged Senate/Library/Joint shows
// up here. No fixture seeding.
function liveCommitteeRows(signals: Signal[]): Array<{
  signal: Signal;
  type: "Hearing" | "Report tabled" | "New inquiry";
}> {
  return signals
    .map((s): { signal: Signal; type: "Hearing" | "Report tabled" | "New inquiry" } | null => {
      const lower = s.source.toLowerCase();
      if (lower.includes("hearing")) return { signal: s, type: "Hearing" };
      if (lower.includes("report")) return { signal: s, type: "Report tabled" };
      if (lower.includes("inquir")) return { signal: s, type: "New inquiry" };
      return null;
    })
    .filter((row): row is { signal: Signal; type: "Hearing" | "Report tabled" | "New inquiry" } => row !== null);
}

export function PageCommittees(): JSX.Element {
  const { openSignal, openModal, liveSignals } = useStore();
  const committees = useMemo(() => Object.values(ENTITIES.committees), []);
  const rows = useMemo(() => liveCommitteeRows(liveSignals), [liveSignals]);

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Committees</h1>
          <div className="page-sub">
            Live committee activity from the Senate inquiries, reports, and
            upcoming-hearings feeds. Reference directory below links to each
            committee's authoritative APH page.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            className="btn"
            href="https://www.aph.gov.au/Parliamentary_Business/Committees"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> All APH committees
          </a>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3 className="panel-title">Live committee activity</h3>
          <span className="panel-kicker">
            {rows.length === 0 ? "No items yet" : `${rows.length} from RSS`}
          </span>
        </div>
        <div className="panel-body">
          {rows.length === 0 ? (
            <div className="empty">
              <strong>No committee items in the current poll.</strong>
              <span>
                The Senate inquiries, reports, and upcoming-hearings feeds are
                being polled. Items appear here once published.
              </span>
            </div>
          ) : (
            <table className="ds">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Committee / signal</th>
                  <th>Attention</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ signal, type }) => (
                  <tr key={signal.id} onClick={() => openSignal(signal.id)}>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                      {signal.date} · {signal.time}
                    </td>
                    <td>
                      <span className="tag">{type}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{signal.title}</div>
                      <div style={{ color: "var(--ink-3)", fontSize: 12 }}>
                        {signal.source}
                      </div>
                    </td>
                    <td>
                      <Att level={signal.attention} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Committee reference directory</h3>
          <span className="panel-kicker">{committees.length} committees</span>
        </div>
        <div className="panel-body">
          <p style={{ color: "var(--ink-3)", fontSize: 12, marginTop: 0 }}>
            Real public APH committees. Member counts, chairs, hearings and
            active inquiries are intentionally not pre-populated. Click for the
            committee bio plus a deep link to the authoritative APH page.
          </p>
          <table className="ds">
            <thead>
              <tr>
                <th>Committee</th>
                <th>Chamber</th>
                <th>Portfolio scope</th>
                <th>APH page</th>
              </tr>
            </thead>
            <tbody>
              {committees.map((c) => (
                <tr key={c.id} onClick={() => openModal({ kind: "committee", id: c.id })}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>
                    <span className="tag">{c.chamber}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    {c.portfolio}
                  </td>
                  <td>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono"
                      style={{ fontSize: 11, color: "var(--teal)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
