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
    return /* @__PURE__ */ React.createElement("div", { className: "panel", role: "alert", style: { margin: 18, padding: 18, borderColor: "var(--ember-flash)" } }, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Render error"), /* @__PURE__ */ React.createElement("h1", { className: "page-title", style: { fontSize: 24, marginTop: 6 } }, "Parliament Pulse could not render this view"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", maxWidth: 640 } }, "Reload the page to reset the current browser state. If the problem repeats, capture the page and action that caused it."), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => location.reload() }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13 }), " Reload"));
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
      case "overview":
        return /* @__PURE__ */ React.createElement(PageOverview, null);
      case "live":
        return /* @__PURE__ */ React.createElement(PageLive, null);
      case "sources":
        return /* @__PURE__ */ React.createElement(PageSources, null);
      case "committees":
        return /* @__PURE__ */ React.createElement(PageCommittees, null);
      case "bills":
        return /* @__PURE__ */ React.createElement(PageBills, null);
      case "parliament":
        return /* @__PURE__ */ React.createElement(PageParliament, null);
      case "patterns":
        return /* @__PURE__ */ React.createElement(PagePatterns, null);
      case "briefings":
        return /* @__PURE__ */ React.createElement(PageBriefings, null);
      case "watchlists":
        return /* @__PURE__ */ React.createElement(PageWatchlists, null);
      case "radar":
        return /* @__PURE__ */ React.createElement(PageRadar, null);
      case "signals":
        return /* @__PURE__ */ React.createElement(PageSignals, null);
      default:
        return /* @__PURE__ */ React.createElement(PageOverview, null);
    }
  };
  return /* @__PURE__ */ React.createElement(StoreProvider, { navigate }, /* @__PURE__ */ React.createElement("div", { className: "app" }, /* @__PURE__ */ React.createElement("div", { className: "drawer-back mobile-nav-back" + (mobileNavOpen ? " on" : ""), onClick: () => setMobileNavOpen(false), "aria-hidden": "true" }), /* @__PURE__ */ React.createElement(Sidebar, { page, onNavigate: navigate, mobileOpen: mobileNavOpen }), /* @__PURE__ */ React.createElement("div", { className: "main" }, /* @__PURE__ */ React.createElement(Topbar, { mobileNavOpen, setMobileNavOpen }), /* @__PURE__ */ React.createElement(BetaNotice, null), /* @__PURE__ */ React.createElement("div", { className: "content" }, /* @__PURE__ */ React.createElement(ErrorBoundary, null, renderPage()))), /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(Drawer, null)), /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(DetailModal, null))));
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ React.createElement(React.StrictMode, null, /* @__PURE__ */ React.createElement(App, null))
);
