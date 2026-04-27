import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { fetchBills, type BillRow } from "../lib/archive";

export function PageBills(): JSX.Element {
  const { liveSignals, openSignal } = useStore();
  const [archiveRows, setArchiveRows] = useState<BillRow[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveQ, setArchiveQ] = useState("");
  const apiBase = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

  useEffect(() => {
    if (!apiBase) { setArchiveLoading(false); return; }
    const ctrl = new AbortController();
    setArchiveLoading(true);
    fetchBills({ q: archiveQ || undefined, limit: 100 }, ctrl.signal)
      .then((r) => { setArchiveRows(r.rows); setArchiveTotal(r.total); })
      .catch(() => null)
      .finally(() => setArchiveLoading(false));
    return () => ctrl.abort();
  }, [apiBase, archiveQ]);

  // Bills Digests come through the ParlInfo Bills Digests RSS feed (kind="digest").
  // These are real Parliamentary Library publications — scored by the live engine.
  const digests = liveSignals.filter((s) => s.tags.some((t) => t.l === "digest"));

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence</div>
          <h1 className="page-title">Bills Digests</h1>
          <div className="page-sub">
            Bills Digests from the Parliamentary Library update via RSS.
            Full bills search and division records link to the authoritative APH source.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            className="btn"
            href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> APH Bills Search
          </a>
          <a
            className="btn primary"
            href="https://parlinfo.aph.gov.au/parlInfo/search/search.w3p;query=Dataset%3Abillsdgs;orderBy=date-eFirst"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="ext" size={13} /> Bills Digests on ParlInfo
          </a>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Bills Digests</h3>
            <span
              className="panel-kicker"
              style={{ color: digests.length > 0 ? "var(--brass)" : undefined }}
            >
              {digests.length > 0
                ? `${digests.length} live · Parliamentary Library 2026`
                : "Awaiting next poll"}
            </span>
          </div>
          <div className="panel-body">
            {digests.length === 0 ? (
              <div className="empty">
                <strong>No Bills Digests in the current poll.</strong>
                <span>
                  The ParlInfo Bills Digests RSS feed is polled every 2 minutes.
                  Digests appear here as the Parliamentary Library publishes them
                  throughout 2026. Search ParlInfo for the full archive:
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                  <a
                    className="btn"
                    href="https://parlinfo.aph.gov.au/parlInfo/search/search.w3p;query=Dataset%3Abillsdgs;orderBy=date-eFirst"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> Bills Digests (ParlInfo)
                  </a>
                  <a
                    className="btn"
                    href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> Bills Search (APH)
                  </a>
                  <a
                    className="btn"
                    href="https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" size={13} /> Parliamentary Library
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--ink-3)" }}>
                  Official Bills Digests from the Parliamentary Library. Published as bills
                  are introduced. Click any digest to open the scored signal drawer, or
                  follow the source link to the full ParlInfo document.
                </p>
                {digests.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className="clk"
                    onClick={() => openSignal(s.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      padding: "12px 8px",
                      borderBottom: i < digests.length - 1 ? "1px solid var(--line)" : 0,
                      gap: 12,
                      alignItems: "start",
                      borderRadius: 6,
                      width: "100%",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
                        {s.title}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 5, alignItems: "center" }}>
                        <span
                          className="mono"
                          style={{ fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.12em" }}
                        >
                          {s.date} · {s.time}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 10.5, color: "var(--teal)" }}
                        >
                          {s.source}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span
                        className="tag"
                        style={{
                          color:
                            s.attention === "high"
                              ? "var(--brass)"
                              : s.attention === "med"
                                ? "var(--caution)"
                                : "var(--ink-3)",
                          borderColor:
                            s.attention === "high"
                              ? "var(--brass)"
                              : s.attention === "med"
                                ? "var(--caution)"
                                : undefined,
                        }}
                      >
                        {s.attention}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Archive — all Bills Digests</h3>
            <span className="panel-kicker" style={{ color: archiveTotal > 0 ? "var(--teal)" : undefined }}>
              {archiveLoading ? "loading…" : `${archiveTotal} in D1`}
            </span>
          </div>
          <div className="panel-body">
            <input
              type="search"
              value={archiveQ}
              onChange={(e) => setArchiveQ(e.target.value)}
              placeholder="Search title…"
              className="search"
              style={{ padding: "7px 10px", width: "100%", marginBottom: 10 }}
            />
            {archiveLoading && <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Loading…</div>}
            {!archiveLoading && archiveRows.length === 0 && (
              <div className="empty">
                <strong>No Bills Digests in archive yet.</strong>
                <span>Bills Digests persist to D1 on each RSS poll. Check back after the next cron.</span>
              </div>
            )}
            {archiveRows.map((row, i) => (
              <a
                key={row.guid}
                href={row.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  padding: "10px 8px",
                  borderBottom: i < archiveRows.length - 1 ? "1px solid var(--line)" : 0,
                  gap: 10,
                  alignItems: "start",
                  borderRadius: 6,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: "var(--ink)" }}>
                    {row.title}
                  </div>
                  {row.description && (
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.4 }}>
                      {row.description.slice(0, 120)}{row.description.length > 120 ? "…" : ""}
                    </div>
                  )}
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4, display: "block" }}>
                    {row.pub_date ? row.pub_date.slice(0, 10) : "—"}
                  </span>
                </div>
                <div>
                  {row.attention && (
                    <span
                      className="tag"
                      style={{
                        color: row.attention === "high" ? "var(--brass)" : row.attention === "med" ? "var(--caution)" : "var(--ink-3)",
                        borderColor: row.attention === "high" ? "var(--brass)" : row.attention === "med" ? "var(--caution)" : undefined,
                      }}
                    >
                      {row.attention}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Recent divisions</h3>
            <span className="panel-kicker">Links to authoritative source</span>
          </div>
          <div className="panel-body">
            <div className="empty">
              <strong>Division results are published by APH after each sitting day.</strong>
              <span>
                House and Senate vote records on bills are available in the
                authoritative registers below. Bills digest and division data
                will be cross-linked here once APH provides a structured feed.
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
          </div>
        </div>
      </div>
    </div>
  );
}
