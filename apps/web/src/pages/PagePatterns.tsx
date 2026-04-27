import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { fetchQons, type QonRow } from "../lib/archive";

const CHAMBER_COLOURS: Record<string, string> = {
  Senate: "var(--teal)",
  House: "var(--brass)",
};

export function PagePatterns(): JSX.Element {
  const { openBrief, liveSignals } = useStore();
  const topLiveHigh = liveSignals.find((s) => s.attention === "high") ?? liveSignals[0] ?? null;
  const [rows, setRows] = useState<QonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [chamber, setChamber] = useState("");

  const apiBase = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

  useEffect(() => {
    if (!apiBase) { setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetchQons({ q: q || undefined, chamber: chamber || undefined, limit: 200 }, ctrl.signal)
      .then((r) => { setRows(r.rows); setTotal(r.total); setError(null); })
      .catch((e) => { if (e instanceof DOMException && e.name === "AbortError") return; setError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [apiBase, q, chamber]);

  // Cluster QONs by target minister/portfolio for the pattern view
  const byTarget = new Map<string, QonRow[]>();
  for (const row of rows) {
    const key = row.target ?? "Unknown target";
    const existing = byTarget.get(key) ?? [];
    existing.push(row);
    byTarget.set(key, existing);
  }
  const clusters = [...byTarget.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence · Scrutiny</div>
          <h1 className="page-title">QON pattern engine</h1>
          <div className="page-sub">
            Questions on Notice from ParlInfo, ingested daily. Clustered by
            target minister. Richer member resolution and paragraph extraction
            are planned for Q3 2026 once the Hansard transcript pipeline matures.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            className="btn"
            href="https://parlinfo.aph.gov.au/parlInfo/search/search.w3p;query=Dataset%3Aqon"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> Search QONs on ParlInfo
          </a>
          {topLiveHigh && (
            <button
              type="button"
              className="btn"
              onClick={() => openBrief(topLiveHigh.id)}
            >
              <Icon name="brief" size={13} /> Draft brief
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search member, topic…"
          className="search"
          style={{ padding: "7px 10px", minWidth: 220, flex: 1 }}
        />
        <select
          value={chamber}
          onChange={(e) => setChamber(e.target.value)}
          style={{ padding: "7px 10px", background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
          aria-label="Filter by chamber"
        >
          <option value="">All chambers</option>
          <option value="Senate">Senate</option>
          <option value="House">House</option>
        </select>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Target clusters</h3>
            <span className="panel-kicker" style={{ color: total > 0 ? "var(--teal)" : undefined }}>
              {loading ? "loading…" : `${total} QONs · ${clusters.length} targets`}
            </span>
          </div>
          <div className="panel-body">
            {error && (
              <div className="empty">
                <strong>QON endpoint unavailable.</strong>
                <span>Daily ingest runs at 05:00 AEST. ParlInfo may be rate-limiting.</span>
              </div>
            )}
            {!loading && !error && total === 0 && (
              <div className="empty">
                <strong>No QONs ingested yet.</strong>
                <span>
                  The daily cron runs at 05:00 AEST. Results appear after the first
                  successful ParlInfo poll. Browse directly on ParlInfo in the meantime.
                </span>
              </div>
            )}
            {clusters.map(([target, qons]) => (
              <div
                key={target}
                style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10, marginBottom: 10 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{target}</strong>
                  <span className="tag" style={{ color: "var(--brass)", borderColor: "var(--brass)" }}>
                    {qons.length} QON{qons.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {qons.slice(0, 5).map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                    {r.chamber && (
                      <span className="tag mono" style={{ fontSize: 10, color: CHAMBER_COLOURS[r.chamber] ?? "var(--ink-3)", borderColor: CHAMBER_COLOURS[r.chamber] ?? "var(--line-2)" }}>
                        {r.chamber}
                      </span>
                    )}
                    <a
                      href={r.hansard_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--teal)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={r.question ?? r.hansard_url}
                    >
                      {r.question ? r.question.slice(0, 90) : r.id}
                    </a>
                    {r.member && (
                      <span style={{ fontSize: 11, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{r.member}</span>
                    )}
                  </div>
                ))}
                {qons.length > 5 && (
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    +{qons.length - 5} more — open ParlInfo for full list
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">All QONs</h3>
            <span className="panel-kicker">{loading ? "…" : `${total} records`}</span>
          </div>
          <div className="panel-body" style={{ maxHeight: 500, overflowY: "auto" }}>
            {loading && <div style={{ padding: 12, color: "var(--ink-3)", fontSize: 12 }}>Loading…</div>}
            {!loading && rows.length === 0 && !error && (
              <div className="empty"><strong>No results.</strong></div>
            )}
            {rows.slice(0, 100).map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex", gap: 8, alignItems: "baseline",
                  padding: "7px 0", borderBottom: "1px solid var(--line)",
                }}
              >
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", minWidth: 70 }}>
                  {r.asked_at.slice(0, 10)}
                </span>
                <a
                  href={r.hansard_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "var(--teal)", flex: 1 }}
                  title={r.question ?? undefined}
                >
                  {r.question ? r.question.slice(0, 80) : r.id}
                </a>
                {r.member && <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.member}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
