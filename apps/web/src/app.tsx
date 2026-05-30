import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { RecessBanner } from "./shell/RecessBanner";
import { Drawer } from "./shell/Drawer";
import { BriefPrint } from "./shell/BriefPrint";
import { ShortcutsHelp } from "./shell/ShortcutsHelp";
import { StoreProvider } from "./store/Store";
import { DetailModal } from "./store/Modals";
import { PageOverview } from "./pages/PageOverview";
import { PageLive } from "./pages/PageLive";
import { PageCommittees } from "./pages/PageCommittees";
import { PageBills } from "./pages/PageBills";
import { PageParliament } from "./pages/PageParliament";
import { PagePatterns } from "./pages/PagePatterns";
import { PageBriefings } from "./pages/PageBriefings";
import { PageWatchlists } from "./pages/PageWatchlists";
import { PageRadar } from "./pages/PageRadar";
import { PageSources } from "./pages/PageSources";
import { PageArchive } from "./pages/PageArchive";
import { PageAlerts } from "./pages/PageAlerts";
import { PageStatus } from "./pages/PageStatus";
import { initSentry } from "./lib/observability";
import { ThemeBoot } from "./shell/ThemeBoot";
import { ConfirmDialog } from "./shell/ConfirmDialog";
import { useLiveSignals } from "./lib/useLiveSignals";
import { WATCHLISTS } from "./data/fixtures";
import { useStore } from "./store/useStore";

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  live: "Live",
  radar: "Radar",
  briefings: "Briefings",
  committees: "Committees",
  bills: "Bills",
  parliament: "Parliament",
  patterns: "QON Patterns",
  watchlists: "Watchlists",
  sources: "Sources",
  archive: "Archive",
  alerts: "Alerts",
  status: "Status",
};

function readPageParam(): string {
  if (typeof window === "undefined") return "overview";
  return new URLSearchParams(window.location.search).get("page") ?? "overview";
}

function navigateTo(page: string): void {
  const url = new URL(window.location.href);
  const current = url.searchParams.get("page") ?? "overview";
  if (current === page) return; // avoid duplicate history entries
  if (page === "overview") {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", page);
  }
  window.history.pushState({}, "", url);
}

// Initialise Sentry early. No-op if VITE_SENTRY_DSN is not set.
initSentry();

export function App(): JSX.Element {
  const [page, setPage] = useState<string>(readPageParam);

  // Sync document title and URL on every page change.
  useEffect(() => {
    const label = PAGE_TITLES[page] ?? page;
    document.title = `${label} | Parliament Pulse`;
    navigateTo(page);
  }, [page]);

  // Handle browser back/forward.
  useEffect(() => {
    const onPop = (): void => setPage(readPageParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <StoreProvider page={page} setPage={setPage}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ThemeBoot />
      <LiveSignalsPump />
      <GlobalShortcuts setPage={setPage} />
      <div className="app">
        <Sidebar page={page} onNavigate={setPage} />
        <div className="main">
          <Topbar />
          <RecessBanner />
          <main id="main-content" className="content" tabIndex={-1}>
            <PageSwitch page={page} />
          </main>
        </div>
        <Drawer />
        <DetailModal />
        <BriefPrint />
        <ShortcutsHelp />
        <ConfirmDialog />
      </div>
    </StoreProvider>
  );
}

const NAV_SHORTCUTS: Record<string, string> = {
  o: "overview",
  l: "live",
  r: "radar",
  b: "briefings",
  c: "committees",
  i: "bills",
  p: "parliament",
  q: "patterns",
  w: "watchlists",
  s: "sources",
  a: "archive",
  n: "alerts",
  t: "status",
};

function GlobalShortcuts({ setPage }: { setPage: (p: string) => void }): null {
  const { density, setDensity } = useStore();
  // Use a ref for density so the handler never needs re-registration when density changes.
  const densityRef = useRef(density);
  densityRef.current = density;

  // "g" prefix then a letter jumps to the mapped page, like Gmail/Linear.
  useEffect(() => {
    let gMode = false;
    let gTimer: number | null = null;
    const handler = (e: KeyboardEvent): void => {
      const inField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (gMode) {
        const page = NAV_SHORTCUTS[e.key.toLowerCase()];
        gMode = false;
        if (gTimer) window.clearTimeout(gTimer);
        if (page) {
          e.preventDefault();
          setPage(page);
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        gMode = true;
        gTimer = window.setTimeout(() => { gMode = false; }, 1200);
        return;
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDensity(densityRef.current === "compact" ? "comfortable" : "compact");
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [setPage, setDensity]); // density removed from deps — read via ref
  return null;
}

function LiveSignalsPump(): null {
  const apiBase = import.meta.env.VITE_API_BASE ?? "";
  const { state, setLiveSignals, refreshTick, toast } = useStore();
  const mergedWatchlists = useMemo(
    () => [...WATCHLISTS, ...state.watchlistCreated],
    [state.watchlistCreated],
  );
  const { signals, loading, feedResult, pollIntervalMs } = useLiveSignals(
    apiBase,
    mergedWatchlists,
    refreshTick,
  );
  useEffect(() => {
    setLiveSignals(signals, loading, feedResult, pollIntervalMs);
  }, [signals, loading, feedResult, pollIntervalMs, setLiveSignals]);

  // One-shot /healthz probe on mount so infra outages surface explicitly
  // rather than showing as empty signal lists.
  useEffect(() => {
    let cancelled = false;
    if (!apiBase) return;
    const ctrl = new AbortController();
    fetch(`${apiBase.replace(/\/$/, "")}/healthz`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`healthz ${r.status}`);
        return r.json();
      })
      .catch(() => {
        if (!cancelled) {
          toast(
            "Proxy Worker unreachable. Live feeds will not update until it returns.",
            "warn",
          );
        }
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [apiBase, toast]);

  return null;
}

const PageSwitch = memo(function PageSwitch({ page }: { page: string }): JSX.Element {
  switch (page) {
    case "overview":
      return <PageOverview />;
    case "live":
      return <PageLive />;
    case "sources":
      return <PageSources />;
    case "archive":
      return <PageArchive />;
    case "alerts":
      return <PageAlerts />;
    case "status":
      return <PageStatus />;
    case "committees":
      return <PageCommittees />;
    case "bills":
      return <PageBills />;
    case "parliament":
      return <PageParliament />;
    case "patterns":
      return <PagePatterns />;
    case "briefings":
      return <PageBriefings />;
    case "watchlists":
      return <PageWatchlists />;
    case "radar":
      return <PageRadar />;
    default:
      return <PageOverview />;
  }
});
