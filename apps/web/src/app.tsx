import { useState } from "react";
import { Sidebar } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { Drawer } from "./shell/Drawer";
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

export function App(): JSX.Element {
  const [page, setPage] = useState<string>("overview");

  return (
    <StoreProvider page={page} setPage={setPage}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
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
      </div>
    </StoreProvider>
  );
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
