const { useState, useMemo } = React;
function csvEscape(v) {
  const text = v == null ? "" : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function exportSignalsCSV(signals) {
  const source = Array.isArray(signals) ? signals : SIGNALS;
  const headers = ["id", "date", "source", "attention", "title", "link", "action", "confidence"];
  const rows = source.map((s) => {
    var _a;
    return [
      s.id,
      s.date,
      s.source,
      s.attention || "\u2014",
      s.title,
      s.link || "",
      s.action,
      (_a = s.confidence) != null ? _a : "\u2014"
    ];
  });
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
    state: "Configured",
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
    state: "Configured"
  },
  {
    label: "Transport",
    title: "CORS proxy with constrained feed list",
    detail: "Local beta uses proxy-server.js. Production uses the Cloudflare Worker route documented in the repo.",
    state: "Configured"
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
    state: "Configured",
    evidence: "Six official APH RSS feeds plus chamber program and broadcast links.",
    activation: "Keep runtime feed health in Live page; add sitting-status check before claiming current chamber activity.",
    page: "live"
  },
  {
    module: "Sources",
    state: "Configured",
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
  const { state, toast, navigate } = useStore();
  const goto = navigate;
  const live = useLiveState("signals");
  const sourceSignals = live.items || SIGNALS;
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [sortByAttention, setSortByAttention] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const priority = sourceSignals.filter((s) => s.attention === "high" && !state.archived[s.id]);
  let rest = sourceSignals.filter((s) => s.attention !== "high" && !state.archived[s.id]);
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
  const committeeHearingCount = COMMITTEE_ITEMS.filter((i) => i.type === "Hearing").length;
  const committeeInquiryCount = COMMITTEE_ITEMS.filter((i) => i.type === "New inquiry").length;
  const committeeReportCount = COMMITTEE_ITEMS.filter((i) => i.type === "Report tabled").length;
  const overviewBriefs = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = sourceSignals.find((s) => s.id === sid) || SIGNALS.find((s) => s.id === sid);
    const label = sig ? sig.isLive ? sig.source : sig.title.slice(0, 40) + "\u2026" : sid;
    return { type: v.type || "Executive Brief", for: label, ts: v.ts };
  }).sort((a, b) => b.ts - a.ts).slice(0, 4);
  const generateDailyBrief = () => {
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const briefTitleMd = (brief) => brief.isLive ? brief.link ? `[${brief.title}](${brief.link})` : brief.meta.source : brief.title;
    const prioritySections = priority.length === 0 ? ["None."] : priority.map((s) => {
      var _a;
      const brief = buildBriefSections(s, !!s.isLive);
      return [
        `### ${brief.meta.id} - ${briefTitleMd(brief)}`,
        `Source: ${brief.meta.source} | Confidence: ${(_a = brief.meta.confidence) != null ? _a : "\u2014"}/5`,
        brief.summary,
        `**Action:** ${brief.recommendedAction.label}. ${brief.recommendedAction.reason}`,
        ``
      ].join("\n");
    });
    const restSections = rest.length === 0 ? ["None."] : rest.map((s) => {
      const brief = buildBriefSections(s, !!s.isLive);
      return `- [${brief.meta.id}] ${briefTitleMd(brief)} - ${brief.recommendedAction.label}`;
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
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, live.items ? `Live signals \xB7 fetched ${fmtFetchedAt(live.fetchedAt)} AEST \xB7 verify sitting status from the Live page` : "Live data is unavailable \xB7 Parliament Pulse shows nothing rather than an invented signal \xB7 see the Live page for feed health"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Today's signals")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: live.displayProvenance,
      title: live.displayProvenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Signal counts and tiles are representative; the Live page polls official RSS feeds"
    }
  ), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", "aria-expanded": showHelp, onClick: () => setShowHelp((v) => !v) }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 12 }), " How it works"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => exportSignalsCSV(sourceSignals) }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Export CSV"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: copyBetaHandoff }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Copy beta handoff"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: generateDailyBrief }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate daily brief"))), showHelp && /* @__PURE__ */ React.createElement(OnboardingGuide, null), /* @__PURE__ */ React.createElement("div", { className: "command-strip" }, /* @__PURE__ */ React.createElement("div", { className: "cs-primary" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Priority signals"), /* @__PURE__ */ React.createElement("div", { className: "cs-kpi cs-count-up" }, priority.length, /* @__PURE__ */ React.createElement("span", { className: "unit" }, priority.length > 0 ? "to triage" : "clear")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta", style: { marginTop: 8, display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, priority.length + rest.length, " signals in view \xB7 ", sourceSignals.filter((s) => state.archived[s.id]).length, "/", sourceSignals.length, " actioned"), priority.length > 0 && /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginLeft: "auto" }, onClick: () => {
    var _a;
    return (_a = document.getElementById("priority-panel")) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "start" });
  } }, "Triage now \u2192"))), /* @__PURE__ */ React.createElement("div", { className: "cs-secondary", title: "Counted from the committee dataset" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label", style: { display: "flex", alignItems: "center", gap: 8 } }, "Committee activity ", /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Representative data")), /* @__PURE__ */ React.createElement("div", { className: "cs-stat" }, COMMITTEE_ITEMS.length, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "items")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, committeeHearingCount, " hearing", committeeHearingCount !== 1 ? "s" : "", " \xB7 ", committeeInquiryCount, " inquir", committeeInquiryCount !== 1 ? "ies" : "y", " \xB7 ", committeeReportCount, " report", committeeReportCount !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("div", { className: "cs-secondary" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Source health"), /* @__PURE__ */ React.createElement("div", { className: "cs-stat" }, sourceCounts().total, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "feeds")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Official feeds configured \xB7 live poll on Live page"))), /* @__PURE__ */ React.createElement("div", { className: "live-strip g-live-strip", style: { display: "grid", gap: 14, alignItems: "center", padding: "12px 16px", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ok)" } }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-label)", letterSpacing: ".16em", color: "var(--ok)", fontWeight: 600 } }, "LATEST CONFIGURED SOURCES")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 18, fontSize: 12.5, color: "var(--ink-2)", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "House:"), " program links available"), /* @__PURE__ */ React.createElement("div", { style: { width: 1, height: 16, background: "var(--line-2)" } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "Senate:"), " verify hearing status from APH before action")), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Hansard", target: "_blank", rel: "noopener noreferrer", className: "btn sm ghost", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Hansard"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "btn sm ghost", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " YouTube"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", onClick: () => goto && goto("live") }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 12 }), " Watch live")), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel", id: "priority-panel", style: { marginBottom: "var(--gap-section)" } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Priority signals"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, priority.length, " items \xB7 human review required")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, live.status === "loading" && !live.items ? [...Array(3)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonCard, { key: i })) : !live.items ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "Live data unavailable", variant: "error" }, "Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Go to aph.gov.au"), ".") : /* @__PURE__ */ React.createElement(React.Fragment, null, priority.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s })), priority.length === 0 && /* @__PURE__ */ React.createElement(EmptyState, { icon: "check", kicker: "Priority clear" }, "All priority signals actioned."))), rest.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "panel-foot" }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", fontSize: 13 } }, rest.length, " more signal", rest.length !== 1 ? "s" : "", " in the last 24h"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginLeft: "auto" }, onClick: () => goto && goto("signals") }, "Open Signal inbox \u2192")))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-section-title" }, "What changed"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, live.items ? `Live \xB7 fetched ${fmtFetchedAt(live.fetchedAt)} AEST` : "No live feed yet")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--rule-2)", fontSize: 12, color: "var(--ink-3)" } }, Object.keys(state.archived).length > 0 ? `You actioned ${Object.keys(state.archived).length} signal${Object.keys(state.archived).length !== 1 ? "s" : ""} this session.` : "No signals actioned yet this session.", " ", sourceSignals.length, " signals in the current inbox."), live.items ? /* @__PURE__ */ React.createElement("div", { className: "timeline" }, live.items.slice(0, 6).map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id || i, className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, s.time, " \xB7 ", s.source), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)", textDecoration: "none" }, title: "Opens the source at aph.gov.au" }, s.title) : s.title)))) : /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "No live timeline held" }, "Parliament Pulse holds no verified live changes for this window: the /state signals block is not currently live. This timeline populates from the same feed as the Signal inbox once it connects.")), /* @__PURE__ */ React.createElement("div", { className: "panel-section" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-section-title" }, "Briefing queue"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, overviewBriefs.length, " generated")), overviewBriefs.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "brief", kicker: "No briefs generated yet" }, "Open any signal and choose Generate brief. Your briefs appear here and in the full Briefings queue.") : overviewBriefs.map((b, i) => /* @__PURE__ */ React.createElement("div", { key: b.for + i, className: "data-row g-brief-row", style: { display: "grid", gap: 10, padding: "10px 0", borderBottom: i < overviewBriefs.length - 1 ? "1px solid var(--rule-2)" : 0 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, b.type), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, "For ", b.for)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-label)", color: "var(--ok)", textTransform: "uppercase", letterSpacing: ".12em" } }, "Copied \xB7 clipboard"), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", title: "Open the briefings queue", "aria-label": "Open briefings queue", onClick: () => goto && goto("briefings") }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 }))))))))), /* @__PURE__ */ React.createElement(BetaReadinessPanel, { navigate: goto }), /* @__PURE__ */ React.createElement(CoverageActivationMatrix, { navigate: goto, copyPlan: copyActivationPlan }), /* @__PURE__ */ React.createElement(ProvenanceStackPanel, { navigate: goto }), /* @__PURE__ */ React.createElement(ProvenanceMetricsBand, { navigate: goto }));
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
  ), mode === "embed" && loaded && /* @__PURE__ */ React.createElement("div", { className: "live-badge", style: { position: "absolute", top: 12, left: 12, zIndex: 3, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 11, color: "#fff", letterSpacing: ".12em", border: "1px solid var(--line-bright)" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ink-3)" } }), "Stream loaded \xB7 status unverified \xB7 ", cfg.label.toUpperCase()), mode === "embed" && !loaded && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: 12, left: 12, zIndex: 3, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: ".12em", border: "1px solid var(--line-bright)" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ink-3)" } }), "Connecting \xB7 ", cfg.label.toUpperCase()), mode === "embed" && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setMode("offline"),
      style: { position: "absolute", top: 12, right: 12, zIndex: 3, fontFamily: "var(--mono)", fontSize: "var(--t-label)", color: "#fff", background: "rgba(0,0,0,0.55)", border: "1px solid var(--line-bright)", padding: "4px 9px", borderRadius: 4, cursor: "pointer", letterSpacing: ".08em" },
      title: "Show alternate sources if no stream is live"
    },
    "NO STREAM?"
  ), mode === "offline" && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg, var(--panel-2), var(--bg))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: "var(--ink-4)" } }), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)" } }, "Official broadcast \xB7 status unverified \xB7 ", cfg.label)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: 13, maxWidth: 460, lineHeight: 1.5, marginBottom: 18 } }, "AUSParliamentLive streams ", /* @__PURE__ */ React.createElement("strong", null, cfg.label), " while the chamber is sitting. Load the live stream here, or open the official sources."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
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
  const url = String(u || "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "aph.gov.au" || host.endsWith(".aph.gov.au") ? url : "";
  } catch (e) {
    return "";
  }
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
  const { toast, consumeLiveRefresh } = useStore();
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
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today \xB7 live"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Live parliament"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Official broadcast embed, APH source links, and live RSS polling from configured official feeds.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "btn " + (which === "house" ? "primary" : ""), onClick: () => setWhich("house") }, "House"), /* @__PURE__ */ React.createElement("button", { className: "btn " + (which === "senate" ? "primary" : ""), onClick: () => setWhich("senate") }, "Senate"), /* @__PURE__ */ React.createElement("button", { className: "btn " + (which === "federation" ? "primary" : ""), onClick: () => setWhich("federation") }, "Federation"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy a timestamped live action note", onClick: () => copyLiveActionNote("Flag moment", which, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 13 }), " Flag moment"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-live-main", style: { gap: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(LiveBroadcast, { which, toast }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "src-badge" }, "AUSParliamentLive \xB7 YouTube embed"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--teal)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " AUSParliamentLive"), /* @__PURE__ */ React.createElement("a", { href: "https://parlview.aph.gov.au/", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--teal)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " ParlView archive"), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Hansard", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--teal)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " Hansard"), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", style: { marginLeft: "auto" }, title: "Copy a Hansard follow-up note", onClick: () => copyLiveActionNote("Transcript follow-up", which, toast) }, "Request transcript"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", title: "Copy a source-backed clip note", onClick: () => copyLiveActionNote("Clip to brief", which, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Clip to brief")), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Daily program"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, which === "house" ? "House of Representatives" : which === "senate" ? "Senate" : "Federation Chamber"), /* @__PURE__ */ React.createElement("a", { href: which === "house" ? "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents" : "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { marginLeft: "auto", fontSize: 11.5, color: "var(--teal)", textDecoration: "none" } }, "Open daily program ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "clock", kicker: "No verified daily program held" }, 'Parliament Pulse does not yet build a chamber-specific daily program on this page. Official House Daily Program items appear in the "Recent items \xB7 APH RSS" panel alongside this player when the feed returns them. Open the daily program above for the current official schedule.'))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Official APH links"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Source pages")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "g-link-grid", style: { display: "grid", gap: 8 } }, [
    { name: "Hansard", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", desc: "Official Hansard source page" },
    { name: "ParlInfo Search", url: "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p", desc: "Official search page" },
    { name: "Bills Search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", desc: "Official bills search page" },
    { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", desc: "Official Senate program page" },
    { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official House program page" },
    { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official division lists page" },
    { name: "Committee RSS feeds", url: "https://www.aph.gov.au/Parliamentary_Business/Committees", desc: "Official committee RSS listing" },
    { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Official member roster page" }
  ].map((c, i) => /* @__PURE__ */ React.createElement("a", { key: i, href: c.url, target: "_blank", rel: "noopener noreferrer", style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: 6, textDecoration: "none", color: "var(--ink)", background: "var(--panel-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, c.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 2 } }, c.desc)), /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, stroke: "var(--ink-3)" }))))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recent items \xB7 APH RSS"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, loading && events.length === 0 ? "Polling\u2026" : `${events.length} tabled items \xB7 ${liveCount}/${totalFeeds} feeds${lastPoll ? " \xB7 as at " + fmtTime(lastPoll) + " AEST" : ""}`)), /* @__PURE__ */ React.createElement("div", { className: "panel-body", style: { maxHeight: 720, overflowY: "auto" } }, loading && events.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 0" }, "aria-label": "Loading live RSS feed", "aria-busy": "true" }, [...Array(6)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonRow, { key: i }))), !loading && events.length === 0 && (showDevDetail ? /* @__PURE__ */ React.createElement("div", { className: "empty-state error", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 15, stroke: "var(--caution)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--caution)", fontWeight: 500, marginBottom: 6 } }, "No items returned"), isFileGuard ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "This page was opened from the file system, so the browser cannot reach the feed proxy."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4 } }, "Serve over http, for example: ", /* @__PURE__ */ React.createElement("strong", null, "python -m http.server 8080"))) : isLocalHost ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "The local CORS proxy did not return data. Either the proxy is not running or APH rejected the request."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4 } }, "Start the proxy: ", /* @__PURE__ */ React.createElement("strong", null, "node proxy-server.js"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "Worker returned no items. Confirm the Cloudflare Worker is deployed and this origin is on its CORS allowlist."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4, wordBreak: "break-all" } }, "Worker: ", /* @__PURE__ */ React.createElement("strong", null, "https://aph-proxy.jvega019.workers.dev/rss?u="))), feedErrors.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { margin: "0 0 8px" } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".18em", marginBottom: 4 } }, "Feed errors"), feedErrors.slice(0, 8).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 8, padding: "2px 0" } }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 12, stroke: "var(--ember-flash)" }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, minWidth: 0 } }, e.label), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-4)" } }, e.error)))), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "Links below still open the raw feeds in a new tab."))) : /* @__PURE__ */ React.createElement("div", { className: "empty-state", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 15, stroke: "var(--ink-4)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontWeight: 500, marginBottom: 6 } }, "Live feed reconnecting"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "No new items in the latest poll. The official source links open the raw feeds directly.")))), events.map((e, i) => /* @__PURE__ */ React.createElement("a", { key: e.link || e.title + i, href: safeHttpUrl(e.link) || safeHttpUrl(e.sourceUrl) || "#", target: "_blank", rel: "noopener noreferrer", className: "clk data-row g-live-event", style: { display: "grid", gap: 10, borderRadius: 6, alignItems: "start", textDecoration: "none", color: "inherit" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", paddingTop: 2 } }, fmtTime(e.date)), /* @__PURE__ */ React.createElement("div", { style: { paddingTop: 3 } }, e.kind === "division" && /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 13, stroke: "var(--escalate)" }), e.kind === "hearing" && /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13, stroke: "var(--teal)" }), e.kind === "inquiry" && /* @__PURE__ */ React.createElement(Icon, { name: "pattern", size: 13, stroke: "var(--brass)" }), e.kind === "digest" && /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13, stroke: "var(--brass)" }), e.kind === "program" && /* @__PURE__ */ React.createElement(Icon, { name: "clock", size: 13, stroke: "var(--ink-3)" }), e.kind === "report" && /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13, stroke: "var(--teal)" }), e.kind === "signal" && /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13, stroke: "var(--ink-3)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "var(--ink)", lineHeight: 1.4 } }, e.title), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, e.kind), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-micro)", color: "var(--teal)", fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", gap: 3 } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 10 }), " ", e.sourceLabel)))))), /* @__PURE__ */ React.createElement("div", { className: "panel-foot", style: { flexDirection: "column", alignItems: "flex-start", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-3)" } }, "Live RSS \xB7 aph.gov.au via ", isLocalHost ? "local CORS proxy (proxy-server.js)" : "Cloudflare Worker proxy", " \xB7 refreshes every 2 min"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, "Last poll: ", lastPoll ? fmtTime(lastPoll) : "\u2014", " \xB7 Click any item to open source")))));
}
function PageSources() {
  const { openModal, addFeed, state, toast } = useStore();
  const health = useLiveState("connectors");
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState(null);
  const [newUrl, setNewUrl] = useState("https://www.aph.gov.au/.../FlagPost/Blog_entries");
  const [newName, setNewName] = useState("FlagPost Blog (HTML)");
  const startTest = () => {
    setTesting(true);
    setTestState(null);
    setTimeout(() => setTestState({
      status: "warn",
      simulated: true,
      lines: [
        { t: "warn", s: "Simulated example only \xB7 no request was sent to this URL" },
        { t: "ok", s: "A real check would confirm the URL resolves \xB7 200 OK" },
        { t: "ok", s: "A real check would inspect Content-Type for XML or HTML" },
        { t: "warn", s: "A real check would detect an <rss> root or attempt an HTML parse" },
        { t: "ok", s: "A real check would count dated entries and extractable links" },
        { t: "warn", s: "A real check would verify the latest item date and cadence" },
        { t: "warn", s: "Mark as Needs validation before routing to modules" }
      ]
    }), 1100);
  };
  const saveFeed = () => {
    if (!newName.trim()) return;
    addFeed({ id: "custom-" + Date.now(), name: newName.trim(), url: newUrl, status: "review", group: "Custom" });
    setTestState(null);
  };
  const allFeeds = [...APH_FEEDS, ...state.feeds.map((f) => ({ ...f, last: "Not polled", today: 0, fpr: "\u2014", modules: ["Custom"], parser: "Needs validation", authority: "Custom", confidence: "\u2014" }))];
  const checkByUrl = new Map((health.items || []).map((c) => [c.url, c]));
  const registryUrls = new Set((typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : []).map((r) => r.url));
  const workerRows = (health.items || []).filter((c) => !registryUrls.has(c.url));
  const healthyCount = (health.items || []).filter((c) => c.ok).length;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Admin"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Sources"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Official APH feed register", health.items ? " with live health checks from the Worker" : "; feed health appears once the Worker check runs", ". Custom-feed validation remains a prototype workflow.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Re-polls the live RSS feeds if the Live page poller is mounted", onClick: () => {
    if (typeof window.__refreshLiveFeeds === "function") {
      window.__refreshLiveFeeds();
      toast("Live feeds re-polled");
    } else {
      toast("Open the Live page to start the feed poller");
    }
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13 }), " Refresh all"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    var _a;
    return (_a = document.getElementById("new-feed-url")) == null ? void 0 : _a.focus();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " Add feed"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-4", style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Active feeds"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, sourceCounts().total), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, health.items ? "Official feeds configured \xB7 " + health.items.length + " endpoints health-checked" : "Official APH feeds configured")), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Healthy"), health.items ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, healthyCount, "/", health.items.length), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "as at ", fmtFetchedAt(health.fetchedAt), " AEST")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 18, color: "var(--ink-3)" } }, "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after live poll"))), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Items ingested \xB7 today"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 18, color: "var(--ink-3)" } }, "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after live poll")), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "False positive rate"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 18, color: "var(--ink-3)" } }, "\u2014"), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after 30 days' operation"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, health.status === "loading" && !health.items ? /* @__PURE__ */ React.createElement(SkeletonTable, { rows: 6 }) : /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Official APH Feed Bundle"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, sourceCounts().total, " official feeds configured \xB7 click a row for detail"), /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: health.displayProvenance,
      title: health.displayProvenance === "live" ? "Feed health from the Worker's connector checks" : "Health appears after the Worker check runs"
    }
  )), health.status === "error" && !health.items && /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "sources", kicker: "Feed status unavailable", variant: "error" }, "The status service did not respond. Direct links to each official APH feed remain available below.")), /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "ds" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Source"), /* @__PURE__ */ React.createElement("th", null, "Group"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null, "Last"), /* @__PURE__ */ React.createElement("th", { className: "num" }, "Today"), /* @__PURE__ */ React.createElement("th", null, "FPR"), /* @__PURE__ */ React.createElement("th", null, "Parser"))), /* @__PURE__ */ React.createElement("tbody", null, allFeeds.map((f) => {
    var _a, _b;
    const c = checkByUrl.get(f.url);
    return /* @__PURE__ */ React.createElement("tr", { key: f.id, onClick: () => f.group !== "Custom" && openModal("feed", f.id) }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, f.name), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, f.url.length > 56 ? f.url.slice(0, 56) + "\u2026" : f.url)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, f.group)), /* @__PURE__ */ React.createElement("td", { style: c && !c.ok ? { color: "var(--escalate)" } : void 0 }, f.group === "Custom" ? /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-4)", fontStyle: "italic" }, title: "Saved feeds are not polled by the live feed poller" }, "Not polled") : c ? c.ok ? "Live" : `Error ${(_a = c.httpStatus) != null ? _a : ""}`.trim() : f.lastStatusCode != null ? f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error" : "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, c ? fmtFetchedAt(c.checkedAt) : f.last || "\u2014"), /* @__PURE__ */ React.createElement("td", { className: "num" }, (_b = f.lastItemCount) != null ? _b : "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, f.fpr)), /* @__PURE__ */ React.createElement("td", null, f.parser || "\u2014"));
  }), workerRows.map((c) => {
    var _a;
    return /* @__PURE__ */ React.createElement("tr", { key: c.url }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, c.label), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, c.url.length > 56 ? c.url.slice(0, 56) + "\u2026" : c.url)), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, c.group)), /* @__PURE__ */ React.createElement("td", { style: !c.ok ? { color: "var(--escalate)" } : void 0 }, c.ok ? "Live" : `Error ${(_a = c.httpStatus) != null ? _a : ""}`.trim()), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, fmtFetchedAt(c.checkedAt)), /* @__PURE__ */ React.createElement("td", { className: "num" }, "\u2014"), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, "\u2014")), /* @__PURE__ */ React.createElement("td", null, "Worker-monitored"));
  }))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Add RSS feed"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Name, URL, validate, save")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "new-feed-name", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Display name"), /* @__PURE__ */ React.createElement("input", { id: "new-feed-name", value: newName, onChange: (e) => setNewName(e.target.value), className: "search", style: { padding: "8px 10px", marginTop: 4, marginBottom: 8, width: "100%" } }), /* @__PURE__ */ React.createElement("label", { htmlFor: "new-feed-url", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Paste RSS URL"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } }, /* @__PURE__ */ React.createElement("input", { id: "new-feed-url", value: newUrl, onChange: (e) => setNewUrl(e.target.value), className: "search", style: { flex: 1, padding: "8px 10px" } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: startTest }, testing && !testState ? "Testing\u2026" : "Validate")), testState && /* @__PURE__ */ React.createElement("div", { className: "feed-test", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6, letterSpacing: ".1em", display: "flex", alignItems: "center", gap: 7 }, className: "warn" }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 12 }), " Simulated example \xB7 parser needs validation"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: "var(--ink-4)", marginBottom: 8 } }, "This preview is illustrative. No network request was made and no result was verified. Connect backend validation before treating any feed as checked."), testState.lines.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "feed-test-line " + l.t }, /* @__PURE__ */ React.createElement(Icon, { name: l.t === "ok" ? "check" : l.t === "warn" ? "flag" : "close", size: 12 }), /* @__PURE__ */ React.createElement("span", null, l.s))), /* @__PURE__ */ React.createElement("button", { className: "btn primary sm", style: { marginTop: 10 }, onClick: saveFeed }, "Save as unvalidated feed")))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Not yet connected"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Needs parser or source")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, [
    { name: "Hansard extraction", note: "Needs transcript parser" },
    { name: "QON tracking", note: "Needs source or parliamentary export" },
    { name: "Full bill progress", note: "Needs bills database beyond Digest RSS" },
    { name: "News / media monitoring", note: "Optional bundle, later" },
    { name: "Internal executive briefings", note: "Governance controls required" }
  ].map((x) => /* @__PURE__ */ React.createElement("div", { key: x.name, style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--line-2)" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13 } }, x.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, x.note)), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: "Copy a backlog request for this source", onClick: () => copyBacklogRequest(x.name, x.note, toast) }, "Request"))))))));
}
function LiveFeedStrip({ title, items, fetchedAt, emptyText }) {
  if (!items || items.length === 0) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, title), /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: "live", title: "Live items from the Worker's composed /state feed" }), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, "fetched ", fmtFetchedAt(fetchedAt), " AEST")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, items.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, emptyText) : items.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id || i, className: "data-row", style: { display: "grid", gap: 6, padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0 } }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--teal)", textDecoration: "none", fontSize: 13, fontWeight: 500 }, title: "Opens the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })) : /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 500, color: "var(--ink-2)" } }, s.source), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, s.tags && s.tags[0] && s.tags[0].l || "item"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, s.source), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, s.date))))));
}
function PageCommittees() {
  const liveSignalsState = useLiveState("signals");
  const committeeFeedLabels = /* @__PURE__ */ new Set(["Senate Committee Reports Tabled", "Senate New Inquiries", "Senate Upcoming Hearings"]);
  const committeeLive = liveSignalsState.items ? liveSignalsState.items.filter((s) => committeeFeedLabels.has(s.source)) : null;
  const { openModal, toast } = useStore();
  const [highOnly, setHighOnly] = useState(false);
  const rows = highOnly ? COMMITTEE_ITEMS.filter((i) => i.att === "high") : COMMITTEE_ITEMS;
  const today = rows.filter((i) => i.when.startsWith("Today"));
  const upcoming = rows.filter((i) => !i.when.startsWith("Today") && !i.when.startsWith("Yesterday"));
  const recent = rows.filter((i) => i.when.startsWith("Yesterday"));
  const reportsTabled = rows.filter((i) => i.type === "Report tabled").length;
  const exportPrepPack = () => {
    exportRowsCSV(
      ["when", "type", "committee", "topic", "portfolio", "attention"],
      rows.map((r) => [r.when, r.type, r.name, r.topic, r.portfolio, r.att]),
      `parliament-pulse-committee-prep-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`
    );
    toast("Committee prep pack exported", "brass");
  };
  const CommitteeTable = ({ rows: rows2, compact, emptyText }) => {
    if (rows2.length === 0) {
      return /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "No verified committee items held" }, emptyText));
    }
    return /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "ds" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "When"), /* @__PURE__ */ React.createElement("th", null, "Type"), /* @__PURE__ */ React.createElement("th", null, "Committee"), !compact && /* @__PURE__ */ React.createElement("th", null, "Topic"), /* @__PURE__ */ React.createElement("th", null, "Portfolio"), /* @__PURE__ */ React.createElement("th", null, "Attention"))), /* @__PURE__ */ React.createElement("tbody", null, rows2.map((r, i) => {
      const canOpen = !!(r.id && ENTITIES.committees[r.id]);
      return /* @__PURE__ */ React.createElement("tr", { key: r.name + r.when, onClick: canOpen ? () => openModal("committee", r.id) : void 0, style: canOpen ? void 0 : { opacity: 0.6, cursor: "not-allowed" } }, /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-2)" } }, r.when), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "tag" }, r.type)), /* @__PURE__ */ React.createElement("td", null, r.name, compact && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-3)", fontSize: 12 } }, r.topic)), !compact && /* @__PURE__ */ React.createElement("td", null, r.topic), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, r.portfolio), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(Att, { level: r.att })));
    }))));
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Committees"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Committee profiles and schedules are representative; the live strip lists real items from the Senate committee feeds.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Representative data"), /* @__PURE__ */ React.createElement("button", { className: "btn" + (highOnly ? " primary" : ""), title: "Toggle high-attention committee rows", onClick: () => setHighOnly((v) => !v) }, /* @__PURE__ */ React.createElement(Icon, { name: "filter", size: 13 }), " High attention"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", title: "Export the current committee prep rows", onClick: exportPrepPack }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Export prep pack"))), committeeLive && /* @__PURE__ */ React.createElement(
    LiveFeedStrip,
    {
      title: "Latest committee items \xB7 live feed",
      items: committeeLive,
      fetchedAt: liveSignalsState.fetchedAt,
      emptyText: "No committee items in the current live window."
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "grid g-3", style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginBottom: -6 } }, /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Representative data")), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Today"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, today.length, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "hearings"))), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Upcoming \xB7 7 days"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, upcoming.length, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "hearings"))), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Reports tabled"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, reportsTabled))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Today's hearings"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, today.length, " items")), /* @__PURE__ */ React.createElement(CommitteeTable, { rows: today, emptyText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified committee hearings for today. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open committee hearings on aph.gov.au"), ".") })), /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Upcoming hearings"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Next 7 days")), /* @__PURE__ */ React.createElement(CommitteeTable, { rows: upcoming, compact: true, emptyText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified upcoming hearings. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open committee hearings on aph.gov.au"), ".") })), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recently tabled / opened"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Last 48h")), /* @__PURE__ */ React.createElement(CommitteeTable, { rows: recent, compact: true, emptyText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified reports or inquiries opened in the last 48 hours. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open committee reports on aph.gov.au"), ".") }))));
}
function PageBills() {
  const { openModal, state, liveState } = useStore();
  const loadingNoCache = liveState.status === "loading" && !liveState.blocks;
  const featuredBill = BILLS.find((b) => b.att === "high") || BILLS[0];
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament \xB7 Bills Intelligence"), /* @__PURE__ */ React.createElement("h1", { className: "page-title", style: { display: "flex", alignItems: "center", gap: 10 } }, "Bills intelligence ", /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", title: "Bill stages and provisions are representative until a bills register connector exists" }, "Representative data")), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Click a bill for full details, provisions and timeline. Assign a policy owner directly from the bill detail.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => {
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
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 13 }), " Export register"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", disabled: !featuredBill, onClick: () => featuredBill && openModal("bill", featuredBill.ref) }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Draft bill brief"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, loadingNoCache ? /* @__PURE__ */ React.createElement(SkeletonTable, { rows: 6 }) : /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Tracked bills"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, BILLS.length, " bill", BILLS.length !== 1 ? "s" : "", " tracked")), /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "ds" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Ref"), /* @__PURE__ */ React.createElement("th", null, "Title"), /* @__PURE__ */ React.createElement("th", null, "Stage"), /* @__PURE__ */ React.createElement("th", null, "Portfolio"), /* @__PURE__ */ React.createElement("th", null, "Digest"), /* @__PURE__ */ React.createElement("th", null, "Owner"), /* @__PURE__ */ React.createElement("th", null, "Attn"))), /* @__PURE__ */ React.createElement("tbody", null, BILLS.map((b) => {
    const owner = state.owners[b.ref] || b.owner;
    const featured = b.ref === "BILL-2026-048";
    return /* @__PURE__ */ React.createElement("tr", { key: b.ref, onClick: () => openModal("bill", b.ref), "aria-current": featured ? "true" : void 0, style: featured ? { background: "var(--panel-hi)", boxShadow: "inset 2px 0 0 var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, b.ref), /* @__PURE__ */ React.createElement("td", { style: { fontWeight: 500 } }, b.title), /* @__PURE__ */ React.createElement("td", { style: { color: "var(--ink-2)" } }, b.stage), /* @__PURE__ */ React.createElement("td", { className: "mono", style: { fontSize: 11.5, color: "var(--ink-3)" } }, b.portfolio), /* @__PURE__ */ React.createElement("td", null, b.digest === "Published" ? /* @__PURE__ */ React.createElement("span", { className: "tag teal" }, "Published") : /* @__PURE__ */ React.createElement("span", { className: "tag" }, "Pending")), /* @__PURE__ */ React.createElement("td", { style: { color: owner === "\u2014" ? "var(--ink-4)" : owner !== b.owner ? "var(--ok)" : "var(--ink-2)" } }, owner), /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement(Att, { level: b.att })));
  }))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Related divisions"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House \xB7 last 7 days")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, DIVISIONS.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "flag", kicker: "No verified divisions held" }, "Parliament Pulse holds no verified division results for tracked bills. A live House Divisions feed is being wired into the Worker. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open division results on aph.gov.au"), ".") : DIVISIONS.map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d.when + d.bill, className: "clk list-row", onClick: () => openModal("division", d), style: { borderRadius: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-label)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, d.when, " \xB7 ", d.chamber, " \xB7 ", d.bill), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginTop: 2 } }, d.q), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)", marginTop: 2 } }, d.result)))))), featuredBill && /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Bills Digest"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Featured \xB7 ", featuredBill.title, " (highest attention)"), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto" } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => openModal("bill", featuredBill.ref) }, "Open full detail \u2192"))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "brief", kicker: "No verified digest held" }, "Parliament Pulse holds no verified digest for this bill, because the APH Bills Digests feed sits behind an access control that blocks automated retrieval. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open Bills Legislation on aph.gov.au"), "."))));
}
function PageParliament() {
  const { openModal, navigate } = useStore();
  const live = useLiveState("signals");
  const dailyProgramLive = live.items ? live.items.filter((s) => s.source === "House Daily Program") : null;
  const divisionsLive = live.items ? live.items.filter((s) => s.source === "House Divisions") : null;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Today in Parliament"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Daily program, divisions, and chamber-relevant items from official APH feeds."))), dailyProgramLive && dailyProgramLive.length > 0 && /* @__PURE__ */ React.createElement(
    LiveFeedStrip,
    {
      title: "Latest daily program \xB7 live feed",
      items: dailyProgramLive,
      fetchedAt: live.fetchedAt,
      emptyText: "No daily program items in the current live window."
    }
  ), divisionsLive && divisionsLive.length > 0 && /* @__PURE__ */ React.createElement(
    LiveFeedStrip,
    {
      title: "Latest divisions \xB7 live feed",
      items: divisionsLive,
      fetchedAt: live.fetchedAt,
      emptyText: "No division items in the current live window."
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "House \xB7 daily program")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, dailyProgramLive && dailyProgramLive.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Live daily program items for the House are shown above.") : /* @__PURE__ */ React.createElement(EmptyState, { icon: "clock", kicker: "No verified daily program held" }, "Parliament Pulse holds no verified daily program for the House. The most likely reason is that the House is not currently sitting, or the official daily program feed has not returned an item at the last check. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open the House daily program on aph.gov.au"), "."))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recent divisions"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, divisionsLive && divisionsLive.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Live division items are shown above.") : DIVISIONS.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "flag", kicker: "No verified divisions held" }, "Parliament Pulse holds no verified division results. A live House Divisions feed is being wired into the Worker. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open division results on aph.gov.au"), ".") : DIVISIONS.map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d.when + d.bill, className: "clk list-row", onClick: () => openModal("division", d), style: { borderRadius: 6 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-label)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, d.when, " \xB7 ", d.bill), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginTop: 2 } }, d.q), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)", marginTop: 2 } }, d.result)))))), /* @__PURE__ */ React.createElement("div", { className: "grid g-2", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "House news & media")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      icon: "signal",
      kicker: "No verified items held",
      action: /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => navigate && navigate("live") }, "Open live feed \u2192")
    },
    "Parliament Pulse holds no verified House news items on this page. Live House Media Releases are polled on the Live page."
  ))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Parliamentary lines"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { marginLeft: "auto" } }, "Representative data")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px dashed var(--line-2)", borderRadius: 8, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, fontStyle: "italic" } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8, fontStyle: "normal" } }, "No lines drafted yet"), 'Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow.')))));
}
function fmtSpanDate(iso) {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  } catch (e) {
    return "\u2014";
  }
}
function ThreadRow({ t, byGuid, isLast }) {
  const [open, setOpen] = useState(false);
  const resolved = t.signalGuids.map((g) => byGuid.get(g)).filter(Boolean);
  const unresolved = t.signalGuids.length - resolved.length;
  return /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 0", borderBottom: isLast ? 0 : "1px solid var(--line)" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setOpen((v) => !v),
      "aria-expanded": open,
      style: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13, style: { transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" } }),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13.5, fontWeight: 600, color: "var(--ink)" } }, t.itemCount, " items"),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, fmtSpanDate(t.firstSeenAt), " \u2192 ", fmtSpanDate(t.lastSeenAt)),
    /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".1em", marginLeft: 4 } }, "Cluster"),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-2)", fontSize: 12.5 } }, t.title)
  ), open && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, marginLeft: 25, display: "grid", gap: 8 } }, resolved.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id || i, style: { display: "grid", gap: 4 } }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--teal)", textDecoration: "none", fontSize: 12.5, fontWeight: 500 }, title: "Opens the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })) : /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)" } }, s.source), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, s.tags && s.tags[0] && s.tags[0].l || "item"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: "var(--ink-3)" } }, s.source), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, s.date)))), unresolved > 0 && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-4)" } }, unresolved, " further item", unresolved !== 1 ? "s" : "", " in the archive")));
}
function PagePatterns() {
  const { openModal, toast } = useStore();
  const threads = useLiveState("threads");
  const signalsLive = useLiveState("signals");
  const byGuid = React.useMemo(() => new Map((signalsLive.items || []).map((s) => [s.id, s])), [signalsLive.items]);
  const [clusterStatus, setClusterStatus] = useState("Needs analyst review");
  const qonItems = QON_PATTERN && Array.isArray(QON_PATTERN.items) ? QON_PATTERN.items : [];
  const qonMemberCount = new Set(qonItems.map((q) => q.memberId || q.who).filter(Boolean)).size;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament \xB7 Scrutiny"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "QON pattern engine"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Detects clustered scrutiny across members, topics and targets. Click any member to open their profile."))), threads.items && /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Signal threads \xB7 cluster analysis"), /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: threads.displayProvenance, title: "The Worker's own clustering of live signals (derived analysis)" }), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, threads.items.length, " threads \xB7 fetched ", fmtFetchedAt(threads.fetchedAt), " AEST")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, threads.items.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "pattern", kicker: "No threads" }, "Thread detection groups related signals as they accumulate. Nothing has clustered yet.") : threads.items.map((t, i) => /* @__PURE__ */ React.createElement(ThreadRow, { key: t.id || i, t, byGuid, isLast: i === threads.items.length - 1 })))), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: "var(--panel-hi)", border: "1px solid var(--line-bright)", borderRadius: 8, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", color: "var(--ink-2)", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 14, stroke: "var(--info)" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "QON feed not connected"), " (source returns 403). ", threads.items ? "Thread clustering above is live from the archive. " : "", qonItems.length > 0 ? "The scrutiny pattern below uses representative sample data." : "No scrutiny pattern is held below until the feed connects.")), qonItems.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "pattern" }, /* @__PURE__ */ React.createElement("div", { className: "ribbon" }, "Clustered pattern \xB7 moderate confidence"), /* @__PURE__ */ React.createElement("div", { className: "serif", style: { fontSize: 22, fontWeight: 500, marginBottom: 6, paddingRight: 200 } }, "Clustered scrutiny pattern", QON_PATTERN.topic ? ` on ${QON_PATTERN.topic}` : ""), QON_PATTERN.trigger && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: 13.5, maxWidth: 720 } }, qonItems.length, " related question", qonItems.length !== 1 ? "s" : "", " lodged by ", qonMemberCount, " member", qonMemberCount !== 1 ? "s" : "", QON_PATTERN.window ? ` within ${QON_PATTERN.window}` : "", ". Trigger likely: ", QON_PATTERN.trigger, "."), /* @__PURE__ */ React.createElement("div", { className: "grid g-4", style: { marginTop: 16, marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Members"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginTop: 4 } }, qonMemberCount)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Questions"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginTop: 4 } }, qonItems.length)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Window"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, marginTop: 4 } }, QON_PATTERN.window || "\u2014")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Target"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, marginTop: 4, lineHeight: 1.25 } }, QON_PATTERN.target || "\u2014"))), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px dashed var(--line-2)", paddingTop: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 } }, "Evidence \xB7 click member for profile"), qonItems.map((q, i) => {
    const mid = q.memberId;
    const canOpen = !!(mid && ENTITIES.members[mid]);
    return /* @__PURE__ */ React.createElement("div", { key: q.when + q.who, className: "g-qon-evidence", style: { display: "grid", gap: 12, padding: "8px 0", borderBottom: i < qonItems.length - 1 ? "1px solid var(--line)" : 0, alignItems: "start", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-3)" } }, q.when), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "tag brass" + (canOpen ? " clk" : ""), onClick: canOpen ? () => openModal("member", mid) : void 0, style: canOpen ? void 0 : { opacity: 0.65, cursor: "not-allowed" } }, q.who)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, q.q), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, q.chamber)));
  })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy an Estimates monitor note", onClick: () => copyText(`# Estimates monitor note
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}

