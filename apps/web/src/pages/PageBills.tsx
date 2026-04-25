import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { Att } from "../shell/common";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { BILLS, DIVISIONS } from "../data/fixtures";
import type { BillSummary } from "../types";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBillsCsv(bills: BillSummary[], owners: Record<string, string>): void {
  const rows = [
    ["ref", "title", "stage", "portfolio", "digest", "owner", "attention"],
    ...bills.map((b) => [
      b.ref,
      b.title,
      b.stage,
      b.portfolio,
      b.digest,
      owners[b.ref] ?? b.owner,
      b.att,
    ]),
  ];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bills-register-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type SortKey = "ref" | "title" | "stage" | "portfolio" | "att";
type SortDir = "asc" | "desc";

const ATT_ORDER = { high: 0, med: 1, low: 2 } as const;

export function PageBills(): JSX.Element {
  const { openModal, state, toast } = useStore();
  const [sortKey, setSortKey] = useState<SortKey>("att");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedBills = useMemo(() => {
    const copy = [...BILLS];
    copy.sort((a, b) => {
      let d = 0;
      if (sortKey === "att") d = ATT_ORDER[a.att] - ATT_ORDER[b.att];
      else d = String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortDir === "asc" ? d : -d;
    });
    return copy;
  }, [sortKey, sortDir]);

  const onSort = (k: SortKey): void => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const sortArrow = (k: SortKey): string =>
    sortKey !== k ? "" : sortDir === "asc" ? " ▲" : " ▼";

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Bills intelligence</h1>
          <div className="page-sub">
            Click a bill for full details, provisions and timeline. Assign a
            policy owner from the bill detail.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              downloadBillsCsv(BILLS, state.owners);
              toast("Bills register downloaded as CSV", "brass");
            }}
            title="Download the tracked bills register as CSV"
          >
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
                <th>
                  <button
                    type="button"
                    className="clk"
                    onClick={() => onSort("ref")}
                    style={{ padding: 0, color: "inherit", font: "inherit" }}
                  >
                    Ref{sortArrow("ref")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="clk"
                    onClick={() => onSort("title")}
                    style={{ padding: 0, color: "inherit", font: "inherit" }}
                  >
                    Title{sortArrow("title")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="clk"
                    onClick={() => onSort("stage")}
                    style={{ padding: 0, color: "inherit", font: "inherit" }}
                  >
                    Stage{sortArrow("stage")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="clk"
                    onClick={() => onSort("portfolio")}
                    style={{ padding: 0, color: "inherit", font: "inherit" }}
                  >
                    Portfolio{sortArrow("portfolio")}
                  </button>
                </th>
                <th>Digest</th>
                <th>Owner</th>
                <th>
                  <button
                    type="button"
                    className="clk"
                    onClick={() => onSort("att")}
                    style={{ padding: 0, color: "inherit", font: "inherit" }}
                  >
                    Attn{sortArrow("att")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedBills.map((b) => {
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
