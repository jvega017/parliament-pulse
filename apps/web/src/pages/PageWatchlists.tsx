import { useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { WATCHLISTS } from "../data/fixtures";

export function PageWatchlists(): JSX.Element {
  const { openModal, createWatchlist, deleteWatchlist, state } = useStore();
  const [newName, setNewName] = useState("");
  const [newTerms, setNewTerms] = useState("");
  const userWatchlistNames = new Set(state.watchlistCreated.map((w) => w.name));
  const all = [...WATCHLISTS, ...state.watchlistCreated];

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Workflow</div>
          <h1 className="page-title">Watchlists</h1>
          <div className="page-sub">
            Click any watchlist for matches and configuration. Create a new
            watchlist to add your own keyword terms to the live scoring engine.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="New watchlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="search"
            style={{ padding: "7px 10px", minWidth: 180 }}
            aria-label="New watchlist name"
          />
          <input
            placeholder="Terms: ai, automation, mygov"
            value={newTerms}
            onChange={(e) => setNewTerms(e.target.value)}
            className="search"
            style={{ padding: "7px 10px", minWidth: 240 }}
            aria-label="Comma-separated terms to match in RSS titles"
          />
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              const terms = newTerms
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);
              createWatchlist(name, terms);
              setNewName("");
              setNewTerms("");
            }}
          >
            <Icon name="plus" size={13} /> Create
          </button>
        </div>
      </div>

      <div className="grid g-3">
        {all.map((w) => {
          const max = Math.max(...w.trend, 1);
          const isUser = userWatchlistNames.has(w.name);
          return (
            <div
              key={w.name}
              className="wl"
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => openModal({ kind: "watchlist", id: w.name })}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  textAlign: "left",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="wl-name">{w.name}</span>
                  {isUser && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: "var(--teal)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      custom
                    </span>
                  )}
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
              {isUser && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete watchlist "${w.name}"?`)) {
                      deleteWatchlist(w.name);
                    }
                  }}
                  aria-label={`Delete watchlist ${w.name}`}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: 4,
                    background: "transparent",
                    border: 0,
                    color: "var(--ink-3)",
                    cursor: "pointer",
                    borderRadius: 4,
                  }}
                  title="Delete this user watchlist"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
