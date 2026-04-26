import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
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
import { PageStatus } from "./pages/PageStatus";
import { initSentry } from "./lib/observability";
import { ThemeBoot } from "./shell/ThemeBoot";
import { ConfirmDialog } from "./shell/ConfirmDialog";
import { useLiveSignals } from "./lib/useLiveSignals";
import { WATCHLISTS } from "./data/fixtures";
import { useStore } from "./store/useStore";

function readPageParam(): string {
  if (typeof window === "undefined") return "overview";
  return new URLSearchParams(window.location.search).get("page") ?? "overview";
}

// Initialise Sentry early. No-op if VITE_SENTRY_DSN is not set.
initSentry();

export function App(): JSX.Element {
  const [page, setPage] = useState<string>(readPageParam);

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
  t: "status",
};

function GlobalShortcuts({ setPage }: { setPage: (p: string) => void }): null {
  const { density, setDensity } = useStore();
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
        setDensity(density === "compact" ? "comfortable" : "compact");
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [setPage, density, setDensity]);
  return null;
}

function LiveSignalsPump(): null {
  const apiBase = import.meta.env.VITE_API_BASE ?? "";
  const { state, setLiveSignals, refreshTick, toast } = useStore();
  const mergedWatchlists = useMemo(
    () => [...WATCHLISTS, ...state.watchlistCreated],
    [state.watchlistCreated],
  );
  const { signals, loading, feedResult } = useLiveSignals(
    apiBase,
    mergedWatchlists,
    refreshTick,
  );
  useEffect(() => {
    setLiveSignals(signals, loading, feedResult);
  }, [signals, loading, feedResult, setLiveSignals]);

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

function PageSwitch({ page }: { page: string }): JSX.Element {
  switch (page) {
    case "overview":
      return <PageOverview />;
    case "live":
      return <PageLive />;
    case "sources":
      return <PageSources />;
    case "archive":
      return <PageArchive />;
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
}
