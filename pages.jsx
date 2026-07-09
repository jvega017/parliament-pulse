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
  let url = "";
  try {
    const blob = new Blob([csv], { type: "text/csv" });
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function copyText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text)
    .then(() => toast(ok, "brass"))
    .catch(() => toast("Clipboard unavailable: content not copied", "error"));
}

function copyLiveActionNote(kind, chamber, toast) {
  const label = chamber === "house" ? "House of Representatives" : chamber === "senate" ? "Senate" : "Federation Chamber";
  const note = [
    `# Parliament Pulse live action note`,
    `Type: ${kind}`,
    `Chamber: ${label}`,
    `Captured: ${new Date().toISOString()}`,
    ``,
    `Source links:`,
    `- AUSParliamentLive: https://www.youtube.com/@AUSParliamentLive/streams`,
    `- ParlView archive: https://parlview.aph.gov.au/`,
    `- Hansard: https://www.aph.gov.au/Parliamentary_Business/Hansard`,
  ].join("\n");
  return copyText(note, toast, `${kind} note copied`);
}

function copyBacklogRequest(name, note, toast) {
  const text = [
    `# Parliament Pulse backlog request`,
    `Capability: ${name}`,
    `Reason: ${note}`,
    `Requested: ${new Date().toISOString()}`,
  ].join("\n");
  return copyText(text, toast, "Backlog request copied");
}

function downloadBriefingQueue(briefs, toast) {
  const ok = exportRowsCSV(
    ["type", "for", "status"],
    briefs.map(b => [b.type, b.for, b.status]),
    `parliament-pulse-briefing-queue-${new Date().toISOString().slice(0,10)}.csv`,
  );
  if (toast) toast(ok ? "Briefing queue CSV downloaded" : "CSV export unavailable", ok ? "brass" : "error");
}

const BETA_READINESS_ROWS = [
  {
    state: "Live",
    title: "Official feed spine",
    detail: "Six APH RSS sources are configured and polled through the local or Cloudflare proxy. The Live page shows runtime feed state and direct source links.",
    action: "Open Live",
    page: "live",
  },
  {
    state: "Representative",
    title: "Enriched policy signals",
    detail: "Priority, confidence, provenance, radar clusters and watchlist matches are modelled from the target workflow until the enrichment pipeline is connected.",
    action: "Review signals",
    page: "signals",
  },
  {
    state: "Next",
    title: "Activation path",
    detail: "Production hardening needs authenticated division/member data, Hansard and QON extraction, shared briefing persistence and a publication approval lane.",
    action: "View sources",
    page: "sources",
  },
];

const PROVENANCE_STACK = [
  {
    label: "Official source",
    title: "APH RSS + direct source links",
    detail: "Live feed rows retain the official APH URL and expose Hansard, ParlView, YouTube or source-page links before any interpretation.",
    state: "Live",
  },
  {
    label: "Transport",
    title: "CORS proxy with constrained feed list",
    detail: "Local beta uses proxy-server.js. Production uses the Cloudflare Worker route documented in the repo.",
    state: "Live",
  },
  {
    label: "Enrichment",
    title: "Priority scoring and policy routing",
    detail: "The target scoring model is represented in the UI, but enrichment needs the production signal pipeline before public claims.",
    state: "Representative",
  },
  {
    label: "Analyst action",
    title: "Briefs, exports, notes and watchlists",
    detail: "Current controls create local artefacts, copy handoff notes, export CSVs or persist browser-local review state.",
    state: "Beta",
  },
];

