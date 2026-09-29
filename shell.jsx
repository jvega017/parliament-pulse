// Shell: Sidebar, Topbar (with working global search), SignalCard, Drawer

const IS_MAC = /Mac|iPad/i.test(navigator.platform);

function fmtClock() {
  return new Date().toLocaleTimeString("en-AU", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function TopClock() {
  const [clock, setClock] = React.useState(fmtClock);
  React.useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="mono top-clock" title="Local time" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)", letterSpacing:".06em", fontVariantNumeric:"tabular-nums"}}>
      <span className="sr-only">Local time </span>{clock}
    </span>
  );
}

function BetaNotice() {
  const key = "pp-beta-ack";
  const [visible, setVisible] = React.useState(() => safeGetLocalStorage(key) !== "1");
  if (!visible) return null;
  return (
    <div className="design-banner" role="status">
      <Icon name="signal" size={14} stroke="var(--gold)" />
      <span><strong>Live beta.</strong> Signals, feed health and bills use official APH feeds, with source links on aph.gov.au. Thread clustering is Parliament Pulse's own derived analysis. Empty sitting-day panels mean this app has no records to display; check the linked APH source for current proceedings. </span>
      <button aria-label="Dismiss notice" onClick={() => { safeSetLocalStorage(key, "1"); setVisible(false); }}>×</button>
    </div>
  );
}

function EmptyState({ icon = "signal", kicker = "Empty", children, action, variant = "default" }) {
  return (
    <div className={"empty-state" + (variant === "error" ? " error" : "")}>
      <Icon name={icon} size={15} stroke={variant === "error" ? "var(--caution)" : "var(--ink-4)"} />
      <div>
        <div className="empty-kicker">{kicker}</div>
        <div className="empty-body">{children}</div>
      </div>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="g-live-event" style={{display:"grid", gap:10, padding:"12px 8px", borderBottom:"1px solid var(--line)", alignItems:"start"}}>
      <span className="skeleton" style={{height:12, width:36}}/>
      <span className="skeleton" style={{height:14, width:14, borderRadius:"50%"}}/>
      <div>
        <span className="skeleton" style={{height:13, width:"80%", marginBottom:7}}/>
        <span className="skeleton" style={{height:10, width:"45%"}}/>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="signal" aria-hidden="true">
      <span className="skeleton" style={{height:10, width:86, marginBottom:12}}/>
      <span className="skeleton" style={{height:18, width:"72%", marginBottom:10}}/>
      <span className="skeleton" style={{height:13, width:"92%", marginBottom:7}}/>
      <span className="skeleton" style={{height:13, width:"56%"}}/>
    </div>
  );
}

// Loading placeholder for tabular desks (Sources, Bills) while /state resolves.
// A header bar plus N rows of three bars (30% / 45% / 15%), inside a .panel.
function SkeletonTable({ rows = 5 }) {
  return (
    <div className="panel" aria-hidden="true">
      <span className="skeleton" style={{height:14, width:180, marginBottom:16}}/>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{display:"grid", gridTemplateColumns:"30% 45% 15%", gap:12, padding:"10px 0", borderBottom: i < rows - 1 ? "1px solid var(--line)" : 0, alignItems:"center"}}>
          <span className="skeleton" style={{height:12, width:"100%"}}/>
          <span className="skeleton" style={{height:12, width:"100%"}}/>
          <span className="skeleton" style={{height:12, width:"100%"}}/>
        </div>
      ))}
    </div>
  );
}

// Data-age formatter for the topbar manual-refresh affordance. Accepts a ms epoch
// (the store's liveState.fetchedAt) or an ISO string, returning "now" under 60s,
// "{n}m" under 60m, else "{h}h". A missing timestamp reads as an em-dash so the
// topbar never claims a freshness it cannot prove.
function fmtDataAge(fetchedAt) {
  if (fetchedAt == null) return NO_VALUE;
  const t = typeof fetchedAt === "number" ? fetchedAt : Date.parse(fetchedAt);
  if (!t || Number.isNaN(t)) return NO_VALUE;
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + "m";
  return Math.floor(mins / 60) + "h";
}

// NAV carries no count literals (UX-02): every badge is computed in Sidebar from
// selectCounts() over the /state cache, and a desk with no live or derived block
// shows no badge at all.
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
  { id: "about", label: "About the data", group: "Workspace" },
];

// UX-16: the Live parliament nav badge follows the real freshness state (FE-05)
// instead of a permanent red LIVE. "live" when a /state cache is loaded and the
// Worker's poll is fresh, "stale" when the poll has stalled, "offline" when the
// /state fetch failed and nothing has loaded, null (no badge) while loading.
const LIVE_NAV_LABELS = { live: "Live", stale: "Stale", offline: "Offline" };
function liveNavState(liveState, fresh) {
  const ls = liveState || {};
  if (ls.status === "error" && !ls.blocks) return "offline";
  if (!ls.blocks) return null;
  if (fresh && fresh.known && fresh.stale) return "stale";
  return "live";
}

const ICONS = {
  overview: "overview", radar: "radar", committees: "committee", bills: "bill",
  parliament: "parliament", patterns: "pattern", briefings: "brief",
  watchlists: "watch", sources: "sources", live: "signal", signals: "signal",
  about: "book",
};

