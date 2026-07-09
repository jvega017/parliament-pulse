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
        <h1 className="page-title" style={{fontSize:24, marginTop:6}}>Parliament Pulse could not render this view</h1>
        <p style={{color:"var(--ink-2)", maxWidth:640}}>Reload the page to reset the current browser state. If the problem repeats, capture the page and action that caused it.</p>
        <button className="btn primary" onClick={() => location.reload()}><Icon name="refresh" size={13}/> Reload</button>
      </div>
    );
  }
}

function App() {
  const [page, setPage] = React.useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = React.useState(() => {
    return safeGetLocalStorage("pp-nav-open") === "true";
  });
  const navigate = React.useCallback((nextPage) => {
    setPage(nextPage);
    setMobileNavOpen(false);
  }, []);
  React.useEffect(() => {
    safeSetLocalStorage("pp-nav-open", String(mobileNavOpen));
  }, [mobileNavOpen]);
  React.useEffect(() => {
    const saved = safeGetLocalStorage("pp-theme");
    if (saved) document.documentElement.dataset.theme = saved;
  }, []);

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
      default:           return <PageOverview />;
    }
  };

  return (
    <StoreProvider navigate={navigate}>
      <div className="app">
        <div className={"drawer-back mobile-nav-back" + (mobileNavOpen ? " on" : "")} onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
        <Sidebar page={page} onNavigate={navigate} mobileOpen={mobileNavOpen} />
        <div className="main">
          <Topbar mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />
          <BetaNotice />
          <div className="content"><ErrorBoundary>{renderPage()}</ErrorBoundary></div>
        </div>
        <ErrorBoundary><Drawer /></ErrorBoundary>
        <ErrorBoundary><DetailModal /></ErrorBoundary>
      </div>
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
