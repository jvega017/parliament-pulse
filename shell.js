const IS_MAC = /Mac|iPad/i.test(navigator.platform);
function fmtClock() {
  return (/* @__PURE__ */ new Date()).toLocaleTimeString("en-AU", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function TopClock() {
  const [clock, setClock] = React.useState(fmtClock);
  React.useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 1e3);
    return () => clearInterval(id);
  }, []);
  return /* @__PURE__ */ React.createElement("span", { className: "mono top-clock", title: "Local time", style: { fontSize: "var(--t-caption)", color: "var(--ink-3)", letterSpacing: ".06em", fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, "Local time "), clock);
}
function BetaNotice() {
  const key = "pp-beta-ack";
  const [visible, setVisible] = React.useState(() => safeGetLocalStorage(key) !== "1");
  if (!visible) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "design-banner", role: "status" }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 14, stroke: "var(--gold)" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "Live beta."), " Signals, feed health and bills use official APH feeds, with source links on aph.gov.au. Thread clustering is Parliament Pulse's own derived analysis. Empty sitting-day panels mean this app has no records to display; check the linked APH source for current proceedings. "), /* @__PURE__ */ React.createElement("button", { "aria-label": "Dismiss notice", onClick: () => {
    safeSetLocalStorage(key, "1");
    setVisible(false);
  } }, "\xD7"));
}
function EmptyState({ icon = "signal", kicker = "Empty", children, action, variant = "default" }) {
  return /* @__PURE__ */ React.createElement("div", { className: "empty-state" + (variant === "error" ? " error" : "") }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 15, stroke: variant === "error" ? "var(--caution)" : "var(--ink-4)" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "empty-kicker" }, kicker), /* @__PURE__ */ React.createElement("div", { className: "empty-body" }, children)), action && /* @__PURE__ */ React.createElement("div", { className: "empty-action" }, action));
}
function SkeletonRow() {
  return /* @__PURE__ */ React.createElement("div", { className: "g-live-event", style: { display: "grid", gap: 10, padding: "12px 8px", borderBottom: "1px solid var(--line)", alignItems: "start" } }, /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 12, width: 36 } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 14, width: 14, borderRadius: "50%" } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 13, width: "80%", marginBottom: 7 } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 10, width: "45%" } })));
}
function SkeletonCard() {
  return /* @__PURE__ */ React.createElement("div", { className: "signal", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 10, width: 86, marginBottom: 12 } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 18, width: "72%", marginBottom: 10 } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 13, width: "92%", marginBottom: 7 } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 13, width: "56%" } }));
}
function SkeletonTable({ rows = 5 }) {
  return /* @__PURE__ */ React.createElement("div", { className: "panel", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 14, width: 180, marginBottom: 16 } }), Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "30% 45% 15%", gap: 12, padding: "10px 0", borderBottom: i < rows - 1 ? "1px solid var(--line)" : 0, alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 12, width: "100%" } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 12, width: "100%" } }), /* @__PURE__ */ React.createElement("span", { className: "skeleton", style: { height: 12, width: "100%" } }))));
}
function fmtDataAge(fetchedAt) {
  if (fetchedAt == null) return NO_VALUE;
  const t = typeof fetchedAt === "number" ? fetchedAt : Date.parse(fetchedAt);
  if (!t || Number.isNaN(t)) return NO_VALUE;
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1e3));
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + "m";
  return Math.floor(mins / 60) + "h";
}
const NAV = [
  { id: "overview", label: "Overview", group: "Today" },
  { id: "live", label: "Live parliament", group: "Today", live: true },
  { id: "signals", label: "Signal inbox", group: "Today" },
  { id: "radar", label: "Activity by source", group: "Today" },
  { id: "committees", label: "Committees", group: "Workspace" },
  { id: "bills", label: "Bills intelligence", group: "Workspace" },
  { id: "parliament", label: "Daily program", group: "Workspace" },
  { id: "patterns", label: "Threads", group: "Workspace" },
  { id: "briefings", label: "Briefings", group: "Workspace" },
  { id: "watchlists", label: "Watchlists", group: "Workspace" },
  { id: "sources", label: "Sources", group: "Workspace" },
  { id: "about", label: "About the data", group: "Workspace" }
];
const LIVE_NAV_LABELS = { live: "Live", stale: "Stale", offline: "Offline" };
function liveNavState(liveState, fresh) {
  const ls = liveState || {};
  if (ls.status === "error" && !ls.blocks) return "offline";
  if (!ls.blocks) return null;
  if (fresh && fresh.known && fresh.stale) return "stale";
  return "live";
}
const ICONS = {
  overview: "overview",
  radar: "radar",
  committees: "committee",
  bills: "bill",
  parliament: "parliament",
  patterns: "pattern",
  briefings: "brief",
  watchlists: "watch",
  sources: "sources",
  live: "signal",
  signals: "signal",
  about: "book"
};
function Sidebar({ page, onNavigate, mobileOpen }) {
  const { state, liveState } = useStore();
  const counts = useCounts();
  const noLiveCache = !!(liveState && liveState.status === "error" && !liveState.blocks);
  const liveNav = liveNavState(liveState, useFreshness());
  const navCount = React.useMemo(() => {
    const signalItems = liveState && liveState.blocks && liveState.blocks.signals && liveState.blocks.signals.items || null;
    const active = signalItems ? signalItems.filter((s) => !state.archived[s.id]) : null;
    return {
      overview: null,
      /* a dashboard has no unambiguous count; the hero KPI carries the priority number */
      live: null,
      signals: active ? active.length : null,
      // The desk tallies live signals by source group, so its badge is the group count.
      radar: active ? new Set(active.map((s) => s.sourceGroup || "Other")).size : null,
      committees: counts.committees,
      bills: counts.bills,
      parliament: counts.divisions,
      patterns: counts.threads,
      // The user's own briefs and watchlist configuration are real local counts.
      briefings: BRIEFING_QUEUE.length + Object.keys(state.briefsGenerated || {}).length,
      watchlists: WATCHLISTS.length + (state.watchlistCreated || []).length,
      sources: null,
      /* the Sources page states feed health plainly */
      about: null
      /* reference material, not a live count */
    };
  }, [counts, liveState, state.archived, state.briefsGenerated, state.watchlistCreated]);
  const groups = [...new Set(NAV.map((n) => n.group))];
  return /* @__PURE__ */ React.createElement("aside", { className: "side" + (mobileOpen ? " mobile-open" : "") }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("div", { className: "brand-mark" }, /* @__PURE__ */ React.createElement("svg", { width: "26", height: "26", viewBox: "0 0 22 22", fill: "none" }, /* @__PURE__ */ React.createElement("path", { d: "M11 2 C 7 5, 6 9, 8 12 C 5 11, 4 13, 5 15 C 6 17, 9 18, 11 18 C 13 18, 16 17, 17 15 C 18 13, 17 11, 14 12 C 16 9, 15 5, 11 2 Z", fill: "url(#flame)", opacity: "0.95" }), /* @__PURE__ */ React.createElement("path", { d: "M11 6 C 9 8, 9 11, 11 13 C 13 11, 13 8, 11 6 Z", fill: "#fff", opacity: "0.88" }), /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "flame", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "var(--brass-2)" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "var(--brass)" }))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7 } }, /* @__PURE__ */ React.createElement("div", { className: "brand-name" }, "Parliament Pulse"), /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { verticalAlign: "middle" } }, "Beta")), /* @__PURE__ */ React.createElement("div", { className: "brand-sub" }, "Prometheus Policy Lab"))), /* @__PURE__ */ React.createElement("nav", { id: "main-navigation", className: "nav", "aria-label": "Main navigation" }, groups.map((g) => /* @__PURE__ */ React.createElement("div", { key: g }, /* @__PURE__ */ React.createElement("div", { className: "nav-group" }, g), NAV.filter((n) => n.group === g).map((n) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: n.id,
      className: "nav-item" + (page === n.id ? " active" : ""),
      onClick: () => onNavigate(n.id),
      role: "button",
      tabIndex: 0,
      "aria-current": page === n.id ? "page" : void 0,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(n.id);
        }
      }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: ICONS[n.id], size: 15, className: "ico" }),
    /* @__PURE__ */ React.createElement("span", null, n.label),
    n.live && liveNav && /* @__PURE__ */ React.createElement("span", { className: "count nav-live", "data-live-state": liveNav, title: liveNav === "live" ? "APH feeds polled recently" : liveNav === "stale" ? "The APH feed poll has stalled; items may be out of date" : "Live data is unavailable" }, LIVE_NAV_LABELS[liveNav]),
    !n.live && typeof navCount[n.id] === "number" && navCount[n.id] > 0 && /* @__PURE__ */ React.createElement("span", { className: "count", "data-nav-count": n.id }, navCount[n.id])
  ))))), /* @__PURE__ */ React.createElement("div", { className: "side-status", role: "group", "aria-label": "System status" }, noLiveCache ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "side-status-head" }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--caution)", boxShadow: "none" } }), /* @__PURE__ */ React.createElement("span", null, "Live data unavailable")), /* @__PURE__ */ React.createElement("div", null, "The official APH feeds did not respond at the last check, so each desk says what is missing instead of showing invented data. See Sources for feed health.")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "side-status-head" }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--ok)", boxShadow: "none" } }), /* @__PURE__ */ React.createElement("span", null, "Official feeds connected")), /* @__PURE__ */ React.createElement("div", null, "Parliament Pulse reads the official APH feeds. Each feed's health is on Sources."))), /* @__PURE__ */ React.createElement("div", { className: "side-foot" }, /* @__PURE__ */ React.createElement("div", { style: { lineHeight: 1.2 } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: "var(--t-micro)", color: "var(--ink-4)" } }, "Prometheus Policy Lab \xB7 free beta"))));
}
const SHORTCUTS_KEY = "pp-shortcuts";
function singleKeyShortcutsOn() {
  return safeGetLocalStorage(SHORTCUTS_KEY) !== "off";
}
function shortcutBlocked(e) {
  if (!singleKeyShortcutsOn()) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const el = document.activeElement;
  const tag = el && el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!(el && el.isContentEditable);
}
function ShortcutHelp() {
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState(singleKeyShortcutsOn);
  const shortcuts = [
    ["j / k", "Next or previous signal"],
    ["Enter / Space", "Activate the focused button or nav item"],
    ["Esc", "Close drawer or modal"],
    ["b", "Copy brief to clipboard (while a signal is open)"],
    ["w", "Add signal to watchlist (while a signal is open)"],
    ["a", "Archive signal and advance; Undo is in the notice (while a signal is open)"],
    [IS_MAC ? "\u2318K" : "Ctrl+K", "Focus global search"]
  ];
  const onToggle = (e) => {
    const on = e.target.checked;
    setEnabled(on);
    safeSetLocalStorage(SHORTCUTS_KEY, on ? "on" : "off");
  };
  return /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: "Keyboard shortcuts", onClick: () => setOpen((o) => !o), "aria-label": "Keyboard shortcuts and settings", "aria-expanded": open }, /* @__PURE__ */ React.createElement(Icon, { name: "pattern", size: 13 })), open && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--panel-2)", border: "1px solid var(--line-bright)", borderRadius: "var(--r-md)", boxShadow: "var(--elev-2)", zIndex: 40, width: 320, maxWidth: "calc(100vw - 32px)", padding: "12px 14px" }, role: "dialog", "aria-label": "Keyboard shortcuts", "data-shortcut-settings": "" }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-label)", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: 10 } }, "Keyboard shortcuts"), /* @__PURE__ */ React.createElement("label", { htmlFor: "pp-shortcut-toggle", style: { display: "flex", alignItems: "center", gap: 10, padding: "4px 0 10px", fontSize: "var(--t-body-sm)", color: "var(--ink)", cursor: "pointer", minHeight: 24 } }, /* @__PURE__ */ React.createElement("input", { id: "pp-shortcut-toggle", type: "checkbox", checked: enabled, onChange: onToggle, "data-shortcut-toggle": "", style: { width: 20, height: 20, margin: 0, accentColor: "var(--brass)" } }), "Single-key shortcuts (j, k, b, w, a)"), shortcuts.map(([k, d]) => /* @__PURE__ */ React.createElement("div", { key: k, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: "var(--t-body-sm)", opacity: !enabled && k.length <= 5 && /^[a-z]( \/ [a-z])?$/.test(k) ? 0.55 : 1 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)" } }, d), /* @__PURE__ */ React.createElement("kbd", { style: { fontFamily: "var(--mono)", fontSize: "var(--t-eyebrow)", background: "var(--panel-hi)", border: "1px solid var(--line-2)", borderRadius: 4, padding: "2px 7px", color: "var(--brass)", marginLeft: 10, whiteSpace: "nowrap" } }, k))), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { marginTop: 10 }, onClick: () => setOpen(false) }, "Close")));
}
function Topbar({ mobileNavOpen, setMobileNavOpen }) {
  const { openModal, openSignal, toast, modal, signalId, setSignalSearchQuery, requestLiveRefresh, consumeLiveRefresh, navigate, liveState, refreshLiveState } = useStore();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => safeGetLocalStorage("pp-theme") !== "light");
  const [focused, setFocused] = React.useState(false);
  const [, setAgeTick] = React.useState(0);
  const ref = React.useRef(null);
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    const id = setInterval(() => setAgeTick((t) => t + 1), 3e4);
    return () => clearInterval(id);
  }, []);
  const live = liveState || {};
  const dataAge = fmtDataAge(live.fetchedAt);
  const isRefreshing = !!live.isRefreshing;
  const noLiveCache = live.status === "error" && !live.blocks;
  const fresh = useFreshness();
  const pollStalled = !noLiveCache && fresh.stale;
  const feedCount = useFeedCount();
  const handleLiveRefresh = React.useCallback(() => {
    const ageAtClick = fmtDataAge((liveState || {}).fetchedAt);
    if (typeof refreshLiveState === "function") {
      Promise.resolve(refreshLiveState()).catch(() => {
        const msg = ageAtClick === NO_VALUE ? "Live refresh failed - live data is unavailable" : `Live refresh failed - showing data from ${ageAtClick} ago`;
        toast(msg, "error");
      });
      return;
    }
    requestLiveRefresh();
    navigate("live");
    if (window.__refreshLiveFeeds) {
      consumeLiveRefresh();
      window.__refreshLiveFeeds();
      toast("Refreshing live feeds...");
    } else toast("Opening Live page to refresh feeds", "brass");
  }, [liveState, refreshLiveState, requestLiveRefresh, consumeLiveRefresh, navigate, toast]);
  React.useEffect(() => {
    const h = (e) => {
      var _a, _b, _c, _d;
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        (_a = ref.current) == null ? void 0 : _a.focus();
      }
      if (e.key === "Escape") {
        if (modal || signalId) return;
        const inResults = !!(searchRef.current && searchRef.current.contains(document.activeElement) && document.activeElement !== ref.current);
        if (open) {
          e.preventDefault();
          setOpen(false);
          if (inResults) (_b = ref.current) == null ? void 0 : _b.focus();
          else (_c = ref.current) == null ? void 0 : _c.blur();
          return;
        }
        (_d = ref.current) == null ? void 0 : _d.blur();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [modal, signalId, open]);
  React.useEffect(() => {
    const h = (e) => {
      if (!searchRef.current || searchRef.current.contains(e.target)) return;
      setOpen(false);
      setFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const liveSignals = useLiveState("signals");
  const liveStale = liveSignals.liveStale && !noLiveCache;
  const liveBills = useLiveBills();
  const results = React.useMemo(() => buildSearchResults(q, {
    signals: liveSignals.items || SIGNALS,
    liveSignals: !!liveSignals.items,
    bills: liveBills.items,
    committees: Object.values(ENTITIES.committees),
    feeds: APH_FEEDS
  }), [q, liveSignals.items, liveBills.items]);
  const selectItem = (act) => {
    act();
    setOpen(false);
    setQ("");
  };
  const resultsRef = React.useRef(null);
  const focusResult = (dir) => {
    var _a;
    const list = resultsRef.current ? [...resultsRef.current.querySelectorAll("[data-sr-focus]")] : [];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    if (dir > 0) list[Math.min(i + 1, list.length - 1)].focus();
    else if (i <= 0) (_a = ref.current) == null ? void 0 : _a.focus();
    else list[i - 1].focus();
  };
  const onKeyDown = (e) => {
    var _a;
    if (!open || !results) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusResult(1);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      (_a = ref.current) == null ? void 0 : _a.blur();
      return;
    }
  };
  const onResultsKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusResult(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusResult(-1);
    }
  };
  const onSearchBlur = (e) => {
    const next = e.relatedTarget;
    if (next && searchRef.current && searchRef.current.contains(next)) return;
    if (next) setOpen(false);
  };
  const row = ({ key, k, title, link, openLabel, act, extra }) => /* @__PURE__ */ React.createElement("li", { key, className: "sr-item", ...extra || {} }, link ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "k" }, k), /* @__PURE__ */ React.createElement("a", { className: "sr-title", href: link, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit", textDecoration: "none" }, title: "Open the source at aph.gov.au" }, title), /* @__PURE__ */ React.createElement("button", { type: "button", className: "sr-open sr-open-short", "data-sr-focus": "", "aria-label": openLabel, onClick: () => selectItem(act) }, "Open")) : /* @__PURE__ */ React.createElement("button", { type: "button", className: "sr-open", "data-sr-focus": "", onClick: () => selectItem(act) }, /* @__PURE__ */ React.createElement("span", { className: "k" }, k), /* @__PURE__ */ React.createElement("span", { className: "sr-title" }, title)));
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "topbar" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn ghost sm nav-toggle",
      "aria-label": mobileNavOpen ? "Close navigation" : "Open navigation",
      "aria-expanded": mobileNavOpen,
      "aria-controls": "main-navigation",
      onClick: () => setMobileNavOpen((open2) => !open2)
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "menu", size: 15 })
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: searchRef,
      className: "search" + (focused ? " focused" : ""),
      onBlur: onSearchBlur,
      style: focused ? { borderColor: "var(--brass)", boxShadow: "0 0 0 3px var(--brass-soft)" } : void 0
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 14, stroke: focused ? "var(--brass)" : "var(--ink-3)" }),
    /* @__PURE__ */ React.createElement(
      "input",
      {
        ref,
        value: q,
        onClick: () => setOpen(true),
        onChange: (e) => {
          setQ(e.target.value);
          setOpen(true);
        },
        onFocus: () => {
          setOpen(true);
          setFocused(true);
        },
        onBlur: () => setFocused(false),
        onKeyDown,
        "aria-label": "Search parliament signals, bills, committees and feeds",
        "aria-controls": open && results ? "search-listbox" : void 0,
        placeholder: "Search signals, bills, committees, feeds\u2026"
      }
    ),
    q ? /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          var _a;
          setQ("");
          setOpen(false);
          (_a = ref.current) == null ? void 0 : _a.focus();
        },
        "aria-label": "Clear search",
        title: "Clear search",
        style: { background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 24, minHeight: 24, color: "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }
      },
      /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 12 })
    ) : /* @__PURE__ */ React.createElement("span", { className: "kbd" }, IS_MAC ? "\u2318K" : "Ctrl+K"),
    open && results && /* @__PURE__ */ React.createElement("div", { id: "search-listbox", ref: resultsRef, className: "search-results", role: "region", "aria-label": "Search results", onKeyDown: onResultsKeyDown }, results.sig.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group", "data-sr-group": "signals" }, results.labels.sig, " \xB7 ", results.sig.length, " match", results.sig.length !== 1 ? "es" : ""), /* @__PURE__ */ React.createElement("ul", { className: "sr-list" }, results.sig.slice(0, 4).map((s) => row({
      key: s.id,
      k: s.isLive ? s.source : s.id,
      title: s.isLive && !s.link ? s.source : s.title,
      link: s.isLive && s.link ? s.link : null,
      openLabel: `Open ${s.title} in Parliament Pulse`,
      act: () => openSignal(s.id)
    })), results.sig.length > 4 && row({ key: "signals-all", k: "All", title: `See all ${results.sig.length} signals`, act: () => {
      setSignalSearchQuery(q);
      navigate("signals");
    } }))), results.bills.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group", "data-sr-group": "bills" }, results.labels.bills, " \xB7 ", results.bills.length, " match", results.bills.length !== 1 ? "es" : ""), /* @__PURE__ */ React.createElement("ul", { className: "sr-list" }, results.bills.slice(0, 4).map((b) => {
      const link = safeHttpUrl(b.link);
      return row({
        key: b.guid,
        k: "Bill",
        title: link ? b.title : "Bills Digest item",
        link,
        openLabel: `Open ${b.title} in Bills intelligence`,
        act: () => navigate("bills"),
        extra: { "data-sr-bill": "" }
      });
    }))), results.comm.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group", "data-sr-group": "committees" }, results.labels.comm, " \xB7 ", results.comm.length, " match", results.comm.length !== 1 ? "es" : ""), /* @__PURE__ */ React.createElement("ul", { className: "sr-list" }, results.comm.map((c) => row({ key: c.id, k: c.chamber, title: c.name, act: () => openModal("committee", c.id) })))), results.feeds.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group", "data-sr-group": "sources" }, results.labels.feeds, " \xB7 ", results.feeds.length, " match", results.feeds.length !== 1 ? "es" : ""), /* @__PURE__ */ React.createElement("ul", { className: "sr-list" }, results.feeds.slice(0, 4).map((f) => row({ key: f.id, k: f.group, title: f.name, act: () => openModal("feed", f.id) })))), q && !results.sig.length && !results.bills.length && !results.comm.length && !results.feeds.length && /* @__PURE__ */ React.createElement("div", { className: "sr-item", role: "status", style: { color: "var(--ink-4)" } }, 'No matches for "', q, '"'))
  ), /* @__PURE__ */ React.createElement("div", { className: "top-right" }, /* @__PURE__ */ React.createElement(TopClock, null), noLiveCache ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "chip warn", onClick: () => navigate("live"), title: "Live APH feeds did not respond. Each desk shows an honest empty state rather than invented data; open Live for feed health.", style: { borderColor: "color-mix(in srgb, var(--caution) 55%, transparent)", color: "var(--caution)", background: "transparent", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--caution)", boxShadow: "none" } }), " LIVE DATA UNAVAILABLE") : pollStalled ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "chip warn", "data-live-chip": "stale", onClick: () => navigate("sources"), title: fresh.stallText, style: { borderColor: "color-mix(in srgb, var(--caution) 55%, transparent)", color: "var(--caution)", background: "transparent", cursor: "pointer" } }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--caution)", boxShadow: "none" } }), " Stale \xB7 polling stalled") : /* @__PURE__ */ React.createElement("button", { type: "button", className: "chip clk", "data-live-chip": "live", onClick: () => navigate("live"), title: feedCount != null ? `${feedCount} official APH feeds polled by the Parliament Pulse service` : "Official APH feeds; the Live page reads them directly", style: { borderColor: "color-mix(in srgb, var(--gold) 55%, transparent)", color: "var(--gold)", background: "transparent" } }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--gold)", boxShadow: "none" } }), " Live beta", feedCount != null ? /* @__PURE__ */ React.createElement("span", { className: "tb-feeds" }, ` \xB7 ${feedCount} feeds`) : ""), fresh.known && !noLiveCache && /* @__PURE__ */ React.createElement("span", { className: "mono top-poll", "data-poll-line": "", title: fresh.stallText || "When Parliament Pulse last checked the APH feeds", style: { fontSize: "var(--t-micro)", color: pollStalled ? "var(--caution)" : "var(--ink-3)", letterSpacing: ".04em", whiteSpace: "nowrap" } }, fresh.pollLine), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", "aria-label": "Refresh live data", "aria-busy": isRefreshing, title: live.fetchedAt ? `Live data fetched ${dataAge} ago. Refresh now.` : "Refresh live data", onClick: handleLiveRefresh }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 14, style: isRefreshing ? { animation: "spin 800ms linear infinite" } : void 0 }), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", letterSpacing: ".04em", marginLeft: 6, fontVariantNumeric: "tabular-nums" } }, dataAge)), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm tb-alerts", title: "Show current priority count", "aria-label": "Alerts", onClick: () => {
    const source = liveSignals.items || SIGNALS;
    const count = source.filter((s) => s.attention === "high").length;
    toast(source.length === 0 ? "Live data is unavailable, so there are no signals to review" : `${count} priority signals currently need review`, "brass");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "bell", size: 14 })), /* @__PURE__ */ React.createElement("button", { className: "btn primary sm tb-new-brief", "aria-label": "New brief", onClick: () => navigate("briefings") }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), /* @__PURE__ */ React.createElement("span", { className: "tb-label" }, " New brief")), /* @__PURE__ */ React.createElement(ShortcutHelp, null), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm tb-theme", title: isDark ? "Switch to light mode" : "Switch to dark mode", "aria-label": isDark ? "Switch to light mode" : "Switch to dark mode", onClick: () => {
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    safeSetLocalStorage("pp-theme", next);
    setIsDark(!isDark);
  } }, /* @__PURE__ */ React.createElement(Icon, { name: isDark ? "sun" : "moon", size: 13 })))), (liveStale || pollStalled) && /* @__PURE__ */ React.createElement("div", { className: "stale-banner", role: "status", "data-stale-reason": pollStalled ? "poll" : "cache", style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 16px",
    fontSize: "var(--t-body-sm)",
    color: "var(--ink-2)",
    background: "var(--panel-2)",
    borderBottom: "1px solid var(--line)",
    boxShadow: "inset 3px 0 0 var(--caution)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13, stroke: "var(--caution)" }), /* @__PURE__ */ React.createElement("span", null, pollStalled ? fresh.stallText + ". Items shown may be out of date; check the linked APH source." : "Live data is over 30 minutes old. Refresh, or see the Live page."), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn ghost sm",
      "aria-label": "Refresh live data",
      "aria-busy": isRefreshing,
      title: live.fetchedAt ? `Live data fetched ${dataAge} ago. Refresh now.` : "Refresh live data",
      onClick: handleLiveRefresh
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13, style: isRefreshing ? { animation: "spin 800ms linear infinite" } : void 0 }),
    " Refresh"
  ), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => navigate("live") }, "Live page"))));
}
function ProvenanceChip({ provenance, title }) {
  const LABELS = { live: "Live", derived: "Derived", fixture: "No live data" };
  const key = LABELS[provenance] ? provenance : "fixture";
  const cls = "chip-fixture" + (key === "live" ? " chip-live" : key === "derived" ? " chip-derived" : "");
  return /* @__PURE__ */ React.createElement("span", { className: cls, title }, LABELS[key]);
}
function Att({ level, disclosure }) {
  const map = { high: "High", med: "Medium", low: "Low" };
  const tip = disclosure || attentionDisclosure();
  if (!map[level]) return /* @__PURE__ */ React.createElement("span", { className: "att", title: `Attention not scored. ${tip}` }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, NO_VALUE), /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, "Attention not scored"));
  return /* @__PURE__ */ React.createElement("span", { className: "att " + level, title: tip, "data-att-disclosure": "" }, map[level]);
}
function Conf({ n }) {
  return /* @__PURE__ */ React.createElement("span", { className: "conf-text mono", "data-conf": "", style: { fontSize: "var(--t-caption)", color: "var(--ink-3)", whiteSpace: "nowrap" } }, confidenceLabel(n));
}
function buildBriefSections(s, isLive = false) {
  const evidence = (s.evidence || []).map((e) => ({ label: e.label, url: e.url }));
  const provParts = [
    `Signal ID: ${s.id}`,
    isLive ? confidenceLabel(s.confidence) : `Representative ${confidenceLabel(s.confidence).toLowerCase()}`
  ];
  if (s.humanReview) provParts.push(`Review status: ${s.humanReview}`);
  if (!isLive) provParts.push("Example workflow trace; not a production processing log.");
  return {
    title: s.title,
    // link and isLive travel with the brief model so every downstream render and
    // export applies the licence rule: a live APH title is emitted only as a link.
    link: s.link || null,
    isLive,
    meta: {
      id: s.id,
      date: s.date,
      time: s.time,
      source: s.source,
      sourceAuthority: s.sourceAuthority,
      attention: s.attention,
      confidence: s.confidence,
      humanReview: s.humanReview
    },
    summary: s.summary,
    whyItMatters: s.attentionReason,
    // UX-03: no recommended action exists for a live item (action is ""), so the
    // brief carries none rather than an empty heading.
    recommendedAction: s.action ? { label: s.action, reason: s.actionReason || "" } : null,
    evidence,
    provenance: provParts.join(" | ")
  };
}
function SignalCard({ s, hideAtt = false, hideConf = false }) {
  const { openSignal, state, isWatched } = useStore();
  const archived = !!state.archived[s.id];
  const feedback = state.feedback[s.id];
  const watched = isWatched(s.id);
  return /* @__PURE__ */ React.createElement(SignalCardView, { s, archived, feedback, watched, openSignal, hideAtt, hideConf });
}
const SignalCardView = React.memo(function SignalCardView2({ s, archived, feedback, watched, openSignal, hideAtt, hideConf }) {
  const titleId = "sig-t-" + React.useId().replace(/:/g, "");
  if (archived) return null;
  const name = s.title || s.source || "signal";
  return /* @__PURE__ */ React.createElement("article", { className: "signal", "data-att": s.attention, "aria-labelledby": titleId, "data-signal-id": s.id }, /* @__PURE__ */ React.createElement("div", { className: "sig-head" }, /* @__PURE__ */ React.createElement("span", { className: "sig-id mono" }, s.isLive || /^https?:/.test(s.id) ? "APH" : s.id), /* @__PURE__ */ React.createElement("span", { className: "sig-source mono" }, "\xB7 ", s.source), !hideAtt && /* @__PURE__ */ React.createElement(Att, { level: s.attention }), watched && /* @__PURE__ */ React.createElement("span", { className: "tag brass" }, "Watching"), /* @__PURE__ */ React.createElement("span", { className: "sig-time mono", "data-sig-when": "" }, signalWhen(s))), /* @__PURE__ */ React.createElement("h3", { className: "sig-title serif", id: titleId }, s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit", textDecoration: "none" }, title: "Open the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, style: { verticalAlign: "-1px", opacity: 0.6 } })) : s.isLive ? s.source : s.title), /* @__PURE__ */ React.createElement("div", { className: "sig-sum" }, s.summary.length > 120 ? s.summary.slice(0, 120).replace(/\s\S+$/, "") + "\u2026" : s.summary), /* @__PURE__ */ React.createElement("div", { className: "sig-tags" }, s.tags.map((t, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "tag " + (t.c || "") }, t.l))), /* @__PURE__ */ React.createElement("div", { className: "sig-action" }, s.action ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "sig-action-label" }, "Recommended"), /* @__PURE__ */ React.createElement("span", { className: "sig-action-value" }, s.action)) : /* @__PURE__ */ React.createElement("span", { className: "sig-action-label" }, "Open to triage"), !hideConf && /* @__PURE__ */ React.createElement("span", { className: "mono", "data-conf": "", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", letterSpacing: ".04em", whiteSpace: "nowrap" } }, confidenceLabel(s.confidence)), /* @__PURE__ */ React.createElement("button", { type: "button", className: "sig-open", "aria-label": "Open " + name, onClick: () => openSignal(s.id) }, "Open")), feedback && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: "var(--t-caption)", color: "var(--brass)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 12, style: { verticalAlign: "-2px", marginRight: 4 } }), " Feedback: ", feedback.label), watched && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: "var(--t-caption)", color: "var(--brass)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 12, style: { verticalAlign: "-2px", marginRight: 4 } }), " On watchlist"));
});
function generateBriefMarkdown(s, isLive = false) {
  const brief = buildBriefSections(s, isLive);
  const evidence = brief.evidence.map((e) => `- [${e.label}](${e.url})`).join("\n");
  const titleMd = brief.isLive ? brief.link ? `[${brief.title}](${brief.link})` : brief.meta.source : brief.title;
  return [
    `> Beta draft, generated from the current Parliament Pulse signal record. Verify source links before distribution.`,
    ``,
    `# Executive brief: ${titleMd}`,
    `Date: ${brief.meta.date} | Source: ${brief.meta.source} | Priority: ${(brief.meta.attention || NOT_SUPPLIED).toUpperCase()}`,
    ``,
    `## Summary`,
    brief.summary,
    ``,
    `## Why it matters`,
    brief.whyItMatters,
    ``,
    ...brief.recommendedAction ? [
      `## Recommended action`,
      `**${brief.recommendedAction.label}**`,
      brief.recommendedAction.reason,
      ``
    ] : [],
    `## Evidence`,
    evidence || "_No evidence links recorded._",
    ``,
    `## Provenance`,
    brief.provenance,
    `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    ``,
    `---`,
    APH_ATTRIBUTION
  ].join("\n");
}
function Drawer() {
  var _a;
  const { signalId, openSignal, closeSignal, state, modal, openModal, saveFeedback, archive, addWatchlist, isWatched, saveNote, generateBrief, toast, visibleSignalOrder, navigate } = useStore();
  const liveSignals = useLiveState("signals");
  const fixtureSignal = React.useMemo(() => SIGNALS.find((s2) => s2.id === signalId), [signalId]);
  const liveSignal = React.useMemo(() => (liveSignals.items || []).find((s2) => s2.id === signalId), [signalId, liveSignals.items]);
  const signal = fixtureSignal || liveSignal;
  const [fb, setFb] = React.useState(null);
  const [note, setNote] = React.useState("");
  const [noteSaved, setNoteSaved] = React.useState(false);
  const noteRef = React.useRef("");
  const noteSigRef = React.useRef(null);
  const noteSavedTimerRef = React.useRef(null);
  React.useEffect(() => {
    noteRef.current = note;
  }, [note]);
  React.useEffect(() => {
    noteSigRef.current = signalId;
  }, [signalId]);
  const flushNote = React.useCallback(() => {
    const sid = noteSigRef.current;
    if (sid && noteRef.current !== (state.notes[sid] || "")) {
      saveNote(sid, noteRef.current);
      setNoteSaved(true);
      clearTimeout(noteSavedTimerRef.current);
      noteSavedTimerRef.current = setTimeout(() => setNoteSaved(false), 1600);
    }
  }, [saveNote, state.notes]);
  const closeWithFlush = React.useCallback(() => {
    flushNote();
    closeSignal();
  }, [flushNote, closeSignal]);
  const sigIdxRef = React.useRef(0);
  const drawerBodyRef = React.useRef(null);
  const prevFocusRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);
  const visibleSigs = React.useMemo(() => {
    const known = (liveSignals == null ? void 0 : liveSignals.items) ? [...SIGNALS, ...liveSignals.items] : SIGNALS;
    const fallback = known.filter((x) => !state.archived[x.id]);
    if (!Array.isArray(visibleSignalOrder) || visibleSignalOrder.length === 0) return fallback;
    const byId = new Map(known.map((x) => [x.id, x]));
    const ordered = visibleSignalOrder.map((id) => byId.get(id)).filter((x) => x && !state.archived[x.id]);
    return ordered.length ? ordered : fallback;
  }, [visibleSignalOrder, state.archived, liveSignals]);
  React.useEffect(() => {
    const idx = visibleSigs.findIndex((s2) => s2.id === signalId);
    if (idx !== -1) sigIdxRef.current = idx;
    if (drawerBodyRef.current) drawerBodyRef.current.scrollTop = 0;
  }, [signalId, visibleSigs]);
  React.useEffect(() => {
    if (signalId) {
      const active = document.activeElement;
      if (!prevFocusRef.current && !(active && active.closest && active.closest("aside.drawer"))) prevFocusRef.current = active;
      requestAnimationFrame(() => {
        var _a2;
        return (_a2 = closeButtonRef.current) == null ? void 0 : _a2.focus();
      });
    } else if (prevFocusRef.current) {
      const back = prevFocusRef.current;
      prevFocusRef.current = null;
      if (back.isConnected) back.focus();
    }
  }, [signalId]);
  React.useEffect(() => {
    if (!signalId) return;
    const trap = (e) => {
      var _a2;
      if (e.key !== "Tab") return;
      const drawerEl = (_a2 = closeButtonRef.current) == null ? void 0 : _a2.closest("aside.drawer");
      if (!drawerEl) return;
      const focusable = Array.from(drawerEl.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter((el) => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [signalId]);
  React.useEffect(() => {
    var _a2;
    setFb(((_a2 = state.feedback[signalId]) == null ? void 0 : _a2.label) || null);
  }, [signalId, state.feedback]);
  React.useEffect(() => {
    setNote(state.notes[signalId] || "");
    setNoteSaved(false);
  }, [signalId]);
  React.useEffect(() => {
    const handler = (e) => {
      if (modal) return;
      if (e.key === "Escape" && signalId) {
        e.preventDefault();
        flushNote();
        closeSignal();
        return;
      }
      if (shortcutBlocked(e)) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const cur = visibleSigs.findIndex((s2) => s2.id === signalId);
        const next = e.key === "j" ? Math.min(cur + 1, visibleSigs.length - 1) : Math.max(cur - 1, 0);
        if (visibleSigs[next] && visibleSigs[next].id !== signalId) {
          if (typeof window.ppBumpRenderCap === "function") window.ppBumpRenderCap(next);
          flushNote();
          openSignal(visibleSigs[next].id);
        }
      }
      if (e.key === "b" && signalId) {
        e.preventDefault();
        const s2 = SIGNALS.find((x) => x.id === signalId) || ((liveSignals == null ? void 0 : liveSignals.items) || []).find((x) => x.id === signalId);
        if (s2) {
          copyToClipboard(generateBriefMarkdown(s2, isLive)).then(() => {
            generateBrief(s2.id, "Executive brief");
            toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") });
          }).catch(() => toast("Clipboard unavailable, so the brief was not copied", "error"));
        }
      }
      if (e.key === "w" && signalId) {
        e.preventDefault();
        addWatchlist(signalId);
      }
      if (e.key === "a" && signalId) {
        e.preventDefault();
        flushNote();
        const cur = visibleSigs.findIndex((s2) => s2.id === signalId);
        const nextSig = visibleSigs[cur + 1] || visibleSigs[cur - 1];
        archive(signalId);
        if (nextSig) openSignal(nextSig.id);
        else closeSignal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [signalId, modal, visibleSigs, openSignal, closeSignal, archive, addWatchlist, generateBrief, toast, flushNote, navigate, liveSignals]);
  const on = !!signal;
  const s = signal || {};
  const isLive = !fixtureSignal && !!liveSignal;
  const itemProvenance = isLive ? "live" : "fixture";
  const watched = signalId ? isWatched(signalId) : false;
  const labels = ["Correct priority", "Too high", "Too low", "Wrong topic", "Wrong portfolio", "Duplicate", "Noise", "Needs human review"];
  const sigPos = visibleSigs.findIndex((x) => x.id === signalId);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "drawer-back" + (on ? " on" : ""), onClick: closeWithFlush, "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("aside", { className: "drawer" + (on ? " on" : ""), role: "dialog", "aria-modal": "true", "aria-label": "Signal detail", "aria-hidden": on ? void 0 : "true" }, on && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "drawer-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono drawer-kicker", style: { fontSize: "var(--t-label)", color: "var(--ink-4)", letterSpacing: ".16em", textTransform: "uppercase", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" } }, /* @__PURE__ */ React.createElement("span", { style: { minWidth: 0, overflowWrap: "anywhere" } }, isLive || /^https?:/.test(s.id || "") ? s.source || "APH" : s.id), (() => {
    const [day, seen] = String(s.date || "").split(", first seen ");
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { "data-drawer-date": "", style: { whiteSpace: "nowrap" } }, "\xB7 ", day, seen ? "," : ""), seen && /* @__PURE__ */ React.createElement("span", { "data-drawer-seen": "", style: { whiteSpace: "nowrap" } }, "first seen ", seen));
  })(), /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: itemProvenance,
      title: isLive ? "This item is from an official APH feed" : "This item has no live source"
    }
  )), /* @__PURE__ */ React.createElement("h2", { className: "h-drawer", style: { margin: "4px 0 0", maxWidth: 460 } }, isLive ? s.link ? /* @__PURE__ */ React.createElement("a", { href: s.link, target: "_blank", rel: "noopener noreferrer", style: { color: "inherit" }, title: "Open the source at aph.gov.au" }, s.title, " ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 13, style: { verticalAlign: "-1px", opacity: 0.6 } })) : s.source : s.title)), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 } }, sigPos !== -1 && /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--ink-4)", textAlign: "right", lineHeight: 1.3 } }, /* @__PURE__ */ React.createElement("span", { style: { display: "block" } }, sigPos + 1, " / ", visibleSigs.length), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "var(--t-label)", letterSpacing: ".1em" } }, "SIGNAL")), /* @__PURE__ */ React.createElement("button", { ref: closeButtonRef, className: "btn ghost sm", "aria-label": "Close signal detail", onClick: closeWithFlush }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 14 })))), /* @__PURE__ */ React.createElement("div", { className: "drawer-body", ref: drawerBodyRef }, s.action && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Recommended action"), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderLeft: "3px solid var(--brass)", borderRadius: "0 6px 6px 0", background: "var(--panel-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, color: "var(--ink)" } }, s.action), s.actionReason && /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: "var(--t-body-sm)", marginTop: 4 } }, s.actionReason))), isLive && s.summary && s.summary === s.attentionReason ? /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Scoring explanation"), /* @__PURE__ */ React.createElement("p", null, s.summary || NOT_SUPPLIED)) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Summary"), /* @__PURE__ */ React.createElement("p", null, s.summary || NOT_SUPPLIED)), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Why it matters"), /* @__PURE__ */ React.createElement("p", null, s.attentionReason || NOT_SUPPLIED))), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Signal metadata"), /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "Source"), /* @__PURE__ */ React.createElement("dd", null, s.source || NOT_SUPPLIED), /* @__PURE__ */ React.createElement("dt", null, "Source group"), /* @__PURE__ */ React.createElement("dd", null, s.sourceGroup || NOT_SUPPLIED), /* @__PURE__ */ React.createElement("dt", null, "Authority"), /* @__PURE__ */ React.createElement("dd", null, s.sourceAuthority || NOT_SUPPLIED), /* @__PURE__ */ React.createElement("dt", null, "Attention"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement(Att, { level: s.attention })), /* @__PURE__ */ React.createElement("dt", null, "Confidence"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement(Conf, { n: s.confidence }), !isLive && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", marginLeft: 8, fontFamily: "var(--mono)", fontSize: "var(--t-eyebrow)" } }, "Representative")), /* @__PURE__ */ React.createElement("dt", null, "Human review"), /* @__PURE__ */ React.createElement("dd", null, s.humanReview ? `Review status: ${s.humanReview === "Required" ? "Not reviewed \xB7 policy officer must verify source links before use" : "Optional for internal triage; required before external distribution"}` : NOT_SUPPLIED))), SITE_CONFIG.showUnsourcedSurfaces && !isLive && s.score && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Attention score breakdown ", /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { verticalAlign: "middle", marginLeft: 6 } }, "Sample data")), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-4)", fontSize: "var(--t-caption)", marginBottom: 6 } }, "Illustrative five-factor breakdown for an example signal, not a computed score."), Object.entries(s.score).map(([k, v]) => {
    const lab = { authority: "Source authority", portfolio: "Portfolio relevance", novelty: "Novelty", momentum: "Momentum", time: "Time sensitivity", scrutiny: "Scrutiny relevance", ops: "Operational impact" };
    return /* @__PURE__ */ React.createElement("div", { key: k, style: { display: "grid", gridTemplateColumns: "160px 1fr 40px", gap: 10, alignItems: "center", padding: "4px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "var(--t-body-sm)", color: "var(--ink-2)" } }, lab[k]), /* @__PURE__ */ React.createElement("div", { className: "bar" }, /* @__PURE__ */ React.createElement("div", { className: "fill", style: { width: `${v * 100}%` } })), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: "var(--t-eyebrow)", color: "var(--ink-3)", textAlign: "right" } }, Math.round(v * 100)));
  })), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Evidence \xB7 open the actual source"), ((_a = s.evidence) == null ? void 0 : _a.length) > 0 ? s.evidence.map((e, i) => /* @__PURE__ */ React.createElement("a", { key: i, className: "ev-link", href: e.url, target: "_blank", rel: "noopener noreferrer", style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid var(--line-2)",
    borderRadius: 8,
    color: "var(--ink)",
    textDecoration: "none",
    marginBottom: 6,
    fontSize: "var(--t-body-sm)"
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "link", size: 14, stroke: "var(--link)", style: { flexShrink: 0 } }), /* @__PURE__ */ React.createElement("span", { className: "ev-text", style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 } }, /* @__PURE__ */ React.createElement("span", { className: "ev-label" }, e.label), /* @__PURE__ */ React.createElement("span", { className: "mono ev-url", style: { color: "var(--ink-4)", fontSize: "var(--t-eyebrow)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.url.replace(/^https?:\/\//, ""))), /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, stroke: "var(--ink-3)", style: { flexShrink: 0 } }))) : /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-4)", fontSize: "var(--t-body-sm)" } }, "No source link recorded for this item.")), SITE_CONFIG.showUnsourcedSurfaces && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Processing log"), s.provenance && s.provenance.length > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "chip-fixture", style: { marginBottom: 8 } }, "Illustrative example only, not a production audit log \xB7 target workflow shown, not a record of what happened to this item"), /* @__PURE__ */ React.createElement("div", { style: { border: "1px solid var(--line-2)", borderRadius: 8, overflow: "hidden" } }, s.provenance.map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "78px 90px 1fr", gap: 10, padding: "8px 12px", fontSize: "var(--t-caption)", borderBottom: i < s.provenance.length - 1 ? "1px solid var(--line)" : 0, background: i % 2 ? "var(--panel-hi)" : "transparent" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-4)", fontSize: "var(--t-micro)" } }, p.ts), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "tag", style: { fontSize: "var(--t-micro)", padding: "1px 6px" } }, p.by)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, p.event))))) : /* @__PURE__ */ React.createElement(EmptyState, { icon: "signal", kicker: "No processing log held" }, "Parliament Pulse does not record a per-signal processing log for this item. This section shows one only for illustrative example signals.")), s.updates && s.updates.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Updates to this signal \xB7 who / what / when"), s.updates.map((u, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "60px 140px 1fr", gap: 10, padding: "8px 0", borderBottom: i < s.updates.length - 1 ? "1px solid var(--line)" : 0, fontSize: "var(--t-body-sm)" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-4)", fontSize: "var(--t-eyebrow)" } }, u.ts), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--brass)" } }, u.who), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, u.what)))), s.members && s.members.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "People referenced"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, s.members.map((mid) => {
    var _a2, _b;
    const m = (_b = (_a2 = window.ENTITIES) == null ? void 0 : _a2.members) == null ? void 0 : _b[mid];
    if (!m) return null;
    return /* @__PURE__ */ React.createElement("button", { type: "button", key: mid, className: "tag brass clk", onClick: () => openModal("member", mid) }, m.name);
  }))), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Analyst note ", noteSaved && /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: "var(--t-micro)", color: "var(--brass)", marginLeft: 8 } }, "Saved")), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: note,
      onChange: (e) => setNote(e.target.value),
      onBlur: flushNote,
      "aria-label": "Analyst note for this signal, saved privately in this browser",
      placeholder: "Private notes (auto-saved)",
      rows: 3,
      style: { width: "100%", background: "var(--panel)", border: "1px solid var(--line-2)", borderRadius: 8, color: "var(--ink)", padding: "8px 10px", fontFamily: "var(--sans)", fontSize: "var(--t-body-sm)", resize: "vertical" }
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Analyst feedback \xB7 is this right?"), /* @__PURE__ */ React.createElement("div", { className: "feedback-row" }, labels.map((l) => /* @__PURE__ */ React.createElement("button", { key: l, className: "fb" + (l === "Correct priority" ? " affirmative" : "") + (fb === l ? " on" : ""), onClick: () => {
    setFb(l);
    saveFeedback(s.id, l, "");
  } }, l === "Correct priority" && /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 12, style: { marginRight: 6, verticalAlign: "-2px" } }), l))))), /* @__PURE__ */ React.createElement("div", { className: "drawer-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyToClipboard(generateBriefMarkdown(s, isLive)).then(() => {
      generateBrief(s.id, "Executive brief");
      toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") });
    }).catch(() => toast("Clipboard unavailable, so the brief was not copied", "error"));
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate brief"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => addWatchlist(s.id), style: watched ? { borderColor: "var(--brass)", color: "var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " ", watched ? "Watching" : "Watchlist"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => {
    flushNote();
    const cur = visibleSigs.findIndex((x) => x.id === signalId);
    const nextSig = visibleSigs[cur + 1] || visibleSigs[cur - 1];
    archive(signalId);
    if (nextSig) openSignal(nextSig.id);
    else closeSignal();
  } }, "Archive"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeWithFlush }, "Close")))));
}
function SiteFooter() {
  return /* @__PURE__ */ React.createElement("footer", { className: "site-foot", role: "contentinfo" }, /* @__PURE__ */ React.createElement("p", null, "Source material: Parliament of Australia website, licensed under", " ", /* @__PURE__ */ React.createElement("a", { href: "https://creativecommons.org/licenses/by-nc-nd/4.0/", target: "_blank", rel: "noopener noreferrer license" }, "CC BY-NC-ND 4.0"), ".", " ", "Titles reproduced unmodified; scores and summaries are Parliament Pulse analysis."), /* @__PURE__ */ React.createElement("nav", { className: "site-foot-links", "aria-label": "Legal" }, /* @__PURE__ */ React.createElement("a", { href: "#/about/legal" }, "Legal and disclaimer"), /* @__PURE__ */ React.createElement("a", { href: "#/about/privacy" }, "Privacy"), /* @__PURE__ */ React.createElement("a", { href: "#/about/licence" }, "Licence and attribution"), /* @__PURE__ */ React.createElement("a", { href: "#/about/accessibility" }, "Accessibility")));
}
Object.assign(window, { liveNavState, Sidebar, Topbar, TopClock, SignalCard, Drawer, Att, Conf, ProvenanceChip, BetaNotice, EmptyState, SkeletonRow, SkeletonCard, SkeletonTable, fmtDataAge, buildBriefSections, SiteFooter, generateBriefMarkdown });
