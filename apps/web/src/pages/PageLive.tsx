import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import {
  APH_FEED_URLS,
  resolveLiveVideo,
  type FeedItem,
  type LiveVideo,
  type YtChamber,
} from "../lib/aphFeed";
import { formatRelative } from "../lib/export";

const APH_YT_CHANNEL = "UCvO8Qfr3etT6khGA9Zln8WA";

function buildEmbed(videoId: string | null): string {
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0`;
  }
  // Fallback: the channel's live_stream endpoint. This almost never resolves
  // because AUSParliamentLive uses scheduled individual streams, but retry
  // does not hurt.
  return `https://www.youtube.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1`;
}

type Chamber = YtChamber;

const CHAMBERS: Record<Chamber, { label: string; program: string }> = {
  house: {
    label: "House of Representatives",
    program:
      "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program",
  },
  senate: {
    label: "Senate",
    program:
      "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red",
  },
  federation: {
    label: "Federation Chamber",
    program:
      "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Federation_chamber",
  },
};

function fmtTime(d: Date | null): string {
  if (!d) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function PageLive(): JSX.Element {
  const { toast, openModal, liveFeedResult, liveLoading } = useStore();
  const [which, setWhich] = useState<Chamber>("house");
  const [nonce, setNonce] = useState(0);
  const [mode, setMode] = useState<"embed" | "offline">("embed");

  const [liveVideo, setLiveVideo] = useState<LiveVideo | null>(null);
  const [videoResolved, setVideoResolved] = useState(false);

  const apiBase = import.meta.env.VITE_API_BASE ?? "";

  useEffect(() => {
    setMode("embed");
  }, [which]);

  // Resolve the current live-or-most-recent AUSParliamentLive video id for
  // the selected chamber by reading the channel RSS feed via aph-proxy.
  // Refreshes every 5 minutes and when the chamber tab changes.
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function resolve(): Promise<void> {
      const video = await resolveLiveVideo(apiBase, which, ctrl.signal);
      if (!cancelled) {
        setLiveVideo(video);
        setVideoResolved(true);
      }
    }
    resolve();
    const id = window.setInterval(resolve, 300_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, [apiBase, which, nonce]);

  // Live RSS comes from the app-wide pump in App.tsx.
  const result = liveFeedResult;
  const loading = liveLoading;

  const cfg = CHAMBERS[which];
  const items: FeedItem[] = result?.items ?? [];
  const feedStatus = result?.feedStatus ?? {};
  const liveCount = Object.values(feedStatus).filter((s) => s.ok).length;
  const totalFeeds = APH_FEED_URLS.length;

  return (
    <div className="page-fade">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Live parliament</h1>
          <div className="page-sub">
            Official AUSParliamentLive broadcast, ParlView archive, Hansard
            live-track, and APH RSS feeds updating the signal panel.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div role="tablist" aria-label="Chamber" style={{ display: "flex", gap: 4 }}>
            {(Object.keys(CHAMBERS) as Chamber[]).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={which === c}
                className={`btn${which === c ? " primary" : ""}`}
                onClick={() => setWhich(c)}
              >
                {CHAMBERS[c].label.split(" ")[0]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => toast("Flag captured, linked to current speaker", "brass")}
          >
            <Icon name="flag" size={13} /> Flag moment
          </button>
        </div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "1.7fr 1fr", gap: 16 }}
      >
        <div>
          <div className="live-wrap">
            {mode === "embed" && (
              <iframe
                key={`${which}-${nonce}-${liveVideo?.videoId ?? "none"}`}
                src={buildEmbed(liveVideo?.videoId ?? null)}
                title={liveVideo?.title ?? `AUSParliamentLive — ${cfg.label}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}
            {mode === "embed" && liveVideo && (
              <div className="live-badge" title={liveVideo.title}>
                <span className="pulse" />{" "}
                {liveVideo.title.length > 48
                  ? `${liveVideo.title.slice(0, 48).toUpperCase()}...`
                  : liveVideo.title.toUpperCase()}
              </div>
            )}
            {mode === "embed" && !liveVideo && videoResolved && (
              <div
                className="live-badge"
                style={{ background: "var(--ink-4)", boxShadow: "none" }}
              >
                <span className="pulse" /> NO RECENT STREAM
              </div>
            )}
            {mode === "embed" && (
              <button
                type="button"
                onClick={() => setMode("offline")}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 3,
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  color: "#fff",
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid #ffffff30",
                  padding: "4px 9px",
                  borderRadius: 4,
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                }}
                title="Show alternate sources if no stream is live"
              >
                NO STREAM?
              </button>
            )}
            {mode === "offline" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, #0a0f16, #050810)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 22,
                    color: "var(--brass)",
                    marginBottom: 10,
                  }}
                >
                  Stream unavailable
                </div>
                <div
                  style={{
                    color: "var(--ink-2)",
                    fontSize: 13,
                    maxWidth: 460,
                    lineHeight: 1.5,
                    marginBottom: 18,
                  }}
                >
                  AUSParliamentLive only broadcasts while a chamber is in
                  session. The YouTube channel is shared across chambers,
                  so only one is live at a time. Try the official APH pages
                  below, or retry the embed.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <a
                    href="https://www.youtube.com/@AUSParliamentLive/streams"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary"
                    style={{ textDecoration: "none" }}
                  >
                    YouTube: AUSParliamentLive
                  </a>
                  <a
                    href="https://www.aph.gov.au/News_and_Events/Watch_Read_Listen"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ textDecoration: "none" }}
                  >
                    APH Watch/Read/Listen
                  </a>
                  <a
                    href="https://parlview.aph.gov.au/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ textDecoration: "none" }}
                  >
                    ParlView archive
                  </a>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setNonce((n) => n + 1);
                      setMode("embed");
                    }}
                  >
                    Retry embed
                  </button>
                </div>
              </div>
            )}
          </div>
          {liveVideo?.publishedAt && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--ink-3)",
              }}
              title={liveVideo.publishedAt.toLocaleString("en-AU")}
            >
              Stream published{" "}
              <span style={{ color: "var(--ink-2)" }}>
                {liveVideo.publishedAt.toLocaleString("en-AU")}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span className="src-badge">
              <span className="hdot live" /> AUSParliamentLive · YouTube
            </span>
            <a
              href="https://www.youtube.com/@AUSParliamentLive/streams"
              target="_blank"
              rel="noopener noreferrer"
              className="src-badge"
              style={{ textDecoration: "none", color: "var(--teal)" }}
            >
              <Icon name="ext" size={11} /> AUSParliamentLive
            </a>
            <a
              href="https://parlview.aph.gov.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="src-badge"
              style={{ textDecoration: "none", color: "var(--teal)" }}
            >
              <Icon name="ext" size={11} /> ParlView archive
            </a>
            <a
              href="https://www.aph.gov.au/Parliamentary_Business/Hansard"
              target="_blank"
              rel="noopener noreferrer"
              className="src-badge"
              style={{ textDecoration: "none", color: "var(--teal)" }}
            >
              <Icon name="ext" size={11} /> Hansard
            </a>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">Currently on program</h3>
              <span
                className="panel-kicker"
                style={{ color: "var(--caution)" }}
                title="This panel is a sample illustration, not live data"
              >
                Sample · {cfg.label}
              </span>
              <a
                href={cfg.program}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: "auto",
                  fontSize: 11.5,
                  color: "var(--teal)",
                  textDecoration: "none",
                }}
              >
                Open real daily program <Icon name="ext" size={11} />
              </a>
            </div>
            <div
              className="panel-body"
              style={{
                background:
                  "repeating-linear-gradient(135deg, transparent, transparent 14px, #d9a94a08 14px, #d9a94a08 15px)",
              }}
            >
              <div className="timeline">
                <div className="tl-item">
                  <div className="tl-time">12:00</div>
                  <div className="tl-body">
                    Question time ·{" "}
                    <button
                      type="button"
                      className="clk"
                      onClick={() => openModal({ kind: "bill", id: "BILL-2026-048" })}
                      style={{ padding: 0, color: "var(--ink)" }}
                    >
                      Digital ID Amendment
                    </button>{" "}
                    expected
                  </div>
                </div>
                <div className="tl-item teal">
                  <div className="tl-time">14:00</div>
                  <div className="tl-body">
                    Government business · 2nd reading{" "}
                    <button
                      type="button"
                      className="clk"
                      onClick={() => openModal({ kind: "bill", id: "BILL-2026-041" })}
                      style={{ padding: 0, color: "var(--ink)" }}
                    >
                      Cyber Security Bill
                    </button>
                  </div>
                </div>
                <div className="tl-item info">
                  <div className="tl-time">16:30</div>
                  <div className="tl-body">Adjournment debate</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-head">
              <h3 className="panel-title">APH connectors</h3>
              <span className="panel-kicker">Official live endpoints</span>
            </div>
            <div className="panel-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CONNECTORS.map((c) => (
                  <a
                    key={c.name}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="connector-card"
                  >
                    <span className="hdot live" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                      <div
                        style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}
                      >
                        {c.desc}
                      </div>
                    </div>
                    <Icon name="ext" size={12} stroke="var(--ink-3)" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Signal events · live RSS</h3>
            <span className="panel-kicker">
              {loading && items.length === 0
                ? "Polling..."
                : `${items.length} items · ${liveCount}/${totalFeeds} feeds`}
            </span>
          </div>
          <div
            className="panel-body"
            style={{ maxHeight: 720, overflowY: "auto" }}
            role="feed"
            aria-busy={loading}
            aria-live="polite"
          >
            {loading && items.length === 0 && (
              <div style={{ padding: "10px 4px" }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px 16px 1fr",
                      gap: 10,
                      padding: "10px 8px",
                    }}
                  >
                    <div className="skeleton" style={{ height: 10 }} />
                    <div className="skeleton" style={{ height: 12, width: 12 }} />
                    <div>
                      <div className="skeleton" style={{ height: 14, width: "80%" }} />
                      <div
                        className="skeleton"
                        style={{ height: 10, width: "40%", marginTop: 6 }}
                      />
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--ink-3)",
                    fontSize: 11.5,
                    marginTop: 8,
                  }}
                >
                  Fetching live RSS from aph.gov.au via the aph-proxy Worker...
                </div>
              </div>
            )}
            {!loading && items.length === 0 && (() => {
              // Distinguish legitimate quiet (every feed succeeded with 0 items)
              // from an error condition (some feed reported ok=false).
              const allOk = Object.values(feedStatus).every((s) => s.ok);
              const cleanQuiet = allOk && Object.keys(feedStatus).length > 0;
              if (cleanQuiet) {
                return (
                  <div style={{ padding: "14px 8px", fontSize: 12.5, color: "var(--ink-3)" }}>
                    <div
                      style={{ color: "var(--ok)", fontWeight: 500, marginBottom: 6 }}
                    >
                      Feeds quiet
                    </div>
                    All {Object.keys(feedStatus).length} APH feeds returned no
                    new items in the latest poll. This is normal during recess
                    or outside sitting hours.
                  </div>
                );
              }
              return (
                <div style={{ padding: "14px 8px", fontSize: 12.5, color: "var(--ink-3)" }}>
                  <div
                    style={{
                      color: "var(--caution)",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    No items returned
                  </div>
                  Some feeds did not respond. This can happen if APH is rate
                  limiting the proxy or a feed is temporarily down. Click the
                  feed names in the Sources page to open the raw URLs.
                </div>
              );
            })()}
            {items.map((e, i) => (
              <a
                key={i}
                href={e.link}
                target="_blank"
                rel="noopener noreferrer"
                className="clk"
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 16px 1fr",
                  gap: 10,
                  padding: "10px 8px",
                  borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0,
                  borderRadius: 6,
                  alignItems: "start",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--ink-3)", paddingTop: 2 }}
                  title={
                    e.pubDate
                      ? e.pubDate.toLocaleString("en-AU")
                      : "No publication time in feed"
                  }
                >
                  {e.pubDate ? formatRelative(e.pubDate) : fmtTime(e.pubDate)}
                </div>
                <div style={{ paddingTop: 3 }}>
                  <KindIcon kind={e.kind} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>
                    {e.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 6,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {e.kind}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "var(--teal)",
                        fontFamily: "var(--mono)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Icon name="ext" size={10} /> {e.sourceLabel}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div
            className="panel-foot"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}
          >
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
              Source: Parliament of Australia website. Refreshes every 2 min via the aph-proxy Worker.
            </span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
              Last poll: {result?.lastPoll ? fmtTime(result.lastPoll) : "—"}. Click any item to open source.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KindIcon({ kind }: { kind: FeedItem["kind"] }): JSX.Element {
  switch (kind) {
    case "division":
      return <Icon name="flag" size={13} stroke="var(--escalate)" />;
    case "hearing":
      return <Icon name="signal" size={13} stroke="var(--teal)" />;
    case "inquiry":
      return <Icon name="pattern" size={13} stroke="var(--brass)" />;
    case "digest":
      return <Icon name="brief" size={13} stroke="var(--brass)" />;
    case "program":
      return <Icon name="clock" size={13} stroke="var(--ink-3)" />;
    case "report":
      return <Icon name="brief" size={13} stroke="var(--teal)" />;
    case "signal":
      return <Icon name="signal" size={13} stroke="var(--ink-3)" />;
  }
}

const CONNECTORS = [
  { name: "Hansard live", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", desc: "Daily proofs, every 5 min" },
  { name: "ParlInfo Search", url: "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p", desc: "Full-text across bills, Hansard, committees" },
  { name: "Bills Search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", desc: "Bill stage & status" },
  { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red", desc: "Senate program, live" },
  { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program", desc: "House program, live" },
  { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Division_lists", desc: "Votes within 2 min of call" },
  { name: "Committee hearings RSS", url: "https://www.aph.gov.au/Parliamentary_Business/Committees/RSS_Feeds", desc: "New & upcoming inquiries" },
  { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Member roster and portfolios" },
];
