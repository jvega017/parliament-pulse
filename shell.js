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
  return /* @__PURE__ */ React.createElement("span", { className: "mono top-clock", "aria-label": "Local time", title: "Local time", style: { fontSize: 12, color: "var(--ink-3)", letterSpacing: ".06em", fontVariantNumeric: "tabular-nums" } }, clock);
}
function BetaNotice() {
  const key = "pp-beta-ack";
  const [visible, setVisible] = React.useState(() => safeGetLocalStorage(key) !== "1");
  if (!visible) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "design-banner", role: "status" }, /* @__PURE__ */ React.createElement(Icon, { name: "signal", size: 14, stroke: "var(--gold)" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "Live beta."), " Official APH feeds poll on the Live page. Enriched signals, radar and workflow queues are representative until the enrichment pipeline is connected. "), /* @__PURE__ */ React.createElement("button", { "aria-label": "Dismiss notice", onClick: () => {
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
const NAV = [
  { id: "overview", label: "Overview", group: "Today", count: null },
  { id: "live", label: "Live parliament", group: "Today", count: null, live: true },
  { id: "signals", label: "Signal inbox", group: "Today", count: 6 },
  { id: "radar", label: "Attention radar", group: "Today", count: 6 },
  { id: "committees", label: "Committees", group: "Workspace", count: 7 },
  { id: "bills", label: "Bills intelligence", group: "Workspace", count: 5 },
  { id: "parliament", label: "Daily program", group: "Workspace", count: 3 },
  { id: "patterns", label: "QON patterns", group: "Workspace", count: 1 },
  { id: "briefings", label: "Briefings", group: "Workspace", count: 4 },
  { id: "watchlists", label: "Watchlists", group: "Workspace", count: 12 },
  { id: "sources", label: "Sources", group: "Workspace", count: null }
];
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
  signals: "signal"
};
function Sidebar({ page, onNavigate, mobileOpen }) {
  const { state } = useStore();
  const navCount = React.useMemo(() => {
    const active = SIGNALS.filter((s) => !state.archived[s.id]);
    return {
      overview: null,
      /* a dashboard has no unambiguous count; omit (the hero KPI carries the priority number) */
      live: null,
      radar: active.filter((s) => s.attention !== "low").length,
      signals: active.length,
      committees: COMMITTEE_ITEMS.length,
      bills: BILLS.length,
      parliament: DIVISIONS.length,
      patterns: QON_PATTERN.items.length,
      briefings: BRIEFING_QUEUE.length + Object.keys(state.briefsGenerated || {}).length,
      watchlists: WATCHLISTS.length + (state.watchlistCreated || []).length,
      sources: null
      /* "6" was ambiguous (feeds? errors?); the Sources page states it plainly */
    };
  }, [state.archived, state.briefsGenerated, state.watchlistCreated, state.feeds]);
  const groups = [...new Set(NAV.map((n) => n.group))];
  const [streak, setStreak] = React.useState(() => {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const last = safeGetLocalStorage("pp-last-open-date");
    const count = parseInt(safeGetLocalStorage("pp-streak-count", "0") || "0");
    if (last === today) return count || 1;
    const yest = /* @__PURE__ */ new Date();
    yest.setDate(yest.getDate() - 1);
    const yStr = yest.toISOString().slice(0, 10);
    return last === yStr ? count + 1 : 1;
  });
  React.useEffect(() => {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (safeGetLocalStorage("pp-last-open-date") === today) return;
    const count = parseInt(safeGetLocalStorage("pp-streak-count", "0") || "0");
    const yest = /* @__PURE__ */ new Date();
    yest.setDate(yest.getDate() - 1);
    const yStr = yest.toISOString().slice(0, 10);
    const newCount = safeGetLocalStorage("pp-last-open-date") === yStr ? count + 1 : 1;
    safeSetLocalStorage("pp-streak-count", String(newCount));
    safeSetLocalStorage("pp-last-open-date", today);
    setStreak(newCount);
  }, []);
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
    n.live && /* @__PURE__ */ React.createElement("span", { className: "count nav-live" }, "LIVE"),
    !n.live && navCount[n.id] !== null && /* @__PURE__ */ React.createElement("span", { className: "count" }, navCount[n.id])
  ))))), /* @__PURE__ */ React.createElement("div", { className: "side-status", "aria-label": "System status" }, /* @__PURE__ */ React.createElement("div", { className: "side-status-head" }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--ok)", boxShadow: "none" } }), /* @__PURE__ */ React.createElement("span", null, "Feeds configured")), /* @__PURE__ */ React.createElement("div", null, "Official RSS proxy configured; runtime health appears on Live"), /* @__PURE__ */ React.createElement("div", { className: "mono" }, "Status: local beta")), /* @__PURE__ */ React.createElement("div", { className: "side-foot" }, /* @__PURE__ */ React.createElement("div", { className: "avatar" }, "JV"), /* @__PURE__ */ React.createElement("div", { style: { lineHeight: 1.2 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, "Juan Vega"), /* @__PURE__ */ React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)" } }, "Prometheus Policy Lab \xB7 live beta"))));
}
function ShortcutHelp() {
  const [open, setOpen] = React.useState(false);
  const shortcuts = [
    ["j / k", "Navigate to next / previous signal"],
    ["Enter / Space", "Open focused signal or nav item"],
    ["Esc", "Close drawer or modal"],
    ["b", "Copy brief to clipboard (while signal open)"],
    ["w", "Add signal to watchlist (while signal open)"],
    ["a", "Archive signal and advance (while signal open)"],
    [IS_MAC ? "\u2318K" : "Ctrl+K", "Focus global search"]
  ];
  return /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: "Keyboard shortcuts", onClick: () => setOpen((o) => !o), "aria-label": "View keyboard shortcuts", "aria-expanded": open }, /* @__PURE__ */ React.createElement(Icon, { name: "pattern", size: 13 })), open && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--panel-2)", border: "1px solid var(--line-bright)", borderRadius: 10, boxShadow: "var(--shadow)", zIndex: 40, width: 320, padding: "12px 14px" }, role: "dialog", "aria-label": "Keyboard shortcuts" }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: 10 } }, "Keyboard shortcuts"), shortcuts.map(([k, d]) => /* @__PURE__ */ React.createElement("div", { key: k, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-2)" } }, d), /* @__PURE__ */ React.createElement("kbd", { style: { fontFamily: "var(--mono)", fontSize: 11, background: "var(--panel-hi)", border: "1px solid var(--line-2)", borderRadius: 4, padding: "2px 7px", color: "var(--brass)", marginLeft: 10, whiteSpace: "nowrap" } }, k))), /* @__PURE__ */ React.createElement("button", { style: { marginTop: 10, background: "none", border: "none", color: "var(--ink-4)", cursor: "pointer", fontSize: 12, padding: 0 }, onClick: () => setOpen(false) }, "Close")));
}
function Topbar({ mobileNavOpen, setMobileNavOpen }) {
  const { openModal, openSignal, toast, modal, signalId, setSignalSearchQuery, requestLiveRefresh, consumeLiveRefresh, navigate } = useStore();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState(-1);
  const [isDark, setIsDark] = React.useState(() => safeGetLocalStorage("pp-theme") !== "light");
  const [focused, setFocused] = React.useState(false);
  const ref = React.useRef(null);
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => {
      var _a, _b, _c;
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        (_a = ref.current) == null ? void 0 : _a.focus();
      }
      if (e.key === "Escape") {
        if (modal || signalId) return;
        if (open) {
          e.preventDefault();
          setOpen(false);
          setCursor(-1);
          (_b = ref.current) == null ? void 0 : _b.blur();
          return;
        }
        (_c = ref.current) == null ? void 0 : _c.blur();
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
      setCursor(-1);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const results = React.useMemo(() => {
    if (!q.trim()) return null;
    const term = q.toLowerCase();
    const sig = SIGNALS.filter((s) => s.title.toLowerCase().includes(term) || s.summary.toLowerCase().includes(term) || s.id.toLowerCase().includes(term));
    const bills = Object.values(ENTITIES.bills).filter((b) => [b.title, b.ref, b.portfolio, b.stage].some((v) => (v || "").toLowerCase().includes(term)));
    const comm = Object.values(ENTITIES.committees).filter((c) => [c.name, c.portfolio, c.chamber].some((v) => (v || "").toLowerCase().includes(term)));
    const mem = Object.values(ENTITIES.members).filter((m) => [m.name, m.party, (m.roles || []).join(" ")].some((v) => (v || "").toLowerCase().includes(term)));
    const feeds = APH_FEEDS.filter((f) => f.name.toLowerCase().includes(term));
    return { sig, bills, comm, mem, feeds };
  }, [q]);
  const flat = React.useMemo(() => {
    if (!results) return [];
    return [
      ...results.sig.slice(0, 4).map((s) => ({ kind: "signal", key: s.id, label: s.title, sub: s.id, act: () => {
        openSignal(s.id);
      } })),
      ...results.sig.length > 4 ? [{ kind: "signalsAll", key: "signals-all", label: `See all ${results.sig.length} signals`, sub: q, act: () => {
        setSignalSearchQuery(q);
        navigate("signals");
      } }] : [],
      ...results.bills.map((b) => ({ kind: "bill", key: b.ref, label: b.title, sub: b.ref, act: () => {
        openModal("bill", b.ref);
      } })),
      ...results.comm.map((c) => ({ kind: "committee", key: c.id, label: c.name, sub: c.chamber, act: () => {
        openModal("committee", c.id);
      } })),
      ...results.mem.map((m) => ({ kind: "member", key: m.id, label: m.name, sub: m.party, act: () => {
        openModal("member", m.id);
      } })),
      ...results.feeds.slice(0, 4).map((f) => ({ kind: "feed", key: f.id, label: f.name, sub: f.group, act: () => {
        openModal("feed", f.id);
      } }))
    ];
  }, [results, q, openSignal, openModal, setSignalSearchQuery, navigate]);
  React.useEffect(() => setCursor(-1), [q]);
  const selectItem = (item) => {
    item.act();
    setOpen(false);
    setQ("");
    setCursor(-1);
  };
  const onKeyDown = (e) => {
    var _a;
    if (!open || !results) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setCursor(-1);
      (_a = ref.current) == null ? void 0 : _a.blur();
      return;
    }
    if (e.key === "Enter" && cursor >= 0 && flat[cursor]) {
      e.preventDefault();
      selectItem(flat[cursor]);
      return;
    }
  };
  const sigOff = 0;
  const sigFlatCount = results ? results.sig.slice(0, 4).length + (results.sig.length > 4 ? 1 : 0) : 0;
  const billOff = sigFlatCount;
  const commOff = billOff + (results ? results.bills.length : 0);
  const memOff = commOff + (results ? results.comm.length : 0);
  const feedOff = memOff + (results ? results.mem.length : 0);
  return /* @__PURE__ */ React.createElement("div", { className: "topbar" }, /* @__PURE__ */ React.createElement(
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
      onClick: () => setOpen(true),
      style: focused ? { borderColor: "var(--brass)", boxShadow: "0 0 0 3px var(--brass-soft)" } : void 0
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 14, stroke: focused ? "var(--brass)" : "var(--ink-3)" }),
    /* @__PURE__ */ React.createElement(
      "input",
      {
        ref,
        value: q,
        role: "combobox",
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
        "aria-label": "Search parliament signals, bills, committees and members",
        "aria-expanded": open && !!results,
        "aria-autocomplete": "list",
        "aria-controls": "search-listbox",
        "aria-activedescendant": cursor >= 0 ? `search-option-${cursor}` : void 0,
        placeholder: "Search signals, bills, committees, members, feeds\u2026"
      }
    ),
    q ? /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          var _a;
          setQ("");
          setOpen(false);
          setCursor(-1);
          (_a = ref.current) == null ? void 0 : _a.focus();
        },
        "aria-label": "Clear search",
        title: "Clear search",
        style: { background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "var(--ink-3)", display: "flex", alignItems: "center", flexShrink: 0 }
      },
      /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 12 })
    ) : /* @__PURE__ */ React.createElement("span", { className: "kbd" }, IS_MAC ? "\u2318K" : "Ctrl+K"),
    open && results && /* @__PURE__ */ React.createElement("div", { id: "search-listbox", role: "listbox", className: "search-results" }, results.sig.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group" }, "Signals (", results.sig.length, ")"), results.sig.slice(0, 4).map((s, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: s.id,
        id: `search-option-${sigOff + i}`,
        role: "option",
        "aria-selected": cursor === sigOff + i,
        className: "sr-item" + (cursor === sigOff + i ? " active" : ""),
        onMouseDown: (e) => {
          e.preventDefault();
          selectItem(flat[sigOff + i]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "k" }, s.id),
      /* @__PURE__ */ React.createElement("span", null, s.title)
    )), results.sig.length > 4 && /* @__PURE__ */ React.createElement(
      "div",
      {
        id: `search-option-${sigOff + 4}`,
        role: "option",
        "aria-selected": cursor === sigOff + 4,
        className: "sr-item" + (cursor === sigOff + 4 ? " active" : ""),
        onMouseDown: (e) => {
          e.preventDefault();
          selectItem(flat[sigOff + 4]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "k" }, "All"),
      /* @__PURE__ */ React.createElement("span", null, "See all ", results.sig.length, " signals")
    )), results.bills.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group" }, "Bills"), results.bills.map((b, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: b.ref,
        id: `search-option-${billOff + i}`,
        role: "option",
        "aria-selected": cursor === billOff + i,
        className: "sr-item" + (cursor === billOff + i ? " active" : ""),
        onMouseDown: (e) => {
          e.preventDefault();
          selectItem(flat[billOff + i]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "k" }, b.ref),
      /* @__PURE__ */ React.createElement("span", null, b.title)
    ))), results.comm.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group" }, "Committees"), results.comm.map((c, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: c.id,
        id: `search-option-${commOff + i}`,
        role: "option",
        "aria-selected": cursor === commOff + i,
        className: "sr-item" + (cursor === commOff + i ? " active" : ""),
        onMouseDown: (e) => {
          e.preventDefault();
          selectItem(flat[commOff + i]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "k" }, c.chamber),
      /* @__PURE__ */ React.createElement("span", null, c.name)
    ))), results.mem.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group" }, "Members"), results.mem.map((m, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: m.id,
        id: `search-option-${memOff + i}`,
        role: "option",
        "aria-selected": cursor === memOff + i,
        className: "sr-item" + (cursor === memOff + i ? " active" : ""),
        onMouseDown: (e) => {
          e.preventDefault();
          selectItem(flat[memOff + i]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "k" }, m.party),
      /* @__PURE__ */ React.createElement("span", null, m.name)
    ))), results.feeds.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "sr-group" }, "Sources (", results.feeds.length, ")"), results.feeds.slice(0, 4).map((f, i) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: f.id,
        id: `search-option-${feedOff + i}`,
        role: "option",
        "aria-selected": cursor === feedOff + i,
        className: "sr-item" + (cursor === feedOff + i ? " active" : ""),
        onMouseDown: (e) => {
          e.preventDefault();
          selectItem(flat[feedOff + i]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "k" }, f.group),
      /* @__PURE__ */ React.createElement("span", null, f.name)
    ))), q && !results.sig.length && !results.bills.length && !results.comm.length && !results.mem.length && !results.feeds.length && /* @__PURE__ */ React.createElement("div", { className: "sr-item", role: "option", "aria-selected": "false", style: { color: "var(--ink-4)", cursor: "default" } }, 'No matches for "', q, '"'))
  ), /* @__PURE__ */ React.createElement("div", { className: "top-right" }, /* @__PURE__ */ React.createElement(TopClock, null), /* @__PURE__ */ React.createElement("span", { className: "chip clk", onClick: () => navigate("live"), title: "Official feeds configured; live RSS polls on the Live page", style: { borderColor: "color-mix(in srgb, var(--gold) 55%, transparent)", color: "var(--gold)", background: "transparent" } }, /* @__PURE__ */ React.createElement("span", { className: "dot", style: { background: "var(--gold)", boxShadow: "none" } }), " Live beta \xB7 ", sourceCounts().total, " feeds"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm shortcut-btn", title: "Go to Live parliament and refresh feeds there", "aria-label": "Refresh live feeds", onClick: () => {
    requestLiveRefresh();
    navigate("live");
    if (window.__refreshLiveFeeds) {
      consumeLiveRefresh();
      window.__refreshLiveFeeds();
      toast("Refreshing live feeds...");
    } else toast("Opening Live page to refresh feeds", "brass");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 14 })), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: "Show current priority count", "aria-label": "Alerts", onClick: () => toast(`${SIGNALS.filter((s) => s.attention === "high").length} priority signals currently need review`, "brass") }, /* @__PURE__ */ React.createElement(Icon, { name: "bell", size: 14 })), /* @__PURE__ */ React.createElement("button", { className: "btn primary sm", onClick: () => navigate("briefings") }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " New brief"), /* @__PURE__ */ React.createElement(ShortcutHelp, null), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", title: isDark ? "Switch to light mode" : "Switch to dark mode", "aria-label": isDark ? "Switch to light mode" : "Switch to dark mode", onClick: () => {
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    safeSetLocalStorage("pp-theme", next);
    setIsDark(!isDark);
  } }, /* @__PURE__ */ React.createElement(Icon, { name: isDark ? "sun" : "moon", size: 13 }))));
}
function ProvenanceChip({ provenance, title }) {
  const LABELS = { live: "Live", derived: "Derived", fixture: "Fixture" };
  const key = LABELS[provenance] ? provenance : "fixture";
  const cls = "chip-fixture" + (key === "live" ? " chip-live" : key === "derived" ? " chip-derived" : "");
  return /* @__PURE__ */ React.createElement("span", { className: cls, title }, LABELS[key]);
}
function Att({ level }) {
  const map = { high: "High", med: "Medium", low: "Low" };
  return /* @__PURE__ */ React.createElement("span", { className: "att " + level }, map[level]);
}
function Conf({ n = 3 }) {
  const ramp = ["var(--brass)", "var(--brass)", "var(--brass-2)", "var(--gold)", "var(--gold)"];
  return /* @__PURE__ */ React.createElement("span", { className: "conf", title: `Confidence ${n}/5` }, [1, 2, 3, 4, 5].map((i) => /* @__PURE__ */ React.createElement(
    "span",
    {
      key: i,
      className: i <= n ? "on" : "",
      style: i <= n ? { background: ramp[i - 1] } : void 0
    }
  )));
}
function buildBriefSections(s, isLive = false) {
  var _a;
  const evidence = (s.evidence || []).map((e) => ({ label: e.label, url: e.url }));
  const confidenceLabel = isLive ? "Confidence score" : "Representative confidence score";
  const provParts = [
    `Signal ID: ${s.id}`,
    `${confidenceLabel}: ${(_a = s.confidence) != null ? _a : "\u2014"}/5`
  ];
  if (s.humanReview) provParts.push(`Review status: ${s.humanReview}`);
  provParts.push("Representative workflow trace; not a production processing log.");
  return {
    title: s.title,
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
    recommendedAction: {
      label: s.action,
      reason: s.actionReason
    },
    evidence,
    provenance: provParts.join(" | ")
  };
}
function SignalCard({ s }) {
  const { openSignal, state, isWatched } = useStore();
  const archived = !!state.archived[s.id];
  const feedback = state.feedback[s.id];
  const watched = isWatched(s.id);
  return /* @__PURE__ */ React.createElement(SignalCardView, { s, archived, feedback, watched, openSignal });
}
const SignalCardView = React.memo(function SignalCardView2({ s, archived, feedback, watched, openSignal }) {
  if (archived) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "signal", "data-att": s.attention, onClick: () => openSignal(s.id), role: "button", tabIndex: 0, "aria-label": `Signal: ${s.title}`, onKeyDown: (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSignal(s.id);
    }
  } }, /* @__PURE__ */ React.createElement("div", { className: "sig-head" }, /* @__PURE__ */ React.createElement("span", { className: "sig-id mono" }, s.id), /* @__PURE__ */ React.createElement("span", { className: "sig-source mono" }, "\xB7 ", s.source), /* @__PURE__ */ React.createElement(Att, { level: s.attention }), watched && /* @__PURE__ */ React.createElement("span", { className: "tag brass" }, "Watching"), /* @__PURE__ */ React.createElement("span", { className: "sig-time mono" }, s.time)), /* @__PURE__ */ React.createElement("div", { className: "sig-title serif" }, s.title), /* @__PURE__ */ React.createElement("div", { className: "sig-sum" }, s.summary.length > 120 ? s.summary.slice(0, 120).replace(/\s\S+$/, "") + "\u2026" : s.summary), /* @__PURE__ */ React.createElement("div", { className: "sig-tags" }, s.tags.map((t, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "tag " + (t.c || "") }, t.l))), /* @__PURE__ */ React.createElement("div", { className: "sig-action" }, /* @__PURE__ */ React.createElement("span", { className: "sig-action-label" }, "Recommended"), /* @__PURE__ */ React.createElement("span", { className: "sig-action-value" }, s.action), /* @__PURE__ */ React.createElement("span", { className: "mono", title: "Analyst confidence", style: { fontSize: 10.5, color: "var(--ink-4)", letterSpacing: ".04em", whiteSpace: "nowrap" } }, s.confidence, "/5")), feedback && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 11.5, color: "var(--brass)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 12, style: { verticalAlign: "-2px", marginRight: 4 } }), " Feedback: ", feedback.label), watched && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 11.5, color: "var(--brass)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 12, style: { verticalAlign: "-2px", marginRight: 4 } }), " On watchlist"));
});
function generateBriefMarkdown(s) {
  const brief = buildBriefSections(s);
  const evidence = brief.evidence.map((e) => `- [${e.label}](${e.url})`).join("\n");
  return [
    `> BETA DRAFT \u2014 generated from the current Parliament Pulse signal record. Verify source links before distribution.`,
    ``,
    `# Executive Brief \u2014 ${brief.title}`,
    `Date: ${brief.meta.date} | Source: ${brief.meta.source} | Priority: ${(brief.meta.attention || "").toUpperCase()}`,
    ``,
    `## Summary`,
    brief.summary,
    ``,
    `## Why it matters`,
    brief.whyItMatters,
    ``,
    `## Recommended action`,
    `**${brief.recommendedAction.label}**`,
    brief.recommendedAction.reason,
    ``,
    `## Evidence`,
    evidence || "_No evidence links recorded._",
    ``,
    `## Provenance`,
    brief.provenance,
    `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`
  ].join("\n");
}
function Drawer() {
  var _a, _b;
  const { signalId, openSignal, closeSignal, state, modal, openModal, saveFeedback, archive, addWatchlist, isWatched, saveNote, generateBrief, toast, visibleSignalOrder, navigate, liveSignals } = useStore();
  const fixtureSignal = React.useMemo(() => SIGNALS.find((s2) => s2.id === signalId), [signalId]);
  const liveSignal = React.useMemo(() => ((liveSignals == null ? void 0 : liveSignals.items) || []).find((s2) => s2.id === signalId), [signalId, liveSignals]);
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
      prevFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        var _a2;
        return (_a2 = closeButtonRef.current) == null ? void 0 : _a2.focus();
      });
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
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
      var _a2;
      if (modal) return;
      const tag = (_a2 = document.activeElement) == null ? void 0 : _a2.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape" && signalId) {
        e.preventDefault();
        flushNote();
        closeSignal();
        return;
      }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const cur = visibleSigs.findIndex((s2) => s2.id === signalId);
        const next = e.key === "j" ? Math.min(cur + 1, visibleSigs.length - 1) : Math.max(cur - 1, 0);
        if (visibleSigs[next] && visibleSigs[next].id !== signalId) {
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
          }).catch(() => toast("Clipboard unavailable \u2014 brief not copied", "error"));
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
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "drawer-back" + (on ? " on" : ""), onClick: closeWithFlush, "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("aside", { className: "drawer" + (on ? " on" : ""), role: "dialog", "aria-modal": "true", "aria-label": on ? s.title : "Signal detail" }, on && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "drawer-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", letterSpacing: ".16em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React.createElement("span", null, s.id, " \xB7 ", s.date), /* @__PURE__ */ React.createElement(
    ProvenanceChip,
    {
      provenance: itemProvenance,
      title: isLive ? "This item is from the Worker's live /state endpoint (D1 archive)" : "This item is representative fixture data"
    }
  )), /* @__PURE__ */ React.createElement("h2", { className: "h-drawer", style: { margin: "4px 0 0", maxWidth: 460 } }, s.title)), /* @__PURE__ */ React.createElement("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 } }, sigPos !== -1 && /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", textAlign: "right", lineHeight: 1.3 } }, /* @__PURE__ */ React.createElement("span", { style: { display: "block" } }, sigPos + 1, " / ", visibleSigs.length), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, letterSpacing: ".1em", opacity: 0.7 } }, "SIGNAL")), /* @__PURE__ */ React.createElement("button", { ref: closeButtonRef, className: "btn ghost sm", "aria-label": "Close signal detail", onClick: closeWithFlush }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 14 })))), /* @__PURE__ */ React.createElement("div", { className: "drawer-body", ref: drawerBodyRef }, /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Recommended action"), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px 14px", borderLeft: "3px solid var(--brass)", borderRadius: "0 6px 6px 0", background: "var(--panel-2)" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, color: "var(--ink)" } }, s.action || "\u2014"), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)", fontSize: 13, marginTop: 4 } }, s.actionReason || "\u2014"))), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Summary"), /* @__PURE__ */ React.createElement("p", null, s.summary || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Why it matters"), /* @__PURE__ */ React.createElement("p", null, s.attentionReason || "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Signal metadata"), /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "Source"), /* @__PURE__ */ React.createElement("dd", null, s.source || "\u2014"), /* @__PURE__ */ React.createElement("dt", null, "Source group"), /* @__PURE__ */ React.createElement("dd", null, s.sourceGroup || "\u2014"), /* @__PURE__ */ React.createElement("dt", null, "Authority"), /* @__PURE__ */ React.createElement("dd", null, s.sourceAuthority || "\u2014"), /* @__PURE__ */ React.createElement("dt", null, "Attention"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement(Att, { level: s.attention })), /* @__PURE__ */ React.createElement("dt", null, "Confidence"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement(Conf, { n: s.confidence }), " ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-3)", marginLeft: 8, fontFamily: "var(--mono)", fontSize: 11 } }, isLive ? "Confidence score" : "Representative confidence score", ": ", (_a = s.confidence) != null ? _a : "\u2014", "/5")), /* @__PURE__ */ React.createElement("dt", null, "Human review"), /* @__PURE__ */ React.createElement("dd", null, s.humanReview ? `Review status: ${s.humanReview === "Required" ? "Not reviewed \xB7 policy officer must verify source links before use" : "Optional for internal triage; required before external distribution"}` : "\u2014"))), s.score && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Attention score breakdown"), Object.entries(s.score).map(([k, v]) => {
    const lab = { authority: "Source authority", portfolio: "Portfolio relevance", novelty: "Novelty", momentum: "Momentum", time: "Time sensitivity", scrutiny: "Scrutiny relevance", ops: "Operational impact" };
    return /* @__PURE__ */ React.createElement("div", { key: k, style: { display: "grid", gridTemplateColumns: "160px 1fr 40px", gap: 10, alignItems: "center", padding: "4px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, color: "var(--ink-2)" } }, lab[k]), /* @__PURE__ */ React.createElement("div", { className: "bar" }, /* @__PURE__ */ React.createElement("div", { className: "fill", style: { width: `${v * 100}%` } })), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", textAlign: "right" } }, Math.round(v * 100)));
  })), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Evidence \xB7 open the actual source"), ((_b = s.evidence) == null ? void 0 : _b.length) > 0 ? s.evidence.map((e, i) => /* @__PURE__ */ React.createElement("a", { key: i, href: e.url, target: "_blank", rel: "noopener noreferrer", style: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid var(--line-2)",
    borderRadius: 8,
    color: "var(--ink)",
    textDecoration: "none",
    marginBottom: 6,
    fontSize: 13
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "link", size: 14, stroke: "var(--teal)" }), /* @__PURE__ */ React.createElement("span", null, e.label), /* @__PURE__ */ React.createElement("span", { className: "mono", style: { color: "var(--ink-4)", fontSize: 11, marginLeft: "auto", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.url.replace(/^https?:\/\//, "")), /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 12, stroke: "var(--ink-3)" }))) : /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-4)", fontSize: 13 } }, "\u2014 No source link recorded for this item.")), s.provenance && s.provenance.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Representative provenance \xB7 target workflow, not a production audit log ", /* @__PURE__ */ React.createElement("span", { className: "chip-fixture", style: { verticalAlign: "middle", marginLeft: 6 } }, "Representative data")), /* @__PURE__ */ React.createElement("div", { style: { border: "1px solid var(--line-2)", borderRadius: 8, overflow: "hidden" } }, s.provenance.map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "78px 90px 1fr", gap: 10, padding: "8px 12px", fontSize: 12, borderBottom: i < s.provenance.length - 1 ? "1px solid var(--line)" : 0, background: i % 2 ? "var(--panel-hi)" : "transparent" } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-4)", fontSize: 10.5 } }, p.ts), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "tag", style: { fontSize: 10, padding: "1px 6px" } }, p.by)), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, p.event))))), s.updates && s.updates.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Updates to this signal \xB7 who / what / when"), s.updates.map((u, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: "60px 140px 1fr", gap: 10, padding: "8px 0", borderBottom: i < s.updates.length - 1 ? "1px solid var(--line)" : 0, fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { color: "var(--ink-4)", fontSize: 11 } }, u.ts), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--brass)" } }, u.who), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--ink-2)" } }, u.what)))), s.members && s.members.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "People referenced"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, s.members.map((mid) => {
    var _a2, _b2;
    const m = (_b2 = (_a2 = window.ENTITIES) == null ? void 0 : _a2.members) == null ? void 0 : _b2[mid];
    if (!m) return null;
    return /* @__PURE__ */ React.createElement("span", { key: mid, className: "tag brass clk", onClick: () => openModal("member", mid) }, m.name);
  }))), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Analyst note ", noteSaved && /* @__PURE__ */ React.createElement("span", { className: "mono", style: { fontSize: 10, color: "var(--brass)", marginLeft: 8 } }, "Saved")), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: note,
      onChange: (e) => setNote(e.target.value),
      onBlur: flushNote,
      placeholder: "Private notes (auto-saved)",
      rows: 3,
      style: { width: "100%", background: "var(--panel)", border: "1px solid var(--line-2)", borderRadius: 8, color: "var(--ink)", padding: "8px 10px", fontFamily: "var(--sans)", fontSize: 13, resize: "vertical" }
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "drawer-section" }, /* @__PURE__ */ React.createElement("h3", null, "Analyst feedback \xB7 is this right?"), /* @__PURE__ */ React.createElement("div", { className: "feedback-row" }, labels.map((l) => /* @__PURE__ */ React.createElement("button", { key: l, className: "fb" + (l === "Correct priority" ? " affirmative" : "") + (fb === l ? " on" : ""), onClick: () => {
    setFb(l);
    saveFeedback(s.id, l, "");
  } }, l === "Correct priority" && /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 12, style: { marginRight: 6, verticalAlign: "-2px" } }), l))))), /* @__PURE__ */ React.createElement("div", { className: "drawer-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyToClipboard(generateBriefMarkdown(s, isLive)).then(() => {
      generateBrief(s.id, "Executive brief");
      toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") });
    }).catch(() => toast("Clipboard unavailable \u2014 brief not copied", "error"));
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate brief"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => addWatchlist(s.id), style: watched ? { borderColor: "var(--brass)", color: "var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " ", watched ? "Watching" : "Watchlist"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => {
    flushNote();
    const cur = visibleSigs.findIndex((x) => x.id === signalId);
    const nextSig = visibleSigs[cur + 1] || visibleSigs[cur - 1];
    archive(signalId);
    if (nextSig) openSignal(nextSig.id);
    else closeSignal();
  } }, "Archive"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeWithFlush }, "Close")))));
}
Object.assign(window, { Sidebar, Topbar, TopClock, SignalCard, Drawer, Att, Conf, ProvenanceChip, BetaNotice, EmptyState, SkeletonRow, SkeletonCard, buildBriefSections });
