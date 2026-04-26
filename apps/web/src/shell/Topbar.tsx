import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { APH_FEEDS } from "../data/fixtures";
import { ENTITIES } from "../data/entities";
import { applyTheme, readTheme } from "./theme";

export function Topbar(): JSX.Element {
  const {
    openModal,
    openSignal,
    goto,
    liveSignals,
    liveFeedResult,
    openBrief,
    triggerRefresh,
    toggleMobileNav,
    toggleShortcuts,
    density,
    setDensity,
  } = useStore();
  // Source-health is derived from the live poll, not the fixture table, so
  // the chip never claims sources are live when the proxy is failing.
  const liveCount = liveFeedResult
    ? Object.values(liveFeedResult.feedStatus).filter((s) => s.ok).length
    : 0;
  const totalCount = liveFeedResult
    ? Object.keys(liveFeedResult.feedStatus).length
    : APH_FEEDS.length;
  const liveLabel = liveFeedResult
    ? `${liveCount}/${totalCount} live`
    : "polling…";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => readTheme());
  const onToggleTheme = (): void => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    if (typeof window !== "undefined") window.localStorage.setItem("pp.theme", next);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inTextField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "/" && !inTextField) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Flattened list of results so arrow keys can move through any group.
  const flat = useMemo(() => {
    if (!q.trim()) return [] as Array<{
      kind: "live" | "sig" | "bill" | "comm" | "mem" | "feed";
      id: string;
      label: string;
      sub: string;
      action: () => void;
    }>;
    const term = q.toLowerCase();
    const liveMatches = liveSignals
      .filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.summary.toLowerCase().includes(term) ||
          s.id.toLowerCase().includes(term),
      )
      .slice(0, 6);
    const bills = Object.values(ENTITIES.bills).filter(
      (b) =>
        b.title.toLowerCase().includes(term) || b.ref.toLowerCase().includes(term),
    );
    const comm = Object.values(ENTITIES.committees).filter((c) =>
      c.name.toLowerCase().includes(term),
    );
    const mem = Object.values(ENTITIES.members).filter((m) =>
      m.name.toLowerCase().includes(term),
    );
    const feeds = APH_FEEDS.filter((f) => f.name.toLowerCase().includes(term));

    return [
      ...liveMatches.map((s) => ({
        kind: "live" as const,
        id: `live-${s.id}`,
        label: s.title,
        sub: `LIVE · ${s.id} · ${s.sourceGroup}`,
        action: () => { openSignal(s.id); setOpen(false); },
      })),
      ...bills.map((b) => ({
        kind: "bill" as const,
        id: `bill-${b.ref}`,
        label: b.title,
        sub: b.ref,
        action: () => { openModal({ kind: "bill", id: b.ref }); setOpen(false); },
      })),
      ...comm.map((c) => ({
        kind: "comm" as const,
        id: `comm-${c.id}`,
        label: c.name,
        sub: c.chamber,
        action: () => { openModal({ kind: "committee", id: c.id }); setOpen(false); },
      })),
      ...mem.map((m) => ({
        kind: "mem" as const,
        id: `mem-${m.id}`,
        label: m.name,
        sub: m.party,
        action: () => { openModal({ kind: "member", id: m.id }); setOpen(false); },
      })),
      ...feeds.slice(0, 4).map((f) => ({
        kind: "feed" as const,
        id: `feed-${f.id}`,
        label: f.name,
        sub: f.group,
        action: () => { openModal({ kind: "feed", id: f.id }); setOpen(false); },
      })),
    ];
  }, [q, liveSignals, openSignal, openModal]);

  useEffect(() => { setActiveIdx(0); }, [q]);

  const empty = q.trim().length > 0 && flat.length === 0;

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIdx]?.action();
    } else if (e.key === "Tab") {
      // Close the dropdown on Tab so aria-expanded does not lie about
      // dropdown state once focus has moved on. Default Tab behaviour
      // (move to next focusable) is preserved.
      setOpen(false);
    }
  };

  const topLiveHighId =
    liveSignals.find((s) => s.attention === "high")?.id ??
    liveSignals[0]?.id ??
    null;

  return (
    <div className="topbar">
      <button
        type="button"
        className="mobile-toggle"
        aria-label="Toggle navigation"
        onClick={toggleMobileNav}
      >
        <Icon name="filter" size={18} />
      </button>
      <div className="search" ref={containerRef}>
        <Icon name="search" size={14} stroke="var(--ink-3)" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          role="combobox"
          aria-expanded={open && flat.length > 0}
          aria-controls="search-results"
          aria-activedescendant={flat[activeIdx]?.id}
          aria-autocomplete="list"
          placeholder="Search live signals, committees, watchlists, feeds…"
          aria-label="Global search"
        />
        <span className="kbd" aria-hidden="true">
          Ctrl+K
        </span>
        {open && flat.length > 0 && (
          <div id="search-results" className="search-results" role="listbox">
            {flat.map((item, i) => (
              <button
                key={item.id}
                id={item.id}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className="sr-item"
                style={i === activeIdx ? { background: "#ffffff08" } : undefined}
                onClick={item.action}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="k">{item.sub}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
        {open && empty && (
          <div id="search-results" className="search-results" role="listbox">
            <div className="sr-item" style={{ color: "var(--ink-3)", cursor: "default" }}>
              No matches for "{q}"
            </div>
          </div>
        )}
      </div>
      <div className="top-right">
        <button
          type="button"
          className="chip clk"
          onClick={() => goto("live")}
          style={{
            borderColor: "var(--escalate)",
            color: "#fff",
            background: "#d06a5e1a",
          }}
        >
          <span
            className="dot"
            style={{ background: "var(--escalate)", animation: "pulse 1.4s infinite" }}
          />{" "}
          Parliament live
        </button>
        <span
          className="chip"
          title={
            liveFeedResult
              ? `Last poll ${liveFeedResult.lastPoll.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}. Status reflects the most recent fetch through the aph-proxy Worker.`
              : "Awaiting first poll of APH feeds"
          }
        >
          <span
            className="dot"
            style={{
              background:
                !liveFeedResult
                  ? "var(--ink-4)"
                  : liveCount === totalCount
                    ? "var(--ok)"
                    : liveCount === 0
                      ? "var(--escalate)"
                      : "var(--caution)",
            }}
          />{" "}
          {liveLabel}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          title="Force a fresh poll of all APH feeds"
          onClick={triggerRefresh}
        >
          <Icon name="refresh" size={13} /> Refresh
        </button>
        <button
          type="button"
          className="btn ghost sm"
          title={
            density === "compact"
              ? "Switch to comfortable density"
              : "Switch to compact density"
          }
          aria-label={`Current density ${density}. Click to toggle.`}
          aria-pressed={density === "compact"}
          onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
        >
          {density === "compact" ? "Comfy" : "Compact"}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={`Current theme ${theme}. Click to toggle.`}
          aria-pressed={theme === "light"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          title="Keyboard shortcuts (press ?)"
          aria-label="Keyboard shortcuts"
          onClick={toggleShortcuts}
        >
          <kbd className="kbd" aria-hidden="true" style={{ padding: "1px 6px" }}>?</kbd>
        </button>
        <button
          type="button"
          className="btn primary sm"
          disabled={!topLiveHighId}
          title={
            topLiveHighId
              ? "Open print-ready brief for the top live signal"
              : "Waiting for live signals"
          }
          onClick={() => {
            if (topLiveHighId) openBrief(topLiveHighId);
          }}
        >
          <Icon name="plus" size={13} /> New brief
        </button>
      </div>
    </div>
  );
}
