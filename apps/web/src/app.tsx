import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { Drawer } from "./shell/Drawer";
import { BriefPrint } from "./shell/BriefPrint";
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
import { useLiveSignals } from "./lib/useLiveSignals";
import { WATCHLISTS } from "./data/fixtures";
import { useStore } from "./store/useStore";

export function App(): JSX.Element {
  const [page, setPage] = useState<string>("overview");

  return (
    <StoreProvider page={page} setPage={setPage}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <LiveSignalsPump />
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
      </div>
    </StoreProvider>
  );
}

function LiveSignalsPump(): null {
  // Single app-wide poll pushed into the store so every page reads from
  // the same live-signal list. User watchlists merged with fixture watchlists
  // so user-created ones actually contribute to scoring.
  const apiBase = import.meta.env.VITE_API_BASE ?? "";
  const { state, setLiveSignals } = useStore();
  const mergedWatchlists = useMemo(
    () => [...WATCHLISTS, ...state.watchlistCreated],
    [state.watchlistCreated],
  );
  const { signals, loading, feedResult } = useLiveSignals(apiBase, mergedWatchlists);
  useEffect(() => {
    setLiveSignals(signals, loading, feedResult);
  }, [signals, loading, feedResult, setLiveSignals]);
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
