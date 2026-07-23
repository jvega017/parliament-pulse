// Pages — all entities are clickable; store-wired

const { useState, useMemo } = React;

function csvEscape(v) {
  const text = v == null ? "" : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Takes the array to export so a live inbox exports live rows (spec 2.1). The
// only caller passes PageOverview's sourceSignals (live items or the fixture).
function exportSignalsCSV(signals) {
  const source = Array.isArray(signals) ? signals : SIGNALS;
  const headers = ["id","date","source","attention","title","link","action","confidence"];
  const rows = source.map(s => [
    s.id, s.date, s.source, s.attention || "—",
    s.title,
    s.link || "",
    s.action,
    s.confidence ?? "—",
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
    state: "Configured",
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
    state: "Configured",
  },
  {
    label: "Transport",
    title: "CORS proxy with constrained feed list",
    detail: "Local beta uses proxy-server.js. Production uses the Cloudflare Worker route documented in the repo.",
    state: "Configured",
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
    state: "Configured",
    evidence: "Six official APH RSS feeds plus chamber program and broadcast links.",
    activation: "Keep runtime feed health in Live page; add sitting-status check before claiming current chamber activity.",
    page: "live",
  },
  {
    module: "Sources",
    state: "Configured",
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
  const { state, toast, navigate } = useStore();
  const goto = navigate;
  // Live signals feed the priority/rest computation and the command strip. When
  // the /state signals block is not live, sourceSignals falls back to the fixture
  // (spec 2.1); the chip below reflects which one is on screen.
  const live = useLiveState("signals");
  const sourceSignals = live.items || SIGNALS;
  // Local overview controls (F4): real state, not toast-only stubs.
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [sortByAttention, setSortByAttention] = useState(false);
  // Auto-opens once for a genuinely new visitor (no pp-onboarded key yet) and never
  // again after OnboardingGuide's dismiss path writes that key. The "How it works"
  // button still opens it manually at any time regardless of the stored key.
  const [showHelp, setShowHelp] = useState(() => !safeGetLocalStorage("pp-onboarded"));
  const priority = sourceSignals.filter(s => s.attention === "high" && !state.archived[s.id]);
  let rest = sourceSignals.filter(s => s.attention !== "high" && !state.archived[s.id]);
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
    return { type: v.type || "Executive Brief", for: label, ts: v.ts };
  }).sort((a, b) => b.ts - a.ts).slice(0, 4);

  const generateDailyBrief = () => {
    const today = new Date().toLocaleDateString("en-AU", { day:"numeric", month:"long", year:"numeric" });
    // A live APH title is emitted as a markdown link to its source; a fixture title
    // stays plain text; a live title with no valid link falls back to the source label.
    const briefTitleMd = (brief) => brief.isLive ? (brief.link ? `[${brief.title}](${brief.link})` : brief.meta.source) : brief.title;
    const prioritySections = priority.length === 0 ? ["None."] : priority.map(s => {
      const brief = buildBriefSections(s, !!s.isLive);
      return [
        `### ${brief.meta.id} - ${briefTitleMd(brief)}`,
        `Source: ${brief.meta.source} | Confidence: ${brief.meta.confidence ?? "—"}/5`,
        brief.summary,
        `**Action:** ${brief.recommendedAction.label}. ${brief.recommendedAction.reason}`,
        ``,
      ].join("\n");
    });
    const restSections = rest.length === 0 ? ["None."] : rest.map(s => {
      const brief = buildBriefSections(s, !!s.isLive);
      return `- [${brief.meta.id}] ${briefTitleMd(brief)} - ${brief.recommendedAction.label}`;
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
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">{live.items
            ? `Live signals · fetched ${fmtFetchedAt(live.fetchedAt)} AEST · verify sitting status from the Live page`
            : "Live data is unavailable · Parliament Pulse shows nothing rather than an invented signal · see the Live page for feed health"}</div>
          <h1 className="page-title">Today's signals</h1>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end"}}>
          <ProvenanceChip provenance={live.displayProvenance}
            title={live.displayProvenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Signal counts and tiles are representative; the Live page polls official RSS feeds"} />
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
          <div className="cs-stat">{committeeItemsLive.length}<span className="unit">items</span></div>
          <div className="stat-meta">{committeeHearingCount} hearing{committeeHearingCount !== 1 ? "s" : ""} · {committeeInquiryCount} inquir{committeeInquiryCount !== 1 ? "ies" : "y"} · {committeeReportCount} report{committeeReportCount !== 1 ? "s" : ""}</div>
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
          <span className="mono" style={{fontSize:"var(--t-label)", letterSpacing:".16em", color:"var(--ok)", fontWeight:600}}>LATEST CONFIGURED SOURCES</span>
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
              {live.status === "loading" && !live.items
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : !live.items ? (
                    <EmptyState icon="signal" kicker="Live data unavailable" variant="error">
                      Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. <a href="https://www.aph.gov.au" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Go to aph.gov.au</a>.
                    </EmptyState>
                  ) : <>
                    {priority.map(s => <SignalCard key={s.id} s={s} />)}
                    {priority.length === 0 && <EmptyState icon="check" kicker="Priority clear">All priority signals actioned.</EmptyState>}
                  </>}
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
                <span className="panel-kicker" style={{marginLeft:"auto"}}>{live.items ? `Live · fetched ${fmtFetchedAt(live.fetchedAt)} AEST` : "No live feed yet"}</span>
              </div>
              <div style={{marginBottom:12, paddingBottom:12, borderBottom:"1px solid var(--rule-2)", fontSize:12, color:"var(--ink-3)"}}>
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
                      <div className="tl-time">{s.time} · {s.source}</div>
                      <div className="tl-body">
                        {s.link
                          ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)", textDecoration:"none"}} title="Opens the source at aph.gov.au">{s.title}</a>
                          : s.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="signal" kicker="No live timeline held">
                  Parliament Pulse holds no verified live changes for this window: the /state signals block is not currently live. This timeline populates from the same feed as the Signal inbox once it connects.
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
                    <div style={{fontSize:13, fontWeight:500}}>{b.type}</div>
                    <div style={{fontSize:11.5, color:"var(--ink-3)"}}>For {b.for}</div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <span className="mono" style={{fontSize:"var(--t-label)", color:"var(--ok)", textTransform:"uppercase", letterSpacing:".12em"}}>Copied · clipboard</span>
                    <button className="btn sm ghost" title="Open the briefings queue" aria-label="Open briefings queue" onClick={() => goto && goto("briefings")}><Icon name="chevron" size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="about-data-line" style={{marginTop:"var(--gap-section)", fontSize:12.5, color:"var(--ink-3)"}}>
        Every figure here links to its source. See what is live, what is derived, and what is coming:{" "}
        <a href="#" onClick={e => { e.preventDefault(); goto && goto("about"); }} style={{color:"var(--teal)"}}>About the data</a>.
      </div>
    </div>
  );
}

// ---------- ABOUT THE DATA ----------
// Home for the beta evidence ledger, coverage matrix and provenance panels: reference
// material about what this product currently proves, moved off the landing page so
// the overview reads as a working product rather than a beta explainer.
// LB-05 (2026-07-23): the legal surface. Privacy, non-affiliation, disclaimer and
// terms, written to match what the product actually does: no accounts, no email
// collected through the site, no analytics, local-only preferences, and links to
// official sources rather than republishing them. Placed on the About page so it
// travels with the honest account of coverage.
const legalH = { fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)", margin: "14px 0 4px" };
const legalP = { margin: "0 0 6px" };
function LegalNoticePanel() {
  return (
    <div className="panel" style={{ marginTop: "var(--gap-section)" }}>
      <div className="panel-head">
        <h2 className="panel-title">Privacy, terms and disclaimer</h2>
        <span className="panel-kicker">What this is, and what it does with your data</span>
      </div>
      <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", maxWidth: 820 }}>
        <h3 style={legalH}>Independent, not affiliated</h3>
        <p style={legalP}>Parliament Pulse is an independent project by Prometheus Policy Lab. It is not affiliated with, endorsed by, or an official product of the Parliament of Australia, the Department of Parliamentary Services, or any government body. It reads publicly available RSS feeds published at aph.gov.au and links every item back to its official source.</p>

        <h3 style={legalH}>Your privacy</h3>
        <p style={legalP}>No account, login, or email is required or collected through this site. Preferences such as your reading streak and interface settings are stored only in your own browser and are never sent to us. We run no third-party analytics, advertising, or tracking. Live parliamentary data is polled from official feeds for display and is not stored on your device.</p>

        <h3 style={legalH}>Not advice</h3>
        <p style={legalP}>Parliament Pulse is derived intelligence over public sources, provided for information only. It is not legal, parliamentary, or professional advice. Scoring, clustering and watchlist matching are the product's own analysis and can contain errors. Verify against the linked official source at aph.gov.au before relying on any item.</p>

        <h3 style={legalH}>Use and content</h3>
        <p style={legalP}>The service is free and provided as-is, without warranty. Material published by the Australian Parliament remains subject to the Parliament's own copyright and terms of use; Parliament Pulse links to official sources rather than republishing them, and reproduces only brief factual descriptors with attribution. Coverage and content may change without notice.</p>

        <h3 style={legalH}>Contact and corrections</h3>
        <p style={legalP}>To report a correction or ask a question, contact Prometheus Policy Lab.{/* [CONFIRM] set the exact public contact channel (email or form) before launch. */}</p>

        <p className="mono" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 14 }}>Last updated 23 July 2026.</p>
      </div>
    </div>
  );
}
function PageAbout() {
  const { navigate, toast } = useStore();
  const goto = navigate;
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
          <div className="page-kicker">Reference</div>
          <h1 className="page-title">About the data</h1>
          <div className="page-sub">What is live, what is representative, and what activates next. Every module below states its evidence basis and links to the page that carries it.</div>
        </div>
      </div>

      <p style={{color:"var(--ink-2)", fontSize:13.5, lineHeight:1.6, maxWidth:760, marginBottom:"var(--gap-section)"}}>
        Parliament Pulse is a live beta. Six official APH RSS feeds poll on the Live page, and every
        live item links back to its source at aph.gov.au. Signal scoring, radar clustering, watchlist
        matching, QON pattern detection and the briefing queue are representative until the
        enrichment pipeline connects. This page is the honest account of that split: what you can
        already trust, and what still needs wiring.
      </p>

      <BetaReadinessPanel navigate={goto} />

      <CoverageActivationMatrix navigate={goto} copyPlan={copyActivationPlan} />

      <ProvenanceStackPanel navigate={goto} />

      <ProvenanceMetricsBand navigate={goto} />

      <LegalNoticePanel />
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

      {/* Load badge — the iframe onLoad event proves the embed loaded, not that a
          broadcast is playing; we cannot read playback state cross-origin, so this
          reports "status unverified" and never asserts LIVE. */}
      {mode === "embed" && loaded && (
        <div className="live-badge" style={{position:"absolute", top:12, left:12, zIndex:3, display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.6)", padding:"5px 10px", borderRadius:4, fontFamily:"var(--mono)", fontSize:11, color:"#fff", letterSpacing:".12em", border:"1px solid var(--line-bright)"}}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--ink-3)"}}/>
          Stream loaded · status unverified · {cfg.label.toUpperCase()}
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
          style={{position:"absolute", top:12, right:12, zIndex:3, fontFamily:"var(--mono)", fontSize:"var(--t-label)", color:"#fff", background:"rgba(0,0,0,0.55)", border:"1px solid var(--line-bright)", padding:"4px 9px", borderRadius:4, cursor:"pointer", letterSpacing:".08em"}}
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
            <div style={{fontFamily:"var(--serif)", fontSize:22, color:"var(--ink)"}}>Official broadcast · status unverified · {cfg.label}</div>
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

// Accepts a URL only when it is http(s) AND points at an aph.gov.au host (or a
// subdomain such as parlview.aph.gov.au). The licence contract requires every
// rendered live link to target the APH source, so a non-APH or malformed URL
// resolves to "" and the caller falls back to the source label, never a bare title.
function safeHttpUrl(u) {
  const url = String(u || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (host === "aph.gov.au" || host.endsWith(".aph.gov.au")) ? url : "";
  } catch {
    return "";
  }
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
              <h2 className="panel-title">Daily program</h2>
              <span className="panel-kicker">{which === "house" ? "House of Representatives" : which === "senate" ? "Senate" : "Federation Chamber"}</span>
              <a href={which === "house" ? "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" : "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents"} target="_blank" rel="noopener noreferrer" style={{marginLeft:"auto", fontSize:11.5, color:"var(--teal)", textDecoration:"none"}}>Open daily program <Icon name="ext" size={11}/></a>
            </div>
            <div className="panel-body">
              <EmptyState icon="clock" kicker="No verified daily program held">
                Parliament Pulse does not yet build a chamber-specific daily program on this page. Official House Daily Program items appear in the "Recent items · APH RSS" panel alongside this player when the feed returns them. Open the daily program above for the current official schedule.
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
                <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", paddingTop:2}}>{fmtTime(e.date)}</div>
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
                    <span style={{fontSize:"var(--t-micro)", color:"var(--teal)", fontFamily:"var(--mono)", display:"inline-flex", alignItems:"center", gap:3}}>
                      <Icon name="ext" size={10}/> {e.sourceLabel}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div className="panel-foot" style={{flexDirection:"column", alignItems:"flex-start", gap:4}}>
            <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-3)"}}>Live RSS · aph.gov.au via {isLocalHost ? "local CORS proxy (proxy-server.js)" : "Cloudflare Worker proxy"} · refreshes every 2 min</span>
            <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>Last poll: {lastPoll ? fmtTime(lastPoll) : "—"} · Click any item to open source</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- SOURCES ----------
function PageSources() {
  const { openModal, addFeed, state, toast } = useStore();
  const health = useLiveState("connectors");   // health.items is the mapped checks array
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState(null);
  const [newUrl, setNewUrl] = useState("https://www.aph.gov.au/.../FlagPost/Blog_entries");
  const [newName, setNewName] = useState("FlagPost Blog (HTML)");
  const startTest = () => {
    setTesting(true); setTestState(null);
    // Simulated only: no network request is made. The lines below illustrate the
    // steps a real backend validator would run; they never report an actual result.
    setTimeout(() => setTestState({
      status: "warn",
      simulated: true,
      lines: [
        { t: "warn", s: "Simulated example only · no request was sent to this URL" },
        { t: "ok", s: "A real check would confirm the URL resolves · 200 OK" },
        { t: "ok", s: "A real check would inspect Content-Type for XML or HTML" },
        { t: "warn", s: "A real check would detect an <rss> root or attempt an HTML parse" },
        { t: "ok", s: "A real check would count dated entries and extractable links" },
        { t: "warn", s: "A real check would verify the latest item date and cadence" },
        { t: "warn", s: "Mark as Needs validation before routing to modules" },
      ],
    }), 1100);
  };
  const saveFeed = () => {
    if (!newName.trim()) return;
    addFeed({ id: "custom-"+Date.now(), name: newName.trim(), url: newUrl, status:"review", group:"Custom" });
    setTestState(null);
  };

  // Custom saved feeds are never polled: liveFeedList() (the Live page poller) reads
  // only SOURCE_REGISTRY, so a feed saved here never fetches. "Not polled" replaces
  // any invented "just now" freshness claim so the row cannot be mistaken for a
  // monitored feed.
  const allFeeds = [...APH_FEEDS, ...state.feeds.map(f => ({ ...f, last:"Not polled", today:0, fpr:"—", modules:["Custom"], parser:"Needs validation", authority:"Custom", confidence:"—" }))];

  // Feed-health from the Worker's connector checks, joined to the registry by url.
  const checkByUrl = new Map((health.items || []).map(c => [c.url, c]));
  const registryUrls = new Set((typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : []).map(r => r.url));
  // Real endpoints the Worker health-checks that the frontend does not poll directly
  // (11 checks vs 6 registry rows). Counted from data, never hardcoded.
  const workerRows = (health.items || []).filter(c => !registryUrls.has(c.url));
  const healthyCount = (health.items || []).filter(c => c.ok).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Admin</div>
          <h1 className="page-title">Sources</h1>
          <div className="page-sub">Official APH feed register{health.items ? " with live health checks from the Worker" : "; feed health appears once the Worker check runs"}. Custom-feed validation remains a prototype workflow.</div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <button className="btn" title="Re-polls the live RSS feeds if the Live page poller is mounted" onClick={() => { if (typeof window.__refreshLiveFeeds === "function") { window.__refreshLiveFeeds(); toast("Live feeds re-polled"); } else { toast("Open the Live page to start the feed poller"); } }}><Icon name="refresh" size={13}/> Refresh all</button>
          <button className="btn primary" onClick={() => document.getElementById("new-feed-url")?.focus()}><Icon name="plus" size={13}/> Add feed</button>
        </div>
      </div>

      <div className="grid g-4" style={{marginBottom:18}}>
        <div className="panel stat"><div className="stat-label">Active feeds</div><div className="stat-value">{sourceCounts().total}</div><div className="stat-meta">{health.items ? "Official feeds configured · " + health.items.length + " endpoints health-checked" : "Official APH feeds configured"}</div></div>
        <div className="panel stat"><div className="stat-label">Healthy</div>
          {health.items
            ? <><div className="stat-value">{healthyCount}/{health.items.length}</div><div className="stat-meta">as at {fmtFetchedAt(health.fetchedAt)} AEST</div></>
            : <><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after live poll</div></>}
        </div>
        <div className="panel stat"><div className="stat-label">Items ingested · today</div><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after live poll</div></div>
        <div className="panel stat"><div className="stat-label">False positive rate</div><div className="stat-value" style={{fontSize:18, color:"var(--ink-3)"}}>—</div><div className="stat-meta">Available after 30 days' operation</div></div>
      </div>

      <div className="grid g-overview">
        {health.status === "loading" && !health.items ? <SkeletonTable rows={6} /> : (
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Official APH Feed Bundle</h2>
            <span className="panel-kicker">{sourceCounts().total} official feeds configured · click a row for detail</span>
            <ProvenanceChip provenance={health.displayProvenance}
              title={health.displayProvenance === "live" ? "Feed health from the Worker's connector checks" : "Health appears after the Worker check runs"} />
          </div>
          {health.status === "error" && !health.items && (
            <div className="panel-body">
              <EmptyState icon="sources" kicker="Feed status unavailable" variant="error">
                The status service did not respond. Direct links to each official APH feed remain available below.
              </EmptyState>
            </div>
          )}
          <div className="table-scroll">
          <table className="ds">
            <thead><tr>
              <th>Source</th><th>Group</th><th>Status</th><th>Last</th>
              <th className="num">Today</th><th>FPR</th><th>Parser</th>
            </tr></thead>
            <tbody>
              {allFeeds.map(f => {
                const c = checkByUrl.get(f.url);
                return (
                <tr key={f.id} onClick={() => f.group !== "Custom" && openModal("feed", f.id)}>
                  <td>
                    <div style={{fontWeight:500}}>{f.name}</div>
                    <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{f.url.length > 56 ? f.url.slice(0,56)+"…" : f.url}</div>
                  </td>
                  <td><span className="tag">{f.group}</span></td>
                  <td style={c && !c.ok ? {color:"var(--escalate)"} : undefined}>
                    {f.group === "Custom"
                      ? <span style={{color:"var(--ink-4)", fontStyle:"italic"}} title="Saved feeds are not polled by the live feed poller">Not polled</span>
                      : (c
                        ? (c.ok ? "Live" : `Error ${c.httpStatus ?? ""}`.trim())
                        : (f.lastStatusCode != null ? (f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error") : "—"))}
                  </td>
                  <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{c ? fmtFetchedAt(c.checkedAt) : (f.last || "—")}</td>
                  <td className="num">{f.lastItemCount ?? "—"}</td>
                  <td><span className="tag">{f.fpr}</span></td>
                  <td>{f.parser || "—"}</td>
                </tr>
                );
              })}
              {workerRows.map(c => (
                <tr key={c.url}>
                  <td>
                    <div style={{fontWeight:500}}>{c.label}</div>
                    <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{c.url.length > 56 ? c.url.slice(0,56)+"…" : c.url}</div>
                  </td>
                  <td><span className="tag">{c.group}</span></td>
                  <td style={!c.ok ? {color:"var(--escalate)"} : undefined}>{c.ok ? "Live" : `Error ${c.httpStatus ?? ""}`.trim()}</td>
                  <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{fmtFetchedAt(c.checkedAt)}</td>
                  <td className="num">—</td>
                  <td><span className="tag">—</span></td>
                  <td>Worker-monitored</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        )}

        <div>
          <div className="panel" style={{marginBottom:16}}>
            <div className="panel-head">
              <h2 className="panel-title">Add RSS feed</h2>
              <span className="panel-kicker">Name, URL, validate, save</span>
            </div>
            <div className="panel-body">
              <label htmlFor="new-feed-name" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Display name</label>
              <input id="new-feed-name" value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"8px 10px", marginTop:4, marginBottom:8, width:"100%"}}/>
              <label htmlFor="new-feed-url" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Paste RSS URL</label>
              <div style={{display:"flex", gap:8, marginTop:4}}>
                <input id="new-feed-url" value={newUrl} onChange={e=>setNewUrl(e.target.value)} className="search" style={{flex:1, padding:"8px 10px"}}/>
                <button className="btn primary" onClick={startTest}>{testing && !testState ? "Testing…" : "Validate"}</button>
              </div>

              {testState && (
                <div className="feed-test" style={{marginTop:14}}>
                  <div style={{marginBottom:6, letterSpacing:".1em", display:"flex", alignItems:"center", gap:7}} className="warn"><Icon name="flag" size={12} /> Simulated example · parser needs validation</div>
                  <div style={{fontSize:11, color:"var(--ink-4)", marginBottom:8}}>This preview is illustrative. No network request was made and no result was verified. Connect backend validation before treating any feed as checked.</div>
                  {testState.lines.map((l, i) => (
                    <div key={i} className={"feed-test-line " + l.t}>
                      <Icon name={l.t === "ok" ? "check" : l.t === "warn" ? "flag" : "close"} size={12} />
                      <span>{l.s}</span>
                    </div>
                  ))}
                  <button className="btn primary sm" style={{marginTop:10}} onClick={saveFeed}>Save as unvalidated feed</button>
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

// Shared additive live strip (Committees, Daily program). Every live title renders
// ONLY inside an anchor to its APH link (licence contract, spec section 4.1); the
// product's own metadata (kind, feed label, date) renders as ordinary content around
// it. Filtered lists pass items already narrowed by verified feed_label.
function LiveFeedStrip({ title, items, fetchedAt, emptyText }) {
  // Data-gate the whole strip: with no live items there is no live surface, so the
  // panel and its Live chip do not render at all (a Live chip must never sit over an
  // empty match). The desk's representative content stands on its own.
  if (!items || items.length === 0) return null;
  return (
    <div className="panel" style={{marginBottom:16}}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        <ProvenanceChip provenance="live" title="Live items from the Worker's composed /state feed" />
        <span className="panel-kicker" style={{marginLeft:"auto"}}>fetched {fmtFetchedAt(fetchedAt)} AEST</span>
      </div>
      <div className="panel-body">
        {items.length === 0
          ? <div className="empty">{emptyText}</div>
          : items.map((s, i) => (
            <div key={s.id || i} className="data-row" style={{display:"grid", gap:6, padding:"10px 0", borderBottom: i<items.length-1 ? "1px solid var(--line)" : 0}}>
              {/* Licence rule: the live APH title renders only inside an anchor to its
                  APH link; with no valid link it falls back to the source label. */}
              {s.link
                ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex", alignItems:"center", gap:6, color:"var(--teal)", textDecoration:"none", fontSize:13, fontWeight:500}} title="Opens the source at aph.gov.au">
                    {s.title} <Icon name="ext" size={11}/>
                  </a>
                : <span style={{fontSize:13, fontWeight:500, color:"var(--ink-2)"}}>{s.source}</span>}
              <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
                <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{(s.tags && s.tags[0] && s.tags[0].l) || "item"}</span>
                <span style={{fontSize:11.5, color:"var(--ink-3)"}}>{s.source}</span>
                <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{s.date}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------- SITTING-DAY HONESTY HELPERS ----------
// Verified from the PM&C parliamentary sitting calendar for 2026 (issued 26
// November 2025): July carries no sittings; Parliament next sits 11-13 and
// 17-20 August 2026. Every sitting-day desk below (daily program, divisions,
// hearings) shares this one return date so it can never drift out of sync
// across panels.
const NEXT_SITTING_DATE = "11 August 2026";

// Shared honest-empty copy for a sitting-day feed that has returned zero items.
// `chamber` reads naturally into "{chamber} is not sitting."; `feedNoun` reads
// into "{feedNoun} resume when Parliament returns on {date}."
function recessEmptyText(chamber, feedNoun, url, linkLabel) {
  return (
    <>
      {chamber} is not sitting. {feedNoun} resume when Parliament returns on {NEXT_SITTING_DATE}.{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>{linkLabel} <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
    </>
  );
}

// One live signal row, shared by every sitting-day list below: the title renders
// only inside its APH anchor (licence rule), with the feed label and date around
// it as the product's own metadata.
function LiveSignalRow({ s, isLast }) {
  return (
    <div className="data-row" style={{padding:"10px 0", borderBottom: isLast ? 0 : "1px solid var(--line)"}}>
      {s.link
        ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)", textDecoration:"none", fontSize:13, fontWeight:500}} title="Opens the source at aph.gov.au">{s.title} <Icon name="ext" size={11}/></a>
        : <span style={{fontSize:13, fontWeight:500, color:"var(--ink-2)"}}>{s.source}</span>}
      <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginTop:4}}>
        <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{s.source}</span>
        <span className="mono" style={{fontSize:11, color:"var(--ink-4)"}}>{s.date}</span>
      </div>
    </div>
  );
}

// Renders a filtered live-signal list with the shared three-state honesty
// contract: the live block itself unavailable (outage, not recess), the block
// live but this filter empty (recess-aware empty text supplied by the caller),
// or real rows. Used by every sitting-day panel below so the "outage vs
// genuinely nothing scheduled" distinction never gets blurred into one message.
function SittingDeskList({ rows, unavailableText, emptyIcon = "clock", emptyKicker, emptyBody }) {
  if (rows === null) {
    return (
      <EmptyState icon={emptyIcon} kicker="Live data unavailable" variant="error">
        {unavailableText}
      </EmptyState>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon} kicker={emptyKicker}>{emptyBody}</EmptyState>;
  }
  return <>{rows.map((s, i) => <LiveSignalRow key={s.id || i} s={s} isLast={i === rows.length - 1} />)}</>;
}

// Related House divisions, shared by the Bills register and the Daily program
// page. Filters the live signals block by the Worker's REAL feed_label, "House
// divisions" (verified against workers/aph-proxy/src/jurisdictions.json and a
// live /state probe, 2026-07-22) — the previous filter here compared against
// "House Divisions" (title case), which never matched a real row and silently
// hid genuinely live division items behind an empty state every single poll.
function DivisionsLiveList() {
  const live = useLiveState("signals");
  const rows = live.items ? live.items.filter(s => s.source === "House divisions") : null;
  return (
    <SittingDeskList
      rows={rows} emptyIcon="flag"
      unavailableText={<>Parliament Pulse holds no verified division results right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open division results on aph.gov.au</a>.</>}
      emptyKicker="No verified divisions held"
      emptyBody={recessEmptyText("The House", "Divisions", "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", "Open division results on aph.gov.au")}
    />
  );
}

// Today's House, joint and Senate committee hearings — two real Worker feeds
// ("Today's House and joint hearings", "Today's Senate hearings") that return an
// empty channel while the relevant chamber is not sitting.
function TodaysHearingsPanel() {
  const live = useLiveState("signals");
  const HEARING_LABELS = new Set(["Today's House and joint hearings", "Today's Senate hearings"]);
  const rows = live.items ? live.items.filter(s => HEARING_LABELS.has(s.source)) : null;
  return (
    <div className="panel" style={{marginTop:16}}>
      <div className="panel-head"><h2 className="panel-title">Today's hearings</h2><span className="panel-kicker">House, joint & Senate</span></div>
      <div className="panel-body">
        <SittingDeskList
          rows={rows} emptyIcon="clock"
          unavailableText={<>Parliament Pulse holds no verified hearing schedule right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open committee hearings on aph.gov.au</a>.</>}
          emptyKicker="No verified hearings held"
          emptyBody={recessEmptyText("Parliament", "Hearings", "https://www.aph.gov.au/Parliamentary_Business/Committees", "Open committee hearings on aph.gov.au")}
        />
      </div>
    </div>
  );
}

// ---------- COMMITTEES ----------
// Every feed_label set below is the Worker's REAL value (verified against
// workers/aph-proxy/src/jurisdictions.json and a live /state probe, 2026-07-22).
// The previous version of this page compared against title-case labels
// ("Senate Committee Reports Tabled", "Senate New Inquiries", "Senate Upcoming
// Hearings") that never matched an actual feed_label, so the live strip below
// silently rendered nothing every poll despite the Senate feeds carrying real
// items throughout. House and joint committee inquiries were never added at
// all, despite being live in the signals block the whole time.
const COMMITTEE_STRIP_LABELS = new Set([
  "Senate reports tabled", "New Senate inquiries", "Upcoming Senate hearings",
  "House committee inquiries", "Joint committee inquiries",
]);
const COMMITTEE_RECENT_LABELS = new Set([
  "Senate reports tabled", "New Senate inquiries", "House committee inquiries", "Joint committee inquiries",
]);

function PageCommittees() {
  const liveSignalsState = useLiveState("signals");
  const items = liveSignalsState.items;
  const committeeLive = items ? items.filter(s => COMMITTEE_STRIP_LABELS.has(s.source)) : null;
  const upcomingHearings = items ? items.filter(s => s.source === "Upcoming Senate hearings") : null;
  const recentItems = items ? items.filter(s => COMMITTEE_RECENT_LABELS.has(s.source)) : null;
  const { toast } = useStore();

  const exportPrepPack = () => {
    const rows = recentItems || [];
    if (rows.length === 0) { toast("No live committee items to export yet", "error"); return; }
    exportRowsCSV(
      ["date", "feed", "title", "link"],
      rows.map(r => [r.date, r.source, r.title, r.link || ""]),
      `parliament-pulse-committee-prep-${new Date().toISOString().slice(0,10)}.csv`,
    );
    toast("Committee prep pack exported", "brass");
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Committees</h1>
          <div className="page-sub">Live from the Worker's composed signal feed: Senate, House and joint committee reports, inquiries and hearings.</div>
        </div>
        <button className="btn ghost" title="Export the current live committee rows" onClick={exportPrepPack}><Icon name="brief" size={13}/> Export prep pack</button>
      </div>

      {committeeLive && committeeLive.length > 0 && (
        <LiveFeedStrip title="Latest committee activity · live feed" items={committeeLive} fetchedAt={liveSignalsState.fetchedAt}
          emptyText="No committee items in the current live window." />
      )}

      <div className="grid g-3" style={{marginBottom:18}}>
        <div className="panel stat"><div className="stat-label">Upcoming Senate hearings</div><div className="stat-value">{(upcomingHearings || []).length}</div></div>
        <div className="panel stat"><div className="stat-label">Reports & inquiries · live</div><div className="stat-value">{(recentItems || []).length}</div></div>
        <div className="panel stat"><div className="stat-label">Official committee feeds</div><div className="stat-value">{COMMITTEE_STRIP_LABELS.size}<span className="unit">tracked</span></div></div>
      </div>

      <TodaysHearingsPanel />

      <div className="grid g-2">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Upcoming Senate hearings</h2><span className="panel-kicker">Live feed</span></div>
          <div className="panel-body">
            <SittingDeskList
              rows={upcomingHearings} emptyIcon="signal"
              unavailableText={<>Parliament Pulse holds no verified upcoming Senate hearings right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open committee hearings on aph.gov.au</a>.</>}
              emptyKicker="No verified upcoming hearings held"
              emptyBody={<>Parliament Pulse holds no verified upcoming Senate hearings in the current live window. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open committee hearings on aph.gov.au</a>.</>}
            />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Recently tabled & opened</h2><span className="panel-kicker">Live feed</span></div>
          <div className="panel-body">
            <SittingDeskList
              rows={recentItems} emptyIcon="signal"
              unavailableText={<>Parliament Pulse holds no verified committee reports or inquiries right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open committee reports on aph.gov.au</a>.</>}
              emptyKicker="No verified reports or inquiries held"
              emptyBody={<>Parliament Pulse holds no verified committee reports or inquiries in the current live window. <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open committee reports on aph.gov.au</a>.</>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- BILLS ----------
function PageBills() {
  const live = useLiveBills();
  const bills = live.items; // null = nothing has ever loaded; array (maybe empty) once live

  const fmtBillDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return "—"; }
  };

  const exportBills = () => {
    const headers = ["title", "published", "attention", "confidence", "link"];
    const rows = (bills || []).map(b => [b.title, b.pub_date || "", b.attention ?? "—", b.confidence ?? "—", b.link || ""]);
    exportRowsCSV(headers, rows, `parliament-pulse-bills-${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Bills Intelligence</div>
          <h1 className="page-title">Bills intelligence</h1>
          <div className="page-sub">Live from the Worker's /bills endpoint. Each title links to its official ParlInfo record; attention and confidence are Parliament Pulse's own scoring.</div>
        </div>
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          {bills && <ProvenanceChip provenance="live" title="Rows from the Worker's /bills endpoint" />}
          <button className="btn" disabled={!bills || bills.length === 0} onClick={exportBills}><Icon name="download" size={13}/> Export register</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Tracked bills</h2>
          <span className="panel-kicker">{bills ? `${bills.length} bill${bills.length !== 1 ? "s" : ""} · fetched ${fmtFetchedAt(live.fetchedAt)} AEST` : (live.status === "loading" ? "Loading…" : "—")}</span>
        </div>
        {live.status === "loading" && !bills ? <SkeletonTable rows={6} /> : !bills ? (
          <div className="panel-body">
            <EmptyState icon="bill" kicker="Live data unavailable" variant="error">
              Parliament Pulse could not reach the Worker's /bills endpoint just now, so nothing renders rather than an invented bill list. <a href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open Bills Legislation on aph.gov.au</a>.
            </EmptyState>
          </div>
        ) : bills.length === 0 ? (
          <div className="panel-body">
            <EmptyState icon="bill" kicker="No bills returned">
              The live /bills endpoint returned no rows just now. <a href="https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open Bills Legislation on aph.gov.au</a>.
            </EmptyState>
          </div>
        ) : (
          <div className="table-scroll">
          <table className="ds">
            <thead><tr>
              <th>Title</th><th>Published</th><th>Attention</th><th>Confidence</th>
            </tr></thead>
            <tbody>
              {bills.map(b => {
                const link = safeHttpUrl(b.link);
                return (
                  <tr key={b.guid}>
                    <td style={{fontWeight:500}}>
                      {link
                        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)", textDecoration:"none"}} title="Opens the source at aph.gov.au">{b.title} <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>
                        : b.title}
                      {/* description is null on every row today: render nothing rather
                          than an empty element, and never invent a summary. */}
                      {b.description && <div style={{fontSize:12, color:"var(--ink-3)", marginTop:2}}>{b.description}</div>}
                    </td>
                    <td className="mono" style={{fontSize:11.5, color:"var(--ink-3)"}}>{fmtBillDate(b.pub_date)}</td>
                    <td><Att level={b.attention} /></td>
                    <td>{b.confidence != null ? <Conf n={b.confidence} /> : <span className="mono" style={{color:"var(--ink-4)"}}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="panel" style={{marginTop:16}}>
        <div className="panel-head"><h2 className="panel-title">Related divisions</h2><span className="panel-kicker">House</span></div>
        <div className="panel-body">
          <DivisionsLiveList />
        </div>
      </div>
    </div>
  );
}

// ---------- PARLIAMENT ----------
function PageParliament() {
  const live = useLiveState("signals");
  // Chamber feeds matched against signal.source (the feed_label). Casing here is
  // the Worker's REAL value (verified against workers/aph-proxy/src/jurisdictions.json
  // and a live /state probe, 2026-07-22) — the previous filters here compared
  // against "House Daily Program" / "House Divisions" (title case), which never
  // matched a real row, so both strips silently rendered nothing on every poll
  // regardless of whether the House was sitting.
  const dailyProgramLive = live.items ? live.items.filter(s => s.source === "House daily program") : null;
  const divisionsLive = live.items ? live.items.filter(s => s.source === "House divisions") : null;
  const newsLive = live.items ? live.items.filter(s => s.source === "House news" || s.source === "House media releases") : null;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament</div>
          <h1 className="page-title">Today in Parliament</h1>
          <div className="page-sub">Daily program, divisions, hearings and House news from official APH feeds.</div>
        </div>
      </div>

      <div className="grid g-overview">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">House · daily program</h2></div>
          <div className="panel-body">
            <SittingDeskList
              rows={dailyProgramLive} emptyIcon="clock"
              unavailableText={<>Parliament Pulse holds no verified daily program right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open the House daily program on aph.gov.au</a>.</>}
              emptyKicker="No verified daily program held"
              emptyBody={recessEmptyText("The House", "The daily program", "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", "Open the House daily program on aph.gov.au")}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Recent divisions</h2><span className="panel-kicker">House</span></div>
          <div className="panel-body">
            <DivisionsLiveList />
          </div>
        </div>
      </div>

      <TodaysHearingsPanel />

      <div className="grid g-2" style={{marginTop:16}}>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">House news & media</h2></div>
          <div className="panel-body">
            <SittingDeskList
              rows={newsLive} emptyIcon="signal"
              unavailableText={<>Parliament Pulse holds no verified House news right now because the live signal feed is unavailable. <a href="https://www.aph.gov.au/house/rss/house_news" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open House news on aph.gov.au</a>.</>}
              emptyKicker="No verified items held"
              emptyBody={<>Parliament Pulse holds no verified House news or media releases in the current live window. <a href="https://www.aph.gov.au/house/rss/house_news" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open House news on aph.gov.au</a>.</>}
            />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Parliamentary lines</h2><span className="chip-fixture" style={{marginLeft:"auto"}}>Representative data</span></div>
          <div className="panel-body">
            <div style={{padding:12, border:"1px dashed var(--line-2)", borderRadius:8, fontSize:13, color:"var(--ink-3)", lineHeight:1.6, fontStyle:"italic"}}>
              <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8, fontStyle:"normal"}}>No lines drafted yet</div>
              Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- PATTERNS ----------
// Format a thread span date (day + month) from an ISO timestamp.
function fmtSpanDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }); }
  catch { return "—"; }
}

// One live thread row. The product-owned facts (item count, first/last seen) lead;
// the thread title is a quoted identifier with no anchor of its own (threads carry no
// link field; spec 4.3). Expanding lists member signals, each anchored to its APH link.
function ThreadRow({ t, byGuid, isLast }) {
  const [open, setOpen] = useState(false);
  const resolved = t.signalGuids.map(g => byGuid.get(g)).filter(Boolean);
  const unresolved = t.signalGuids.length - resolved.length;
  return (
    <div style={{padding:"12px 0", borderBottom: isLast ? 0 : "1px solid var(--line)"}}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        style={{display:"flex", alignItems:"center", gap:12, width:"100%", background:"none", border:"none", padding:0, cursor:"pointer", textAlign:"left", color:"inherit"}}>
        <Icon name="chevron" size={13} style={{transform: open ? "rotate(90deg)" : "none", transition:"transform .15s"}}/>
        <span style={{fontSize:13.5, fontWeight:600, color:"var(--ink)"}}>{t.itemCount} items</span>
        <span className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{fmtSpanDate(t.firstSeenAt)} → {fmtSpanDate(t.lastSeenAt)}</span>
        {/* The thread title is the product's own clustering label, not APH-sourced
            prose. It is framed with a "Cluster" tag so it reads unambiguously as the
            product's analysis (threads carry no link; spec 4.3). */}
        <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".1em", marginLeft:4}}>Cluster</span>
        <span className="mono" style={{color:"var(--ink-2)", fontSize:12.5}}>{t.title}</span>
      </button>
      {open && (
        <div style={{marginTop:10, marginLeft:25, display:"grid", gap:8}}>
          {resolved.map((s, i) => (
            <div key={s.id || i} style={{display:"grid", gap:4}}>
              {/* Licence rule: the live APH title renders only inside an anchor to a
                  valid APH link; with no link it falls back to the source label,
                  never a bare title inside a "#" anchor. */}
              {s.link
                ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex", alignItems:"center", gap:6, color:"var(--teal)", textDecoration:"none", fontSize:12.5, fontWeight:500}} title="Opens the source at aph.gov.au">
                    {s.title} <Icon name="ext" size={11}/>
                  </a>
                : <span style={{fontSize:12.5, fontWeight:500, color:"var(--ink-2)"}}>{s.source}</span>}
              <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
                <span className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{(s.tags && s.tags[0] && s.tags[0].l) || "item"}</span>
                <span style={{fontSize:11, color:"var(--ink-3)"}}>{s.source}</span>
                <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>{s.date}</span>
              </div>
            </div>
          ))}
          {unresolved > 0 && (
            <div className="mono" style={{fontSize:11, color:"var(--ink-4)"}}>{unresolved} further item{unresolved !== 1 ? "s" : ""} in the archive</div>
          )}
        </div>
      )}
    </div>
  );
}

function PagePatterns() {
  const { openModal, toast } = useStore();
  const threads = useLiveState("threads");
  const signalsLive = useLiveState("signals");
  const byGuid = React.useMemo(() => new Map((signalsLive.items || []).map(s => [s.id, s])), [signalsLive.items]);
  const [clusterStatus, setClusterStatus] = useState("Needs analyst review");
  // Defensive against the QON fixture being emptied (or reshaped) upstream: never
  // assume .items exists, and derive every displayed number directly from it so a
  // stale hardcoded count can never outlive the data it once described.
  const qonItems = (QON_PATTERN && Array.isArray(QON_PATTERN.items)) ? QON_PATTERN.items : [];
  const qonMemberCount = new Set(qonItems.map(q => q.memberId || q.who).filter(Boolean)).size;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Scrutiny</div>
          <h1 className="page-title">QON pattern engine</h1>
          <div className="page-sub">Detects clustered scrutiny across members, topics and targets. Click any member to open their profile.</div>
        </div>
      </div>

      {threads.items && (
        <div className="panel" style={{marginBottom:16}}>
          <div className="panel-head">
            <h2 className="panel-title">Signal threads · cluster analysis</h2>
            <ProvenanceChip provenance={threads.displayProvenance} title="The Worker's own clustering of live signals (derived analysis)" />
            <span className="panel-kicker" style={{marginLeft:"auto"}}>{threads.items.length} threads · fetched {fmtFetchedAt(threads.fetchedAt)} AEST</span>
          </div>
          <div className="panel-body">
            {threads.items.length === 0
              ? <EmptyState icon="pattern" kicker="No threads">Thread detection groups related signals as they accumulate. Nothing has clustered yet.</EmptyState>
              : threads.items.map((t, i) => (
                <ThreadRow key={t.id || i} t={t} byGuid={byGuid} isLast={i === threads.items.length - 1} />
              ))}
          </div>
        </div>
      )}

      <div style={{padding:"10px 14px", background:"var(--panel-hi)", border:"1px solid var(--line-bright)", borderRadius:8, marginBottom:16, display:"flex", gap:10, alignItems:"center", color:"var(--ink-2)", fontSize:12.5}}>
        <Icon name="flag" size={14} stroke="var(--info)"/>
        <span><strong>QON feed not connected</strong>: the ParlInfo search endpoint returns 403 to automated access. {threads.items ? "Thread clustering above is live from the archive. " : ""}{qonItems.length > 0 ? "The scrutiny pattern below uses representative sample data." : "No scrutiny pattern is held below until the feed connects."}</span>
      </div>

      {qonItems.length > 0 ? (
      <div className="pattern">
        <div className="ribbon">Clustered pattern · moderate confidence</div>
        <div className="serif" style={{fontSize:22, fontWeight:500, marginBottom:6, paddingRight:200}}>Clustered scrutiny pattern{QON_PATTERN.topic ? ` on ${QON_PATTERN.topic}` : ""}</div>
        {QON_PATTERN.trigger && (
          <div style={{color:"var(--ink-2)", fontSize:13.5, maxWidth:720}}>
            {qonItems.length} related question{qonItems.length !== 1 ? "s" : ""} lodged by {qonMemberCount} member{qonMemberCount !== 1 ? "s" : ""}{QON_PATTERN.window ? ` within ${QON_PATTERN.window}` : ""}. Trigger likely: {QON_PATTERN.trigger}.
          </div>
        )}

        <div className="grid g-4" style={{marginTop:16, marginBottom:18}}>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Members</div><div style={{fontSize:18, marginTop:4}}>{qonMemberCount}</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Questions</div><div style={{fontSize:18, marginTop:4}}>{qonItems.length}</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Window</div><div style={{fontSize:18, marginTop:4}}>{QON_PATTERN.window || "—"}</div></div>
          <div><div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Target</div><div style={{fontSize:13, marginTop:4, lineHeight:1.25}}>{QON_PATTERN.target || "—"}</div></div>
        </div>

        <div style={{borderTop:"1px dashed var(--line-2)", paddingTop:14}}>
          <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:8}}>Evidence · click member for profile</div>
          {qonItems.map((q,i) => {
            const mid = q.memberId;
            const canOpen = !!(mid && ENTITIES.members[mid]);
            return (
              <div key={q.when + q.who} className="g-qon-evidence" style={{display:"grid", gap:12, padding:"8px 0", borderBottom: i<qonItems.length-1 ? "1px solid var(--line)" : 0, alignItems:"start", fontSize:12.5}}>
                <div className="mono" style={{color:"var(--ink-3)"}}>{q.when}</div>
                <div><span className={"tag brass" + (canOpen ? " clk" : "")} onClick={canOpen ? () => openModal("member", mid) : undefined} style={canOpen ? undefined : {opacity:.65, cursor:"not-allowed"}}>{q.who}</span></div>
                <div style={{color:"var(--ink-2)"}}>{q.q}</div>
                <div style={{textAlign:"right"}}><span className="tag">{q.chamber}</span></div>
              </div>
            );
          })}
        </div>

        <div style={{display:"flex", gap:10, marginTop:16, flexWrap:"wrap"}}>
          <button className="btn" title="Copy an Estimates monitor note" onClick={() => copyText(`# Estimates monitor note\nGenerated: ${new Date().toISOString()}\n\nPattern: ${QON_PATTERN.topic || "Unknown"}\nStatus: ${clusterStatus}\n\nRecommended action: monitor for Estimates references and verify against Hansard or QON source material.`, toast, "Estimates monitor note copied")}><Icon name="brief" size={13}/> Draft Estimates monitor note</button>
          <button className="btn" title="Mark this cluster as tracked in this session" onClick={() => { setClusterStatus("Tracked"); toast("Cluster marked as tracked", "brass"); }}><Icon name="watch" size={13}/> Track cluster</button>
          <button className="btn" title="Confirm the analyst classification for this session" onClick={() => { setClusterStatus("Confirmed as coordinated"); toast("Cluster confirmed for review", "brass"); }}><Icon name="check" size={13}/> Confirm as coordinated</button>
          <button className="btn ghost" title="Classify the cluster as coincidence in this session" onClick={() => { setClusterStatus("Marked as coincidence"); toast("Cluster marked as coincidence"); }}>Mark as coincidence</button>
        </div>
        <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-3)", marginTop:8, letterSpacing:".08em"}}>Session status: {clusterStatus}</div>
      </div>
      ) : (
      <div className="panel">
        <div className="panel-head"><h2 className="panel-title">Clustered scrutiny pattern</h2></div>
        <div className="panel-body">
          <EmptyState icon="pattern" kicker="No verified scrutiny cluster held">
            Parliament Pulse holds no verified Questions on Notice to detect a scrutiny cluster from, because the ParlInfo search endpoint returns 403 to automated access. <a href="https://www.aph.gov.au/Parliamentary_Business/Senate_estimates" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Open Senate Estimates on aph.gov.au</a> to look them up directly.
          </EmptyState>
        </div>
      </div>
      )}

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
  // Local, honest "Mark reviewed" state: page-session state only, since store.jsx sits
  // outside this file's edit scope. It genuinely changes what the queue displays the
  // moment a brief is marked, where the previous control only fired a toast and left
  // the brief's status untouched.
  const [reviewedIds, setReviewedIds] = useState({});
  const { toast, state, setSignalSearchQuery, navigate } = useStore();
  // A generated brief may reference a live signal, so resolve sids against both the
  // fixture and the live inbox (spec 2.5).
  const live = useLiveState("signals");
  const known = live.items ? [...SIGNALS, ...live.items] : SIGNALS;

  // The queue is the user's own generated briefs only (state.briefsGenerated). The
  // previous four static "Example" rows always rendered the identical hardcoded
  // procurement-inquiry preview regardless of which row was selected, so they have
  // been deleted entirely, per the honest-empty-state rule (spec: a clean empty state
  // beats keeping something that looks richer).
  const briefs = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = known.find(s => s.id === sid);
    // F11: fix the "For undefined" label — precedence bug. Use an explicit ternary.
    // A live signal's queue label uses its source, never the raw APH title as
    // standalone product prose; fixture briefs keep their title label.
    const label = sig ? (sig.isLive ? sig.source : (sig.title.slice(0, 40) + "…")) : sid;
    return { type: v.type || "Executive Brief", for: label, status: "Copied · clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts);
  const briefId = (b) => b._sid;
  const selected = briefs.find(b => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Briefings</h1>
          <div className="page-sub">Briefs you generate from a signal appear here with their evidence links: What happened · Source · Why it matters · Recommended action · Evidence · Provenance.</div>
        </div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}>
          <button className="btn" disabled={briefs.length === 0} onClick={() => downloadBriefingQueue(briefs, toast)}><Icon name="download" size={13}/> Export queue</button>
          <button className="btn primary" title="Open signals to generate a brief" onClick={() => { setSignalSearchQuery(""); navigate("signals"); }}><Icon name="plus" size={13}/> New brief</button>
        </div>
      </div>

      <div className="grid g-briefings" style={{gap:16}}>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">Queue</h2><span className="panel-kicker">{briefs.length} generated</span></div>
          <div>
            {briefs.length === 0 ? (
              <EmptyState icon="brief" kicker="No briefs yet">Open any signal and choose Generate brief. Your briefs appear here with their evidence links.</EmptyState>
            ) : briefs.map((b, i) => {
              const id = briefId(b);
              const status = reviewedIds[id] ? "Reviewed" : b.status;
              return (
              <div key={id} className="list-row" onClick={() => setSelId(id)} style={{cursor:"pointer", background: selectedId===id ? "var(--panel-hi)" : "transparent", borderLeft: selectedId===id ? "2px solid var(--brass)" : "2px solid transparent"}}>
                <div style={{fontSize:13, fontWeight:500}}>{b.type}</div>
                <div style={{fontSize:11.5, color:"var(--ink-3)"}}>For {b.for}</div>
                <div className="mono t-label" style={{marginTop:4, color: status === "Reviewed" ? "var(--ok)" : status.startsWith("Copied") ? "var(--ink-3)" : "var(--ink-4)", textTransform:"uppercase", letterSpacing:".12em"}}>{status}</div>
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
              <button className="btn sm" disabled={!selected} title="Copy a send-ready handoff note" onClick={() => copyText(`# Brief handoff\nType: ${selected.type}\nFor: ${selected.for}\nStatus: ${reviewedIds[selectedId] ? "Reviewed" : selected.status}\nGenerated: ${new Date().toISOString()}`, toast, "Brief handoff copied")}>Copy handoff</button>
              <button className="btn ghost sm" disabled={!selected || reviewedIds[selectedId]} title="Mark this brief reviewed in the local queue" onClick={() => { setReviewedIds(r => ({ ...r, [selectedId]: true })); toast(`Marked reviewed: ${selected.type}`, "brass"); }}>{selected && reviewedIds[selectedId] ? "Reviewed" : "Mark reviewed"}</button>
            </div>
          </div>
          <div className="panel-body">
            {(() => {
              const b = selected;
              if (!b) return <div className="empty">No briefs in the queue. Open any signal and choose Generate brief.</div>;
              const sig = b._sid ? known.find(s => s.id === b._sid) : null;
              if (!sig) {
                return (
                  <EmptyState icon="brief" kicker="Source signal not found">
                    Parliament Pulse cannot rebuild this brief because the original signal is no longer in the inbox.
                  </EmptyState>
                );
              }
              const brief = buildBriefSections(sig, !!sig.isLive);
              return (
              <div className="brief">
                <div className="meta">PARLIAMENT PULSE · {b.type.toUpperCase()} · {brief.meta.date} · {brief.meta.time}</div>
                {/* Licence rule: a live APH title renders only inside an anchor to
                    its APH link; no link falls back to the source label. */}
                <h3>{brief.isLive
                  ? (brief.link
                      ? <a href={brief.link} target="_blank" rel="noopener noreferrer" style={{color:"inherit"}} title="Open the source at aph.gov.au">{brief.title} <Icon name="ext" size={12} style={{verticalAlign:"-1px", opacity:.6}}/></a>
                      : brief.meta.source)
                  : brief.title}</h3>
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
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- ALERT RULES ----------
// The alerts engine runs inside every 30-minute poll and has run since launch,
// but has never had a rule to evaluate: GET /alerts has always returned
// {"rules":[]} (verified live, 2026-07-22) because no rule has ever been
// created. This panel is the missing surface: create/list/delete a rule against
// the Worker's real endpoints, and show matched events from the /state alerts
// block via the existing useLiveState hook. Placed on the Watchlists page,
// which is the closest existing analogue in the information architecture — both
// features are "define match criteria, get told when something matches", the
// only difference being where the matching runs (this browser session vs the
// Worker's own poll, which fires even when nobody has the tab open).
function renderMatchedAlertEvent(e, i) {
  // The alert_events shape has never been observed live (the table has zero
  // rows so far), so this renders only fields that are actually present under
  // a set of plausible names, with a neutral fallback label — never an invented
  // specific field.
  const title = e.title || e.signal_title || e.rule_name || e.name || "Alert match";
  const link = safeHttpUrl(e.link || e.signal_link || "");
  const when = e.matched_at || e.created_at || e.ts || null;
  return (
    <div key={e.id || i} style={{padding:"8px 0", borderBottom:"1px solid var(--line)"}}>
      {link
        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)", textDecoration:"none", fontWeight:500, fontSize:13}} title="Opens the source at aph.gov.au">{title} <Icon name="ext" size={11}/></a>
        : <span style={{fontWeight:500, fontSize:13}}>{title}</span>}
      {when && <div className="mono" style={{fontSize:11, color:"var(--ink-4)", marginTop:2}}>{fmtFetchedAt(when)} AEST</div>}
    </div>
  );
}

function AlertRulesPanel() {
  const { toast } = useStore();
  const [rules, setRules] = useState(null);       // null = not loaded yet, or every attempt has failed
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState("");
  const [attentionMin, setAttentionMin] = useState("any");
  const [sourceGroup, setSourceGroup] = useState("");
  const [kind, setKind] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matched = useLiveState("alerts");
  // LB-04 (2026-07-23): the Worker's server-side alert writes are locked pending
  // decision D2 (client-local vs token-gated). Until then this panel is read-only:
  // it lists any live rules but offers no creation or deletion, and it never claims
  // a capability the product does not currently have. Flip to true when D2 lands.
  const ALERTS_WRITABLE = false;

  const loadRules = React.useCallback(() => {
    fetch(`${WORKER_BASE_URL}/alerts`)
      .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(data => { setRules(Array.isArray(data.rules) ? data.rules : []); setLoadFailed(false); })
      .catch(() => setLoadFailed(true));
  }, []);
  React.useEffect(() => { loadRules(); }, [loadRules]);

  const createRule = () => {
    if (!ALERTS_WRITABLE) { toast("Rule creation is closed in this release.", "error"); return; }
    const termList = terms.split(",").map(t => t.trim()).filter(Boolean);
    if (!name.trim() || termList.length === 0) { toast("Name and at least one term are required", "error"); return; }
    setSubmitting(true);
    const body = { name: name.trim(), terms: termList };
    if (attentionMin !== "any") body.attention_min = attentionMin;
    if (sourceGroup.trim()) body.source_group = sourceGroup.trim();
    if (kind.trim()) body.kind = kind.trim();
    fetch(`${WORKER_BASE_URL}/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json().catch(() => ({})); })
      .then(() => {
        toast(`Alert rule "${name.trim()}" created`, "brass");
        setName(""); setTerms(""); setAttentionMin("any"); setSourceGroup(""); setKind("");
        loadRules();
      })
      .catch(() => toast("Could not create the alert rule. Try again.", "error"))
      .finally(() => setSubmitting(false));
  };

  const deleteRule = (id, ruleName) => {
    fetch(`${WORKER_BASE_URL}/alerts/${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(res => { if (!res.ok && res.status !== 204) throw new Error("HTTP " + res.status); })
      .then(() => { toast(`Alert rule "${ruleName}" removed`, "brass"); loadRules(); })
      .catch(() => toast("Could not remove the alert rule. Try again.", "error"));
  };

  return (
    <div className="panel" style={{marginTop:18}}>
      <div className="panel-head">
        <h2 className="panel-title">Alert rules</h2>
        <span className="panel-kicker">{rules ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} configured` : "Loading…"}</span>
        <ProvenanceChip provenance="live" title="Rules are read from the Worker's /alerts endpoint" />
      </div>
      <div className="panel-body">
        <p style={{margin:"0 0 14px", fontSize:12.5, color:"var(--ink-3)", lineHeight:1.6}}>
          The alerts engine evaluates each configured rule against every 30-minute feed poll, whether or not
          this tab is open. A rule matches on its keyword terms, and can optionally require a minimum
          attention level, a source group, or a signal kind.
          {!ALERTS_WRITABLE && " Creating and removing rules from the browser is closed in this release: the server-side write endpoint requires authentication that is not yet in place."}
        </p>

        {ALERTS_WRITABLE && (
        <div style={{display:"grid", gap:8, marginBottom:16}}>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <div style={{flex:"1 1 200px"}}>
              <label htmlFor="alert-name" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Name</label>
              <input id="alert-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. AI governance" className="search" style={{padding:"7px 10px", marginTop:4, width:"100%"}}/>
            </div>
            <div style={{flex:"2 1 260px"}}>
              <label htmlFor="alert-terms" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Terms (comma-separated)</label>
              <input id="alert-terms" value={terms} onChange={e=>setTerms(e.target.value)} placeholder="e.g. artificial intelligence, algorithm" className="search" style={{padding:"7px 10px", marginTop:4, width:"100%"}}/>
            </div>
          </div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"end"}}>
            <div>
              <label htmlFor="alert-attention" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Minimum attention</label><br/>
              <select id="alert-attention" className="select" value={attentionMin} onChange={e=>setAttentionMin(e.target.value)} style={{marginTop:4}}>
                <option value="any">Any</option>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label htmlFor="alert-source-group" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Source group (optional)</label><br/>
              <input id="alert-source-group" value={sourceGroup} onChange={e=>setSourceGroup(e.target.value)} placeholder="e.g. Senate" className="search" style={{padding:"7px 10px", marginTop:4}}/>
            </div>
            <div>
              <label htmlFor="alert-kind" className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em"}}>Kind (optional)</label><br/>
              <input id="alert-kind" value={kind} onChange={e=>setKind(e.target.value)} placeholder="e.g. inquiry" className="search" style={{padding:"7px 10px", marginTop:4}}/>
            </div>
            <button className="btn primary" disabled={submitting} onClick={createRule}><Icon name="plus" size={13}/> {submitting ? "Creating…" : "Create rule"}</button>
          </div>
        </div>
        )}

        {rules === null ? (
          loadFailed ? (
            <EmptyState icon="bell" kicker="Alert rules unavailable" variant="error"
              action={<button className="btn ghost sm" onClick={loadRules}>Retry</button>}>
              Parliament Pulse could not reach the Worker's /alerts endpoint just now.
            </EmptyState>
          ) : <div className="mono" style={{fontSize:11.5, color:"var(--ink-4)"}}>Loading alert rules…</div>
        ) : rules.length === 0 ? (
          <EmptyState icon="bell" kicker="No alert rules configured yet">
            No alert rules are configured yet. Matches appear here within thirty minutes of creating one.
          </EmptyState>
        ) : (
          <div style={{display:"grid", gap:8, marginBottom:16}}>
            {rules.map(r => (
              <div key={r.id} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 12px", border:"1px solid var(--line-2)", borderRadius:8}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:500}}>{r.name}</div>
                  <div style={{fontSize:11.5, color:"var(--ink-3)", marginTop:2}}>
                    {(Array.isArray(r.terms) ? r.terms : String(r.terms || "").split(",").map(t=>t.trim()).filter(Boolean)).join(", ")}
                    {r.attention_min && <> · min {r.attention_min}</>}
                    {r.source_group && <> · {r.source_group}</>}
                    {r.kind && <> · {r.kind}</>}
                  </div>
                </div>
                {ALERTS_WRITABLE && <button className="btn ghost sm" aria-label={`Remove alert rule ${r.name}`} onClick={() => deleteRule(r.id, r.name)}><Icon name="close" size={13}/></button>}
              </div>
            ))}
          </div>
        )}

        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:8, marginBottom:8}}>Matched events</h3>
        {!matched.items ? (
          <div className="empty">
            {rules && rules.length > 0
              ? "No alert matches yet. The engine checks your rules on every 30-minute poll."
              : "No alert rules are configured yet. Matches appear here within thirty minutes of creating one."}
          </div>
        ) : (
          <div style={{display:"grid", gap:6}}>{matched.items.map(renderMatchedAlertEvent)}</div>
        )}
      </div>
    </div>
  );
}

// ---------- WATCHLISTS ----------
function PageWatchlists() {
  const { openModal, createWatchlist, state, removeWatchlist } = useStore();
  const [newName, setNewName] = useState("");
  // Keyword matches are always computed live against matchSource (live.items when
  // connected, otherwise the empty SIGNALS fixture), never read from a stored
  // count: the WATCHLISTS fixture's matches/trend fields were invented and are
  // held null. derived only controls the chip label and the trend spark, since a
  // freshly-connected live stream has no history yet either.
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  const derived = !!live.items;
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
          <div className="page-sub">The relevance engine. Click any watchlist for matches and configuration. Alert rules below run server-side, so matches land even when this tab is closed.</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <ProvenanceChip provenance={derived ? "derived" : "fixture"}
            title={derived ? "Keyword matches computed against the live signal stream" : "Live data is unavailable, so matches show 0 rather than an invented count"} />
          <input id="new-wl-name" aria-label="New watchlist name" placeholder="New watchlist name" value={newName} onChange={e=>setNewName(e.target.value)} className="search" style={{padding:"7px 10px"}}/>
          <button className="btn primary" onClick={() => { if (newName.trim()) { createWatchlist(newName.trim()); setNewName(""); } }}><Icon name="plus" size={13}/> Create</button>
        </div>
      </div>

      {all.length === 0 ? (
        <EmptyState icon="watch" kicker="No watchlists yet"
          action={<button className="btn sm primary" onClick={() => document.getElementById("new-wl-name")?.focus()}>New watchlist</button>}>
          Create a watchlist to get matched signals and a daily digest of what moved.
        </EmptyState>
      ) : (
      <div className="grid g-3">
        {all.map(w => {
          const matchCount = watchlistMatches(w, matchSource).length;
          const keywordCount = watchlistKeywords(w).length;
          return (
            <div key={w.name} className={"wl" + (selectedWl?.name === w.name ? " active" : "")} onClick={() => { setSelectedWl(w); openModal("watchlist", w.name); }} style={selectedWl?.name === w.name ? {borderColor:"var(--brass)"} : {}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <span className="wl-name">{w.name}</span>
                <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--brass)", background:"var(--panel-hi)", border:"1px solid var(--brass-soft)", padding:"1px 6px", borderRadius:4, marginLeft:"auto"}}>{matchCount} matches</span>
              </div>
              <div className="wl-meta"><span>{keywordCount} keywords</span></div>
              {/* Parliament Pulse holds no real match history for any watchlist (the
                  previous six-invented-zero-days-plus-today's-real-count spark line was
                  still an invented history, just with one true point buried in it), so
                  every card states that plainly rather than drawing a trend line. */}
              <div className="mono" style={{marginTop:6, color:"var(--ink-4)", fontSize:11}}>No trend history held</div>
            </div>
          );
        })}
      </div>
      )}

      <AlertRulesPanel />

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
                <div className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", marginTop:2}}>{item.meta}</div>
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
          <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6}}>Keywords</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
            {selectedKeywords.map(k => <span key={k} className="tag brass">{k}</span>)}
          </div>
          {/* Linked committees, attention thresholds, and an audit log were previously
              rendered here as static blocks identical for all 12 watchlists (only the
              keywords above are genuinely per-watchlist). They have been removed rather
              than left to imply a per-watchlist configuration that does not exist. */}
          <div className="empty" style={{marginTop:14}}>Parliament Pulse does not yet hold linked committees, attention thresholds, or an audit log for watchlists. These configuration surfaces need a backend before they can show real per-watchlist data.</div>
        </div>
      </div>
    </div>
  );
}

// ---------- RADAR ----------
function PageRadar() {
  const { openModal } = useStore();
  // Derived clustering: the product's own grouping of live signals by source group.
  // Momentum and confidence require history the product does not hold, so they render
  // "—" in derived mode rather than an invented number (spec 2.3, invariant 4).
  const live = useLiveState("signals");
  const derivedRows = React.useMemo(() => {
    if (!live.items) return null;
    const rank = { high: 3, med: 2, low: 1 };
    const groups = new Map();
    live.items.forEach(s => {
      const key = s.sourceGroup || "Other";
      const g = groups.get(key) || { issue: key, count: 0, sources: new Set(), att: null };
      g.count += 1;
      if (s.source) g.sources.add(s.source);
      // Attention climbs only from a real med/high signal; a group of unscored
      // items keeps att null and renders "—", never a fabricated "Low".
      if ((rank[s.attention] || 0) > (rank[g.att] || 0)) g.att = s.attention;
      groups.set(key, g);
    });
    return [...groups.values()]
      .map(g => ({ issue: g.issue, att: g.att, sources: g.sources.size, count: g.count,
        reason: `${g.count} live items across ${g.sources.size} feed${g.sources.size !== 1 ? "s" : ""}` }))
      .sort((a, b) => b.count - a.count);
  }, [live.items]);
  const derived = !!derivedRows;
  const rows = derivedRows || RADAR;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-kicker">Today</div>
          <h1 className="page-title">Attention radar</h1>
          <div className="page-sub">Transparent categories, no fake precision scores. Click any issue for momentum detail and suggested actions.</div>
        </div>
        <ProvenanceChip provenance={derived ? "derived" : "fixture"}
          title={derived ? "Grouped live signals; momentum and confidence require history the product does not yet have" : "Live data is unavailable, so no clusters render"} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Active issues</h2>
          <span className="panel-kicker">{derived ? "Grouped from the live signal stream" : "No live signal stream connected"}</span>
        </div>
        <div className="panel-body">
          {rows.length === 0 ? (
            <EmptyState icon="radar" kicker="Live data unavailable" variant="error">
              Live data is unavailable. Parliament Pulse shows nothing rather than showing an invented issue cluster. <a href="https://www.aph.gov.au" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Go to aph.gov.au</a>.
            </EmptyState>
          ) : (
          <>
          <div className="radar-row g-radar-table" style={{display:"grid", padding:"4px 0 10px", borderBottom:"1px solid var(--line)", alignItems:"center", gap:14}}>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Issue</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Attention</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", textAlign:"right"}}>Sources</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Momentum</div>
            <div className="mono t-label" style={{color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em"}}>Confidence</div>
          </div>
          {rows.map((r,i) => (
            <div key={r.issue} className={(derived ? "" : "clk ") + "radar-row g-radar-table"} onClick={derived ? undefined : () => openModal("radar", r.issue)} style={{display:"grid", padding:"14px 8px", borderBottom: i<rows.length-1 ? "1px solid var(--line)" : 0, gap:14, alignItems:"center", borderRadius:6, cursor: derived ? "default" : undefined}}>
              <div>
                <div style={{fontSize:14, fontWeight:500}}>{r.issue}</div>
                <div style={{fontSize:12, color:"var(--ink-3)", marginTop:2}}>{r.reason}</div>
              </div>
              <div><Att level={r.att}/></div>
              <div className="mono" style={{textAlign:"right", color:"var(--ink-2)"}}>{r.sources}</div>
              {derived
                ? <div className="mono" style={{color:"var(--ink-4)"}}>—</div>
                : <div><div className="bar"><div className="fill" style={{width:`${r.momentum*100}%`}}/></div></div>}
              {derived
                ? <div className="mono" style={{color:"var(--ink-4)"}}>—</div>
                : <div style={{display:"flex", alignItems:"center", gap:10}}>
                    <div className="ring" style={{"--p": Math.round(r.confidence*100)}} data-p={Math.round(r.confidence*100)}></div>
                  </div>}
            </div>
          ))}
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
            title={live.displayProvenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Live data is unavailable — the /state signals block is not live"} />
          <label htmlFor="sig-sort" className="sr-only">Sort signals</label>
          <span aria-hidden="true" style={{fontSize:12, color:"var(--ink-4)"}}>Sort:</span>
          <select id="sig-sort" className="select" value={sort} onChange={e => setSort(e.target.value)}>
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
            {label} <span className="mono" style={{color:"var(--ink-2)"}}>({counts[val]})</span>
            {filter === val && <span className="sr-only"> (active filter)</span>}
          </button>
        ))}
      </div>

      {live.status === "loading" && !live.items ? (
        <div aria-busy="true" aria-label="Loading signals">{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</div>
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
            Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. <a href="https://www.aph.gov.au" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>Go to aph.gov.au</a>.
          </EmptyState>
        ) : (
          <EmptyState icon="check" kicker="Inbox zero">
            All signals reviewed. New items appear when the next feed poll lands.
          </EmptyState>
        )
      ) : (
        <div>
          {shown.map(s => <SignalCard key={s.id} s={s} />)}
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

Object.assign(window, { PageOverview, PageLive, PageSources, PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists, PageRadar, PageSignals, PageAbout, OnboardingGuide });
