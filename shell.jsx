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
    <span className="mono top-clock" aria-label="Local time" title="Local time" style={{fontSize:12, color:"var(--ink-3)", letterSpacing:".06em", fontVariantNumeric:"tabular-nums"}}>
      {clock}
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
      <span><strong>Live beta.</strong> Official APH feeds poll on the Live page. Enriched signals, radar and workflow queues are representative until the enrichment pipeline is connected. </span>
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
  { id: "sources", label: "Sources", group: "Workspace", count: null },
];

const ICONS = {
  overview: "overview", radar: "radar", committees: "committee", bills: "bill",
  parliament: "parliament", patterns: "pattern", briefings: "brief",
  watchlists: "watch", sources: "sources", live: "signal", signals: "signal",
};

function Sidebar({ page, onNavigate, mobileOpen }) {
  const { state } = useStore();
  const navCount = React.useMemo(() => {
    const active = SIGNALS.filter(s => !state.archived[s.id]);
    return {
      overview: null,  /* a dashboard has no unambiguous count; omit (the hero KPI carries the priority number) */
      live: null,
      radar:    active.filter(s => s.attention !== "low").length,
      signals:  active.length,
      committees: COMMITTEE_ITEMS.length,
      bills: BILLS.length,
      parliament: DIVISIONS.length,
      patterns: QON_PATTERN.items.length,
      briefings: BRIEFING_QUEUE.length + Object.keys(state.briefsGenerated || {}).length,
      watchlists: WATCHLISTS.length + (state.watchlistCreated || []).length,
      sources: null,  /* "6" was ambiguous (feeds? errors?); the Sources page states it plainly */
    };
  }, [state.archived, state.briefsGenerated, state.watchlistCreated, state.feeds]);
  const groups = [...new Set(NAV.map(n => n.group))];
  // Streak: consecutive days the tool has been opened — reflection of practice, not gamification.
  // Compute the display value without side effects so the lazy initialiser is pure if dev StrictMode is added.
  const [streak, setStreak] = React.useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const last = safeGetLocalStorage("pp-last-open-date");
    const count = parseInt(safeGetLocalStorage("pp-streak-count", "0") || "0");
    if (last === today) return count || 1;
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yStr = yest.toISOString().slice(0, 10);
    return (last === yStr) ? count + 1 : 1;
  });
  // F5: the localStorage WRITE runs after mount, so render itself cannot double-count or corrupt the streak.
  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (safeGetLocalStorage("pp-last-open-date") === today) return;
    const count = parseInt(safeGetLocalStorage("pp-streak-count", "0") || "0");
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yStr = yest.toISOString().slice(0, 10);
    const newCount = (safeGetLocalStorage("pp-last-open-date") === yStr) ? count + 1 : 1;
    safeSetLocalStorage("pp-streak-count", String(newCount));
    safeSetLocalStorage("pp-last-open-date", today);
    setStreak(newCount);
  }, []);
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
                {n.live && <span className="count nav-live">LIVE</span>}
                {!n.live && navCount[n.id] !== null && <span className="count">{navCount[n.id]}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-status" aria-label="System status">
        <div className="side-status-head">
          <span className="dot" style={{background:"var(--ok)", boxShadow:"none"}}/>
          <span>Feeds configured</span>
        </div>
        <div>Official RSS proxy configured; runtime health appears on Live</div>
        <div className="mono">Status: local beta</div>
      </div>
      <div className="side-foot">
        <div className="avatar">JV</div>
        <div style={{lineHeight:1.2}}>
          <div style={{fontSize:12.5, fontWeight:500}}>Juan Vega</div>
          <div style={{fontFamily:"var(--mono)", fontSize:10, color:"var(--ink-4)"}}>Prometheus Policy Lab · live beta</div>
        </div>
      </div>
    </aside>
  );
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
    [IS_MAC ? "⌘K" : "Ctrl+K", "Focus global search"],
  ];
  return (
    <div style={{position:"relative"}}>
      <button className="btn ghost sm" title="Keyboard shortcuts" onClick={() => setOpen(o => !o)} aria-label="View keyboard shortcuts" aria-expanded={open}>
        <Icon name="pattern" size={13} />
      </button>
      {open && (
        <div style={{position:"absolute", top:"calc(100% + 8px)", right:0, background:"var(--panel-2)", border:"1px solid var(--line-bright)", borderRadius:10, boxShadow:"var(--shadow)", zIndex:40, width:320, padding:"12px 14px"}} role="dialog" aria-label="Keyboard shortcuts">
          <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginBottom:10}}>Keyboard shortcuts</div>
          {shortcuts.map(([k, d]) => (
            <div key={k} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid var(--line)", fontSize:12.5}}>
              <span style={{color:"var(--ink-2)"}}>{d}</span>
              <kbd style={{fontFamily:"var(--mono)", fontSize:11, background:"var(--panel-hi)", border:"1px solid var(--line-2)", borderRadius:4, padding:"2px 7px", color:"var(--brass)", marginLeft:10, whiteSpace:"nowrap"}}>{k}</kbd>
            </div>
          ))}
          <button style={{marginTop:10, background:"none", border:"none", color:"var(--ink-4)", cursor:"pointer", fontSize:12, padding:0}} onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
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
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ref.current?.focus(); }
      if (e.key === "Escape") {
        if (modal || signalId) return;
        if (open) { e.preventDefault(); setOpen(false); setCursor(-1); ref.current?.blur(); return; }
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
      setCursor(-1);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = React.useMemo(() => {
    if (!q.trim()) return null;
    const term = q.toLowerCase();
    const sig = SIGNALS.filter(s =>
      s.title.toLowerCase().includes(term) || s.summary.toLowerCase().includes(term) || s.id.toLowerCase().includes(term));
    const bills = Object.values(ENTITIES.bills).filter(b => [b.title, b.ref, b.portfolio, b.stage].some(v => (v || "").toLowerCase().includes(term)));
    const comm = Object.values(ENTITIES.committees).filter(c => [c.name, c.portfolio, c.chamber].some(v => (v || "").toLowerCase().includes(term)));
    const mem = Object.values(ENTITIES.members).filter(m => [m.name, m.party, (m.roles || []).join(" ")].some(v => (v || "").toLowerCase().includes(term)));
    const feeds = APH_FEEDS.filter(f => f.name.toLowerCase().includes(term));
    return { sig, bills, comm, mem, feeds };
  }, [q]);

  // Flat ordered list for keyboard cursor
  const flat = React.useMemo(() => {
    if (!results) return [];
    return [
      ...results.sig.slice(0,4).map(s => ({ kind:"signal", key:s.id, label:s.title, sub:s.id, act:() => { openSignal(s.id); } })),
      ...(results.sig.length > 4 ? [{ kind:"signalsAll", key:"signals-all", label:`See all ${results.sig.length} signals`, sub:q, act:() => { setSignalSearchQuery(q); navigate("signals"); } }] : []),
      ...results.bills.map(b => ({ kind:"bill", key:b.ref, label:b.title, sub:b.ref, act:() => { openModal("bill", b.ref); } })),
      ...results.comm.map(c => ({ kind:"committee", key:c.id, label:c.name, sub:c.chamber, act:() => { openModal("committee", c.id); } })),
      ...results.mem.map(m => ({ kind:"member", key:m.id, label:m.name, sub:m.party, act:() => { openModal("member", m.id); } })),
      ...results.feeds.slice(0,4).map(f => ({ kind:"feed", key:f.id, label:f.name, sub:f.group, act:() => { openModal("feed", f.id); } })),
    ];
  }, [results, q, openSignal, openModal, setSignalSearchQuery, navigate]);

  React.useEffect(() => setCursor(-1), [q]);

  const selectItem = (item) => { item.act(); setOpen(false); setQ(""); setCursor(-1); };

  const onKeyDown = (e) => {
    if (!open || !results) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, flat.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); return; }
    if (e.key === "Escape")    { setOpen(false); setCursor(-1); ref.current?.blur(); return; }
    if (e.key === "Enter" && cursor >= 0 && flat[cursor]) { e.preventDefault(); selectItem(flat[cursor]); return; }
  };

  // Map flat index back to per-group index offsets for rendering
  const sigOff  = 0;
  const sigFlatCount = results ? results.sig.slice(0,4).length + (results.sig.length > 4 ? 1 : 0) : 0;
  const billOff = sigFlatCount;
  const commOff = billOff + (results ? results.bills.length : 0);
  const memOff  = commOff + (results ? results.comm.length : 0);
  const feedOff = memOff  + (results ? results.mem.length : 0);

  return (
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
      <div ref={searchRef} className={"search" + (focused ? " focused" : "")} onClick={() => setOpen(true)}
        style={focused ? {borderColor:"var(--brass)", boxShadow:"0 0 0 3px var(--brass-soft)"} : undefined}>
        <Icon name="search" size={14} stroke={focused ? "var(--brass)" : "var(--ink-3)"} />
        <input ref={ref} value={q}
          role="combobox"
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setFocused(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          aria-label="Search parliament signals, bills, committees and members"
          aria-expanded={open && !!results}
          aria-autocomplete="list"
          aria-controls="search-listbox"
          aria-activedescendant={cursor >= 0 ? `search-option-${cursor}` : undefined}
          placeholder="Search signals, bills, committees, members, feeds…" />
        {q ? (
          <button onClick={() => { setQ(""); setOpen(false); setCursor(-1); ref.current?.focus(); }}
            aria-label="Clear search" title="Clear search"
            style={{background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"var(--ink-3)", display:"flex", alignItems:"center", flexShrink:0}}>
            <Icon name="close" size={12} />
          </button>
        ) : (
          <span className="kbd">{IS_MAC ? "⌘K" : "Ctrl+K"}</span>
        )}
        {open && results && (
          <div id="search-listbox" role="listbox" className="search-results">
            {results.sig.length > 0 && <>
              <div className="sr-group">Signals ({results.sig.length})</div>
              {results.sig.slice(0,4).map((s, i) => (
                <div key={s.id} id={`search-option-${sigOff + i}`} role="option" aria-selected={cursor === sigOff + i}
                  className={"sr-item" + (cursor === sigOff + i ? " active" : "")}
                  onMouseDown={e => { e.preventDefault(); selectItem(flat[sigOff + i]); }}>
                  <span className="k">{s.id}</span><span>{s.title}</span>
                </div>
              ))}
              {results.sig.length > 4 && (
                <div id={`search-option-${sigOff + 4}`} role="option" aria-selected={cursor === sigOff + 4}
                  className={"sr-item" + (cursor === sigOff + 4 ? " active" : "")}
                  onMouseDown={e => { e.preventDefault(); selectItem(flat[sigOff + 4]); }}>
                  <span className="k">All</span><span>See all {results.sig.length} signals</span>
                </div>
              )}
            </>}
            {results.bills.length > 0 && <>
              <div className="sr-group">Bills</div>
              {results.bills.map((b, i) => (
                <div key={b.ref} id={`search-option-${billOff + i}`} role="option" aria-selected={cursor === billOff + i}
                  className={"sr-item" + (cursor === billOff + i ? " active" : "")}
                  onMouseDown={e => { e.preventDefault(); selectItem(flat[billOff + i]); }}>
                  <span className="k">{b.ref}</span><span>{b.title}</span>
                </div>
              ))}
            </>}
            {results.comm.length > 0 && <>
              <div className="sr-group">Committees</div>
              {results.comm.map((c, i) => (
                <div key={c.id} id={`search-option-${commOff + i}`} role="option" aria-selected={cursor === commOff + i}
                  className={"sr-item" + (cursor === commOff + i ? " active" : "")}
                  onMouseDown={e => { e.preventDefault(); selectItem(flat[commOff + i]); }}>
                  <span className="k">{c.chamber}</span><span>{c.name}</span>
                </div>
              ))}
            </>}
            {results.mem.length > 0 && <>
              <div className="sr-group">Members</div>
              {results.mem.map((m, i) => (
                <div key={m.id} id={`search-option-${memOff + i}`} role="option" aria-selected={cursor === memOff + i}
                  className={"sr-item" + (cursor === memOff + i ? " active" : "")}
                  onMouseDown={e => { e.preventDefault(); selectItem(flat[memOff + i]); }}>
                  <span className="k">{m.party}</span><span>{m.name}</span>
                </div>
              ))}
            </>}
            {results.feeds.length > 0 && <>
              <div className="sr-group">Sources ({results.feeds.length})</div>
              {results.feeds.slice(0,4).map((f, i) => (
                <div key={f.id} id={`search-option-${feedOff + i}`} role="option" aria-selected={cursor === feedOff + i}
                  className={"sr-item" + (cursor === feedOff + i ? " active" : "")}
                  onMouseDown={e => { e.preventDefault(); selectItem(flat[feedOff + i]); }}>
                  <span className="k">{f.group}</span><span>{f.name}</span>
                </div>
              ))}
            </>}
            {q && !results.sig.length && !results.bills.length && !results.comm.length && !results.mem.length && !results.feeds.length && (
              <div className="sr-item" role="option" aria-selected="false" style={{color:"var(--ink-4)", cursor:"default"}}>No matches for "{q}"</div>
            )}
          </div>
        )}
      </div>
      <div className="top-right">
        <TopClock />
        <span className="chip clk" onClick={() => navigate("live")} title="Official feeds configured; live RSS polls on the Live page" style={{borderColor:"color-mix(in srgb, var(--gold) 55%, transparent)", color:"var(--gold)", background:"transparent"}}>
          <span className="dot" style={{background:"var(--gold)", boxShadow:"none"}}/> Live beta · {sourceCounts().total} feeds
        </span>
        <button className="btn ghost sm shortcut-btn" title="Go to Live parliament and refresh feeds there" aria-label="Refresh live feeds" onClick={() => {
          requestLiveRefresh();
          navigate("live");
          if (window.__refreshLiveFeeds) { consumeLiveRefresh(); window.__refreshLiveFeeds(); toast("Refreshing live feeds..."); }
          else toast("Opening Live page to refresh feeds", "brass");
        }}><Icon name="refresh" size={14} /></button>
        <button className="btn ghost sm" title="Show current priority count" aria-label="Alerts" onClick={() => toast(`${SIGNALS.filter(s => s.attention === "high").length} priority signals currently need review`, "brass")}><Icon name="bell" size={14} /></button>
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
  );
}

