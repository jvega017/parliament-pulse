function OnboardingGuide({ onDismiss }) {
  const key = "pp-onboarded";
  const dismiss = () => {
    safeSetLocalStorage(key, "1");
    if (onDismiss) onDismiss();
  };
  return /* @__PURE__ */ React.createElement("div", { style: { background: "var(--panel-hi)", border: "1px solid var(--brass-soft)", borderRadius: 10, padding: "16px", marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 14, stroke: "var(--brass)" }), /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--brass)", textTransform: "uppercase", letterSpacing: ".18em" } }, "Getting started"), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: dismiss,
      style: { marginLeft: "auto", background: "none", border: "none", color: "var(--ink-4)", cursor: "pointer", fontSize: "var(--t-body)", lineHeight: 1, padding: "0 4px" },
      "aria-label": "Dismiss guide"
    },
    "\xD7"
  )), /* @__PURE__ */ React.createElement("div", { className: "g-onboarding", style: { display: "grid", gap: 14 } }, [
    ["1. Signals", "Parliamentary intelligence items classified by attention level. Open any signal to read the full analysis and evidence trail."],
    ["2. Take action", "Open a signal, read the recommended action, then archive, generate a brief, or add to a watchlist. Use j/k to navigate, Esc to close."],
    ["3. Generate briefs", "Press b or click Generate brief to copy a structured brief to the clipboard. Completed briefs appear in the Briefings queue."]
  ].map(([h, b]) => /* @__PURE__ */ React.createElement("div", { key: h, style: { fontSize: "var(--t-body-sm)", color: "var(--ink-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, color: "var(--brass)", marginBottom: 4, fontSize: "var(--t-caption)" } }, h), b))));
}
function isPhoneViewport() {
  try {
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 780px)").matches;
  } catch (e) {
    return false;
  }
}
function PageOverview() {
  const { state, toast, navigate, liveState } = useStore();
  const goto = navigate;
  const live = useLiveState("signals");
  const sourceSignals = live.items || SIGNALS;
  const fresh = useFreshness();
  const feedCount = useFeedCount();
  const feedHealth = feedHealthSummary(liveState && liveState.blocks);
  const failingFeeds = failingFeedLabels(liveState && liveState.blocks);
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [sortByAttention, setSortByAttention] = useState(false);
  const [showHelp, setShowHelp] = useState(() => !safeGetLocalStorage("pp-onboarded") && !isPhoneViewport());
  const priority = sourceSignals.filter((s) => s.attention === "high" && !state.archived[s.id]);
  let rest = sourceSignals.filter((s) => s.attention !== "high" && !state.archived[s.id]);
  const DAY_MS = 24 * 60 * 60 * 1e3;
  const newest = sortSignalsNewestFirst(rest).slice(0, 3);
  const newestShown = !!live.items && priority.length === 0 && newest.length > 0;
  const shownIds = new Set(newestShown ? newest.map((s) => s.id) : []);
  const restMore = rest.filter((s) => !shownIds.has(s.id));
  const restRecent = restMore.filter((s) => s.dateKind === "datetime" && typeof s.pubAt === "number" && Date.now() - s.pubAt <= DAY_MS).length;
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
  const counts = useCounts();
  const committeeItemsLive = live.items ? live.items.filter((s) => COMMITTEE_STRIP_LABELS.has(s.source)) : [];
  const committeeHearingCount = committeeItemsLive.filter((i) => {
    var _a, _b;
    return ((_b = (_a = i.tags) == null ? void 0 : _a[0]) == null ? void 0 : _b.l) === "hearing";
  }).length;
  const committeeInquiryCount = committeeItemsLive.filter((i) => {
    var _a, _b;
    return ((_b = (_a = i.tags) == null ? void 0 : _a[0]) == null ? void 0 : _b.l) === "inquiry";
  }).length;
  const committeeHeld = heldOfAvailable(liveState && liveState.blocks && liveState.blocks.freshness, [...COMMITTEE_STRIP_LABELS], committeeItemsLive.length);
  const committeeReportCount = committeeItemsLive.filter((i) => {
    var _a, _b;
    return ((_b = (_a = i.tags) == null ? void 0 : _a[0]) == null ? void 0 : _b.l) === "report";
  }).length;
  const overviewBriefs = Object.entries(state.briefsGenerated || {}).map(([sid, v]) => {
    const sig = sourceSignals.find((s) => s.id === sid) || SIGNALS.find((s) => s.id === sid);
    const label = sig ? sig.isLive ? sig.source : sig.title.slice(0, 40) + "\u2026" : sid;
    return { type: v.type || "Executive brief", for: label, ts: v.ts };
  }).sort((a, b) => b.ts - a.ts).slice(0, 4);
  const generateDailyBrief = () => {
    const today = fmtDayMonYear(Date.now());
    const briefTitleMd = (brief) => brief.isLive ? brief.link ? `[${brief.title}](${brief.link})` : brief.meta.source : brief.title;
    const prioritySections = priority.length === 0 ? ["None."] : priority.map((s) => {
      const brief = buildBriefSections(s, !!s.isLive);
      return [
        // A live item's id is its APH URL, already carried by the title link, so
        // only a non-live example keeps its id in front of the title.
        brief.isLive ? `### ${briefTitleMd(brief)}` : `### ${brief.meta.id} - ${briefTitleMd(brief)}`,
        `Source: ${brief.meta.source} | ${confidenceLabel(brief.meta.confidence)}`,
        brief.summary,
        ...brief.recommendedAction ? [`**Action:** ${brief.recommendedAction.label}. ${brief.recommendedAction.reason}`] : [],
        ``
      ].join("\n");
    });
    const restSections = rest.length === 0 ? ["None."] : rest.map((s) => {
      const brief = buildBriefSections(s, !!s.isLive);
      return `- ${brief.isLive ? "" : `[${brief.meta.id}] `}${briefTitleMd(brief)}${brief.recommendedAction ? ` - ${brief.recommendedAction.label}` : ""}`;
    });
    const lines = [
      `# Parliamentary daily signal brief: ${today}`,
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `Total signals: ${priority.length + rest.length} \xB7 Priority: ${priority.length}`,
      ``,
      `## Priority signals`,
      ...prioritySections,
      `## All other signals`,
      ...restSections,
      ``,
      `---`,
      APH_ATTRIBUTION
    ].join("\n");
    copyText(lines, toast, "Daily brief copied to clipboard");
  };
  const copyBetaHandoff = () => {
    const health = feedHealthSummary(liveState && liveState.blocks);
    const unavailable = typeof SITE_CONFIG !== "undefined" && Array.isArray(SITE_CONFIG.unavailable) ? SITE_CONFIG.unavailable : [];
    const feedLine = health ? `- ${health.total} official APH feeds are polled by the Parliament Pulse service; ${health.ok} were healthy at the latest check${health.failed ? `, ${health.failed} failing` : ""}${health.pending ? `, ${health.pending} not yet polled` : ""}.` : "- Feed health has not loaded; see Sources.";
    const handoff = [
      "# Parliament Pulse beta handoff",
      `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      "## Feeds and signals",
      feedLine,
      `- The Live page reads ${liveFeedList().length} APH feeds directly.`,
      counts.signals == null ? "- No live signals are held right now." : `- ${counts.signals} live signals are held, ${priority.length} of them high attention.`,
      "",
      "## Desk coverage (as on About)",
      ...coverageRows(counts).map((r) => `- ${r.module}: ${r.state}`),
      "",
      "## Not yet available",
      ...unavailable.length ? unavailable.map((u) => `- ${u.name}`) : ["- None listed."],
      "",
      "Attention and confidence are Parliament Pulse's own heuristic scores. Verify each item on aph.gov.au before use."
    ].join("\n");
    copyText(handoff, toast, "Beta handoff copied");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page page-overview" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, live.items ? ["Live signals", fetchedClause(live.fetchedAt), "verify sitting status from the Live page"].filter(Boolean).join(" \xB7 ") : "Live data is unavailable \xB7 Parliament Pulse shows nothing rather than an invented signal \xB7 see the Live page for feed health"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Today's signals")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: live.displayProvenance,
      title: live.displayProvenance === "live" ? "Signals from the official APH feeds" : "Live signals are unavailable; the Live page links to the official APH feeds"
    }
  ), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", "aria-expanded": showHelp, onClick: () => setShowHelp((v) => !v) }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 12 }), " How it works"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => exportSignalsCSV(sourceSignals) }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Export CSV"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", "data-copy-handoff": "", onClick: copyBetaHandoff }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Copy beta handoff"), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: generateDailyBrief }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate daily brief"))), showHelp && /* @__PURE__ */ React.createElement(OnboardingGuide, { onDismiss: () => setShowHelp(false) }), /* @__PURE__ */ React.createElement("div", { className: "command-strip" }, /* @__PURE__ */ React.createElement("div", { className: "cs-primary" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Priority signals"), /* @__PURE__ */ React.createElement("div", { className: "cs-kpi cs-count-up" }, priority.length, /* @__PURE__ */ React.createElement("span", { className: "unit" }, priority.length > 0 ? "to triage" : "high")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta", style: { marginTop: 8, display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)" } }, priority.length + rest.length, " signals in view \xB7 ", sourceSignals.filter((s) => state.archived[s.id]).length, "/", sourceSignals.length, " actioned"), priority.length > 0 && /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginLeft: "auto" }, onClick: () => {
    var _a;
    return (_a = document.getElementById("priority-panel")) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "start" });
  } }, "Triage now \u2192"))), /* @__PURE__ */ React.createElement("div", { className: "cs-secondary", title: "Counted from the live Senate, House and joint committee feeds" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label", style: { display: "flex", alignItems: "center", gap: 8 } }, "Committee activity ", live.items && /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: "live", title: "Counted from the live committee feeds" })), /* @__PURE__ */ React.createElement("div", { className: "cs-stat" }, counts.committees == null ? NO_VALUE : counts.committees, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "items")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta" }, committeeHeld ? `${committeeHeld} \xB7 ` : "", committeeHearingCount, " hearing", committeeHearingCount !== 1 ? "s" : "", " \xB7 ", committeeInquiryCount, " inquir", committeeInquiryCount !== 1 ? "ies" : "y", " \xB7 ", committeeReportCount, " report", committeeReportCount !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("div", { className: "cs-secondary", "data-source-health": "" }, /* @__PURE__ */ React.createElement("div", { className: "cs-stat-label" }, "Source health"), feedHealth && feedHealth.failed > 0 ? /* @__PURE__ */ React.createElement("div", { className: "cs-stat", "data-feeds-failing": feedHealth.failed }, feedHealth.ok, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "of ", feedHealth.total, " feeds healthy")) : /* @__PURE__ */ React.createElement("div", { className: "cs-stat" }, feedCount == null ? NO_VALUE : feedCount, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "feeds")), failingFeeds.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "stat-meta", "data-failing-feeds": "", style: { color: "var(--caution)" } }, "Failing: ", failingFeeds.join(", ")), /* @__PURE__ */ React.createElement("div", { className: "stat-meta", "data-poll-line": "", style: fresh.stale ? { color: "var(--caution)" } : void 0 }, fresh.known ? fresh.stale ? fresh.stallText : fresh.pollLine : feedCount == null ? "Feed count appears once the feed list loads" : "Official APH feeds the service polls"))), /* @__PURE__ */ React.createElement("div", { className: "live-strip g-live-strip", style: { display: "grid", gap: 14, alignItems: "center", padding: "12px 16px", marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ok)" } }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-label)", letterSpacing: ".16em", color: "var(--ok)", fontWeight: 600 } }, "LATEST CONFIGURED SOURCES")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 18, fontSize: "var(--t-body-sm)", color: "var(--ink-2)", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "House:"), " program links available"), /* @__PURE__ */ React.createElement("div", { style: { width: 1, height: 16, background: "var(--line-2)" } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--ink)" } }, "Senate:"), " verify hearing status from APH before action")), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Hansard", target: "_blank", rel: "noopener noreferrer", className: "btn sm ghost", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " Hansard"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "btn sm ghost", style: { textDecoration: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }), " YouTube"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", onClick: () => goto && goto("live") }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 12 }), " Watch live")), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel", id: "priority-panel", style: { marginBottom: "var(--gap-section)" } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Priority signals"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, priority.length, " high-attention items \xB7 check each before use")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, live.status === "loading" && !live.items ? [...Array(3)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonCard, { key: i })) : !live.items ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "Live data unavailable", variant: "error" }, "Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Go to aph.gov.au"), ".") : /* @__PURE__ */ React.createElement(React.Fragment, null, priority.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s, hideAtt: true })), priority.length === 0 && /* @__PURE__ */ React.createElement(EmptyState, { icon: "check", kicker: "None" }, "No high-attention items in the current feeds."), priority.length === 0 && newest.length > 0 && /* @__PURE__ */ React.createElement("div", { "data-newest-signals": "", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("h3", { className: "mono t-label", style: { margin: "0 0 8px", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Newest signals"), newest.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s }))))), rest.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "panel-foot" }, /* @__PURE__ */ React.createElement("span", { "data-rest-line": "", style: { color: "var(--ink-3)", fontSize: "var(--t-body-sm)" } }, restMore.length > 0 ? `${restMore.length} more signal${restMore.length !== 1 ? "s" : ""} in the inbox${restRecent > 0 ? `, ${restRecent} published in the last 24 hours` : ""}` : "Every inbox signal is shown above"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginLeft: "auto" }, onClick: () => goto && goto("signals") }, "Open Signal inbox \u2192")))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-section-title" }, "What changed"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, live.items ? ["Live", fetchedClause(live.fetchedAt)].filter(Boolean).join(" \xB7 ") : "No live feed yet")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--rule-2)", fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, Object.keys(state.archived).length > 0 ? `You actioned ${Object.keys(state.archived).length} signal${Object.keys(state.archived).length !== 1 ? "s" : ""} this session.` : "No signals actioned yet this session.", " ", sourceSignals.length, " signals in the current inbox."), live.items ? /* @__PURE__ */ React.createElement("div", { className: "timeline" }, sortSignalsNewestFirst(live.items).slice(0, 6).map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id || i, className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, signalWhen(s), " \xB7 ", feedDisplayName(s.source)), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)", textDecoration: "none" }, title: "Opens the source at aph.gov.au" }, s.title) : s.title)))) : /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "No live timeline held" }, "Parliament Pulse holds no verified live changes for this window: live signals are unavailable right now. This timeline fills from the same feeds as the Signal inbox once they respond.")), /* @__PURE__ */ React.createElement("div", { className: "panel-section" }, /* @__PURE__ */ React.createElement("div", { className: "panel-section-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-section-title" }, "Briefing queue"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, overviewBriefs.length, " generated")), overviewBriefs.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "brief", kicker: "No briefs generated yet" }, "Open any signal and choose Generate brief. Your briefs appear here and in the full Briefings queue.") : overviewBriefs.map((b, i) => /* @__PURE__ */ React.createElement("div", { key: b.for + i, className: "data-row g-brief-row", style: { display: "grid", gap: 10, padding: "10px 0", borderBottom: i < overviewBriefs.length - 1 ? "1px solid var(--rule-2)" : 0 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500 } }, b.type), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, "For ", b.for)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-label)", color: "var(--ok)", textTransform: "uppercase", letterSpacing: ".12em" } }, "Copied to clipboard"), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", title: "Open the briefings queue", "aria-label": "Open briefings queue", onClick: () => goto && goto("briefings") }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 }))))))))), /* @__PURE__ */ React.createElement("div", { className: "about-data-line", style: { marginTop: "var(--gap-section)", fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, "Every figure here links to its source. See what is live, what is derived, and what is coming:", " ", /* @__PURE__ */ React.createElement("a", { href: "#/about", onClick: (e) => {
    e.preventDefault();
    goto && goto("about");
  }, style: { color: "var(--link)" } }, "About the data"), "."));
}
const APH_YT_CHANNEL = "UCzx6ti0rql6Q2Dc2zSAPmuA";
const APH_LIVE_EMBED_URL = `https://www.youtube-nocookie.com/embed/live_stream?channel=${APH_YT_CHANNEL}`;
const APH_LIVE_LABEL = "APH live stream";
const PARLVIEW_URL = "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/";
const PARLVIEW_CHAMBERS = [
  { id: "house", label: "House" },
  { id: "senate", label: "Senate" },
  { id: "federation", label: "Federation Chamber" }
];
function LiveBroadcast() {
  const [mode, setMode] = React.useState("card");
  const [nonce, setNonce] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (mode !== "embed" || loaded) return;
    const id = setTimeout(() => setMode("card"), 8e3);
    return () => clearTimeout(id);
  }, [mode, loaded, nonce]);
  const loadPlayer = () => {
    setLoaded(false);
    setNonce((n) => n + 1);
    setMode("embed");
  };
  if (mode === "card") {
    return /* @__PURE__ */ React.createElement("div", { className: "live-wrap live-card", "data-live-player": "card" }, /* @__PURE__ */ React.createElement("div", { className: "live-card-head" }, /* @__PURE__ */ React.createElement("span", { className: "live-card-dot", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("h2", { className: "live-card-title" }, APH_LIVE_LABEL)), /* @__PURE__ */ React.createElement("p", { className: "live-card-body" }, "AUSParliamentLive, the official Australian Parliament House streaming channel on YouTube, carries the chamber broadcasts while Parliament sits. The player is not loaded until you ask for it: loading it connects your browser to YouTube (youtube-nocookie.com)."), /* @__PURE__ */ React.createElement("div", { className: "live-card-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: loadPlayer, "data-load-player": "" }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13 }), " Load YouTube player"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "btn", style: { textDecoration: "none" } }, "YouTube ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 })), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen", target: "_blank", rel: "noopener noreferrer", className: "btn", style: { textDecoration: "none" } }, "APH Watch, Read, Listen ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 }))));
  }
  return /* @__PURE__ */ React.createElement("div", { className: "live-wrap live-embed", "data-live-player": "embed" }, /* @__PURE__ */ React.createElement(
    "iframe",
    {
      key: nonce,
      src: APH_LIVE_EMBED_URL,
      title: `${APH_LIVE_LABEL} (AUSParliamentLive on YouTube)`,
      allow: "encrypted-media; picture-in-picture",
      allowFullScreen: true,
      referrerPolicy: "strict-origin-when-cross-origin",
      sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",
      onLoad: () => setLoaded(true)
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "live-badge", style: { position: "absolute", top: 12, left: 12, zIndex: 3, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: 4, fontFamily: "var(--mono)", fontSize: "var(--t-eyebrow)", color: loaded ? "#fff" : "var(--ink-2)", letterSpacing: ".12em", border: "1px solid var(--line-bright)" } }, /* @__PURE__ */ React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: "var(--ink-3)" } }), loaded ? "Player loaded \xB7 status unverified" : "Connecting"), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setMode("card"),
      style: { position: "absolute", top: 12, right: 12, zIndex: 3, fontFamily: "var(--mono)", fontSize: "var(--t-label)", color: "#fff", background: "rgba(0,0,0,0.55)", border: "1px solid var(--line-bright)", padding: "4px 9px", borderRadius: 4, cursor: "pointer", letterSpacing: ".08em" },
      title: "Close the player and show the official sources"
    },
    "CLOSE PLAYER"
  ));
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
function sortLiveEventsNewestFirst(events) {
  const ms = (e) => e && e.date && typeof e.date.getTime === "function" && !Number.isNaN(e.date.getTime()) ? e.date.getTime() : null;
  return [...events].sort((a, b) => {
    const ea = ms(a), eb = ms(b);
    if (ea != null && eb != null && ea !== eb) return eb - ea;
    if (ea == null && eb != null) return 1;
    if (eb == null && ea != null) return -1;
    return a.feedIdx - b.feedIdx || a.itemIdx - b.itemIdx;
  });
}
function latestFeedItems(items, n = 6) {
  const ms = (e) => e && e.date && typeof e.date.getTime === "function" && !Number.isNaN(e.date.getTime()) ? e.date.getTime() : null;
  return items.map((e, i) => ({ e, i, t: ms(e) })).sort((a, b) => {
    var _a, _b;
    return (a.t == null) - (b.t == null) || ((_a = b.t) != null ? _a : 0) - ((_b = a.t) != null ? _b : 0) || a.i - b.i;
  }).slice(0, n).map((x, order) => ({ ...x.e, order }));
}
function PageLive() {
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
      return latestFeedItems(out);
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
      setEvents(sortLiveEventsNewestFirst(all).slice(0, 30));
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
  const fmtTime = (d) => !d || Number.isNaN(d.getTime()) ? NOT_SUPPLIED : fmtWhenShort(d.getTime());
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
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today \xB7 live"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Live parliament"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "The APH live stream, links to the official chamber pages, and the latest items from the official APH feeds.")), /* @__PURE__ */ React.createElement("div", { className: "live-head-actions", "data-live-actions": "" }, PARLVIEW_CHAMBERS.map((c) => /* @__PURE__ */ React.createElement(
    "a",
    {
      key: c.id,
      href: PARLVIEW_URL,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "btn",
      "data-chamber-link": c.id,
      title: `Watch the ${c.label === "House" ? "House of Representatives" : c.label} on ParlView (APH)`,
      style: { textDecoration: "none" }
    },
    c.label,
    " on ParlView ",
    /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12 })
  )), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy a timestamped live action note", onClick: () => copyLiveActionNote("Flag moment", toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 13 }), " Flag moment"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-live-main", style: { gap: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(LiveBroadcast, null), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "src-badge" }, "AUSParliamentLive \xB7 YouTube, loads on request"), /* @__PURE__ */ React.createElement("a", { href: "https://www.youtube.com/@AUSParliamentLive/streams", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--link)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " AUSParliamentLive"), /* @__PURE__ */ React.createElement("a", { href: PARLVIEW_URL, target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--link)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " ParlView archive"), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Hansard", target: "_blank", rel: "noopener noreferrer", className: "src-badge", style: { textDecoration: "none", color: "var(--link)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 }), " Hansard"), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", style: { marginLeft: "auto" }, title: "Copy a Hansard follow-up note", onClick: () => copyLiveActionNote("Transcript follow-up", toast) }, "Copy transcript note"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", title: "Copy a source-backed clip note", onClick: () => copyLiveActionNote("Clip to brief", toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 12 }), " Clip to brief")), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Daily program"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House and Senate"), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { fontSize: "var(--t-caption)", color: "var(--link)", textDecoration: "none" } }, "House program ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })), /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { fontSize: "var(--t-caption)", color: "var(--link)", textDecoration: "none" } }, "Senate program ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })))), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "clock", kicker: "Programs are on aph.gov.au" }, 'This page does not build a chamber daily program. House daily program items from the APH feed appear in the "Recent items \xB7 APH RSS" panel on this page whenever the feed returns them. Open the House or Senate program above for the current official schedule.'))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Official APH links"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Source pages")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "g-link-grid", style: { display: "grid", gap: 8 } }, [
    { name: "Hansard", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", desc: "Official Hansard source page" },
    { name: "ParlInfo Search", url: "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p", desc: "Official search page" },
    { name: "Bills Search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", desc: "Official bills search page" },
    { name: "Senate Dynamic Red", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents", desc: "Official Senate program page" },
    { name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official House program page" },
    { name: "Division results", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", desc: "Official division lists page" },
    { name: "Committee RSS feeds", url: "https://www.aph.gov.au/Parliamentary_Business/Committees", desc: "Official committee RSS listing" },
    { name: "Senators & Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Official member roster page" }
  ].map((c, i) => /* @__PURE__ */ React.createElement("a", { key: i, href: c.url, target: "_blank", rel: "noopener noreferrer", style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: 6, textDecoration: "none", color: "var(--ink)", background: "var(--panel-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500 } }, c.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)", marginTop: 2 } }, c.desc)), /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, stroke: "var(--ink-3)" }))))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recent items \xB7 APH RSS"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, loading && events.length === 0 ? "Polling\u2026" : `${events.length} item${events.length !== 1 ? "s" : ""} \xB7 ${liveCount}/${totalFeeds} feeds${lastPoll ? " \xB7 as at " + fmtTime(lastPoll) + " AEST" : ""}`)), /* @__PURE__ */ React.createElement("div", { className: "panel-body", style: { maxHeight: 720, overflowY: "auto" } }, loading && events.length === 0 && /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 0" }, role: "status", "aria-label": "Loading live RSS feed", "aria-busy": "true" }, [...Array(6)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonRow, { key: i }))), !loading && events.length === 0 && (showDevDetail ? /* @__PURE__ */ React.createElement("div", { className: "empty-state error", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 15, stroke: "var(--caution)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--caution)", fontWeight: 500, marginBottom: 6 } }, "No items returned"), isFileGuard ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "This page was opened from the file system, so the browser cannot reach the feed proxy."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: "var(--t-eyebrow)", background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4 } }, "Serve over http, for example: ", /* @__PURE__ */ React.createElement("strong", null, "python -m http.server 8080"))) : isLocalHost ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "The local CORS proxy did not return data. Either the proxy is not running or APH rejected the request."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: "var(--t-eyebrow)", background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4 } }, "Start the proxy: ", /* @__PURE__ */ React.createElement("strong", null, "node proxy-server.js"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px" } }, "Worker returned no items. Confirm the Cloudflare Worker is deployed and this origin is on its CORS allowlist."), /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px", fontFamily: "var(--mono)", fontSize: "var(--t-eyebrow)", background: "var(--panel-2)", padding: "6px 8px", borderRadius: 4, wordBreak: "break-all" } }, "Worker: ", /* @__PURE__ */ React.createElement("strong", null, "https://aph-proxy.jvega019.workers.dev/rss?u="))), feedErrors.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { margin: "0 0 8px" } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".18em", marginBottom: 4 } }, "Feed errors"), feedErrors.slice(0, 8).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)", display: "flex", gap: 8, padding: "2px 0" } }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 12, stroke: "var(--ember-flash)" }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1, minWidth: 0 } }, e.label), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-4)" } }, e.error)))), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "Links below still open the raw feeds in a new tab."))) : /* @__PURE__ */ React.createElement("div", { className: "empty-state", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 15, stroke: "var(--ink-4)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontWeight: 500, marginBottom: 6 } }, "Live feed reconnecting"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "No new items in the latest poll. The official source links open the raw feeds directly.")))), events.map((e, i) => /* @__PURE__ */ React.createElement("a", { key: e.link || e.title + i, href: safeHttpUrl(e.link) || safeHttpUrl(e.sourceUrl) || "#", target: "_blank", rel: "noopener noreferrer", className: "clk data-row g-live-event", style: { display: "grid", gap: 10, borderRadius: 6, alignItems: "start", textDecoration: "none", color: "inherit" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", paddingTop: 2 } }, fmtTime(e.date)), /* @__PURE__ */ React.createElement("div", { style: { paddingTop: 3 } }, e.kind === "division" && /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 13, stroke: "var(--escalate)" }), e.kind === "hearing" && /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13, stroke: "var(--ink-4)" }), e.kind === "inquiry" && /* @__PURE__ */ React.createElement(Icon, { name: "pattern", size: 13, stroke: "var(--brass)" }), e.kind === "digest" && /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13, stroke: "var(--brass)" }), e.kind === "program" && /* @__PURE__ */ React.createElement(Icon, { name: "clock", size: 13, stroke: "var(--ink-3)" }), e.kind === "report" && /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13, stroke: "var(--ink-4)" }), e.kind === "signal" && /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 13, stroke: "var(--ink-3)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", color: "var(--ink)", lineHeight: 1.4 } }, e.title), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, e.kind), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-micro)", color: "var(--link)", fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", gap: 3 } }, /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 10 }), " ", e.sourceLabel)))))), /* @__PURE__ */ React.createElement("div", { className: "panel-foot", style: { flexDirection: "column", alignItems: "flex-start", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-3)" } }, "This panel re-reads the APH feeds every 2 min, apart from the service's own poll"), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, "Last poll: ", lastPoll ? fmtTime(lastPoll) : NOT_SUPPLIED, " \xB7 Click any item to open source")))));
}
function PageRadar() {
  const live = useLiveState("signals");
  const derivedRows = React.useMemo(() => {
    if (!live.items) return null;
    const rank = { high: 3, med: 2, low: 1 };
    const groups = /* @__PURE__ */ new Map();
    live.items.forEach((s) => {
      const key = s.sourceGroup || "Other";
      const g = groups.get(key) || { group: key, count: 0, sources: /* @__PURE__ */ new Set(), att: null };
      g.count += 1;
      if (s.source) g.sources.add(s.source);
      if ((rank[s.attention] || 0) > (rank[g.att] || 0)) g.att = s.attention;
      groups.set(key, g);
    });
    return [...groups.values()].map((g) => ({ group: g.group, att: g.att, sources: g.sources.size, count: g.count })).sort((a, b) => b.count - a.count);
  }, [live.items]);
  const derived = !!derivedRows;
  const rows = derivedRows || RADAR;
  const attAll = uniformScore(rows, "att");
  const showAtt = attAll === void 0;
  const cols = showAtt ? "1fr 90px 90px 150px" : "1fr 90px 90px";
  const head = { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em" };
  const disclosure = attentionDisclosure(scoringDims((live.items || []).map((s) => s.attentionReason)));
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Today"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Activity by source"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Live signals counted by source group, with the number of feeds behind each group and the highest attention level among its items. A tally of what the feeds published, not a trend.")), /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: derived ? "derived" : "fixture",
      title: derived ? "Counted from the live signal stream" : "Live data is unavailable, so no groups render"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Source groups"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, derived ? `${rows.length} group${rows.length !== 1 ? "s" : ""} from ${live.items.length} live signals` : "No live signal stream connected")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, rows.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "radar", kicker: "Live data unavailable", variant: "error" }, "Live data is unavailable. Parliament Pulse shows nothing rather than an invented tally. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Go to aph.gov.au"), ".") : /* @__PURE__ */ React.createElement(React.Fragment, null, !showAtt && /* @__PURE__ */ React.createElement("div", { className: "score-uniform", "data-uniform": "attention", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)", marginBottom: 10 } }, uniformScoreLine(rows.length, "attention", attAll, "source groups")), /* @__PURE__ */ React.createElement("div", { className: "radar-row radar-head g-radar-table", style: { display: "grid", gridTemplateColumns: cols, padding: "4px 0 10px", borderBottom: "1px solid var(--line)", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: head }, "Source group"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { ...head, textAlign: "right" } }, "Items"), /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { ...head, textAlign: "right" } }, "Feeds"), showAtt && /* @__PURE__ */ React.createElement("div", { className: "mono t-label", "data-col": "attention", style: head, title: disclosure }, "Highest attention")), rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.group, className: "radar-row g-radar-table", style: { display: "grid", gridTemplateColumns: cols, padding: "14px 8px", borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : 0, gap: 14, alignItems: "center", borderRadius: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body)", fontWeight: 500 } }, r.group), /* @__PURE__ */ React.createElement("div", { className: "mono radar-num", style: { textAlign: "right", color: "var(--ink-2)" } }, r.count, /* @__PURE__ */ React.createElement("span", { className: "radar-mlabel" }, " item", r.count !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("div", { className: "mono radar-num", style: { textAlign: "right", color: "var(--ink-2)" } }, r.sources, /* @__PURE__ */ React.createElement("span", { className: "radar-mlabel" }, " feed", r.sources !== 1 ? "s" : "")), showAtt && /* @__PURE__ */ React.createElement("div", { "data-col": "attention" }, /* @__PURE__ */ React.createElement(Att, { level: r.att, disclosure })))), /* @__PURE__ */ React.createElement("div", { className: "score-disclosure", "data-att-disclosure-line": "", style: { fontSize: "var(--t-caption)", color: "var(--ink-4)", marginTop: 12 } }, disclosure)))));
}
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
function signalProgressLine(shownCount, total) {
  const noun = total === 1 ? "signal" : "signals";
  if (shownCount < total) return `Showing ${shownCount} of ${total} ${noun}`;
  return total === 1 ? "Showing 1 signal" : `Showing all ${total} ${noun}`;
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
    else if (sort === "time") sigs = sortSignalsNewestFirst(sigs);
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
  const inView = React.useMemo(() => sourceSignals.filter((s) => !state.archived[s.id]), [sourceSignals, state.archived]);
  const attAll = uniformScore(inView, "attention");
  const confAll = uniformScore(inView, "confidence");
  const hideAtt = attAll !== void 0;
  const hideConf = confAll !== void 0;
  const disclosure = attentionDisclosure(scoringDims(inView.map((s) => s.attentionReason)));
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
      title: live.displayProvenance === "live" ? "Signals from the official APH feeds" : "Live data is unavailable, so these signals are not live"
    }
  ), /* @__PURE__ */ React.createElement("label", { htmlFor: "sig-sort", className: "sr-only" }, "Sort signals"), /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { fontSize: "var(--t-caption)", color: "var(--ink-4)" } }, "Sort:"), /* @__PURE__ */ React.createElement("select", { id: "sig-sort", className: "select", value: sort, onChange: (e) => setSort(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "time" }, "Newest first"), /* @__PURE__ */ React.createElement("option", { value: "score" }, "Authority score")))), signalSearchQuery && /* @__PURE__ */ React.createElement("div", { className: "empty-state", style: { marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 } }, /* @__PURE__ */ React.createElement("span", null, 'Filtered by search: "', signalSearchQuery, '"'), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => setSignalSearchQuery("") }, "Clear search")), /* @__PURE__ */ React.createElement("div", { role: "group", "aria-label": "Filter signals by attention level", style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" } }, [["all", "All"], ["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([val, label]) => /* @__PURE__ */ React.createElement(
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
  ))), live.status === "loading" && !live.items ? /* @__PURE__ */ React.createElement("div", { role: "status", "aria-busy": "true", "aria-label": "Loading signals" }, [...Array(5)].map((_, i) => /* @__PURE__ */ React.createElement(SkeletonCard, { key: i }))) : visible.length === 0 ? filter !== "all" ? /* @__PURE__ */ React.createElement(
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
  ) : !live.items ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "Live data unavailable", variant: "error" }, "Live data is unavailable. Parliament Pulse shows nothing rather than showing something invented. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Go to aph.gov.au"), ".") : /* @__PURE__ */ React.createElement(EmptyState, { icon: "check", kicker: "Inbox zero" }, "All signals reviewed. New items appear when the next feed poll lands.") : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "sr-only" }, "Signals"), (hideAtt || hideConf) && /* @__PURE__ */ React.createElement("div", { className: "score-uniform", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)", marginBottom: 12 } }, hideAtt && /* @__PURE__ */ React.createElement("div", { "data-uniform": "attention" }, uniformScoreLine(inView.length, "attention", attAll)), hideConf && /* @__PURE__ */ React.createElement("div", { "data-uniform": "confidence" }, uniformScoreLine(inView.length, "confidence", confAll))), shown.map((s) => /* @__PURE__ */ React.createElement(SignalCard, { key: s.id, s, hideAtt, hideConf })), /* @__PURE__ */ React.createElement("div", { className: "score-disclosure", "data-att-disclosure-line": "", style: { fontSize: "var(--t-caption)", color: "var(--ink-4)", marginTop: 12 } }, disclosure), moreToShow && /* @__PURE__ */ React.createElement("div", { ref: sentinelRef, className: "list-sentinel", "aria-hidden": "true" }), progressive && /* @__PURE__ */ React.createElement("div", { className: "list-progress", style: { display: "flex", alignItems: "center", gap: 12, padding: "14px 4px 4px" } }, /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", letterSpacing: ".08em" } }, signalProgressLine(shown.length, visible.length)), moreToShow && /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", style: { marginLeft: "auto" }, onClick: () => setRenderCap((cap) => cap + CHUNK) }, "Show more"))));
}
Object.assign(window, { PageOverview, PageLive, PageRadar, PageSignals, OnboardingGuide });
