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
    return /* @__PURE__ */ React.createElement("div", { className: "panel", role: "alert", style: { margin: 18, padding: 18, borderColor: "var(--ember-flash)" } }, /* @__PURE__ */ React.createElement("div", { className: "page-kicker" }, "Render error"), /* @__PURE__ */ React.createElement("h1", { className: "page-title", style: { fontSize: "var(--t-headline)", marginTop: 6 } }, "Parliament Pulse could not render this view"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", maxWidth: 640 } }, "Reload the page to reset the current browser state. If the problem repeats, capture the page and action that caused it."), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => location.reload() }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13 }), " Reload"));
  }
}
function App() {
  const [route, setRoute] = React.useState(() => {
    migrateLegacyPageQuery(window.location, window.history);
    return parseRoute(window.location.hash) || { page: "overview" };
  });
  const [mobileNavOpen, setMobileNavOpen] = React.useState(() => {
    return safeGetLocalStorage("pp-nav-open") === "true";
  });
  const [announce, setAnnounce] = React.useState("");
  const navigate = React.useCallback((nextPage) => {
    const next = typeof nextPage === "string" ? { page: nextPage } : nextPage || { page: "overview" };
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
  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const h = (e) => {
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
          if (h1) {
            h1.setAttribute("tabindex", "-1");
            h1.focus({ preventScroll: true });
          }
        }
      }
      if (!first) setAnnounce(routeLabel(route));
    });
    return () => cancelAnimationFrame(raf);
  }, [routeKey]);
  const page = route.page;
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
      case "about":
        return /* @__PURE__ */ React.createElement(PageAbout, null);
      default:
        return /* @__PURE__ */ React.createElement(PageNotFound, { path: route.path });
    }
  };
  const skipToContent = (e) => {
    const main = document.getElementById("pp-content");
    if (!main) return;
    e.preventDefault();
    main.focus();
  };
  return /* @__PURE__ */ React.createElement(StoreProvider, { navigate }, /* @__PURE__ */ React.createElement("a", { className: "skip-link", href: "#pp-content", onClick: skipToContent }, "Skip to content"), /* @__PURE__ */ React.createElement(RouteSignalSync, { route, setRoute }), /* @__PURE__ */ React.createElement("div", { className: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-route-announcer": "" }, announce), /* @__PURE__ */ React.createElement("div", { className: "app" }, /* @__PURE__ */ React.createElement("div", { className: "drawer-back mobile-nav-back" + (mobileNavOpen ? " on" : ""), onClick: () => setMobileNavOpen(false), "aria-hidden": "true" }), /* @__PURE__ */ React.createElement(Sidebar, { page, onNavigate: navigate, mobileOpen: mobileNavOpen }), /* @__PURE__ */ React.createElement("div", { className: "main" }, /* @__PURE__ */ React.createElement(Topbar, { mobileNavOpen, setMobileNavOpen }), /* @__PURE__ */ React.createElement(BetaNotice, null), /* @__PURE__ */ React.createElement("main", { className: "content", id: "pp-content", tabIndex: -1 }, /* @__PURE__ */ React.createElement(ErrorBoundary, null, renderPage())), /* @__PURE__ */ React.createElement(SiteFooter, null)), /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(Drawer, null)), /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(DetailModal, null))));
}
function RouteSignalSync({ route, setRoute }) {
  const { signalId, openSignal } = useStore();
  const prevSignalRef = React.useRef(signalId);
  React.useEffect(() => {
    if (route.signal && route.signal !== signalId) openSignal(route.signal);
  }, [route.signal]);
  React.useEffect(() => {
    var _a;
    const was = prevSignalRef.current;
    prevSignalRef.current = signalId;
    if (signalId || !was || !route.signal) return;
    if (!((_a = parseRoute(window.location.hash)) == null ? void 0 : _a.signal)) return;
    window.history.replaceState(null, "", "#/signals");
    setRoute({ page: "signals" });
  }, [signalId]);
  return null;
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ React.createElement(React.StrictMode, null, /* @__PURE__ */ React.createElement(App, null))
);