const COVERAGE_MATRIX = [
  {
    module: "Live parliament",
    state: "Live",
    evidence: "Six official APH RSS feeds plus chamber program and broadcast links.",
    activation: "Keep runtime feed health in Live page; add sitting-status check before claiming current chamber activity.",
    page: "live",
  },
  {
    module: "Sources",
    state: "Live",
    evidence: "Official source register and constrained proxy route.",
    activation: "Connect custom-feed validation to backend parser instead of timeout simulation.",
    page: "sources",
  },
  {
    module: "Overview signals",
    state: "Representative",
    evidence: "Representative signal set with direct source links.",
    activation: "Wire production scoring, entity extraction and watchlist matching.",
    page: "signals",
  },
  {
    module: "Committees",
    state: "Partial live",
    evidence: "Committee RSS coverage where official feeds expose reports, inquiries and hearings.",
    activation: "Add committee profile scraper or curated registry for chairs, dates and hearing status.",
    page: "committees",
  },
  {
    module: "Bills intelligence",
    state: "Representative",
    evidence: "Bill source links and representative digest workflow.",
    activation: "Connect bills register, amendment tracking and portfolio routing.",
    page: "bills",
  },
  {
    module: "Briefings",
    state: "Local beta",
    evidence: "Clipboard export, CSV export and browser-local queue state.",
    activation: "Add shared persistence, reviewer assignment and approval workflow.",
    page: "briefings",
  },
  {
    module: "QON patterns",
    state: "Representative",
    evidence: "Modelled pattern-detection workflow.",
    activation: "Add Hansard/QON extraction, NLP clustering and source-level audit trace.",
    page: "patterns",
  },
  {
    module: "Watchlists/radar",
    state: "Representative",
    evidence: "Keyword and cluster target model.",
    activation: "Connect live enrichment pipeline and alert delivery rules.",
    page: "watchlists",
  },
];

