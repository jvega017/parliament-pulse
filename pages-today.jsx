// pages-today.jsx: the Today desks (Overview, Live parliament, Signal inbox, Activity by source).
// Split from pages.jsx (FE-11, ARCH-11). Every file is a classic script: its
// top-level declarations share one global lexical scope with the other files, so
// load order in index.html matters only for code that runs at load time.



// ---------- OVERVIEW ----------
// Visibility is owned entirely by the caller (PageOverview's showHelp state), which
// initialises from the absence of the pp-onboarded key so a genuinely new visitor sees
// this once. Dismissing here writes the key AND tells the caller to close, so the
// "How it works" toggle keeps working for every later manual open.
function OnboardingGuide({ onDismiss }) {
  const key = "pp-onboarded";
  const dismiss = () => { safeSetLocalStorage(key, "1"); if (onDismiss) onDismiss(); };
  return (
    <div style={{background:"var(--panel-hi)", border:"1px solid var(--brass-soft)", borderRadius:10, padding:"16px", marginBottom:18}}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
        <Icon name="signal" size={14} stroke="var(--brass)" />
        <span className="mono t-label" style={{color:"var(--brass)", textTransform:"uppercase", letterSpacing:".18em"}}>Getting started</span>
        <button onClick={dismiss}
          style={{marginLeft:"auto", background:"none", border:"none", color:"var(--ink-4)", cursor:"pointer", fontSize:"var(--t-body)", lineHeight:1, padding:"0 4px"}}
          aria-label="Dismiss guide">×</button>
      </div>
      <div className="g-onboarding" style={{display:"grid", gap:14}}>
        {[
          ["1. Signals", "Parliamentary intelligence items classified by attention level. Open any signal to read the full analysis and evidence trail."],
          ["2. Take action", "Open a signal, read the recommended action, then archive, generate a brief, or add to a watchlist. Use j/k to navigate, Esc to close."],
          ["3. Generate briefs", "Press b or click Generate brief to copy a structured brief to the clipboard. Completed briefs appear in the Briefings queue."],
        ].map(([h, b]) => (
          <div key={h} style={{fontSize:"var(--t-body-sm)", color:"var(--ink-2)"}}>
            <div style={{fontWeight:600, color:"var(--brass)", marginBottom:4, fontSize:"var(--t-caption)"}}>{h}</div>
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}

// Phone layout breakpoint, matching the 780 px media query in index.html. False
// wherever matchMedia is unavailable (tests, very old browsers).
function isPhoneViewport() {
  try { return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 780px)").matches; } catch { return false; }
}


function PageOverview() {
  const { state, toast, navigate } = useStore();
  const goto = navigate;
  // Live signals feed the priority/rest computation and the command strip. When
  // the /state signals block is not live, sourceSignals falls back to the fixture
  // (spec 2.1); the chip below reflects which one is on screen.
  const live = useLiveState("signals");
  const sourceSignals = live.items || SIGNALS;
  // FE-05: ingest freshness and the configured feed count, both from /state.
  const fresh = useFreshness();
  const feedCount = useFeedCount();
  // Local overview controls (F4): real state, not toast-only stubs.
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [sortByAttention, setSortByAttention] = useState(false);
  // Auto-opens once for a genuinely new visitor (no pp-onboarded key yet) and never
  // again after OnboardingGuide's dismiss path writes that key. The "How it works"
  // button still opens it manually at any time regardless of the stored key.
  // FE-07 (UX-13): never auto-opens on a phone, where the guide alone pushed the
  // first signal about 1,250 px down; the button still opens it in place.
  const [showHelp, setShowHelp] = useState(() => !safeGetLocalStorage("pp-onboarded") && !isPhoneViewport());
  const priority = sourceSignals.filter(s => s.attention === "high" && !state.archived[s.id]);
  let rest = sourceSignals.filter(s => s.attention !== "high" && !state.archived[s.id]);
  // "In the last 24 hours" counts only items that carry a publication clock time
  // inside that window. Date-only and undated items cannot be placed in it, so
  // they count toward the inbox total and never toward the 24-hour figure.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const restRecent = rest.filter(s => s.dateKind === "datetime" && typeof s.pubAt === "number" && Date.now() - s.pubAt <= DAY_MS).length;
  if (sortByAttention) {
    const rank = { high: 0, med: 1, low: 2 };
    rest = [...rest].sort((a, b) => (rank[a.attention] ?? 3) - (rank[b.attention] ?? 3));
  }
  // Group by topic uses the first tag label as the topic key when enabled.
  const restGroups = groupByTopic
    ? rest.reduce((acc, s) => {
        const topic = (s.tags && s.tags[0] && s.tags[0].l) || "Other";
        (acc[topic] = acc[topic] || []).push(s);
        return acc;
      }, {})
    : null;

  // Committee activity tile: counted from the SAME live signals the Committees
  // page itself filters on (COMMITTEE_STRIP_LABELS, module scope), so the tile
  // moves when the data moves and never drifts out of sync with what the
  // Committees page actually shows (spec: no placeholder wearing a number's
  // clothes). Renders 0/0/0/0 honestly while the live block is unavailable.
  const counts = useCounts();
  const committeeItemsLive = live.items ? live.items.filter(s => COMMITTEE_STRIP_LABELS.has(s.source)) : [];
  const committeeHearingCount = committeeItemsLive.filter(i => (i.tags?.[0]?.l) === "hearing").length;
  const committeeInquiryCount = committeeItemsLive.filter(i => (i.tags?.[0]?.l) === "inquiry").length;
  const committeeReportCount = committeeItemsLive.filter(i => (i.tags?.[0]?.l) === "report").length;

  // Overview briefing queue: the user's own generated briefs (state.briefsGenerated),
  // the same real source PageBriefings uses. No static example rows (spec: an honest
  // empty state replaces the fixture queue when nothing has been generated yet).
  const overviewBriefs = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = sourceSignals.find(s => s.id === sid) || SIGNALS.find(s => s.id === sid);
    const label = sig ? (sig.isLive ? sig.source : (sig.title.slice(0, 40) + "…")) : sid;
    return { type: v.type || "Executive brief", for: label, ts: v.ts };
  }).sort((a, b) => b.ts - a.ts).slice(0, 4);

  const generateDailyBrief = () => {
    const today = fmtDayMonYear(Date.now());
    // A live APH title is emitted as a markdown link to its source; a fixture title
    // stays plain text; a live title with no valid link falls back to the source label.
    const briefTitleMd = (brief) => brief.isLive ? (brief.link ? `[${brief.title}](${brief.link})` : brief.meta.source) : brief.title;
    const prioritySections = priority.length === 0 ? ["None."] : priority.map(s => {
      const brief = buildBriefSections(s, !!s.isLive);
      return [
        `### ${brief.meta.id} - ${briefTitleMd(brief)}`,
        `Source: ${brief.meta.source} | ${confidenceLabel(brief.meta.confidence)}`,
        brief.summary,
        ...(brief.recommendedAction ? [`**Action:** ${brief.recommendedAction.label}. ${brief.recommendedAction.reason}`] : []),
        ``,
      ].join("\n");
    });
    const restSections = rest.length === 0 ? ["None."] : rest.map(s => {
      const brief = buildBriefSections(s, !!s.isLive);
      return `- [${brief.meta.id}] ${briefTitleMd(brief)}${brief.recommendedAction ? ` - ${brief.recommendedAction.label}` : ""}`;
    });
    const lines = [
      `# Parliamentary daily signal brief: ${today}`,
      `Generated: ${new Date().toISOString()}`,
      `Total signals: ${priority.length + rest.length} · Priority: ${priority.length}`,
      ``,
      `## Priority signals`,
      ...prioritySections,
      `## All other signals`,
      ...restSections,
      ``,
      `---`,
      APH_ATTRIBUTION,
    ].join("\n");
    copyText(lines, toast, "Daily brief copied to clipboard");
  };
  const copyBetaHandoff = () => {
    const handoff = [
      "# Parliament Pulse beta handoff",
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Live in this beta",
      "- Six official APH RSS feeds are configured.",
      "- The Live page reads the official APH feeds.",
      "- Source register, direct APH links, CSV exports, clipboard briefs and local review state are operational.",
      "",
      "## Representative until pipeline activation",
      "- Priority scoring, confidence scoring, radar clustering, watchlist trend matching, QON pattern detection and shared briefing queue.",
      "",
      "## Activation path",
      "- Add authenticated division/member data.",
      "- Add Hansard and QON extraction.",
      "- Add shared persistence and approval workflow.",
      "- Keep representative chips until each module has verified live evidence.",
    ].join("\n");
    copyText(handoff, toast, "Beta handoff copied");
  };
  return (
    <div className="page page-overview">
      <div className="page-head">
        <div>
          <div className="page-kicker">{live.items
            ? ["Live signals", fetchedClause(live.fetchedAt), "verify sitting status from the Live page"].filter(Boolean).join(" · ")
            : "Live data is unavailable · Parliament Pulse shows nothing rather than an invented signal · see the Live page for feed health"}</div>
          <h1 className="page-title">Today's signals</h1>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end"}}>
          <ProvenanceChip provenance={live.displayProvenance}
            title={live.displayProvenance === "live" ? "Signals from the official APH feeds" : "Live signals are unavailable; the Live page links to the official APH feeds"} />
          <button className="btn ghost sm" aria-expanded={showHelp} onClick={() => setShowHelp(v => !v)}><Icon name="signal" size={12}/> How it works</button>
          <button className="btn ghost sm" onClick={() => exportSignalsCSV(sourceSignals)}><Icon name="ext" size={12}/> Export CSV</button>
          <button className="btn ghost sm" onClick={copyBetaHandoff}><Icon name="brief" size={12}/> Copy beta handoff</button>
          <button className="btn primary" onClick={generateDailyBrief}><Icon name="brief" size={13}/> Generate daily brief</button>
        </div>
      </div>

      {showHelp && <OnboardingGuide onDismiss={() => setShowHelp(false)} />}

      {/* COMMAND STRIP HERO — Priority is the hero KPI; the only number that drives a decision */}
      <div className="command-strip">
        <div className="cs-primary">
          <div className="cs-stat-label">Priority signals</div>
          <div className="cs-kpi cs-count-up">{priority.length}<span className="unit">{priority.length > 0 ? "to triage" : "clear"}</span></div>
          <div className="stat-meta" style={{marginTop:8, display:"flex", alignItems:"center", gap:10}}>
            <span style={{color:"var(--ink-3)"}}>{priority.length + rest.length} signals in view · {sourceSignals.filter(s => state.archived[s.id]).length}/{sourceSignals.length} actioned</span>
            {priority.length > 0 && <button className="btn ghost sm" style={{marginLeft:"auto"}} onClick={() => document.getElementById("priority-panel")?.scrollIntoView({behavior:"smooth", block:"start"})}>Triage now →</button>}
          </div>
        </div>
        <div className="cs-secondary" title="Counted from the live Senate, House and joint committee feeds">
          <div className="cs-stat-label" style={{display:"flex", alignItems:"center", gap:8}}>Committee activity {live.items && <ProvenanceChip provenance="live" title="Counted from the live committee feeds" />}</div>
          <div className="cs-stat">{counts.committees == null ? NO_VALUE : counts.committees}<span className="unit">items</span></div>
          <div className="stat-meta">{committeeHearingCount} hearing{committeeHearingCount !== 1 ? "s" : ""} · {committeeInquiryCount} inquir{committeeInquiryCount !== 1 ? "ies" : "y"} · {committeeReportCount} report{committeeReportCount !== 1 ? "s" : ""}</div>
        </div>
        <div className="cs-secondary" data-source-health="">
          <div className="cs-stat-label">Source health</div>
          <div className="cs-stat">{feedCount == null ? NO_VALUE : feedCount}<span className="unit">feeds</span></div>
          <div className="stat-meta" data-poll-line="" style={fresh.stale ? {color:"var(--caution)"} : undefined}>
            {fresh.known
              ? (fresh.stale ? fresh.stallText : fresh.pollLine)
              : (feedCount == null ? "Feed count appears once the feed list loads" : "Official APH feeds the service polls")}
          </div>
        </div>
      </div>

      {/* SOURCE STRIP — official links first; current chamber state must be verified before action. */}
      <div className="live-strip g-live-strip" style={{display:"grid", gap:14, alignItems:"center", padding:"12px 16px", marginBottom:16}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ok)"}}/>
          <span className="mono" style={{fontSize:"var(--t-label)", letterSpacing:".16em", color:"var(--ok)", fontWeight:600}}>LATEST CONFIGURED SOURCES</span>
        </div>
        <div style={{display:"flex", gap:18, fontSize:"var(--t-body-sm)", color:"var(--ink-2)", alignItems:"center"}}>
          <div><strong style={{color:"var(--ink)"}}>House:</strong> program links available</div>
          <div style={{width:1, height:16, background:"var(--line-2)"}}/>
          <div><strong style={{color:"var(--ink)"}}>Senate:</strong> verify hearing status from APH before action</div>
        </div>
        <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" className="btn sm ghost" style={{textDecoration:"none"}}><Icon name="ext" size={12}/> Hansard</a>
        <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn sm ghost" style={{textDecoration:"none"}}><Icon name="ext" size={12}/> YouTube</a>
        <button className="btn sm" onClick={()=> goto && goto("live")}><Icon name="signal" size={12}/> Watch live</button>
      </div>

      <div className="grid g-overview">
        <div>
          <div className="panel" id="priority-panel" style={{marginBottom:"var(--gap-section)"}}>
            <div className="panel-head">
              <h2 className="panel-title">Priority signals</h2>
              <span className="panel-kicker">{priority.length} high-attention items · check each before use</span>
            </div>
            <div className="panel-body">
              {live.status === "loading" && !live.items
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : !live.items ? (
                    <EmptyState icon="signal" kicker="Live data unavailable" variant="error">
                      Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. <a href="https://www.aph.gov.au" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Go to aph.gov.au</a>.
                    </EmptyState>
                  ) : <>
                    {/* Every card here is high attention, so the panel kicker says it once (UX-03 pattern). */}
                    {priority.map(s => <SignalCard key={s.id} s={s} hideAtt />)}
                    {priority.length === 0 && <EmptyState icon="check" kicker="Priority clear">All priority signals actioned.</EmptyState>}
                  </>}
            </div>
            {rest.length > 0 && (
              <div className="panel-foot">
                <span data-rest-line="" style={{color:"var(--ink-3)", fontSize:"var(--t-body-sm)"}}>{rest.length} more signal{rest.length !== 1 ? "s" : ""} in the inbox{restRecent > 0 ? `, ${restRecent} published in the last 24 hours` : ""}</span>
                <button className="btn ghost sm" style={{marginLeft:"auto"}} onClick={() => goto && goto("signals")}>Open Signal inbox →</button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-section">
              <div className="panel-section-head">
                <h2 className="panel-section-title">What changed</h2>
                <span className="panel-kicker" style={{marginLeft:"auto"}}>{live.items ? ["Live", fetchedClause(live.fetchedAt)].filter(Boolean).join(" · ") : "No live feed yet"}</span>
              </div>
              <div style={{marginBottom:12, paddingBottom:12, borderBottom:"1px solid var(--rule-2)", fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>
                {Object.keys(state.archived).length > 0
                  ? `You actioned ${Object.keys(state.archived).length} signal${Object.keys(state.archived).length !== 1 ? "s" : ""} this session.`
                  : "No signals actioned yet this session."}{" "}
                {sourceSignals.length} signals in the current inbox.
              </div>
              {/* Derived from the live signal stream itself, never a fixed script of
                  events (spec: what changed must move when the data moves). With no
                  live feed connected this renders an honest empty state and invents
                  nothing about the day. */}
              {live.items ? (
                <div className="timeline">
                  {live.items.slice(0, 6).map((s, i) => (
                    <div key={s.id || i} className="tl-item">
                      <div className="tl-time">{signalWhen(s)} · {s.source}</div>
                      <div className="tl-body">
                        {s.link
                          ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{color:"var(--link)", textDecoration:"none"}} title="Opens the source at aph.gov.au">{s.title}</a>
                          : s.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="signal" kicker="No live timeline held">
                  Parliament Pulse holds no verified live changes for this window: live signals are unavailable right now. This timeline fills from the same feeds as the Signal inbox once they respond.
                </EmptyState>
              )}
            </div>
            <div className="panel-section">
              <div className="panel-section-head">
                <h2 className="panel-section-title">Briefing queue</h2>
                <span className="panel-kicker" style={{marginLeft:"auto"}}>{overviewBriefs.length} generated</span>
              </div>
              {overviewBriefs.length === 0 ? (
                <EmptyState icon="brief" kicker="No briefs generated yet">
                  Open any signal and choose Generate brief. Your briefs appear here and in the full Briefings queue.
                </EmptyState>
              ) : overviewBriefs.map((b,i) => (
                <div key={b.for + i} className="data-row g-brief-row" style={{display:"grid", gap:10, padding:"10px 0", borderBottom: i < overviewBriefs.length-1 ? "1px solid var(--rule-2)" : 0}}>
                  <div>
                    <div style={{fontSize:"var(--t-body-sm)", fontWeight:500}}>{b.type}</div>
                    <div style={{fontSize:"var(--t-caption)", color:"var(--ink-3)"}}>For {b.for}</div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span className="mono" style={{fontSize:"var(--t-label)", color:"var(--ok)", textTransform:"uppercase", letterSpacing:".12em"}}>Copied to clipboard</span>
                    <button className="btn sm ghost" title="Open the briefings queue" aria-label="Open briefings queue" onClick={() => goto && goto("briefings")}><Icon name="chevron" size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="about-data-line" style={{marginTop:"var(--gap-section)", fontSize:"var(--t-body-sm)", color:"var(--ink-3)"}}>
        Every figure here links to its source. See what is live, what is derived, and what is coming:{" "}
        <a href="#/about" onClick={e => { e.preventDefault(); goto && goto("about"); }} style={{color:"var(--link)"}}>About the data</a>.
      </div>
    </div>
  );
}


// ---------- LIVE PARLIAMENT ----------
// APH live stream: the @AUSParliamentLive YouTube channel ("Australian Parliament
// House Streaming Portal"). PR-15, verified 29 Sep 2026 by fetching
// https://www.youtube.com/@AUSParliamentLive: the page's externalId, its
// <link rel="canonical"> (/channel/UCzx6ti0rql6Q2Dc2zSAPmuA) and its
// itemprop="identifier" all carry the id below.
// YouTube's live_stream endpoint resolves to whatever that channel is streaming.
// House, Senate and Federation Chamber all resolve to this ONE channel stream, so
// the embed is labelled "APH live stream" and never as a chamber; each chamber
// links to ParlView instead (FE-07, finding PR-15).
const APH_YT_CHANNEL = "UCzx6ti0rql6Q2Dc2zSAPmuA"; // @AUSParliamentLive, verified 29 Sep 2026
// LEG-05: no autoplay parameter. The player plays only when the viewer presses play.
const APH_LIVE_EMBED_URL = `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}`;
const APH_LIVE_LABEL = "APH live stream";
// ParlView is APH's broadcast service for every chamber. parlview.aph.gov.au
// redirects to this page (checked 29 Sep 2026); no per-chamber ParlView address
// was verified, so each chamber link opens it.
const PARLVIEW_URL = "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/";
const PARLVIEW_CHAMBERS = [
  { id: "house", label: "House" },
  { id: "senate", label: "Senate" },
  { id: "federation", label: "Federation Chamber" },
];

function LiveBroadcast() {
  // mode: "card" = branded card, NO iframe in the DOM, so the browser has made no
  // request to YouTube (LEG-05); "embed" = the viewer pressed "Load YouTube
  // player". A cross-origin iframe cannot expose playback state, so a loaded
  // player is reported as "status unverified" and never as LIVE.
  const [mode, setMode] = React.useState("card");
  const [nonce, setNonce] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);

  // If the player has not loaded within the timeout, return to the card.
  React.useEffect(() => {
    if (mode !== "embed" || loaded) return;
    const id = setTimeout(() => setMode("card"), 8000);
    return () => clearTimeout(id);
  }, [mode, loaded, nonce]);

  const loadPlayer = () => { setLoaded(false); setNonce(n => n + 1); setMode("embed"); };

  if (mode === "card") {
    return (
      <div className="live-wrap live-card" data-live-player="card">
        <div className="live-card-head">
          <span className="live-card-dot" aria-hidden="true"/>
          <h2 className="live-card-title">{APH_LIVE_LABEL}</h2>
        </div>
        <p className="live-card-body">
          AUSParliamentLive, the official Australian Parliament House streaming channel on YouTube, carries the chamber broadcasts while Parliament sits. The player is not loaded until you ask for it: loading it connects your browser to YouTube (youtube-nocookie.com).
        </p>
        <div className="live-card-actions">
          <button className="btn primary" onClick={loadPlayer} data-load-player=""><Icon name="signal" size={13}/> Load YouTube player</button>
          <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>YouTube <Icon name="ext" size={12}/></a>
          <a href="https://www.aph.gov.au/News_and_Events/Watch_Read_Listen" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>APH Watch, Read, Listen <Icon name="ext" size={12}/></a>
        </div>
      </div>
    );
  }

  return (
    <div className="live-wrap live-embed" data-live-player="embed">
      <iframe
        key={nonce}
        src={APH_LIVE_EMBED_URL}
        title={`${APH_LIVE_LABEL} (AUSParliamentLive on YouTube)`}
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
      <div className="live-badge" style={{position:"absolute", top:12, left:12, zIndex:3, display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.6)", padding:"5px 10px", borderRadius:4, fontFamily:"var(--mono)", fontSize:"var(--t-eyebrow)", color: loaded ? "#fff" : "var(--ink-2)", letterSpacing:".12em", border:"1px solid var(--line-bright)"}}>
        <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ink-3)"}}/>
        {loaded ? "Player loaded · status unverified" : "Connecting"}
      </div>
      {/* YouTube's own "not live" state renders inside the iframe and cannot be
          detected from here, so closing the player is always available. */}
      <button
        onClick={() => setMode("card")}
        style={{position:"absolute", top:12, right:12, zIndex:3, fontFamily:"var(--mono)", fontSize:"var(--t-label)", color:"#fff", background:"rgba(0,0,0,0.55)", border:"1px solid var(--line-bright)", padding:"4px 9px", borderRadius:4, cursor:"pointer", letterSpacing:".08em"}}
        title="Close the player and show the official sources"
      >
        CLOSE PLAYER
      </button>
    </div>
  );
}

// --- REAL LIVE RSS POLLER ---
// Fetches the official APH RSS feeds listed at https://www.aph.gov.au/Help/Rss_feeds
// via a CORS proxy (local proxy-server.js in dev, Cloudflare Worker in production),
// parses the XML, and merges items into a single time-sorted signal stream.
// Refreshes every 2 minutes.
//
// The feed list is read from the single canonical registry window.SOURCE_REGISTRY
// (owned by data.jsx / WP-E). We no longer keep a duplicate APH_FEED_URLS here.
// The parlinfo Bills Digests feed is intentionally absent: it sits behind an Azure
// WAF JavaScript challenge and a plain Worker fetch is blocked, so it must not be
// routed through the simple proxy.

// Derive a display kind (drives the row icon) from a registry entry's id/module.
function feedKind(entry) {
  const id = (entry.id || "").toLowerCase();
  const url = (entry.url || "").toLowerCase();
  if (id.includes("div") || url.includes("/divisions")) return "division";
  if (id.includes("report") || url.includes("/reports")) return "report";
  if (id.includes("inquir") || url.includes("inquiries") || url.includes("new_inquiries")) return "inquiry";
  if (id.includes("hearing") || url.includes("hearings") || url.includes("/red")) return "hearing";
  if (id.includes("program") || url.includes("daily_program")) return "program";
  if (id.includes("digest") || id.includes("bills")) return "digest";
  return "signal";
}

// Map the canonical registry into the shape the poller consumes.
// Falls back to an empty list if the registry is not yet attached (defensive).
function liveFeedList() {
  const reg = (typeof window !== "undefined" && Array.isArray(window.SOURCE_REGISTRY)) ? window.SOURCE_REGISTRY : [];
  return reg
    .filter(f => f.url && f.url.startsWith("http") && !f.url.includes("parlinfo.aph.gov.au"))
    .map(f => ({ url: f.url, label: f.label || f.name || f.url, kind: feedKind(f) }));
}


// Bounded-concurrency map: at most `limit` calls of fn run at once. Keeps the live
// poller from spawning an unbounded fetch burst (Chromium ERR_INSUFFICIENT_RESOURCES)
// as the feed list grows. Mirrors Promise.allSettled's result shape.
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      try { results[idx] = { status: "fulfilled", value: await fn(items[idx], idx) }; }
      catch (e) { results[idx] = { status: "rejected", reason: e }; }
    }
  };
  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  return results;
}

// Live "Recent items": newest first by the feed's pubDate, undated items last,
// the same rule the Signal inbox follows (sortSignalsNewestFirst). Items with
// the same time, and undated items, keep feed order (feed, then item position).
function sortLiveEventsNewestFirst(events) {
  const ms = e => (e && e.date && typeof e.date.getTime === "function" && !Number.isNaN(e.date.getTime())) ? e.date.getTime() : null;
  return [...events].sort((a, b) => {
    const ea = ms(a), eb = ms(b);
    if (ea != null && eb != null && ea !== eb) return eb - ea;
    if (ea == null && eb != null) return 1;
    if (eb == null && ea != null) return -1;
    return (a.feedIdx - b.feedIdx) || (a.itemIdx - b.itemIdx);
  });
}
function PageLive() {
  const { toast, consumeLiveRefresh } = useStore();

  const [events, setEvents] = useState([]);
  const [feedStatus, setFeedStatus] = useState({}); // url -> {ok, count, error}
  const [lastPoll, setLastPoll] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let cancelled = false;

    // Local CORS proxy (proxy-server.js) returns raw RSS/XML from aph.gov.au.
    // Use DOMParser to extract <item> elements.
    const parseRSSXml = (text, feedMeta) => {
      const out = [];
      try {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        const items = doc.querySelectorAll("item");
        const seen = new Set();
        items.forEach(item => {
          if (out.length >= 6) return;
          const title = item.querySelector("title")?.textContent?.trim().replace(/\s+/g, " ") || "";
          // <link> in RSS 2.0 is a text node between tags (not an attribute)
          const linkEl = item.querySelector("link");
          const link = safeHttpUrl((linkEl?.textContent || linkEl?.getAttribute("href") || "").trim());
          const pubDateStr = item.querySelector("pubDate")?.textContent?.trim() || null;
          const pubDate = pubDateStr ? new Date(pubDateStr) : null;
          if (title.length < 10 || !link) return;
          const key = title.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          out.push({
            title, link,
            date: (pubDate && !isNaN(pubDate)) ? pubDate : null,
            sourceLabel: feedMeta.label,
            sourceUrl:   feedMeta.url,
            kind:        feedMeta.kind,
            order:       out.length,
          });
        });
      } catch (e) { /* parse error — return empty */ }
      return out;
    };

    // F1: a file:// origin cannot reach a proxy; guard early so the panel can advise.
    if (location.protocol === "file:") {
      setFeedStatus({ __fileGuard: { ok: false, error: "Opened from the file system. Serve over http to reach the feed proxy." } });
      setEvents([]);
      setLoading(false);
      return () => { cancelled = true; };
    }

    // PERF-1: track in-flight fetches so unmount can abort them, and give each an 8s
    // timeout so a hung proxy cannot leave the panel stuck on "Polling".
    const controllers = new Set();
    const fetchOne = async (f) => {
      // Auto-detect: use Cloudflare Worker in production, local proxy in dev.
      // The Worker serves /rss?u=<encoded feed url> (route fix; deploy blocker).
      const proxyBase = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
        ? "http://localhost:3001/proxy?url="
        : "https://aph-proxy.jvega019.workers.dev/rss?u=";
      const proxy = proxyBase + encodeURIComponent(f.url);
      const ctrl = new AbortController();
      controllers.add(ctrl);
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(proxy, { signal: ctrl.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return parseRSSXml(await res.text(), f);
      } finally {
        clearTimeout(timer);
        controllers.delete(ctrl);
      }
    };

    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;            // skip overlapping polls so results cannot land out of order
      inFlight = true;
      setLoading(true);
      const feeds = liveFeedList();
      // PERF-1: cap concurrency at 3 rather than firing every feed at once.
      const results = await mapPool(feeds, 3, fetchOne);
      if (cancelled) { inFlight = false; return; }
      const all = [];
      const status = {};
      results.forEach((r, i) => {
        const f = feeds[i];
        const reg = SOURCE_REGISTRY.find(x => x.url === f.url);
        if (r.status === "fulfilled") {
          status[f.url] = { ok: true, count: r.value.length, label: f.label };
          if (reg) {
            reg.lastStatusCode = 200;
            reg.errorDetail = null;
            reg.lastItemCount = r.value.length;
          }
          all.push(...r.value.map((it, idx) => ({ ...it, feedIdx: i, itemIdx: idx })));
        } else {
          status[f.url] = { ok: false, error: String(r.reason).slice(0, 80), label: f.label };
          if (reg) {
            reg.lastStatusCode = 0;
            reg.errorDetail = String(r.reason).slice(0, 80);
            reg.lastItemCount = null;
          }
        }
      });
      window.__sourceHealth = sourceCounts();
      // Newest first, undated items last (sortLiveEventsNewestFirst), then capped.
      setEvents(sortLiveEventsNewestFirst(all).slice(0, 30));
      setFeedStatus(status);
      setLastPoll(new Date());
      setLoading(false);
      inFlight = false;
    };

    window.__refreshLiveFeeds = poll;
    if (consumeLiveRefresh()) toast("Refreshing live feeds...", "brass");
    poll();
    const id = setInterval(poll, 120000); // 2 min
    return () => { cancelled = true; clearInterval(id); controllers.forEach(c => c.abort()); window.__refreshLiveFeeds = null; };
  }, []);

  // The shared short formatter (store.jsx): the Brisbane clock today, else "28 Sep".
  const fmtTime = (d) => (!d || Number.isNaN(d.getTime()) ? NOT_SUPPLIED : fmtWhenShort(d.getTime()));
  const liveCount = Object.values(feedStatus).filter(s => s.ok).length;
  const totalFeeds = Object.keys(feedStatus).filter(k => k !== "__fileGuard").length || liveFeedList().length;
  // Collected feed errors, surfaced in the empty-state panel (F1).
  const feedErrors = Object.entries(feedStatus)
    .filter(([, s]) => s && !s.ok)
    .map(([url, s]) => ({ url, label: s.label || url, error: s.error }));
  const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const isFileGuard = !!(feedStatus.__fileGuard);
  // Developer detail (proxy instructions, raw feed errors, worker URL) is shown only
  // on localhost or with ?debug=1. Public production sees a calm reconnecting message.
  const debugView = (() => { try { return new URLSearchParams(location.search).has("debug"); } catch { return false; } })();
  const showDevDetail = isLocalHost || isFileGuard || debugView;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today · live</div>
          <h1 className="page-title">Live parliament</h1>
          <div className="page-sub">The APH live stream, links to the official chamber pages, and the latest items from the official APH feeds.</div>
        </div>
        <div className="live-head-actions" data-live-actions="">
          {PARLVIEW_CHAMBERS.map(c => (
            <a key={c.id} href={PARLVIEW_URL} target="_blank" rel="noopener noreferrer" className="btn" data-chamber-link={c.id}
              title={`Watch the ${c.label === "House" ? "House of Representatives" : c.label} on ParlView (APH)`} style={{textDecoration:"none"}}>
              {c.label} on ParlView <Icon name="ext" size={12}/>
            </a>
          ))}
          <button className="btn" title="Copy a timestamped live action note" onClick={() => copyLiveActionNote("Flag moment", toast)}><Icon name="flag" size={13}/> Flag moment</button>
        </div>
      </div>

      <div className="grid g-live-main" style={{gap:16}}>
        <div>
          <LiveBroadcast />
          <div style={{display:"flex", gap:8, marginTop:12, alignItems:"center", flexWrap:"wrap"}}>
            <span className="src-badge">AUSParliamentLive · YouTube, loads on request</span>
            <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--link)"}}><Icon name="ext" size={11}/> AUSParliamentLive</a>
            <a href={PARLVIEW_URL} target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--link)"}}><Icon name="ext" size={11}/> ParlView archive</a>
            <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--link)"}}><Icon name="ext" size={11}/> Hansard</a>
            <button className="btn sm ghost" style={{marginLeft:"auto"}} title="Copy a Hansard follow-up note" onClick={() => copyLiveActionNote("Transcript follow-up", toast)}>Copy transcript note</button>
            <button className="btn sm" title="Copy a source-backed clip note" onClick={() => copyLiveActionNote("Clip to brief", toast)}><Icon name="brief" size={12}/> Clip to brief</button>
          </div>

          <div className="panel" style={{marginTop:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Daily program</h2>
              <span className="panel-kicker">House and Senate</span>
              <span style={{marginLeft:"auto", display:"flex", gap:12, flexWrap:"wrap"}}>
                <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" target="_blank" rel="noopener noreferrer" style={{fontSize:"var(--t-caption)", color:"var(--link)", textDecoration:"none"}}>House program <Icon name="ext" size={11}/></a>
                <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents" target="_blank" rel="noopener noreferrer" style={{fontSize:"var(--t-caption)", color:"var(--link)", textDecoration:"none"}}>Senate program <Icon name="ext" size={11}/></a>
              </span>
            </div>
            <div className="panel-body">
              <EmptyState icon="clock" kicker="Programs are on aph.gov.au">
                This page does not build a chamber daily program. House daily program items from the APH feed appear in the "Recent items · APH RSS" panel on this page whenever the feed returns them. Open the House or Senate program above for the current official schedule.
              </EmptyState>
            </div>
          </div>

          {/* APH source links panel */}
          <div className="panel" style={{marginTop:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Official APH links</h2>
              <span className="panel-kicker">Source pages</span>
            </div>
            <div className="panel-body">
              <div className="g-link-grid" style={{display:"grid", gap:8}}>
                {[
                  { name: "Hansard", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", desc: "Official Hansard source page" },
                  { name: "ParlInfo Search", url: "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p", desc: "Official search page" },
                  { name: "Bills Search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", desc: "Official bills search page" },
                  { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", desc: "Official Senate program page" },
                  { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official House program page" },
                  { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official division lists page" },
                  { name: "Committee RSS feeds", url: "https://www.aph.gov.au/Parliamentary_Business/Committees", desc: "Official committee RSS listing" },
                  { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Official member roster page" },
                ].map((c,i) => (
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:"1px solid var(--line-2)", borderRadius:6, textDecoration:"none", color:"var(--ink)", background:"var(--panel-2)"}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:"var(--t-body-sm)", fontWeight:500}}>{c.name}</div>
                      <div style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)", marginTop:2}}>{c.desc}</div>
                    </div>
                    <Icon name="ext" size={12} stroke="var(--ink-3)"/>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Recent items · APH RSS</h2>
            <span className="panel-kicker">{loading && events.length === 0 ? "Polling…" : `${events.length} item${events.length !== 1 ? "s" : ""} · ${liveCount}/${totalFeeds} feeds${lastPoll ? " · as at " + fmtTime(lastPoll) + " AEST" : ""}`}</span>
          </div>
          <div className="panel-body" style={{maxHeight:720, overflowY:"auto"}}>
            {loading && events.length === 0 && (
              <div style={{padding:"8px 0"}} role="status" aria-label="Loading live RSS feed" aria-busy="true">
                {[...Array(6)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )}
            {!loading && events.length === 0 && (
              showDevDetail ? (
              <div className="empty-state error" style={{fontSize:"var(--t-body-sm)", color:"var(--ink-3)"}}>
                <Icon name="flag" size={15} stroke="var(--caution)" />
                <div>
                <div style={{color:"var(--caution)", fontWeight:500, marginBottom:6}}>No items returned</div>
                {isFileGuard ? (
                  <>
                    <p style={{margin:"0 0 8px"}}>This page was opened from the file system, so the browser cannot reach the feed proxy.</p>
                    <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:"var(--t-eyebrow)", background:"var(--panel-2)", padding:"6px 8px", borderRadius:4}}>
                      Serve over http, for example: <strong>python -m http.server 8080</strong>
                    </p>
                  </>
                ) : isLocalHost ? (
                  <>
                    <p style={{margin:"0 0 8px"}}>The local CORS proxy did not return data. Either the proxy is not running or APH rejected the request.</p>
                    <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:"var(--t-eyebrow)", background:"var(--panel-2)", padding:"6px 8px", borderRadius:4}}>
                      Start the proxy: <strong>node proxy-server.js</strong>
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{margin:"0 0 8px"}}>Worker returned no items. Confirm the Cloudflare Worker is deployed and this origin is on its CORS allowlist.</p>
                    <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:"var(--t-eyebrow)", background:"var(--panel-2)", padding:"6px 8px", borderRadius:4, wordBreak:"break-all"}}>
                      Worker: <strong>https://aph-proxy.jvega019.workers.dev/rss?u=</strong>
                    </p>
                  </>
                )}
                {feedErrors.length > 0 && (
                  <div style={{margin:"0 0 8px"}}>
                    <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".18em", marginBottom:4}}>Feed errors</div>
                    {feedErrors.slice(0, 8).map((e, i) => (
                      <div key={i} style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)", display:"flex", gap:8, padding:"2px 0"}}>
                        <Icon name="close" size={12} stroke="var(--ember-flash)" />
                        <span style={{flex:1, minWidth:0}}>{e.label}</span>
                        <span className="mono" style={{color:"var(--ink-4)"}}>{e.error}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{margin:0}}>Links below still open the raw feeds in a new tab.</p>
                </div>
              </div>
              ) : (
              <div className="empty-state" style={{fontSize:"var(--t-body-sm)", color:"var(--ink-3)"}}>
                <Icon name="signal" size={15} stroke="var(--ink-4)" />
                <div>
                  <div style={{color:"var(--ink-2)", fontWeight:500, marginBottom:6}}>Live feed reconnecting</div>
                  <p style={{margin:0}}>No new items in the latest poll. The official source links open the raw feeds directly.</p>
                </div>
              </div>
              )
            )}
            {events.map((e, i) => (
              <a key={e.link || e.title + i} href={safeHttpUrl(e.link) || safeHttpUrl(e.sourceUrl) || "#"} target="_blank" rel="noopener noreferrer" className="clk data-row g-live-event" style={{display:"grid", gap:10, borderRadius:6, alignItems:"start", textDecoration:"none", color:"inherit"}}>
                <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", paddingTop:2}}>{fmtTime(e.date)}</div>
                <div style={{paddingTop:3}}>
                  {e.kind === "division" && <Icon name="flag" size={13} stroke="var(--escalate)"/>}
                  {e.kind === "hearing" && <Icon name="signal" size={13} stroke="var(--ink-4)"/>}
                  {e.kind === "inquiry" && <Icon name="pattern" size={13} stroke="var(--brass)"/>}
                  {e.kind === "digest" && <Icon name="brief" size={13} stroke="var(--brass)"/>}
                  {e.kind === "program" && <Icon name="clock" size={13} stroke="var(--ink-3)"/>}
                  {e.kind === "report" && <Icon name="brief" size={13} stroke="var(--ink-4)"/>}
                  {e.kind === "signal" && <Icon name="signal" size={13} stroke="var(--ink-3)"/>}
                </div>
                <div>
                  <div style={{fontSize:"var(--t-body-sm)", color:"var(--ink)", lineHeight:1.4}}>{e.title}</div>
                  <div style={{display:"flex", gap:8, marginTop:6, alignItems:"center", flexWrap:"wrap"}}>
                    <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{e.kind}</span>
                    <span style={{fontSize:"var(--t-micro)", color:"var(--link)", fontFamily:"var(--mono)", display:"inline-flex", alignItems:"center", gap:3}}>
                      <Icon name="ext" size={10}/> {e.sourceLabel}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div className="panel-foot" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
            <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-3)"}}>Official APH RSS feeds · refreshes every 2 min</span>
            <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>Last poll: {lastPoll ? fmtTime(lastPoll) : NOT_SUPPLIED} · Click any item to open source</span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ---------- RADAR ----------
function PageRadar() {
  // FE-06 (DATA-15): this desk counts live signals by the Worker's source group
  // (chamber or feed family). It is an activity tally, so it carries only what the
  // tally holds: items, contributing feeds and the highest attention level among
  // them. It claims no trend and prescribes no next step.
  const live = useLiveState("signals");
  const derivedRows = React.useMemo(() => {
    if (!live.items) return null;
    const rank = { high: 3, med: 2, low: 1 };
    const groups = new Map();
    live.items.forEach(s => {
      const key = s.sourceGroup || "Other";
      const g = groups.get(key) || { group: key, count: 0, sources: new Set(), att: null };
      g.count += 1;
      if (s.source) g.sources.add(s.source);
      // Attention climbs only from a real med/high signal; a group of unscored
      // items keeps att null and renders "—", never a fabricated "Low".
      if ((rank[s.attention] || 0) > (rank[g.att] || 0)) g.att = s.attention;
      groups.set(key, g);
    });
    return [...groups.values()]
      .map(g => ({ group: g.group, att: g.att, sources: g.sources.size, count: g.count }))
      .sort((a, b) => b.count - a.count);
  }, [live.items]);
  const derived = !!derivedRows;
  const rows = derivedRows || RADAR;
  // UX-03: a column in which every row carries the same value separates nothing,
  // so it collapses to one line that says so.
  const attAll = uniformScore(rows, "att");
  const showAtt = attAll === undefined;
  const cols = showAtt ? "1fr 90px 90px 150px" : "1fr 90px 90px";
  const head = {color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"};
  const disclosure = attentionDisclosure(scoringDims((live.items || []).map(s => s.attentionReason)));
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Activity by source</h1>
          <div className="page-sub">Live signals counted by source group, with the number of feeds behind each group and the highest attention level among its items. A tally of what the feeds published, not a trend.</div>
        </div>
        <ProvenanceChip provenance={derived ? "derived" : "fixture"}
          title={derived ? "Counted from the live signal stream" : "Live data is unavailable, so no groups render"} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Source groups</h2>
          <span className="panel-kicker">{derived ? `${rows.length} group${rows.length !== 1 ? "s" : ""} from ${live.items.length} live signals` : "No live signal stream connected"}</span>
        </div>
        <div className="panel-body">
          {rows.length === 0 ? (
            <EmptyState icon="radar" kicker="Live data unavailable" variant="error">
              Live data is unavailable. Parliament Pulse shows nothing rather than an invented tally. <a href="https://www.aph.gov.au" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Go to aph.gov.au</a>.
            </EmptyState>
          ) : (
          <>
          {!showAtt && <div className="score-uniform" data-uniform="attention" style={{fontSize:"var(--t-body-sm)", color:"var(--ink-3)", marginBottom:10}}>{uniformScoreLine(rows.length, "attention", attAll)}</div>}
          <div className="radar-row radar-head g-radar-table" style={{display:"grid", gridTemplateColumns:cols, padding:"4px 0 10px", borderBottom:"1px solid var(--line)", alignItems:"center", gap:14}}>
            <div className="mono t-label" style={head}>Source group</div>
            <div className="mono t-label" style={{...head, textAlign:"right"}}>Items</div>
            <div className="mono t-label" style={{...head, textAlign:"right"}}>Feeds</div>
            {showAtt && <div className="mono t-label" data-col="attention" style={head} title={disclosure}>Highest attention</div>}
          </div>
          {rows.map((r,i) => (
            <div key={r.group} className="radar-row g-radar-table" style={{display:"grid", gridTemplateColumns:cols, padding:"14px 8px", borderBottom: i<rows.length-1 ? "1px solid var(--line)" : 0, gap:14, alignItems:"center", borderRadius:6}}>
              <div style={{fontSize:"var(--t-body)", fontWeight:500}}>{r.group}</div>
              <div className="mono radar-num" style={{textAlign:"right", color:"var(--ink-2)"}}>{r.count}<span className="radar-mlabel"> item{r.count !== 1 ? "s" : ""}</span></div>
              <div className="mono radar-num" style={{textAlign:"right", color:"var(--ink-2)"}}>{r.sources}<span className="radar-mlabel"> feed{r.sources !== 1 ? "s" : ""}</span></div>
              {showAtt && <div data-col="attention"><Att level={r.att} disclosure={disclosure}/></div>}
            </div>
          ))}
          <div className="score-disclosure" data-att-disclosure-line="" style={{fontSize:"var(--t-caption)", color:"var(--ink-4)", marginTop:12}}>{disclosure}</div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- SIGNALS ----------
// The signals-block mapper (mapWorkerSignalToCard) and the single /state fetch now
// live in store.jsx. PageSignals reads the shared cache through useLiveState, so the
// Drawer resolves a clicked live row against the same items the inbox renders.
function signalPubMs(s) {
  if (typeof s.pubAt === "number" && Number.isFinite(s.pubAt)) return s.pubAt;
  return null;
}
function sortSignalsNewestFirst(sigs) {
  return [...sigs].sort((a, b) => {
    const ta = signalPubMs(a), tb = signalPubMs(b);
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb - ta;
  });
}
function PageSignals() {
  const { state, setVisibleSignalOrder, signalSearchQuery, setSignalSearchQuery } = useStore();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("time");
  // Live /state consumer via the shared hook. sourceSignals is the fixture until the
  // Worker confirms the block is live and non-empty; the fixture is never replaced on
  // a guess, and the chip reflects whichever array is on screen.
  const live = useLiveState("signals");
  const sourceSignals = live.items || SIGNALS;

  const visible = React.useMemo(() => {
    let sigs = sourceSignals.filter(s => !state.archived[s.id]);
    const query = (signalSearchQuery || "").trim().toLowerCase();
    if (query) sigs = sigs.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.summary.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query) ||
      (s.tags || []).some(t => (t.l || "").toLowerCase().includes(query))
    );
    if (filter !== "all") sigs = sigs.filter(s => s.attention === filter);
    if (sort === "score") sigs = [...sigs].sort((a, b) => (b.score?.authority || 0) - (a.score?.authority || 0));
    // "Newest first": the Worker sends score-then-recency order, so this sort is
    // what makes the option true. Dated items by publication time, newest first;
    // undated items after them, in the order received (Array sort is stable).
    else if (sort === "time") sigs = sortSignalsNewestFirst(sigs);
    return sigs;
  }, [sourceSignals, state.archived, filter, sort, signalSearchQuery]);

  React.useEffect(() => {
    setVisibleSignalOrder(visible.map(s => s.id));
    return () => setVisibleSignalOrder(null);
  }, [visible, setVisibleSignalOrder]);

  const counts = React.useMemo(() => ({
    all: sourceSignals.filter(s => !state.archived[s.id]).length,
    high: sourceSignals.filter(s => s.attention === "high" && !state.archived[s.id]).length,
    med: sourceSignals.filter(s => s.attention === "med" && !state.archived[s.id]).length,
    low: sourceSignals.filter(s => s.attention === "low" && !state.archived[s.id]).length,
  }), [sourceSignals, state.archived]);

  // Progressive rendering (spec 3.3). Below 81 items the list is byte-identical to
  // before. At higher counts the list renders in CHUNK-sized pages and grows the cap
  // as a sentinel scrolls into view. The full `visible` order still feeds
  // visibleSignalOrder above, so keyboard j/k navigation is never truncated.
  const CHUNK = 60;
  const [renderCap, setRenderCap] = useState(CHUNK);
  const sentinelRef = React.useRef(null);
  const progressive = visible.length > 80;
  const shown = progressive ? visible.slice(0, renderCap) : visible;
  const moreToShow = progressive && shown.length < visible.length;
  const filterLabel = { high: "high", med: "medium", low: "low" }[filter] || filter;

  // UX-03: measured over the inbox in view BEFORE the attention filter, so choosing
  // "High" never collapses the column merely because the filter made it uniform.
  const inView = React.useMemo(() => sourceSignals.filter(s => !state.archived[s.id]), [sourceSignals, state.archived]);
  const attAll = uniformScore(inView, "attention");
  const confAll = uniformScore(inView, "confidence");
  const hideAtt = attAll !== undefined;
  const hideConf = confAll !== undefined;
  const disclosure = attentionDisclosure(scoringDims(inView.map(s => s.attentionReason)));

  // Reset the cap when the slice changes so a filter, sort, or search switch starts
  // from the first page.
  React.useEffect(() => { setRenderCap(CHUNK); }, [filter, sort, signalSearchQuery]);

  // Expose a bump hook while mounted so keyboard navigation can reveal a card that
  // sits past the current cap before scrolling to it (spec 3.3 keyboard invariant).
  // Frozen interface: window.ppBumpRenderCap(delta) raises the render cap by `delta`
  // rows; shell.jsx's j/k nav calls it when the cursor passes the current cap. A
  // non-positive or missing delta falls back to one CHUNK. Below 81 items the list is
  // not chunked, so the bump is a harmless no-op. Unset on unmount so the caller
  // treats it as a no-op elsewhere.
  React.useEffect(() => {
    window.ppBumpRenderCap = (targetIndex) => {
      const idx = (typeof targetIndex === "number" && targetIndex >= 0) ? targetIndex : 0;
      setRenderCap(cap => (idx < cap ? cap : Math.ceil((idx + 1) / CHUNK) * CHUNK));
    };
    return () => { window.ppBumpRenderCap = null; };
  }, []);

  // IntersectionObserver grows the cap as the sentinel nears the viewport. The
  // observer re-attaches after each growth; while the sentinel stays in range it
  // pages again until the list is filled or scrolled away. The Show more button below
  // covers the observer-less and keyboard paths.
  React.useEffect(() => {
    if (!moreToShow) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setRenderCap(cap => cap + CHUNK);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [moreToShow, shown.length, visible.length]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today · triage workspace</div>
          <h1 className="page-title">Signal inbox</h1>
          <div className="page-sub">{counts.all} active signals · {counts.high} high · {counts.med} medium · {counts.low} low. Open any signal to action, archive, or generate a brief.</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <ProvenanceChip provenance={live.displayProvenance}
            title={live.displayProvenance === "live" ? "Signals from the official APH feeds" : "Live data is unavailable, so these signals are not live"} />
          <label htmlFor="sig-sort" className="sr-only">Sort signals</label>
          <span aria-hidden="true" style={{fontSize:"var(--t-caption)", color:"var(--ink-4)"}}>Sort:</span>
          <select id="sig-sort" className="select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="time">Newest first</option>
            <option value="score">Authority score</option>
          </select>
        </div>
      </div>

      {signalSearchQuery && (
        <div className="empty-state" style={{marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12}}>
          <span>Filtered by search: "{signalSearchQuery}"</span>
          <button className="btn sm ghost" onClick={() => setSignalSearchQuery("")}>Clear search</button>
        </div>
      )}

      <div role="group" aria-label="Filter signals by attention level" style={{display:"flex", gap:8, marginBottom:16, flexWrap:"wrap"}}>
        {[["all","All"], ["high","High"], ["med","Medium"], ["low","Low"]].map(([val, label]) => (
          <button key={val} className={"filter-chip" + (filter === val ? " active" : "")}
            aria-pressed={filter === val} onClick={() => setFilter(val)}>
            {label} <span className="mono" style={{color:"var(--ink-2)"}}>({counts[val]})</span>
            {filter === val && <span className="sr-only"> (active filter)</span>}
          </button>
        ))}
      </div>

      {live.status === "loading" && !live.items ? (
        <div role="status" aria-busy="true" aria-label="Loading signals">{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : visible.length === 0 ? (
        filter !== "all" ? (
          <EmptyState icon="signal" kicker="No matches"
            action={<button className="btn sm ghost" onClick={() => setFilter("all")}>Clear filter</button>}>
            No {filterLabel} attention signals right now. Clear the filter to see the full inbox.
          </EmptyState>
        ) : signalSearchQuery ? (
          <EmptyState icon="signal" kicker="No matches"
            action={<button className="btn sm ghost" onClick={() => setSignalSearchQuery("")}>Clear search</button>}>
            Nothing matches "{signalSearchQuery}" in the signal inbox. Try a shorter term.
          </EmptyState>
        ) : !live.items ? (
          <EmptyState icon="signal" kicker="Live data unavailable" variant="error">
            Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. <a href="https://www.aph.gov.au" target="_blank" rel="noopener noreferrer" style={{color:"var(--link)"}}>Go to aph.gov.au</a>.
          </EmptyState>
        ) : (
          <EmptyState icon="check" kicker="Inbox zero">
            All signals reviewed. New items appear when the next feed poll lands.
          </EmptyState>
        )
      ) : (
        <div>
          {(hideAtt || hideConf) && (
            <div className="score-uniform" style={{fontSize:"var(--t-body-sm)", color:"var(--ink-3)", marginBottom:12}}>
              {hideAtt && <div data-uniform="attention">{uniformScoreLine(inView.length, "attention", attAll)}</div>}
              {hideConf && <div data-uniform="confidence">{uniformScoreLine(inView.length, "confidence", confAll)}</div>}
            </div>
          )}
          {shown.map(s => <SignalCard key={s.id} s={s} hideAtt={hideAtt} hideConf={hideConf} />)}
          <div className="score-disclosure" data-att-disclosure-line="" style={{fontSize:"var(--t-caption)", color:"var(--ink-4)", marginTop:12}}>{disclosure}</div>
          {moreToShow && <div ref={sentinelRef} className="list-sentinel" aria-hidden="true" />}
          {progressive && (
            <div className="list-progress" style={{display:"flex", alignItems:"center", gap:12, padding:"14px 4px 4px"}}>
              <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", letterSpacing:".08em"}}>
                {moreToShow ? `Showing ${shown.length} of ${visible.length} signals` : `Showing all ${visible.length} signals`}
              </span>
              {moreToShow && <button className="btn sm ghost" style={{marginLeft:"auto"}} onClick={() => setRenderCap(cap => cap + CHUNK)}>Show more</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PageOverview, PageLive, PageRadar, PageSignals, OnboardingGuide });
