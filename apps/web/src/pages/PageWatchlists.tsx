import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import { useStore } from "../store/useStore";
import { WATCHLISTS } from "../data/fixtures";
import type { Watchlist } from "../types";

export function PageWatchlists(): JSX.Element {
  const { openModal, createWatchlist, deleteWatchlist, state, liveSignals, confirm } = useStore();
  const [newName, setNewName] = useState("");
  const [newTerms, setNewTerms] = useState("");
  const userWatchlistNames = new Set(state.watchlistCreated.map((w) => w.name));
  const all = useMemo(() => [...WATCHLISTS, ...state.watchlistCreated], [state.watchlistCreated]);

  // Live match count per watchlist. The scoring engine has already tagged
  // each signal with matchedWatchlists; we just count.
  const liveMatchCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of all) counts[w.name] = 0;
    for (const s of liveSignals) {
      // matchedWatchlists is encoded into the brass tag for live items
      // (see lib/scoring.tagsFor); we look at the raw signal for portfolio
      // detail by comparing terms against the title.
      const title = s.title.toLowerCase();
      for (const w of all) {
        if (w.terms.some((t) => t && title.includes(t.toLowerCase()))) {
          counts[w.name] = (counts[w.name] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [liveSignals, all]);

  const renderCard = (w: Watchlist): JSX.Element => {
    const matches = liveMatchCount[w.name] ?? 0;
    const isUser = userWatchlistNames.has(w.name);
    return (
      <div key={w.name} className="wl" style={{ position: "relative" }}>
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
                color: matches > 0 ? "var(--brass)" : "var(--ink-3)",
                background: matches > 0 ? "var(--brass-tint-bg)" : "transparent",
                border: matches > 0 ? "1px solid var(--brass-tint-border)" : "1px solid var(--line)",
                padding: "1px 6px",
                borderRadius: 4,
                marginLeft: "auto",
              }}
            >
              {matches} live match{matches === 1 ? "" : "es"}
            </span>
          </div>
          <div className="wl-meta">
            <span>{w.terms.length} terms</span>
            <span>·</span>
            <span>{matches > 0 ? "active" : "watching"}</span>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={w.terms.join(", ")}
          >
            {w.terms.slice(0, 4).join(", ")}
            {w.terms.length > 4 ? "…" : ""}
          </div>
        </button>
        {isUser && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm(
                `Delete the "${w.name}" watchlist? This removes the keywords from live scoring; you can recreate it at any time.`,
                {
                  title: `Delete "${w.name}"?`,
                  confirmLabel: "Delete",
                  destructive: true,
                },
              );
              if (ok) deleteWatchlist(w.name);
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
  };

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Configuration</div>
          <h1 className="page-title">Watchlists</h1>
          <div className="page-sub">
            Each watchlist is a set of keywords scored against every live RSS
            item. Match counts below are computed from the current poll.
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

      <div className="grid g-3">{all.map(renderCard)}</div>
    </div>
  );
}