function BetaReadinessPanel({ navigate }) {
  return (
    <div className="beta-ledger" aria-label="Beta evidence status">
      <div className="beta-ledger-head">
        <div>
          <div className="panel-section-title">Beta evidence ledger</div>
          <h2>What is live, what is representative, and what activates next</h2>
        </div>
        <span className="chip-fixture">Official-first beta</span>
      </div>
      <div className="beta-ledger-grid">
        {BETA_READINESS_ROWS.map(row => (
          <button key={row.title} className="beta-ledger-row" onClick={() => navigate(row.page)}>
            <span className={"beta-state beta-" + row.state.toLowerCase()}>{row.state}</span>
            <span>
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </span>
            <span className="beta-action">{row.action} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProvenanceStackPanel({ navigate }) {
  return (
    <div className="provenance-stack">
      <div className="provenance-head">
        <div>
          <div className="panel-section-title">Source to decision</div>
          <h2>How a parliamentary item becomes a beta signal</h2>
        </div>
        <button className="btn ghost sm" onClick={() => navigate("sources")}><Icon name="ext" size={12}/> Source register</button>
      </div>
      <div className="provenance-steps">
        {PROVENANCE_STACK.map((step, index) => (
          <div key={step.label} className="provenance-step">
            <div className="prov-index">{String(index + 1).padStart(2, "0")}</div>
            <div>
              <div className="prov-label">{step.label}</div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
            <span className={"beta-state beta-" + (step.state === "Representative" ? "representative" : step.state === "Live" ? "live" : "next")}>{step.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvenanceMetricsBand({ navigate }) {
  const metrics = [
    { label: "Official feeds", value: sourceCounts().total, detail: "Configured APH sources", icon: "rss" },
    { label: "Signals", value: SIGNALS.length, detail: "Current beta signal set", icon: "signal" },
    { label: "Source links", value: "Present", detail: "Representative items include source links", icon: "link" },
    { label: "Human review", value: "On", detail: "Verify before publication", icon: "check" },
  ];
  return (
    <div className="provenance-metrics">
      <div className="panel-section-title">Provenance at a glance</div>
      <div className="prov-metric-grid">
        {metrics.map(m => (
          <button key={m.label} className="prov-metric" onClick={() => navigate(m.label === "Official feeds" ? "sources" : "signals")}>
            <Icon name={m.icon} size={14}/>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
            <small>{m.detail}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverageActivationMatrix({ navigate, copyPlan }) {
  return (
    <div className="coverage-matrix" aria-label="Module coverage and activation matrix">
      <div className="coverage-head">
        <div>
          <div className="panel-section-title">Module coverage and activation matrix</div>
          <h2>What is operational, what is representative, and what needs wiring next</h2>
        </div>
        <button className="btn ghost sm" onClick={copyPlan}><Icon name="brief" size={12}/> Copy activation plan</button>
      </div>
      <div className="coverage-grid">
        <div className="coverage-row coverage-labels" aria-hidden="true">
          <span>Module</span><span>Status</span><span>Evidence basis</span><span>Activation needed</span><span>Open</span>
        </div>
        {COVERAGE_MATRIX.map(row => (
          <div key={row.module} className="coverage-row">
            <strong>{row.module}</strong>
            <span className={"coverage-state state-" + row.state.toLowerCase().replace(/\s+/g, "-")}>{row.state}</span>
            <span>{row.evidence}</span>
            <span>{row.activation}</span>
            <button className="btn ghost sm" onClick={() => navigate(row.page)}><Icon name="ext" size={12}/> Open</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- OVERVIEW ----------
function OnboardingGuide() {
  const key = "pp-onboarded";
  const [visible, setVisible] = React.useState(() => !safeGetLocalStorage(key));
  if (!visible) return null;
  return (
    <div style={{background:"var(--panel-hi)", border:"1px solid var(--brass-soft)", borderRadius:10, padding:"16px", marginBottom:18}}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
        <Icon name="signal" size={14} stroke="var(--brass)" />
        <span className="mono t-label" style={{color:"var(--brass)", textTransform:"uppercase", letterSpacing:".18em"}}>Getting started</span>
        <button onClick={() => { safeSetLocalStorage(key, "1"); setVisible(false); }}
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
  const [showHelp, setShowHelp] = useState(false);
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
    copyText(lines, toast, "Daily brief copied to clipboard");
  };
  const copyBetaHandoff = () => {
    const handoff = [
      "# Parliament Pulse beta handoff",
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Live in this beta",
      "- Six official APH RSS feeds are configured.",
      "- Live page polls through the local or Cloudflare proxy.",
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
  const copyActivationPlan = () => {
    const table = COVERAGE_MATRIX.map(row => `| ${row.module} | ${row.state} | ${row.evidence} | ${row.activation} |`).join("\n");
    const plan = [
      "# Parliament Pulse activation plan",
      `Generated: ${new Date().toISOString()}`,
      "",
      "| Module | Current coverage | Evidence basis | Activation needed |",
      "| --- | --- | --- | --- |",
      table,
      "",
      "## Immediate priorities",
      "1. Keep official feed polling visible in Live and avoid current-sitting claims until verified.",
      "2. Connect backend validation for custom feeds before routing them as production sources.",
      "3. Wire production enrichment for scoring, entity extraction, watchlist matching, Hansard/QON extraction and briefing persistence.",
      "4. Keep representative labels until each module has verified item-level evidence.",
    ].join("\n");
    copyText(plan, toast, "Activation plan copied");
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">{new Date().toLocaleDateString("en-AU", {weekday:"short", day:"numeric", month:"short", year:"numeric"})} · Verify sitting status from APH</div>
          <h1 className="page-title">Today's signals</h1>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end"}}>
          <span className="chip-fixture" title="Signal counts and tiles are representative; the Live page polls official RSS feeds">Representative signals · live RSS available</span>
          <button className="btn ghost sm" aria-expanded={showHelp} onClick={() => setShowHelp(v => !v)}><Icon name="signal" size={12}/> How it works</button>
          <button className="btn ghost sm" onClick={exportSignalsCSV}><Icon name="ext" size={12}/> Export CSV</button>
          <button className="btn ghost sm" onClick={copyBetaHandoff}><Icon name="brief" size={12}/> Copy beta handoff</button>
          <button className="btn primary" onClick={generateDailyBrief}><Icon name="brief" size={13}/> Generate daily brief</button>
        </div>
      </div>

      {showHelp && <OnboardingGuide />}

      {/* COMMAND STRIP HERO — Priority is the hero KPI; the only number that drives a decision */}
      <div className="command-strip">
        <div className="cs-primary">
          <div className="cs-stat-label">Priority signals</div>
          <div className="cs-kpi cs-count-up">{priority.length}<span className="unit">{priority.length > 0 ? "to triage" : "clear"}</span></div>
          <div className="stat-meta" style={{marginTop:8, display:"flex", alignItems:"center", gap:10}}>
            <span style={{color:"var(--ink-3)"}}>{priority.length + rest.length} signals today · {SIGNALS.filter(s => state.archived[s.id]).length}/{SIGNALS.length} actioned</span>
            {priority.length > 0 && <button className="btn ghost sm" style={{marginLeft:"auto"}} onClick={() => document.getElementById("priority-panel")?.scrollIntoView({behavior:"smooth", block:"start"})}>Triage now →</button>}
          </div>
        </div>
        <div className="cs-secondary">
          <div className="cs-stat-label">Committee activity</div>
          <div className="cs-stat">7<span className="unit">items</span></div>
          <div className="stat-meta">2 hearings · 1 inquiry · 1 report</div>
        </div>
        <div className="cs-secondary">
          <div className="cs-stat-label">Source health</div>
          <div className="cs-stat">{sourceCounts().total}<span className="unit">feeds</span></div>
          <div className="stat-meta">Official feeds configured · live poll on Live page</div>
        </div>
      </div>

      {/* SOURCE STRIP — official links first; current chamber state must be verified before action. */}
      <div className="live-strip g-live-strip" style={{display:"grid", gap:14, alignItems:"center", padding:"12px 16px", marginBottom:16}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ok)"}}/>
          <span className="mono" style={{fontSize:10.5, letterSpacing:".16em", color:"var(--ok)", fontWeight:600}}>LATEST CONFIGURED SOURCES</span>
        </div>
        <div style={{display:"flex", gap:18, fontSize:12.5, color:"var(--ink-2)", alignItems:"center"}}>
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
              <span className="panel-kicker">{priority.length} items · human review required</span>
            </div>
            <div className="panel-body">
              {priority.map(s => <SignalCard key={s.id} s={s} />)}
              {priority.length === 0 && <EmptyState icon="check" kicker="Priority clear">All priority signals actioned.</EmptyState>}
            </div>
            {rest.length > 0 && (
              <div className="panel-foot">
                <span style={{color:"var(--ink-3)", fontSize:13}}>{rest.length} more signal{rest.length !== 1 ? "s" : ""} in the last 24h</span>
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
                <span className="panel-kicker" style={{marginLeft:"auto"}}>Since 17:00 yesterday</span>
              </div>
              <div style={{marginBottom:12, paddingBottom:12, borderBottom:"1px solid var(--rule-2)", fontSize:12, color:"var(--ink-3)"}}>
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
            <div className="panel-section">
              <div className="panel-section-head">
                <h2 className="panel-section-title">Briefing queue</h2>
                <span className="panel-kicker" style={{marginLeft:"auto"}}>4 pending</span>
              </div>
              {BRIEFING_QUEUE.map((b,i) => (
                <div key={b.type + b.for} className="data-row g-brief-row" style={{display:"grid", gap:10, padding:"10px 0", borderBottom: i < BRIEFING_QUEUE.length-1 ? "1px solid var(--rule-2)" : 0}}>
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
        </div>
      </div>

      <BetaReadinessPanel navigate={goto} />

      <CoverageActivationMatrix navigate={goto} copyPlan={copyActivationPlan} />

      <ProvenanceStackPanel navigate={goto} />

      <ProvenanceMetricsBand navigate={goto} />
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
  // mode: "embed" = YouTube live_stream iframe ; "offline" = branded entry card.
  // Default OFFLINE: YouTube renders its own grey "video unavailable" page (which fires
  // onLoad, so it cannot be auto-detected) when a chamber is not sitting. Leading with
  // the branded card means a first-time viewer never lands on YouTube's error tile;
  // they load the stream explicitly.
  const [mode, setMode] = React.useState("offline");
  const [nonce, setNonce] = React.useState(0); // bump to force reload
  const embedReady = embedTarget.which === which && embedTarget.nonce === nonce;
  // F9: a cross-origin iframe cannot expose true playback state, so we treat the
  // stream as unconfirmed until the iframe fires onLoad. If no load arrives within
  // the timeout we auto-switch to the offline panel. The LIVE badge is never shown
  // until the iframe has at least loaded; we still label it "Signal" not a hard LIVE
  // claim, because confirmed playback is not detectable from here.
  const [loaded, setLoaded] = React.useState(false);

  // When chamber changes, return to the branded card (do not auto-embed); the embed
  // loads only when the viewer explicitly requests it (or on retry, which bumps nonce).
  React.useEffect(() => {
    setMode("offline");
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
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
            <span style={{width:8, height:8, borderRadius:"50%", background:"var(--ink-4)"}}/>
            <div style={{fontFamily:"var(--serif)", fontSize:22, color:"var(--ink)"}}>Live broadcast · {cfg.label}</div>
          </div>
          <div style={{color:"var(--ink-2)", fontSize:13, maxWidth:460, lineHeight:1.5, marginBottom:18}}>
            AUSParliamentLive streams <strong>{cfg.label}</strong> while the chamber is sitting. Load the live stream here, or open the official sources.
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center"}}>
            <button className="btn primary" onClick={() => { setNonce(n => n + 1); setMode("embed"); }}><Icon name="signal" size={13}/> Load live stream</button>
            <a href="https://www.youtube.com/@AUSParliamentLive/streams" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>YouTube <Icon name="ext" size={12}/></a>
            <a href="https://www.aph.gov.au/News_and_Events/Watch_Read_Listen" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>APH Watch / Read / Listen <Icon name="ext" size={12}/></a>
            <a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" className="btn" style={{textDecoration:"none"}}>ParlView archive <Icon name="ext" size={12}/></a>
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
          <div className="page-sub">Official broadcast embed, APH source links, and live RSS polling from configured official feeds.</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button className={"btn " + (which === "house" ? "primary" : "")} onClick={() => setWhich("house")}>House</button>
          <button className={"btn " + (which === "senate" ? "primary" : "")} onClick={() => setWhich("senate")}>Senate</button>
          <button className={"btn " + (which === "federation" ? "primary" : "")} onClick={() => setWhich("federation")}>Federation</button>
          <button className="btn" title="Copy a timestamped live action note" onClick={() => copyLiveActionNote("Flag moment", which, toast)}><Icon name="flag" size={13}/> Flag moment</button>
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
            <button className="btn sm ghost" style={{marginLeft:"auto"}} title="Copy a Hansard follow-up note" onClick={() => copyLiveActionNote("Transcript follow-up", which, toast)}>Request transcript</button>
            <button className="btn sm" title="Copy a source-backed clip note" onClick={() => copyLiveActionNote("Clip to brief", which, toast)}><Icon name="brief" size={12}/> Clip to brief</button>
          </div>

          <div className="panel" style={{marginTop:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Currently on program</h2>
              <span className="panel-kicker">{which === "house" ? "House of Representatives" : which === "senate" ? "Senate" : "Federation Chamber"}</span>
              <a href={which === "house" ? "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" : "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents"} target="_blank" rel="noopener noreferrer" style={{marginLeft:"auto", fontSize:11.5, color:"var(--teal)", textDecoration:"none"}}>Open daily program <Icon name="ext" size={11}/></a>
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
                  { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", desc: "Official Senate program page" },
                  { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official House program page" },
                  { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official division lists page" },
                  { name: "Committee RSS feeds", url: "https://www.aph.gov.au/Parliamentary_Business/Committees", desc: "Official committee RSS listing" },
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
            <h2 className="panel-title">Recent items · APH RSS</h2>
            <span className="panel-kicker">{loading && events.length === 0 ? "Polling…" : `${events.length} tabled items · ${liveCount}/${totalFeeds} feeds${lastPoll ? " · as at " + fmtTime(lastPoll) + " AEST" : ""}`}</span>
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
              showDevDetail ? (
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
                    <p style={{margin:"0 0 8px"}}>Worker returned no items. Confirm the Cloudflare Worker is deployed and this origin is on its CORS allowlist.</p>
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
      <div className="page-head">
        <div>
          <div className="page-kicker">Admin</div>
          <h1 className="page-title">Sources</h1>
          <div className="page-sub">Official APH feed bundle plus any custom RSS feeds you've added. Official feeds are polled live; custom validation is a prototype workflow until backend validation is connected.</div>
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
                  <button className="btn ghost sm" title="Copy a backlog request for this source" onClick={() => copyBacklogRequest(x.name, x.note, toast)}>Request</button>
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
  const { openModal, toast } = useStore();
  const [highOnly, setHighOnly] = useState(false);
  const rows = highOnly ? COMMITTEE_ITEMS.filter(i => i.att === "high") : COMMITTEE_ITEMS;
  const today = rows.filter(i => i.when.startsWith("Today"));
  const upcoming = rows.filter(i => !i.when.startsWith("Today") && !i.when.startsWith("Yesterday"));
  const recent = rows.filter(i => i.when.startsWith("Yesterday"));
  const exportPrepPack = () => {
    exportRowsCSV(
      ["when", "type", "committee", "topic", "portfolio", "attention"],
      rows.map(r => [r.when, r.type, r.name, r.topic, r.portfolio, r.att]),
      `parliament-pulse-committee-prep-${new Date().toISOString().slice(0,10)}.csv`,
    );
    toast("Committee prep pack exported", "brass");
  };

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
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Committees</h1>
          <div className="page-sub">Powered by Senate and House committee feeds. Click any row to open the committee, hearings, inquiries and prep pack.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className={"btn" + (highOnly ? " primary" : "")} title="Toggle high-attention committee rows" onClick={() => setHighOnly(v => !v)}><Icon name="filter" size={13}/> High attention</button>
          <button className="btn ghost" title="Export the current committee prep rows" onClick={exportPrepPack}><Icon name="brief" size={13}/> Export prep pack</button>
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
                const featured = b.ref === "BILL-2026-048";
                return (
                  <tr key={b.ref} onClick={() => openModal("bill", b.ref)} aria-current={featured ? "true" : undefined} style={featured ? {background:"var(--panel-hi)", boxShadow:"inset 2px 0 0 var(--brass)"} : undefined}>
                    <td className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{b.ref}</td>
                    <td style={{fontWeight:500}}>{b.title}</td>
                    <td style={{color:"var(--ink-2)"}}>{b.stage}</td>
                    <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{b.portfolio}</td>
                    <td>{b.digest === "Published" ? <span className="tag teal">Published</span> : <span className="tag">Pending</span>}</td>
                    <td style={{color: owner === "—" ? "var(--ink-4)" : (owner !== b.owner ? "var(--ok)" : "var(--ink-2)")}}>{owner}</td>
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
          <h2 className="panel-title">Bills Digest</h2>
          <span className="panel-kicker">Featured · Digital ID Amendment (Assurance) Bill 2026 (highest attention)</span>
          <div style={{marginLeft:"auto"}}><button className="btn ghost sm" onClick={() => openModal("bill", "BILL-2026-048")}>Open full detail →</button></div>
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
              <div style={{padding:"10px 14px", borderLeft:"3px solid var(--brass)", borderRadius:"0 6px 6px 0", background:"var(--panel-2)"}}>
                <div style={{color:"var(--ink)", fontWeight:600}}>Draft Executive Brief</div>
                <div style={{fontSize:12, color:"var(--ink-2)", marginTop:4}}>Scope of accreditation warrants director-level awareness before 2nd reading.</div>
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
          <div className="panel-head"><h2 className="panel-title">Parliamentary lines</h2><span className="panel-kicker">For Cyber Security Bill 2nd reading</span><span className="chip-fixture" style={{marginLeft:"auto"}}>Representative data</span></div>
          <div className="panel-body">
            <div style={{padding:12, border:"1px dashed var(--line-2)", borderRadius:8, fontSize:13, color:"var(--ink-3)", lineHeight:1.6, fontStyle:"italic"}}>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8, fontStyle:"normal"}}>No lines drafted yet</div>
              Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow. <span className="chip-fixture">Representative data</span>
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
  const [clusterStatus, setClusterStatus] = useState("Needs analyst review");
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
          <button className="btn" title="Copy an Estimates monitor note" onClick={() => copyText(`# Estimates monitor note\nGenerated: ${new Date().toISOString()}\n\nPattern: ${QON_PATTERN.title}\nStatus: ${clusterStatus}\n\nRecommended action: monitor for Estimates references and verify against Hansard or QON source material.`, toast, "Estimates monitor note copied")}><Icon name="brief" size={13}/> Draft Estimates monitor note</button>
          <button className="btn" title="Mark this cluster as tracked in this session" onClick={() => { setClusterStatus("Tracked"); toast("Cluster marked as tracked", "brass"); }}><Icon name="watch" size={13}/> Track cluster</button>
          <button className="btn" title="Confirm the analyst classification for this session" onClick={() => { setClusterStatus("Confirmed as coordinated"); toast("Cluster confirmed for review", "brass"); }}><Icon name="check" size={13}/> Confirm as coordinated</button>
          <button className="btn ghost" title="Classify the cluster as coincidence in this session" onClick={() => { setClusterStatus("Marked as coincidence"); toast("Cluster marked as coincidence"); }}>Mark as coincidence</button>
        </div>
        <div className="mono" style={{fontSize:10.5, color:"var(--ink-3)", marginTop:8, letterSpacing:".08em"}}>Session status: {clusterStatus}</div>
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
    { type: "Daily Signal Brief", for: "Director, Digital Policy", status: "Example · drafted" },
    { type: "Committee Brief", for: "Procurement lead", status: "Example · awaiting review" },
    { type: "Bill Digest Note", for: "Identity policy", status: "Example · drafted" },
    { type: "Estimates Monitor Note", for: "Estimates pack", status: "Example · in progress" },
  ];
  const briefs = [...generated, ...staticBriefs];
  const briefId = (b) => b._sid || `${b.type}|${b.for}`;
  const selected = briefs.find(b => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Briefings</h1>
          <div className="page-sub">Generated local briefs appear above. Representative queue examples below show the intended review workflow: What happened · Source · Why it matters · Recommended action · Evidence · Uncertainty · Human review.</div>
        </div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}>
          <button className="btn" onClick={() => downloadBriefingQueue(briefs, toast)}><Icon name="download" size={13}/> Export queue</button>
          <button className="btn primary" title="Open signals to generate a brief" onClick={() => { setSignalSearchQuery(""); navigate("signals"); }}><Icon name="plus" size={13}/> New brief</button>
        </div>
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
                <div className="mono t-label" style={{marginTop:4, color: b.status.startsWith("Copied") ? "var(--ok)" : b.status.includes("in progress") ? "var(--caution)" : b.status.includes("awaiting") ? "var(--info)" : "var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{b.status}</div>
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
              <button className="btn sm" disabled={!selected} title="Copy a send-ready handoff note" onClick={() => copyText(`# Brief handoff\nType: ${selected.type}\nFor: ${selected.for}\nStatus: ${selected.status}\nGenerated: ${new Date().toISOString()}`, toast, "Brief handoff copied")}>Copy handoff</button>
              <button className="btn ghost sm" disabled={!selected} title="Mark this brief reviewed in the local queue" onClick={() => toast(`Marked reviewed: ${selected.type}`, "brass")}>Mark reviewed</button>
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
// Maps one worker /state signals-block row (see workers/aph-proxy/src/stateContract.ts
// SignalItem) onto the shape SignalCard/SignalCardView already render. Only fields the
// Worker actually returned are populated — action, score, provenance-trail and updates
// are left undefined rather than invented, and Drawer/SignalCardView already guard on
// their presence, so an undefined field just renders nothing instead of a fabricated one.
function mapWorkerSignalToCard(row) {
  const when = row.pub_date ? new Date(row.pub_date) : null;
  return {
    id: row.guid,
    time: when ? `${String(when.getHours()).padStart(2,"0")}:${String(when.getMinutes()).padStart(2,"0")}` : "—",
    date: when ? when.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—",
    source: row.feed_label,
    sourceGroup: row.source_group,
    title: row.title,
    summary: row.scoring_explanation || "",
    tags: [{ l: row.kind, c: "" }],
    attention: row.attention || "low",
    attentionReason: row.scoring_explanation || "",
    action: "",
    actionReason: "",
    confidence: row.confidence ?? 0,
    sourceAuthority: "Official",
    evidence: row.link ? [{ label: row.feed_label, url: row.link }] : [],
  };
}

function PageSignals() {
  const { state, setVisibleSignalOrder, signalSearchQuery, setSignalSearchQuery } = useStore();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("time");
  // Live /state consumer, proof-of-wiring for the composed endpoint (D7). Starts as
  // fixture (the current SIGNALS array) and only switches over once the Worker
  // confirms the block is live and non-empty — the fixture is never replaced on a
  // guess. See workers/aph-proxy/src/state.ts for the provenance contract.
  const [liveSignals, setLiveSignals] = useState({ provenance: "fixture", items: null });

  React.useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    // Guard: file:// origins cannot reach the Worker (same guard as the Live page poller).
    if (location.protocol === "file:") return () => { cancelled = true; };

    const fetchState = async () => {
      if (inFlight) return;
      inFlight = true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`${WORKER_BASE_URL}/state`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const payload = await res.json();
        if (cancelled) return;
        const block = payload?.blocks?.signals;
        if (block?.provenance === "live" && Array.isArray(block.items) && block.items.length > 0) {
          setLiveSignals({ provenance: "live", items: block.items.map(mapWorkerSignalToCard) });
        } else {
          // Fixture SIGNALS renders in this branch (items stays null), so the chip must
          // never say "live" here even if the block itself claimed to be — the fixture
          // array is what is actually on screen, not the (possibly empty) live rows.
          const fallback = (block?.provenance && block.provenance !== "live") ? block.provenance : "fixture";
          setLiveSignals({ provenance: fallback, items: null });
        }
      } catch (e) {
        if (!cancelled) setLiveSignals(s => ({ provenance: s.items ? s.provenance : "fixture", items: s.items }));
      } finally {
        clearTimeout(timer);
        inFlight = false;
      }
    };
    fetchState();
    return () => { cancelled = true; };
  }, []);

  const sourceSignals = liveSignals.items || SIGNALS;

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today · triage workspace</div>
          <h1 className="page-title">Signal inbox</h1>
          <div className="page-sub">{counts.all} active signals · {counts.high} high · {counts.med} medium · {counts.low} low. Open any signal to action, archive, or generate a brief.</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <ProvenanceChip provenance={liveSignals.provenance}
            title={liveSignals.provenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Representative data — the /state signals block is not live"} />
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
