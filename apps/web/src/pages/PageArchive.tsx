import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import {
  downloadArchiveCsv,
  fetchAnalytics,
  fetchArchive,
  type ArchiveRow,
} from "../lib/archive";
import { useStore } from "../store/useStore";
import { WATCHLISTS } from "../data/fixtures";

const KINDS = ["", "inquiry", "hearing", "report", "digest", "signal"];
const GROUPS = ["", "Senate", "House", "Library", "Custom"];
const PAGE_SIZE = 50;

function startOfYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PageArchive(): JSX.Element {
  const { toast } = useStore();
  const [from, setFrom] = useState<string>(startOfYear());
  const [to, setTo] = useState<string>(todayIso());
  const [kind, setKind] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Array<{ term: string; count: number; last_seen: string | null }>>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);

  const offset = page * PAGE_SIZE;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchArchive(
      { from, to, kind, source_group: group, q, limit: PAGE_SIZE, offset },
      ctrl.signal,
    )
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? `Archive unavailable: ${err.message}`
            : "Archive unavailable",
        );
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [from, to, kind, group, q, offset]);

  // Watchlist analytics: build a single query for the standard watchlist
  // terms (one term per watchlist for chart density, not all terms).
  const analyticsTerms = useMemo(
    () => WATCHLISTS.map((w) => w.terms[0] ?? "").filter(Boolean),
    [],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setAnalyticsLoading(true);
    fetchAnalytics(analyticsTerms, from, to, ctrl.signal)
      .then((r) => setAnalytics(r.series))
      .catch(() => setAnalytics([]))
      .finally(() => setAnalyticsLoading(false));
    return () => ctrl.abort();
  }, [analyticsTerms, from, to]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const maxAnalytics = Math.max(...analytics.map((a) => a.count), 1);

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence · Archive</div>
          <h1 className="page-title">Archive</h1>
          <div className="page-sub">
            Every RSS item the cron has observed. Year-to-date by default. Use
            the filters to narrow, or export the current page as CSV.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn"
            disabled={rows.length === 0}
            onClick={() => {
              downloadArchiveCsv(rows, `archive-${from}-to-${to}.csv`);
              toast("Archive CSV downloaded", "brass");
            }}
          >
            <Icon name="download" size={13} /> Export current page
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3 className="panel-title">Filters</h3>
          <span className="panel-kicker">{total.toLocaleString()} items match</span>
        </div>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(0); }}
              className="search"
              style={{ padding: 7 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(0); }}
              className="search"
              style={{ padding: 7 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
            Kind
            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value); setPage(0); }}
              style={{ padding: 7, background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
            >
              {KINDS.map((k) => <option key={k} value={k}>{k || "All kinds"}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
            Source group
            <select
              value={group}
              onChange={(e) => { setGroup(e.target.value); setPage(0); }}
              style={{ padding: 7, background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
            >
              {GROUPS.map((g) => <option key={g} value={g}>{g || "All groups"}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
            Search title
            <input
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="e.g. cyber, procurement"
              className="search"
              style={{ padding: 7 }}
            />
          </label>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3 className="panel-title">Watchlist analytics</h3>
          <span className="panel-kicker">
            {analyticsLoading ? "Computing…" : `${analytics.length} watchlists, ${from} → ${to}`}
          </span>
        </div>
        <div className="panel-body">
          {analytics.length === 0 ? (
            <div className="empty">
              <strong>Analytics unavailable.</strong>
              <span>Once the archive cron has run, this panel shows mention counts per watchlist over the selected window.</span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {analytics.map((a) => (
                <div key={a.term} style={{ display: "grid", gridTemplateColumns: "200px 1fr 60px", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 12.5 }}>{a.term}</div>
                  <div className="bar"><div className="fill" style={{ width: `${(a.count / maxAnalytics) * 100}%` }} /></div>
                  <div className="mono" style={{ textAlign: "right", color: "var(--ink-2)", fontSize: 12 }}>{a.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Items</h3>
          <span className="panel-kicker">
            {loading ? "Loading…" : `Page ${page + 1} of ${totalPages}`}
          </span>
        </div>
        <div className="panel-body">
          {error ? (
            <div className="empty">
              <strong>{error}</strong>
              <span>The archive endpoint requires the D1 archive Worker to be deployed (see STATUS.md).</span>
            </div>
          ) : rows.length === 0 && !loading ? (
            <div className="empty">
              <strong>No items match.</strong>
              <span>Widen the date range or clear filters.</span>
            </div>
          ) : (
            <table className="ds">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Title</th>
                  <th style={{ width: 130 }}>Source</th>
                  <th style={{ width: 90 }}>Kind</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.guid}>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {r.pub_date ? r.pub_date.slice(0, 10) : "—"}
                    </td>
                    <td>{r.title}</td>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {r.source_group}
                    </td>
                    <td>
                      <span className="tag">{r.kind}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono"
                        style={{ color: "var(--teal)", fontSize: 11 }}
                      >
                        Open ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {rows.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              padding: "10px 14px",
              borderTop: "1px solid var(--line)",
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            <button
              type="button"
              className="btn ghost sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← Prev
            </button>
            <span style={{ alignSelf: "center" }}>
              {(offset + 1).toLocaleString()}–{Math.min(offset + rows.length, total).toLocaleString()} of {total.toLocaleString()}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
