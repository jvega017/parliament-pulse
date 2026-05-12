// Pages — all entities are clickable; store-wired

const { useState, useMemo } = React;

function exportSignalsCSV() {
  const headers = ["id","date","source","attention","title","action","confidence"];
  const rows = SIGNALS.map(s => [
    s.id, s.date, s.source, s.attention,
    `"${(s.title || "").replace(/"/g,'""')}"`,
    `"${(s.action || "").replace(/"/g,'""')}"`,
    s.confidence,
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `parliament-pulse-signals-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ---------- OVERVIEW ----------
function OnboardingGuide() {
  const key = "pp-onboarded";
  const [visible, setVisible] = React.useState(() => !localStorage.getItem(key));
  if (!visible) return null;
  return (
    <div style={{background:"#c9a36a0a", border:"1px solid #c9a36a33", borderRadius:10, padding:"16px 18px", marginBottom:18}}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
        <Icon name="signal" size={14} stroke="var(--brass)" />
        <span className="mono" style={{fontSize:10, color:"var(--brass)", textTransform:"uppercase", letterSpacing:".18em"}}>Getting started</span>
        <button onClick={() => { localStorage.setItem(key, "1"); setVisible(false); }}
          style={{marginLeft:"auto", background:"none", border:"none", color:"var(--ink-4)", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px"}}
          aria-label="Dismiss guide">×</button>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14}}>
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
  const { openModal, state, toast } = useStore();
  const goto = (p) => window.__setPage && window.__setPage(p);
  const priority = SIGNALS.filter(s => s.attention === "high" && !state.archived[s.id]);
  const rest = SIGNALS.filter(s => s.attention !== "high" && !state.archived[s.id]);

  const generateDailyBrief = () => {
    const today = new Date().toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" });
    const lines = [
      `# Parliamentary Daily Signal Brief — ${today}`,
      `Generated: ${new Date().toISOString()}`,
      `Total signals: ${priority.length + rest.length} · Priority: ${priority.length}`,
      ``,
      `## Priority signals`,
      ...(priority.length === 0 ? ["None."] : priority.map(s => [
        `### ${s.id} — ${s.title}`,
        `Source: ${s.source} | Confidence: ${s.confidence}/5`,
        s.summary,
        `**Action:** ${s.action}. ${s.actionReason}`,
        ``,
      ].join("\n"))),
      `## All other signals`,
      ...(rest.length === 0 ? ["None."] : rest.map(s => `- [${s.id}] ${s.title} — ${s.action}`)),
    ].join("\n");
    navigator.clipboard.writeText(lines)
      .then(() => toast("Daily brief copied to clipboard", "brass"))
      .catch(() => toast("Clipboard unavailable — brief not copied", "error"));
  };
  return (
    <div className="page">
      <OnboardingGuide />
      <div className="page-head">
        <div>
          <div className="page-kicker">{new Date().toLocaleDateString("en-AU", {weekday:"short", day:"numeric", month:"short", year:"numeric"})} · Sitting day</div>
          <h1 className="page-title">Today's signals</h1>
          <div className="page-sub">{priority.length + rest.length} new official items overnight. {priority.length} classified as priority. 13/15 sources live.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn"><Icon name="filter" size={13}/> Filter</button>
          <button className="btn ghost sm" onClick={exportSignalsCSV}><Icon name="ext" size={12}/> Export CSV</button>
          <button className="btn primary" onClick={generateDailyBrief}><Icon name="brief" size={13}/> Generate daily brief</button>
        </div>
      </div>

      {/* LIVE NOW STRIP — session info is fixture data; see Live parliament for real RSS */}
      <div className="live-strip" style={{display:"grid", gridTemplateColumns:"auto 1fr auto auto auto", gap:14, alignItems:"center", padding:"12px 16px", marginBottom:16}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={{width:8, height:8, borderRadius:"50%", background:"var(--escalate)", boxShadow:"0 0 12px var(--escalate)", animation:"pulse 1.4s infinite"}}/>
          <span className="mono" style={{fontSize:10.5, letterSpacing:".16em", color:"var(--escalate)", fontWeight:600}}>
            AEST {new Date().toLocaleTimeString("en-AU", {hour:"2-digit", minute:"2-digit", timeZone:"Australia/Brisbane"})}
          </span>
        </div>
        <div style={{display:"flex", gap:18, fontSize:12.5, color:"var(--ink-2)", alignItems:"center"}}>
          <div><strong style={{color:"var(--ink)"}}>House:</strong> Question time <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:4}}>Fixture</span></div>
          <div style={{width:1, height:16, background:"var(--line-2)"}}/>
          <div><strong style={{color:"var(--ink)"}}>Senate:</strong> <a href="#" onClick={e=>{e.preventDefault(); openModal("committee","legcon");}} style={{color:"var(--teal)", textDecoration:"none"}}>Legal & Constitutional</a> hearing <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:4}}>Fixture</span></div>
        </div>
        <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" className="btn sm ghost" style={{textDecoration:"none"}}><Icon name="ext" size={12}/> Hansard</a>
        <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn sm ghost" style={{textDecoration:"none"}}><Icon name="ext" size={12}/> YouTube</a>
        <button className="btn sm primary" onClick={()=> goto && goto("live")}><Icon name="signal" size={12}/> Watch live</button>
      </div>

      <div className="grid g-4" style={{marginBottom:18}}>
        <div className="panel stat">
          <div className="stat-label">New signals today</div>
          <div className="stat-value">{priority.length + rest.length}</div>
          <div className="stat-meta"><span style={{color:"var(--ok)"}}>▲ {priority.length}</span> vs yesterday</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Priority signals</div>
          <div className="stat-value" style={{color:"var(--brass)"}}>{priority.length}</div>
          <div className="stat-meta">Watchlist-matched · requires review</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Committee activity</div>
          <div className="stat-value">7<span className="unit">items</span></div>
          <div className="stat-meta">2 hearings · 1 new inquiry · 1 report</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Source health</div>
          <div className="stat-value">13/15<span className="unit">live</span></div>
          <div className="stat-meta"><span style={{color:"var(--caution)"}}>1 delayed · 1 review</span></div>
        </div>
      </div>

      <div className="grid g-overview">
        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h3 className="panel-title">Priority signals</h3>
              <span className="panel-kicker">{priority.length} items · human review required</span>
              <div style={{marginLeft:"auto", display:"flex", gap:6}}>
                <button className="btn ghost sm">Group by topic</button>
                <button className="btn ghost sm">Sort: attention</button>
              </div>
            </div>
            <div className="panel-body">
              {priority.map(s => <SignalCard key={s.id} s={s} />)}
              {priority.length === 0 && <div className="empty">All priority signals actioned.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">All signals · last 24h</h3>
              <span className="panel-kicker">{rest.length} items</span>
            </div>
            <div className="panel-body">
              {rest.map(s => <SignalCard key={s.id} s={s} />)}
              {rest.length === 0 && <div className="empty">All lower-priority signals reviewed. Check Attention radar for emerging issues.</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h3 className="panel-title">What changed</h3>
              <span className="panel-kicker">Since 17:00 yesterday</span>
              <span className="chip-fixture" style={{marginLeft:"auto"}}>Fixture</span>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <div className="tl-item"><div className="tl-time">08:15 · Senate</div><div className="tl-body">New inquiry opened: <a href="#" onClick={e=>{e.preventDefault(); openModal("inquiry","Commonwealth procurement governance (new)");}} style={{color:"var(--ink)"}}>Digital procurement governance</a></div></div>
                <div className="tl-item teal"><div className="tl-time">07:48 · Library</div><div className="tl-body">Bills Digest: <a href="#" onClick={e=>{e.preventDefault(); openModal("bill","BILL-2026-048");}} style={{color:"var(--ink)"}}>Digital ID Amendment (Assurance) Bill 2026</a></div></div>
                <div className="tl-item info"><div className="tl-time">07:30 · Senate</div><div className="tl-body">Today's hearing · <a href="#" onClick={e=>{e.preventDefault(); openModal("committee","legcon");}} style={{color:"var(--ink)"}}>Legal & Constitutional</a> · AI assurance</div></div>
                <div className="tl-item"><div className="tl-time">07:10 · House</div><div className="tl-body">Daily program: <a href="#" onClick={e=>{e.preventDefault(); openModal("bill","BILL-2026-041");}} style={{color:"var(--ink)"}}>Cyber Security Bill</a> — 2nd reading</div></div>
                <div className="tl-item info"><div className="tl-time">Yesterday 18:04</div><div className="tl-body"><a href="#" onClick={e=>{e.preventDefault(); openModal("division", DIVISIONS[2]);}} style={{color:"var(--ink)"}}>Division: CDR Expansion Bill — 2nd reading agreed</a></div></div>
                <div className="tl-item teal"><div className="tl-time">Yesterday 17:20</div><div className="tl-body">Report tabled: Regional 5G rollout — interim</div></div>
              </div>
            </div>
          </div>

          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h3 className="panel-title">Briefing queue</h3>
              <span className="panel-kicker">4 pending</span>
            </div>
            <div className="panel-body" style={{paddingTop:6}}>
              {BRIEFING_QUEUE.map((b,i) => (
                <div key={i} style={{display:"grid", gridTemplateColumns:"1fr auto", padding:"10px 0", borderBottom: i<BRIEFING_QUEUE.length-1 ? "1px solid var(--line)" : 0, gap:10}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:500}}>{b.type}</div>
                    <div style={{fontSize:11.5, color:"var(--ink-3)"}}>For {b.for} · <span className="mono">{b.at}</span></div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span className="mono" style={{fontSize:10.5, color: b.ready ? "var(--ok)" : "var(--caution)", textTransform:"uppercase", letterSpacing:".12em"}}>{b.status}</span>
                    <button className="btn sm ghost"><Icon name="chevron" size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Source health</h3>
              <span className="panel-kicker">13/15 live</span>
            </div>
            <div className="panel-body">
              {APH_FEEDS.slice(0, 6).map(f => (
                <div key={f.id} onClick={() => openModal("feed", f.id)} className="clk" style={{display:"grid", gridTemplateColumns:"1fr auto auto", padding:"6px 8px", gap:10, fontSize:12.5, alignItems:"center", borderRadius:6}}>
                  <div><span className={"hdot " + (f.status === "review" ? "review" : f.status === "delayed" ? "delayed" : "live")} />{f.name}</div>
                  <div className="mono" style={{color:"var(--ink-4)", fontSize:11}}>{f.last}</div>
                  <div className="mono" style={{color:"var(--ink-3)", fontSize:11, textAlign:"right", width:28}}>{f.today ?? "—"}</div>
                </div>
              ))}
              <div style={{marginTop:8, fontSize:12, color:"var(--ink-3)"}}>
                <span className="hdot review"/> FlagPost: feed tester flagged HTML endpoint.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- LIVE PARLIAMENT ----------
// @AUSParliamentLive YouTube live embed. Channel ID verified May 2026.
// YouTube's live_stream endpoint auto-resolves to whatever stream is active on that channel.
// When no stream is live, YouTube shows the channel's upcoming/latest placeholder.
const APH_YT_CHANNEL = "UCzx6ti0rql6Q2Dc2zSAPmuA"; // @AUSParliamentLive — verified May 2026
const APH_LIVE = {
  house:    { label: "House of Representatives", streamId: null, url: `https://www.youtube.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
  senate:   { label: "Senate",                    streamId: null, url: `https://www.youtube.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
  federation:{label: "Federation Chamber",        streamId: null, url: `https://www.youtube.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
};

function LiveBroadcast({ which, toast }) {
  const cfg = APH_LIVE[which] || APH_LIVE.house;
  // mode: "embed" = YouTube live_stream iframe ; "offline" = explicit fallback
  const [mode, setMode] = React.useState("embed");
  const [nonce, setNonce] = React.useState(0); // bump to force reload

  // When chamber changes, retry embed
  React.useEffect(() => {
    setMode("embed");
  }, [which]);

  return (
    <div className="live-wrap" style={{background:"#000", aspectRatio:"16/9", position:"relative", overflow:"hidden", borderRadius:10, border:"1px solid var(--line-2)"}}>
      {mode === "embed" && (
        <iframe
          key={which + "-" + nonce}
          src={cfg.url}
          title={`AUSParliamentLive — ${cfg.label}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{position:"absolute", inset:0, width:"100%", height:"100%", border:0}}
        />
      )}

      {/* LIVE badge (only shown when embed mode is active) */}
      {mode === "embed" && (
        <div style={{position:"absolute", top:12, left:12, zIndex:3, display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.6)", padding:"5px 10px", borderRadius:4, fontFamily:"var(--mono)", fontSize:11, color:"#fff", letterSpacing:".12em", border:"1px solid #d06a5e80"}}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"#d06a5e", boxShadow:"0 0 10px #d06a5e", animation:"pulse 1.4s infinite"}}/>
          LIVE · {cfg.label.toUpperCase()}
        </div>
      )}

      {/* Manual "No stream?" pill — always available in embed mode because YouTube's
          offline state renders INSIDE the iframe and we can't detect it from here. */}
      {mode === "embed" && (
        <button
          onClick={() => setMode("offline")}
          style={{position:"absolute", top:12, right:12, zIndex:3, fontFamily:"var(--mono)", fontSize:10.5, color:"#fff", background:"rgba(0,0,0,0.55)", border:"1px solid #ffffff30", padding:"4px 9px", borderRadius:4, cursor:"pointer", letterSpacing:".08em"}}
          title="Show alternate sources if no stream is live"
        >
          NO STREAM?
        </button>
      )}

      {/* Fallback for no-stream / blocked / user-toggled */}
      {mode === "offline" && (
        <div style={{position:"absolute", inset:0, background:"linear-gradient(180deg, #0a0f16, #050810)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, textAlign:"center"}}>
          <div style={{fontFamily:"var(--serif)", fontSize:22, color:"#d4894a", marginBottom:10}}>Stream unavailable</div>
          <div style={{color:"var(--ink-2)", fontSize:13, maxWidth:460, lineHeight:1.5, marginBottom:18}}>
            AUSParliamentLive only broadcasts <strong>{cfg.label}</strong> while the chamber is in session. Try the official APH pages below, or retry the embed.
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center"}}>
            <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn primary" style={{textDecoration:"none"}}>YouTube · AUSParliamentLive ↗</a>
            <a href="https://www.aph.gov.au/News_and_Events/Watch_Read_Listen" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>APH Watch / Read / Listen ↗</a>
            <a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>ParlView archive ↗</a>
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
// via the local CORS proxy (proxy-server.js on localhost:3001), parses the XML, and
// merges items into a single time-sorted signal stream. Refreshes every 2 minutes.
const APH_FEED_URLS = [
    { url: "https://www.aph.gov.au/house/rss/divisions",         label: "House Divisions",              kind: "division" },
    { url: "https://www.aph.gov.au/house/rss/todays_hearings",   label: "Today's House hearings",       kind: "hearing"  },
    { url: "https://www.aph.gov.au/house/rss/daily_program",     label: "House Daily Program",          kind: "program"  },
    { url: "https://www.aph.gov.au/senate/rss/red",              label: "Today's Senate hearings",      kind: "hearing"  },
    { url: "https://www.aph.gov.au/senate/rss/new_inquiries",    label: "New Senate inquiries",         kind: "inquiry"  },
    { url: "https://www.aph.gov.au/senate/rss/reports",          label: "Senate reports tabled",        kind: "report"   },
    { url: "https://www.aph.gov.au/senate/rss/upcoming_hearings",label: "Upcoming Senate hearings",     kind: "hearing"  },
    { url: "https://www.aph.gov.au/house/rss/house_inquiries",   label: "House inquiries",              kind: "inquiry"  },
    { url: "https://www.aph.gov.au/house/rss/joint_inquiries",   label: "Joint inquiries",              kind: "inquiry"  },
    { url: "https://www.aph.gov.au/house/rss/media_releases",    label: "House media releases",         kind: "signal"   },
    { url: "https://www.aph.gov.au/house/rss/house_news",        label: "About the House News",         kind: "signal"   },
    { url: "https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=0;query=Date%3AthisYear%20Dataset%3Abillsdgs;resCount=100", label: "Bills Digests", kind: "digest" },
];

function PageLive() {
  const [which, setWhich] = useState("house");
  const { toast, openModal } = useStore();

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
          const link = (linkEl?.textContent || linkEl?.getAttribute("href") || "").trim();
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

    const fetchOne = async (f) => {
      // Auto-detect: use Cloudflare Worker in production, local proxy in dev
      const proxyBase = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
        ? "http://localhost:3001/proxy?url="
        : "https://aph-proxy.jvega019.workers.dev/proxy?url=";
      const proxy = proxyBase + encodeURIComponent(f.url);
      const res = await fetch(proxy, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      return parseRSSXml(text, f);
    };

    const poll = async () => {
      setLoading(true);
      const results = await Promise.allSettled(APH_FEED_URLS.map(fetchOne));
      if (cancelled) return;
      const all = [];
      const status = {};
      results.forEach((r, i) => {
        const f = APH_FEED_URLS[i];
        if (r.status === "fulfilled") {
          status[f.url] = { ok: true, count: r.value.length };
          all.push(...r.value.map((it, idx) => ({ ...it, feedIdx: i, itemIdx: idx })));
        } else {
          status[f.url] = { ok: false, error: String(r.reason).slice(0, 80) };
        }
      });
      // Without dates, sort by feed priority (divisions first, then hearings, etc.) then item order
      all.sort((a, b) => a.feedIdx - b.feedIdx || a.itemIdx - b.itemIdx);
      setEvents(all.slice(0, 30));
      setFeedStatus(status);
      setLastPoll(new Date());
      setLoading(false);
    };

    window.__refreshLiveFeeds = poll;
    poll();
    const id = setInterval(poll, 120000); // 2 min
    return () => { cancelled = true; clearInterval(id); window.__refreshLiveFeeds = null; };
  }, []);

  const fmtTime = (d) => {
    if (!d) return "—";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `${d.getDate()} ${d.toLocaleString("en-AU",{month:"short"})}`;
  };
  const liveCount = Object.values(feedStatus).filter(s => s.ok).length;
  const totalFeeds = APH_FEED_URLS.length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today · live</div>
          <h1 className="page-title">Live parliament</h1>
          <div className="page-sub">Official AUSParliamentLive broadcast (YouTube), ParlView archive, Hansard live-track, and division bells — all wired to the signal engine.</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button className={"btn " + (which === "house" ? "primary" : "")} onClick={() => setWhich("house")}>House</button>
          <button className={"btn " + (which === "senate" ? "primary" : "")} onClick={() => setWhich("senate")}>Senate</button>
          <button className={"btn " + (which === "federation" ? "primary" : "")} onClick={() => setWhich("federation")}>Federation</button>
          <button className="btn" onClick={() => toast("Flag captured — linked to current speaker", "brass")}><Icon name="flag" size={13}/> Flag moment</button>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:"1.7fr 1fr", gap:16}}>
        <div>
          <LiveBroadcast which={which} toast={toast} />
          <div style={{display:"flex", gap:8, marginTop:12, alignItems:"center", flexWrap:"wrap"}}>
            <span className="src-badge"><span className="hdot live"/> AUSParliamentLive · YouTube</span>
            <span className="src-badge"><Icon name="clock" size={11}/> Since 09:30 AEST</span>
            <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--teal)"}}><Icon name="ext" size={11}/> AUSParliamentLive ↗</a>
            <a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--teal)"}}><Icon name="ext" size={11}/> ParlView archive ↗</a>
            <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" className="src-badge" style={{textDecoration:"none", color:"var(--teal)"}}><Icon name="ext" size={11}/> Hansard ↗</a>
            <button className="btn sm ghost" style={{marginLeft:"auto"}} onClick={() => toast("Transcript queued from ParlView")}>Request transcript</button>
            <button className="btn sm" onClick={() => toast("Clip queued for brief", "brass")}><Icon name="brief" size={12}/> Clip to brief</button>
          </div>

          <div className="panel" style={{marginTop:16}}>
            <div className="panel-head">
              <h3 className="panel-title">Currently on program</h3>
              <span className="panel-kicker">{which === "house" ? "House of Representatives" : which === "senate" ? "Senate" : "Federation Chamber"}</span>
              <a href={which === "house" ? "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program" : "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red"} target="_blank" rel="noopener noreferrer" style={{marginLeft:"auto", fontSize:11.5, color:"var(--teal)", textDecoration:"none"}}>Open daily program <Icon name="ext" size={11}/></a>
            </div>
            <div className="panel-body">
              <div className="timeline">
                <div className="tl-item"><div className="tl-time">12:00</div><div className="tl-body">Question time · <a href="#" onClick={e=>{e.preventDefault(); openModal("bill","BILL-2026-048");}} style={{color:"var(--ink)"}}>Digital ID Amendment</a> expected</div></div>
                <div className="tl-item teal"><div className="tl-time">14:00</div><div className="tl-body">Government business · 2nd reading <a href="#" onClick={e=>{e.preventDefault(); openModal("bill","BILL-2026-041");}} style={{color:"var(--ink)"}}>Cyber Security Bill</a> <span className="tag brass" style={{marginLeft:6}}>Watchlist · Cyber</span></div></div>
                <div className="tl-item info"><div className="tl-time">16:30</div><div className="tl-body">Adjournment debate</div></div>
              </div>
            </div>
          </div>

          {/* APH Connectors panel */}
          <div className="panel" style={{marginTop:16}}>
            <div className="panel-head">
              <h3 className="panel-title">APH connectors</h3>
              <span className="panel-kicker">Live data endpoints · {6} connected</span>
            </div>
            <div className="panel-body">
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                {[
                  { name: "Hansard live", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", status: "live", desc: "Daily proofs · every 5 min" },
                  { name: "ParlInfo Search API", url: "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p", status: "live", desc: "Full-text across bills, Hansard, committees" },
                  { name: "Bills Search (OpenSearch)", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", status: "live", desc: "Bill stage & status" },
                  { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/Dynamic_Red", status: "live", desc: "Senate program · live" },
                  { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program", status: "live", desc: "House program · live" },
                  { name: "Division results feed", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Division_lists", status: "live", desc: "Votes within 2 min of call" },
                  { name: "Committee hearings RSS", url: "https://www.aph.gov.au/Parliamentary_Business/Committees/RSS_Feeds", status: "live", desc: "New & upcoming inquiries" },
                  { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", status: "live", desc: "Member roster + portfolios" },
                ].map((c,i) => (
                  <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:"1px solid var(--line-2)", borderRadius:6, textDecoration:"none", color:"var(--ink)", background:"var(--panel-2)"}}>
                    <span className={"hdot live"} style={{flexShrink:0}}/>
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
            <h3 className="panel-title">Signal events · live RSS</h3>
            <span className="panel-kicker">{loading && events.length === 0 ? "Polling…" : `${events.length} items · ${liveCount}/${totalFeeds} feeds`}</span>
          </div>
          <div className="panel-body" style={{maxHeight:720, overflowY:"auto"}}>
            {loading && events.length === 0 && (
              <div style={{padding:"8px 0"}} aria-label="Loading live RSS feed" aria-busy="true">
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{display:"grid", gridTemplateColumns:"56px 16px 1fr", gap:10, padding:"12px 8px", borderBottom:"1px solid var(--line)", alignItems:"start"}}>
                    <span className="skeleton" style={{height:12, width:36}}/>
                    <span className="skeleton" style={{height:14, width:14, borderRadius:"50%"}}/>
                    <div>
                      <span className="skeleton" style={{height:13, width:"80%", marginBottom:7}}/>
                      <span className="skeleton" style={{height:10, width:"45%"}}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && events.length === 0 && (
              <div style={{padding:"14px 8px", fontSize:12.5, color:"var(--ink-3)"}}>
                <div style={{color:"var(--caution)", fontWeight:500, marginBottom:6}}>No items returned</div>
                <p style={{margin:"0 0 8px"}}>The local CORS proxy did not return data. Either the proxy is not running or APH rejected the request.</p>
                <p style={{margin:"0 0 8px", fontFamily:"var(--mono)", fontSize:11, background:"var(--panel-2)", padding:"6px 8px", borderRadius:4}}>
                  Start the proxy: <strong>node proxy-server.js</strong>
                </p>
                <p style={{margin:0}}>Links below still open the raw feeds in a new tab.</p>
              </div>
            )}
            {events.map((e, i) => (
              <a key={e.link || e.title + i} href={e.link || e.sourceUrl} target="_blank" rel="noopener noreferrer" className="clk" style={{display:"grid", gridTemplateColumns:"56px 16px 1fr", gap:10, padding:"10px 8px", borderBottom: i<events.length-1 ? "1px solid var(--line)" : 0, borderRadius:6, alignItems:"start", textDecoration:"none", color:"inherit"}}>
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
                    <span className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{e.kind}</span>
                    <span style={{fontSize:10.5, color:"var(--teal)", fontFamily:"var(--mono)", display:"inline-flex", alignItems:"center", gap:3}}>
                      <Icon name="ext" size={10}/> {e.sourceLabel}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div className="panel-foot" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
            <span className="mono" style={{fontSize:10, color:"var(--ink-3)"}}>Live RSS · aph.gov.au via local CORS proxy (proxy-server.js) · refreshes every 2 min</span>
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
      <div className="page-head">
        <div>
          <div className="page-kicker">Admin</div>
          <h1 className="page-title">Sources</h1>
          <div className="page-sub">Official APH feed bundle plus any custom RSS feeds you've added. Each source is validated, classified and routed to modules.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn" onClick={() => toast("Feeds refreshed")}><Icon name="refresh" size={13}/> Refresh all</button>
          <button className="btn primary" onClick={() => document.getElementById("new-feed-url")?.focus()}><Icon name="plus" size={13}/> Add feed</button>
        </div>
      </div>

      <div className="grid g-4" style={{marginBottom:18}}>
        <div className="panel stat"><div className="stat-label">Active feeds</div><div className="stat-value">{allFeeds.length}</div><div className="stat-meta">3 bundles · Senate · House · Library</div></div>
        <div className="panel stat"><div className="stat-label">Healthy</div><div className="stat-value" style={{color:"var(--ok)"}}>13</div><div className="stat-meta">1 delayed · 1 needs review</div></div>
        <div className="panel stat"><div className="stat-label">Items ingested · today</div><div className="stat-value">24</div><div className="stat-meta">5 matched a watchlist</div></div>
        <div className="panel stat"><div className="stat-label">False positive rate</div><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after 30 days' operation</div></div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Official APH Feed Bundle</h3>
            <span className="panel-kicker">{allFeeds.length} feeds · click a row for detail</span>
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
                  <td><span className={"hdot " + (f.status === "review" ? "review" : f.status)}/>{f.status[0].toUpperCase()+f.status.slice(1)}</td>
                  <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{f.last}</td>
                  <td className="num">{f.today ?? "—"}</td>
                  <td><span className="tag">{f.fpr}</span></td>
                  <td style={{color: f.parser === "Valid" ? "var(--ok)" : f.parser === "Warning" ? "var(--caution)" : "var(--info)"}}>{f.parser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h3 className="panel-title">Add RSS feed</h3>
              <span className="panel-kicker">6-step workflow</span>
            </div>
            <div className="panel-body">
              <label className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Display name</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"8px 10px", marginTop:4, marginBottom:8, width:"100%"}}/>
              <label className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Paste RSS URL</label>
              <div style={{display:"flex", gap:8, marginTop:4}}>
                <input id="new-feed-url" value={newUrl} onChange={e=>setNewUrl(e.target.value)} className="search" style={{flex:1, padding:"8px 10px"}}/>
                <button className="btn primary" onClick={startTest}>{testing && !testState ? "Testing…" : "Validate"}</button>
              </div>
              <div style={{marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
                <div>
                  <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:4}}>Source type</div>
                  <select className="btn" style={{width:"100%", padding:"7px 10px"}}>
                    <option>Parliamentary Library</option><option>Senate</option><option>House</option><option>Department</option><option>Ministerial</option><option>Regulator</option><option>News</option><option>Think tank</option><option>Industry</option>
                  </select>
                </div>
                <div>
                  <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:4}}>Refresh cadence</div>
                  <select className="btn" style={{width:"100%", padding:"7px 10px"}}>
                    <option>Hourly</option><option>Every 15 min</option><option>Daily</option>
                  </select>
                </div>
              </div>
              <div style={{marginTop:12}}>
                <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Route to modules</div>
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
                  <div style={{marginBottom:6, letterSpacing:".1em"}} className="warn">⚠ Parser: needs validation</div>
                  {testState.lines.map((l, i) => (
                    <div key={i} className={l.t}>{l.t === "ok" ? "✓ " : l.t === "warn" ? "⚠ " : "✗ "}{l.s}</div>
                  ))}
                  <button className="btn primary sm" style={{marginTop:10}} onClick={saveFeed}>Save feed</button>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Not yet connected</h3>
              <span className="panel-kicker">Needs parser or source</span>
            </div>
            <div className="panel-body">
              {[
                { name: "Hansard extraction", note: "Needs transcript parser" },
                { name: "QON tracking", note: "Needs source or parliamentary export" },
                { name: "Full bill progress", note: "Needs bills database beyond Digest RSS" },
                { name: "News / media monitoring", note: "Optional bundle — later" },
                { name: "Internal executive briefings", note: "Governance controls required" },
              ].map(x => (
                <div key={x.name} style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px dashed var(--line-2)"}}>
                  <div>
                    <div style={{fontSize:13}}>{x.name}</div>
                    <div style={{fontSize:11.5, color:"var(--ink-3)"}}>{x.note}</div>
                  </div>
                  <button className="btn ghost sm" onClick={() => toast(`Request logged for ${x.name}`, "brass")}>Request</button>
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

  // Match committee name from item.name → id in ENTITIES.committees
  const matchId = (name) => Object.values(ENTITIES.committees).find(c => name.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]))?.id
    || Object.keys(ENTITIES.committees)[0];

  const CommitteeTable = ({ rows, compact }) => (
    <table className="ds">
      <thead><tr>
        <th>When</th><th>Type</th><th>Committee</th>
        {!compact && <th>Topic</th>}
        <th>Portfolio</th><th>Attention</th>
      </tr></thead>
      <tbody>
        {rows.map((r,i) => (
          <tr key={i} onClick={() => openModal("committee", matchId(r.name))}>
            <td className="mono" style={{fontSize:11.5, color:"var(--ink-2)"}}>{r.when}</td>
            <td><span className="tag">{r.type}</span></td>
            <td>{r.name}{compact && <div style={{color:"var(--ink-3)", fontSize:12}}>{r.topic}</div>}</td>
            {!compact && <td>{r.topic}</td>}
            <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{r.portfolio}</td>
            <td><Att level={r.att} /></td>
          </tr>
        ))}
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
          <button className="btn"><Icon name="filter" size={13}/> Filter</button>
          <button className="btn primary"><Icon name="brief" size={13}/> Prep pack</button>
        </div>
      </div>

      <div className="grid g-3" style={{marginBottom:18}}>
        <div className="panel stat"><div className="stat-label">Today</div><div className="stat-value">2<span className="unit">hearings</span></div></div>
        <div className="panel stat"><div className="stat-label">Upcoming · 7 days</div><div className="stat-value">3<span className="unit">hearings</span></div></div>
        <div className="panel stat"><div className="stat-label">Reports tabled · 30 days</div><div className="stat-value">5</div></div>
      </div>

      <div className="panel" style={{marginBottom:16}}>
        <div className="panel-head"><h3 className="panel-title">Today's hearings</h3><span className="panel-kicker">{today.length} items</span></div>
        <CommitteeTable rows={today} />
      </div>

      <div className="grid g-2">
        <div className="panel">
          <div className="panel-head"><h3 className="panel-title">Upcoming hearings</h3><span className="panel-kicker">Next 7 days</span></div>
          <CommitteeTable rows={upcoming} compact />
        </div>
        <div className="panel">
          <div className="panel-head"><h3 className="panel-title">Recently tabled / opened</h3><span className="panel-kicker">Last 48h</span></div>
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
          <button className="btn"><Icon name="download" size={13}/> Export register</button>
          <button className="btn primary" onClick={() => openModal("bill", "BILL-2026-048")}><Icon name="brief" size={13}/> Draft bill brief</button>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Tracked bills</h3>
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
          <div className="panel-head"><h3 className="panel-title">Related divisions</h3><span className="panel-kicker">House · last 7 days</span></div>
          <div className="panel-body">
            {DIVISIONS.map((d,i) => (
              <div key={d.when + d.bill} className="clk" onClick={() => openModal("division", d)} style={{padding:"10px 8px", borderBottom: i<DIVISIONS.length-1 ? "1px solid var(--line)" : 0, borderRadius:6}}>
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
          <h3 className="panel-title">Bills Digest · preview</h3>
          <span className="panel-kicker">Digital ID Amendment (Assurance) Bill 2026</span>
          <div style={{marginLeft:"auto"}}><button className="btn sm" onClick={() => openModal("bill", "BILL-2026-048")}>Open full</button></div>
        </div>
        <div className="panel-body">
          <div className="grid g-2">
            <div>
              <h5 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"0 0 4px"}}>Purpose</h5>
              <p style={{margin:0, color:"var(--ink-2)"}}>Amends the Digital ID Act to expand the scope of the accreditation scheme and introduce new consumer assurance provisions, including revised obligations on accredited entities handling biometric attributes.</p>
              <h5 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 4px"}}>Key provisions</h5>
              <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
                <li>Part 2: accreditation scope expanded to cover state-level identity exchanges</li>
                <li>Part 4: new reporting obligations on biometric attribute use</li>
                <li>Schedule 1: consequential amendments to Privacy Act s.26</li>
              </ul>
            </div>
            <div>
              <h5 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"0 0 4px"}}>Portfolio relevance</h5>
              <p style={{margin:0, color:"var(--ink-2)"}}>High — matches Digital identity and Data sharing & privacy watchlists.</p>
              <h5 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 4px"}}>Recommended action</h5>
              <div style={{padding:"10px 12px", border:"1px solid #c9a36a44", borderRadius:8, background:"#c9a36a0d"}}>
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
  const { openModal } = useStore();
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
          <div className="panel-head"><h3 className="panel-title">House · daily program</h3><span className="panel-kicker">24 Apr 2026</span></div>
          <div className="panel-body">
            <div className="timeline">
              {[
                ["09:30", "House meets", null],
                ["10:00", "Government business: 2nd reading — Cyber Security Legislation Amendment Bill 2026", "BILL-2026-041"],
                ["11:15", "Matter of public importance", null],
                ["12:00", "Question time", null],
                ["14:00", "Private members' business", null],
                ["16:30", "Adjournment debate", null],
              ].map(([t, b, billRef], i) => (
                <div key={i} className={"tl-item " + (billRef ? "" : "teal")}>
                  <div className="tl-time">{t}</div>
                  <div className="tl-body">
                    {billRef ? <a href="#" onClick={e=>{e.preventDefault(); openModal("bill", billRef);}} style={{color:"var(--ink)"}}>{b}</a> : b}
                    {billRef && <span className="tag brass" style={{marginLeft:8}}>Watchlist · Cyber</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3 className="panel-title">Recent divisions</h3><span className="panel-kicker">House</span></div>
          <div className="panel-body">
            {DIVISIONS.map((d, i) => (
              <div key={i} className="clk" onClick={() => openModal("division", d)} style={{padding:"10px 8px", borderBottom: i<DIVISIONS.length-1 ? "1px solid var(--line)" : 0, borderRadius:6}}>
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
          <div className="panel-head"><h3 className="panel-title">House news & media</h3><span className="panel-kicker">Official feeds</span></div>
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
          <div className="panel-head"><h3 className="panel-title">Parliamentary lines</h3><span className="panel-kicker">For Cyber Security Bill 2nd reading</span><span className="chip-fixture" style={{marginLeft:"auto"}}>Fixture</span></div>
          <div className="panel-body">
            <div style={{padding:12, border:"1px dashed var(--line-2)", borderRadius:8, fontSize:13, color:"var(--ink-3)", lineHeight:1.6, fontStyle:"italic"}}>
              <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8, fontStyle:"normal"}}>No lines drafted yet</div>
              Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow. <span className="chip-fixture">Fixture data only in this build</span>
            </div>
            <div style={{marginTop:12, display:"flex", gap:8}}>
              <button className="btn sm primary" disabled style={{opacity:.5, cursor:"not-allowed"}}>Submit for review</button>
              <button className="btn sm" disabled style={{opacity:.5, cursor:"not-allowed"}}>Regenerate</button>
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

      <div style={{padding:"10px 14px", background:"#6b8ec910", border:"1px solid #6b8ec933", borderRadius:8, marginBottom:16, display:"flex", gap:10, alignItems:"center", color:"var(--ink-2)", fontSize:12.5}}>
        <Icon name="flag" size={14} stroke="var(--info)"/>
        <span><strong>Design-state module.</strong> Direct QON feed not yet connected — patterns below use sample scrutiny data. Status visible on Sources page.</span>
      </div>

      <div className="pattern">
        <div className="ribbon">Clustered pattern · moderate confidence</div>
        <div className="serif" style={{fontSize:22, fontWeight:500, marginBottom:6, paddingRight:200}}>Clustered scrutiny pattern on digital procurement governance</div>
        <div style={{color:"var(--ink-2)", fontSize:13.5, maxWidth:720}}>
          4 related questions lodged by 3 members within 48 hours, all targeting digital services portfolio. Trigger likely: ANAO report tabled 22 Apr. Cross-source reinforcement with today's Senate inquiry.
        </div>

        <div className="grid g-4" style={{marginTop:16, marginBottom:18}}>
          <div><div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Members</div><div style={{fontSize:18, marginTop:4}}>3</div></div>
          <div><div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Questions</div><div style={{fontSize:18, marginTop:4}}>4</div></div>
          <div><div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Window</div><div style={{fontSize:18, marginTop:4}}>48h</div></div>
          <div><div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Target</div><div style={{fontSize:13, marginTop:4, lineHeight:1.25}}>Minister for Digital Services / Dept.</div></div>
        </div>

        <div style={{borderTop:"1px dashed var(--line-2)", paddingTop:14}}>
          <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8}}>Evidence · click member for profile</div>
          {QON_PATTERN.items.map((q,i) => {
            const mid = q.who.includes("Hollis") ? "hollis" : q.who.includes("Quirke") ? "quirke" : "rafferty";
            return (
              <div key={i} style={{display:"grid", gridTemplateColumns:"130px 200px 1fr 90px", gap:12, padding:"8px 0", borderBottom: i<QON_PATTERN.items.length-1 ? "1px solid var(--line)" : 0, alignItems:"start", fontSize:12.5}}>
                <div className="mono" style={{color:"var(--ink-3)"}}>{q.when}</div>
                <div><span className="tag brass clk" onClick={() => openModal("member", mid)}>{q.who}</span></div>
                <div style={{color:"var(--ink-2)"}}>{q.q}</div>
                <div style={{textAlign:"right"}}><span className="tag">{q.chamber}</span></div>
              </div>
            );
          })}
        </div>

        <div style={{display:"flex", gap:10, marginTop:16, flexWrap:"wrap"}}>
          <button className="btn primary" onClick={() => toast("Estimates monitor note drafted", "brass")}><Icon name="brief" size={13}/> Draft Estimates monitor note</button>
          <button className="btn" onClick={() => toast("Cluster tracked", "brass")}><Icon name="watch" size={13}/> Track cluster</button>
          <button className="btn" onClick={() => toast("Cluster confirmed as coordinated", "brass")}><Icon name="check" size={13}/> Confirm as coordinated</button>
          <button className="btn ghost" onClick={() => toast("Marked as coincidence")}>Mark as coincidence</button>
        </div>
      </div>

      <div className="panel" style={{marginTop:16}}>
        <div className="panel-head"><h3 className="panel-title">How patterns are detected</h3><span className="panel-kicker">Indicator logic</span></div>
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
  const [sel, setSel] = useState(0);
  const { toast, state } = useStore();

  // Merge drawer-generated briefs into the queue
  const generated = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = SIGNALS.find(s => s.id === sid);
    return { type: v.type || "Executive Brief", for: sig?.title?.slice(0, 40) + "…" || sid, status: "Copied · clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts).slice(0, 3);

  const staticBriefs = [
    { type: "Daily Signal Brief", for: "DDG Digital", status: "Drafted" },
    { type: "Committee Brief", for: "Procurement lead", status: "Awaiting review" },
    { type: "Bill Digest Note", for: "Identity policy", status: "Drafted" },
    { type: "Estimates Monitor Note", for: "Estimates pack", status: "In progress" },
  ];
  const briefs = [...generated, ...staticBriefs];
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
        <button className="btn primary" onClick={() => toast("New brief opened", "brass")}><Icon name="plus" size={13}/> New brief</button>
      </div>

      <div className="grid" style={{gridTemplateColumns:"280px 1fr", gap:16}}>
        <div className="panel">
          <div className="panel-head"><h3 className="panel-title">Queue</h3><span className="panel-kicker">{briefs.length} pending</span></div>
          <div>
            {briefs.map((b, i) => (
              <div key={i} onClick={() => setSel(i)} style={{padding:"12px 14px", borderBottom:"1px solid var(--line)", cursor:"pointer", background: sel===i ? "#c9a36a0c" : "transparent", borderLeft: sel===i ? "2px solid var(--brass)" : "2px solid transparent"}}>
                <div style={{fontSize:13, fontWeight:500}}>{b.type}</div>
                <div style={{fontSize:11.5, color:"var(--ink-3)"}}>For {b.for}</div>
                <div className="mono" style={{fontSize:10, marginTop:4, color: b.status === "Drafted" || b.status.startsWith("Copied") ? "var(--ok)" : b.status === "In progress" ? "var(--caution)" : "var(--info)", textTransform:"uppercase", letterSpacing:".12em"}}>{b.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">{briefs[sel].type} · preview</h3>
            <span className="panel-kicker">For {briefs[sel].for}</span>
            <div style={{marginLeft:"auto", display:"flex", gap:6}}>
              <button className="btn ghost sm" onClick={() => window.print()}><Icon name="download" size={12}/> Print</button>
              <button className="btn sm" onClick={() => toast("Brief sent")}>Send</button>
              <button className="btn primary sm" onClick={() => toast("Brief approved", "brass")}>Approve</button>
            </div>
          </div>
          <div className="panel-body">
            {(() => {
              const b = briefs[sel];
              const sig = b._sid ? SIGNALS.find(s => s.id === b._sid) : null;
              if (sig) return (
                <div className="brief">
                  <div className="meta">PARLIAMENT PULSE · {b.type.toUpperCase()} · {sig.date} · {sig.time}</div>
                  <h3>{sig.title}</h3>
                  <h5>What happened</h5>
                  <div>{sig.summary}</div>
                  <h5>Source</h5>
                  <div>{sig.source} · {sig.sourceAuthority} · {sig.date}</div>
                  <h5>Why it matters</h5>
                  <div>{sig.attentionReason}</div>
                  <h5>Recommended action</h5>
                  <div><strong>{sig.action}.</strong> {sig.actionReason}</div>
                  {sig.evidence?.length > 0 && <>
                    <h5>Evidence</h5>
                    <ul>{sig.evidence.map((e,i) => <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer" style={{color:"#7a5a22"}}>{e.label}</a></li>)}</ul>
                  </>}
                  <h5>Provenance</h5>
                  <div>Signal ID: {sig.id} · Confidence: {sig.confidence}/5 · Human review: {sig.humanReview}</div>
                </div>
              );
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
  const { openModal, createWatchlist, state } = useStore();
  const [newName, setNewName] = useState("");
  const all = [...WATCHLISTS, ...state.watchlistCreated];
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
          <input placeholder="New watchlist name" value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"7px 10px"}}/>
          <button className="btn primary" onClick={() => { if (newName.trim()) { createWatchlist(newName.trim()); setNewName(""); } }}><Icon name="plus" size={13}/> Create</button>
        </div>
      </div>

      <div className="grid g-3">
        {all.map(w => {
          const max = Math.max(...w.trend, 1);
          return (
            <div key={w.name} className="wl" onClick={() => openModal("watchlist", w.name)}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span className="wl-name">{w.name}</span>
                <span className="mono" style={{fontSize:10.5, color:"var(--brass)", background:"#c9a36a12", border:"1px solid #c9a36a44", padding:"1px 6px", borderRadius:4, marginLeft:"auto"}}>{w.matches} matches</span>
              </div>
              <div className="wl-meta"><span>{w.keywords} keywords</span><span>·</span><span>7-day</span></div>
              <div className="spark" style={{marginTop:2}}>
                {w.trend.map((v,i) => <span key={i} style={{height: (v/max*20+2)+"px"}}/>)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{marginTop:18}}>
        <div className="panel-head">
          <h3 className="panel-title">Digital government · configuration</h3>
          <span className="panel-kicker">Selected watchlist</span>
        </div>
        <div className="panel-body">
          <div className="grid g-2">
            <div>
              <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Keywords</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                {["digital transformation","ICT procurement","MyGov","service delivery","APS digital","digital identity","digital strategy","cloud services","data sharing","Digital Transformation Agency"].map(k => <span key={k} className="tag brass">{k}</span>)}
              </div>
              <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 6px"}}>Linked committees</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                <span className="tag teal clk" onClick={() => openModal("committee","jcpaa")}>Joint Committee on Public Accounts & Audit</span>
                <span className="tag teal clk" onClick={() => openModal("committee","finpa")}>Finance & Public Administration (Sen)</span>
                <span className="tag teal clk" onClick={() => openModal("committee","econ")}>Economics Legislation (Sen)</span>
              </div>
            </div>
            <div>
              <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Attention thresholds</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:8, fontSize:13}}>
                <div>Source authority weight</div><div className="mono">0.95</div>
                <div>Portfolio relevance weight</div><div className="mono">0.90</div>
                <div>Minimum attention score</div><div className="mono">0.55</div>
                <div>Auto-escalate above</div><div className="mono">0.80</div>
                <div>Suppress duplicates within</div><div className="mono">24h</div>
              </div>
              <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", margin:"14px 0 6px"}}>Audit — recent corrections</div>
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
          <div className="page-sub">Transparent categories — no fake precision scores. Click any issue for momentum detail and suggested actions.</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Active issues</h3>
          <span className="panel-kicker">Last 7 days</span>
        </div>
        <div className="panel-body">
          <div style={{display:"grid", gridTemplateColumns:"1fr 100px 80px 120px 140px", padding:"4px 0 10px", borderBottom:"1px solid var(--line)", alignItems:"center", gap:14}}>
            <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Issue</div>
            <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Attention</div>
            <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", textAlign:"right"}}>Sources</div>
            <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Momentum</div>
            <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Confidence</div>
          </div>
          {RADAR.map((r,i) => (
            <div key={i} className="clk" onClick={() => openModal("radar", r.issue)} style={{display:"grid", gridTemplateColumns:"1fr 100px 80px 120px 140px", padding:"14px 8px", borderBottom: i<RADAR.length-1 ? "1px solid var(--line)" : 0, gap:14, alignItems:"center", borderRadius:6}}>
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
  const { state, openSignal } = useStore();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("time");

  const visible = React.useMemo(() => {
    let sigs = SIGNALS.filter(s => !state.archived[s.id]);
    if (filter !== "all") sigs = sigs.filter(s => s.attention === filter);
    if (sort === "score") sigs = [...sigs].sort((a, b) => (b.score?.authority || 0) - (a.score?.authority || 0));
    return sigs;
  }, [state.archived, filter, sort]);

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
          <span style={{fontSize:12, color:"var(--ink-4)"}}>Sort:</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{background:"var(--panel)", border:"1px solid var(--line-2)", color:"var(--ink)", borderRadius:6, padding:"5px 8px", fontSize:12, cursor:"pointer"}}>
            <option value="time">Time</option>
            <option value="score">Authority score</option>
          </select>
        </div>
      </div>

      <div style={{display:"flex", gap:8, marginBottom:16, flexWrap:"wrap"}}>
        {[["all","All"], ["high","High"], ["med","Medium"], ["low","Low"]].map(([val, label]) => (
          <button key={val} className={"filter-chip" + (filter === val ? " active" : "")} onClick={() => setFilter(val)}>
            {label} <span style={{opacity:.65}}>({counts[val]})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty" style={{padding:"40px 0", textAlign:"center"}}>
          {filter === "all" ? "No active signals — all archived." : `No ${filter} attention signals.`}
        </div>
      ) : (
        <div>
          {visible.map(s => <SignalCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PageOverview, PageLive, PageSources, PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists, PageRadar, PageSignals, OnboardingGuide });
