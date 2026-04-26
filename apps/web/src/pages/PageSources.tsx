import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { APH_FEEDS, APH_CONNECTORS } from "../data/fixtures";
import type { Feed } from "../types";

const NOT_YET_CONNECTED = [
  { name: "Hansard extraction", note: "Needs transcript parser" },
  { name: "QON tracking", note: "Needs source or parliamentary export" },
  { name: "Full bill progress", note: "Needs bills database beyond Digest RSS" },
  { name: "News / media monitoring", note: "Optional bundle, later" },
  { name: "Internal executive briefings", note: "Governance controls required" },
];

export function PageSources(): JSX.Element {
  const { openModal, state, triggerRefresh, requestConnector, connectorRequests, liveFeedResult } = useStore();

  const allFeeds: Feed[] = [...APH_FEEDS, ...state.feeds];

  // Total items from the most recent poll across all feeds
  const itemsToday = liveFeedResult
    ? Object.values(liveFeedResult.feedStatus).reduce((sum, s) => sum + (s.count ?? 0), 0)
    : null;

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
            {allFeeds.filter((f) => f.status === "live").length}
          </div>
          <div className="stat-meta">
            {allFeeds.filter((f) => f.status !== "live").length === 0
              ? "All feeds live"
              : `${allFeeds.filter((f) => f.status !== "live").length} not live`}
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
          <div className="stat-value" style={{ color: "var(--ink-3)" }}>—</div>
          <div className="stat-meta">Requires feedback data</div>
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
                  onClick={() => {
                    if (f.group !== "Custom") openModal({ kind: "feed", id: f.id });
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{f.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                      {f.url.length > 56 ? `${f.url.slice(0, 56)}...` : f.url}
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
                    {f.last}
                  </td>
                  <td className="num">{f.today ?? "—"}</td>
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
