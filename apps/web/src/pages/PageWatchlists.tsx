import { useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { WATCHLISTS } from "../data/fixtures";

export function PageWatchlists(): JSX.Element {
  const { openModal, createWatchlist, state } = useStore();
  const [newName, setNewName] = useState("");
  const all = [...WATCHLISTS, ...state.watchlistCreated];

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Watchlists</h1>
          <div className="page-sub">
            The relevance engine. Click any watchlist for matches and
            configuration.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="New watchlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="search"
            style={{ padding: "7px 10px" }}
            aria-label="New watchlist name"
          />
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (newName.trim()) {
                createWatchlist(newName.trim());
                setNewName("");
              }
            }}
          >
            <Icon name="plus" size={13} /> Create
          </button>
        </div>
      </div>

      <div className="grid g-3">
        {all.map((w) => {
          const max = Math.max(...w.trend, 1);
          return (
            <button
              key={w.name}
              type="button"
              className="wl"
              onClick={() => openModal({ kind: "watchlist", id: w.name })}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="wl-name">{w.name}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--brass)",
                    background: "#e0935912",
                    border: "1px solid #e0935944",
                    padding: "1px 6px",
                    borderRadius: 4,
                    marginLeft: "auto",
                  }}
                >
                  {w.matches} matches
                </span>
              </div>
              <div className="wl-meta">
                <span>{w.keywords} keywords</span>
                <span>·</span>
                <span>7-day</span>
              </div>
              <div className="spark" style={{ marginTop: 2 }}>
                {w.trend.map((v, i) => (
                  <span key={i} style={{ height: `${(v / max) * 20 + 2}px` }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
