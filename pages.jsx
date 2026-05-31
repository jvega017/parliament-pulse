// Pages — all entities are clickable; store-wired

const { useState, useMemo } = React;

function csvEscape(v) {
  const text = v == null ? "" : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportSignalsCSV() {
  const headers = ["id","date","source","attention","title","action","confidence"];
  const rows = SIGNALS.map(s => [
    s.id, s.date, s.source, s.attention,
    s.title,
    s.action,
    s.confidence,
  ]);
  exportRowsCSV(headers, rows, `parliament-pulse-signals-${new Date().toISOString().slice(0,10)}.csv`);
}

// Reused by the Bills register export (F4): generic array-to-CSV download with no blob leak.
function exportRowsCSV(headers, rows, filename) {
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- OVERVIEW ----------
function OnboardingGuide() {
  const key = "pp-onboarded";
  const [visible, setVisible] = React.useState(() => !localStorage.getItem(key));
  if (!visible) return null;
  return (
    <div style={{background:"var(--panel-hi)", border:"1px solid var(--brass-soft)", borderRadius:10, padding:"16px", marginBottom:18}}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
        <Icon name="signal" size={14} stroke="var(--brass)" />
        <span className="mono t-label" style={{color:"var(--brass)", textTransform:"uppercase", letterSpacing:".18em"}}>Getting started</span>
        <button onClick={() => { localStorage.setItem(key, "1"); setVisible(false); }}
          style={{marginLeft:"auto", background:"none", border:"none", color:"var(--ink-4)", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px"}}
          aria-label="Dismiss guide">×</button>
      </div>
      <div className="g-onboarding" style={{display:"grid", gap:14}}>
        {[
          ["1. Signals", "Parliamentary intelligence items classified by attention level. Open any signal to read the full analysis and evidence trail."],
          ["2. Take action", "Open a signal, read the recommended action, then archive, generate a brief, or add to a watchlist. Use j/k to navigate, Esc to close."],
          ["3. Generate briefs", "Press b or click Generate brief to copy a structured brief to the clipboard. Completed briefs appear in the Briefings queue."],
        ].map(([h, b]) => (
          <div key={h} style={{fontSize:12.5, color:"var(--ink-2)"}}>
            <div style={{fontWeight:600, color:"var(--brass)", marginBottom:4, fontSize:12}}>{h}</div>
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}

function PageOverview() {
  const { openModal, state, toast, navigate } = useStore();
  const goto = navigate;
  // Local overview controls (F4): real state, not toast-only stubs.
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [sortByAttention, setSortByAttention] = useState(false);
  const priority = SIGNALS.filter(s => s.attention === "high" && !state.archived[s.id]);
  let rest = SIGNALS.filter(s => s.attention !== "high" && !state.archived[s.id]);
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

  const generateDailyBrief = () => {
    const today = new Date().toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" });
    const prioritySections = priority.length === 0 ? ["None."] : priority.map(s => {
      const brief = buildBriefSections(s);
      return [
        `### ${brief.meta.id} - ${brief.title}`,
        `Source: ${brief.meta.source} | Confidence: ${brief.meta.confidence}/5`,
        brief.summary,
        `**Action:** ${brief.recommendedAction.label}. ${brief.recommendedAction.reason}`,
        ``,
      ].join("\n");
    });
    const restSections = rest.length === 0 ? ["None."] : rest.map(s => {
      const brief = buildBriefSections(s);
      return `- [${brief.meta.id}] ${brief.title} - ${brief.recommendedAction.label}`;
    });
    const lines = [
      `# Parliamentary Daily Signal Brief — ${today}`,
      `Generated: ${new Date().toISOString()}`,
      `Total signals: ${priority.length + rest.length} · Priority: ${priority.length}`,
      ``,
      `## Priority signals`,
      ...prioritySections,
      `## All other signals`,
      ...restSections,
    ].join("\n");
    navigator.clipboard.writeText(lines)
      .then(() => toast("Daily brief copied to clipboard", "brass"))
      .catch(() => toast("Clipboard unavailable: brief not copied", "error"));
  };
  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="signal" size={13} stroke="var(--brass)" />
        <span><strong>Representative data.</strong> Signal counts, deltas, committee tiles and source-health tiles are representative. Only the Live RSS page polls real feeds.</span>
      </div>
      <OnboardingGuide />
      <div className="page-head">
        <div>
          <div className="page-kicker">{new Date().toLocaleDateString("en-AU", {weekday:"short", day:"numeric", month:"short", year:"numeric"})} · Sitting day</div>
          <h1 className="page-title">Today's signals</h1>
          <div className="page-sub">{priority.length + rest.length} representative signal items. {priority.length} classified as priority. {sourceCounts().total} official feeds configured.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn ghost sm" onClick={exportSignalsCSV}><Icon name="ext" size={12}/> Export CSV</button>
          <button className="btn primary" onClick={generateDailyBrief}><Icon name="brief" size={13}/> Generate daily brief</button>
        </div>
      </div>

      {/* COMMAND STRIP HERO — one dominant KPI flanked by three secondary stats */}
      <div className="command-strip">
        <div className="panel stat hero-stat" style={{borderLeft:"3px solid var(--brass)"}}>
          <div className="stat-label">New signals today</div>
          <div className="stat-value t-kpi">{priority.length + rest.length}</div>
          <div className="stat-meta"><span style={{color:"var(--ink-3)"}}>{priority.length} classified priority</span></div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Priority signals</div>
          <div className="stat-value t-stat" style={{color: priority.length > 0 ? "var(--ember-flash)" : "var(--ok)"}}>
            {priority.length}
          </div>
          <div className="stat-meta">
            <span>{priority.length > 0 ? "Requires review" : "All actioned"}</span>
            <span style={{marginLeft:"auto", fontFamily:"var(--mono)", fontSize:10}}>
              {SIGNALS.filter(s => state.archived[s.id]).length}/{SIGNALS.length} done
            </span>
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Committee activity</div>
          <div className="stat-value t-stat">7<span className="unit">items</span></div>
          <div className="stat-meta">2 hearings · 1 inquiry · 1 report</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Source health</div>
          <div className="stat-value t-stat">{sourceCounts().total}<span className="unit">feeds</span></div>
          <div className="stat-meta">Official feeds configured</div>
        </div>
      </div>

      {/* LIVE NOW STRIP — situational context; below stats in HUD hierarchy */}
      <div className="live-strip g-live-strip" style={{display:"grid", gap:14, alignItems:"center", padding:"12px 16px", marginBottom:16}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={{width:8, height:8, borderRadius:"50%", background:"var(--ember-flash)", boxShadow:"0 0 12px var(--ember-flash)", animation:"pulse 1.6s ease-in-out infinite"}}/>
          <span className="mono" style={{fontSize:10.5, letterSpacing:".18em", color:"var(--ember-flash)", fontWeight:600}}>
            AEST {new Date().toLocaleTimeString("en-AU", {hour:"2-digit", minute:"2-digit", timeZone:"Australia/Brisbane"})}
          </span>
        </div>
        <div style={{display:"flex", gap:18, fontSize:12.5, color:"var(--ink-2)", alignItems:"center"}}>
          <div><strong style={{color:"var(--ink)"}}>House:</strong> Question time <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:4}}>Fixture</span></div>
          <div style={{width:1, height:16, background:"var(--line-2)"}}/>
          <div><strong style={{color:"var(--ink)"}}>Senate:</strong> <button className="linklike" onClick={()=>openModal("committee","legcon")}>Legal & Constitutional</button> hearing <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:4}}>Fixture</span></div>
        </div>
        <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" className="btn sm ghost" style={{textDecoration:"none"}}><Icon name="ext" size={12}/> Hansard</a>
        <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn sm ghost" style={{textDecoration:"none"}}><Icon name="ext" size={12}/> YouTube</a>
        <button className="btn sm primary" onClick={()=> goto && goto("live")}><Icon name="signal" size={12}/> Watch live</button>
      </div>

      <div className="grid g-overview">
        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Priority signals</h2>
              <span className="panel-kicker">{priority.length} items · human review required</span>
              <div style={{marginLeft:"auto", display:"flex", gap:6}}>
                <button className={"btn ghost sm" + (groupByTopic ? " active" : "")} aria-pressed={groupByTopic} onClick={() => setGroupByTopic(v => !v)}>Group by topic</button>
                <button className={"btn ghost sm" + (sortByAttention ? " active" : "")} aria-pressed={sortByAttention} onClick={() => setSortByAttention(v => !v)}>Sort: attention</button>
              </div>
            </div>
            <div className="panel-body">
              {priority.map(s => <SignalCard key={s.id} s={s} />)}
              {priority.length === 0 && <EmptyState icon="check" kicker="Priority clear">All priority signals actioned.</EmptyState>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">All signals · last 24h</h2>
              <span className="panel-kicker">{rest.length} items{groupByTopic ? " · grouped" : sortByAttention ? " · sorted by attention" : ""}</span>
            </div>
            <div className="panel-body">
              {groupByTopic
                ? Object.entries(restGroups).map(([topic, sigs]) => (
                    <div key={topic} style={{marginBottom:10}}>
                      <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".18em", margin:"6px 0 8px"}}>{topic} · {sigs.length}</div>
                      {sigs.map(s => <SignalCard key={s.id} s={s} />)}
                    </div>
                  ))
                : rest.map(s => <SignalCard key={s.id} s={s} />)}
              {rest.length === 0 && <EmptyState icon="check" kicker="Review clear">All lower-priority signals reviewed. Check Attention radar for emerging issues.</EmptyState>}
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h2 className="panel-title">What changed</h2>
              <span className="panel-kicker">Since 17:00 yesterday</span>
              <span className="chip-fixture" style={{marginLeft:"auto"}}>Fixture</span>
            </div>
            <div className="panel-body">
              {/* Return hook — surfaces analyst's prior session activity */}
              <div style={{marginBottom:10, paddingBottom:10, borderBottom:"1px solid var(--line)", fontSize:12, color:"var(--ink-3)"}}>
                {Object.keys(state.archived).length > 0
                  ? `You actioned ${Object.keys(state.archived).length} signal${Object.keys(state.archived).length !== 1 ? "s" : ""} this session.`
                  : "No signals actioned yet this session."}{" "}
                {SIGNALS.length} new signals today.
              </div>
              <div className="timeline">
                <div className="tl-item"><div className="tl-time">08:15 · Senate</div><div className="tl-body">New inquiry opened: <button className="linklike" onClick={()=>openModal("inquiry","Commonwealth procurement governance (new)")}>Digital procurement governance</button></div></div>
                <div className="tl-item teal"><div className="tl-time">07:48 · Library</div><div className="tl-body">Bills Digest: <button className="linklike" onClick={()=>openModal("bill","BILL-2026-048")}>Digital ID Amendment (Assurance) Bill 2026</button></div></div>
                <div className="tl-item info"><div className="tl-time">07:30 · Senate</div><div className="tl-body">Today's hearing · <button className="linklike" onClick={()=>openModal("committee","legcon")}>Legal & Constitutional</button> · AI assurance</div></div>
                <div className="tl-item"><div className="tl-time">07:10 · House</div><div className="tl-body">Daily program: <button className="linklike" onClick={()=>openModal("bill","BILL-2026-041")}>Cyber Security Bill</button>: 2nd reading</div></div>
                <div className="tl-item info"><div className="tl-time">Yesterday 18:04</div><div className="tl-body"><button className="linklike" onClick={()=>openModal("division", DIVISIONS[2])}>Division: CDR Expansion Bill, 2nd reading agreed</button></div></div>
                <div className="tl-item teal"><div className="tl-time">Yesterday 17:20</div><div className="tl-body">Report tabled: Regional 5G rollout, interim</div></div>
              </div>
            </div>
          </div>

          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Briefing queue</h2>
              <span className="panel-kicker">4 pending</span>
            </div>
            <div className="panel-body" style={{paddingTop:6}}>
              {BRIEFING_QUEUE.map((b,i) => (
                <div key={b.type + b.for} className="data-row g-brief-row" style={{display:"grid", gap:10}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:500}}>{b.type}</div>
                    <div style={{fontSize:11.5, color:"var(--ink-3)"}}>For {b.for} · <span className="mono">{b.at}</span></div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span className="mono" style={{fontSize:10.5, color: b.ready ? "var(--ok)" : "var(--caution)", textTransform:"uppercase", letterSpacing:".12em"}}>{b.status}</span>
                    <button className="btn sm ghost" title="Open the briefings queue" aria-label="Open briefings queue" onClick={() => goto && goto("briefings")}><Icon name="chevron" size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Source health</h2>
              <span className="panel-kicker">{sourceCounts().total} official feeds configured</span>
            </div>
            <div className="panel-body">
              {APH_FEEDS.slice(0, 6).map(f => (
                <div key={f.id} onClick={() => openModal("feed", f.id)} className="clk g-source-row" style={{display:"grid", padding:"6px 8px", gap:10, fontSize:12.5, alignItems:"center", borderRadius:6}}>
                  <div>{f.name}</div>
                  <div className="mono" style={{color:"var(--ink-4)", fontSize:11}}>—</div>
                  <div className="mono" style={{color:"var(--ink-3)", fontSize:11, textAlign:"right", width:28}}>{f.today ?? "—"}</div>
                </div>
              ))}
              <div style={{marginTop:8, fontSize:12, color:"var(--ink-3)"}}>
                Live feed status appears on the Live RSS page after a poll.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- LIVE PARLIAMENT ----------
// @AUSParliamentLive YouTube live embed. Channel ID asserted from project notes, not independently verified this session.
// YouTube's live_stream endpoint auto-resolves to whatever stream is active on that channel.
// When no stream is live, YouTube shows the channel's upcoming/latest placeholder.
const APH_YT_CHANNEL = "UCzx6ti0rql6Q2Dc2zSAPmuA"; // @AUSParliamentLive, asserted, not independently verified this session
const APH_LIVE = {
  house:    { label: "House of Representatives", streamId: null, url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
  senate:   { label: "Senate",                    streamId: null, url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
  federation:{label: "Federation Chamber",        streamId: null, url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
};

function LiveBroadcast({ which, toast }) {
  const [embedTarget, setEmbedTarget] = React.useState({ which, nonce: 0 });
  const cfg = APH_LIVE[embedTarget.which] || APH_LIVE.house;
  // mode: "embed" = YouTube live_stream iframe ; "offline" = explicit fallback
  const [mode, setMode] = React.useState("embed");
  const [nonce, setNonce] = React.useState(0); // bump to force reload
  const embedReady = embedTarget.which === which && embedTarget.nonce === nonce;
  // F9: a cross-origin iframe cannot expose true playback state, so we treat the
  // stream as unconfirmed until the iframe fires onLoad. If no load arrives within
  // the timeout we auto-switch to the offline panel. The LIVE badge is never shown
  // until the iframe has at least loaded; we still label it "Signal" not a hard LIVE
  // claim, because confirmed playback is not detectable from here.
  const [loaded, setLoaded] = React.useState(false);

  // When chamber changes or we retry, reset embed and confirmation state
  React.useEffect(() => {
    setMode("embed");
    setLoaded(false);
    const id = setTimeout(() => setEmbedTarget({ which, nonce }), 300);
    return () => clearTimeout(id);
  }, [which, nonce]);

  // Auto-switch to offline if the embed has not loaded within the timeout window.
  React.useEffect(() => {
    if (mode !== "embed" || !embedReady) return;
    const id = setTimeout(() => {
      if (!loaded) setMode("offline");
    }, 6000);
    return () => clearTimeout(id);
  }, [mode, loaded, embedReady]);

  return (
    <div className="live-wrap" style={{background:"#000", aspectRatio:"16/9", position:"relative", overflow:"hidden", borderRadius:10, border:"1px solid var(--line-2)"}}>
      {mode === "embed" && embedReady && (
        <iframe
          key={embedTarget.which + "-" + embedTarget.nonce}
          src={cfg.url}
          title={`AUSParliamentLive — ${cfg.label}`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          style={{position:"absolute", inset:0, width:"100%", height:"100%", border:0}}
        />
      )}

      {/* LIVE badge — only after the iframe has loaded; we cannot confirm playback
          cross-origin so this never asserts LIVE before a load event. */}
      {mode === "embed" && loaded && (
        <div className="live-badge" style={{position:"absolute", top:12, left:12, zIndex:3, display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.6)", padding:"5px 10px", borderRadius:4, fontFamily:"var(--mono)", fontSize:11, color:"#fff", letterSpacing:".12em", border:"1px solid var(--ember-flash)"}}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ember-flash)", boxShadow:"0 0 10px var(--ember-flash)", animation:"pulse 1.6s ease-in-out infinite"}}/>
          LIVE · {cfg.label.toUpperCase()}
        </div>
      )}

      {/* Connecting state — shown while the embed is loading, before any LIVE claim */}
      {mode === "embed" && !loaded && (
        <div style={{position:"absolute", top:12, left:12, zIndex:3, display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.6)", padding:"5px 10px", borderRadius:4, fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-2)", letterSpacing:".12em", border:"1px solid var(--line-bright)"}}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ink-3)"}}/>
          Connecting · {cfg.label.toUpperCase()}
        </div>
      )}

      {/* Manual "No stream?" pill — always available in embed mode because YouTube's
          offline state renders INSIDE the iframe and we can't detect it from here. */}
      {mode === "embed" && (
        <button
          onClick={() => setMode("offline")}
          style={{position:"absolute", top:12, right:12, zIndex:3, fontFamily:"var(--mono)", fontSize:10.5, color:"#fff", background:"rgba(0,0,0,0.55)", border:"1px solid var(--line-bright)", padding:"4px 9px", borderRadius:4, cursor:"pointer", letterSpacing:".08em"}}
          title="Show alternate sources if no stream is live"
        >
          NO STREAM?
        </button>
      )}

      {/* Fallback for no-stream / blocked / user-toggled */}
      {mode === "offline" && (
        <div style={{position:"absolute", inset:0, background:"linear-gradient(180deg, var(--panel-2), var(--bg))", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, textAlign:"center"}}>
          <div style={{fontFamily:"var(--serif)", fontSize:22, color:"var(--brass)", marginBottom:10}}>Stream unavailable</div>
          <div style={{color:"var(--ink-2)", fontSize:13, maxWidth:460, lineHeight:1.5, marginBottom:18}}>
            AUSParliamentLive only broadcasts <strong>{cfg.label}</strong> while the chamber is in session. Try the official APH pages below, or retry the embed.
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center"}}>
            <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn primary" style={{textDecoration:"none"}}>YouTube · AUSParliamentLive <Icon name="ext" size={12}/></a>
            <a href="https://www.aph.gov.au/News_and_Events/Watch_Read_Listen" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>APH Watch / Read / Listen <Icon name="ext" size={12}/></a>
            <a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>ParlView archive <Icon name="ext" size={12}/></a>
            <button className="btn" onClick={() => { setNonce(n => n + 1); setMode("embed"); }}>Retry embed</button>
          </div>
        </div>
      )}

      {/* @keyframes pulse defined globally in index.html */}
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

function safeHttpUrl(u) {
  return /^https?:\/\//i.test(u || "") ? u : "";
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

function PageLive() {
  const [which, setWhich] = useState("house");
  const { toast, openModal, consumeLiveRefresh } = useStore();

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
      // Without dates, sort by feed priority (divisions first, then hearings, etc.) then item order
      all.sort((a, b) => a.feedIdx - b.feedIdx || a.itemIdx - b.itemIdx);
      setEvents(all.slice(0, 30));
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

  const fmtTime = (d) => {
    if (!d) return "—";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `${d.getDate()} ${d.toLocaleString("en-AU",{month:"short"})}`;
  };
  const liveCount = Object.values(feedStatus).filter(s => s.ok).length;
  const totalFeeds = Object.keys(feedStatus).filter(k => k !== "__fileGuard").length || liveFeedList().length;
  // Collected feed errors, surfaced in the empty-state panel (F1).
  const feedErrors = Object.entries(feedStatus)
    .filter(([, s]) => s && !s.ok)
    .map(([url, s]) => ({ url, label: s.label || url, error: s.error }));
  const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const isFileGuard = !!(feedStatus.__fileGuard);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today · live</div>
          <h1 className="page-title">Live parliament</h1>
          <div className="page-sub">Official broadcast embed, APH source links, and live RSS polling from configured official feeds.</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button className={"btn " + (which === "house" ? "primary" : "")} onClick={() => setWhich("house")}>House</button>
          <button className={"btn " + (which === "senate" ? "primary" : "")} onClick={() => setWhich("senate")}>Senate</button>
          <button className={"btn " + (which === "federation" ? "primary" : "")} onClick={() => setWhich("federation")}>Federation</button>
          <button className="btn" title="Demo control: no capture backend in this build" onClick={() => toast("Flag moment (demo): capture backend not wired", "brass")}><Icon name="flag" size={13}/> Flag moment (demo)</button>
        </div>
      </div>

      <div className="grid g-live-main" style={{gap:16}}>
        <div>
          <LiveBroadcast which={which} toast={toast} />
          <div style={{display:"flex", gap:8, marginTop:12, alignItems:"center", flexWrap:"wrap"}}>
            <span className="src-badge">AUSParliamentLive · YouTube embed</span>
            <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--teal)"}}><Icon name="ext" size={11}/> AUSParliamentLive</a>
            <a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--teal)"}}><Icon name="ext" size={11}/> ParlView archive</a>
            <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--teal)"}}><Icon name="ext" size={11}/> Hansard</a>
            <button className="btn sm ghost" style={{marginLeft:"auto"}} title="Demo control: no transcript backend in this build" onClick={() => toast("Request transcript (demo): no transcript backend")}>Request transcript (demo)</button>
            <button className="btn sm" title="Demo control: no clip backend in this build" onClick={() => toast("Clip to brief (demo): clip backend not wired", "brass")}><Icon name="brief" size={12}/> Clip to brief (demo)</button>
          </div>

          <div className="panel" style={{marginTop:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Currently on program</h2>
              <span className="panel-kicker">{which === "house" ? "House of Representatives" : which === "senate" ? "Senate" : "Federation Chamber"}</span>
              <a href={which === "house" ? "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program" : "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red"} target="_blank" rel="noopener noreferrer" style={{marginLeft:"auto", fontSize:11.5, color:"var(--teal)", textDecoration:"none"}}>Open daily program <Icon name="ext" size={11}/></a>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <div className="tl-item"><div className="tl-time">12:00</div><div className="tl-body">Question time · <button className="linklike" onClick={()=>openModal("bill","BILL-2026-048")}>Digital ID Amendment</button> expected</div></div>
                <div className="tl-item teal"><div className="tl-time">14:00</div><div className="tl-body">Government business · 2nd reading <button className="linklike" onClick={()=>openModal("bill","BILL-2026-041")}>Cyber Security Bill</button> <span className="tag brass" style={{marginLeft:6}}>Watchlist · Cyber</span></div></div>
                <div className="tl-item info"><div className="tl-time">16:30</div><div className="tl-body">Adjournment debate</div></div>
              </div>
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
                  { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red", desc: "Official Senate program page" },
                  { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program", desc: "Official House program page" },
                  { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Division_lists", desc: "Official division lists page" },
                  { name: "Committee RSS feeds", url: "https://www.aph.gov.au/Parliamentary_Business/Committees/RSS_Feeds", desc: "Official committee RSS listing" },
                  { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Official member roster page" },
                ].map((c,i) => (
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:"1px solid var(--line-2)", borderRadius:6, textDecoration:"none", color:"var(--ink)", background:"var(--panel-2)"}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:12.5, fontWeight:500}}>{c.name}</div>
                      <div style={{fontSize:11, color:"var(--ink-3)", marginTop:2}}>{c.desc}</div>
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
            <h2 className="panel-title">Signal events · live RSS</h2>
            <span className="panel-kicker">{loading && events.length === 0 ? "Polling…" : `${events.length} items · ${liveCount}/${totalFeeds} feeds`}</span>
          </div>
          <div className="panel-body" style={{maxHeight:720, overflowY:"auto"}}>
            {loading && events.length === 0 && (
              <div style={{padding:"8px 0"}} aria-label="Loading live RSS feed" aria-busy="true">
                {[...Array(6)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )}
            {!loading && events.length === 0 && (
              <div className="empty-state error" style={{fontSize:"var(--t-body-sm)", color:"var(--ink-3)"}}>
                <Icon name="flag" size={15} stroke="var(--caution)" />
                <div>
                <div style={{color:"var(--caution)", fontWeight:500, marginBottom:6}}>No items returned</div>
                {isFileGuard ? (
                  <>
                    <p style={{margin:"0 0 8px"}}>This page was opened from the file system, so the browser cannot reach the feed proxy.</p>
                    <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:11, background:"var(--panel-2)", padding:"6px 8px", borderRadius:4}}>
                      Serve over http, for example: <strong>python -m http.server 8080</strong>
                    </p>
                  </>
                ) : isLocalHost ? (
                  <>
                    <p style={{margin:"0 0 8px"}}>The local CORS proxy did not return data. Either the proxy is not running or APH rejected the request.</p>
                    <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:11, background:"var(--panel-2)", padding:"6px 8px", borderRadius:4}}>
                      Start the proxy: <strong>node proxy-server.js</strong>
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{margin:"0 0 8px"}}>The production feed proxy did not return data. Confirm the Cloudflare Worker is deployed and that this origin is on its CORS allowlist.</p>
                    <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:11, background:"var(--panel-2)", padding:"6px 8px", borderRadius:4, wordBreak:"break-all"}}>
                      Worker: <strong>https://aph-proxy.jvega019.workers.dev/rss?u=</strong>
                    </p>
                  </>
                )}
                {feedErrors.length > 0 && (
                  <div style={{margin:"0 0 8px"}}>
                    <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".18em", marginBottom:4}}>Feed errors</div>
                    {feedErrors.slice(0, 8).map((e, i) => (
                      <div key={i} style={{fontSize:11, color:"var(--ink-3)", display:"flex", gap:8, padding:"2px 0"}}>
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
            )}
            {events.map((e, i) => (
              <a key={e.link || e.title + i} href={safeHttpUrl(e.link) || safeHttpUrl(e.sourceUrl) || "#"} target="_blank" rel="noopener noreferrer" className="clk data-row g-live-event" style={{display:"grid", gap:10, borderRadius:6, alignItems:"start", textDecoration:"none", color:"inherit"}}>
                <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", paddingTop:2}}>{fmtTime(e.date)}</div>
                <div style={{paddingTop:3}}>
                  {e.kind === "division" && <Icon name="flag" size={13} stroke="var(--escalate)"/>}
                  {e.kind === "hearing" && <Icon name="signal" size={13} stroke="var(--teal)"/>}
                  {e.kind === "inquiry" && <Icon name="pattern" size={13} stroke="var(--brass)"/>}
                  {e.kind === "digest" && <Icon name="brief" size={13} stroke="var(--brass)"/>}
                  {e.kind === "program" && <Icon name="clock" size={13} stroke="var(--ink-3)"/>}
                  {e.kind === "report" && <Icon name="brief" size={13} stroke="var(--teal)"/>}
                  {e.kind === "signal" && <Icon name="signal" size={13} stroke="var(--ink-3)"/>}
                </div>
                <div>
                  <div style={{fontSize:13, color:"var(--ink)", lineHeight:1.4}}>{e.title}</div>
                  <div style={{display:"flex", gap:8, marginTop:6, alignItems:"center", flexWrap:"wrap"}}>
                    <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{e.kind}</span>
                    <span style={{fontSize:10.5, color:"var(--teal)", fontFamily:"var(--mono)", display:"inline-flex", alignItems:"center", gap:3}}>
                      <Icon name="ext" size={10}/> {e.sourceLabel}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div className="panel-foot" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
            <span className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>Live RSS · aph.gov.au via {isLocalHost ? "local CORS proxy (proxy-server.js)" : "Cloudflare Worker proxy"} · refreshes every 2 min</span>
            <span className="mono" style={{fontSize:10, color:"var(--ink-4)"}}>Last poll: {lastPoll ? fmtTime(lastPoll) : "—"} · Click any item to open source</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- SOURCES ----------
function PageSources() {
  const { openModal, addFeed, state, toast } = useStore();
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState(null);
  const [newUrl, setNewUrl] = useState("https://www.aph.gov.au/.../FlagPost/Blog_entries");
  const [newName, setNewName] = useState("FlagPost Blog (HTML)");
  const startTest = () => {
    setTesting(true); setTestState(null);
    setTimeout(() => setTestState({
      status: "warn",
      lines: [
        { t: "ok", s: "URL resolved · 200 OK" },
        { t: "ok", s: "Content-Type: text/html · not XML" },
        { t: "warn", s: "No <rss> root detected — attempting HTML parse" },
        { t: "ok", s: "Found 12 dated entries" },
        { t: "warn", s: "Latest item date · 5 days old · verify cadence" },
        { t: "ok", s: "Links extractable · 12/12" },
        { t: "warn", s: "Recommended: mark as Needs validation before routing to modules" },
      ],
    }), 1100);
  };
  const saveFeed = () => {
    if (!newName.trim()) return;
    addFeed({ id: "custom-"+Date.now(), name: newName.trim(), url: newUrl, status:"review", group:"Custom" });
    setTestState(null);
  };

  const allFeeds = [...APH_FEEDS, ...state.feeds.map(f => ({ ...f, last:"just now", today:0, fpr:"—", modules:["Custom"], parser:"Needs validation", authority:"Custom", confidence:"—" }))];

  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="signal" size={13} stroke="var(--brass)" />
        <span><strong>Representative data.</strong> Feed URLs are the real APH endpoints, but the health metrics, item counts and the feed validator on this page are representative. The Validate step does not perform a live network check.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Admin</div>
          <h1 className="page-title">Sources</h1>
          <div className="page-sub">Official APH feed bundle plus any custom RSS feeds you've added. Each source is validated, classified and routed to modules.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn" title="Re-polls the live RSS feeds if the Live page poller is mounted" onClick={() => { if (typeof window.__refreshLiveFeeds === "function") { window.__refreshLiveFeeds(); toast("Live feeds re-polled"); } else { toast("Open the Live page to start the feed poller"); } }}><Icon name="refresh" size={13}/> Refresh all</button>
          <button className="btn primary" onClick={() => document.getElementById("new-feed-url")?.focus()}><Icon name="plus" size={13}/> Add feed</button>
        </div>
      </div>

      <div className="grid g-4" style={{marginBottom:18}}>
        <div className="panel stat"><div className="stat-label">Active feeds</div><div className="stat-value">{sourceCounts().total}</div><div className="stat-meta">Official APH feeds configured</div></div>
        <div className="panel stat"><div className="stat-label">Healthy</div><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after live poll</div></div>
        <div className="panel stat"><div className="stat-label">Items ingested · today</div><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after live poll</div></div>
        <div className="panel stat"><div className="stat-label">False positive rate</div><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after 30 days' operation</div></div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Official APH Feed Bundle</h2>
            <span className="panel-kicker">{sourceCounts().total} official feeds configured · click a row for detail</span>
          </div>
          <table className="ds">
            <thead><tr>
              <th>Source</th><th>Group</th><th>Status</th><th>Last</th>
              <th className="num">Today</th><th>FPR</th><th>Parser</th>
            </tr></thead>
            <tbody>
              {allFeeds.map(f => (
                <tr key={f.id} onClick={() => f.group !== "Custom" && openModal("feed", f.id)}>
                  <td>
                    <div style={{fontWeight:500}}>{f.name}</div>
                    <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)"}}>{f.url.length > 56 ? f.url.slice(0,56)+"…" : f.url}</div>
                  </td>
                  <td><span className="tag">{f.group}</span></td>
                  <td>{f.lastStatusCode != null ? (f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error") : "—"}</td>
                  <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{f.last || "—"}</td>
                  <td className="num">{f.lastItemCount ?? "—"}</td>
                  <td><span className="tag">{f.fpr}</span></td>
                  <td>{f.parser || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Add RSS feed</h2>
              <span className="panel-kicker">6-step workflow</span>
            </div>
            <div className="panel-body">
              <label htmlFor="new-feed-name" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Display name</label>
              <input id="new-feed-name" value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"8px 10px", marginTop:4, marginBottom:8, width:"100%"}}/>
              <label htmlFor="new-feed-url" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Paste RSS URL</label>
              <div style={{display:"flex", gap:8, marginTop:4}}>
                <input id="new-feed-url" value={newUrl} onChange={e=>setNewUrl(e.target.value)} className="search" style={{flex:1, padding:"8px 10px"}}/>
                <button className="btn primary" onClick={startTest}>{testing && !testState ? "Testing…" : "Validate"}</button>
              </div>
              <div className="g-feed-form" style={{marginTop:12, display:"grid", gap:10}}>
                <div>
                  <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:4}}>Source type</div>
                  <select className="btn" aria-label="Source type" style={{width:"100%", padding:"7px 10px"}}>
                    <option>Parliamentary Library</option><option>Senate</option><option>House</option><option>Department</option><option>Ministerial</option><option>Regulator</option><option>News</option><option>Think tank</option><option>Industry</option>
                  </select>
                </div>
                <div>
                  <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:4}}>Refresh cadence</div>
                  <select className="btn" aria-label="Refresh cadence" style={{width:"100%", padding:"7px 10px"}}>
                    <option>Hourly</option><option>Every 15 min</option><option>Daily</option>
                  </select>
                </div>
              </div>
              <div style={{marginTop:12}}>
                <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Route to modules</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {["Today's Signal","Committees","Bills","Parliament","Briefings","Emerging Issues","Watchlists","Search"].map(m => (
                    <label key={m} style={{display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", border:"1px solid var(--line-2)", borderRadius:999, fontSize:12, cursor:"pointer"}}>
                      <input type="checkbox" defaultChecked={["Emerging Issues","Briefings"].includes(m)} style={{accentColor:"var(--brass)"}}/>
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              {testState && (
                <div className="feed-test" style={{marginTop:14}}>
                  <div style={{marginBottom:6, letterSpacing:".1em", display:"flex", alignItems:"center", gap:7}} className="warn"><Icon name="flag" size={12} /> Parser: needs validation</div>
                  {testState.lines.map((l, i) => (
                    <div key={i} className={"feed-test-line " + l.t}>
                      <Icon name={l.t === "ok" ? "check" : l.t === "warn" ? "flag" : "close"} size={12} />
                      <span>{l.s}</span>
                    </div>
                  ))}
                  <button className="btn primary sm" style={{marginTop:10}} onClick={saveFeed}>Save feed</button>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Not yet connected</h2>
              <span className="panel-kicker">Needs parser or source</span>
            </div>
            <div className="panel-body">
              {[
                { name: "Hansard extraction", note: "Needs transcript parser" },
                { name: "QON tracking", note: "Needs source or parliamentary export" },
                { name: "Full bill progress", note: "Needs bills database beyond Digest RSS" },
                { name: "News / media monitoring", note: "Optional bundle, later" },
                { name: "Internal executive briefings", note: "Governance controls required" },
              ].map(x => (
                <div key={x.name} style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px dashed var(--line-2)"}}>
                  <div>
                    <div style={{fontSize:13}}>{x.name}</div>
                    <div style={{fontSize:11.5, color:"var(--ink-3)"}}>{x.note}</div>
                  </div>
                  <button className="btn ghost sm" title="Demo control: no request backend in this build" onClick={() => toast(`Request (demo): ${x.name} not wired to a backend`, "brass")}>Request (demo)</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- COMMITTEES ----------
function PageCommittees() {
  const { openModal } = useStore();
  const today = COMMITTEE_ITEMS.filter(i => i.when.startsWith("Today"));
  const upcoming = COMMITTEE_ITEMS.filter(i => !i.when.startsWith("Today") && !i.when.startsWith("Yesterday"));
  const recent = COMMITTEE_ITEMS.filter(i => i.when.startsWith("Yesterday"));

  const CommitteeTable = ({ rows, compact }) => (
    <table className="ds">
      <thead><tr>
        <th>When</th><th>Type</th><th>Committee</th>
        {!compact && <th>Topic</th>}
        <th>Portfolio</th><th>Attention</th>
      </tr></thead>
      <tbody>
        {rows.map((r,i) => {
          const canOpen = !!(r.id && ENTITIES.committees[r.id]);
          return (
          <tr key={r.name + r.when} onClick={canOpen ? () => openModal("committee", r.id) : undefined} style={canOpen ? undefined : {opacity:.6, cursor:"not-allowed"}}>
            <td className="mono" style={{fontSize:11.5, color:"var(--ink-2)"}}>{r.when}</td>
            <td><span className="tag">{r.type}</span></td>
            <td>{r.name}{compact && <div style={{color:"var(--ink-3)", fontSize:12}}>{r.topic}</div>}</td>
            {!compact && <td>{r.topic}</td>}
            <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{r.portfolio}</td>
            <td><Att level={r.att} /></td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="committee" size={13} stroke="var(--brass)" />
        <span><strong>Design state.</strong> Committee schedules, hearing details, and inquiry data are fixture data from official APH feeds structure. No live polling in this build.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Committees</h1>
          <div className="page-sub">Powered by Senate and House committee feeds. Click any row to open the committee, hearings, inquiries and prep pack.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn" disabled title="Filtering is not available in this build" style={{opacity:.5, cursor:"not-allowed"}}><Icon name="filter" size={13}/> Filter (demo)</button>
          <button className="btn ghost" disabled title="Prep pack generation is not wired in this build" style={{opacity:.6, cursor:"not-allowed"}}><Icon name="brief" size={13}/> Prep pack (demo)</button>
        </div>
      </div>

      <div className="grid g-3" style={{marginBottom:18}}>
        <div className="panel stat"><div className="stat-label">Today</div><div className="stat-value">2<span className="unit">hearings</span></div></div>
        <div className="panel stat"><div className="stat-label">Upcoming · 7 days</div><div className="stat-value">3<span className="unit">hearings</span></div></div>
        <div className="panel stat"><div className="stat-label">Reports tabled · 30 days</div><div className="stat-value">5</div></div>
      </div>

      <div className="panel" style={{marginBottom:16}}>
        <div className="panel-head"><h2 className="panel-title">Today's hearings</h2><span className="panel-kicker">{today.length} items</span></div>
        <CommitteeTable rows={today} />
      </div>

      <div className="grid g-2">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Upcoming hearings</h2><span className="panel-kicker">Next 7 days</span></div>
          <CommitteeTable rows={upcoming} compact />
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Recently tabled / opened</h2><span className="panel-kicker">Last 48h</span></div>
          <CommitteeTable rows={recent} compact />
        </div>
      </div>
    </div>
  );
}

// ---------- BILLS ----------
function PageBills() {
  const { openModal, state } = useStore();
  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="bill" size={13} stroke="var(--brass)" />
        <span><strong>Design state.</strong> Bill status, provisions, and digest data are fixture data. Policy owner assignment is stored locally only.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Bills Intelligence</div>
          <h1 className="page-title">Bills intelligence</h1>
          <div className="page-sub">Click a bill for full details, provisions and timeline. Assign a policy owner directly from the bill detail.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn" onClick={() => {
            const headers = ["ref","title","stage","portfolio","digest","owner","attention"];
            const rows = BILLS.map(b => [
              b.ref,
              b.title,
              b.stage,
              b.portfolio,
              b.digest,
              (state.owners[b.ref] || b.owner),
              b.att,
            ]);
            exportRowsCSV(headers, rows, `parliament-pulse-bills-${new Date().toISOString().slice(0,10)}.csv`);
          }}><Icon name="download" size={13}/> Export register</button>
          <button className="btn primary" onClick={() => openModal("bill", "BILL-2026-048")}><Icon name="brief" size={13}/> Draft bill brief</button>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Tracked bills</h2>
            <span className="panel-kicker">5 of 38 watchlisted</span>
          </div>
          <table className="ds">
            <thead><tr>
              <th>Ref</th><th>Title</th><th>Stage</th><th>Portfolio</th><th>Digest</th><th>Owner</th><th>Attn</th>
            </tr></thead>
            <tbody>
              {BILLS.map(b => {
                const owner = state.owners[b.ref] || b.owner;
                return (
                  <tr key={b.ref} onClick={() => openModal("bill", b.ref)}>
                    <td className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{b.ref}</td>
                    <td style={{fontWeight:500}}>{b.title}</td>
                    <td style={{color:"var(--ink-2)"}}>{b.stage}</td>
                    <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{b.portfolio}</td>
                    <td>{b.digest === "Published" ? <span className="tag teal">Published</span> : <span className="tag">Pending</span>}</td>
                    <td style={{color: owner !== "—" && owner !== b.owner ? "var(--ok)" : "var(--ink-2)"}}>{owner}</td>
                    <td><Att level={b.att}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Related divisions</h2><span className="panel-kicker">House · last 7 days</span></div>
          <div className="panel-body">
            {DIVISIONS.map((d,i) => (
              <div key={d.when + d.bill} className="clk list-row" onClick={() => openModal("division", d)} style={{borderRadius:6}}>
                <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{d.when} · {d.chamber} · {d.bill}</div>
                <div style={{fontSize:13, marginTop:2}}>{d.q}</div>
                <div style={{fontSize:12, color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)", marginTop:2}}>{d.result}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{marginTop:16}}>
        <div className="panel-head">
          <h2 className="panel-title">Bills Digest · preview</h2>
          <span className="panel-kicker">Digital ID Amendment (Assurance) Bill 2026</span>
          <div style={{marginLeft:"auto"}}><button className="btn sm" onClick={() => openModal("bill", "BILL-2026-048")}>Open full</button></div>
        </div>
        <div className="panel-body">
          <div className="grid g-2">
            <div>
              <h5 className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"0 0 4px"}}>Purpose</h5>
              <p style={{margin:0, color:"var(--ink-2)"}}>Amends the Digital ID Act to expand the scope of the accreditation scheme and introduce new consumer assurance provisions, including revised obligations on accredited entities handling biometric attributes.</p>
              <h5 className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 4px"}}>Key provisions</h5>
              <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
                <li>Part 2: accreditation scope expanded to cover state-level identity exchanges</li>
                <li>Part 4: new reporting obligations on biometric attribute use</li>
                <li>Schedule 1: consequential amendments to Privacy Act s.26</li>
              </ul>
            </div>
            <div>
              <h5 className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"0 0 4px"}}>Portfolio relevance</h5>
              <p style={{margin:0, color:"var(--ink-2)"}}>High. Matches Digital identity and Data sharing & privacy watchlists.</p>
              <h5 className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 4px"}}>Recommended action</h5>
              <div style={{padding:"10px 12px", border:"1px solid var(--brass-soft)", borderRadius:8, background:"var(--panel-hi)"}}>
                <div style={{color:"var(--brass)", fontWeight:600}}>Draft Executive Brief</div>
                <div style={{fontSize:12, color:"var(--ink-2)", marginTop:4}}>Scope of accreditation warrants DDG-level awareness before 2nd reading.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- PARLIAMENT ----------
function PageParliament() {
  const { openModal, toast } = useStore();
  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="signal" size={14} stroke="var(--brass)" />
        <span>Daily program, division results, and news items are <strong>fixture data</strong>. APH RSS feeds are read-only in this build.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Today in Parliament</h1>
          <div className="page-sub">Daily program, divisions, and chamber-relevant items from official APH feeds.</div>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">House · daily program</h2><span className="panel-kicker">24 Apr 2026</span></div>
          <div className="panel-body">
            <div className="timeline">
              {[
                ["09:30", "House meets", null],
                ["10:00", "Government business: 2nd reading, Cyber Security Legislation Amendment Bill 2026", "BILL-2026-041"],
                ["11:15", "Matter of public importance", null],
                ["12:00", "Question time", null],
                ["14:00", "Private members' business", null],
                ["16:30", "Adjournment debate", null],
              ].map(([t, b, billRef], i) => (
                <div key={i} className={"tl-item " + (billRef ? "teal" : "")}>
                  <div className="tl-time">{t}</div>
                  <div className="tl-body">
                    {billRef ? <button className="linklike" onClick={()=>openModal("bill", billRef)}>{b}</button> : b}
                    {billRef && <span className="tag brass" style={{marginLeft:8}}>Watchlist · Cyber</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Recent divisions</h2><span className="panel-kicker">House</span></div>
          <div className="panel-body">
            {DIVISIONS.map((d, i) => (
              <div key={d.when + d.bill} className="clk list-row" onClick={() => openModal("division", d)} style={{borderRadius:6}}>
                <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{d.when} · {d.bill}</div>
                <div style={{fontSize:13, marginTop:2}}>{d.q}</div>
                <div style={{fontSize:12, color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)", marginTop:2}}>{d.result}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-2" style={{marginTop:16}}>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">House news & media</h2><span className="panel-kicker">Official feeds</span></div>
          <div className="panel-body">
            {[
              "Speaker announces procedural changes to Wednesday sittings",
              "Parliamentary Triangle security review complete",
              "New Select Committee on AI Governance established",
            ].map((t, i) => (
              <div key={i} style={{padding:"10px 0", borderBottom: i<2 ? "1px solid var(--line)" : 0}}>
                <div style={{fontSize:13}}>{t}</div>
                <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", marginTop:4}}>{["08:04", "Yesterday 16:12", "22 Apr 11:30"][i]} · House News</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Parliamentary lines</h2><span className="panel-kicker">For Cyber Security Bill 2nd reading</span><span className="chip-fixture" style={{marginLeft:"auto"}}>Fixture</span></div>
          <div className="panel-body">
            <div style={{padding:12, border:"1px dashed var(--line-2)", borderRadius:8, fontSize:13, color:"var(--ink-3)", lineHeight:1.6, fontStyle:"italic"}}>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8, fontStyle:"normal"}}>No lines drafted yet</div>
              Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow. <span className="chip-fixture">Fixture data only in this build</span>
            </div>
            <div style={{marginTop:12, display:"flex", gap:8}}>
              <button className="btn sm primary" onClick={() => toast("Generate a brief from a signal first to start the drafting workflow")}>Submit for review</button>
              <button className="btn sm" onClick={() => toast("Generate a brief from a signal first to start the drafting workflow")}>Regenerate</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- PATTERNS ----------
function PagePatterns() {
  const { openModal, toast } = useStore();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Scrutiny</div>
          <h1 className="page-title">QON pattern engine</h1>
          <div className="page-sub">Detects clustered scrutiny across members, topics and targets. Click any member to open their profile.</div>
        </div>
      </div>

      <div style={{padding:"10px 14px", background:"var(--panel-hi)", border:"1px solid var(--line-bright)", borderRadius:8, marginBottom:16, display:"flex", gap:10, alignItems:"center", color:"var(--ink-2)", fontSize:12.5}}>
        <Icon name="flag" size={14} stroke="var(--info)"/>
        <span><strong>Design-state module.</strong> Direct QON feed not yet connected. Patterns below use sample scrutiny data. Status visible on Sources page.</span>
      </div>

      <div className="pattern">
        <div className="ribbon">Clustered pattern · moderate confidence</div>
        <div className="serif" style={{fontSize:22, fontWeight:500, marginBottom:6, paddingRight:200}}>Clustered scrutiny pattern on digital procurement governance</div>
        <div style={{color:"var(--ink-2)", fontSize:13.5, maxWidth:720}}>
          4 related questions lodged by 3 members within 48 hours, all targeting digital services portfolio. Trigger likely: ANAO report tabled 22 Apr. Cross-source reinforcement with today's Senate inquiry.
        </div>

        <div className="grid g-4" style={{marginTop:16, marginBottom:18}}>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Members</div><div style={{fontSize:18, marginTop:4}}>3</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Questions</div><div style={{fontSize:18, marginTop:4}}>4</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Window</div><div style={{fontSize:18, marginTop:4}}>48h</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Target</div><div style={{fontSize:13, marginTop:4, lineHeight:1.25}}>Minister for Digital Services / Dept.</div></div>
        </div>

        <div style={{borderTop:"1px dashed var(--line-2)", paddingTop:14}}>
          <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8}}>Evidence · click member for profile</div>
          {QON_PATTERN.items.map((q,i) => {
            const mid = q.memberId;
            const canOpen = !!(mid && ENTITIES.members[mid]);
            return (
              <div key={q.when + q.who} className="g-qon-evidence" style={{display:"grid", gap:12, padding:"8px 0", borderBottom: i<QON_PATTERN.items.length-1 ? "1px solid var(--line)" : 0, alignItems:"start", fontSize:12.5}}>
                <div className="mono" style={{color:"var(--ink-3)"}}>{q.when}</div>
                <div><span className={"tag brass" + (canOpen ? " clk" : "")} onClick={canOpen ? () => openModal("member", mid) : undefined} style={canOpen ? undefined : {opacity:.65, cursor:"not-allowed"}}>{q.who}</span></div>
                <div style={{color:"var(--ink-2)"}}>{q.q}</div>
                <div style={{textAlign:"right"}}><span className="tag">{q.chamber}</span></div>
              </div>
            );
          })}
        </div>

        <div style={{display:"flex", gap:10, marginTop:16, flexWrap:"wrap"}}>
          <button className="btn" title="Demo control: design-state module, no backend" onClick={() => toast("Draft Estimates monitor note (demo): not wired", "brass")}><Icon name="brief" size={13}/> Draft Estimates monitor note (demo)</button>
          <button className="btn" title="Demo control: design-state module, no backend" onClick={() => toast("Track cluster (demo): not wired", "brass")}><Icon name="watch" size={13}/> Track cluster (demo)</button>
          <button className="btn" title="Demo control: design-state module, no backend" onClick={() => toast("Confirm as coordinated (demo): not wired", "brass")}><Icon name="check" size={13}/> Confirm as coordinated (demo)</button>
          <button className="btn ghost" title="Demo control: design-state module, no backend" onClick={() => toast("Mark as coincidence (demo): not wired")}>Mark as coincidence (demo)</button>
        </div>
      </div>

      <div className="panel" style={{marginTop:16}}>
        <div className="panel-head"><h2 className="panel-title">How patterns are detected</h2><span className="panel-kicker">Indicator logic</span></div>
        <div className="panel-body">
          <div className="grid g-2">
            {[
              ["Multiple members","Three or more MPs or senators asking related questions"],
              ["Short timeframe","Within 24 to 72 hours"],
              ["Shared topic","Topic similarity above 0.78 on embedding cluster"],
              ["Shared target","Same minister, department or program"],
              ["Similar phrasing","Repeated structure or near-identical wording"],
              ["Related external trigger","Audit report, media article, or committee referral"],
              ["Cross-source reinforcement","QON + Hansard + committee or inquiry overlap"],
              ["Human override","Analyst must confirm any 'coordinated' label"],
            ].map(([k,v])=>(
              <div key={k} style={{padding:"10px 12px", border:"1px solid var(--line-2)", borderRadius:8}}>
                <div style={{fontSize:13, fontWeight:500}}>{k}</div>
                <div style={{fontSize:12, color:"var(--ink-3)", marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- BRIEFINGS ----------
function PageBriefings() {
  const [selId, setSelId] = useState(null);
  const { toast, state, setSignalSearchQuery, navigate } = useStore();

  // Merge drawer-generated briefs into the queue
  const generated = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = SIGNALS.find(s => s.id === sid);
    // F11: fix the "For undefined" label — precedence bug. Use an explicit ternary.
    const label = sig ? (sig.title.slice(0, 40) + "…") : sid;
    return { type: v.type || "Executive Brief", for: label, status: "Copied · clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts).slice(0, 3);

  const staticBriefs = [
    { type: "Daily Signal Brief", for: "DDG Digital", status: "Drafted" },
    { type: "Committee Brief", for: "Procurement lead", status: "Awaiting review" },
    { type: "Bill Digest Note", for: "Identity policy", status: "Drafted" },
    { type: "Estimates Monitor Note", for: "Estimates pack", status: "In progress" },
  ];
  const briefs = [...generated, ...staticBriefs];
  const briefId = (b) => b._sid || `${b.type}|${b.for}`;
  const selected = briefs.find(b => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="brief" size={13} stroke="var(--brass)" />
        <span><strong>Design state.</strong> Brief queue and content are fixture data. Generation and send actions are not wired to any backend.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Briefings</h1>
          <div className="page-sub">Every brief follows a required structure: What happened · Source · Why it matters · Recommended action · Evidence · Uncertainty · Human review.</div>
        </div>
        <button className="btn primary" title="Open signals to generate a brief" onClick={() => { setSignalSearchQuery(""); navigate("signals"); }}><Icon name="plus" size={13}/> New brief</button>
      </div>

      <div className="grid g-briefings" style={{gap:16}}>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Queue</h2><span className="panel-kicker">{briefs.length} pending</span></div>
          <div>
            {briefs.map((b, i) => {
              const id = briefId(b);
              return (
              <div key={id} className="list-row" onClick={() => setSelId(id)} style={{cursor:"pointer", background: selectedId===id ? "var(--panel-hi)" : "transparent", borderLeft: selectedId===id ? "2px solid var(--brass)" : "2px solid transparent"}}>
                <div style={{fontSize:13, fontWeight:500}}>{b.type}</div>
                <div style={{fontSize:11.5, color:"var(--ink-3)"}}>For {b.for}</div>
                <div className="mono t-label" style={{marginTop:4, color: b.status === "Drafted" || b.status.startsWith("Copied") ? "var(--ok)" : b.status === "In progress" ? "var(--caution)" : "var(--info)", textTransform:"uppercase", letterSpacing:".12em"}}>{b.status}</div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{selected ? selected.type : "No brief"} · preview</h2>
            <span className="panel-kicker">{selected ? `For ${selected.for}` : "Queue empty"}</span>
            <div style={{marginLeft:"auto", display:"flex", gap:6}}>
              <button className="btn ghost sm" disabled={!selected} onClick={() => window.print()}><Icon name="download" size={12}/> Print</button>
              <button className="btn sm" disabled={!selected} title="Demo control: no send backend in this build" onClick={() => toast("Send (demo): no delivery backend in this build")}>Send (demo)</button>
              <button className="btn ghost sm" disabled={!selected} title="Demo control: no approval workflow in this build" onClick={() => toast("Approve (demo): no approval workflow in this build", "brass")}>Approve (demo)</button>
            </div>
          </div>
          <div className="panel-body">
            {(() => {
              const b = selected;
              if (!b) return <div className="empty">No briefs in the queue.</div>;
              const sig = b._sid ? SIGNALS.find(s => s.id === b._sid) : null;
              if (sig) {
                const brief = buildBriefSections(sig);
                return (
                <div className="brief">
                  <div className="meta">PARLIAMENT PULSE · {b.type.toUpperCase()} · {brief.meta.date} · {brief.meta.time}</div>
                  <h3>{brief.title}</h3>
                  <h5>What happened</h5>
                  <div>{brief.summary}</div>
                  <h5>Source</h5>
                  <div>{brief.meta.source} · {brief.meta.sourceAuthority} · {brief.meta.date}</div>
                  <h5>Why it matters</h5>
                  <div>{brief.whyItMatters}</div>
                  <h5>Recommended action</h5>
                  <div><strong>{brief.recommendedAction.label}.</strong> {brief.recommendedAction.reason}</div>
                  {brief.evidence.length > 0 && <>
                    <h5>Evidence</h5>
                    <ul>{brief.evidence.map((e,i) => <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer" style={{color:"var(--brief-link)", textDecoration:"underline"}}>{e.label}</a></li>)}</ul>
                  </>}
                  <h5>Provenance</h5>
                  <div>{brief.provenance}</div>
                </div>
                );
              }
              return (
                <div className="brief">
                  <div className="meta">PARLIAMENT PULSE · {b.type.toUpperCase()} · 24 APR 2026 · 08:20</div>
                  <h3>New Senate inquiry: Digital procurement governance</h3>
                  <h5>What happened</h5>
                  <div>The Finance and Public Administration References Committee has opened an inquiry into Commonwealth procurement and contract governance for digital programs over $100m. Submissions close 19 May.</div>
                  <h5>Source</h5>
                  <div>APH Senate New Inquiries RSS · Official · validated 24 Apr 08:15.</div>
                  <h5>Why it matters</h5>
                  <div>The inquiry directly overlaps two watchlists (Digital procurement, Procurement) and follows last week's ANAO report tabling. Preliminary scrutiny pattern detected on the same topic (4 QONs / 3 members / 48h).</div>
                  <h5>Recommended action</h5>
                  <div><strong>Assign Policy Owner.</strong> Draft submission plan by 02 May. Coordinate with Legal on contract-variation data scope.</div>
                  <h5>Evidence</h5>
                  <ul><li>APH · inquiry listing (primary)</li><li>ANAO · performance audit report 2025–26/41</li><li>Internal · existing procurement governance framework v4.2</li></ul>
                  <h5>Uncertainty</h5>
                  <div>The inquiry's terms of reference may expand during hearings. Confidence: Moderate.</div>
                  <h5>Human review</h5>
                  <div>Required · to be cleared by Director, Digital Strategy.</div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- WATCHLISTS ----------
function PageWatchlists() {
  const { openModal, createWatchlist, state, removeWatchlist } = useStore();
  const [newName, setNewName] = useState("");
  const all = [...WATCHLISTS, ...state.watchlistCreated];
  const [selectedWl, setSelectedWl] = useState(() => all[0]);
  const selectedKeywords = watchlistKeywords(selectedWl || all[0]);
  const trackedItems = Object.keys(state.watchlistAdds || {}).map(key => {
    const sig = SIGNALS.find(s => s.id === key);
    return { key, title: sig ? sig.title : key, meta: sig ? `${sig.id} · ${sig.source}` : "Entity watch" };
  });
  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="watch" size={13} stroke="var(--brass)" />
        <span><strong>Design state.</strong> Watchlist data, keywords, and match counts are fixture data. No live keyword matching is running.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Watchlists</h1>
          <div className="page-sub">The relevance engine. Click any watchlist for matches and configuration.</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <input aria-label="New watchlist name" placeholder="New watchlist name" value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"7px 10px"}}/>
          <button className="btn primary" onClick={() => { if (newName.trim()) { createWatchlist(newName.trim()); setNewName(""); } }}><Icon name="plus" size={13}/> Create</button>
        </div>
      </div>

      <div className="grid g-3">
        {all.map(w => {
          const trend = Array.isArray(w.trend) ? w.trend : [];
          const max = Math.max(...trend, 1);
          return (
            <div key={w.name} className={"wl" + (selectedWl?.name === w.name ? " active" : "")} onClick={() => { setSelectedWl(w); openModal("watchlist", w.name); }} style={selectedWl?.name === w.name ? {borderColor:"var(--brass)"} : {}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span className="wl-name">{w.name}</span>
                <span className="mono" style={{fontSize:10.5, color:"var(--brass)", background:"var(--panel-hi)", border:"1px solid var(--brass-soft)", padding:"1px 6px", borderRadius:4, marginLeft:"auto"}}>{w.matches} matches</span>
              </div>
              <div className="wl-meta"><span>{w.keywords} keywords</span><span>·</span><span>7-day</span></div>
              <div className="spark" style={{marginTop:2}}>
                {trend.map((v,i) => <span key={i} style={{height: (v/max*20+2)+"px"}}/>)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{marginTop:18}}>
        <div className="panel-head">
          <h2 className="panel-title">Tracked items</h2>
          <span className="panel-kicker">{trackedItems.length} saved</span>
        </div>
        <div className="panel-body">
          {trackedItems.length === 0 ? (
            <div className="empty">No tracked items yet. Use Watchlist, Track, or Watch controls to add one.</div>
          ) : trackedItems.map(item => (
            <div key={item.key} className="g-tracked-row" style={{display:"grid", gap:12, padding:"10px 0", borderBottom:"1px solid var(--line)", alignItems:"center"}}>
              <div>
                <div style={{fontSize:13, fontWeight:500}}>{item.title}</div>
                <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", marginTop:2}}>{item.meta}</div>
              </div>
              <button className="btn sm ghost" onClick={() => removeWatchlist(item.key)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{marginTop:18}}>
        <div className="panel-head">
          <h2 className="panel-title">{selectedWl?.name || "Digital government"} · configuration</h2>
          <span className="panel-kicker">Selected watchlist</span>
          <span className="chip-fixture" style={{marginLeft:8}}>Fixture</span>
        </div>
        <div className="panel-body">
          <div className="empty" style={{marginBottom:14}}>Keyword chips follow the selected watchlist. Thresholds, linked committees, and audit entries are illustrative in this build.</div>
          <div className="grid g-2">
            <div>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Keywords</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                {selectedKeywords.map(k => <span key={k} className="tag brass">{k}</span>)}
              </div>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 6px"}}>Linked committees</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                <span className="tag teal clk" onClick={() => openModal("committee","jcpaa")}>Joint Committee on Public Accounts & Audit</span>
                <span className="tag teal clk" onClick={() => openModal("committee","finpa")}>Finance & Public Administration (Sen)</span>
                <span className="tag teal clk" onClick={() => openModal("committee","econ")}>Economics Legislation (Sen)</span>
              </div>
            </div>
            <div>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Attention thresholds</div>
              <div className="g-threshold-row" style={{display:"grid", gap:8, fontSize:13}}>
                <div>Source authority weight</div><div className="mono">0.95</div>
                <div>Portfolio relevance weight</div><div className="mono">0.90</div>
                <div>Minimum attention score</div><div className="mono">0.55</div>
                <div>Auto-escalate above</div><div className="mono">0.80</div>
                <div>Suppress duplicates within</div><div className="mono">24h</div>
              </div>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 6px"}}>Audit — recent corrections</div>
              <div style={{fontSize:12.5, color:"var(--ink-2)"}}>
                08:43 · House media releases → downgraded procedural items (weight −0.12)<br/>
                Yesterday 14:10 · Duplicate suppression added for cross-posted inquiry notices
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- RADAR ----------
function PageRadar() {
  const { openModal } = useStore();
  return (
    <div className="page">
      <div className="design-banner" role="status" style={{marginBottom:12, borderRadius:8}}>
        <Icon name="radar" size={13} stroke="var(--brass)" />
        <span><strong>Design state.</strong> Radar issues, attention scores, and momentum are fixture data. No live signal processing has occurred.</span>
      </div>
      <div className="page-head">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Attention radar</h1>
          <div className="page-sub">Transparent categories, no fake precision scores. Click any issue for momentum detail and suggested actions.</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Active issues</h2>
          <span className="panel-kicker">Last 7 days</span>
        </div>
        <div className="panel-body">
          <div className="radar-row g-radar-table" style={{display:"grid", padding:"4px 0 10px", borderBottom:"1px solid var(--line)", alignItems:"center", gap:14}}>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Issue</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Attention</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", textAlign:"right"}}>Sources</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Momentum</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Confidence</div>
          </div>
          {RADAR.map((r,i) => (
            <div key={r.issue} className="clk radar-row g-radar-table" onClick={() => openModal("radar", r.issue)} style={{display:"grid", padding:"14px 8px", borderBottom: i<RADAR.length-1 ? "1px solid var(--line)" : 0, gap:14, alignItems:"center", borderRadius:6}}>
              <div>
                <div style={{fontSize:14, fontWeight:500}}>{r.issue}</div>
                <div style={{fontSize:12, color:"var(--ink-3)", marginTop:2}}>{r.reason}</div>
              </div>
              <div><Att level={r.att}/></div>
              <div className="mono" style={{textAlign:"right", color:"var(--ink-2)"}}>{r.sources}</div>
              <div><div className="bar"><div className="fill" style={{width:`${r.momentum*100}%`}}/></div></div>
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <div className="ring" style={{"--p": Math.round(r.confidence*100)}} data-p={Math.round(r.confidence*100)}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- SIGNALS ----------
function PageSignals() {
  const { state, setVisibleSignalOrder, signalSearchQuery, setSignalSearchQuery } = useStore();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("time");

  const visible = React.useMemo(() => {
    let sigs = SIGNALS.filter(s => !state.archived[s.id]);
    const query = (signalSearchQuery || "").trim().toLowerCase();
    if (query) sigs = sigs.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.summary.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query) ||
      (s.tags || []).some(t => (t.l || "").toLowerCase().includes(query))
    );
    if (filter !== "all") sigs = sigs.filter(s => s.attention === filter);
    if (sort === "score") sigs = [...sigs].sort((a, b) => (b.score?.authority || 0) - (a.score?.authority || 0));
    return sigs;
  }, [state.archived, filter, sort, signalSearchQuery]);

  React.useEffect(() => {
    setVisibleSignalOrder(visible.map(s => s.id));
    return () => setVisibleSignalOrder(null);
  }, [visible, setVisibleSignalOrder]);

  const counts = React.useMemo(() => ({
    all: SIGNALS.filter(s => !state.archived[s.id]).length,
    high: SIGNALS.filter(s => s.attention === "high" && !state.archived[s.id]).length,
    med: SIGNALS.filter(s => s.attention === "med" && !state.archived[s.id]).length,
    low: SIGNALS.filter(s => s.attention === "low" && !state.archived[s.id]).length,
  }), [state.archived]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">All signals</h1>
          <div className="page-sub">{counts.all} active signals · {counts.high} high · {counts.med} medium · {counts.low} low</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <label htmlFor="sig-sort" className="sr-only">Sort signals</label>
          <span aria-hidden="true" style={{fontSize:12, color:"var(--ink-4)"}}>Sort:</span>
          <select id="sig-sort" value={sort} onChange={e => setSort(e.target.value)}
            style={{background:"var(--panel)", border:"1px solid var(--line-2)", color:"var(--ink)", borderRadius:6, padding:"5px 8px", fontSize:12, cursor:"pointer"}}>
            <option value="time">Time</option>
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
            {label} <span style={{opacity:.65}}>({counts[val]})</span>
            {filter === val && <span className="sr-only"> (active filter)</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="signal" kicker="No signals">
          {filter === "all" ? "No active signals - all archived." : `No ${filter} attention signals.`}
        </EmptyState>
      ) : (
        <div>
          {visible.map(s => <SignalCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PageOverview, PageLive, PageSources, PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists, PageRadar, PageSignals, OnboardingGuide });