// Provenance chip: the mechanical honesty label for a /state data block.
// provenance is one of the state-v1 contract values (live | derived | fixture)
// — the label and colour come entirely from that value, so a caller can never
// hand-place a "Live" chip over data the contract itself has not vouched for.
// Reuses .chip-fixture (the existing Representative-data chip) as its base
// shape; live/derived only add a colour modifier.
function ProvenanceChip({ provenance, title }) {
  const LABELS = { live: "Live", derived: "Derived", fixture: "Fixture" };
  const key = LABELS[provenance] ? provenance : "fixture";
  const cls = "chip-fixture" + (key === "live" ? " chip-live" : key === "derived" ? " chip-derived" : "");
  return <span className={cls} title={title}>{LABELS[key]}</span>;
}

function Att({ level }) {
  const map = { high: "High", med: "Medium", low: "Low" };
  return <span className={"att " + level}>{map[level]}</span>;
}

function Conf({ n = 3 }) {
  // 5-segment ember-to-gold ramp: lit segments climb from incandescent ember to gold
  // so the bar reads quantitatively, not just as a count.
  const ramp = ["var(--brass)", "var(--brass)", "var(--brass-2)", "var(--gold)", "var(--gold)"];
  return (
    <span className="conf" title={`Confidence ${n}/5`}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i<=n?"on":""}
          style={i<=n ? {background: ramp[i-1]} : undefined} />
      ))}
    </span>
  );
}

