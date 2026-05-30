import { useMemo } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { APH_FEEDS, APH_CONNECTORS } from "../data/fixtures";
import { formatRelative } from "../lib/export";
import type { Feed } from "../types";

const NOT_YET_CONNECTED = [
  { name: "Hansard transcript extraction", note: "Needs full-text transcript parser (ParlInfo HTML)" },
  { name: "Full bill progress tracking", note: "Needs bills database beyond Parliamentary Library Digest RSS" },
  { name: "News / media monitoring", note: "Optional bundle — third-party media APIs required" },
  { name: "Internal executive briefings", note: "Governance and access controls required before wiring" },
];

const FALSE_POS_LABELS = new Set(["Too high", "Too low", "Wrong topic", "Wrong portfolio", "Duplicate", "Noise"]);

export function PageSources(): JSX.Element {
  const { openModal, state, triggerRefresh, requestConnector, connectorRequests, liveFeedResult } = useStore();

  const allFeeds: Feed[] = useMemo(() => [...APH_FEEDS, ...state.feeds], [state.feeds]);

  // Total items from the most recent poll across all feeds
  const itemsToday = useMemo(
    () => liveFeedResult
      ? Object.values(liveFeedResult.feedStatus).reduce((sum, s) => sum + (s.count ?? 0), 0)
      : null,
    [liveFeedResult],
  );

  // FPR derived from analyst feedback. Require at least 3 labelled signals.
  const { feedbackList, fprPct, downCount } = useMemo(() => {
    const list = Object.values(state.feedback);
    const pct = list.length >= 3
      ? Math.round((list.filter(f => FALSE_POS_LABELS.has(f.label)).length / list.length) * 100)
      : null;
    const down = liveFeedResult
      ? Object.values(liveFeedResult.feedStatus).filter((s) => !s.ok).length
      : 0;
    return { feedbackList: list, fprPct: pct, downCount: down };
  }, [state.feedback, liveFeedResult]);

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Configuration</div>
          <h1 className="page-title">Sources</h1>
          <div className="page-sub">
            Official APH feed bundle plus any custom RSS feeds you've added.
            Each source is validated, classified and routed to modules. URLs
            on this page are taken verbatim from the{" "}
            <a
              href="https://www.aph.gov.au/Help/RSS_feeds"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--teal)" }}
            >
              APH RSS feed directory
            </a>
            .
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn"
            title="Force a fresh poll of all APH feeds"
            aria-label="Refresh all APH feeds"
            onClick={triggerRefresh}
          >
            <Icon name="refresh" size={13} /> Refresh all
          </button>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <div className="panel stat">
          <div className="stat-label">Connected feeds</div>
          <div className="stat-value">{allFeeds.length}</div>
          <div className="stat-meta">Verified polling via aph-proxy</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Healthy</div>
          <div className="stat-value" style={{ color: "var(--ok)" }}>
            {liveFeedResult
              ? Object.values(liveFeedResult.feedStatus).filter((s) => s.ok).length
              : allFeeds.filter((f) => f.status === "live").length}
          </div>
          <div className="stat-meta">
            {liveFeedResult
              ? (downCount === 0 ? "All feeds responding" : `${downCount} feed(s) down`)
              : "Awaiting first poll"}
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Items this poll</div>
          <div className="stat-value" style={{ color: itemsToday !== null ? "var(--ink)" : "var(--ink-3)" }}>
            {itemsToday !== null ? itemsToday : "—"}
          </div>
          <div className="stat-meta">{itemsToday !== null ? "From last poll" : "Awaiting first poll"}</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">False positive rate</div>
          <div className="stat-value" style={{ color: fprPct !== null ? (fprPct <= 20 ? "var(--ok)" : fprPct <= 40 ? "var(--caution)" : "var(--escalate)") : "var(--ink-3)" }}>
            {fprPct !== null ? `${fprPct}%` : "—"}
          </div>
          <div className="stat-meta">
            {feedbackList.length >= 3
              ? `${feedbackList.length} rated · from thumbs up/down`
              : feedbackList.length > 0
                ? `${feedbackList.length}/3 rated — need ${3 - feedbackList.length} more`
                : "Rate signals to compute"}
          </div>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Official APH feed bundle</h3>
            <span className="panel-kicker">
              {allFeeds.length} feeds · click a row for detail
            </span>
          </div>
          <table className="ds">
            <thead>
              <tr>
                <th>Source</th>
                <th>Group</th>
                <th>Status</th>
                <th>Last</th>
                <th className="num">Today</th>
                <th>FPR</th>
                <th>Parser</th>
              </tr>
            </thead>
            <tbody>
              {allFeeds.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => { if (f.group !== "Custom") openModal({ kind: "feed", id: f.id }); }}
                  tabIndex={f.group !== "Custom" ? 0 : undefined}
                  style={{ cursor: f.group !== "Custom" ? "pointer" : "default" }}
                  onKeyDown={(e) => { if (f.group !== "Custom" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openModal({ kind: "feed", id: f.id }); } }}
                  aria-label={f.group !== "Custom" ? `View details for ${f.name}` : undefined}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{f.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                      {f.url.length > 56 ? `${f.url.slice(0, 56)}…` : f.url}
                    </div>
                  </td>
                  <td>
                    <span className="tag">{f.group}</span>
                  </td>
                  <td>
                    <span className={`hdot ${f.status === "review" ? "review" : f.status}`} />
                    {f.status[0]!.toUpperCase() + f.status.slice(1)}
                  </td>
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    {liveFeedResult ? formatRelative(liveFeedResult.lastPoll) : "—"}
                  </td>
                  <td className="num">{liveFeedResult?.feedStatus[f.url]?.count ?? f.today ?? "—"}</td>
                  <td>
                    <span className="tag">{f.fpr}</span>
                  </td>
                  <td
                    style={{
                      color:
                        f.parser === "Valid"
                          ? "var(--ok)"
                          : f.parser === "Warning"
                            ? "var(--caution)"
                            : "var(--info)",
                    }}
                  >
                    {f.parser}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">Verified APH connectors</h3>
              <span className="panel-kicker">{APH_CONNECTORS.length} canonical pages</span>
            </div>
            <div className="panel-body">
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 12,
                  color: "var(--ink-3)",
                  lineHeight: 1.5,
                }}
              >
                Direct, audited links to Parliament of Australia services. Used
                throughout the app as the source of truth for evidence and
                provenance.
              </p>
              {APH_CONNECTORS.map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="connector-card"
                  style={{ marginBottom: 6 }}
                >
                  <span className="hdot live" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                      {c.desc}
                    </div>
                  </div>
                  <Icon name="ext" size={12} stroke="var(--ink-3)" />
                </a>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Not yet connected</h3>
              <span className="panel-kicker">Needs parser or source</span>
            </div>
            <div className="panel-body">
              {NOT_YET_CONNECTED.map((x) => (
                <div
                  key={x.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px dashed var(--line-2)",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13 }}>{x.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {x.note}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={!!connectorRequests[x.name]}
                    onClick={() => requestConnector(x.name)}
                  >
                    {connectorRequests[x.name] ? "Requested" : "Request"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
