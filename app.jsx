// App root — wires StoreProvider and all pages
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Parliament Pulse render error", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel" role="alert" style={{margin:18, padding:18, borderColor:"var(--ember-flash)"}}>
        <div className="page-kicker">Render error</div>
        <h1 className="page-title" style={{fontSize:"var(--t-headline)", marginTop:6}}>Parliament Pulse could not render this view</h1>
        <p style={{color:"var(--ink-2)", maxWidth:640}}>Reload the page to reset the current browser state. If the problem repeats, capture the page and action that caused it.</p>
        <button className="btn primary" onClick={() => location.reload()}><Icon name="refresh" size={13}/> Reload</button>
      </div>
    );
  }
}

function App() {
  // FE-08 (UX-06): the hash is the source of truth for the desk. navigate() writes
  // it with history.pushState; the hashchange listener below reads it back, so
  // Back, Forward, a typed address and an <a href="#/..."> link all drive the page.
  const [route, setRoute] = React.useState(() => {
    migrateLegacyPageQuery(window.location, window.history);
    return parseRoute(window.location.hash) || { page: "overview" };
  });
  const [mobileNavOpen, setMobileNavOpen] = React.useState(() => {
    return safeGetLocalStorage("pp-nav-open") === "true";
  });
  const [announce, setAnnounce] = React.useState("");
  const navigate = React.useCallback((nextPage) => {
    const next = typeof nextPage === "string" ? { page: nextPage } : (nextPage || { page: "overview" });
    const hash = routeHash(next);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    setRoute(parseRoute(hash) || { page: "overview" });
    setMobileNavOpen(false);
  }, []);
  React.useEffect(() => {
    const onHash = () => {
      const r = parseRoute(window.location.hash);
      if (r) setRoute(r);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  React.useEffect(() => {
    safeSetLocalStorage("pp-nav-open", String(mobileNavOpen));
  }, [mobileNavOpen]);
  // FE-10: Esc closes the open mobile navigation and returns focus to its toggle,
  // so the scrim's click-to-close has a keyboard equivalent.
  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const h = e => {
      if (e.key !== "Escape") return;
      setMobileNavOpen(false);
      const t = document.querySelector(".nav-toggle");
      if (t) t.focus();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [mobileNavOpen]);
  React.useEffect(() => {
    const saved = safeGetLocalStorage("pp-theme");
    if (saved) document.documentElement.dataset.theme = saved;
  }, []);

  // A11Y-04: every route change sets the document title, moves focus to the
  // page's h1 (or the named About section) and announces the desk politely. The
  // first render sets the title only, so a fresh load does not steal focus.
  const routeKey = routeHash(route);
  const firstRouteRef = React.useRef(true);
  React.useEffect(() => {
    document.title = routeTitle(route);
    const first = firstRouteRef.current;
    firstRouteRef.current = false;
    const raf = requestAnimationFrame(() => {
      const section = route.page === "about" && route.section ? document.getElementById("about-" + route.section) : null;
      if (section) {
        section.setAttribute("tabindex", "-1");
        section.scrollIntoView({ block: "start" });
        if (!first) section.focus({ preventScroll: true });
      } else if (!first) {
        window.scrollTo(0, 0);
        if (!route.signal) {
          const h1 = document.querySelector("#pp-content h1");
          if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
        }
      }
      if (!first) setAnnounce(routeLabel(route));
    });
    return () => cancelAnimationFrame(raf);
  }, [routeKey]);

  const page = route.page;
  const renderPage = () => {
    switch (page) {
      case "overview":   return <PageOverview />;
      case "live":       return <PageLive />;
      case "sources":    return <PageSources />;
      case "committees": return <PageCommittees />;
      case "bills":      return <PageBills />;
      case "parliament": return <PageParliament />;
      case "patterns":   return <PagePatterns />;
      case "briefings":  return <PageBriefings />;
      case "watchlists": return <PageWatchlists />;
      case "radar":      return <PageRadar />;
      case "signals":    return <PageSignals />;
      case "about":      return <PageAbout />;
      default:           return <PageNotFound path={route.path} />;
    }
  };

  // Skip link: focus the content landmark without writing #pp-content into the
  // address bar, which would otherwise leave the router a non-route hash.
  const skipToContent = e => {
    const main = document.getElementById("pp-content");
    if (!main) return;
    e.preventDefault();
    main.focus();
  };

  return (
    <StoreProvider navigate={navigate}>
      <a className="skip-link" href="#pp-content" onClick={skipToContent}>Skip to content</a>
      <RouteSignalSync route={route} setRoute={setRoute} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-route-announcer="">{announce}</div>
      <div className="app">
        {/* a11y-exempt: backdrop */}
        <div className={"drawer-back mobile-nav-back" + (mobileNavOpen ? " on" : "")} onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
        <Sidebar page={page} onNavigate={navigate} mobileOpen={mobileNavOpen} />
        <div className="main">
          <Topbar mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />
          <BetaNotice />
          <main className="content" id="pp-content" tabIndex={-1}><ErrorBoundary>{renderPage()}</ErrorBoundary></main>
          <SiteFooter />
        </div>
        <ErrorBoundary><Drawer /></ErrorBoundary>
        <ErrorBoundary><DetailModal /></ErrorBoundary>
      </div>
    </StoreProvider>
  );
}

// #/signal/<guid> opens the drawer over the Signal inbox. When the reader closes
// that drawer, the address returns to #/signals with replaceState, so a reload
// does not reopen it and Back does not step through a closed drawer.
function RouteSignalSync({ route, setRoute }) {
  const { signalId, openSignal } = useStore();
  const prevSignalRef = React.useRef(signalId);
  React.useEffect(() => {
    if (route.signal && route.signal !== signalId) openSignal(route.signal);
  }, [route.signal]);
  React.useEffect(() => {
    const was = prevSignalRef.current;
    prevSignalRef.current = signalId;
    // Only a drawer opened from a #/signal/ address that has just closed.
    if (signalId || !was || !route.signal) return;
    if (!parseRoute(window.location.hash)?.signal) return;
    window.history.replaceState(null, "", "#/signals");
    setRoute({ page: "signals" });
  }, [signalId]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
