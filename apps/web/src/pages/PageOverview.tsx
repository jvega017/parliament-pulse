import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { SignalCard } from "../shell/SignalCard";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { exportSignalsDigestCsv } from "../lib/export";
import { APH_FEEDS } from "../data/fixtures";

function formatAEST(d: Date): string {
  try {
    return d.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Australia/Brisbane",
    });
  } catch {
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  }
}

function formatAESTDate(d: Date): string {
  try {
    return d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Australia/Brisbane",
    });
  } catch {
    return d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
}

export function PageOverview(): JSX.Element {
  const {
    openModal,
    state,
    goto,
    liveSignals,
    liveLoading,
    liveFeedResult,
    openBrief,
    openSignal,
  } = useStore();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const liveHigh = liveSignals.filter(
    (s) => s.attention === "high" && !state.archived[s.id],
  );
  const liveMed = liveSignals.filter(
    (s) => s.attention === "med" && !state.archived[s.id],
  );
  const liveLow = liveSignals.filter(
    (s) => s.attention === "low" && !state.archived[s.id],
  );
  const totalLive = liveSignals.length;
  // Source health from the real poll, not the fixture row count.
  const healthyFeeds = liveFeedResult
    ? Object.values(liveFeedResult.feedStatus).filter((s) => s.ok).length
    : 0;
  const totalFeeds = liveFeedResult
    ? Object.keys(liveFeedResult.feedStatus).length
    : APH_FEEDS.length;
  const topLiveId = liveHigh[0]?.id ?? liveSignals[0]?.id ?? null;
  const topLiveTitle = liveHigh[0]?.title ?? liveSignals[0]?.title ?? null;

  // What-changed timeline is derived from the live RSS pump, sorted newest-first.
  const timeline = [...liveSignals]
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .slice(0, 6);

  return (
    <div className="page-fade">
      <div className="page-head">
        <div>
          <div className="page-kicker">{formatAESTDate(now)} · AEST</div>
          <h1 className="page-title">Today's signals</h1>
          <div className="page-sub">
            {totalLive} live signals scored from official APH RSS.{" "}
            {liveHigh.length} high, {liveMed.length} medium, {liveLow.length} low.
            {liveLoading && " Polling..."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            disabled={liveSignals.length === 0}
            title={
              liveSignals.length === 0
                ? "Waiting for live signals"
                : "Export all live signals as CSV"
            }
            onClick={() =>
              exportSignalsDigestCsv(
                `live-signals-${new Date().toISOString().slice(0, 10)}.csv`,
                liveSignals,
              )
            }
          >
            <Icon name="download" size={13} /> Export all
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!topLiveId}
            title={
              topLiveId
                ? "Open print-ready brief for the top live signal"
                : "Waiting for live signals"
            }
            onClick={() => {
              if (topLiveId) openBrief(topLiveId);
            }}
          >
            <Icon name="brief" size={13} /> Generate daily brief
          </button>
        </div>
      </div>

      <DemoBanner />

      <div className="live-strip">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--escalate)",
              boxShadow: "0 0 12px var(--escalate)",
              animation: "var(--motion-pulse, pulse 1.4s infinite)",
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.16em",
              color: "var(--escalate)",
              fontWeight: 600,
            }}
          >
            {formatAEST(now)} AEST · LIVE PAGE POLLS APH
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 13,
            color: "var(--ink-2)",
            alignItems: "center",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          {topLiveTitle ? (
            <div
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
              title={topLiveTitle}
            >
              <strong style={{ color: "var(--brass)" }}>Top live:</strong>{" "}
              <button
                type="button"
                className="clk"
                style={{ padding: 0, color: "var(--ink)", fontSize: 13 }}
                onClick={() => {
                  if (topLiveId) openSignal(topLiveId);
                }}
                title="Open the signal drawer"
              >
                {topLiveTitle}
              </button>
            </div>
          ) : liveLoading ? (
            <div className="skeleton" style={{ height: 14, width: 220 }} />
          ) : (
            <div style={{ color: "var(--ink-3)" }}>
              Feeds quiet. Nothing live right now.
            </div>
          )}
        </div>
        <a
          href="https://www.aph.gov.au/Parliamentary_Business/Hansard"
          title="APH Hansard hub: daily transcripts of debate"
          target="_blank"
          rel="noopener noreferrer"
          className="btn sm ghost"
          style={{ textDecoration: "none" }}
        >
          <Icon name="ext" size={12} /> Hansard
        </a>
        <a
          href="https://www.youtube.com/@AUSParliamentLive/streams"
          target="_blank"
          rel="noopener noreferrer"
          className="btn sm ghost"
          style={{ textDecoration: "none" }}
        >
          <Icon name="ext" size={12} /> YouTube
        </a>
        <button
          type="button"
          className="btn sm primary"
          onClick={() => goto("live")}
        >
          <Icon name="signal" size={12} /> Watch live
        </button>
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <div
          className="panel stat"
          style={{ borderLeft: "3px solid var(--brass)" }}
        >
          <div className="stat-label" style={{ color: "var(--brass)" }}>
            High attention
          </div>
          <div className="stat-value" style={{ color: "var(--brass)" }}>
            {liveHigh.length}
          </div>
          <div className="stat-meta">For morning brief review</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Live signals (scored)</div>
          <div className="stat-value">{totalLive}</div>
          <div className="stat-meta">From APH RSS</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Medium</div>
          <div className="stat-value" style={{ color: "var(--caution)" }}>
            {liveMed.length}
          </div>
          <div className="stat-meta">Supporting signals</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Source health</div>
          <div className="stat-value">
            {healthyFeeds}/{totalFeeds}<span className="unit">live</span>
          </div>
          <div className="stat-meta">
            {liveFeedResult ? "From last poll" : "Awaiting first poll"}
          </div>
        </div>
      </div>

      <div className="grid g-overview">
        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">Live priority signals</h3>
              <span
                className="panel-kicker"
                style={{ color: liveHigh.length > 0 ? "var(--brass)" : undefined }}
              >
                {liveHigh.length} live items · scored from APH RSS
              </span>
            </div>
            <div className="panel-body">
              {liveLoading && liveHigh.length === 0 && (
                <div style={{ padding: "8px 0" }}>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="skeleton"
                      style={{ height: 120, marginBottom: 10 }}
                    />
                  ))}
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--ink-3)",
                      fontSize: 12,
                    }}
                  >
                    Polling APH RSS for live content...
                  </div>
                </div>
              )}
              {!liveLoading && liveHigh.length === 0 && (
                <div className="empty">
                  <strong>No high-attention live items right now.</strong>
                  <span>
                    Medium and low items appear below. Click a watchlist on the
                    Watchlists page to bias scoring toward your portfolio.
                  </span>
                </div>
              )}
              {liveHigh.map((s) => (
                <SignalCard key={s.id} s={s} />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">All live signals</h3>
              <span className="panel-kicker">
                {liveMed.length + liveLow.length} medium and low
              </span>
            </div>
            <div className="panel-body">
              {[...liveMed, ...liveLow].map((s) => (
                <SignalCard key={s.id} s={s} />
              ))}
              {liveMed.length + liveLow.length === 0 && !liveLoading && (
                <div className="empty">
                  <strong>No further live items.</strong>
                </div>
              )}
            </div>
          </div>

        </div>

        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">What changed</h3>
              <span className="panel-kicker">
                Latest {timeline.length} live items
              </span>
            </div>
            <div className="panel-body">
              {timeline.length === 0 ? (
                <div className="empty">
                  <strong>No recent activity in the poll.</strong>
                </div>
              ) : (
                <div className="timeline">
                  {timeline.map((s) => (
                    <TimelineLink
                      key={s.id}
                      time={`${s.time} · ${s.sourceGroup}`}
                      colour={
                        s.attention === "high"
                          ? "brass"
                          : s.attention === "med"
                            ? "info"
                            : "teal"
                      }
                      onClick={() => openSignal(s.id)}
                    >
                      {s.title}
                    </TimelineLink>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Source health</h3>
              <span className="panel-kicker">
                {liveFeedResult ? `${healthyFeeds}/${totalFeeds} live` : "Awaiting poll"}
              </span>
            </div>
            <div className="panel-body">
              {APH_FEEDS.map((f) => {
                const polled = liveFeedResult?.feedStatus[f.url];
                const ok = polled?.ok ?? false;
                const dot = !liveFeedResult
                  ? "review"
                  : ok
                    ? "live"
                    : "review";
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openModal({ kind: "feed", id: f.id })}
                    className="clk"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      padding: "6px 8px",
                      gap: 10,
                      fontSize: 12.5,
                      alignItems: "center",
                      borderRadius: 6,
                      width: "100%",
                    }}
                  >
                    <div>
                      <span className={`hdot ${dot}`} />
                      {f.name}
                    </div>
                    <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>
                      {liveFeedResult ? (ok ? "ok" : "down") : f.last}
                    </div>
                    <div
                      className="mono"
                      style={{
                        color: "var(--ink-3)",
                        fontSize: 11,
                        textAlign: "right",
                        width: 28,
                      }}
                    >
                      {polled?.count ?? "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineLinkProps {
  time: string;
  colour?: "brass" | "teal" | "info";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function TimelineLink({
  time,
  colour,
  onClick,
  disabled,
  children,
}: TimelineLinkProps): JSX.Element {
  return (
    <div className={`tl-item${colour ? ` ${colour}` : ""}`}>
      <div className="tl-time">{time}</div>
      <div className="tl-body">
        {disabled || !onClick ? (
          <span>{children}</span>
        ) : (
          <button
            type="button"
            onClick={onClick}
            className="clk"
            style={{ padding: 0, color: "var(--ink)", textAlign: "left" }}
          >
            {children}
          </button>
        )}
      </div>
    </div>
  );
}
