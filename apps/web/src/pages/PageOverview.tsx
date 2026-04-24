import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { SignalCard } from "../shell/SignalCard";
import { useStore } from "../store/useStore";
import {
  APH_FEEDS,
  BRIEFING_QUEUE,
  DIVISIONS,
  SIGNALS,
} from "../data/fixtures";

function formatAEST(d: Date): string {
  // Render in Australian Eastern time. Browsers that do not know the zone
  // fall back to local time; the timezone suffix tells the user which.
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

export function PageOverview(): JSX.Element {
  const { openModal, state, goto } = useStore();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const priority = SIGNALS.filter(
    (s) => s.attention === "high" && !state.archived[s.id],
  );
  const rest = SIGNALS.filter(
    (s) => s.attention !== "high" && !state.archived[s.id],
  );

  return (
    <div className="page-fade">
      <div className="page-head">
        <div>
          <div className="page-kicker">Fri 24 Apr 2026 · Sitting day</div>
          <h1 className="page-title">Today's signal</h1>
          <div className="page-sub">
            12 new official items overnight. 3 classified as priority. No broken
            sources. Your watchlists matched 19 items this week.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn" disabled>
            <Icon name="filter" size={13} /> Filter
          </button>
          <button type="button" className="btn" disabled>
            <Icon name="download" size={13} /> Export
          </button>
          <button type="button" className="btn primary" disabled>
            <Icon name="brief" size={13} /> Generate daily brief
          </button>
        </div>
      </div>

      <div className="live-strip">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--escalate)",
              boxShadow: "0 0 12px var(--escalate)",
              animation: "pulse 1.4s infinite",
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
            LIVE · AEST {formatAEST(now)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 12.5,
            color: "var(--ink-2)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            Current chamber activity is sourced from the{" "}
            <a
              href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--teal)", textDecoration: "none" }}
            >
              House Daily Program
            </a>{" "}
            and{" "}
            <a
              href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--teal)", textDecoration: "none" }}
            >
              Senate Dynamic Red
            </a>
            .
          </div>
        </div>
        <a
          href="https://www.aph.gov.au/Parliamentary_Business/Hansard"
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
        <div className="panel stat">
          <div className="stat-label">New signals today</div>
          <div className="stat-value">{SIGNALS.length}</div>
          <div className="stat-meta">
            <span style={{ color: "var(--ok)" }}>▲ 3</span> vs yesterday
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Priority signals</div>
          <div className="stat-value" style={{ color: "var(--brass)" }}>
            {priority.length}
          </div>
          <div className="stat-meta">Watchlist-matched · requires review</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Committee activity</div>
          <div className="stat-value">
            7<span className="unit">items</span>
          </div>
          <div className="stat-meta">2 hearings · 1 new inquiry · 1 report</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Source health</div>
          <div className="stat-value">
            14/15<span className="unit">live</span>
          </div>
          <div className="stat-meta">
            <span style={{ color: "var(--caution)" }}>FlagPost</span> needs
            validation
          </div>
        </div>
      </div>

      <div className="grid g-overview">
        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">Priority signals</h3>
              <span className="panel-kicker">
                {priority.length} items · human review required
              </span>
            </div>
            <div className="panel-body">
              {priority.map((s) => (
                <SignalCard key={s.id} s={s} />
              ))}
              {priority.length === 0 && (
                <div className="empty">All priority signals actioned.</div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">All signals · last 24h</h3>
              <span className="panel-kicker">{rest.length} items</span>
            </div>
            <div className="panel-body">
              {rest.map((s) => (
                <SignalCard key={s.id} s={s} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">What changed</h3>
              <span className="panel-kicker">Since 17:00 yesterday</span>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <TimelineLink
                  time="08:15 · Senate"
                  onClick={() =>
                    openModal({
                      kind: "inquiry",
                      id: "Commonwealth procurement governance (new)",
                    })
                  }
                >
                  New inquiry opened: Digital procurement governance
                </TimelineLink>
                <TimelineLink
                  time="07:48 · Library"
                  colour="teal"
                  onClick={() =>
                    openModal({ kind: "bill", id: "BILL-2026-048" })
                  }
                >
                  Bills Digest: Digital ID Amendment (Assurance) Bill 2026
                </TimelineLink>
                <TimelineLink
                  time="07:30 · Senate"
                  colour="info"
                  onClick={() => openModal({ kind: "committee", id: "legcon" })}
                >
                  Today's hearing · Legal & Constitutional · AI assurance
                </TimelineLink>
                <TimelineLink
                  time="07:10 · House"
                  onClick={() =>
                    openModal({ kind: "bill", id: "BILL-2026-041" })
                  }
                >
                  Daily program: Cyber Security Bill, 2nd reading
                </TimelineLink>
                {DIVISIONS[2] && (
                  <TimelineLink
                    time="Yesterday 18:04"
                    colour="info"
                    onClick={() =>
                      openModal({ kind: "division", id: DIVISIONS[2]! })
                    }
                  >
                    Division: CDR Expansion Bill, 2nd reading agreed
                  </TimelineLink>
                )}
                <TimelineLink time="Yesterday 17:20" colour="teal" disabled>
                  Report tabled: Regional 5G rollout, interim
                </TimelineLink>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">Briefing queue</h3>
              <span className="panel-kicker">4 pending</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 6 }}>
              {BRIEFING_QUEUE.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    padding: "10px 0",
                    borderBottom:
                      i < BRIEFING_QUEUE.length - 1
                        ? "1px solid var(--line)"
                        : 0,
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.type}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      For {b.for} · <span className="mono">{b.at}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: b.ready ? "var(--ok)" : "var(--caution)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Source health</h3>
              <span className="panel-kicker">14/15 live</span>
            </div>
            <div className="panel-body">
              {APH_FEEDS.slice(0, 6).map((f) => (
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
                    <span
                      className={`hdot ${
                        f.status === "review" ? "review" : f.status
                      }`}
                    />
                    {f.name}
                  </div>
                  <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>
                    {f.last}
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
                    {f.today ?? "—"}
                  </div>
                </button>
              ))}
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
