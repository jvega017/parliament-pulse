const { useState, useMemo } = React;
function csvEscape(v) {
  const text = v == null ? "" : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function exportSignalsCSV() {
  const headers = ["id", "date", "source", "attention", "title", "action", "confidence"];
  const rows = SIGNALS.map((s) => [
    s.id,
    s.date,
    s.source,
    s.attention,
    s.title,
    s.action,
    s.confidence
  ]);
  exportRowsCSV(headers, rows, `parliament-pulse-signals-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`);
}
function exportRowsCSV(headers, rows, filename) {
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
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
  } catch (e) {
    return false;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
function copyText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text).then(() => toast(ok, "brass")).catch(() => toast("Clipboard unavailable: content not copied", "error"));
}
function copyLiveActionNote(kind, chamber, toast) {
  const label = chamber === "house" ? "House of Representatives" : chamber === "senate" ? "Senate" : "Federation Chamber";
  const note = [
    `# Parliament Pulse live action note`,
    `Type: ${kind}`,
    `Chamber: ${label}`,
    `Captured: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    ``,
    `Source links:`,
    `- AUSParliamentLive: https://www.youtube.com/@AUSParliamentLive/streams`,
    `- ParlView archive: https://parlview.aph.gov.au/`,
    `- Hansard: https://www.aph.gov.au/Parliamentary_Business/Hansard`
  ].join("\n");
  return copyText(note, toast, `${kind} note copied`);
}
function copyBacklogRequest(name, note, toast) {
  const text = [
    `# Parliament Pulse backlog request`,
    `Capability: ${name}`,
    `Reason: ${note}`,
    `Requested: ${(/* @__PURE__ */ new Date()).toISOString()}`
  ].join("\n");
  return copyText(text, toast, "Backlog request copied");
}
function downloadBriefingQueue(briefs, toast) {
  const ok = exportRowsCSV(
    ["type", "for", "status"],
    briefs.map((b) => [b.type, b.for, b.status]),
    `parliament-pulse-briefing-queue-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`
  );
  if (toast) toast(ok ? "Briefing queue CSV downloaded" : "CSV export unavailable", ok ? "brass" : "error");
}
const BETA_READINESS_ROWS = [
  {
    state: "Live",
    title: "Official feed spine",
    detail: "Six APH RSS sources are configured and polled through the local or Cloudflare proxy. The Live page shows runtime feed state and direct source links.",
    action: "Open Live",
    page: "live"
  },
  {
    state: "Representative",
    title: "Enriched policy signals",
    detail: "Priority, confidence, provenance, radar clusters and watchlist matches are modelled from the target workflow until the enrichment pipeline is connected.",
    action: "Review signals",
    page: "signals"
  },
  {
    state: "Next",
    title: "Activation path",
    detail: "Production hardening needs authenticated division/member data, Hansard and QON extraction, shared briefing persistence and a publication approval lane.",
    action: "View sources",
    page: "sources"
  }
];
const PROVENANCE_STACK = [
  {
    label: "Official source",
    title: "APH RSS + direct source links",
    detail: "Live feed rows retain the official APH URL and expose Hansard, ParlView, YouTube or source-page links before any interpretation.",
    state: "Live"
  },
  {
    label: "Transport",
    title: "CORS proxy with constrained feed list",
    detail: "Local beta uses proxy-server.js. Production uses the Cloudflare Worker route documented in the repo.",
    state: "Live"
  },
  {
    label: "Enrichment",
    title: "Priority scoring and policy routing",
    detail: "The target scoring model is represented in the UI, but enrichment needs the production signal pipeline before public claims.",
    state: "Representative"
  },
  {
    label: "Analyst action",
    title: "Briefs, exports, notes and watchlists",
    detail: "Current controls create local artefacts, copy handoff notes, export CSVs or persist browser-local review state.",
    state: "Beta"
  }
];
const COVERAGE_MATRIX = [
  {
    module: "Live parliament",
    state: "Live",
    evidence: "Six official APH RSS feeds plus chamber program and broadcast links.",
    activation: "Keep runtime feed health in Live page; add sitting-status check before claiming current chamber activity.",
    page: "live"
  },
  {
    module: "Sources",
    state: "Live",
    evidence: "Official source register and constrained proxy route.",
    activation: "Connect custom-feed validation to backend parser instead of timeout simulation.",
    page: "sources"
  },
  {
    module: "Overview signals",
    state: "Representative",
    evidence: "Representative signal set with direct source links.",
    activation: "Wire production scoring, entity extraction and watchlist matching.",
    page: "signals"
  },
  {
    module: "Committees",
    state: "Partial live",
    evidence: "Committee RSS coverage where official feeds expose reports, inquiries and hearings.",
    activation: "Add committee profile scraper or curated registry for chairs, dates and hearing status.",
    page: "committees"
  },
  {
    module: "Bills intelligence",
    state: "Representative",
    evidence: "Bill source links and representative digest workflow.",
    activation: "Connect bills register, amendment tracking and portfolio routing.",
    page: "bills"
  },
  {
    module: "Briefings",
    state: "Local beta",
    evidence: "Clipboard export, CSV export and browser-local queue state.",
    activation: "Add shared persistence, reviewer assignment and approval workflow.",
    page: "briefings"
  },
  {
    module: "QON patterns",
    state: "Representative",
    evidence: "Modelled pattern-detection workflow.",
    activation: "Add Hansard/QON extraction, NLP clustering and source-level audit trace.",
    page: "patterns"
  },
  {
    module: "Watchlists/radar",
    state: "Representative",
    evidence: "Keyword and cluster target model.",
    activation: "Connect live enrichment pipeline and alert delivery rules.",
    page: "watchlists"
  }
];
function BetaReadinessPanel({ navigate }) {
  return /* @__PURE__ */ React.createElement("div", { className: "beta-ledger", "aria-label": "Beta evidence status" }, /* @__PURE__ */ React.createElement("div", { className: "beta-ledger-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Beta evidence ledger"), /* @__PURE__ */ React.createElement("h2", null, "What is live, what is representative, and what activates next")), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Official-first beta")), /* @__PURE__ */ React.createElement("div", { className: "beta-ledger-grid" }, BETA_READINESS_ROWS.map((row) => /* @__PURE__ */ React.createElement("button", { key: row.title, className: "beta-ledger-row", onClick: () => navigate(row.page) }, /* @__PURE__ */ React.createElement("span", { className: "beta-state beta-" + row.state.toLowerCase() }, row.state), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, row.title), /* @__PURE__ */ React.createElement("span", null, row.detail)), /* @__PURE__ */ React.createElement("span", { className: "beta-action" }, row.action, " \u2192")))));
}
function ProvenanceStackPanel({ navigate }) {
  return /* @__PURE__ */ React.createElement("div", { className: "provenance-stack" }, /* @__PURE__ */ React.createElement("div", { className: "provenance-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Source to decision"), /* @__PURE__ */ React.createElement("h2", null, "How a parliamentary item becomes a beta signal")), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => navigate("sources") }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Source register")), /* @__PURE__ */ React.createElement("div", { className: "provenance-steps" }, PROVENANCE_STACK.map((step, index) => /* @__PURE__ */ React.createElement("div", { key: step.label, className: "provenance-step" }, /* @__PURE__ */ React.createElement("div", { className: "prov-index" }, String(index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "prov-label" }, step.label), /* @__PURE__ */ React.createElement("strong", null, step.title), /* @__PURE__ */ React.createElement("p", null, step.detail)), /* @__PURE__ */ React.createElement("span", { className: "beta-state beta-" + (step.state === "Representative" ? "representative" : step.state === "Live" ? "live" : "next") }, step.state)))));
}
function ProvenanceMetricsBand({ navigate }) {
  const metrics = [
    { label: "Official feeds", value: sourceCounts().total, detail: "Configured APH sources", icon: "rss" },
    { label: "Signals", value: SIGNALS.length, detail: "Current beta signal set", icon: "signal" },
    { label: "Source links", value: "Present", detail: "Representative items include source links", icon: "link" },
    { label: "Human review", value: "On", detail: "Verify before publication", icon: "check" }
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "provenance-metrics" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Provenance at a glance"), /* @__PURE__ */ React.createElement("div", { className: "prov-metric-grid" }, metrics.map((m) => /* @__PURE__ */ React.createElement("button", { key: m.label, className: "prov-metric", onClick: () => navigate(m.label === "Official feeds" ? "sources" : "signals") }, /* @__PURE__ */ React.createElement(Icon, { name: m.icon, size: 14 }), /* @__PURE__ */ React.createElement("strong", null, m.value), /* @__PURE__ */ React.createElement("span", null, m.label), /* @__PURE__ */ React.createElement("small", null, m.detail)))));
}
function CoverageActivationMatrix({ navigate, copyPlan }) {
  return /* @__PURE__ */ React.createElement("div", { className: "coverage-matrix", "aria-label": "Module coverage and activation matrix" }, /* @__PURE__ */ React.createElement("div", { className: "coverage-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Module coverage and activation matrix"), /* @__PURE__ */ React.createElement("h2", null, "What is operational, what is representative, and what needs wiring next")), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: copyPlan }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Copy activation plan")), /* @__PURE__ */ React.createElement("div", { className: "coverage-grid" }, /* @__PURE__ */ React.createElement("div", { className: "coverage-row coverage-labels", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", null, "Module"), /* @__PURE__ */ React.createElement("span", null, "Status"), /* @__PURE__ */ React.createElement("span", null, "Evidence basis"), /* @__PURE__ */ React.createElement("span", null, "Activation needed"), /* @__PURE__ */ React.createElement("span", null, "Open")), COVERAGE_MATRIX.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.module, className: "coverage-row" }, /* @__PURE__ */ React.createElement("strong", null, row.module), /* @__PURE__ */ React.createElement("span", { className: "coverage-state state-" + row.state.toLowerCase().replace(/\s+/g, "-") }, row.state), /* @__PURE__ */ React.createElement("span", null, row.evidence), /* @__PURE__ */ React.createElement("span", null, row.activation), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => navigate(row.page) }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Open")))));
}
function OnboardingGuide() {
  const key = "pp-onboarded";
  const [visible, setVisible] = React.useState(() => !safeGetLocalStorage(key));
  if (!visible) return null;
  return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--panel-hi)", border: "1px solid var(--brass-soft)", borderRadius: 10, padding: "16px", marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 14, stroke: "var(--brass)" }), /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--brass)", textTransform: "uppercase", letterSpacing: ".18em" } }, "Getting started"), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        safeSetLocalStorage(key, "1");
        setVisible(false);
      },
      style: { marginLeft: "auto", background: "none", border: "none", color: "var(--ink-4)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" },
      "aria-label": "Dismiss guide"
    },
    "\xD7"
  )), /* @__PURE__ */ React.createElement("div", { className: "g-onboarding", style: { display: "grid", gap: 14 } }, [
    ["1. Signals", "Parliamentary intelligence items classified by attention level. Open any signal to read the full analysis and evidence trail."],
    ["2. Take action", "Open a signal, read the recommended action, then archive, generate a brief, or add to a watchlist. Use j/k to navigate, Esc to close."],
    ["3. Generate briefs", "Press b or click Generate brief to copy a structured brief to the clipboard. Completed briefs appear in the Briefings queue."]
  ].map(([h, b]) => /* @__PURE__ */ React.createElement("div", { key: h, style: { fontSize: 12.5, color: "var(--ink-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, color: "var(--brass)", marginBottom: 4, fontSize: 12 } }, h), b))));
}
function PageOverview() {
  const { openModal, state, toast, navigate } = useStore();
  const goto = navigate;
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [sortByAttention, setSortByAttention] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const priority = SIGNALS.filter((s) => s.attention === "high" && !state.archived[s.id]);
  let rest = SIGNALS.filter((s) => s.attention !== "high" && !state.archived[s.id]);
  if (sortByAttention) {
    const rank = { high: 0, med: 1, low: 2 };
    rest = [...rest].sort((a, b) => {
      var _a, _b;
      return ((_a = rank[a.attention]) != null ? _a : 3) - ((_b = rank[b.attention]) != null ? _b : 3);
    });
  }
  const restGroups = groupByTopic ? rest.reduce((acc, s) => {
    const topic = s.tags && s.tags[0] && s.tags[0].l || "Other";
    (acc[topic] = acc[topic] || []).push(s);
    return acc;
  }, {}) : null;
  const generateDailyBrief = () => {
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const prioritySections = priority.length === 0 ? ["None."] : priority.map((s) => {
      const brief = buildBriefSections(s);
      return [
        `### ${brief.meta.id} - ${brief.title}`,
        `Source: ${brief.meta.source} | Confidence: ${brief.meta.confidence}/5`,
        brief.summary,
        `**Action:** ${brief.recommendedAction.label}. ${brief.recommendedAction.reason}`,
        ``
      ].join("\n");
    });
    const restSections = rest.length === 0 ? ["None."] : rest.map((s) => {
      const brief = buildBriefSections(s);
      return `- [${brief.meta.id}] ${brief.title} - ${brief.recommendedAction.label}`;
    });
    const lines = [
      `# Parliamentary Daily Signal Brief \u2014 ${today}`,
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `Total signals: ${priority.length + rest.length} \xB7 Priority: ${priority.length}`,
      ``,
      `## Priority signals`,
      ...prioritySections,
      `## All other signals`,
      ...restSections
    ].join("\n");
    copyText(lines, toast, "Daily brief copied to clipboard");
  };
  const copyBetaHandoff = () => {
    const handoff = [
      "# Parliament Pulse beta handoff",
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
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
      "- Keep representative chips until each module has verified live evidence."
    ].join("\n");
    copyText(handoff, toast, "Beta handoff copied");
  };
  const copyActivationPlan = () => {
    const table = COVERAGE_MATRIX.map((row) => `| ${row.module} | ${row.state} | ${row.evidence} | ${row.activation} |`).join("\n");
    const plan = [
      "# Parliament Pulse activation plan",
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      "| Module | Current coverage | Evidence basis | Activation needed |",
      "| --- | --- | --- | --- |",
      table,
      "",
      "## Immediate priorities",
      "1. Keep official feed polling visible in Live and avoid current-sitting claims until verified.",
      "2. Connect backend validation for custom feeds before routing them as production sources.",
      "3. Wire production enrichment for scoring, entity extraction, watchlist matching, Hansard/QON extraction and briefing persistence.",
      "4. Keep representative labels until each module has verified item-level evidence."
    ].join("\n");
    copyText(plan, toast, "Activation plan copied");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, (/* @__PURE__ */ new Date()).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" }), " \xB7 Verify sitting status from APH"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Today's signals")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", title: "Signal counts and tiles are representative; the Live page polls official RSS feeds" }, "Representative signals \xB7 live RSS available"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", "aria-expanded": showHelp, onClick: () => setShowHelp((v) => !v) }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 12 }), " How it works"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: exportSignalsCSV }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Export CSV"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: copyBetaHandoff }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Copy beta handoff"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: generateDailyBrief }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate daily brief"))), showHelp && /* @__PURE__ */ React.createElement(OnboardingGuide, null), /* @__PURE__ */ React.createElement("div", { className: "command-strip" }, /* @__PURE__ */ React.createElement("div", { className: "cs-primary" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Priority signals"), /* @__PURE__ */ React.createElement("div", { className: "cs-kpi cs-count-up" }, priority.length, /* @__PURE__ */ React.createElement("span", { className: "unit" }, priority.length > 0 ? "to triage" : "clear")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta", style: { marginTop: 8, display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, priority.length + rest.length, " signals today \xB7 ", SIGNALS.filter((s) => state.archived[s.id]).length, "/", SIGNALS.length, " actioned"), priority.length > 0 && /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginLeft: "auto" }, onClick: () => {
    var _a;
    return (_a = document.getElementById("priority-panel")) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "start" });
  } }, "Triage now \u2192"))), /* @__PURE__ */ React.createElement("div", { className: "cs-secondary" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Committee activity"), /* @__PURE__ */ React.createElement("div", { className: "cs-stat" }, "7", /* @__PURE__ */ React.createElement("span", { className: "unit" }, "items")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "2 hearings \xB7 1 inquiry \xB7 1 report")), /* @__PURE__ */ React.createElement("div", { className: "cs-secondary" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Source health"), /* @__PURE__ */ React.createElement("div", { className: "cs-stat" }, sourceCounts().total, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "feeds")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Official feeds configured \xB7 live poll on Live page"))), /* @__PURE__ */ React.createElement("div", { className: "live-strip g-live-strip", style: { display: "grid", gap: 14, alignItems: "center", padding: "12px 16px", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ok)" } }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10.5, letterSpacing: ".16em", color: "var(--ok)", fontWeight: 600 } }, "LATEST CONFIGURED SOURCES")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 18, fontSize: 12.5, color: "var(--ink-2)", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "House:"), " program links available"), /* @__PURE__ */ React.createElement("div", { style: { width: 1, height: 16, background: "var(--line-2)" } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "Senate:"), " verify hearing status from APH before action")), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Hansard", target: "_blank", rel: "noopener noreferrer", className: "btn sm ghost", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Hansard"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "btn sm ghost", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " YouTube"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", onClick: () => goto && goto("live") }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 12 }), " Watch live")), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel", id: "priority-panel", style: { marginBottom: "var(--gap-section)" } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Priority signals"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, priority.length, " items \xB7 human review required")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, priority.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s })), priority.length === 0 && /* @__PURE__ */ React.createElement(EmptyState, { icon: "check", kicker: "Priority clear" }, "All priority signals actioned.")), rest.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "panel-foot" }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", fontSize: 13 } }, rest.length, " more signal", rest.length !== 1 ? "s" : "", " in the last 24h"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginLeft: "auto" }, onClick: () => goto && goto("signals") }, "Open Signal inbox \u2192")))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-section-title" }, "What changed"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, "Since 17:00 yesterday")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--rule-2)", fontSize: 12, color: "var(--ink-3)" } }, Object.keys(state.archived).length > 0 ? `You actioned ${Object.keys(state.archived).length} signal${Object.keys(state.archived).length !== 1 ? "s" : ""} this session.` : "No signals actioned yet this session.", " ", SIGNALS.length, " new signals today."), /* @__PURE__ */ React.createElement("div", { className: "timeline" }, /* @__PURE__ */ React.createElement("div", { className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "08:15 \xB7 Senate"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "New inquiry opened: ", /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("inquiry", "Commonwealth procurement governance (new)") }, "Digital procurement governance"))), /* @__PURE__ */ React.createElement("div", { className: "tl-item teal" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "07:48 \xB7 Library"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Bills Digest: ", /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("bill", "BILL-2026-048") }, "Digital ID Amendment (Assurance) Bill 2026"))), /* @__PURE__ */ React.createElement("div", { className: "tl-item info" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "07:30 \xB7 Senate"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Today's hearing \xB7 ", /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("committee", "legcon") }, "Legal & Constitutional"), " \xB7 AI assurance")), /* @__PURE__ */ React.createElement("div", { className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "07:10 \xB7 House"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Daily program: ", /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("bill", "BILL-2026-041") }, "Cyber Security Bill"), ": 2nd reading")), /* @__PURE__ */ React.createElement("div", { className: "tl-item info" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "Yesterday 18:04"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("division", DIVISIONS[2]) }, "Division: CDR Expansion Bill, 2nd reading agreed"))), /* @__PURE__ */ React.createElement("div", { className: "tl-item teal" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "Yesterday 17:20"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Report tabled: Regional 5G rollout, interim")))), /* @__PURE__ */ React.createElement("div", { className: "panel-section" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-section-title" }, "Briefing queue"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, "4 pending")), BRIEFING_QUEUE.map((b, i) => /* @__PURE__ */ React.createElement("div", { key: b.type + b.for, className: "data-row g-brief-row", style: { display: "grid", gap: 10, padding: "10px 0", borderBottom: i < BRIEFING_QUEUE.length - 1 ? "1px solid var(--rule-2)" : 0 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, b.type), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, "For ", b.for, " \xB7 ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, b.at))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10.5, color: b.ready ? "var(--ok)" : "var(--caution)", textTransform: "uppercase", letterSpacing: ".12em" } }, b.status), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", title: "Open the briefings queue", "aria-label": "Open briefings queue", onClick: () => goto && goto("briefings") }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 }))))))))), /* @__PURE__ */ React.createElement(BetaReadinessPanel, { navigate: goto }), /* @__PURE__ */ React.createElement(CoverageActivationMatrix, { navigate: goto, copyPlan: copyActivationPlan }), /* @__PURE__ */ React.createElement(ProvenanceStackPanel, { navigate: goto }), /* @__PURE__ */ React.createElement(ProvenanceMetricsBand, { navigate: goto }));
}
const APH_YT_CHANNEL = "UCzx6ti0rql6Q2Dc2zSAPmuA";
const APH_LIVE = {
  house: { label: "House of Representatives", streamId: null, url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
  senate: { label: "Senate", streamId: null, url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` },
  federation: { label: "Federation Chamber", streamId: null, url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}&autoplay=1&mute=1` }
};
function LiveBroadcast({ which, toast }) {
  const [embedTarget, setEmbedTarget] = React.useState({ which, nonce: 0 });
  const cfg = APH_LIVE[embedTarget.which] || APH_LIVE.house;
  const [mode, setMode] = React.useState("offline");
  const [nonce, setNonce] = React.useState(0);
  const embedReady = embedTarget.which === which && embedTarget.nonce === nonce;
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    setMode("offline");
    setLoaded(false);
    const id = setTimeout(() => setEmbedTarget({ which, nonce }), 300);
    return () => clearTimeout(id);
  }, [which, nonce]);
  React.useEffect(() => {
    if (mode !== "embed" || !embedReady) return;
    const id = setTimeout(() => {
      if (!loaded) setMode("offline");
    }, 6e3);
    return () => clearTimeout(id);
  }, [mode, loaded, embedReady]);
  return /* @__PURE__ */ React.createElement("div", { className: "live-wrap", style: { background: "#000", aspectRatio: "16/9", position: "relative", overflow: "hidden", borderRadius: 10, border: "1px solid var(--line-2)" } }, mode === "embed" && embedReady && /* @__PURE__ */ React.createElement(
    "iframe",
    {
      key: embedTarget.which + "-" + embedTarget.nonce,
      src: cfg.url,
      title: `AUSParliamentLive \u2014 ${cfg.label}`,
      allow: "autoplay; encrypted-media",
      allowFullScreen: true,
      loading: "lazy",
      referrerPolicy: "strict-origin-when-cross-origin",
      onLoad: () => setLoaded(true),
      style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }
    }
  ), mode === "embed" && loaded && /* @__PURE__ */ React.createElement("div", { className: "live-badge", style: { position: "absolute", top: 12, left: 12, zIndex: 3, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 11, color: "#fff", letterSpacing: ".12em", border: "1px solid var(--ember-flash)" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ember-flash)", boxShadow: "0 0 10px var(--ember-flash)", animation: "pulse 1.6s ease-in-out infinite" } }), "LIVE \xB7 ", cfg.label.toUpperCase()), mode === "embed" && !loaded && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 12, left: 12, zIndex: 3, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: ".12em", border: "1px solid var(--line-bright)" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ink-3)" } }), "Connecting \xB7 ", cfg.label.toUpperCase()), mode === "embed" && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setMode("offline"),
      style: { position: "absolute", top: 12, right: 12, zIndex: 3, fontFamily: "var(--mono)", fontSize: 10.5, color: "#fff", background: "rgba(0,0,0,0.55)", border: "1px solid var(--line-bright)", padding: "4px 9px", borderRadius: 4, cursor: "pointer", letterSpacing: ".08em" },
      title: "Show alternate sources if no stream is live"
    },
    "NO STREAM?"
  ), mode === "offline" && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg, var(--panel-2), var(--bg))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "var(--ink-4)" } }), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)" } }, "Live broadcast \xB7 ", cfg.label)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: 13, maxWidth: 460, lineHeight: 1.5, marginBottom: 18 } }, "AUSParliamentLive streams ", /* @__PURE__ */ React.createElement("strong", null, cfg.label), " while the chamber is sitting. Load the live stream here, or open the official sources."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    setNonce((n) => n + 1);
    setMode("embed");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13 }), " Load live stream"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "btn", style: { textDecoration: "none" } }, "YouTube ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 })), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen", target: "_blank", rel: "noopener noreferrer", className: "btn", style: { textDecoration: "none" } }, "APH Watch / Read / Listen ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 })), /* @__PURE__ */ React.createElement("a", { href: "https://parlview.aph.gov.au/", target: "_blank", rel: "noopener noreferrer", className: "btn", style: { textDecoration: "none" } }, "ParlView archive ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 })))));
}
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
function liveFeedList() {
  const reg = typeof window !== "undefined" && Array.isArray(window.SOURCE_REGISTRY) ? window.SOURCE_REGISTRY : [];
  return reg.filter((f) => f.url && f.url.startsWith("http") && !f.url.includes("parlinfo.aph.gov.au")).map((f) => ({ url: f.url, label: f.label || f.name || f.url, kind: feedKind(f) }));
}
function safeHttpUrl(u) {
  return /^https?:\/\//i.test(u || "") ? u : "";
}
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = { status: "fulfilled", value: await fn(items[idx], idx) };
      } catch (e) {
        results[idx] = { status: "rejected", reason: e };
      }
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
  const [feedStatus, setFeedStatus] = useState({});
  const [lastPoll, setLastPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  React.useEffect(() => {
    let cancelled = false;
    const parseRSSXml = (text, feedMeta) => {
      const out = [];
      try {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        const items = doc.querySelectorAll("item");
        const seen = /* @__PURE__ */ new Set();
        items.forEach((item) => {
          var _a, _b, _c, _d;
          if (out.length >= 6) return;
          const title = ((_b = (_a = item.querySelector("title")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim().replace(/\s+/g, " ")) || "";
          const linkEl = item.querySelector("link");
          const link = safeHttpUrl(((linkEl == null ? void 0 : linkEl.textContent) || (linkEl == null ? void 0 : linkEl.getAttribute("href")) || "").trim());
          const pubDateStr = ((_d = (_c = item.querySelector("pubDate")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) || null;
          const pubDate = pubDateStr ? new Date(pubDateStr) : null;
          if (title.length < 10 || !link) return;
          const key = title.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          out.push({
            title,
            link,
            date: pubDate && !isNaN(pubDate) ? pubDate : null,
            sourceLabel: feedMeta.label,
            sourceUrl: feedMeta.url,
            kind: feedMeta.kind,
            order: out.length
          });
        });
      } catch (e) {
      }
      return out;
    };
    if (location.protocol === "file:") {
      setFeedStatus({ __fileGuard: { ok: false, error: "Opened from the file system. Serve over http to reach the feed proxy." } });
      setEvents([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const controllers = /* @__PURE__ */ new Set();
    const fetchOne = async (f) => {
      const proxyBase = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:3001/proxy?url=" : "https://aph-proxy.jvega019.workers.dev/rss?u=";
      const proxy = proxyBase + encodeURIComponent(f.url);
      const ctrl = new AbortController();
      controllers.add(ctrl);
      const timer = setTimeout(() => ctrl.abort(), 8e3);
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
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      const feeds = liveFeedList();
      const results = await mapPool(feeds, 3, fetchOne);
      if (cancelled) {
        inFlight = false;
        return;
      }
      const all = [];
      const status = {};
      results.forEach((r, i) => {
        const f = feeds[i];
        const reg = SOURCE_REGISTRY.find((x) => x.url === f.url);
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
      all.sort((a, b) => a.feedIdx - b.feedIdx || a.itemIdx - b.itemIdx);
      setEvents(all.slice(0, 30));
      setFeedStatus(status);
      setLastPoll(/* @__PURE__ */ new Date());
      setLoading(false);
      inFlight = false;
    };
    window.__refreshLiveFeeds = poll;
    if (consumeLiveRefresh()) toast("Refreshing live feeds...", "brass");
    poll();
    const id = setInterval(poll, 12e4);
    return () => {
      cancelled = true;
      clearInterval(id);
      controllers.forEach((c) => c.abort());
      window.__refreshLiveFeeds = null;
    };
  }, []);
  const fmtTime = (d) => {
    if (!d) return "\u2014";
    const now = /* @__PURE__ */ new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${d.getDate()} ${d.toLocaleString("en-AU", { month: "short" })}`;
  };
  const liveCount = Object.values(feedStatus).filter((s) => s.ok).length;
  const totalFeeds = Object.keys(feedStatus).filter((k) => k !== "__fileGuard").length || liveFeedList().length;
  const feedErrors = Object.entries(feedStatus).filter(([, s]) => s && !s.ok).map(([url, s]) => ({ url, label: s.label || url, error: s.error }));
  const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const isFileGuard = !!feedStatus.__fileGuard;
  const debugView = (() => {
    try {
      return new URLSearchParams(location.search).has("debug");
    } catch (e) {
      return false;
    }
  })();
  const showDevDetail = isLocalHost || isFileGuard || debugView;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today \xB7 live"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Live parliament"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Official broadcast embed, APH source links, and live RSS polling from configured official feeds.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn " + (which === "house" ? "primary" : ""), onClick: () => setWhich("house") }, "House"), /* @__PURE__ */ React.createElement("button", { className: "btn " + (which === "senate" ? "primary" : ""), onClick: () => setWhich("senate") }, "Senate"), /* @__PURE__ */ React.createElement("button", { className: "btn " + (which === "federation" ? "primary" : ""), onClick: () => setWhich("federation") }, "Federation"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy a timestamped live action note", onClick: () => copyLiveActionNote("Flag moment", which, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 13 }), " Flag moment"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-live-main", style: { gap: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(LiveBroadcast, { which, toast }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "src-badge" }, "AUSParliamentLive \xB7 YouTube embed"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--teal)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " AUSParliamentLive"), /* @__PURE__ */ React.createElement("a", { href: "https://parlview.aph.gov.au/", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--teal)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " ParlView archive"), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Hansard", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--teal)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " Hansard"), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", style: { marginLeft: "auto" }, title: "Copy a Hansard follow-up note", onClick: () => copyLiveActionNote("Transcript follow-up", which, toast) }, "Request transcript"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", title: "Copy a source-backed clip note", onClick: () => copyLiveActionNote("Clip to brief", which, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Clip to brief")), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Currently on program"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, which === "house" ? "House of Representatives" : which === "senate" ? "Senate" : "Federation Chamber"), /* @__PURE__ */ React.createElement("a", { href: which === "house" ? "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" : "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { marginLeft: "auto", fontSize: 11.5, color: "var(--teal)", textDecoration: "none" } }, "Open daily program ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "timeline" }, /* @__PURE__ */ React.createElement("div", { className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "12:00"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Question time \xB7 ", /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("bill", "BILL-2026-048") }, "Digital ID Amendment"), " expected")), /* @__PURE__ */ React.createElement("div", { className: "tl-item teal" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "14:00"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Government business \xB7 2nd reading ", /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("bill", "BILL-2026-041") }, "Cyber Security Bill"), " ", /* @__PURE__ */ React.createElement("span", { className: "tag brass", style: { marginLeft: 6 } }, "Watchlist \xB7 Cyber"))), /* @__PURE__ */ React.createElement("div", { className: "tl-item info" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, "16:30"), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, "Adjournment debate"))))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Official APH links"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Source pages")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "g-link-grid", style: { display: "grid", gap: 8 } }, [
    { name: "Hansard", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", desc: "Official Hansard source page" },
    { name: "ParlInfo Search", url: "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p", desc: "Official search page" },
    { name: "Bills Search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", desc: "Official bills search page" },
    { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", desc: "Official Senate program page" },
    { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official House program page" },
    { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official division lists page" },
    { name: "Committee RSS feeds", url: "https://www.aph.gov.au/Parliamentary_Business/Committees", desc: "Official committee RSS listing" },
    { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Official member roster page" }
  ].map((c, i) => /* @__PURE__ */ React.createElement("a", { key: i, href: c.url, target: "_blank", rel: "noopener noreferrer", style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: 6, textDecoration: "none", color: "var(--ink)", background: "var(--panel-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, c.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 2 } }, c.desc)), /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, stroke: "var(--ink-3)" }))))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recent items \xB7 APH RSS"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, loading && events.length === 0 ? "Polling\u2026" : `${events.length} tabled items \xB7 ${liveCount}/${totalFeeds} feeds${lastPoll ? " \xB7 as at " + fmtTime(lastPoll) + " AEST" : ""}`)), /* @__PURE__ */ React.createElement("div", { className: "panel-body", style: { maxHeight: 720, overflowY: "auto" } }, loading && events.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 0" }, "aria-label": "Loading live RSS feed", "aria-busy": "true" }, [...Array(6)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonRow, { key: i }))), !loading && events.length === 0 && (showDevDetail ? /* @__PURE__ */ React.createElement("div", { className: "empty-state error", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 15, stroke: "var(--caution)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--caution)", fontWeight: 500, marginBottom: 6 } }, "No items returned"), isFileGuard ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "This page was opened from the file system, so the browser cannot reach the feed proxy."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4 } }, "Serve over http, for example: ", /* @__PURE__ */ React.createElement("strong", null, "python -m http.server 8080"))) : isLocalHost ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "The local CORS proxy did not return data. Either the proxy is not running or APH rejected the request."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4 } }, "Start the proxy: ", /* @__PURE__ */ React.createElement("strong", null, "node proxy-server.js"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "Worker returned no items. Confirm the Cloudflare Worker is deployed and this origin is on its CORS allowlist."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4, wordBreak: "break-all" } }, "Worker: ", /* @__PURE__ */ React.createElement("strong", null, "https://aph-proxy.jvega019.workers.dev/rss?u="))), feedErrors.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { margin: "0 0 8px" } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".18em", marginBottom: 4 } }, "Feed errors"), feedErrors.slice(0, 8).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 8, padding: "2px 0" } }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 12, stroke: "var(--ember-flash)" }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, minWidth: 0 } }, e.label), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-4)" } }, e.error)))), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "Links below still open the raw feeds in a new tab."))) : /* @__PURE__ */ React.createElement("div", { className: "empty-state", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 15, stroke: "var(--ink-4)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontWeight: 500, marginBottom: 6 } }, "Live feed reconnecting"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "No new items in the latest poll. The official source links open the raw feeds directly.")))), events.map((e, i) => /* @__PURE__ */ React.createElement("a", { key: e.link || e.title + i, href: safeHttpUrl(e.link) || safeHttpUrl(e.sourceUrl) || "#", target: "_blank", rel: "noopener noreferrer", className: "clk data-row g-live-event", style: { display: "grid", gap: 10, borderRadius: 6, alignItems: "start", textDecoration: "none", color: "inherit" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", paddingTop: 2 } }, fmtTime(e.date)), /* @__PURE__ */ React.createElement("div", { style: { paddingTop: 3 } }, e.kind === "division" && /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 13, stroke: "var(--escalate)" }), e.kind === "hearing" && /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13, stroke: "var(--teal)" }), e.kind === "inquiry" && /* @__PURE__ */ React.createElement(Icon, { name: "pattern", size: 13, stroke: "var(--brass)" }), e.kind === "digest" && /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13, stroke: "var(--brass)" }), e.kind === "program" && /* @__PURE__ */ React.createElement(Icon, { name: "clock", size: 13, stroke: "var(--ink-3)" }), e.kind === "report" && /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13, stroke: "var(--teal)" }), e.kind === "signal" && /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13, stroke: "var(--ink-3)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink)", lineHeight: 1.4 } }, e.title), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, e.kind), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10.5, color: "var(--teal)", fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", gap: 3 } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 10 }), " ", e.sourceLabel)))))), /* @__PURE__ */ React.createElement("div", { className: "panel-foot", style: { flexDirection: "column", alignItems: "flex-start", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-3)" } }, "Live RSS \xB7 aph.gov.au via ", isLocalHost ? "local CORS proxy (proxy-server.js)" : "Cloudflare Worker proxy", " \xB7 refreshes every 2 min"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)" } }, "Last poll: ", lastPoll ? fmtTime(lastPoll) : "\u2014", " \xB7 Click any item to open source")))));
}
function PageSources() {
  const { openModal, addFeed, state, toast } = useStore();
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState(null);
  const [newUrl, setNewUrl] = useState("https://www.aph.gov.au/.../FlagPost/Blog_entries");
  const [newName, setNewName] = useState("FlagPost Blog (HTML)");
  const startTest = () => {
    setTesting(true);
    setTestState(null);
    setTimeout(() => setTestState({
      status: "warn",
      lines: [
        { t: "ok", s: "URL resolved \xB7 200 OK" },
        { t: "ok", s: "Content-Type: text/html \xB7 not XML" },
        { t: "warn", s: "No <rss> root detected \u2014 attempting HTML parse" },
        { t: "ok", s: "Found 12 dated entries" },
        { t: "warn", s: "Latest item date \xB7 5 days old \xB7 verify cadence" },
        { t: "ok", s: "Links extractable \xB7 12/12" },
        { t: "warn", s: "Recommended: mark as Needs validation before routing to modules" }
      ]
    }), 1100);
  };
  const saveFeed = () => {
    if (!newName.trim()) return;
    addFeed({ id: "custom-" + Date.now(), name: newName.trim(), url: newUrl, status: "review", group: "Custom" });
    setTestState(null);
  };
  const allFeeds = [...APH_FEEDS, ...state.feeds.map((f) => ({ ...f, last: "just now", today: 0, fpr: "\u2014", modules: ["Custom"], parser: "Needs validation", authority: "Custom", confidence: "\u2014" }))];
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Admin"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Sources"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Official APH feed bundle plus any custom RSS feeds you've added. Official feeds are polled live; custom validation is a prototype workflow until backend validation is connected.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Re-polls the live RSS feeds if the Live page poller is mounted", onClick: () => {
    if (typeof window.__refreshLiveFeeds === "function") {
      window.__refreshLiveFeeds();
      toast("Live feeds re-polled");
    } else {
      toast("Open the Live page to start the feed poller");
    }
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13 }), " Refresh all"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    var _a;
    return (_a = document.getElementById("new-feed-url")) == null ? void 0 : _a.focus();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " Add feed"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-4", style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Active feeds"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, sourceCounts().total), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Official APH feeds configured")), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Healthy"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 18, color: "var(--ink-3)" } }, "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after live poll")), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Items ingested \xB7 today"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 18, color: "var(--ink-3)" } }, "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after live poll")), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "False positive rate"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 18, color: "var(--ink-3)" } }, "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after 30 days' operation"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Official APH Feed Bundle"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, sourceCounts().total, " official feeds configured \xB7 click a row for detail")), /* @__PURE__ */ React.createElement("table", { className: "ds" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Source"), /* @__PURE__ */ React.createElement("th", null, "Group"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null, "Last"), /* @__PURE__ */ React.createElement("th", { className: "num" }, "Today"), /* @__PURE__ */ React.createElement("th", null, "FPR"), /* @__PURE__ */ React.createElement("th", null, "Parser"))), /* @__PURE__ */ React.createElement("tbody", null, allFeeds.map((f) => {
    var _a;
    return /* @__PURE__ */ React.createElement("tr", { key: f.id, onClick: () => f.group !== "Custom" && openModal("feed", f.id) }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, f.name), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)" } }, f.url.length > 56 ? f.url.slice(0, 56) + "\u2026" : f.url)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, f.group)), /* @__PURE__ */ React.createElement("td", null, f.lastStatusCode != null ? f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, f.last || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "num" }, (_a = f.lastItemCount) != null ? _a : "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, f.fpr)), /* @__PURE__ */ React.createElement("td", null, f.parser || "\u2014"));
  })))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Add RSS feed"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "6-step workflow")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "new-feed-name", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Display name"), /* @__PURE__ */ React.createElement("input", { id: "new-feed-name", value: newName, onChange: (e) => setNewName(e.target.value), className: "search", style: { padding: "8px 10px", marginTop: 4, marginBottom: 8, width: "100%" } }), /* @__PURE__ */ React.createElement("label", { htmlFor: "new-feed-url", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Paste RSS URL"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } }, /* @__PURE__ */ React.createElement("input", { id: "new-feed-url", value: newUrl, onChange: (e) => setNewUrl(e.target.value), className: "search", style: { flex: 1, padding: "8px 10px" } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: startTest }, testing && !testState ? "Testing\u2026" : "Validate")), /* @__PURE__ */ React.createElement("div", { className: "g-feed-form", style: { marginTop: 12, display: "grid", gap: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 } }, "Source type"), /* @__PURE__ */ React.createElement("select", { className: "btn", "aria-label": "Source type", style: { width: "100%", padding: "7px 10px" } }, /* @__PURE__ */ React.createElement("option", null, "Parliamentary Library"), /* @__PURE__ */ React.createElement("option", null, "Senate"), /* @__PURE__ */ React.createElement("option", null, "House"), /* @__PURE__ */ React.createElement("option", null, "Department"), /* @__PURE__ */ React.createElement("option", null, "Ministerial"), /* @__PURE__ */ React.createElement("option", null, "Regulator"), /* @__PURE__ */ React.createElement("option", null, "News"), /* @__PURE__ */ React.createElement("option", null, "Think tank"), /* @__PURE__ */ React.createElement("option", null, "Industry"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 4 } }, "Refresh cadence"), /* @__PURE__ */ React.createElement("select", { className: "btn", "aria-label": "Refresh cadence", style: { width: "100%", padding: "7px 10px" } }, /* @__PURE__ */ React.createElement("option", null, "Hourly"), /* @__PURE__ */ React.createElement("option", null, "Every 15 min"), /* @__PURE__ */ React.createElement("option", null, "Daily")))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 } }, "Route to modules"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, ["Today's Signal", "Committees", "Bills", "Parliament", "Briefings", "Emerging Issues", "Watchlists", "Search"].map((m) => /* @__PURE__ */ React.createElement("label", { key: m, style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", border: "1px solid var(--line-2)", borderRadius: 999, fontSize: 12, cursor: "pointer" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", defaultChecked: ["Emerging Issues", "Briefings"].includes(m), style: { accentColor: "var(--brass)" } }), m)))), testState && /* @__PURE__ */ React.createElement("div", { className: "feed-test", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6, letterSpacing: ".1em", display: "flex", alignItems: "center", gap: 7 }, className: "warn" }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 12 }), " Parser: needs validation"), testState.lines.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "feed-test-line " + l.t }, /* @__PURE__ */ React.createElement(Icon, { name: l.t === "ok" ? "check" : l.t === "warn" ? "flag" : "close", size: 12 }), /* @__PURE__ */ React.createElement("span", null, l.s))), /* @__PURE__ */ React.createElement("button", { className: "btn primary sm", style: { marginTop: 10 }, onClick: saveFeed }, "Save feed")))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Not yet connected"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Needs parser or source")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, [
    { name: "Hansard extraction", note: "Needs transcript parser" },
    { name: "QON tracking", note: "Needs source or parliamentary export" },
    { name: "Full bill progress", note: "Needs bills database beyond Digest RSS" },
    { name: "News / media monitoring", note: "Optional bundle, later" },
    { name: "Internal executive briefings", note: "Governance controls required" }
  ].map((x) => /* @__PURE__ */ React.createElement("div", { key: x.name, style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--line-2)" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13 } }, x.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, x.note)), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: "Copy a backlog request for this source", onClick: () => copyBacklogRequest(x.name, x.note, toast) }, "Request"))))))));
}
function PageCommittees() {
  const { openModal, toast } = useStore();
  const [highOnly, setHighOnly] = useState(false);
  const rows = highOnly ? COMMITTEE_ITEMS.filter((i) => i.att === "high") : COMMITTEE_ITEMS;
  const today = rows.filter((i) => i.when.startsWith("Today"));
  const upcoming = rows.filter((i) => !i.when.startsWith("Today") && !i.when.startsWith("Yesterday"));
  const recent = rows.filter((i) => i.when.startsWith("Yesterday"));
  const exportPrepPack = () => {
    exportRowsCSV(
      ["when", "type", "committee", "topic", "portfolio", "attention"],
      rows.map((r) => [r.when, r.type, r.name, r.topic, r.portfolio, r.att]),
      `parliament-pulse-committee-prep-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`
    );
    toast("Committee prep pack exported", "brass");
  };
  const CommitteeTable = ({ rows: rows2, compact }) => /* @__PURE__ */ React.createElement("table", { className: "ds" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "When"), /* @__PURE__ */ React.createElement("th", null, "Type"), /* @__PURE__ */ React.createElement("th", null, "Committee"), !compact && /* @__PURE__ */ React.createElement("th", null, "Topic"), /* @__PURE__ */ React.createElement("th", null, "Portfolio"), /* @__PURE__ */ React.createElement("th", null, "Attention"))), /* @__PURE__ */ React.createElement("tbody", null, rows2.map((r, i) => {
    const canOpen = !!(r.id && ENTITIES.committees[r.id]);
    return /* @__PURE__ */ React.createElement("tr", { key: r.name + r.when, onClick: canOpen ? () => openModal("committee", r.id) : void 0, style: canOpen ? void 0 : { opacity: 0.6, cursor: "not-allowed" } }, /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-2)" } }, r.when), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, r.type)), /* @__PURE__ */ React.createElement("td", null, r.name, compact && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 12 } }, r.topic)), !compact && /* @__PURE__ */ React.createElement("td", null, r.topic), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, r.portfolio), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(Att, { level: r.att })));
  })));
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Committees"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Powered by Senate and House committee feeds. Click any row to open the committee, hearings, inquiries and prep pack.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { className: "btn" + (highOnly ? " primary" : ""), title: "Toggle high-attention committee rows", onClick: () => setHighOnly((v) => !v) }, /* @__PURE__ */ React.createElement(Icon, { name: "filter", size: 13 }), " High attention"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", title: "Export the current committee prep rows", onClick: exportPrepPack }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Export prep pack"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-3", style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Today"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, "2", /* @__PURE__ */ React.createElement("span", { className: "unit" }, "hearings"))), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Upcoming \xB7 7 days"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, "3", /* @__PURE__ */ React.createElement("span", { className: "unit" }, "hearings"))), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Reports tabled \xB7 30 days"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, "5"))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Today's hearings"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, today.length, " items")), /* @__PURE__ */ React.createElement(CommitteeTable, { rows: today })), /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Upcoming hearings"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Next 7 days")), /* @__PURE__ */ React.createElement(CommitteeTable, { rows: upcoming, compact: true })), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recently tabled / opened"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Last 48h")), /* @__PURE__ */ React.createElement(CommitteeTable, { rows: recent, compact: true }))));
}
function PageBills() {
  const { openModal, state } = useStore();
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament \xB7 Bills Intelligence"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Bills intelligence"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Click a bill for full details, provisions and timeline. Assign a policy owner directly from the bill detail.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => {
    const headers = ["ref", "title", "stage", "portfolio", "digest", "owner", "attention"];
    const rows = BILLS.map((b) => [
      b.ref,
      b.title,
      b.stage,
      b.portfolio,
      b.digest,
      state.owners[b.ref] || b.owner,
      b.att
    ]);
    exportRowsCSV(headers, rows, `parliament-pulse-bills-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`);
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 13 }), " Export register"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => openModal("bill", "BILL-2026-048") }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Draft bill brief"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Tracked bills"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "5 of 38 watchlisted")), /* @__PURE__ */ React.createElement("table", { className: "ds" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Ref"), /* @__PURE__ */ React.createElement("th", null, "Title"), /* @__PURE__ */ React.createElement("th", null, "Stage"), /* @__PURE__ */ React.createElement("th", null, "Portfolio"), /* @__PURE__ */ React.createElement("th", null, "Digest"), /* @__PURE__ */ React.createElement("th", null, "Owner"), /* @__PURE__ */ React.createElement("th", null, "Attn"))), /* @__PURE__ */ React.createElement("tbody", null, BILLS.map((b) => {
    const owner = state.owners[b.ref] || b.owner;
    const featured = b.ref === "BILL-2026-048";
    return /* @__PURE__ */ React.createElement("tr", { key: b.ref, onClick: () => openModal("bill", b.ref), "aria-current": featured ? "true" : void 0, style: featured ? { background: "var(--panel-hi)", boxShadow: "inset 2px 0 0 var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, b.ref), /* @__PURE__ */ React.createElement("td", { style: { fontWeight: 500 } }, b.title), /* @__PURE__ */ React.createElement("td", { style: { color: "var(--ink-2)" } }, b.stage), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, b.portfolio), /* @__PURE__ */ React.createElement("td", null, b.digest === "Published" ? /* @__PURE__ */ React.createElement("span", { className: "tag teal" }, "Published") : /* @__PURE__ */ React.createElement("span", { className: "tag" }, "Pending")), /* @__PURE__ */ React.createElement("td", { style: { color: owner === "\u2014" ? "var(--ink-4)" : owner !== b.owner ? "var(--ok)" : "var(--ink-2)" } }, owner), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(Att, { level: b.att })));
  })))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Related divisions"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House \xB7 last 7 days")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, DIVISIONS.map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d.when + d.bill, className: "clk list-row", onClick: () => openModal("division", d), style: { borderRadius: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, d.when, " \xB7 ", d.chamber, " \xB7 ", d.bill), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginTop: 2 } }, d.q), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)", marginTop: 2 } }, d.result)))))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Bills Digest"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Featured \xB7 Digital ID Amendment (Assurance) Bill 2026 (highest attention)"), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto" } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => openModal("bill", "BILL-2026-048") }, "Open full detail \u2192"))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h5", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", margin: "0 0 4px" } }, "Purpose"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, color: "var(--ink-2)" } }, "Amends the Digital ID Act to expand the scope of the accreditation scheme and introduce new consumer assurance provisions, including revised obligations on accredited entities handling biometric attributes."), /* @__PURE__ */ React.createElement("h5", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", margin: "14px 0 4px" } }, "Key provisions"), /* @__PURE__ */ React.createElement("ul", { style: { margin: 0, paddingLeft: 18, color: "var(--ink-2)" } }, /* @__PURE__ */ React.createElement("li", null, "Part 2: accreditation scope expanded to cover state-level identity exchanges"), /* @__PURE__ */ React.createElement("li", null, "Part 4: new reporting obligations on biometric attribute use"), /* @__PURE__ */ React.createElement("li", null, "Schedule 1: consequential amendments to Privacy Act s.26"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h5", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", margin: "0 0 4px" } }, "Portfolio relevance"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, color: "var(--ink-2)" } }, "High. Matches Digital identity and Data sharing & privacy watchlists."), /* @__PURE__ */ React.createElement("h5", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", margin: "14px 0 4px" } }, "Recommended action"), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderLeft: "3px solid var(--brass)", borderRadius: "0 6px 6px 0", background: "var(--panel-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink)", fontWeight: 600 } }, "Draft Executive Brief"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-2)", marginTop: 4 } }, "Scope of accreditation warrants director-level awareness before 2nd reading.")))))));
}
function PageParliament() {
  const { openModal, toast } = useStore();
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Today in Parliament"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Daily program, divisions, and chamber-relevant items from official APH feeds."))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "House \xB7 daily program"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "24 Apr 2026")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "timeline" }, [
    ["09:30", "House meets", null],
    ["10:00", "Government business: 2nd reading, Cyber Security Legislation Amendment Bill 2026", "BILL-2026-041"],
    ["11:15", "Matter of public importance", null],
    ["12:00", "Question time", null],
    ["14:00", "Private members' business", null],
    ["16:30", "Adjournment debate", null]
  ].map(([t, b, billRef], i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "tl-item " + (billRef ? "teal" : "") }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, t), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, billRef ? /* @__PURE__ */ React.createElement("button", { className: "linklike", onClick: () => openModal("bill", billRef) }, b) : b, billRef && /* @__PURE__ */ React.createElement("span", { className: "tag brass", style: { marginLeft: 8 } }, "Watchlist \xB7 Cyber"))))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recent divisions"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, DIVISIONS.map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d.when + d.bill, className: "clk list-row", onClick: () => openModal("division", d), style: { borderRadius: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, d.when, " \xB7 ", d.bill), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginTop: 2 } }, d.q), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)", marginTop: 2 } }, d.result)))))), /* @__PURE__ */ React.createElement("div", { className: "grid g-2", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "House news & media"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Official feeds")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, [
    "Speaker announces procedural changes to Wednesday sittings",
    "Parliamentary Triangle security review complete",
    "New Select Committee on AI Governance established"
  ].map((t, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { padding: "10px 0", borderBottom: i < 2 ? "1px solid var(--line)" : 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13 } }, t), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", marginTop: 4 } }, ["08:04", "Yesterday 16:12", "22 Apr 11:30"][i], " \xB7 House News"))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Parliamentary lines"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "For Cyber Security Bill 2nd reading"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { marginLeft: "auto" } }, "Representative data")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px dashed var(--line-2)", borderRadius: 8, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, fontStyle: "italic" } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8, fontStyle: "normal" } }, "No lines drafted yet"), 'Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow. ', /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Representative data")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn sm primary", onClick: () => toast("Generate a brief from a signal first to start the drafting workflow") }, "Submit for review"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", onClick: () => toast("Generate a brief from a signal first to start the drafting workflow") }, "Regenerate"))))));
}
function PagePatterns() {
  const { openModal, toast } = useStore();
  const [clusterStatus, setClusterStatus] = useState("Needs analyst review");
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament \xB7 Scrutiny"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "QON pattern engine"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Detects clustered scrutiny across members, topics and targets. Click any member to open their profile."))), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: "var(--panel-hi)", border: "1px solid var(--line-bright)", borderRadius: 8, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", color: "var(--ink-2)", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 14, stroke: "var(--info)" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "Design-state module."), " Direct QON feed not yet connected. Patterns below use sample scrutiny data. Status visible on Sources page.")), /* @__PURE__ */ React.createElement("div", { className: "pattern" }, /* @__PURE__ */ React.createElement("div", { className: "ribbon" }, "Clustered pattern \xB7 moderate confidence"), /* @__PURE__ */ React.createElement("div", { className: "serif", style: { fontSize: 22, fontWeight: 500, marginBottom: 6, paddingRight: 200 } }, "Clustered scrutiny pattern on digital procurement governance"), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: 13.5, maxWidth: 720 } }, "4 related questions lodged by 3 members within 48 hours, all targeting digital services portfolio. Trigger likely: ANAO report tabled 22 Apr. Cross-source reinforcement with today's Senate inquiry."), /* @__PURE__ */ React.createElement("div", { className: "grid g-4", style: { marginTop: 16, marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Members"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginTop: 4 } }, "3")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Questions"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginTop: 4 } }, "4")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Window"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginTop: 4 } }, "48h")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Target"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginTop: 4, lineHeight: 1.25 } }, "Minister for Digital Services / Dept."))), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px dashed var(--line-2)", paddingTop: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 } }, "Evidence \xB7 click member for profile"), QON_PATTERN.items.map((q, i) => {
    const mid = q.memberId;
    const canOpen = !!(mid && ENTITIES.members[mid]);
    return /* @__PURE__ */ React.createElement("div", { key: q.when + q.who, className: "g-qon-evidence", style: { display: "grid", gap: 12, padding: "8px 0", borderBottom: i < QON_PATTERN.items.length - 1 ? "1px solid var(--line)" : 0, alignItems: "start", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-3)" } }, q.when), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "tag brass" + (canOpen ? " clk" : ""), onClick: canOpen ? () => openModal("member", mid) : void 0, style: canOpen ? void 0 : { opacity: 0.65, cursor: "not-allowed" } }, q.who)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, q.q), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, q.chamber)));
  })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy an Estimates monitor note", onClick: () => copyText(`# Estimates monitor note
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}

Pattern: ${QON_PATTERN.title}
Status: ${clusterStatus}

Recommended action: monitor for Estimates references and verify against Hansard or QON source material.`, toast, "Estimates monitor note copied") }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Draft Estimates monitor note"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Mark this cluster as tracked in this session", onClick: () => {
    setClusterStatus("Tracked");
    toast("Cluster marked as tracked", "brass");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " Track cluster"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Confirm the analyst classification for this session", onClick: () => {
    setClusterStatus("Confirmed as coordinated");
    toast("Cluster confirmed for review", "brass");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 13 }), " Confirm as coordinated"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", title: "Classify the cluster as coincidence in this session", onClick: () => {
    setClusterStatus("Marked as coincidence");
    toast("Cluster marked as coincidence");
  } }, "Mark as coincidence")), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-3)", marginTop: 8, letterSpacing: ".08em" } }, "Session status: ", clusterStatus)), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "How patterns are detected"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Indicator logic")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, [
    ["Multiple members", "Three or more MPs or senators asking related questions"],
    ["Short timeframe", "Within 24 to 72 hours"],
    ["Shared topic", "Topic similarity above 0.78 on embedding cluster"],
    ["Shared target", "Same minister, department or program"],
    ["Similar phrasing", "Repeated structure or near-identical wording"],
    ["Related external trigger", "Audit report, media article, or committee referral"],
    ["Cross-source reinforcement", "QON + Hansard + committee or inquiry overlap"],
    ["Human override", "Analyst must confirm any 'coordinated' label"]
  ].map(([k, v]) => /* @__PURE__ */ React.createElement("div", { key: k, style: { padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, k), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-3)", marginTop: 2 } }, v)))))));
}
function PageBriefings() {
  const [selId, setSelId] = useState(null);
  const { toast, state, setSignalSearchQuery, navigate } = useStore();
  const generated = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = SIGNALS.find((s) => s.id === sid);
    const label = sig ? sig.title.slice(0, 40) + "\u2026" : sid;
    return { type: v.type || "Executive Brief", for: label, status: "Copied \xB7 clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts).slice(0, 3);
  const staticBriefs = [
    { type: "Daily Signal Brief", for: "Director, Digital Policy", status: "Example \xB7 drafted" },
    { type: "Committee Brief", for: "Procurement lead", status: "Example \xB7 awaiting review" },
    { type: "Bill Digest Note", for: "Identity policy", status: "Example \xB7 drafted" },
    { type: "Estimates Monitor Note", for: "Estimates pack", status: "Example \xB7 in progress" }
  ];
  const briefs = [...generated, ...staticBriefs];
  const briefId = (b) => b._sid || `${b.type}|${b.for}`;
  const selected = briefs.find((b) => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Workflow"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Briefings"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Generated local briefs appear above. Representative queue examples below show the intended review workflow: What happened \xB7 Source \xB7 Why it matters \xB7 Recommended action \xB7 Evidence \xB7 Uncertainty \xB7 Human review.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => downloadBriefingQueue(briefs, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 13 }), " Export queue"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", title: "Open signals to generate a brief", onClick: () => {
    setSignalSearchQuery("");
    navigate("signals");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " New brief"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-briefings", style: { gap: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Queue"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, briefs.length, " pending")), /* @__PURE__ */ React.createElement("div", null, briefs.map((b, i) => {
    const id = briefId(b);
    return /* @__PURE__ */ React.createElement("div", { key: id, className: "list-row", onClick: () => setSelId(id), style: { cursor: "pointer", background: selectedId === id ? "var(--panel-hi)" : "transparent", borderLeft: selectedId === id ? "2px solid var(--brass)" : "2px solid transparent" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, b.type), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, "For ", b.for), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { marginTop: 4, color: b.status.startsWith("Copied") ? "var(--ok)" : b.status.includes("in progress") ? "var(--caution)" : b.status.includes("awaiting") ? "var(--info)" : "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, b.status));
  }))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, selected ? selected.type : "No brief", " \xB7 preview"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, selected ? `For ${selected.for}` : "Queue empty"), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", disabled: !selected, onClick: () => window.print() }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 12 }), " Print"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", disabled: !selected, title: "Copy a send-ready handoff note", onClick: () => copyText(`# Brief handoff
Type: ${selected.type}
For: ${selected.for}
Status: ${selected.status}
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Brief handoff copied") }, "Copy handoff"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", disabled: !selected, title: "Mark this brief reviewed in the local queue", onClick: () => toast(`Marked reviewed: ${selected.type}`, "brass") }, "Mark reviewed"))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, (() => {
    const b = selected;
    if (!b) return /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No briefs in the queue.");
    const sig = b._sid ? SIGNALS.find((s) => s.id === b._sid) : null;
    if (sig) {
      const brief = buildBriefSections(sig);
      return /* @__PURE__ */ React.createElement("div", { className: "brief" }, /* @__PURE__ */ React.createElement("div", { className: "meta" }, "PARLIAMENT PULSE \xB7 ", b.type.toUpperCase(), " \xB7 ", brief.meta.date, " \xB7 ", brief.meta.time), /* @__PURE__ */ React.createElement("h3", null, brief.title), /* @__PURE__ */ React.createElement("h5", null, "What happened"), /* @__PURE__ */ React.createElement("div", null, brief.summary), /* @__PURE__ */ React.createElement("h5", null, "Source"), /* @__PURE__ */ React.createElement("div", null, brief.meta.source, " \xB7 ", brief.meta.sourceAuthority, " \xB7 ", brief.meta.date), /* @__PURE__ */ React.createElement("h5", null, "Why it matters"), /* @__PURE__ */ React.createElement("div", null, brief.whyItMatters), /* @__PURE__ */ React.createElement("h5", null, "Recommended action"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, brief.recommendedAction.label, "."), " ", brief.recommendedAction.reason), brief.evidence.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h5", null, "Evidence"), /* @__PURE__ */ React.createElement("ul", null, brief.evidence.map((e, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("a", { href: e.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--brief-link)", textDecoration: "underline" } }, e.label))))), /* @__PURE__ */ React.createElement("h5", null, "Provenance"), /* @__PURE__ */ React.createElement("div", null, brief.provenance));
    }
    return /* @__PURE__ */ React.createElement("div", { className: "brief" }, /* @__PURE__ */ React.createElement("div", { className: "meta" }, "PARLIAMENT PULSE \xB7 ", b.type.toUpperCase(), " \xB7 24 APR 2026 \xB7 08:20"), /* @__PURE__ */ React.createElement("h3", null, "New Senate inquiry: Digital procurement governance"), /* @__PURE__ */ React.createElement("h5", null, "What happened"), /* @__PURE__ */ React.createElement("div", null, "The Finance and Public Administration References Committee has opened an inquiry into Commonwealth procurement and contract governance for digital programs over $100m. Submissions close 19 May."), /* @__PURE__ */ React.createElement("h5", null, "Source"), /* @__PURE__ */ React.createElement("div", null, "APH Senate New Inquiries RSS \xB7 Official \xB7 validated 24 Apr 08:15."), /* @__PURE__ */ React.createElement("h5", null, "Why it matters"), /* @__PURE__ */ React.createElement("div", null, "The inquiry directly overlaps two watchlists (Digital procurement, Procurement) and follows last week's ANAO report tabling. Preliminary scrutiny pattern detected on the same topic (4 QONs / 3 members / 48h)."), /* @__PURE__ */ React.createElement("h5", null, "Recommended action"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Assign Policy Owner."), " Draft submission plan by 02 May. Coordinate with Legal on contract-variation data scope."), /* @__PURE__ */ React.createElement("h5", null, "Evidence"), /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, "APH \xB7 inquiry listing (primary)"), /* @__PURE__ */ React.createElement("li", null, "ANAO \xB7 performance audit report 2025\u201326/41"), /* @__PURE__ */ React.createElement("li", null, "Internal \xB7 existing procurement governance framework v4.2")), /* @__PURE__ */ React.createElement("h5", null, "Uncertainty"), /* @__PURE__ */ React.createElement("div", null, "The inquiry's terms of reference may expand during hearings. Confidence: Moderate."), /* @__PURE__ */ React.createElement("h5", null, "Human review"), /* @__PURE__ */ React.createElement("div", null, "Required \xB7 to be cleared by Director, Digital Strategy."));
  })()))));
}
function PageWatchlists() {
  const { openModal, createWatchlist, state, removeWatchlist } = useStore();
  const [newName, setNewName] = useState("");
  const all = [...WATCHLISTS, ...state.watchlistCreated];
  const [selectedWl, setSelectedWl] = useState(() => all[0]);
  const selectedKeywords = watchlistKeywords(selectedWl || all[0]);
  const trackedItems = Object.keys(state.watchlistAdds || {}).map((key) => {
    const sig = SIGNALS.find((s) => s.id === key);
    return { key, title: sig ? sig.title : key, meta: sig ? `${sig.id} \xB7 ${sig.source}` : "Entity watch" };
  });
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Workflow"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Watchlists"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "The relevance engine. Click any watchlist for matches and configuration.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("input", { "aria-label": "New watchlist name", placeholder: "New watchlist name", value: newName, onChange: (e) => setNewName(e.target.value), className: "search", style: { padding: "7px 10px" } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (newName.trim()) {
      createWatchlist(newName.trim());
      setNewName("");
    }
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " Create"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-3" }, all.map((w) => {
    const trend = Array.isArray(w.trend) ? w.trend : [];
    const max = Math.max(...trend, 1);
    return /* @__PURE__ */ React.createElement("div", { key: w.name, className: "wl" + ((selectedWl == null ? void 0 : selectedWl.name) === w.name ? " active" : ""), onClick: () => {
      setSelectedWl(w);
      openModal("watchlist", w.name);
    }, style: (selectedWl == null ? void 0 : selectedWl.name) === w.name ? { borderColor: "var(--brass)" } : {} }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "wl-name" }, w.name), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10.5, color: "var(--brass)", background: "var(--panel-hi)", border: "1px solid var(--brass-soft)", padding: "1px 6px", borderRadius: 4, marginLeft: "auto" } }, w.matches, " matches")), /* @__PURE__ */ React.createElement("div", { className: "wl-meta" }, /* @__PURE__ */ React.createElement("span", null, w.keywords, " keywords"), /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, "7-day")), /* @__PURE__ */ React.createElement("div", { className: "spark", style: { marginTop: 2 } }, trend.map((v, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: { height: v / max * 20 + 2 + "px" } }))));
  })), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Tracked items"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, trackedItems.length, " saved")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, trackedItems.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No tracked items yet. Use Watchlist, Track, or Watch controls to add one.") : trackedItems.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.key, className: "g-tracked-row", style: { display: "grid", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, item.title), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", marginTop: 2 } }, item.meta)), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => removeWatchlist(item.key) }, "Remove"))))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, (selectedWl == null ? void 0 : selectedWl.name) || "Digital government", " \xB7 configuration"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Selected watchlist"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { marginLeft: 8 } }, "Fixture")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "empty", style: { marginBottom: 14 } }, "Keyword chips follow the selected watchlist. Thresholds, linked committees, and audit entries are illustrative in this build."), /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 } }, "Keywords"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, selectedKeywords.map((k) => /* @__PURE__ */ React.createElement("span", { key: k, className: "tag brass" }, k))), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", margin: "14px 0 6px" } }, "Linked committees"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { className: "tag teal clk", onClick: () => openModal("committee", "jcpaa") }, "Joint Committee on Public Accounts & Audit"), /* @__PURE__ */ React.createElement("span", { className: "tag teal clk", onClick: () => openModal("committee", "finpa") }, "Finance & Public Administration (Sen)"), /* @__PURE__ */ React.createElement("span", { className: "tag teal clk", onClick: () => openModal("committee", "econ") }, "Economics Legislation (Sen)"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 } }, "Attention thresholds"), /* @__PURE__ */ React.createElement("div", { className: "g-threshold-row", style: { display: "grid", gap: 8, fontSize: 13 } }, /* @__PURE__ */ React.createElement("div", null, "Source authority weight"), /* @__PURE__ */ React.createElement("div", { className: "mono" }, "0.95"), /* @__PURE__ */ React.createElement("div", null, "Portfolio relevance weight"), /* @__PURE__ */ React.createElement("div", { className: "mono" }, "0.90"), /* @__PURE__ */ React.createElement("div", null, "Minimum attention score"), /* @__PURE__ */ React.createElement("div", { className: "mono" }, "0.55"), /* @__PURE__ */ React.createElement("div", null, "Auto-escalate above"), /* @__PURE__ */ React.createElement("div", { className: "mono" }, "0.80"), /* @__PURE__ */ React.createElement("div", null, "Suppress duplicates within"), /* @__PURE__ */ React.createElement("div", { className: "mono" }, "24h")), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", margin: "14px 0 6px" } }, "Audit \u2014 recent corrections"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-2)" } }, "08:43 \xB7 House media releases \u2192 downgraded procedural items (weight \u22120.12)", /* @__PURE__ */ React.createElement("br", null), "Yesterday 14:10 \xB7 Duplicate suppression added for cross-posted inquiry notices"))))));
}
function PageRadar() {
  const { openModal } = useStore();
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Attention radar"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Transparent categories, no fake precision scores. Click any issue for momentum detail and suggested actions."))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Active issues"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Last 7 days")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "radar-row g-radar-table", style: { display: "grid", padding: "4px 0 10px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Issue"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Attention"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", textAlign: "right" } }, "Sources"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Momentum"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Confidence")), RADAR.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.issue, className: "clk radar-row g-radar-table", onClick: () => openModal("radar", r.issue), style: { display: "grid", padding: "14px 8px", borderBottom: i < RADAR.length - 1 ? "1px solid var(--line)" : 0, gap: 14, alignItems: "center", borderRadius: 6 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 500 } }, r.issue), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-3)", marginTop: 2 } }, r.reason)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Att, { level: r.att })), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { textAlign: "right", color: "var(--ink-2)" } }, r.sources), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "bar" }, /* @__PURE__ */ React.createElement("div", { className: "fill", style: { width: `${r.momentum * 100}%` } }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "ring", style: { "--p": Math.round(r.confidence * 100) }, "data-p": Math.round(r.confidence * 100) })))))));
}
function mapWorkerSignalToCard(row) {
  var _a;
  const when = row.pub_date ? new Date(row.pub_date) : null;
  return {
    id: row.guid,
    time: when ? `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}` : "\u2014",
    date: when ? when.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "\u2014",
    source: row.feed_label,
    sourceGroup: row.source_group,
    title: row.title,
    summary: row.scoring_explanation || "",
    tags: [{ l: row.kind, c: "" }],
    attention: row.attention || "low",
    attentionReason: row.scoring_explanation || "",
    action: "",
    actionReason: "",
    confidence: (_a = row.confidence) != null ? _a : 0,
    sourceAuthority: "Official",
    evidence: row.link ? [{ label: row.feed_label, url: row.link }] : []
  };
}
function PageSignals() {
  const { state, setVisibleSignalOrder, signalSearchQuery, setSignalSearchQuery, liveSignals, setLiveSignals } = useStore();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("time");
  React.useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    if (location.protocol === "file:") return () => {
      cancelled = true;
    };
    const fetchState = async () => {
      var _a;
      if (inFlight) return;
      inFlight = true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8e3);
      try {
        const res = await fetch(`${WORKER_BASE_URL}/state`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const payload = await res.json();
        if (cancelled) return;
        const block = (_a = payload == null ? void 0 : payload.blocks) == null ? void 0 : _a.signals;
        if ((block == null ? void 0 : block.provenance) === "live" && Array.isArray(block.items) && block.items.length > 0) {
          setLiveSignals({ provenance: "live", items: block.items.map(mapWorkerSignalToCard) });
        } else {
          const fallback = (block == null ? void 0 : block.provenance) && block.provenance !== "live" ? block.provenance : "fixture";
          setLiveSignals({ provenance: fallback, items: null });
        }
      } catch (e) {
        if (!cancelled) setLiveSignals((s) => ({ provenance: s.items ? s.provenance : "fixture", items: s.items }));
      } finally {
        clearTimeout(timer);
        inFlight = false;
      }
    };
    fetchState();
    return () => {
      cancelled = true;
    };
  }, []);
  const sourceSignals = liveSignals.items || SIGNALS;
  const visible = React.useMemo(() => {
    let sigs = sourceSignals.filter((s) => !state.archived[s.id]);
    const query = (signalSearchQuery || "").trim().toLowerCase();
    if (query) sigs = sigs.filter(
      (s) => s.title.toLowerCase().includes(query) || s.summary.toLowerCase().includes(query) || s.id.toLowerCase().includes(query) || (s.tags || []).some((t) => (t.l || "").toLowerCase().includes(query))
    );
    if (filter !== "all") sigs = sigs.filter((s) => s.attention === filter);
    if (sort === "score") sigs = [...sigs].sort((a, b) => {
      var _a, _b;
      return (((_a = b.score) == null ? void 0 : _a.authority) || 0) - (((_b = a.score) == null ? void 0 : _b.authority) || 0);
    });
    return sigs;
  }, [sourceSignals, state.archived, filter, sort, signalSearchQuery]);
  React.useEffect(() => {
    setVisibleSignalOrder(visible.map((s) => s.id));
    return () => setVisibleSignalOrder(null);
  }, [visible, setVisibleSignalOrder]);
  const counts = React.useMemo(() => ({
    all: sourceSignals.filter((s) => !state.archived[s.id]).length,
    high: sourceSignals.filter((s) => s.attention === "high" && !state.archived[s.id]).length,
    med: sourceSignals.filter((s) => s.attention === "med" && !state.archived[s.id]).length,
    low: sourceSignals.filter((s) => s.attention === "low" && !state.archived[s.id]).length
  }), [sourceSignals, state.archived]);
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today \xB7 triage workspace"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Signal inbox"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, counts.all, " active signals \xB7 ", counts.high, " high \xB7 ", counts.med, " medium \xB7 ", counts.low, " low. Open any signal to action, archive, or generate a brief.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: liveSignals.provenance,
      title: liveSignals.provenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Representative data \u2014 the /state signals block is not live"
    }
  ), /* @__PURE__ */ React.createElement("label", { htmlFor: "sig-sort", className: "sr-only" }, "Sort signals"), /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { fontSize: 12, color: "var(--ink-4)" } }, "Sort:"), /* @__PURE__ */ React.createElement(
    "select",
    {
      id: "sig-sort",
      value: sort,
      onChange: (e) => setSort(e.target.value),
      style: { background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--ink)", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" }
    },
    /* @__PURE__ */ React.createElement("option", { value: "time" }, "Time"),
    /* @__PURE__ */ React.createElement("option", { value: "score" }, "Authority score")
  ))), signalSearchQuery && /* @__PURE__ */ React.createElement("div", { className: "empty-state", style: { marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 } }, /* @__PURE__ */ React.createElement("span", null, 'Filtered by search: "', signalSearchQuery, '"'), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => setSignalSearchQuery("") }, "Clear search")), /* @__PURE__ */ React.createElement("div", { role: "group", "aria-label": "Filter signals by attention level", style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" } }, [["all", "All"], ["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([val, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: val,
      className: "filter-chip" + (filter === val ? " active" : ""),
      "aria-pressed": filter === val,
      onClick: () => setFilter(val)
    },
    label,
    " ",
    /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.65 } }, "(", counts[val], ")"),
    filter === val && /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, " (active filter)")
  ))), visible.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "No signals" }, filter === "all" ? "No active signals - all archived." : `No ${filter} attention signals.`) : /* @__PURE__ */ React.createElement("div", null, visible.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s }))));
}
Object.assign(window, { PageOverview, PageLive, PageSources, PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists, PageRadar, PageSignals, OnboardingGuide });