function Sidebar({ page, onNavigate, mobileOpen }) {
  const { state, liveState } = useStore();
  // Every badge reads the shared selectCounts() (store.jsx), the same source the
  // Overview tiles and the About ledger use. null means the desk has no live or
  // derived block with rows, and renders no badge (UX-02).
  const counts = useCounts();
  // Same real health signal the topbar's LIVE DATA UNAVAILABLE chip reads (see
  // Topbar's noLiveCache): the /state fetch errored and nothing has ever loaded,
  // so every desk shows its honest empty state. Driving this block from that
  // shared signal means it can never show "configured" while the topbar is
  // simultaneously showing an outage.
  const noLiveCache = !!(liveState && liveState.status === "error" && !liveState.blocks);
  const liveNav = liveNavState(liveState, useFreshness());
  const navCount = React.useMemo(() => {
    const signalItems = (liveState && liveState.blocks && liveState.blocks.signals && liveState.blocks.signals.items) || null;
    const active = signalItems ? signalItems.filter(s => !state.archived[s.id]) : null;
    return {
      overview: null,  /* a dashboard has no unambiguous count; the hero KPI carries the priority number */
      live: null,
      signals: active ? active.length : null,
      // The desk tallies live signals by source group, so its badge is the group count.
      radar: active ? new Set(active.map(s => s.sourceGroup || "Other")).size : null,
      committees: counts.committees,
      bills: counts.bills,
      parliament: counts.divisions,
      patterns: counts.threads,
      // The user's own briefs and watchlist configuration are real local counts.
      briefings: BRIEFING_QUEUE.length + Object.keys(state.briefsGenerated || {}).length,
      watchlists: WATCHLISTS.length + (state.watchlistCreated || []).length,
      sources: null,  /* the Sources page states feed health plainly */
      about: null,    /* reference material, not a live count */
    };
  }, [counts, liveState, state.archived, state.briefsGenerated, state.watchlistCreated]);
  const groups = [...new Set(NAV.map(n => n.group))];
  return (
    <aside className={"side" + (mobileOpen ? " mobile-open" : "")}>
      <div className="brand">
        <div className="brand-mark">
          <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
            {/* Prometheus flame — stylised, institutional */}
            <path d="M11 2 C 7 5, 6 9, 8 12 C 5 11, 4 13, 5 15 C 6 17, 9 18, 11 18 C 13 18, 16 17, 17 15 C 18 13, 17 11, 14 12 C 16 9, 15 5, 11 2 Z" fill="url(#flame)" opacity="0.95"/>
            <path d="M11 6 C 9 8, 9 11, 11 13 C 13 11, 13 8, 11 6 Z" fill="#fff" opacity="0.88"/>
            <defs>
              <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brass-2)"/>
                <stop offset="100%" stopColor="var(--brass)"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:7}}>
            <div className="brand-name">Parliament Pulse</div>
            <span className="chip-fixture" style={{verticalAlign:"middle"}}>Beta</span>
          </div>
          <div className="brand-sub">Prometheus Policy Lab</div>
        </div>
      </div>
      <nav id="main-navigation" className="nav" aria-label="Main navigation">
        {groups.map(g => (
          <div key={g}>
            <div className="nav-group">{g}</div>
            {NAV.filter(n => n.group === g).map(n => (
              <div
                key={n.id}
                className={"nav-item" + (page === n.id ? " active" : "")}
                onClick={() => onNavigate(n.id)}
                role="button" tabIndex={0}
                aria-current={page === n.id ? "page" : undefined}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(n.id); } }}
              >
                <Icon name={ICONS[n.id]} size={15} className="ico" />
                <span>{n.label}</span>
                {n.live && liveNav && <span className="count nav-live" data-live-state={liveNav} title={liveNav === "live" ? "APH feeds polled recently" : liveNav === "stale" ? "The APH feed poll has stalled; items may be out of date" : "Live data is unavailable"}>{LIVE_NAV_LABELS[liveNav]}</span>}
                {!n.live && typeof navCount[n.id] === "number" && navCount[n.id] > 0 && <span className="count" data-nav-count={n.id}>{navCount[n.id]}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-status" role="group" aria-label="System status">
        {noLiveCache ? (
          <>
            <div className="side-status-head">
              <span className="dot" style={{background:"var(--caution)", boxShadow:"none"}}/>
              <span>Live data unavailable</span>
            </div>
            <div>The official APH feeds did not respond at the last check, so each desk says what is missing instead of showing invented data. See Sources for feed health.</div>
          </>
        ) : (
          <>
            <div className="side-status-head">
              <span className="dot" style={{background:"var(--ok)", boxShadow:"none"}}/>
              <span>Official feeds connected</span>
            </div>
            <div>Parliament Pulse reads the official APH feeds. Each feed's health is on Sources.</div>
          </>
        )}
      </div>
      <div className="side-foot">
        <div style={{lineHeight:1.2}}>
          <div style={{fontFamily:"var(--mono)", fontSize:"var(--t-micro)", color:"var(--ink-4)"}}>Prometheus Policy Lab · free beta</div>
        </div>
      </div>
    </aside>
  );
}

// FE-10 (A11Y-05, WCAG 2.1.4): the single-character shortcuts (j, k, b, w, a)
// can be turned off here, and the choice is kept in pp-shortcuts. They never
// fire while focus is in a text field or with Ctrl, Cmd or Alt held, so Ctrl+A
// selects text and never archives. Esc and Ctrl+K are not single-character
// shortcuts and always work.
const SHORTCUTS_KEY = "pp-shortcuts";
function singleKeyShortcutsOn() {
  return safeGetLocalStorage(SHORTCUTS_KEY) !== "off";
}
// True when a keydown must not trigger a single-character shortcut.
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
    [IS_MAC ? "⌘K" : "Ctrl+K", "Focus global search"],
  ];
  const onToggle = e => {
    const on = e.target.checked;
    setEnabled(on);
    safeSetLocalStorage(SHORTCUTS_KEY, on ? "on" : "off");
  };
  return (
    <div style={{position:"relative"}}>
      <button className="btn ghost sm" title="Keyboard shortcuts" onClick={() => setOpen(o => !o)} aria-label="Keyboard shortcuts and settings" aria-expanded={open}>
        <Icon name="pattern" size={13} />
      </button>
      {open && (
        <div style={{position:"absolute", top:"calc(100% + 8px)", right:0, background:"var(--panel-2)", border:"1px solid var(--line-bright)", borderRadius:"var(--r-md)", boxShadow:"var(--elev-2)", zIndex:40, width:320, maxWidth:"calc(100vw - 32px)", padding:"12px 14px"}} role="dialog" aria-label="Keyboard shortcuts" data-shortcut-settings="">
          <div className="mono" style={{fontSize:"var(--t-label)", color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginBottom:10}}>Keyboard shortcuts</div>
          <label htmlFor="pp-shortcut-toggle" style={{display:"flex", alignItems:"center", gap:10, padding:"4px 0 10px", fontSize:"var(--t-body-sm)", color:"var(--ink)", cursor:"pointer", minHeight:24}}>
            <input id="pp-shortcut-toggle" type="checkbox" checked={enabled} onChange={onToggle} data-shortcut-toggle="" style={{width:20, height:20, margin:0, accentColor:"var(--brass)"}} />
            Single-key shortcuts (j, k, b, w, a)
          </label>
          {shortcuts.map(([k, d]) => (
            <div key={k} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid var(--line)", fontSize:"var(--t-body-sm)", opacity: !enabled && k.length <= 5 && /^[a-z]( \/ [a-z])?$/.test(k) ? .55 : 1}}>
              <span style={{color:"var(--ink-2)"}}>{d}</span>
              <kbd style={{fontFamily:"var(--mono)", fontSize:"var(--t-eyebrow)", background:"var(--panel-hi)", border:"1px solid var(--line-2)", borderRadius:4, padding:"2px 7px", color:"var(--brass)", marginLeft:10, whiteSpace:"nowrap"}}>{k}</kbd>
            </div>
          ))}
          <button className="btn ghost sm" style={{marginTop:10}} onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
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

  // Re-render the data-age label periodically so it keeps counting up between
  // fetches. The value itself derives from the store's liveState.fetchedAt.
  React.useEffect(() => {
    const id = setInterval(() => setAgeTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const live = liveState || {};
  const dataAge = fmtDataAge(live.fetchedAt);
  const isRefreshing = !!live.isRefreshing;
  // "No cache at all": the /state fetch errored and nothing has ever loaded, so
  // every desk is on its representative fixture. This is an honest, visible chip.
  const noLiveCache = live.status === "error" && !live.blocks;
  // Ingest freshness (FE-05, DATA-07): the Worker's own poll clock. A stalled
  // cron flips the chip to Stale and raises the ribbon, so a dead poller can
  // never sit under a Live chip. An older Worker serves no freshness fields and
  // the topbar then behaves exactly as before.
  const fresh = useFreshness();
  const pollStalled = !noLiveCache && fresh.stale;
  const feedCount = useFeedCount();

  const handleLiveRefresh = React.useCallback(() => {
    const ageAtClick = fmtDataAge((liveState || {}).fetchedAt);
    if (typeof refreshLiveState === "function") {
      Promise.resolve(refreshLiveState()).catch(() => {
        const msg = ageAtClick === NO_VALUE
          ? "Live refresh failed - live data is unavailable"
          : `Live refresh failed - showing data from ${ageAtClick} ago`;
        toast(msg, "error");
      });
      return;
    }
    // Fallback path while the store refresh API is landing: nudge the Live page.
    requestLiveRefresh();
    navigate("live");
    if (window.__refreshLiveFeeds) { consumeLiveRefresh(); window.__refreshLiveFeeds(); toast("Refreshing live feeds..."); }
    else toast("Opening Live page to refresh feeds", "brass");
  }, [liveState, refreshLiveState, requestLiveRefresh, consumeLiveRefresh, navigate, toast]);

  React.useEffect(() => {
    const h = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ref.current?.focus(); }
      if (e.key === "Escape") {
        if (modal || signalId) return;
        const inResults = !!(searchRef.current && searchRef.current.contains(document.activeElement) && document.activeElement !== ref.current);
        if (open) { e.preventDefault(); setOpen(false); if (inResults) ref.current?.focus(); else ref.current?.blur(); return; }
        ref.current?.blur();
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

  // Search the signals the user actually sees: live items when the /state block is
  // live, else the fixtures (mirrors the Signal inbox source of truth).
  const liveSignals = useLiveState("signals");
  // Whole-cache staleness read from the shared liveState (fetchedAt older than 30 min
  // with a good cache present). It is false while data is fresh and false while no
  // cache has ever landed, so the slim stale banner below and the LIVE DATA
  // UNAVAILABLE chip can never show at the same time. The explicit && !noLiveCache
  // documents that mutual exclusion at the call site.
  const liveStale = liveSignals.liveStale && !noLiveCache;
  // FE-06 (UX-08, DATA-14): bills are the live /bills rows from the shared
  // liveBills cache in store.jsx (the same rows PageBills renders), and every
  // group label states its real scope. No member group: no member source exists.
  const liveBills = useLiveBills();
  const results = React.useMemo(() => buildSearchResults(q, {
    signals: liveSignals.items || SIGNALS,
    liveSignals: !!liveSignals.items,
    bills: liveBills.items,
    committees: Object.values(ENTITIES.committees),
    feeds: APH_FEEDS,
  }), [q, liveSignals.items, liveBills.items]);

  // FE-10 (A11Y-01, A11Y-02): the results are rows of real buttons and links.
  // The old listbox put an APH source link inside each role="option" (nested
  // interactive) and selected with onMouseDown only. Now each row has one
  // button that opens the item in Parliament Pulse and, for a live APH title,
  // a separate link to the source (the licence rule: a live title renders only
  // inside its APH link). ArrowDown from the field moves focus into the
  // results, ArrowUp and ArrowDown move between them, Esc returns to the field.
  const selectItem = (act) => { act(); setOpen(false); setQ(""); };
  const resultsRef = React.useRef(null);
  const focusResult = (dir) => {
    const list = resultsRef.current ? [...resultsRef.current.querySelectorAll("[data-sr-focus]")] : [];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    if (dir > 0) list[Math.min(i + 1, list.length - 1)].focus();
    else if (i <= 0) ref.current?.focus();
    else list[i - 1].focus();
  };
  const onKeyDown = (e) => {
    if (!open || !results) return;
    if (e.key === "ArrowDown") { e.preventDefault(); focusResult(1); return; }
    if (e.key === "Escape")    { setOpen(false); ref.current?.blur(); return; }
  };
  const onResultsKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); focusResult(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusResult(-1); }
  };
  // Close the panel when focus leaves the whole search region (Tab past the end).
  const onSearchBlur = (e) => {
    const next = e.relatedTarget;
    if (next && searchRef.current && searchRef.current.contains(next)) return;
    if (next) setOpen(false);
  };

  // One row. link: a live APH title renders inside its source link and the row
  // gets a separate Open button; without one the whole row is the button.
  const row = ({ key, k, title, link, openLabel, act, extra }) => (
    <li key={key} className="sr-item" {...(extra || {})}>
      {link ? (
        <>
          <span className="k">{k}</span>
          <a className="sr-title" href={link} target="_blank" rel="noopener noreferrer" style={{color:"inherit", textDecoration:"none"}} title="Open the source at aph.gov.au">{title}</a>
          <button type="button" className="sr-open sr-open-short" data-sr-focus="" aria-label={openLabel} onClick={() => selectItem(act)}>Open</button>
        </>
      ) : (
        <button type="button" className="sr-open" data-sr-focus="" onClick={() => selectItem(act)}>
          <span className="k">{k}</span><span className="sr-title">{title}</span>
        </button>
      )}
    </li>
  );
  return (
    <>
    <div className="topbar">
      <button
        className="btn ghost sm nav-toggle"
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
        aria-controls="main-navigation"
        onClick={() => setMobileNavOpen(open => !open)}
      >
        <Icon name="menu" size={15} />
      </button>
      <div ref={searchRef} className={"search" + (focused ? " focused" : "")} onBlur={onSearchBlur}
        style={focused ? {borderColor:"var(--brass)", boxShadow:"0 0 0 3px var(--brass-soft)"} : undefined}>
        <Icon name="search" size={14} stroke={focused ? "var(--brass)" : "var(--ink-3)"} />
        <input ref={ref} value={q}
          onClick={() => setOpen(true)}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setFocused(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          aria-label="Search parliament signals, bills, committees and feeds"
          aria-controls={open && results ? "search-listbox" : undefined}
          placeholder="Search signals, bills, committees, feeds…" />
        {q ? (
          <button onClick={() => { setQ(""); setOpen(false); ref.current?.focus(); }}
            aria-label="Clear search" title="Clear search"
            style={{background:"none", border:"none", cursor:"pointer", padding:0, minWidth:24, minHeight:24, color:"var(--ink-3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
            <Icon name="close" size={12} />
          </button>
        ) : (
          <span className="kbd">{IS_MAC ? "⌘K" : "Ctrl+K"}</span>
        )}
        {open && results && (
          <div id="search-listbox" ref={resultsRef} className="search-results" role="region" aria-label="Search results" onKeyDown={onResultsKeyDown}>
            {results.sig.length > 0 && <>
              <div className="sr-group" data-sr-group="signals">{results.labels.sig} · {results.sig.length} match{results.sig.length !== 1 ? "es" : ""}</div>
              <ul className="sr-list">
                {results.sig.slice(0,4).map(s => row({
                  key: s.id, k: s.isLive ? s.source : s.id,
                  title: s.isLive && !s.link ? s.source : s.title,
                  link: s.isLive && s.link ? s.link : null,
                  openLabel: `Open ${s.title} in Parliament Pulse`,
                  act: () => openSignal(s.id),
                }))}
                {results.sig.length > 4 && row({ key: "signals-all", k: "All", title: `See all ${results.sig.length} signals`, act: () => { setSignalSearchQuery(q); navigate("signals"); } })}
              </ul>
            </>}
            {results.bills.length > 0 && <>
              <div className="sr-group" data-sr-group="bills">{results.labels.bills} · {results.bills.length} match{results.bills.length !== 1 ? "es" : ""}</div>
              <ul className="sr-list">
                {results.bills.slice(0,4).map(b => {
                  // Licence rule: a live APH bill title renders only inside an anchor to its APH link.
                  const link = safeHttpUrl(b.link);
                  return row({
                    key: b.guid, k: "Bill", title: link ? b.title : "Bills Digest item", link,
                    openLabel: `Open ${b.title} in Bills intelligence`,
                    act: () => navigate("bills"), extra: { "data-sr-bill": "" },
                  });
                })}
              </ul>
            </>}
            {results.comm.length > 0 && <>
              <div className="sr-group" data-sr-group="committees">{results.labels.comm} · {results.comm.length} match{results.comm.length !== 1 ? "es" : ""}</div>
              <ul className="sr-list">
                {results.comm.map(c => row({ key: c.id, k: c.chamber, title: c.name, act: () => openModal("committee", c.id) }))}
              </ul>
            </>}
            {results.feeds.length > 0 && <>
              <div className="sr-group" data-sr-group="sources">{results.labels.feeds} · {results.feeds.length} match{results.feeds.length !== 1 ? "es" : ""}</div>
              <ul className="sr-list">
                {results.feeds.slice(0,4).map(f => row({ key: f.id, k: f.group, title: f.name, act: () => openModal("feed", f.id) }))}
              </ul>
            </>}
            {q && !results.sig.length && !results.bills.length && !results.comm.length && !results.feeds.length && (
              <div className="sr-item" role="status" style={{color:"var(--ink-4)"}}>No matches for "{q}"</div>
            )}
          </div>
        )}
      </div>
      <div className="top-right">
        <TopClock />
        {noLiveCache ? (
          <button type="button" className="chip warn" onClick={() => navigate("live")} title="Live APH feeds did not respond. Each desk shows an honest empty state rather than invented data; open Live for feed health." style={{borderColor:"color-mix(in srgb, var(--caution) 55%, transparent)", color:"var(--caution)", background:"transparent", cursor:"pointer"}}>
            <span className="dot" style={{background:"var(--caution)", boxShadow:"none"}}/> LIVE DATA UNAVAILABLE
          </button>
        ) : pollStalled ? (
          <button type="button" className="chip warn" data-live-chip="stale" onClick={() => navigate("sources")} title={fresh.stallText} style={{borderColor:"color-mix(in srgb, var(--caution) 55%, transparent)", color:"var(--caution)", background:"transparent", cursor:"pointer"}}>
            <span className="dot" style={{background:"var(--caution)", boxShadow:"none"}}/> Stale · polling stalled
          </button>
        ) : (
          <button type="button" className="chip clk" data-live-chip="live" onClick={() => navigate("live")} title={feedCount != null ? `${feedCount} official APH feeds polled by the Parliament Pulse service` : "Official APH feeds; the Live page reads them directly"} style={{borderColor:"color-mix(in srgb, var(--gold) 55%, transparent)", color:"var(--gold)", background:"transparent"}}>
            <span className="dot" style={{background:"var(--gold)", boxShadow:"none"}}/> Live beta{feedCount != null ? <span className="tb-feeds">{` · ${feedCount} feeds`}</span> : ""}
          </button>
        )}
        {fresh.known && !noLiveCache && (
          <span className="mono top-poll" data-poll-line="" title={fresh.stallText || "When Parliament Pulse last checked the APH feeds"} style={{fontSize:"var(--t-micro)", color: pollStalled ? "var(--caution)" : "var(--ink-3)", letterSpacing:".04em", whiteSpace:"nowrap"}}>{fresh.pollLine}</span>
        )}
        <button className="btn ghost sm" aria-label="Refresh live data" aria-busy={isRefreshing} title={live.fetchedAt ? `Live data fetched ${dataAge} ago. Refresh now.` : "Refresh live data"} onClick={handleLiveRefresh}>
          <Icon name="refresh" size={14} style={isRefreshing ? {animation:"spin 800ms linear infinite"} : undefined} />
          <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", letterSpacing:".04em", marginLeft:6, fontVariantNumeric:"tabular-nums"}}>{dataAge}</span>
        </button>
        <button className="btn ghost sm" title="Show current priority count" aria-label="Alerts" onClick={() => {
          const source = liveSignals.items || SIGNALS;
          const count = source.filter(s => s.attention === "high").length;
          toast(source.length === 0 ? "Live data is unavailable, so there are no signals to review" : `${count} priority signals currently need review`, "brass");
        }}><Icon name="bell" size={14} /></button>
        <button className="btn primary sm" onClick={() => navigate("briefings")}><Icon name="plus" size={13} /> New brief</button>
        <ShortcutHelp />
        <button className="btn ghost sm" title={isDark ? "Switch to light mode" : "Switch to dark mode"} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => {
          const next = isDark ? "light" : "dark";
          document.documentElement.dataset.theme = next;
          safeSetLocalStorage("pp-theme", next);
          setIsDark(!isDark);
        }}><Icon name={isDark ? "sun" : "moon"} size={13} /></button>
      </div>
    </div>
    {/* Slim honest staleness ribbon: only when a good cache exists and is older than
        30 min. Never shows for fresh data, and never when there is no cache (that
        state is carried by the LIVE DATA UNAVAILABLE chip above). Carries the same
        refresh affordance as the topbar plus a route to the Live page. */}
    {(liveStale || pollStalled) && (
      <div className="stale-banner" role="status" data-stale-reason={pollStalled ? "poll" : "cache"} style={{
        display:"flex", alignItems:"center", gap:10, padding:"7px 16px",
        fontSize:"var(--t-body-sm)", color:"var(--ink-2)", background:"var(--panel-2)",
        borderBottom:"1px solid var(--line)", boxShadow:"inset 3px 0 0 var(--caution)"
      }}>
        <Icon name="refresh" size={13} stroke="var(--caution)" />
        <span>{pollStalled ? fresh.stallText + ". Items shown may be out of date; check the linked APH source." : "Live data is over 30 minutes old. Refresh, or see the Live page."}</span>
        <div style={{marginLeft:"auto", display:"flex", gap:8, alignItems:"center", flexShrink:0}}>
          <button className="btn ghost sm" aria-label="Refresh live data" aria-busy={isRefreshing}
            title={live.fetchedAt ? `Live data fetched ${dataAge} ago. Refresh now.` : "Refresh live data"}
            onClick={handleLiveRefresh}>
            <Icon name="refresh" size={13} style={isRefreshing ? {animation:"spin 800ms linear infinite"} : undefined} /> Refresh
          </button>
          <button className="btn ghost sm" onClick={() => navigate("live")}>Live page</button>
        </div>
      </div>
    )}
    </>
  );
}

// Provenance chip: the mechanical honesty label for a /state data block.
// provenance is one of the state-v1 contract values (live | derived | fixture)
// — the label and colour come entirely from that value, so a caller can never
// hand-place a "Live" chip over data the contract itself has not vouched for.
// Reuses .chip-fixture (the existing Representative-data chip) as its base
// shape; live/derived only add a colour modifier.
function ProvenanceChip({ provenance, title }) {
  // FE-04: no fixture content ships any more, so a block with no usable rows is
  // labelled for what the viewer actually sees: no live data.
  const LABELS = { live: "Live", derived: "Derived", fixture: "No live data" };
  const key = LABELS[provenance] ? provenance : "fixture";
  const cls = "chip-fixture" + (key === "live" ? " chip-live" : key === "derived" ? " chip-derived" : "");
  return <span className={cls} title={title}>{LABELS[key]}</span>;
}

function Att({ level, disclosure }) {
  const map = { high: "High", med: "Medium", low: "Low" };
  // PR-11: every attention value carries the same short disclosure as its tooltip.
  const tip = disclosure || attentionDisclosure();
  // An absent attention value renders as an em-dash, never a fabricated tier.
  if (!map[level]) return <span className="att" title={`Attention not scored. ${tip}`}><span aria-hidden="true">{NO_VALUE}</span><span className="sr-only">Attention not scored</span></span>;
  return <span className={"att " + level} title={tip} data-att-disclosure="">{map[level]}</span>;
}

// UX-03: confidence reads "Confidence n of 5" in words, never a bare number or a
// segmented bar that implies more precision than a kind-based rule carries.
function Conf({ n }) {
  return <span className="conf-text mono" data-conf="" style={{fontSize:"var(--t-caption)", color:"var(--ink-3)", whiteSpace:"nowrap"}}>{confidenceLabel(n)}</span>;
}

function buildBriefSections(s, isLive = false) {
  const evidence = (s.evidence || []).map(e => ({ label: e.label, url: e.url }));
  const provParts = [
    `Signal ID: ${s.id}`,
    isLive ? confidenceLabel(s.confidence) : `Representative ${confidenceLabel(s.confidence).toLowerCase()}`,
  ];
  if (s.humanReview) provParts.push(`Review status: ${s.humanReview}`);
  // Only a non-live example carries a workflow-trace disclaimer; a live item's
  // provenance line states only what is true of it.
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
      humanReview: s.humanReview,
    },
    summary: s.summary,
    whyItMatters: s.attentionReason,
    // UX-03: no recommended action exists for a live item (action is ""), so the
    // brief carries none rather than an empty heading.
    recommendedAction: s.action ? { label: s.action, reason: s.actionReason || "" } : null,
    evidence,
    provenance: provParts.join(" | "),
  };
}

// hideAtt / hideConf (UX-03): the Signal inbox passes these when every signal in
// view shares one attention or confidence value, and states that once above the
// list instead of repeating a value that separates nothing on every card.
function SignalCard({ s, hideAtt = false, hideConf = false }) {
  const { openSignal, state, isWatched } = useStore();
  const archived = !!state.archived[s.id];
  const feedback = state.feedback[s.id];
  const watched = isWatched(s.id);
  return <SignalCardView s={s} archived={archived} feedback={feedback} watched={watched} openSignal={openSignal} hideAtt={hideAtt} hideConf={hideConf} />;
}

// FE-10 (A11Y-02): a card is an <article> named by its title, with one Open
// button (named "Open <title>") and, for a live item, a separate source link.
// The old card was a role="button" named "Open signal detail" on all 30 cards,
// with the source link nested inside it. The Open button's ::after stretches
// over the card (index.html), so a click anywhere on it still opens the drawer.
const SignalCardView = React.memo(function SignalCardView({ s, archived, feedback, watched, openSignal, hideAtt, hideConf }) {
  const titleId = "sig-t-" + React.useId().replace(/:/g, "");
  if (archived) return null;
  const name = s.title || s.source || "signal";
  return (
    <article className="signal" data-att={s.attention} aria-labelledby={titleId} data-signal-id={s.id}>
      <div className="sig-head">
        <span className="sig-id mono">{s.isLive || /^https?:/.test(s.id) ? "APH" : s.id}</span>
        <span className="sig-source mono">· {s.source}</span>
        {!hideAtt && <Att level={s.attention} />}
        {watched && <span className="tag brass">Watching</span>}
        <span className="sig-time mono" data-sig-when="">{signalWhen(s)}</span>
      </div>
      {/* Licence rule: a live APH title renders only inside an anchor to its APH link.
          A live row with no valid link shows the source label, never the bare title.
          Fixture rows keep their plain title. */}
      <h3 className="sig-title serif" id={titleId}>{s.link
        ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{color:"inherit", textDecoration:"none"}} title="Open the source at aph.gov.au">{s.title} <Icon name="ext" size={12} style={{verticalAlign:"-1px", opacity:.6}}/></a>
        : (s.isLive ? s.source : s.title)}</h3>
      <div className="sig-sum">{s.summary.length > 120 ? s.summary.slice(0, 120).replace(/\s\S+$/, "") + "…" : s.summary}</div>
      <div className="sig-tags">
        {s.tags.map((t, i) => <span key={i} className={"tag " + (t.c || "")}>{t.l}</span>)}
      </div>
      <div className="sig-action">
        {s.action
          ? <><span className="sig-action-label">Recommended</span><span className="sig-action-value">{s.action}</span></>
          : <span className="sig-action-label">Open to triage</span>}
        {!hideConf && <span className="mono" data-conf="" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", letterSpacing:".04em", whiteSpace:"nowrap"}}>{confidenceLabel(s.confidence)}</span>}
        <button type="button" className="sig-open" aria-label={"Open " + name} onClick={() => openSignal(s.id)}>Open</button>
      </div>
      {feedback && (
        <div style={{marginTop:8, fontSize:"var(--t-caption)", color:"var(--brass)"}}>
          <Icon name="check" size={12} style={{verticalAlign:"-2px", marginRight:4}}/> Feedback: {feedback.label}
        </div>
      )}
      {watched && (
        <div style={{marginTop:8, fontSize:"var(--t-caption)", color:"var(--brass)"}}>
          <Icon name="watch" size={12} style={{verticalAlign:"-2px", marginRight:4}}/> On watchlist
        </div>
      )}
    </article>
  );
});

function generateBriefMarkdown(s, isLive = false) {
  const brief = buildBriefSections(s, isLive);
  const evidence = brief.evidence.map(e => `- [${e.label}](${e.url})`).join("\n");
  // A live APH title is exported as a markdown link to its source; a fixture title
  // is exported as plain text; a live title with no valid link falls back to the
  // source label so verbatim APH prose is never emitted as standalone heading text.
  const titleMd = brief.isLive ? (brief.link ? `[${brief.title}](${brief.link})` : brief.meta.source) : brief.title;
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
    ...(brief.recommendedAction ? [
      `## Recommended action`,
      `**${brief.recommendedAction.label}**`,
      brief.recommendedAction.reason,
      ``,
    ] : []),
    `## Evidence`,
    evidence || "_No evidence links recorded._",
    ``,
    `## Provenance`,
    brief.provenance,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `---`,
    APH_ATTRIBUTION,
  ].join("\n");
}

function Drawer() {
  const { signalId, openSignal, closeSignal, state, modal, openModal, saveFeedback, archive, addWatchlist, isWatched, saveNote, generateBrief, toast, visibleSignalOrder, navigate } = useStore();
  // Live signals come from the shared hook, not the store (the old store.liveSignals
  // was removed in the useLiveState refactor). A clicked row's id is a fixture
  // SIGNALS.id OR a Worker guid, never both, so this is a straightforward either/or.
  const liveSignals = useLiveState("signals");
  const fixtureSignal = React.useMemo(() => SIGNALS.find(s => s.id === signalId), [signalId]);
  const liveSignal = React.useMemo(() => (liveSignals.items || []).find(s => s.id === signalId), [signalId, liveSignals.items]);
  const signal = fixtureSignal || liveSignal;
  const [fb, setFb] = React.useState(null);
  const [note, setNote] = React.useState("");
  const [noteSaved, setNoteSaved] = React.useState(false);
  // F12: keep the live note text and the signal it belongs to in refs so we can flush it
  // to the store on drawer close and before j/k navigation, not only on textarea blur.
  const noteRef = React.useRef("");
  const noteSigRef = React.useRef(null);
  const noteSavedTimerRef = React.useRef(null);
  React.useEffect(() => { noteRef.current = note; }, [note]);
  React.useEffect(() => { noteSigRef.current = signalId; }, [signalId]);
  // Invariant: flushNote must run before close/navigation, while the reset effect below only runs on signalId changes so it cannot erase unsaved typing during unrelated store updates.
  const flushNote = React.useCallback(() => {
    const sid = noteSigRef.current;
    if (sid && noteRef.current !== (state.notes[sid] || "")) {
      saveNote(sid, noteRef.current);
      setNoteSaved(true);
      clearTimeout(noteSavedTimerRef.current);
      noteSavedTimerRef.current = setTimeout(() => setNoteSaved(false), 1600);
    }
  }, [saveNote, state.notes]);
  const closeWithFlush = React.useCallback(() => { flushNote(); closeSignal(); }, [flushNote, closeSignal]);
  const sigIdxRef = React.useRef(0);
  const drawerBodyRef = React.useRef(null);
  const prevFocusRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);

  // Visible signals (non-archived) — computed early so keyboard deps can reference it.
  // Includes live items so j/k, archive-advance and the position indicator keep working
  // when the inbox is showing the live /state block instead of the fixture.
  const visibleSigs = React.useMemo(() => {
    const known = liveSignals?.items ? [...SIGNALS, ...liveSignals.items] : SIGNALS;
    const fallback = known.filter(x => !state.archived[x.id]);
    if (!Array.isArray(visibleSignalOrder) || visibleSignalOrder.length === 0) return fallback;
    const byId = new Map(known.map(x => [x.id, x]));
    const ordered = visibleSignalOrder.map(id => byId.get(id)).filter(x => x && !state.archived[x.id]);
    return ordered.length ? ordered : fallback;
  }, [visibleSignalOrder, state.archived, liveSignals]);

  // Sync index ref and scroll drawer to top when signal changes
  React.useEffect(() => {
    const idx = visibleSigs.findIndex(s => s.id === signalId);
    if (idx !== -1) sigIdxRef.current = idx;
    if (drawerBodyRef.current) drawerBodyRef.current.scrollTop = 0;
  }, [signalId, visibleSigs]);

  // Focus management: save trigger element, move focus into drawer, restore on close
  React.useEffect(() => {
    if (signalId) {
      // Keep the element that opened the drawer: j and k move between signals
      // inside the open drawer and must not replace it with the drawer's own button.
      const active = document.activeElement;
      if (!prevFocusRef.current && !(active && active.closest && active.closest("aside.drawer"))) prevFocusRef.current = active;
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    } else if (prevFocusRef.current) {
      const back = prevFocusRef.current;
      prevFocusRef.current = null;
      // The opener can leave the page (an archived card); focus it only if it is still there.
      if (back.isConnected) back.focus();
    }
  }, [signalId]);

  // Tab trap inside drawer
  React.useEffect(() => {
    if (!signalId) return;
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const drawerEl = closeButtonRef.current?.closest("aside.drawer");
      if (!drawerEl) return;
      const focusable = Array.from(drawerEl.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter(el => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [signalId]);

  React.useEffect(() => {
    setFb(state.feedback[signalId]?.label || null);
  }, [signalId, state.feedback]);

  // Note only resets on signal navigation — intentionally excludes state.notes so that
  // concurrent state updates (e.g. archiving a different signal) cannot wipe in-progress typing.
  React.useEffect(() => {
    setNote(state.notes[signalId] || "");
    setNoteSaved(false);
  }, [signalId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation: j/k to navigate, Escape to close, b to brief, w to watchlist
  React.useEffect(() => {
    const handler = (e) => {
      if (modal) return; // disable when detail modal is open
      if (e.key === "Escape" && signalId) { e.preventDefault(); flushNote(); closeSignal(); return; }
      // FE-10 (A11Y-05): every single-character shortcut below is off when the
      // reader turned them off, while focus is in a text field, and whenever
      // Ctrl, Cmd or Alt is held (so Ctrl+A selects text and never archives).
      if (shortcutBlocked(e)) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const cur = visibleSigs.findIndex(s => s.id === signalId);
        const next = e.key === "j"
          ? Math.min(cur + 1, visibleSigs.length - 1)
          : Math.max(cur - 1, 0);
        if (visibleSigs[next] && visibleSigs[next].id !== signalId) {
          // Reveal the target card if it sits past the inbox render cap so it exists
          // in the DOM before focus moves to it. pages.jsx owns the render cap and
          // self-gates: a target already within the cap is a no-op, so this only
          // grows the list when the cursor moves beyond what is currently rendered.
          if (typeof window.ppBumpRenderCap === "function") window.ppBumpRenderCap(next);
          flushNote();
          openSignal(visibleSigs[next].id);
        }
      }
      if (e.key === "b" && signalId) {
        e.preventDefault();
        const s = SIGNALS.find(x => x.id === signalId) || (liveSignals?.items || []).find(x => x.id === signalId);
        if (s) {
          copyToClipboard(generateBriefMarkdown(s, isLive))
            .then(() => { generateBrief(s.id, "Executive brief"); toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") }); })
            .catch(() => toast("Clipboard unavailable, so the brief was not copied", "error"));
        }
      }
      if (e.key === "w" && signalId) {
        e.preventDefault();
        addWatchlist(signalId);
      }
      if (e.key === "a" && signalId) {
        e.preventDefault();
        flushNote();
        const cur = visibleSigs.findIndex(s => s.id === signalId);
        const nextSig = visibleSigs[cur + 1] || visibleSigs[cur - 1];
        archive(signalId);
        if (nextSig) openSignal(nextSig.id); else closeSignal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [signalId, modal, visibleSigs, openSignal, closeSignal, archive, addWatchlist, generateBrief, toast, flushNote, navigate, liveSignals]);

  const on = !!signal;
  const s = signal || {};
  // Provenance of what THIS drawer is showing, not the block-wide fetch state: a fixture
  // row must always keep its fixture chip even while the /state block itself is live.
  const isLive = !fixtureSignal && !!liveSignal;
  const itemProvenance = isLive ? "live" : "fixture";
  const watched = signalId ? isWatched(signalId) : false;
  const labels = ["Correct priority","Too high","Too low","Wrong topic","Wrong portfolio","Duplicate","Noise","Needs human review"];
  const sigPos = visibleSigs.findIndex(x => x.id === signalId);
  return (
    <>
      {/* a11y-exempt: backdrop */}
      <div className={"drawer-back" + (on ? " on" : "")} onClick={closeWithFlush} aria-hidden="true" />
      {/* FE-10: closed, the drawer is hidden (index.html sets visibility) and
          aria-hidden, so it leaves the accessibility tree and the focus order. */}
      <aside className={"drawer" + (on ? " on" : "")} role="dialog" aria-modal="true" aria-label="Signal detail" aria-hidden={on ? undefined : "true"}>
        {on && (
          <>
            <div className="drawer-head">
              <div>
                <div className="mono" style={{fontSize:"var(--t-label)", color:"var(--ink-4)", letterSpacing:".16em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:8}}>
                  <span style={{minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{isLive || /^https?:/.test(s.id || "") ? (s.source || "APH") : s.id} · {s.date}</span>
                  <ProvenanceChip provenance={itemProvenance}
                    title={isLive ? "This item is from an official APH feed" : "This item has no live source"} />
                </div>
                {/* Licence rule: a live APH title renders only inside an anchor to its
                    APH link; a live row with no link shows the source label. Fixture
                    titles render as plain text. */}
                <h2 className="h-drawer" style={{margin:"4px 0 0", maxWidth:460}}>{isLive
                  ? (s.link
                      ? <a href={s.link} target="_blank" rel="noopener noreferrer" style={{color:"inherit"}} title="Open the source at aph.gov.au">{s.title} <Icon name="ext" size={13} style={{verticalAlign:"-1px", opacity:.6}}/></a>
                      : s.source)
                  : s.title}</h2>
              </div>
              <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:12, flexShrink:0}}>
                {sigPos !== -1 && (
                  <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--ink-4)", textAlign:"right", lineHeight:1.3}}>
                    <span style={{display:"block"}}>{sigPos + 1} / {visibleSigs.length}</span>
                    <span style={{fontSize:"var(--t-label)", letterSpacing:".1em"}}>SIGNAL</span>
                  </span>
                )}
                <button ref={closeButtonRef} className="btn ghost sm" aria-label="Close signal detail" onClick={closeWithFlush}><Icon name="close" size={14} /></button>
              </div>
            </div>
            <div className="drawer-body" ref={drawerBodyRef}>
              {/* UX-03: a live item has no recommended action (action is ""), so the
                  section renders only when one exists. */}
              {s.action && (
                <div className="drawer-section">
                  <h3>Recommended action</h3>
                  <div style={{padding:"10px 14px", borderLeft:"3px solid var(--brass)", borderRadius:"0 6px 6px 0", background:"var(--panel-2)"}}>
                    <div style={{fontWeight:600, color:"var(--ink)"}}>{s.action}</div>
                    {s.actionReason && <div style={{color:"var(--ink-2)", fontSize:"var(--t-body-sm)", marginTop:4}}>{s.actionReason}</div>}
                  </div>
                </div>
              )}
              {/* A live item's summary and attentionReason both come from the Worker's single
                  scoring_explanation field (store.jsx mapWorkerSignalToCard). Showing the same
                  sentence twice under two different headings would read as two independent
                  facts when it is one, so a live item with identical text collapses to a
                  single honestly-labelled section instead of duplicating it. */}
              {isLive && s.summary && s.summary === s.attentionReason ? (
                <div className="drawer-section"><h3>Scoring explanation</h3><p>{s.summary || NOT_SUPPLIED}</p></div>
              ) : (
                <>
                  <div className="drawer-section"><h3>Summary</h3><p>{s.summary || NOT_SUPPLIED}</p></div>
                  <div className="drawer-section"><h3>Why it matters</h3><p>{s.attentionReason || NOT_SUPPLIED}</p></div>
                </>
              )}
              <div className="drawer-section">
                <h3>Signal metadata</h3>
                <dl className="kv">
                  <dt>Source</dt><dd>{s.source || NOT_SUPPLIED}</dd>
                  <dt>Source group</dt><dd>{s.sourceGroup || NOT_SUPPLIED}</dd>
                  <dt>Authority</dt><dd>{s.sourceAuthority || NOT_SUPPLIED}</dd>
                  <dt>Attention</dt><dd><Att level={s.attention} /></dd>
                  <dt>Confidence</dt><dd><Conf n={s.confidence} />{!isLive && <span style={{color:"var(--ink-3)", marginLeft:8, fontFamily:"var(--mono)", fontSize:"var(--t-eyebrow)"}}>Representative</span>}</dd>
                  <dt>Human review</dt><dd>{s.humanReview ? `Review status: ${s.humanReview === "Required" ? "Not reviewed · policy officer must verify source links before use" : "Optional for internal triage; required before external distribution"}` : NOT_SUPPLIED}</dd>
                </dl>
              </div>
              {/* FE-04: unsourced surface. Only an example signal carries a score
                  breakdown, and it renders only behind the unsourced-surfaces flag. */}
              {SITE_CONFIG.showUnsourcedSurfaces && !isLive && s.score && (
                <div className="drawer-section">
                  <h3>Attention score breakdown <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:6}}>Sample data</span></h3>
                  <div style={{color:"var(--ink-4)", fontSize:"var(--t-caption)", marginBottom:6}}>Illustrative five-factor breakdown for an example signal, not a computed score.</div>
                  {Object.entries(s.score).map(([k,v]) => {
                    const lab = {authority:"Source authority", portfolio:"Portfolio relevance", novelty:"Novelty", momentum:"Momentum", time:"Time sensitivity", scrutiny:"Scrutiny relevance", ops:"Operational impact"};
                    return (
                      <div key={k} style={{display:"grid", gridTemplateColumns:"160px 1fr 40px", gap:10, alignItems:"center", padding:"4px 0"}}>
                        <div style={{fontSize:"var(--t-body-sm)", color:"var(--ink-2)"}}>{lab[k]}</div>
                        <div className="bar"><div className="fill" style={{width:`${v*100}%`}} /></div>
                        <div className="mono" style={{fontSize:"var(--t-eyebrow)", color:"var(--ink-3)", textAlign:"right"}}>{Math.round(v*100)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="drawer-section">
                <h3>Evidence · open the actual source</h3>
                {s.evidence?.length > 0 ? s.evidence.map((e,i) => (
                  <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" style={{
                    display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                    border:"1px solid var(--line-2)", borderRadius:8, color:"var(--ink)",
                    textDecoration:"none", marginBottom:6, fontSize:"var(--t-body-sm)",
                  }}>
                    <Icon name="link" size={14} stroke="var(--link)" style={{flexShrink:0}} />
                    <span style={{flex:"1 1 auto", minWidth:0}}>{e.label}</span>
                    <span className="mono" style={{color:"var(--ink-4)", fontSize:"var(--t-eyebrow)", marginLeft:"auto", maxWidth:240, minWidth:0, flex:"0 1 auto", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e.url.replace(/^https?:\/\//,"")}</span>
                    <Icon name="ext" size={12} stroke="var(--ink-3)" style={{flexShrink:0}} />
                  </a>
                )) : <div style={{color:"var(--ink-4)", fontSize:"var(--t-body-sm)"}}>No source link recorded for this item.</div>}
              </div>

              {/* FE-04: unsourced surface. Parliament Pulse records no per-signal
                  processing log, so the section renders only behind the flag. */}
              {SITE_CONFIG.showUnsourcedSurfaces && (
              <div className="drawer-section">
                <h3>Processing log</h3>
                {s.provenance && s.provenance.length > 0 ? (
                  <>
                    <div className="chip-fixture" style={{marginBottom:8}}>
                      Illustrative example only, not a production audit log · target workflow shown, not a record of what happened to this item
                    </div>
                    <div style={{border:"1px solid var(--line-2)", borderRadius:8, overflow:"hidden"}}>
                      {s.provenance.map((p,i) => (
                        <div key={i} style={{display:"grid", gridTemplateColumns:"78px 90px 1fr", gap:10, padding:"8px 12px", fontSize:"var(--t-caption)", borderBottom: i<s.provenance.length-1 ? "1px solid var(--line)" : 0, background: i%2 ? "var(--panel-hi)" : "transparent"}}>
                          <div className="mono" style={{color:"var(--ink-4)", fontSize:"var(--t-micro)"}}>{p.ts}</div>
                          <div><span className="tag" style={{fontSize:"var(--t-micro)", padding:"1px 6px"}}>{p.by}</span></div>
                          <div style={{color:"var(--ink-2)"}}>{p.event}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState icon="signal" kicker="No processing log held">
                    Parliament Pulse does not record a per-signal processing log for this item. This section shows one only for illustrative example signals.
                  </EmptyState>
                )}
              </div>
              )}

              {s.updates && s.updates.length > 0 && (
                <div className="drawer-section">
                  <h3>Updates to this signal · who / what / when</h3>
                  {s.updates.map((u,i) => (
                    <div key={i} style={{display:"grid", gridTemplateColumns:"60px 140px 1fr", gap:10, padding:"8px 0", borderBottom: i<s.updates.length-1 ? "1px solid var(--line)" : 0, fontSize:"var(--t-body-sm)"}}>
                      <div className="mono" style={{color:"var(--ink-4)", fontSize:"var(--t-eyebrow)"}}>{u.ts}</div>
                      <div style={{color:"var(--brass)"}}>{u.who}</div>
                      <div style={{color:"var(--ink-2)"}}>{u.what}</div>
                    </div>
                  ))}
                </div>
              )}

              {s.members && s.members.length > 0 && (
                <div className="drawer-section">
                  <h3>People referenced</h3>
                  <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                    {s.members.map(mid => {
                      const m = window.ENTITIES?.members?.[mid];
                      if (!m) return null;
                      return <button type="button" key={mid} className="tag brass clk" onClick={() => openModal("member", mid)}>{m.name}</button>;
                    })}
                  </div>
                </div>
              )}
              <div className="drawer-section">
                <h3>Analyst note {noteSaved && <span className="mono" style={{fontSize:"var(--t-micro)", color:"var(--brass)", marginLeft:8}}>Saved</span>}</h3>
                <textarea value={note} onChange={e=>setNote(e.target.value)} onBlur={flushNote}
                  aria-label="Analyst note for this signal, saved privately in this browser"
                  placeholder="Private notes (auto-saved)" rows={3}
                  style={{width:"100%", background:"var(--panel)", border:"1px solid var(--line-2)", borderRadius:8, color:"var(--ink)", padding:"8px 10px", fontFamily:"var(--sans)", fontSize:"var(--t-body-sm)", resize:"vertical"}}/>
              </div>
              <div className="drawer-section">
                <h3>Analyst feedback · is this right?</h3>
                <div className="feedback-row">
                  {labels.map(l => (
                    <button key={l} className={"fb" + (l === "Correct priority" ? " affirmative" : "") + (fb === l ? " on" : "")} onClick={() => { setFb(l); saveFeedback(s.id, l, ""); }}>
                      {l === "Correct priority" && <Icon name="check" size={12} style={{marginRight:6, verticalAlign:"-2px"}}/>}
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="drawer-foot">
              <button className="btn primary" onClick={() => {
                copyToClipboard(generateBriefMarkdown(s, isLive))
                  .then(() => { generateBrief(s.id, "Executive brief"); toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") }); })
                  .catch(() => toast("Clipboard unavailable, so the brief was not copied", "error"));
              }}><Icon name="brief" size={13} /> Generate brief</button>
              <button className="btn" onClick={() => addWatchlist(s.id)} style={watched ? {borderColor:"var(--brass)", color:"var(--brass)"} : undefined}><Icon name="watch" size={13} /> {watched ? "Watching" : "Watchlist"}</button>
              <button className="btn ghost" onClick={() => {
                flushNote();
                const cur = visibleSigs.findIndex(x => x.id === signalId);
                const nextSig = visibleSigs[cur + 1] || visibleSigs[cur - 1];
                archive(signalId);
                if (nextSig) openSignal(nextSig.id); else closeSignal();
              }}>Archive</button>
              <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeWithFlush}>Close</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// Persistent licence attribution (LEG-03), rendered on every page below the
// content. The sentence is written out literally here (not only via the
// APH_ATTRIBUTION constant) so the release gate can prove the shell carries it;
// tests/attribution-check.mjs fails the build if it goes missing.
function SiteFooter() {
  return (
    <footer className="site-foot" role="contentinfo">
      <p>
        Source material: Parliament of Australia website, licensed under{" "}
        <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer license">CC BY-NC-ND 4.0</a>.
        {" "}Titles reproduced unmodified; scores and summaries are Parliament Pulse analysis.
      </p>
      {/* FE-08 (LEG-13): the legal surface is one click from every desk. */}
      <nav className="site-foot-links" aria-label="Legal">
        <a href="#/about/legal">Legal and disclaimer</a>
        <a href="#/about/privacy">Privacy</a>
        <a href="#/about/licence">Licence and attribution</a>
        <a href="#/about/accessibility">Accessibility</a>
      </nav>
    </footer>
  );
}

Object.assign(window, { liveNavState, Sidebar, Topbar, TopClock, SignalCard, Drawer, Att, Conf, ProvenanceChip, BetaNotice, EmptyState, SkeletonRow, SkeletonCard, SkeletonTable, fmtDataAge, buildBriefSections, SiteFooter, generateBriefMarkdown });