Pattern: ${QON_PATTERN.topic || "Unknown"}
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
  } }, "Mark as coincidence")), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-3)", marginTop: 8, letterSpacing: ".08em" } }, "Session status: ", clusterStatus)) : /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Clustered scrutiny pattern")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "pattern", kicker: "No verified scrutiny cluster held" }, "Parliament Pulse holds no verified Questions on Notice to detect a scrutiny cluster from: the QON feed is not connected (source returns 403). ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Open Questions on Notice on aph.gov.au"), "."))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "How patterns are detected"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Indicator logic")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, [
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
  const [reviewedIds, setReviewedIds] = useState({});
  const { toast, state, setSignalSearchQuery, navigate } = useStore();
  const live = useLiveState("signals");
  const known = live.items ? [...SIGNALS, ...live.items] : SIGNALS;
  const briefs = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = known.find((s) => s.id === sid);
    const label = sig ? sig.isLive ? sig.source : sig.title.slice(0, 40) + "\u2026" : sid;
    return { type: v.type || "Executive Brief", for: label, status: "Copied \xB7 clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts);
  const briefId = (b) => b._sid;
  const selected = briefs.find((b) => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Workflow"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Briefings"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Briefs you generate from a signal appear here with their evidence links: What happened \xB7 Source \xB7 Why it matters \xB7 Recommended action \xB7 Evidence \xB7 Provenance.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn", disabled: briefs.length === 0, onClick: () => downloadBriefingQueue(briefs, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 13 }), " Export queue"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", title: "Open signals to generate a brief", onClick: () => {
    setSignalSearchQuery("");
    navigate("signals");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " New brief"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-briefings", style: { gap: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Queue"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, briefs.length, " generated")), /* @__PURE__ */ React.createElement("div", null, briefs.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "brief", kicker: "No briefs yet" }, "Open any signal and choose Generate brief. Your briefs appear here with their evidence links.") : briefs.map((b, i) => {
    const id = briefId(b);
    const status = reviewedIds[id] ? "Reviewed" : b.status;
    return /* @__PURE__ */ React.createElement("div", { key: id, className: "list-row", onClick: () => setSelId(id), style: { cursor: "pointer", background: selectedId === id ? "var(--panel-hi)" : "transparent", borderLeft: selectedId === id ? "2px solid var(--brass)" : "2px solid transparent" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, b.type), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: "var(--ink-3)" } }, "For ", b.for), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { marginTop: 4, color: status === "Reviewed" ? "var(--ok)" : status.startsWith("Copied") ? "var(--ink-3)" : "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, status));
  }))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, selected ? selected.type : "No brief", " \xB7 preview"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, selected ? `For ${selected.for}` : "Queue empty"), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 6 } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", disabled: !selected, onClick: () => window.print() }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 12 }), " Print"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", disabled: !selected, title: "Copy a send-ready handoff note", onClick: () => copyText(`# Brief handoff
Type: ${selected.type}
For: ${selected.for}
Status: ${reviewedIds[selectedId] ? "Reviewed" : selected.status}
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Brief handoff copied") }, "Copy handoff"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", disabled: !selected || reviewedIds[selectedId], title: "Mark this brief reviewed in the local queue", onClick: () => {
    setReviewedIds((r) => ({ ...r, [selectedId]: true }));
    toast(`Marked reviewed: ${selected.type}`, "brass");
  } }, selected && reviewedIds[selectedId] ? "Reviewed" : "Mark reviewed"))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, (() => {
    const b = selected;
    if (!b) return /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No briefs in the queue. Open any signal and choose Generate brief.");
    const sig = b._sid ? known.find((s) => s.id === b._sid) : null;
    if (!sig) {
      return /* @__PURE__ */ React.createElement(EmptyState, { icon: "brief", kicker: "Source signal not found" }, "Parliament Pulse cannot rebuild this brief because the original signal is no longer in the inbox.");
    }
    const brief = buildBriefSections(sig, !!sig.isLive);
    return /* @__PURE__ */ React.createElement("div", { className: "brief" }, /* @__PURE__ */ React.createElement("div", { className: "meta" }, "PARLIAMENT PULSE \xB7 ", b.type.toUpperCase(), " \xB7 ", brief.meta.date, " \xB7 ", brief.meta.time), /* @__PURE__ */ React.createElement("h3", null, brief.isLive ? brief.link ? /* @__PURE__ */ React.createElement("a", { href: brief.link, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit" }, title: "Open the source at aph.gov.au" }, brief.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, style: { verticalAlign: "-1px", opacity: 0.6 } })) : brief.meta.source : brief.title), /* @__PURE__ */ React.createElement("h5", null, "What happened"), /* @__PURE__ */ React.createElement("div", null, brief.summary), /* @__PURE__ */ React.createElement("h5", null, "Source"), /* @__PURE__ */ React.createElement("div", null, brief.meta.source, " \xB7 ", brief.meta.sourceAuthority, " \xB7 ", brief.meta.date), /* @__PURE__ */ React.createElement("h5", null, "Why it matters"), /* @__PURE__ */ React.createElement("div", null, brief.whyItMatters), /* @__PURE__ */ React.createElement("h5", null, "Recommended action"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, brief.recommendedAction.label, "."), " ", brief.recommendedAction.reason), brief.evidence.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h5", null, "Evidence"), /* @__PURE__ */ React.createElement("ul", null, brief.evidence.map((e, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("a", { href: e.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--brief-link)", textDecoration: "underline" } }, e.label))))), /* @__PURE__ */ React.createElement("h5", null, "Provenance"), /* @__PURE__ */ React.createElement("div", null, brief.provenance));
  })()))));
}
function PageWatchlists() {
  const { openModal, createWatchlist, state, removeWatchlist } = useStore();
  const [newName, setNewName] = useState("");
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  const derived = !!live.items;
  const all = [...WATCHLISTS, ...state.watchlistCreated];
  const [selectedWl, setSelectedWl] = useState(() => all[0]);
  const selectedKeywords = watchlistKeywords(selectedWl || all[0]);
  const trackedItems = Object.keys(state.watchlistAdds || {}).map((key) => {
    const sig = SIGNALS.find((s) => s.id === key);
    return { key, title: sig ? sig.title : key, meta: sig ? `${sig.id} \xB7 ${sig.source}` : "Entity watch" };
  });
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Workflow"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Watchlists"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "The relevance engine. Click any watchlist for matches and configuration.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: derived ? "derived" : "fixture",
      title: derived ? "Keyword matches computed against the live signal stream" : "Live data is unavailable, so matches show 0 rather than an invented count"
    }
  ), /* @__PURE__ */ React.createElement("input", { id: "new-wl-name", "aria-label": "New watchlist name", placeholder: "New watchlist name", value: newName, onChange: (e) => setNewName(e.target.value), className: "search", style: { padding: "7px 10px" } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (newName.trim()) {
      createWatchlist(newName.trim());
      setNewName("");
    }
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " Create"))), all.length === 0 ? /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      icon: "watch",
      kicker: "No watchlists yet",
      action: /* @__PURE__ */ React.createElement("button", { className: "btn sm primary", onClick: () => {
        var _a;
        return (_a = document.getElementById("new-wl-name")) == null ? void 0 : _a.focus();
      } }, "New watchlist")
    },
    "Create a watchlist to get matched signals and a daily digest of what moved."
  ) : /* @__PURE__ */ React.createElement("div", { className: "grid g-3" }, all.map((w) => {
    const trend = Array.isArray(w.trend) ? w.trend : [];
    const max = Math.max(...trend, 1);
    const matchCount = watchlistMatches(w, matchSource).length;
    const keywordCount = watchlistKeywords(w).length;
    return /* @__PURE__ */ React.createElement("div", { key: w.name, className: "wl" + ((selectedWl == null ? void 0 : selectedWl.name) === w.name ? " active" : ""), onClick: () => {
      setSelectedWl(w);
      openModal("watchlist", w.name);
    }, style: (selectedWl == null ? void 0 : selectedWl.name) === w.name ? { borderColor: "var(--brass)" } : {} }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "wl-name" }, w.name), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--brass)", background: "var(--panel-hi)", border: "1px solid var(--brass-soft)", padding: "1px 6px", borderRadius: 4, marginLeft: "auto" } }, matchCount, " matches")), /* @__PURE__ */ React.createElement("div", { className: "wl-meta" }, /* @__PURE__ */ React.createElement("span", null, keywordCount, " keywords"), /* @__PURE__ */ React.createElement("span", null, "\xB7"), /* @__PURE__ */ React.createElement("span", null, "7-day")), trend.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "mono", style: { marginTop: 6, color: "var(--ink-4)", fontSize: 11 } }, "\u2014 no trend history") : /* @__PURE__ */ React.createElement("div", { className: "spark", style: { marginTop: 2 } }, trend.map((v, i) => /* @__PURE__ */ React.createElement("span", { key: i, style: { height: v / max * 20 + 2 + "px" } }))));
  })), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Tracked items"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, trackedItems.length, " saved")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, trackedItems.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No tracked items yet. Use Watchlist, Track, or Watch controls to add one.") : trackedItems.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.key, className: "g-tracked-row", style: { display: "grid", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, item.title), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", marginTop: 2 } }, item.meta)), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => removeWatchlist(item.key) }, "Remove"))))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, (selectedWl == null ? void 0 : selectedWl.name) || "Digital government", " \xB7 configuration"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Selected watchlist"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { marginLeft: 8 } }, "Fixture")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 } }, "Keywords"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, selectedKeywords.map((k) => /* @__PURE__ */ React.createElement("span", { key: k, className: "tag brass" }, k))), /* @__PURE__ */ React.createElement("div", { className: "empty", style: { marginTop: 14 } }, "Parliament Pulse does not yet hold linked committees, attention thresholds, or an audit log for watchlists. These configuration surfaces need a backend before they can show real per-watchlist data."))));
}
function PageRadar() {
  const { openModal } = useStore();
  const live = useLiveState("signals");
  const derivedRows = React.useMemo(() => {
    if (!live.items) return null;
    const rank = { high: 3, med: 2, low: 1 };
    const groups = /* @__PURE__ */ new Map();
    live.items.forEach((s) => {
      const key = s.sourceGroup || "Other";
      const g = groups.get(key) || { issue: key, count: 0, sources: /* @__PURE__ */ new Set(), att: null };
      g.count += 1;
      if (s.source) g.sources.add(s.source);
      if ((rank[s.attention] || 0) > (rank[g.att] || 0)) g.att = s.attention;
      groups.set(key, g);
    });
    return [...groups.values()].map((g) => ({
      issue: g.issue,
      att: g.att,
      sources: g.sources.size,
      count: g.count,
      reason: `${g.count} live items across ${g.sources.size} feed${g.sources.size !== 1 ? "s" : ""}`
    })).sort((a, b) => b.count - a.count);
  }, [live.items]);
  const derived = !!derivedRows;
  const rows = derivedRows || RADAR;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Attention radar"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Transparent categories, no fake precision scores. Click any issue for momentum detail and suggested actions.")), /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: derived ? "derived" : "fixture",
      title: derived ? "Grouped live signals; momentum and confidence require history the product does not yet have" : "Live data is unavailable, so no clusters render"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Active issues"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, derived ? "Grouped from the live signal stream" : "No live signal stream connected")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, rows.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "radar", kicker: "Live data unavailable", variant: "error" }, "Live data is unavailable. Parliament Pulse shows nothing rather than showing an invented issue cluster. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Go to aph.gov.au"), ".") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "radar-row g-radar-table", style: { display: "grid", padding: "4px 0 10px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Issue"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Attention"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", textAlign: "right" } }, "Sources"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Momentum"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" } }, "Confidence")), rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.issue, className: (derived ? "" : "clk ") + "radar-row g-radar-table", onClick: derived ? void 0 : () => openModal("radar", r.issue), style: { display: "grid", padding: "14px 8px", borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : 0, gap: 14, alignItems: "center", borderRadius: 6, cursor: derived ? "default" : void 0 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 500 } }, r.issue), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "var(--ink-3)", marginTop: 2 } }, r.reason)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Att, { level: r.att })), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { textAlign: "right", color: "var(--ink-2)" } }, r.sources), derived ? /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-4)" } }, "\u2014") : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "bar" }, /* @__PURE__ */ React.createElement("div", { className: "fill", style: { width: `${r.momentum * 100}%` } }))), derived ? /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-4)" } }, "\u2014") : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { className: "ring", style: { "--p": Math.round(r.confidence * 100) }, "data-p": Math.round(r.confidence * 100) }))))))));
}
function PageSignals() {
  const { state, setVisibleSignalOrder, signalSearchQuery, setSignalSearchQuery } = useStore();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("time");
  const live = useLiveState("signals");
  const sourceSignals = live.items || SIGNALS;
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
  const CHUNK = 60;
  const [renderCap, setRenderCap] = useState(CHUNK);
  const sentinelRef = React.useRef(null);
  const progressive = visible.length > 80;
  const shown = progressive ? visible.slice(0, renderCap) : visible;
  const moreToShow = progressive && shown.length < visible.length;
  const filterLabel = { high: "high", med: "medium", low: "low" }[filter] || filter;
  React.useEffect(() => {
    setRenderCap(CHUNK);
  }, [filter, sort, signalSearchQuery]);
  React.useEffect(() => {
    window.ppBumpRenderCap = (targetIndex) => {
      const idx = typeof targetIndex === "number" && targetIndex >= 0 ? targetIndex : 0;
      setRenderCap((cap) => idx < cap ? cap : Math.ceil((idx + 1) / CHUNK) * CHUNK);
    };
    return () => {
      window.ppBumpRenderCap = null;
    };
  }, []);
  React.useEffect(() => {
    if (!moreToShow) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setRenderCap((cap) => cap + CHUNK);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [moreToShow, shown.length, visible.length]);
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today \xB7 triage workspace"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Signal inbox"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, counts.all, " active signals \xB7 ", counts.high, " high \xB7 ", counts.med, " medium \xB7 ", counts.low, " low. Open any signal to action, archive, or generate a brief.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: live.displayProvenance,
      title: live.displayProvenance === "live" ? "Signals from the Worker's composed /state endpoint (D1 archive)" : "Live data is unavailable \u2014 the /state signals block is not live"
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
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-2)" } }, "(", counts[val], ")"),
    filter === val && /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, " (active filter)")
  ))), live.status === "loading" && !live.items ? /* @__PURE__ */ React.createElement("div", { "aria-busy": "true", "aria-label": "Loading signals" }, [...Array(5)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonCard, { key: i }))) : visible.length === 0 ? filter !== "all" ? /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      icon: "signal",
      kicker: "No matches",
      action: /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => setFilter("all") }, "Clear filter")
    },
    "No ",
    filterLabel,
    " attention signals right now. Clear the filter to see the full inbox."
  ) : signalSearchQuery ? /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      icon: "signal",
      kicker: "No matches",
      action: /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => setSignalSearchQuery("") }, "Clear search")
    },
    'Nothing matches "',
    signalSearchQuery,
    '" in the signal inbox. Try a shorter term.'
  ) : !live.items ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "Live data unavailable", variant: "error" }, "Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "Go to aph.gov.au"), ".") : /* @__PURE__ */ React.createElement(EmptyState, { icon: "check", kicker: "Inbox zero" }, "All signals reviewed. New items appear when the next feed poll lands.") : /* @__PURE__ */ React.createElement("div", null, shown.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s })), moreToShow && /* @__PURE__ */ React.createElement("div", { ref: sentinelRef, className: "list-sentinel", "aria-hidden": "true" }), progressive && /* @__PURE__ */ React.createElement("div", { className: "list-progress", style: { display: "flex", alignItems: "center", gap: 12, padding: "14px 4px 4px" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", letterSpacing: ".08em" } }, moreToShow ? `Showing ${shown.length} of ${visible.length} signals` : `Showing all ${visible.length} signals`), moreToShow && /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", style: { marginLeft: "auto" }, onClick: () => setRenderCap((cap) => cap + CHUNK) }, "Show more"))));
}
Object.assign(window, { PageOverview, PageLive, PageSources, PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists, PageRadar, PageSignals, OnboardingGuide });
