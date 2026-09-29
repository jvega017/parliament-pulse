const BETA_READINESS_ROWS = [
  {
    state: "Configured",
    title: "Official APH feeds",
    detail: "Six official APH RSS feeds are checked every 30 minutes. The Live page shows each feed's current state and links to the source.",
    action: "Open Live",
    page: "live"
  },
  {
    state: "Derived",
    title: "Parliament Pulse analysis",
    detail: "Attention and confidence come from fixed, published scoring rules; threads, source groups and watchlist matches are worked out from the live signals. All of it is Parliament Pulse's own analysis, labelled as such.",
    action: "Review signals",
    page: "signals"
  },
  {
    state: "Next",
    title: "Not yet available",
    detail: "Questions on notice, Hansard, member profiles, alert delivery and parliamentary lines have no live source. They are listed below with the official APH page to use instead.",
    action: "View sources",
    page: "sources"
  }
];
const PROVENANCE_STACK = [
  {
    label: "Official source",
    title: "APH feeds with their source links",
    detail: "Every live item keeps its official APH link, and the Live page links to Hansard, ParlView and YouTube, before any analysis is added.",
    state: "Configured"
  },
  {
    label: "Transport",
    title: "Fetched from a fixed list of APH feeds",
    detail: "Parliament Pulse reads only the official APH feeds on its list, so nothing else enters the signal stream.",
    state: "Configured"
  },
  {
    label: "Enrichment",
    title: "Attention and confidence scoring",
    detail: "Parliament Pulse scores each live item with fixed rules that give the same result every time. Scores are Parliament Pulse's analysis, not APH content, and each item keeps its official source link.",
    state: "Derived"
  },
  {
    label: "Analyst action",
    title: "Briefs, exports, notes and watchlists",
    detail: "You can draft briefs, copy handoff notes, export CSV files and keep notes. All of it stays in this browser.",
    state: "Beta"
  }
];
const COVERAGE_MATRIX = [
  {
    module: "Live parliament",
    source: "signals",
    fallback: "Configured",
    evidence: "Six official APH RSS feeds plus chamber program and broadcast links.",
    activation: "Show whether each chamber is sitting, from an official source.",
    page: "live"
  },
  {
    module: "Sources",
    source: "connectors",
    fallback: "Configured",
    evidence: "Official feed register; each feed is health-checked on every poll.",
    activation: "Check feeds you add yourself before they join the signal stream.",
    page: "sources"
  },
  {
    module: "Overview signals",
    source: "signals",
    fallback: "Unavailable",
    evidence: "Signals from the official APH feeds, each linked to its source.",
    activation: "Recognise people, portfolios and bills in each item; keep scores labelled as Parliament Pulse analysis.",
    page: "signals"
  },
  {
    module: "Committees",
    source: "committees",
    fallback: "Unavailable",
    evidence: "Items from the Senate, House and joint committee feeds.",
    activation: "Add committee chairs, hearing dates and hearing status.",
    page: "committees"
  },
  {
    module: "Bills intelligence",
    source: "bills",
    fallback: "Unavailable",
    evidence: "Bills with a Bills Digest in the Parliamentary Library feed.",
    activation: "Track amendments and show which portfolio each bill belongs to.",
    page: "bills"
  },
  {
    module: "Briefings",
    source: null,
    fallback: "In this browser",
    evidence: "Briefs are copied to the clipboard or exported as CSV; the queue stays in this browser.",
    activation: "Share briefs with a team, assign a reviewer and record approval.",
    page: "briefings"
  },
  {
    module: "Threads",
    source: "threads",
    fallback: "Unavailable",
    evidence: "Parliament Pulse groups related live signals into threads.",
    activation: "Add Hansard and questions on notice once a feed for them can be reached.",
    page: "patterns"
  },
  {
    module: "Watchlists",
    source: "signals",
    derivedFrom: true,
    fallback: "Unavailable",
    evidence: "Whole-word keyword matching over the live signals.",
    activation: "Sending alerts needs a sign-in, which this release does not have.",
    page: "watchlists"
  }
];
function coverageState(row, counts) {
  const prov = row.source && counts && counts.provenance ? counts.provenance[row.source] : null;
  if (prov === "live") return row.derivedFrom ? "Derived" : "Live";
  if (prov === "derived") return "Derived";
  return row.fallback;
}
function coverageRows(counts) {
  return COVERAGE_MATRIX.map((row) => ({ ...row, state: coverageState(row, counts) }));
}
function BetaReadinessPanel({ navigate }) {
  return /* @__PURE__ */ React.createElement("div", { className: "beta-ledger", role: "group", "aria-label": "Beta evidence status" }, /* @__PURE__ */ React.createElement("div", { className: "beta-ledger-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Beta evidence ledger"), /* @__PURE__ */ React.createElement("h2", null, "What is live, what is derived, and what is not yet available")), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Official-first beta")), /* @__PURE__ */ React.createElement("div", { className: "beta-ledger-grid" }, BETA_READINESS_ROWS.map((row) => /* @__PURE__ */ React.createElement("button", { key: row.title, className: "beta-ledger-row", onClick: () => navigate(row.page) }, /* @__PURE__ */ React.createElement("span", { className: "beta-state beta-" + row.state.toLowerCase() }, row.state), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, row.title), /* @__PURE__ */ React.createElement("span", null, row.detail)), /* @__PURE__ */ React.createElement("span", { className: "beta-action" }, row.action, " \u2192")))));
}
function ProvenanceStackPanel({ navigate }) {
  return /* @__PURE__ */ React.createElement("div", { className: "provenance-stack" }, /* @__PURE__ */ React.createElement("div", { className: "provenance-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Source to decision"), /* @__PURE__ */ React.createElement("h2", null, "How a parliamentary item becomes a beta signal")), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => navigate("sources") }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Source register")), /* @__PURE__ */ React.createElement("div", { className: "provenance-steps" }, PROVENANCE_STACK.map((step, index) => /* @__PURE__ */ React.createElement("div", { key: step.label, className: "provenance-step" }, /* @__PURE__ */ React.createElement("div", { className: "prov-index" }, String(index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "prov-label" }, step.label), /* @__PURE__ */ React.createElement("strong", null, step.title), /* @__PURE__ */ React.createElement("p", null, step.detail)), /* @__PURE__ */ React.createElement("span", { className: "beta-state beta-" + (step.state === "Representative" ? "representative" : step.state === "Live" ? "live" : "next") }, step.state)))));
}
function ProvenanceMetricsBand({ navigate }) {
  const counts = useCounts();
  const feedCount = useFeedCount();
  const dash = (v) => typeof v === "number" ? v : NO_VALUE;
  const metrics = [
    { label: "Official feeds", value: dash(feedCount), detail: feedCount == null ? "Appears once the feed list loads" : "Official APH feeds checked every 30 minutes", icon: "rss", page: "sources" },
    { label: "Signals", value: dash(counts.signals), detail: counts.signals == null ? "Live signals are unavailable" : "Live signals held right now", icon: "signal", page: "signals" },
    { label: "Committee items", value: dash(counts.committees), detail: "From the live committee feeds", icon: "committee", page: "committees" },
    { label: "Human review", value: "On", detail: "Verify before publication", icon: "check" }
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "provenance-metrics" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Provenance at a glance"), /* @__PURE__ */ React.createElement("div", { className: "prov-metric-grid" }, metrics.map((m) => /* @__PURE__ */ React.createElement("button", { key: m.label, className: "prov-metric", "data-metric": m.label, onClick: () => navigate(m.page || "signals") }, /* @__PURE__ */ React.createElement(Icon, { name: m.icon, size: 14 }), /* @__PURE__ */ React.createElement("strong", null, m.value), /* @__PURE__ */ React.createElement("span", null, m.label), /* @__PURE__ */ React.createElement("small", null, m.detail)))));
}
function CoverageActivationMatrix({ navigate, copyPlan }) {
  const rows = coverageRows(useCounts());
  return /* @__PURE__ */ React.createElement("div", { className: "coverage-matrix", role: "group", "aria-label": "Desk coverage and what comes next" }, /* @__PURE__ */ React.createElement("div", { className: "coverage-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-section-title" }, "Desk coverage"), /* @__PURE__ */ React.createElement("h2", null, "What each desk shows today, and what comes next")), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: copyPlan }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Copy coverage table")), /* @__PURE__ */ React.createElement("div", { className: "coverage-grid" }, /* @__PURE__ */ React.createElement("div", { className: "coverage-row coverage-labels", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", null, "Desk"), /* @__PURE__ */ React.createElement("span", null, "Status"), /* @__PURE__ */ React.createElement("span", null, "Based on"), /* @__PURE__ */ React.createElement("span", null, "Next step"), /* @__PURE__ */ React.createElement("span", null, "Open")), rows.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.module, className: "coverage-row", "data-module": row.module }, /* @__PURE__ */ React.createElement("strong", null, row.module), /* @__PURE__ */ React.createElement("span", { className: "coverage-state state-" + row.state.toLowerCase().replace(/\s+/g, "-") }, row.state), /* @__PURE__ */ React.createElement("span", null, row.evidence), /* @__PURE__ */ React.createElement("span", null, row.activation), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => navigate(row.page) }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Open")))));
}
const legalH = { fontSize: "var(--t-body-sm)", fontWeight: 600, color: "var(--ink)", margin: "14px 0 4px" };
const LOCAL_STORAGE_KEYS = [
  { key: "cs-state-v1", holds: "your analyst notes, feedback, archived and tracked items, generated brief markers, created watchlists and added feeds" },
  { key: "pp-theme", holds: "your light or dark theme choice" },
  { key: "pp-nav-open", holds: "whether the mobile navigation was left open" },
  { key: "pp-beta-ack", holds: "that you dismissed the beta notice" },
  { key: "pp-onboarded", holds: "that you dismissed the How it works guide" },
  { key: "pp-shortcuts", holds: "whether you turned the single-key keyboard shortcuts off" }
];
function ContactLine({ purpose = "To report a correction or ask a privacy question", pending = "A public corrections address is being set up. Until it is published, check any item against the linked official APH source." }) {
  const c = SITE_CONFIG.contact;
  if (typeof c === "string" && /^https:\/\//i.test(c)) {
    return /* @__PURE__ */ React.createElement(React.Fragment, null, purpose, ", contact Prometheus Policy Lab at ", /* @__PURE__ */ React.createElement("a", { href: c, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, c.replace(/^https:\/\//i, "")), ".");
  }
  if (typeof c === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
    return /* @__PURE__ */ React.createElement(React.Fragment, null, purpose, ", email Prometheus Policy Lab at ", /* @__PURE__ */ React.createElement("a", { href: "mailto:" + c, style: { color: "var(--link)" } }, c), ".");
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, pending);
}
const A11Y_SCAN = {
  date: "2026-09-29",
  dateText: "29 September 2026",
  axeVersion: "4.13.0",
  tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  stateCount: 64
};
function AccessibilityPanel() {
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: "var(--gap-section)" }, id: "about-accessibility", "data-section": "accessibility" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Accessibility"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Target, what was tested, and known limits")), /* @__PURE__ */ React.createElement("div", { className: "panel-body", style: { fontSize: "var(--t-body-sm)", lineHeight: 1.65, color: "var(--ink-2)", maxWidth: 820 } }, /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Target"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "Parliament Pulse aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. This section does not claim full conformance: it states what has been measured."), /* @__PURE__ */ React.createElement("h3", { style: legalH }, "What was tested"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "On ", /* @__PURE__ */ React.createElement("time", { dateTime: A11Y_SCAN.date, "data-axe-scan-date": A11Y_SCAN.date }, A11Y_SCAN.dateText), ", an automated scan with axe-core ", /* @__PURE__ */ React.createElement("span", { "data-axe-version": A11Y_SCAN.axeVersion }, A11Y_SCAN.axeVersion), " checked ", /* @__PURE__ */ React.createElement("span", { "data-axe-state-count": A11Y_SCAN.stateCount }, A11Y_SCAN.stateCount), " page states against its WCAG 2.0, 2.1 and 2.2 Level A and AA rules (", /* @__PURE__ */ React.createElement("span", { className: "mono", "data-axe-tags": A11Y_SCAN.tags.join(" "), style: { fontSize: "var(--t-caption)" } }, A11Y_SCAN.tags.join(", ")), "). The states were every desk in the navigation, an open signal, an open feed detail dialog, the search results, and the phone navigation open and closed, each in the dark and the light theme at 1280 and 390 pixels wide. The scan found no serious or critical violations."), /* @__PURE__ */ React.createElement("p", { style: legalP }, "Most panels here have a gradient background, and axe cannot measure text contrast over a gradient. For those, the test measured contrast again with each gradient replaced by each of its colours in turn, and that found no serious or critical contrast failures either. ", /* @__PURE__ */ React.createElement("span", { "data-axe-unmeasured": "some" }, "Some elements, such as text partly covered by another layer, still could not be measured automatically and need a manual check.")), /* @__PURE__ */ React.createElement("p", { style: legalP }, "The scan ran against a recorded test copy of the APH feeds, so it checked the page structure and design, not the wording of any live item. A scripted keyboard test also checks that Tab reaches every signal's Open button, Enter opens it, Esc closes it and returns focus, and the closed phone navigation holds no focus stops."), /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Known limitations"), /* @__PURE__ */ React.createElement("ul", { style: { margin: "0 0 6px", paddingLeft: 18 } }, /* @__PURE__ */ React.createElement("li", null, "Automated tools find only some accessibility barriers. No manual audit or screen reader testing has been done yet."), /* @__PURE__ */ React.createElement("li", null, "Dialogs and views not listed above, such as bill, committee and watchlist details, were not part of the scan."), /* @__PURE__ */ React.createElement("li", null, "Item titles and descriptions come from the APH feeds as published. Parliament Pulse does not rewrite them, so it cannot fix their wording or structure."), /* @__PURE__ */ React.createElement("li", null, "The Live parliament page can load the APH YouTube player on request. The player's accessibility is YouTube's.")), /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Keyboard shortcuts"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "The single-key shortcuts (j, k, b, w and a) can be turned off from the keyboard shortcuts button in the top bar. They never fire while you type in a field or hold Ctrl, Cmd or Alt, and archiving with a shows a notice with Undo."), /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Report a barrier"), /* @__PURE__ */ React.createElement("p", { style: legalP }, /* @__PURE__ */ React.createElement(ContactLine, { purpose: "To report an accessibility barrier", pending: "A public contact address is being set up. Until it is published, this site has no channel for reporting an accessibility barrier." }))));
}
const legalP = { margin: "0 0 6px" };
function NotYetAvailablePanel() {
  const items = SITE_CONFIG && Array.isArray(SITE_CONFIG.unavailable) ? SITE_CONFIG.unavailable : [];
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: "var(--gap-section)" }, "data-section": "not-yet-available", id: "about-not-yet-available" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Not yet available"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "No live source, so not shown here")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, items.map((u, i) => /* @__PURE__ */ React.createElement("div", { key: u.id, "data-unavailable": u.id, style: { padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0, display: "grid", gap: 4 } }, /* @__PURE__ */ React.createElement("strong", { style: { fontSize: "var(--t-body-sm)", color: "var(--ink)" } }, u.name), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-body-sm)", color: "var(--ink-2)", lineHeight: 1.5 } }, u.reason), /* @__PURE__ */ React.createElement("a", { href: u.aphUrl, target: "_blank", rel: "noopener noreferrer", style: { fontSize: "var(--t-body-sm)", color: "var(--link)", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 24 } }, "Use the official page on aph.gov.au ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }))))));
}
function LegalNoticePanel() {
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: "var(--gap-section)" }, id: "about-legal" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Privacy, terms and disclaimer"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "What this is, and what it does with your data")), /* @__PURE__ */ React.createElement("div", { className: "panel-body", style: { fontSize: "var(--t-body-sm)", lineHeight: 1.65, color: "var(--ink-2)", maxWidth: 820 } }, /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Independent, not affiliated"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "Parliament Pulse is an independent project by Prometheus Policy Lab. It is not affiliated with, endorsed by, or an official product of the Parliament of Australia, the Department of Parliamentary Services, or any government body. It reads publicly available RSS feeds published at aph.gov.au and links every item back to its official source."), /* @__PURE__ */ React.createElement("h3", { style: legalH, id: "about-privacy" }, "Your privacy"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "No account, login, or email is required or collected through this site. We run no third-party analytics, advertising or tracking, and the site sets no cookies. Live parliamentary data is fetched from official APH feeds by the Parliament Pulse service for display and is not saved on your device."), /* @__PURE__ */ React.createElement("p", { style: legalP }, "Your browser's local storage holds only the following, on this device, and none of it is sent to us:"), /* @__PURE__ */ React.createElement("ul", { style: { margin: "0 0 6px", paddingLeft: 18 } }, LOCAL_STORAGE_KEYS.map((k) => /* @__PURE__ */ React.createElement("li", { key: k.key }, /* @__PURE__ */ React.createElement("code", { className: "mono", style: { fontSize: "var(--t-caption)" } }, k.key), ": ", k.holds))), /* @__PURE__ */ React.createElement("p", { style: legalP }, "Clearing this site's data in your browser removes all of it."), /* @__PURE__ */ React.createElement("p", { style: legalP }, `The Live parliament page opens on a branded card, not a video player. Your browser contacts YouTube (youtube-nocookie.com) only after you press "Load YouTube player"; from then on YouTube's own privacy policy applies to that player.`), /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Not advice"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "Parliament Pulse is derived intelligence over public sources, provided for information only. It is not legal, parliamentary, or professional advice. Scoring, clustering and watchlist matching are the product's own analysis and can contain errors. Verify against the linked official source at aph.gov.au before relying on any item."), /* @__PURE__ */ React.createElement("h3", { style: legalH, id: "about-licence" }, "Use and content"), /* @__PURE__ */ React.createElement("p", { style: legalP }, "The service is free and provided as-is, without warranty. Material published by the Australian Parliament remains subject to the Parliament's own copyright and terms of use; Parliament Pulse reproduces item titles unmodified, with attribution and a link to the official source, under the Parliament's ", APH_LICENCE_NAME, " licence; scores, summaries and clustering are Parliament Pulse's own analysis. Coverage and content may change without notice."), /* @__PURE__ */ React.createElement("h3", { style: legalH }, "Contact and corrections"), /* @__PURE__ */ React.createElement("p", { style: legalP }, /* @__PURE__ */ React.createElement(ContactLine, null)), /* @__PURE__ */ React.createElement("p", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-4)", marginTop: 14 } }, "Last updated 23 July 2026.")));
}
function PageAbout() {
  const { navigate, toast } = useStore();
  const goto = navigate;
  const counts = useCounts();
  const liveSignals = useLiveState("signals");
  const copyActivationPlan = () => {
    const table = coverageRows(counts).map((row) => `| ${row.module} | ${row.state} | ${row.evidence} | ${row.activation} |`).join("\n");
    const plan = [
      "# Parliament Pulse activation plan",
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      "| Desk | Current coverage | Based on | Next step |",
      "| --- | --- | --- | --- |",
      table,
      "",
      "## Immediate priorities",
      "1. Keep official feed polling visible in Live and avoid current-sitting claims until verified.",
      "2. Check feeds you add yourself before they join the signal stream.",
      "3. Wire production enrichment for scoring, entity extraction, watchlist matching, Hansard/QON extraction and briefing persistence.",
      "4. Keep every module without a live source off the public build until it has verified item-level evidence."
    ].join("\n");
    copyText(plan, toast, "Activation plan copied");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Reference"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "About the data"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "What is live, what is derived, and what is not yet available. Every module below states its evidence basis and links to the page that carries it."))), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", fontSize: "var(--t-body-sm)", lineHeight: 1.6, maxWidth: 760, marginBottom: "var(--gap-section)" } }, "Parliament Pulse is a live beta. It checks the official APH feeds every 30 minutes, and every live item links back to its source at aph.gov.au. Signal scoring, threads, source grouping and watchlist matching are Parliament Pulse's own analysis over those live items. No sample content is shown anywhere: a desk with nothing to show says so and links to the official source. This page is the honest account of that split."), /* @__PURE__ */ React.createElement("p", { "data-att-about": "", style: { color: "var(--ink-2)", fontSize: "var(--t-body-sm)", lineHeight: 1.6, maxWidth: 760, marginBottom: "var(--gap-section)" } }, /* @__PURE__ */ React.createElement("strong", null, "How attention and confidence are scored."), " ", attentionDisclosure(scoringDims((liveSignals.items || []).map((s) => s.attentionReason))), ' Confidence is shown as "Confidence n of 5" and reflects the kind of source only: inquiry, report and hearing items score 3, Bills Digests and divisions score 2, and everything else scores 1. When every item on a desk shares one attention or confidence value, the desk says so in one line instead of repeating a value that separates nothing.'), /* @__PURE__ */ React.createElement(BetaReadinessPanel, { navigate: goto }), /* @__PURE__ */ React.createElement(CoverageActivationMatrix, { navigate: goto, copyPlan: copyActivationPlan }), /* @__PURE__ */ React.createElement(ProvenanceStackPanel, { navigate: goto }), /* @__PURE__ */ React.createElement(ProvenanceMetricsBand, { navigate: goto }), /* @__PURE__ */ React.createElement(NotYetAvailablePanel, null), /* @__PURE__ */ React.createElement(AccessibilityPanel, null), /* @__PURE__ */ React.createElement(LegalNoticePanel, null));
}
function PageNotFound({ path }) {
  return /* @__PURE__ */ React.createElement("div", { className: "page", "data-page-not-found": "" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Address not recognised"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Page not found"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, path ? /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse has no page at ", /* @__PURE__ */ React.createElement("code", { className: "mono" }, "#/", String(path).replace(/^\//, "")), ". ") : null, "The link may be mistyped, or it may point to a page that has been removed."))), /* @__PURE__ */ React.createElement("p", { style: { display: "flex", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("a", { className: "btn primary", href: "#/overview" }, "Go to Overview"), /* @__PURE__ */ React.createElement("a", { className: "btn", href: "#/about" }, "About the data")));
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
  const allFeeds = [...APH_FEEDS, ...state.feeds.map((f) => ({ ...f, last: "Not polled", today: 0, modules: ["Custom"], parser: "Not yet checked", authority: "Custom", confidence: NOT_SUPPLIED }))];
  const checkByUrl = new Map((health.items || []).map((c) => [c.url, c]));
  const registryUrls = new Set((typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : []).map((r) => r.url));
  const workerRows = (health.items || []).filter((c) => !registryUrls.has(c.url));
  const healthyCount = (health.items || []).filter((c) => c.ok).length;
  const feedChecks = (health.items || []).filter((c) => c.isFeed);
  const feedShape = feedChecks.length > 0;
  const feedOk = feedChecks.filter((c) => feedHealthState(c) === "ok").length;
  const feedPending = feedChecks.filter((c) => feedHealthState(c) === "pending").length;
  const feedPolled = feedChecks.length - feedPending;
  const referenceLinks = health.referenceLinks || [];
  const registryByUrl = new Map((typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : []).map((r) => [r.url, r]));
  const customFeeds = state.feeds.map((f) => ({ ...f, authority: "Custom" }));
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Admin"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Sources"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "The official APH feeds Parliament Pulse reads", health.items ? ", with the result of the latest health check for each" : "; each feed's health appears after the next check", ". Feeds you add yourself are kept on this device and are not yet checked.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Refreshes the live RSS feeds shown on Live parliament", onClick: () => {
    if (typeof window.__refreshLiveFeeds === "function") {
      window.__refreshLiveFeeds();
      toast("Live feeds re-polled");
    } else {
      toast("Open Live parliament to refresh the feeds");
    }
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13 }), " Refresh all"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    var _a;
    return (_a = document.getElementById("new-feed-url")) == null ? void 0 : _a.focus();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " Add feed"))), /* @__PURE__ */ React.createElement("div", { className: "grid " + (feedShape ? "g-3" : "g-2"), style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat", "data-stat": "feeds" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Active feeds"), feedShape ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, feedChecks.length), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "official APH feeds checked every 30 minutes")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: "var(--t-subhead)", color: "var(--ink-3)" } }, NOT_SUPPLIED), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, health.items ? health.items.length + " sources health-checked; this version of the service does not list feeds one by one" : "Appears once the feed list loads"))), /* @__PURE__ */ React.createElement("div", { className: "panel stat", "data-stat": "healthy" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Healthy"), feedShape ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, feedOk, "/", feedPolled), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "polled feeds OK", feedPending ? ` \xB7 ${feedPending} not yet polled` : "", " \xB7 as at ", fmtFetchedAt(health.fetchedAt), " AEST")) : health.items ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, healthyCount, "/", health.items.length), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "as at ", fmtFetchedAt(health.fetchedAt), " AEST")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: "var(--t-subhead)", color: "var(--ink-3)" } }, NOT_SUPPLIED), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "Available after live poll"))), feedShape && /* @__PURE__ */ React.createElement("div", { className: "panel stat", "data-stat": "items" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Items at last check"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, feedChecks.reduce((n, c) => n + (c.itemsParsed || 0), 0)), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, "across ", feedPolled, " checked feed", feedPolled === 1 ? "" : "s"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview", style: { alignItems: "start" } }, health.status === "loading" && !health.items ? /* @__PURE__ */ React.createElement(SkeletonTable, { rows: 6 }) : /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Official APH feeds"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, feedShape ? `${feedChecks.length} feeds configured \xB7 one row per feed` : "Select a row for detail"), /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: health.displayProvenance,
      title: health.displayProvenance === "live" ? "Feed health from the latest check" : "Health appears after the next check"
    }
  )), health.status === "error" && !health.items && /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "sources", kicker: "Feed status unavailable", variant: "error" }, "The status service did not respond, so no feed health is shown. The official feed addresses are listed below, and APH publishes every feed on its ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Help/Rss_feeds", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "RSS feeds page"), ".")), feedShape ? /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "ds ds-stack", "data-feed-table": "" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Feed"), /* @__PURE__ */ React.createElement("th", null, "Group"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", { className: "num" }, "HTTP"), /* @__PURE__ */ React.createElement("th", { className: "num" }, "Items parsed"), /* @__PURE__ */ React.createElement("th", null, "Last success"), /* @__PURE__ */ React.createElement("th", null, "Parse error"))), /* @__PURE__ */ React.createElement("tbody", null, feedChecks.map((c) => {
    var _a, _b;
    const reg = registryByUrl.get(c.url);
    const st = feedHealthState(c);
    return /* @__PURE__ */ React.createElement("tr", { key: c.url, "data-feed-row": c.feedLabel, "data-feed-state": st }, /* @__PURE__ */ React.createElement("td", { className: "ds-lead", "data-label": "Feed" }, reg ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "row-btn", "data-feed-open": "", "aria-label": `${c.label}: feed detail`, onClick: () => openModal("feed", reg.id) }, c.label) : /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, c.label), /* @__PURE__ */ React.createElement("div", { className: "mono ds-url", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, c.url.length > 56 ? c.url.slice(0, 56) + "\u2026" : c.url)), /* @__PURE__ */ React.createElement("td", { "data-label": "Group" }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, c.group)), /* @__PURE__ */ React.createElement("td", { "data-label": "Status", style: st === "failed" ? { color: "var(--escalate)" } : st === "pending" ? { color: "var(--ink-4)", fontStyle: "italic" } : void 0 }, st === "pending" ? "Not yet polled" : st === "ok" ? "OK" : "Failed"), /* @__PURE__ */ React.createElement("td", { className: "num mono", "data-label": "HTTP" }, (_a = c.lastHttpStatus) != null ? _a : NO_VALUE), /* @__PURE__ */ React.createElement("td", { className: "num", "data-label": "Items parsed" }, (_b = c.itemsParsed) != null ? _b : NO_VALUE), /* @__PURE__ */ React.createElement("td", { className: "mono", "data-label": "Last success", style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, st === "pending" ? NO_VALUE : fmtPollStamp(c.lastSuccessAt) || "Never"), /* @__PURE__ */ React.createElement("td", { "data-label": "Parse error", style: { fontSize: "var(--t-caption)", color: c.parseError ? "var(--ink-2)" : "var(--ink-4)", overflowWrap: "anywhere" }, title: c.parseError || void 0 }, c.parseError ? c.parseError.length > 60 ? c.parseError.slice(0, 60) + "\u2026" : c.parseError : NO_VALUE));
  }), customFeeds.map((f) => /* @__PURE__ */ React.createElement("tr", { key: f.id }, /* @__PURE__ */ React.createElement("td", { className: "ds-lead", "data-label": "Feed" }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, f.name), /* @__PURE__ */ React.createElement("div", { className: "mono ds-url", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, f.url.length > 56 ? f.url.slice(0, 56) + "\u2026" : f.url)), /* @__PURE__ */ React.createElement("td", { "data-label": "Group" }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, "Custom")), /* @__PURE__ */ React.createElement("td", { "data-label": "Status" }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-4)", fontStyle: "italic" }, title: "Saved feeds are not polled" }, "Not polled")), /* @__PURE__ */ React.createElement("td", { className: "num", "data-label": "HTTP" }, NO_VALUE), /* @__PURE__ */ React.createElement("td", { className: "num", "data-label": "Items parsed" }, NO_VALUE), /* @__PURE__ */ React.createElement("td", { "data-label": "Last success" }, NO_VALUE), /* @__PURE__ */ React.createElement("td", { "data-label": "Parse error" }, NO_VALUE)))))) : /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "ds ds-stack" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Source"), /* @__PURE__ */ React.createElement("th", null, "Group"), /* @__PURE__ */ React.createElement("th", null, "Status"), /* @__PURE__ */ React.createElement("th", null, "Last"), /* @__PURE__ */ React.createElement("th", { className: "num" }, "Today"), /* @__PURE__ */ React.createElement("th", { title: "False-positive rate" }, "False positives ", /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 400, textTransform: "none", letterSpacing: 0 } }, "\xB7 ", FPR_PENDING_NOTE.toLowerCase())), /* @__PURE__ */ React.createElement("th", null, "Check"))), /* @__PURE__ */ React.createElement("tbody", null, allFeeds.map((f) => {
    var _a, _b;
    const c = checkByUrl.get(f.url);
    return /* @__PURE__ */ React.createElement("tr", { key: f.id }, /* @__PURE__ */ React.createElement("td", { className: "ds-lead", "data-label": "Source" }, f.group !== "Custom" ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "row-btn", "data-feed-open": "", "aria-label": `${f.name}: feed detail`, onClick: () => openModal("feed", f.id) }, f.name) : /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, f.name), /* @__PURE__ */ React.createElement("div", { className: "mono ds-url", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, f.url.length > 56 ? f.url.slice(0, 56) + "\u2026" : f.url)), /* @__PURE__ */ React.createElement("td", { "data-label": "Group" }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, f.group)), /* @__PURE__ */ React.createElement("td", { "data-label": "Status", style: c && !c.ok ? { color: "var(--escalate)" } : void 0 }, f.group === "Custom" ? /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-4)", fontStyle: "italic" }, title: "Saved feeds are not polled by the live feed poller" }, "Not polled") : c ? c.ok ? "Live" : `Error ${(_a = c.httpStatus) != null ? _a : ""}`.trim() : f.lastStatusCode != null ? f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error" : NO_VALUE), /* @__PURE__ */ React.createElement("td", { className: "mono", "data-label": "Last", style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, c ? fmtFetchedAt(c.checkedAt) : f.last || NO_VALUE), /* @__PURE__ */ React.createElement("td", { className: "num", "data-label": "Today" }, (_b = f.lastItemCount) != null ? _b : NO_VALUE), /* @__PURE__ */ React.createElement("td", { "data-label": "False positives", title: FPR_PENDING_NOTE, style: { color: "var(--ink-4)" } }, NO_VALUE), /* @__PURE__ */ React.createElement("td", { "data-label": "Check" }, f.parser || NO_VALUE));
  }), workerRows.map((c) => {
    var _a;
    return /* @__PURE__ */ React.createElement("tr", { key: c.url }, /* @__PURE__ */ React.createElement("td", { className: "ds-lead", "data-label": "Source" }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, c.label), /* @__PURE__ */ React.createElement("div", { className: "mono ds-url", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, c.url.length > 56 ? c.url.slice(0, 56) + "\u2026" : c.url)), /* @__PURE__ */ React.createElement("td", { "data-label": "Group" }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, c.group)), /* @__PURE__ */ React.createElement("td", { "data-label": "Status", style: !c.ok ? { color: "var(--escalate)" } : void 0 }, c.ok ? "Live" : `Error ${(_a = c.httpStatus) != null ? _a : ""}`.trim()), /* @__PURE__ */ React.createElement("td", { className: "mono", "data-label": "Last", style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, fmtFetchedAt(c.checkedAt)), /* @__PURE__ */ React.createElement("td", { className: "num", "data-label": "Today" }, NO_VALUE), /* @__PURE__ */ React.createElement("td", { "data-label": "False positives" }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, NO_VALUE)), /* @__PURE__ */ React.createElement("td", { "data-label": "Check" }, "Checked every 30 minutes"));
  }))))), /* @__PURE__ */ React.createElement("div", null, referenceLinks.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 }, "data-reference-pages": "" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Reference pages"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "APH pages linked from the app \xB7 not health-checked")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("ul", { style: { listStyle: "none", margin: 0, padding: 0 } }, referenceLinks.map((u) => /* @__PURE__ */ React.createElement("li", { key: u, "data-reference-link": "", style: { padding: "6px 0", borderBottom: "1px dashed var(--line-2)", fontSize: "var(--t-body-sm)", overflowWrap: "anywhere" } }, /* @__PURE__ */ React.createElement("a", { href: u, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--ink-2)" } }, u.replace(/^https?:\/\/(www\.)?/, ""))))))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Add RSS feed"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Name, URL, validate, save")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "new-feed-name", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Display name"), /* @__PURE__ */ React.createElement("input", { id: "new-feed-name", value: newName, onChange: (e) => setNewName(e.target.value), className: "search", style: { padding: "8px 10px", marginTop: 4, marginBottom: 8, width: "100%" } }), /* @__PURE__ */ React.createElement("label", { htmlFor: "new-feed-url", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Paste RSS URL"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } }, /* @__PURE__ */ React.createElement("input", { id: "new-feed-url", value: newUrl, onChange: (e) => setNewUrl(e.target.value), className: "search", style: { flex: 1, minWidth: 0, padding: "8px 10px" } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: startTest }, testing && !testState ? "Testing\u2026" : "Validate")), testState && /* @__PURE__ */ React.createElement("div", { className: "feed-test", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6, letterSpacing: ".1em", display: "flex", alignItems: "center", gap: 7 }, className: "warn" }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 12 }), " Example only \xB7 this feed has not been checked"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-4)", marginBottom: 8 } }, "This preview is an example. Parliament Pulse made no request and verified nothing, so treat this feed as unchecked."), testState.lines.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "feed-test-line " + l.t }, /* @__PURE__ */ React.createElement(Icon, { name: l.t === "ok" ? "check" : l.t === "warn" ? "flag" : "close", size: 12 }), /* @__PURE__ */ React.createElement("span", null, l.s))), /* @__PURE__ */ React.createElement("button", { className: "btn primary sm", style: { marginTop: 10 }, onClick: saveFeed }, "Save as unvalidated feed")))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Not yet connected"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "No usable source yet")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, [
    { name: "Hansard", note: "No machine-readable transcript feed yet" },
    { name: "QON tracking", note: "Needs source or parliamentary export" },
    { name: "Full bill progress", note: "Needs bills database beyond Digest RSS" },
    { name: "News / media monitoring", note: "Optional bundle, later" },
    { name: "Internal executive briefings", note: "Governance controls required" }
  ].map((x) => /* @__PURE__ */ React.createElement("div", { key: x.name, style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--line-2)" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)" } }, x.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, x.note)), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: "Copy a backlog request for this source", onClick: () => copyBacklogRequest(x.name, x.note, toast) }, "Request"))))))));
}
Object.assign(window, { PageSources, PageAbout, PageNotFound });
