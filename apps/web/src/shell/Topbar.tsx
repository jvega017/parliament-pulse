import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { APH_FEEDS } from "../data/fixtures";
import { ENTITIES } from "../data/entities";
import { applyTheme, readTheme } from "./theme";
import { fetchMembers, type MemberRow } from "../lib/archive";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

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
  const { liveCount, totalCount, liveLabel } = useMemo(() => {
    if (!liveFeedResult) return { liveCount: 0, totalCount: APH_FEEDS.length, liveLabel: "polling…" };
    const statuses = Object.values(liveFeedResult.feedStatus);
    const ok = statuses.filter((s) => s.ok).length;
    const total = statuses.length;
    return { liveCount: ok, totalCount: total, liveLabel: `${ok}/${total} live` };
  }, [liveFeedResult]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => readTheme());
  const [asyncMembers, setAsyncMembers] = useState<MemberRow[]>([]);
  const apiBase = import.meta.env.VITE_API_BASE ?? "";
  const onToggleTheme = useCallback((): void => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      if (typeof window !== "undefined") window.localStorage.setItem("pp.theme", next);
      return next;
    });
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

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
      } else if (e.key === "Escape" && openRef.current) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // open read via ref — no re-registration on every open/close

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
    type FlatItem = {
      kind: "live" | "sig" | "bill" | "comm" | "mem" | "feed";
      id: string;
      label: string;
      sub: string;
      subColor?: string;
      action: () => void;
    };
    if (!q.trim()) return [] as FlatItem[];
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
    const staticMemberIds = new Set(mem.map((m) => m.id));
    const d1Members = asyncMembers.filter((m) => !staticMemberIds.has(m.mpid));

    const SG_COLOR: Record<string, string> = {
      Senate: "var(--source-senate)",
      House: "var(--source-house)",
      Library: "var(--source-lib)",
      Custom: "var(--source-custom)",
    };
    return [
      ...liveMatches.map((s) => ({
        kind: "live" as const,
        id: `live-${s.id}`,
        label: s.title,
        sub: `LIVE · ${s.id} · ${s.sourceGroup}`,
        subColor: SG_COLOR[s.sourceGroup] ?? "var(--ink-4)",
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
      ...d1Members.map((m) => ({
        kind: "mem" as const,
        id: `mem-d1-${m.mpid}`,
        label: m.name,
        sub: `${m.party ?? m.chamber} · D1`,
        action: () => { openModal({ kind: "member", id: m.mpid }); setOpen(false); },
      })),
      ...feeds.slice(0, 4).map((f) => ({
        kind: "feed" as const,
        id: `feed-${f.id}`,
        label: f.name,
        sub: f.group,
        action: () => { openModal({ kind: "feed", id: f.id }); setOpen(false); },
      })),
    ] as FlatItem[];
  }, [q, liveSignals, openSignal, openModal, asyncMembers]);

  // Async D1 member search — fires when query is 3+ chars.
  useEffect(() => {
    if (q.trim().length < 3 || !apiBase) { setAsyncMembers([]); return; }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      fetchMembers({ q: q.trim() }, ctrl.signal)
        .then(r => setAsyncMembers(r.members.slice(0, 4)))
        .catch(() => {});
    }, 300);
    return () => { window.clearTimeout(id); ctrl.abort(); };
  }, [q, apiBase]);

  useEffect(() => { setActiveIdx(0); }, [q]);

  const hasQuery = q.trim().length > 0;
  const empty = hasQuery && flat.length === 0;

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

  const topLiveHighId = useMemo(
    () => liveSignals.find((s) => s.attention === "high")?.id ?? liveSignals[0]?.id ?? null,
    [liveSignals],
  );

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
            const val = e.target.value;
            setQ(val);
            setOpen(val.length > 0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          role="combobox"
          aria-expanded={open && (flat.length > 0 || empty)}
          aria-controls={empty ? "search-empty" : "search-results"}
          aria-activedescendant={flat[activeIdx]?.id}
          aria-autocomplete="list"
          placeholder="Search live signals, committees, watchlists, feeds…"
          aria-label="Global search"
        />
        <span className="kbd" aria-hidden="true">
          {IS_MAC ? "⌘K" : "Ctrl+K"}
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
                <span className="k" style={item.subColor ? { color: item.subColor } : undefined}>{item.sub}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
        {open && empty && (
          <div id="search-empty" className="search-results" role="listbox" aria-label="No search results">
            <div className="sr-item" style={{ color: "var(--ink-3)", cursor: "default" }}>
              No matches for &ldquo;{q}&rdquo; — try a signal title, committee name, or watchlist term.
            </div>
          </div>
        )}
      </div>
      <div className="top-right">
        <button
          type="button"
          className="chip clk"
          onClick={() => goto("live")}
          aria-label="Go to Live parliament page"
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
        <button
          type="button"
          className="chip clk"
          onClick={() => goto("sources")}
          aria-label="Source health — go to Sources page"
          title={
            liveFeedResult
              ? `Last poll ${liveFeedResult.lastPoll.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}. Click to open Sources.`
              : "Awaiting first poll of APH feeds — click to open Sources"
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
        </button>
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
