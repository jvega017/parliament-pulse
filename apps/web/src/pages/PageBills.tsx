import { Icon } from "../icons";
import { Att } from "../shell/common";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { BILLS, DIVISIONS } from "../data/fixtures";

export function PageBills(): JSX.Element {
  const { openModal, state } = useStore();

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Bills Intelligence</div>
          <h1 className="page-title">Bills intelligence</h1>
          <div className="page-sub">
            Click a bill for full details, provisions and timeline. Assign a
            policy owner directly from the bill detail.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn" disabled>
            <Icon name="download" size={13} /> Export register
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => openModal({ kind: "bill", id: "BILL-2026-048" })}
          >
            <Icon name="brief" size={13} /> Open flagship bill
          </button>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Tracked bills</h3>
            <span className="panel-kicker">5 of 38 watchlisted</span>
          </div>
          <table className="ds">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title</th>
                <th>Stage</th>
                <th>Portfolio</th>
                <th>Digest</th>
                <th>Owner</th>
                <th>Attn</th>
              </tr>
            </thead>
            <tbody>
              {BILLS.map((b) => {
                const owner = state.owners[b.ref] ?? b.owner;
                const ownerOverridden = owner !== b.owner && owner !== "—";
                return (
                  <tr key={b.ref} onClick={() => openModal({ kind: "bill", id: b.ref })}>
                    <td className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {b.ref}
                    </td>
                    <td style={{ fontWeight: 500 }}>{b.title}</td>
                    <td style={{ color: "var(--ink-2)" }}>{b.stage}</td>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {b.portfolio}
                    </td>
                    <td>
                      {b.digest === "Published" ? (
                        <span className="tag teal">Published</span>
                      ) : (
                        <span className="tag">Pending</span>
                      )}
                    </td>
                    <td style={{ color: ownerOverridden ? "var(--ok)" : "var(--ink-2)" }}>
                      {owner}
                    </td>
                    <td>
                      <Att level={b.att} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Related divisions</h3>
            <span className="panel-kicker">House · last 7 days</span>
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
                  {d.when} · {d.chamber} · {d.bill}
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
