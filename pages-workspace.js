function LiveFeedStrip({ title, items, fetchedAt, emptyText }) {
  if (!items || items.length === 0) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, title), /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: "live", title: "Live items from the official APH feeds" }), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, "fetched ", fmtFetchedAt(fetchedAt), " AEST")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, items.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, emptyText) : items.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id || i, className: "data-row", style: { display: "grid", gap: 6, padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : 0 } }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--link)", textDecoration: "none", fontSize: "var(--t-body-sm)", fontWeight: 500 }, title: "Opens the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })) : /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500, color: "var(--ink-2)" } }, s.source), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, s.tags && s.tags[0] && s.tags[0].l || "item"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, s.source), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, s.date))))));
}
function recessEmptyText(scope, url, linkLabel) {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, scope, " This does not establish whether the chamber is sitting. Check the official source for current proceedings.", " ", /* @__PURE__ */ React.createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, linkLabel, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), ".");
}
function LiveSignalRow({ s, isLast }) {
  return /* @__PURE__ */ React.createElement("div", { className: "data-row", style: { padding: "10px 0", borderBottom: isLast ? 0 : "1px solid var(--line)" } }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)", textDecoration: "none", fontSize: "var(--t-body-sm)", fontWeight: 500 }, title: "Opens the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })) : /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500, color: "var(--ink-2)" } }, s.source), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, s.source), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-4)" } }, s.date)));
}
function SittingDeskList({ rows, unavailableText, emptyIcon = "clock", emptyKicker, emptyBody }) {
  if (rows === null) {
    return /* @__PURE__ */ React.createElement(EmptyState, { icon: emptyIcon, kicker: "Live data unavailable", variant: "error" }, unavailableText);
  }
  if (rows.length === 0) {
    return /* @__PURE__ */ React.createElement(EmptyState, { icon: emptyIcon, kicker: emptyKicker }, emptyBody);
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, rows.map((s, i) => /* @__PURE__ */ React.createElement(LiveSignalRow, { key: s.id || i, s, isLast: i === rows.length - 1 })));
}
function DivisionsLiveList() {
  const live = useLiveState("signals");
  const rows = live.items ? live.items.filter((s) => s.source === "House divisions") : null;
  return /* @__PURE__ */ React.createElement(
    SittingDeskList,
    {
      rows,
      emptyIcon: "flag",
      unavailableText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified division results right now because the live signal feed is unavailable. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open division results on aph.gov.au"), "."),
      emptyKicker: "No divisions in the feed window",
      emptyBody: recessEmptyText("The House divisions feed lists no division results in the current feed window.", "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", "Open division results on aph.gov.au")
    }
  );
}
function TodaysHearingsPanel() {
  const live = useLiveState("signals");
  const HEARING_LABELS = /* @__PURE__ */ new Set(["Today's House and joint hearings", "Today's Senate hearings"]);
  const rows = live.items ? live.items.filter((s) => HEARING_LABELS.has(s.source)) : null;
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Today's hearings"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House, joint & Senate")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(
    SittingDeskList,
    {
      rows,
      emptyIcon: "clock",
      unavailableText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified hearing schedule right now because the live signal feed is unavailable. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open committee hearings on aph.gov.au"), "."),
      emptyKicker: "No hearings dated today",
      emptyBody: recessEmptyText("The APH feeds of today's House, joint and Senate hearings list no hearings dated today.", "https://www.aph.gov.au/Parliamentary_Business/Committees", "Open committee hearings on aph.gov.au")
    }
  )));
}
const COMMITTEE_RECENT_LABELS = /* @__PURE__ */ new Set([
  "Senate reports tabled",
  "New Senate inquiries",
  "House committee inquiries",
  "Joint committee inquiries"
]);
function PageCommittees() {
  const liveSignalsState = useLiveState("signals");
  const items = liveSignalsState.items;
  const upcomingHearings = items ? items.filter((s) => s.source === "Upcoming Senate hearings") : null;
  const recentItems = items ? items.filter((s) => COMMITTEE_RECENT_LABELS.has(s.source)) : null;
  const { toast } = useStore();
  const exportPrepPack = () => {
    const rows = recentItems || [];
    if (rows.length === 0) {
      toast("No live committee items to export yet", "error");
      return;
    }
    exportRowsCSV(
      ["date", "feed", "title", "link"],
      rows.map((r) => [r.date, r.source, r.title, r.link || ""]),
      `parliament-pulse-committee-prep-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`
    );
    toast("Committee prep pack exported", "brass");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Committees"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Senate, House and joint committee hearings, inquiries and reports from the official APH committee feeds, each linked to its page on aph.gov.au.")), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", title: "Export the current live committee rows", onClick: exportPrepPack }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Export prep pack")), /* @__PURE__ */ React.createElement("div", { className: "grid g-3", style: { marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Upcoming Senate hearings"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, (upcomingHearings || []).length)), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Inquiries and reports"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, (recentItems || []).length)), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Official committee feeds"), /* @__PURE__ */ React.createElement("div", { className: "stat-value" }, COMMITTEE_STRIP_LABELS.size, /* @__PURE__ */ React.createElement("span", { className: "unit" }, "tracked")))), /* @__PURE__ */ React.createElement(TodaysHearingsPanel, null), /* @__PURE__ */ React.createElement("div", { className: "grid g-2" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Upcoming Senate hearings"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, (upcomingHearings || []).length, " from the APH feed")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(
    SittingDeskList,
    {
      rows: upcomingHearings,
      emptyIcon: "signal",
      unavailableText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified upcoming Senate hearings right now because the live signal feed is unavailable. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open committee hearings on aph.gov.au"), "."),
      emptyKicker: "No upcoming hearings listed",
      emptyBody: /* @__PURE__ */ React.createElement(React.Fragment, null, "The Upcoming Senate hearings feed lists no hearings in the current live window. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open committee hearings on aph.gov.au"), ".")
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Inquiries and reports"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, (recentItems || []).length, " from the APH feeds")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(
    SittingDeskList,
    {
      rows: recentItems,
      emptyIcon: "signal",
      unavailableText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified committee reports or inquiries right now because the live signal feed is unavailable. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open committee reports on aph.gov.au"), "."),
      emptyKicker: "No reports or inquiries listed",
      emptyBody: /* @__PURE__ */ React.createElement(React.Fragment, null, "The committee inquiry and report feeds list no items in the current live window. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open committee reports on aph.gov.au"), ".")
    }
  )))));
}
function PageBills() {
  const live = useLiveBills();
  const bills = live.items;
  const fmtBillDate = (iso) => fmtIsoDate(iso, true);
  const attAll = uniformScore(bills, "attention");
  const confAll = uniformScore(bills, "confidence");
  const showAtt = attAll === void 0;
  const showConf = confAll === void 0;
  const disclosure = attentionDisclosure(scoringDims((bills || []).map((b) => b.scoring_explanation)));
  const exportBills = () => {
    const headers = ["title", "published", "attention", "confidence", "link"];
    const rows = (bills || []).map((b) => [b.title, b.pub_date || "", attentionWord(b.attention) || "not scored", confidenceLabel(b.confidence), b.link || ""]);
    exportRowsCSV(headers, rows, `parliament-pulse-bills-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`);
  };
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament \xB7 Bills Intelligence"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Bills intelligence"), /* @__PURE__ */ React.createElement("div", { className: "page-sub", "data-bills-scope": "" }, "Lists bills that have a Bills Digest in the Parliamentary Library feed, not every bill before Parliament. Each title links to its ParlInfo record; attention and confidence are Parliament Pulse's own scoring. For every bill, ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "search bills on aph.gov.au"), ".")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center" } }, bills && /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: "live", title: "Bills from the Parliamentary Library Bills Digest feed" }), /* @__PURE__ */ React.createElement("button", { className: "btn", disabled: !bills || bills.length === 0, onClick: exportBills }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 13 }), " Export register"))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Tracked bills"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, bills ? `${bills.length} bill${bills.length !== 1 ? "s" : ""} \xB7 fetched ${fmtFetchedAt(live.fetchedAt)} AEST` : live.status === "loading" ? "Loading\u2026" : NO_VALUE)), live.status === "loading" && !bills ? /* @__PURE__ */ React.createElement(SkeletonTable, { rows: 6 }) : !bills ? /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "bill", kicker: "Live data unavailable", variant: "error" }, "Parliament Pulse could not load the bills list just now, so it shows nothing rather than an invented list. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open Bills Legislation on aph.gov.au"), ".")) : bills.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "bill", kicker: "No bills returned" }, "The Bills Digest feed returned no bills just now. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open Bills Legislation on aph.gov.au"), ".")) : /* @__PURE__ */ React.createElement(React.Fragment, null, (!showAtt || !showConf) && /* @__PURE__ */ React.createElement("div", { className: "panel-body score-uniform", style: { fontSize: "var(--t-body-sm)", color: "var(--ink-3)", paddingBottom: 0 } }, !showAtt && /* @__PURE__ */ React.createElement("div", { "data-uniform": "attention" }, uniformScoreLine(bills.length, "attention", attAll)), !showConf && /* @__PURE__ */ React.createElement("div", { "data-uniform": "confidence" }, uniformScoreLine(bills.length, "confidence", confAll))), /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", { className: "ds ds-stack", "data-bills-table": "" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "Title"), /* @__PURE__ */ React.createElement("th", null, "Published"), showAtt && /* @__PURE__ */ React.createElement("th", { "data-col": "attention", title: disclosure }, "Attention"), showConf && /* @__PURE__ */ React.createElement("th", { "data-col": "confidence" }, "Confidence"))), /* @__PURE__ */ React.createElement("tbody", null, bills.map((b) => {
    const link = safeHttpUrl(b.link);
    return /* @__PURE__ */ React.createElement("tr", { key: b.guid }, /* @__PURE__ */ React.createElement("td", { className: "ds-lead", "data-label": "Title", style: { fontWeight: 500 } }, link ? /* @__PURE__ */ React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)", textDecoration: "none" }, title: "Opens the source at aph.gov.au" }, b.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })) : b.title, b.description && /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-caption)", color: "var(--ink-3)", marginTop: 2 } }, b.description)), /* @__PURE__ */ React.createElement("td", { className: "mono", "data-label": "Published", style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, fmtBillDate(b.pub_date)), showAtt && /* @__PURE__ */ React.createElement("td", { "data-col": "attention", "data-label": "Attention" }, /* @__PURE__ */ React.createElement(Att, { level: b.attention, disclosure })), showConf && /* @__PURE__ */ React.createElement("td", { "data-col": "confidence", "data-label": "Confidence" }, /* @__PURE__ */ React.createElement(Conf, { n: b.confidence })));
  })))), /* @__PURE__ */ React.createElement("div", { className: "panel-body score-disclosure", "data-att-disclosure-line": "", style: { fontSize: "var(--t-caption)", color: "var(--ink-4)" } }, disclosure))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Related divisions"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(DivisionsLiveList, null))));
}
function PageParliament() {
  const live = useLiveState("signals");
  const dailyProgramLive = live.items ? live.items.filter((s) => s.source === "House daily program") : null;
  const divisionsLive = live.items ? live.items.filter((s) => s.source === "House divisions") : null;
  const newsLive = live.items ? live.items.filter((s) => s.source === "House news" || s.source === "House media releases") : null;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Daily program"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "The chamber program, divisions, hearings and House news from the official APH feeds."))), /* @__PURE__ */ React.createElement("div", { className: "grid g-overview" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "House \xB7 daily program")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(
    SittingDeskList,
    {
      rows: dailyProgramLive,
      emptyIcon: "clock",
      unavailableText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified daily program right now because the live signal feed is unavailable. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open the House daily program on aph.gov.au"), "."),
      emptyKicker: "No daily program items in the feed window",
      emptyBody: recessEmptyText("The House daily program feed lists no items in the current feed window.", "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents", "Open the House daily program on aph.gov.au")
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Recent divisions"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "House")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(DivisionsLiveList, null)))), /* @__PURE__ */ React.createElement(TodaysHearingsPanel, null), /* @__PURE__ */ React.createElement("div", { className: SITE_CONFIG.showUnsourcedSurfaces ? "grid g-2" : void 0, style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "House news & media")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(
    SittingDeskList,
    {
      rows: newsLive,
      emptyIcon: "signal",
      unavailableText: /* @__PURE__ */ React.createElement(React.Fragment, null, "Parliament Pulse holds no verified House news right now because the live signal feed is unavailable. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/house/rss/house_news", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open House news on aph.gov.au"), "."),
      emptyKicker: "No House news listed",
      emptyBody: /* @__PURE__ */ React.createElement(React.Fragment, null, "The House news and media release feeds list no items in the current live window. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/house/rss/house_news", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Open House news on aph.gov.au"), ".")
    }
  ))), SITE_CONFIG.showUnsourcedSurfaces && /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Parliamentary lines"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { marginLeft: "auto" } }, "Sample data")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px dashed var(--line-2)", borderRadius: 8, fontSize: "var(--t-body-sm)", color: "var(--ink-3)", lineHeight: 1.6, fontStyle: "italic" } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8, fontStyle: "normal" } }, "No lines drafted yet"), 'Lines will appear here once generated by an analyst. Use "Generate brief" from a signal to start the drafting workflow.')))));
}
function fmtSpanDate(iso) {
  return fmtIsoDate(iso, false);
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
      style: { display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 4, width: "100%", minHeight: 24, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13, style: { flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" } }),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-body-sm)", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" } }, t.itemCount, " items"),
    /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)", whiteSpace: "nowrap" } }, fmtSpanDate(t.firstSeenAt), " \u2192 ", fmtSpanDate(t.lastSeenAt)),
    /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".1em", marginLeft: 4 } }, "Thread"),
    /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)", fontSize: "var(--t-body-sm)", fontWeight: 500, flex: "1 1 18rem", minWidth: 0 } }, t.title)
  ), open && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, marginLeft: 25, display: "grid", gap: 8 } }, resolved.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.id || i, style: { display: "grid", gap: 4 } }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--link)", textDecoration: "none", fontSize: "var(--t-body-sm)", fontWeight: 500 }, title: "Opens the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })) : /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500, color: "var(--ink-2)" } }, s.source), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, s.tags && s.tags[0] && s.tags[0].l || "item"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)" } }, s.source), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, s.date)))), unresolved > 0 && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-4)" } }, unresolved, " further item", unresolved !== 1 ? "s" : "", " in the archive")));
}
function PagePatterns() {
  const { openModal, toast } = useStore();
  const threads = useLiveState("threads");
  const signalsLive = useLiveState("signals");
  const byGuid = React.useMemo(() => new Map((signalsLive.items || []).map((s) => [s.id, s])), [signalsLive.items]);
  const [clusterStatus, setClusterStatus] = useState("Needs analyst review");
  const qonItems = QON_PATTERN && Array.isArray(QON_PATTERN.items) ? QON_PATTERN.items : [];
  const qonMemberCount = new Set(qonItems.map((q) => q.memberId || q.who).filter(Boolean)).size;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Parliament \xB7 Scrutiny"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Threads"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Related live signals grouped into threads. Questions on notice will join these threads once a feed for them can be connected."))), !threads.items && /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Signal threads")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "pattern", kicker: "No threads held" }, "Parliament Pulse holds no signal threads right now, because the live archive returned none or could not be reached. Threads group live APH items; the items themselves are published through the ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Help/Rss_feeds", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "APH RSS feeds"), "."))), threads.items && /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Signal threads"), /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: threads.displayProvenance, title: "Parliament Pulse's own grouping of live signals (derived analysis)" }), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker", style: { marginLeft: "auto" } }, threads.items.length, " threads \xB7 fetched ", fmtFetchedAt(threads.fetchedAt), " AEST")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, threads.items.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "pattern", kicker: "No threads" }, "Thread detection groups related signals as they accumulate. Nothing has clustered yet.") : threads.items.map((t, i) => /* @__PURE__ */ React.createElement(ThreadRow, { key: t.id || i, t, byGuid, isLast: i === threads.items.length - 1 })))), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", background: "var(--panel-hi)", border: "1px solid var(--line-bright)", borderRadius: 8, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", color: "var(--ink-2)", fontSize: "var(--t-body-sm)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "flag", size: 14, stroke: "var(--info)" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "Questions on notice not connected"), ": Parliament Pulse's search of ParlInfo returns no questions on notice, so none are held. ", threads.items ? "The threads above are built from live signals. " : "", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/qon", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Search questions on notice on aph.gov.au"), ".")), SITE_CONFIG.showUnsourcedSurfaces && qonItems.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "pattern" }, /* @__PURE__ */ React.createElement("div", { className: "ribbon" }, "Clustered pattern \xB7 moderate confidence"), /* @__PURE__ */ React.createElement("div", { className: "serif", style: { fontSize: "var(--t-headline)", fontWeight: 500, marginBottom: 6, paddingRight: 200 } }, "Clustered scrutiny pattern", QON_PATTERN.topic ? ` on ${QON_PATTERN.topic}` : ""), QON_PATTERN.trigger && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: "var(--t-body-sm)", maxWidth: 720 } }, qonItems.length, " related question", qonItems.length !== 1 ? "s" : "", " lodged by ", qonMemberCount, " member", qonMemberCount !== 1 ? "s" : "", QON_PATTERN.window ? ` within ${QON_PATTERN.window}` : "", ". Trigger likely: ", QON_PATTERN.trigger, "."), /* @__PURE__ */ React.createElement("div", { className: "grid g-4", style: { marginTop: 16, marginBottom: 18 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Members"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-subhead)", marginTop: 4 } }, qonMemberCount)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Questions"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-subhead)", marginTop: 4 } }, qonItems.length)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Window"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-subhead)", marginTop: 4 } }, QON_PATTERN.window || NOT_SUPPLIED)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Target"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", marginTop: 4, lineHeight: 1.25 } }, QON_PATTERN.target || NOT_SUPPLIED))), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px dashed var(--line-2)", paddingTop: 14 } }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 } }, "Evidence"), qonItems.map((q, i) => {
    const mid = q.memberId;
    const canOpen = !!(mid && ENTITIES.members[mid]);
    return /* @__PURE__ */ React.createElement("div", { key: q.when + q.who, className: "g-qon-evidence", style: { display: "grid", gap: 12, padding: "8px 0", borderBottom: i < qonItems.length - 1 ? "1px solid var(--line)" : 0, alignItems: "start", fontSize: "var(--t-body-sm)" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-3)" } }, q.when), /* @__PURE__ */ React.createElement("div", null, canOpen ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "tag brass clk", onClick: () => openModal("member", mid) }, q.who) : /* @__PURE__ */ React.createElement("span", { className: "tag brass", style: { opacity: 0.65 } }, q.who)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, q.q), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right" } }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, q.chamber)));
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
  } }, "Mark as coincidence")), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-3)", marginTop: 8, letterSpacing: ".08em" } }, "Session status: ", clusterStatus)) : /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Clustered scrutiny pattern")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "pattern", kicker: "No questions on notice held" }, "Parliament Pulse holds no questions on notice to find a scrutiny pattern in, because its search of ParlInfo returns none. ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/qon", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "Search questions on notice on aph.gov.au"), ", or ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Senate_estimates", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)" } }, "open Senate Estimates"), "."))));
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
    return { type: v.type || "Executive brief", for: label, status: "Copied to clipboard", _sid: sid, _ts: v.ts };
  }).sort((a, b) => b._ts - a._ts);
  const briefId = (b) => b._sid;
  const selected = briefs.find((b) => briefId(b) === selId) || briefs[0];
  const selectedId = selected ? briefId(selected) : null;
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Workflow"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Briefings"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Briefs you generate from a signal appear here with their evidence links: What happened \xB7 Source \xB7 Why it matters \xB7 Evidence \xB7 Provenance.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn", disabled: briefs.length === 0, onClick: () => downloadBriefingQueue(briefs, toast) }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 13 }), " Export queue"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Open signals to generate a brief", onClick: () => {
    setSignalSearchQuery("");
    navigate("signals");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " Choose a signal"))), /* @__PURE__ */ React.createElement("div", { className: "grid g-briefings", style: { gap: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Queue"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, briefs.length, " generated")), /* @__PURE__ */ React.createElement("div", null, briefs.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "brief", kicker: "No briefs yet" }, "Open any signal and choose Generate brief. Your briefs appear here with their evidence links.") : briefs.map((b, i) => {
    const id = briefId(b);
    const status = reviewedIds[id] ? "Reviewed" : b.status;
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: id,
        className: "list-row",
        role: "button",
        tabIndex: 0,
        "aria-pressed": selectedId === id,
        onClick: () => setSelId(id),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelId(id);
          }
        },
        style: { cursor: "pointer", background: selectedId === id ? "var(--panel-hi)" : "transparent", borderLeft: selectedId === id ? "2px solid var(--brass)" : "2px solid transparent" }
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500 } }, b.type),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-caption)", color: "var(--ink-3)" } }, "For ", b.for),
      /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { marginTop: 4, color: status === "Reviewed" ? "var(--ok)" : status.startsWith("Copied") ? "var(--ink-3)" : "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".12em" } }, status)
    );
  }))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, selected ? selected.type : "No brief", " \xB7 preview"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, selected ? `For ${selected.for}` : "Queue empty"), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", disabled: !selected, onClick: () => window.print() }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 12 }), " Print"), /* @__PURE__ */ React.createElement("button", { className: "btn sm", disabled: !selected, title: "Copy a send-ready handoff note", onClick: () => copyText(`# Brief handoff
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
    return /* @__PURE__ */ React.createElement("div", { className: "brief" }, /* @__PURE__ */ React.createElement("div", { className: "meta" }, "PARLIAMENT PULSE \xB7 ", b.type.toUpperCase(), " \xB7 ", [brief.meta.date, brief.meta.time].filter(Boolean).join(" \xB7 ")), /* @__PURE__ */ React.createElement("h3", null, brief.isLive ? brief.link ? /* @__PURE__ */ React.createElement("a", { href: brief.link, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit" }, title: "Open the source at aph.gov.au" }, brief.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, style: { verticalAlign: "-1px", opacity: 0.6 } })) : brief.meta.source : brief.title), /* @__PURE__ */ React.createElement("h5", null, "What happened"), /* @__PURE__ */ React.createElement("div", null, brief.summary), /* @__PURE__ */ React.createElement("h5", null, "Source"), /* @__PURE__ */ React.createElement("div", null, brief.meta.source, " \xB7 ", brief.meta.sourceAuthority, " \xB7 ", brief.meta.date), /* @__PURE__ */ React.createElement("h5", null, "Why it matters"), /* @__PURE__ */ React.createElement("div", null, brief.whyItMatters), brief.recommendedAction && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h5", null, "Recommended action"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, brief.recommendedAction.label, "."), " ", brief.recommendedAction.reason)), brief.evidence.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h5", null, "Evidence"), /* @__PURE__ */ React.createElement("ul", null, brief.evidence.map((e, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("a", { href: e.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--brief-link)", textDecoration: "underline" } }, e.label))))), /* @__PURE__ */ React.createElement("h5", null, "Provenance"), /* @__PURE__ */ React.createElement("div", null, brief.provenance), /* @__PURE__ */ React.createElement("div", { className: "brief-attrib", "data-brief-attribution": "" }, APH_ATTRIBUTION));
  })()))));
}
function renderMatchedAlertEvent(e, i) {
  const title = e.title || e.signal_title || e.rule_name || e.name || "Alert match";
  const link = safeHttpUrl(e.link || e.signal_link || "");
  const when = e.matched_at || e.created_at || e.ts || null;
  return /* @__PURE__ */ React.createElement("div", { key: e.id || i, style: { padding: "8px 0", borderBottom: "1px solid var(--line)" } }, link ? /* @__PURE__ */ React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--link)", textDecoration: "none", fontWeight: 500, fontSize: "var(--t-body-sm)" }, title: "Opens the source at aph.gov.au" }, title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11 })) : /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500, fontSize: "var(--t-body-sm)" } }, title), when && /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-4)", marginTop: 2 } }, fmtFetchedAt(when), " AEST"));
}
function AlertRulesPanel() {
  const { toast } = useStore();
  const [rules, setRules] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState("");
  const [attentionMin, setAttentionMin] = useState("any");
  const [sourceGroup, setSourceGroup] = useState("");
  const [kind, setKind] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matched = useLiveState("alerts");
  const ALERTS_WRITABLE = false;
  const loadRules = React.useCallback(() => {
    fetch(`${WORKER_BASE_URL}/alerts`).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then((data) => {
      setRules(Array.isArray(data.rules) ? data.rules : []);
      setLoadFailed(false);
    }).catch(() => setLoadFailed(true));
  }, []);
  React.useEffect(() => {
    loadRules();
  }, [loadRules]);
  const createRule = () => {
    if (!ALERTS_WRITABLE) {
      toast("Rule creation is closed in this release.", "error");
      return;
    }
    const termList = terms.split(",").map((t) => t.trim()).filter(Boolean);
    if (!name.trim() || termList.length === 0) {
      toast("Name and at least one term are required", "error");
      return;
    }
    setSubmitting(true);
    const body = { name: name.trim(), terms: termList };
    if (attentionMin !== "any") body.attention_min = attentionMin;
    if (sourceGroup.trim()) body.source_group = sourceGroup.trim();
    if (kind.trim()) body.kind = kind.trim();
    fetch(`${WORKER_BASE_URL}/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json().catch(() => ({}));
    }).then(() => {
      toast(`Alert rule "${name.trim()}" created`, "brass");
      setName("");
      setTerms("");
      setAttentionMin("any");
      setSourceGroup("");
      setKind("");
      loadRules();
    }).catch(() => toast("Could not create the alert rule. Try again.", "error")).finally(() => setSubmitting(false));
  };
  const deleteRule = (id, ruleName) => {
    fetch(`${WORKER_BASE_URL}/alerts/${encodeURIComponent(id)}`, { method: "DELETE" }).then((res) => {
      if (!res.ok && res.status !== 204) throw new Error("HTTP " + res.status);
    }).then(() => {
      toast(`Alert rule "${ruleName}" removed`, "brass");
      loadRules();
    }).catch(() => toast("Could not remove the alert rule. Try again.", "error"));
  };
  return /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Alert rules"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, rules ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} configured` : "Loading\u2026"), rules && rules.length > 0 && /* @__PURE__ */ React.createElement(ProvenanceChip, { provenance: "live", title: "Rules are read from the Parliament Pulse service" })), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 14px", fontSize: "var(--t-body-sm)", color: "var(--ink-3)", lineHeight: 1.6 } }, "The alerts engine evaluates each configured rule against every feed poll, whether or not this tab is open. A rule matches on its keyword terms, and can optionally require a minimum attention level, a source group, or a signal kind.", !ALERTS_WRITABLE && " You cannot yet create or remove rules here: that needs a sign-in, which this release does not have."), ALERTS_WRITABLE && /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8, marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 200px" } }, /* @__PURE__ */ React.createElement("label", { htmlFor: "alert-name", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Name"), /* @__PURE__ */ React.createElement("input", { id: "alert-name", value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. AI governance", className: "search", style: { padding: "7px 10px", marginTop: 4, width: "100%" } })), /* @__PURE__ */ React.createElement("div", { style: { flex: "2 1 260px" } }, /* @__PURE__ */ React.createElement("label", { htmlFor: "alert-terms", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Terms (comma-separated)"), /* @__PURE__ */ React.createElement("input", { id: "alert-terms", value: terms, onChange: (e) => setTerms(e.target.value), placeholder: "e.g. artificial intelligence, algorithm", className: "search", style: { padding: "7px 10px", marginTop: 4, width: "100%" } }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "alert-attention", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Minimum attention"), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("select", { id: "alert-attention", className: "select", value: attentionMin, onChange: (e) => setAttentionMin(e.target.value), style: { marginTop: 4 } }, /* @__PURE__ */ React.createElement("option", { value: "any" }, "Any"), /* @__PURE__ */ React.createElement("option", { value: "low" }, "Low"), /* @__PURE__ */ React.createElement("option", { value: "med" }, "Medium"), /* @__PURE__ */ React.createElement("option", { value: "high" }, "High"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "alert-source-group", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Source group (optional)"), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("input", { id: "alert-source-group", value: sourceGroup, onChange: (e) => setSourceGroup(e.target.value), placeholder: "e.g. Senate", className: "search", style: { padding: "7px 10px", marginTop: 4 } })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "alert-kind", className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em" } }, "Kind (optional)"), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("input", { id: "alert-kind", value: kind, onChange: (e) => setKind(e.target.value), placeholder: "e.g. inquiry", className: "search", style: { padding: "7px 10px", marginTop: 4 } })), /* @__PURE__ */ React.createElement("button", { className: "btn primary", disabled: submitting, onClick: createRule }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " ", submitting ? "Creating\u2026" : "Create rule"))), rules === null ? loadFailed ? /* @__PURE__ */ React.createElement(
    EmptyState,
    {
      icon: "bell",
      kicker: "Alert rules unavailable",
      variant: "error",
      action: /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: loadRules }, "Retry")
    },
    "Parliament Pulse could not load alert rules just now."
  ) : /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-caption)", color: "var(--ink-4)" } }, "Loading alert rules\u2026") : rules.length === 0 ? /* @__PURE__ */ React.createElement(EmptyState, { icon: "bell", kicker: "No alert rules configured yet" }, "No alert rules are configured yet. Matches appear here within thirty minutes of creating one.") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8, marginBottom: 16 } }, rules.map((r) => /* @__PURE__ */ React.createElement("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500 } }, r.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-caption)", color: "var(--ink-3)", marginTop: 2 } }, (Array.isArray(r.terms) ? r.terms : String(r.terms || "").split(",").map((t) => t.trim()).filter(Boolean)).join(", "), r.attention_min && /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 min ", r.attention_min), r.source_group && /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 ", r.source_group), r.kind && /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 ", r.kind))), ALERTS_WRITABLE && /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", "aria-label": `Remove alert rule ${r.name}`, onClick: () => deleteRule(r.id, r.name) }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 13 }))))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 8, marginBottom: 8 } }, "Matched events"), !matched.items ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, rules && rules.length > 0 ? "No alert matches yet. The engine checks your rules on every feed poll." : "No alert rules are configured yet. Matches appear here within thirty minutes of creating one.") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 6 } }, matched.items.map(renderMatchedAlertEvent))));
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
  return /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("div", { className: "page-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Workflow"), /* @__PURE__ */ React.createElement("h1", { className: "page-title" }, "Watchlists"), /* @__PURE__ */ React.createElement("div", { className: "page-sub" }, "Keyword matching over the live signal stream, run in your browser. Select a watchlist to see its matches and keywords. Match history over time, alert rules and email digests are not yet available.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, /* @__PURE__ */ React.createElement(
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
    "Create a watchlist to match its keywords against the live signal stream in this browser."
  ) : /* @__PURE__ */ React.createElement("div", { className: "grid g-3" }, all.map((w) => {
    const matchCount = watchlistMatches(w, matchSource).length;
    const keywordCount = watchlistKeywords(w).length;
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: w.name,
        className: "wl" + ((selectedWl == null ? void 0 : selectedWl.name) === w.name ? " active" : ""),
        role: "button",
        tabIndex: 0,
        "aria-label": `${w.name}: ${matchCount} ${matchCount === 1 ? "match" : "matches"}, ${keywordCount} keywords. Open watchlist`,
        onClick: () => {
          setSelectedWl(w);
          openModal("watchlist", w.name);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedWl(w);
            openModal("watchlist", w.name);
          }
        },
        style: (selectedWl == null ? void 0 : selectedWl.name) === w.name ? { borderColor: "var(--brass)" } : {}
      },
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", { className: "wl-name" }, w.name), /* @__PURE__ */ React.createElement("span", { className: "mono", "data-wl-matches": matchCount, style: { fontSize: "var(--t-micro)", color: matchCount > 0 ? "var(--brass)" : "var(--ink-3)", background: "var(--panel-hi)", border: matchCount > 0 ? "1px solid var(--brass-soft)" : "1px solid var(--line-2)", padding: "1px 6px", borderRadius: 4, marginLeft: "auto" } }, matchCount, " ", matchCount === 1 ? "match" : "matches")),
      /* @__PURE__ */ React.createElement("div", { className: "wl-meta" }, /* @__PURE__ */ React.createElement("span", null, keywordCount, " keywords"))
    );
  })), SITE_CONFIG.showUnsourcedSurfaces && /* @__PURE__ */ React.createElement(AlertRulesPanel, null), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, "Tracked items"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, trackedItems.length, " saved")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, trackedItems.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No tracked items yet. Use Watchlist, Track, or Watch controls to add one.") : trackedItems.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.key, className: "g-tracked-row", style: { display: "grid", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", fontWeight: 500 } }, item.title), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", marginTop: 2 } }, item.meta)), /* @__PURE__ */ React.createElement("button", { className: "btn sm ghost", onClick: () => removeWatchlist(item.key) }, "Remove"))))), /* @__PURE__ */ React.createElement("div", { className: "panel", style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement("div", { className: "panel-head" }, /* @__PURE__ */ React.createElement("h2", { className: "panel-title" }, (selectedWl == null ? void 0 : selectedWl.name) || "Digital government", " \xB7 configuration"), /* @__PURE__ */ React.createElement("span", { className: "panel-kicker" }, "Selected watchlist"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { marginLeft: 8 }, title: "These keywords are your watchlist configuration" }, "Your keywords")), /* @__PURE__ */ React.createElement("div", { className: "panel-body" }, /* @__PURE__ */ React.createElement("div", { className: "mono t-label", style: { color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 6 } }, "Keywords"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, selectedKeywords.map((k) => /* @__PURE__ */ React.createElement("span", { key: k, className: "tag brass" }, k))), /* @__PURE__ */ React.createElement("div", { className: "empty", style: { marginTop: 14 } }, "Parliament Pulse does not yet hold linked committees, attention thresholds, or an audit log for watchlists. These settings need a server-side store before they can show real per-watchlist data."))));
}
Object.assign(window, { PageCommittees, PageBills, PageParliament, PagePatterns, PageBriefings, PageWatchlists });
