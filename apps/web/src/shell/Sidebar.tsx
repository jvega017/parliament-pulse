import { useId } from "react";
import { Icon, type IconName } from "../icons";
import { useStore } from "../store/useStore";

interface NavItem {
  id: string;
  label: string;
  group: "Today" | "Intelligence" | "Configuration";
  count: number | null;
  live?: boolean;
}

// Counts removed where they would lie. Only show counts that derive from
// real data; for the rest, leave count null. Briefings moved to Today
// because brief production is part of the morning workflow, not back-office.
// Parliament item renamed to 'Today in chamber' to distinguish it from
// the broader Parliament group label.
// Three groups, each with a distinct purpose. The previous "Today / Parliament"
// split caused a naming collision with "Live parliament" and "Today in chamber".
// Groups are now: Today (morning workflow), Intelligence (analysis surfaces),
// Configuration (admin and tool setup).
const NAV: NavItem[] = [
  { id: "overview", label: "Overview", group: "Today", count: null },
  { id: "live", label: "Live parliament", group: "Today", count: null, live: true },
  { id: "radar", label: "Attention radar", group: "Today", count: null },
  { id: "briefings", label: "Briefings", group: "Today", count: null },
  { id: "parliament", label: "Today in chamber", group: "Intelligence", count: null },
  { id: "committees", label: "Committees", group: "Intelligence", count: null },
  { id: "bills", label: "Bills intelligence", group: "Intelligence", count: null },
  { id: "patterns", label: "QON patterns", group: "Intelligence", count: null },
  { id: "watchlists", label: "Watchlists", group: "Configuration", count: null },
  { id: "sources", label: "Sources", group: "Configuration", count: null },
];

const ICONS: Record<string, IconName> = {
  overview: "overview",
  radar: "radar",
  committees: "committee",
  bills: "bill",
  parliament: "parliament",
  patterns: "pattern",
  briefings: "brief",
  watchlists: "watch",
  sources: "sources",
  live: "signal",
};

interface SidebarProps {
  page: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ page, onNavigate }: SidebarProps): JSX.Element {
  const groups: NavItem["group"][] = ["Today", "Intelligence", "Configuration"];
  const { mobileNavOpen, closeMobileNav } = useStore();
  // useId ensures the SVG gradient id is unique per render so concurrent
  // sidebar instances (mobile overlay + desktop) do not share a defs id.
  const flameId = `flame-${useId()}`;

  return (
    <>
      {mobileNavOpen && (
        <div
          className="mobile-overlay"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}
      <aside
        className={`side${mobileNavOpen ? " mobile-open" : ""}`}
        aria-label="Primary navigation"
      >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 2 C 7 5, 6 9, 8 12 C 5 11, 4 13, 5 15 C 6 17, 9 18, 11 18 C 13 18, 16 17, 17 15 C 18 13, 17 11, 14 12 C 16 9, 15 5, 11 2 Z"
              fill={`url(#${flameId})`}
              opacity="0.92"
            />
            <path
              d="M11 6 C 9 8, 9 11, 11 13 C 13 11, 13 8, 11 6 Z"
              fill="#fff5e8"
              opacity="0.9"
            />
            <defs>
              <linearGradient id={flameId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5b36a" />
                <stop offset="100%" stopColor="#e09359" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <div className="brand-name">Parliament Pulse</div>
          <div className="brand-sub">Prometheus Policy Lab</div>
        </div>
      </div>
      <nav className="nav" aria-label="Sections">
        {groups.map((g) => (
          <div key={g}>
            <div className="nav-group">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = page === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`nav-item${active ? " active" : ""}`}
                  onClick={() => onNavigate(n.id)}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    name={ICONS[n.id] ?? "overview"}
                    size={16}
                    strokeWidth={1.8}
                    className="ico"
                  />
                  <span>{n.label}</span>
                  {n.live && (
                    <span
                      className="count"
                      style={{
                        color: "#fff",
                        background: "var(--escalate)",
                        animation: "pulse 1.8s infinite",
                      }}
                    >
                      LIVE
                    </span>
                  )}
                  {!n.live && n.count !== null && <span className="count">{n.count}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <div className="avatar" aria-hidden="true">
          EM
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Erin Marlowe</div>
          <div
            style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)" }}
          >
            Demo user
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
