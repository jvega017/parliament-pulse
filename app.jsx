// App root — wires StoreProvider and all pages
function App() {
  const [page, setPage] = React.useState("overview");
  React.useEffect(() => { window.__setPage = setPage; }, []);
  React.useEffect(() => {
    const saved = localStorage.getItem("pp-theme");
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
    <StoreProvider>
      <div className="app">
        <Sidebar page={page} setPage={setPage} />
        <div className="main">
          <DesignStateBanner />
          <Topbar setPage={setPage} />
          <div className="content">{renderPage()}</div>
        </div>
        <Drawer />
        <DetailModal />
      </div>
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