function buildBriefSections(s) {
  const evidence = (s.evidence || []).map(e => ({ label: e.label, url: e.url }));
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
      humanReview: s.humanReview,
    },
    summary: s.summary,
    whyItMatters: s.attentionReason,
    recommendedAction: {
      label: s.action,
      reason: s.actionReason,
    },
    evidence,
    provenance: `Signal ID: ${s.id} | Representative confidence score: ${s.confidence}/5 | Review status: ${s.humanReview}. Representative workflow trace; not a production processing log.`,
  };
}

function SignalCard({ s }) {
  const { openSignal, state, isWatched } = useStore();
  const archived = !!state.archived[s.id];
  const feedback = state.feedback[s.id];
  const watched = isWatched(s.id);
  return <SignalCardView s={s} archived={archived} feedback={feedback} watched={watched} openSignal={openSignal} />;
}

const SignalCardView = React.memo(function SignalCardView({ s, archived, feedback, watched, openSignal }) {
  if (archived) return null;
  return (
    <div className="signal" data-att={s.attention} onClick={() => openSignal(s.id)} role="button" tabIndex={0} aria-label={`Signal: ${s.title}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSignal(s.id); } }}>
      <div className="sig-head">
        <span className="sig-id mono">{s.id}</span>
        <span className="sig-source mono">· {s.source}</span>
        <Att level={s.attention} />
        {watched && <span className="tag brass">Watching</span>}
        <span className="sig-time mono">{s.time}</span>
      </div>
      <div className="sig-title serif">{s.title}</div>
      <div className="sig-sum">{s.summary.length > 120 ? s.summary.slice(0, 120).replace(/\s\S+$/, "") + "…" : s.summary}</div>
      <div className="sig-tags">
        {s.tags.map((t, i) => <span key={i} className={"tag " + (t.c || "")}>{t.l}</span>)}
      </div>
      <div className="sig-action">
        <span className="sig-action-label">Recommended</span>
        <span className="sig-action-value">{s.action}</span>
        <span className="mono" title="Analyst confidence" style={{fontSize:10.5, color:"var(--ink-4)", letterSpacing:".04em", whiteSpace:"nowrap"}}>{s.confidence}/5</span>
      </div>
      {feedback && (
        <div style={{marginTop:8, fontSize:11.5, color:"var(--brass)"}}>
          <Icon name="check" size={12} style={{verticalAlign:"-2px", marginRight:4}}/> Feedback: {feedback.label}
        </div>
      )}
      {watched && (
        <div style={{marginTop:8, fontSize:11.5, color:"var(--brass)"}}>
          <Icon name="watch" size={12} style={{verticalAlign:"-2px", marginRight:4}}/> On watchlist
        </div>
      )}
    </div>
  );
});

function generateBriefMarkdown(s) {
  const brief = buildBriefSections(s);
  const evidence = brief.evidence.map(e => `- [${e.label}](${e.url})`).join("\n");
  return [
    `> BETA DRAFT — generated from the current Parliament Pulse signal record. Verify source links before distribution.`,
    ``,
    `# Executive Brief — ${brief.title}`,
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
    `Generated: ${new Date().toISOString()}`,
  ].join("\n");
}

function Drawer() {
  const { signalId, openSignal, closeSignal, state, modal, openModal, saveFeedback, archive, addWatchlist, isWatched, saveNote, generateBrief, toast, visibleSignalOrder, navigate } = useStore();
  const signal = React.useMemo(() => SIGNALS.find(s => s.id === signalId), [signalId]);
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

  // Visible signals (non-archived) — computed early so keyboard deps can reference it
  const visibleSigs = React.useMemo(() => {
    const fallback = SIGNALS.filter(x => !state.archived[x.id]);
    if (!Array.isArray(visibleSignalOrder) || visibleSignalOrder.length === 0) return fallback;
    const byId = new Map(SIGNALS.map(x => [x.id, x]));
    const ordered = visibleSignalOrder.map(id => byId.get(id)).filter(x => x && !state.archived[x.id]);
    return ordered.length ? ordered : fallback;
  }, [visibleSignalOrder, state.archived]);

  // Sync index ref and scroll drawer to top when signal changes
  React.useEffect(() => {
    const idx = visibleSigs.findIndex(s => s.id === signalId);
    if (idx !== -1) sigIdxRef.current = idx;
    if (drawerBodyRef.current) drawerBodyRef.current.scrollTop = 0;
  }, [signalId, visibleSigs]);

  // Focus management: save trigger element, move focus into drawer, restore on close
  React.useEffect(() => {
    if (signalId) {
      prevFocusRef.current = document.activeElement;
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
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
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape" && signalId) { e.preventDefault(); flushNote(); closeSignal(); return; }
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const cur = visibleSigs.findIndex(s => s.id === signalId);
        const next = e.key === "j"
          ? Math.min(cur + 1, visibleSigs.length - 1)
          : Math.max(cur - 1, 0);
        if (visibleSigs[next] && visibleSigs[next].id !== signalId) { flushNote(); openSignal(visibleSigs[next].id); }
      }
      if (e.key === "b" && signalId) {
        e.preventDefault();
        const s = SIGNALS.find(x => x.id === signalId);
        if (s) {
          copyToClipboard(generateBriefMarkdown(s))
            .then(() => { generateBrief(s.id, "Executive brief"); toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") }); })
            .catch(() => toast("Clipboard unavailable — brief not copied", "error"));
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
  }, [signalId, modal, visibleSigs, openSignal, closeSignal, archive, addWatchlist, generateBrief, toast, flushNote, navigate]);

  const on = !!signal;
  const s = signal || {};
  const watched = signalId ? isWatched(signalId) : false;
  const labels = ["Correct priority","Too high","Too low","Wrong topic","Wrong portfolio","Duplicate","Noise","Needs human review"];
  const sigPos = visibleSigs.findIndex(x => x.id === signalId);
  return (
    <>
      <div className={"drawer-back" + (on ? " on" : "")} onClick={closeWithFlush} aria-hidden="true" />
      <aside className={"drawer" + (on ? " on" : "")} role="dialog" aria-modal="true" aria-label={on ? s.title : "Signal detail"}>
        {on && (
          <>
            <div className="drawer-head">
              <div>
                <div className="mono" style={{fontSize:10, color:"var(--ink-4)", letterSpacing:".16em", textTransform:"uppercase"}}>
                  {s.id} · {s.date}
                </div>
                <h2 className="h-drawer" style={{margin:"4px 0 0", maxWidth:460}}>{s.title}</h2>
              </div>
              <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:12, flexShrink:0}}>
                {sigPos !== -1 && (
                  <span className="mono" style={{fontSize:10.5, color:"var(--ink-4)", textAlign:"right", lineHeight:1.3}}>
                    <span style={{display:"block"}}>{sigPos + 1} / {visibleSigs.length}</span>
                    <span style={{fontSize:9, letterSpacing:".1em", opacity:.7}}>SIGNAL</span>
                  </span>
                )}
                <button ref={closeButtonRef} className="btn ghost sm" aria-label="Close signal detail" onClick={closeWithFlush}><Icon name="close" size={14} /></button>
              </div>
            </div>
            <div className="drawer-body" ref={drawerBodyRef}>
              <div className="drawer-section">
                <h3>Recommended action</h3>
                <div style={{padding:"10px 14px", borderLeft:"3px solid var(--brass)", borderRadius:"0 6px 6px 0", background:"var(--panel-2)"}}>
                  <div style={{fontWeight:600, color:"var(--ink)"}}>{s.action}</div>
                  <div style={{color:"var(--ink-2)", fontSize:13, marginTop:4}}>{s.actionReason}</div>
                </div>
              </div>
              <div className="drawer-section"><h3>Summary</h3><p>{s.summary}</p></div>
              <div className="drawer-section"><h3>Why it matters</h3><p>{s.attentionReason}</p></div>
              <div className="drawer-section">
                <h3>Signal metadata</h3>
                <dl className="kv">
                  <dt>Source</dt><dd>{s.source}</dd>
                  <dt>Source group</dt><dd>{s.sourceGroup}</dd>
                  <dt>Authority</dt><dd>{s.sourceAuthority}</dd>
                  <dt>Attention</dt><dd><Att level={s.attention} /></dd>
                  <dt>Confidence</dt><dd><Conf n={s.confidence} /> <span style={{color:"var(--ink-3)", marginLeft:8, fontFamily:"var(--mono)", fontSize:11}}>Representative confidence score: {s.confidence}/5</span></dd>
                  <dt>Human review</dt><dd>Review status: {s.humanReview === "Required" ? "Not reviewed · policy officer must verify source links before use" : "Optional for internal triage; required before external distribution"}</dd>
                </dl>
              </div>
              {s.score && (
                <div className="drawer-section">
                  <h3>Attention score breakdown</h3>
                  {Object.entries(s.score).map(([k,v]) => {
                    const lab = {authority:"Source authority", portfolio:"Portfolio relevance", novelty:"Novelty", momentum:"Momentum", time:"Time sensitivity", scrutiny:"Scrutiny relevance", ops:"Operational impact"};
                    return (
                      <div key={k} style={{display:"grid", gridTemplateColumns:"160px 1fr 40px", gap:10, alignItems:"center", padding:"4px 0"}}>
                        <div style={{fontSize:12.5, color:"var(--ink-2)"}}>{lab[k]}</div>
                        <div className="bar"><div className="fill" style={{width:`${v*100}%`}} /></div>
                        <div className="mono" style={{fontSize:11, color:"var(--ink-3)", textAlign:"right"}}>{Math.round(v*100)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="drawer-section">
                <h3>Evidence · open the actual source</h3>
                {s.evidence?.map((e,i) => (
                  <a key={i} href={e.url} target="_blank" rel="noopener noreferrer" style={{
                    display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                    border:"1px solid var(--line-2)", borderRadius:8, color:"var(--ink)",
                    textDecoration:"none", marginBottom:6, fontSize:13,
                  }}>
                    <Icon name="link" size={14} stroke="var(--teal)" />
                    <span>{e.label}</span>
                    <span className="mono" style={{color:"var(--ink-4)", fontSize:11, marginLeft:"auto", maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e.url.replace(/^https?:\/\//,"")}</span>
                    <Icon name="ext" size={12} stroke="var(--ink-3)" />
                  </a>
                ))}
              </div>

              {s.provenance && s.provenance.length > 0 && (
                <div className="drawer-section">
                  <h3>Representative provenance · target workflow, not a production audit log <span className="chip-fixture" style={{verticalAlign:"middle", marginLeft:6}}>Representative data</span></h3>
                  <div style={{border:"1px solid var(--line-2)", borderRadius:8, overflow:"hidden"}}>
                    {s.provenance.map((p,i) => (
                      <div key={i} style={{display:"grid", gridTemplateColumns:"78px 90px 1fr", gap:10, padding:"8px 12px", fontSize:12, borderBottom: i<s.provenance.length-1 ? "1px solid var(--line)" : 0, background: i%2 ? "var(--panel-hi)" : "transparent"}}>
                        <div className="mono" style={{color:"var(--ink-4)", fontSize:10.5}}>{p.ts}</div>
                        <div><span className="tag" style={{fontSize:10, padding:"1px 6px"}}>{p.by}</span></div>
                        <div style={{color:"var(--ink-2)"}}>{p.event}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.updates && s.updates.length > 0 && (
                <div className="drawer-section">
                  <h3>Updates to this signal · who / what / when</h3>
                  {s.updates.map((u,i) => (
                    <div key={i} style={{display:"grid", gridTemplateColumns:"60px 140px 1fr", gap:10, padding:"8px 0", borderBottom: i<s.updates.length-1 ? "1px solid var(--line)" : 0, fontSize:12.5}}>
                      <div className="mono" style={{color:"var(--ink-4)", fontSize:11}}>{u.ts}</div>
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
                      return <span key={mid} className="tag brass clk" onClick={() => openModal("member", mid)}>{m.name}</span>;
                    })}
                  </div>
                </div>
              )}
              <div className="drawer-section">
                <h3>Analyst note {noteSaved && <span className="mono" style={{fontSize:10, color:"var(--brass)", marginLeft:8}}>Saved</span>}</h3>
                <textarea value={note} onChange={e=>setNote(e.target.value)} onBlur={flushNote}
                  placeholder="Private notes (auto-saved)" rows={3}
                  style={{width:"100%", background:"var(--panel)", border:"1px solid var(--line-2)", borderRadius:8, color:"var(--ink)", padding:"8px 10px", fontFamily:"var(--sans)", fontSize:13, resize:"vertical"}}/>
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
                copyToClipboard(generateBriefMarkdown(s))
                  .then(() => { generateBrief(s.id, "Executive brief"); toast("Brief copied to clipboard", "brass", { label: "Open briefings", fn: () => navigate("briefings") }); })
                  .catch(() => toast("Clipboard unavailable — brief not copied", "error"));
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

Object.assign(window, { Sidebar, Topbar, TopClock, SignalCard, Drawer, Att, Conf, ProvenanceChip, BetaNotice, EmptyState, SkeletonRow, SkeletonCard, buildBriefSections });
