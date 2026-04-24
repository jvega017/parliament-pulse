import { Icon } from "../icons";
import { Att } from "../shell/common";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { COMMITTEE_ITEMS } from "../data/fixtures";
import { committeeIdFromName } from "../data/entities";
import type { CommitteeItem } from "../types";

export function PageCommittees(): JSX.Element {
  const { openModal } = useStore();
  const today = COMMITTEE_ITEMS.filter((i) => i.when.startsWith("Today"));
  const upcoming = COMMITTEE_ITEMS.filter(
    (i) => !i.when.startsWith("Today") && !i.when.startsWith("Yesterday"),
  );
  const recent = COMMITTEE_ITEMS.filter((i) => i.when.startsWith("Yesterday"));

  const CommitteeTable = ({
    rows,
    compact,
  }: {
    rows: CommitteeItem[];
    compact?: boolean;
  }): JSX.Element => (
    <table className="ds">
      <thead>
        <tr>
          <th>When</th>
          <th>Type</th>
          <th>Committee</th>
          {!compact && <th>Topic</th>}
          <th>Portfolio</th>
          <th>Attention</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const cid = committeeIdFromName(r.name);
          return (
            <tr
              key={i}
              onClick={() => cid && openModal({ kind: "committee", id: cid })}
            >
              <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                {r.when}
              </td>
              <td>
                <span className="tag">{r.type}</span>
              </td>
              <td>
                {r.name}
                {compact && (
                  <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{r.topic}</div>
                )}
              </td>
              {!compact && <td>{r.topic}</td>}
              <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                {r.portfolio}
              </td>
              <td>
                <Att level={r.att} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Committees</h1>
          <div className="page-sub">
            Powered by Senate and House committee feeds. Click any row to open
            the committee with hearings, inquiries and prep pack.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn" disabled>
            <Icon name="filter" size={13} /> Filter
          </button>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 18 }}>
        <div className="panel stat">
          <div className="stat-label">Today</div>
          <div className="stat-value">
            {today.length}
            <span className="unit">hearings</span>
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Upcoming · 7 days</div>
          <div className="stat-value">
            {upcoming.length}
            <span className="unit">hearings</span>
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Reports tabled · 30 days</div>
          <div className="stat-value">5</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3 className="panel-title">Today's hearings</h3>
          <span className="panel-kicker">{today.length} items</span>
        </div>
        <CommitteeTable rows={today} />
      </div>

      <div className="grid g-2">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Upcoming hearings</h3>
            <span className="panel-kicker">Next 7 days</span>
          </div>
          <CommitteeTable rows={upcoming} compact />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Recently tabled / opened</h3>
            <span className="panel-kicker">Last 48h</span>
          </div>
          <CommitteeTable rows={recent} compact />
        </div>
      </div>
    </div>
  );
}
