import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/Store";
import { APH_FEEDS, SIGNALS } from "../data/fixtures";
import { ENTITIES } from "../data/entities";

export function Topbar(): JSX.Element {
  const { openModal, openSignal, toast, goto } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
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

  const results = useMemo(() => {
    if (!q.trim()) return null;
    const term = q.toLowerCase();
    return {
      sig: SIGNALS.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.summary.toLowerCase().includes(term) ||
          s.id.toLowerCase().includes(term),
      ),
      bills: Object.values(ENTITIES.bills).filter(
        (b) =>
          b.title.toLowerCase().includes(term) || b.ref.toLowerCase().includes(term),
      ),
      comm: Object.values(ENTITIES.committees).filter((c) =>
        c.name.toLowerCase().includes(term),
      ),
      mem: Object.values(ENTITIES.members).filter((m) =>
        m.name.toLowerCase().includes(term),
      ),
      feeds: APH_FEEDS.filter((f) => f.name.toLowerCase().includes(term)),
    };
  }, [q]);

  const empty =
    results &&
    !results.sig.length &&
    !results.bills.length &&
    !results.comm.length &&
    !results.mem.length &&
    !results.feeds.length;

  return (
    <div className="topbar">
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
          placeholder="Search signals, bills, committees, members, feeds..."
          aria-label="Global search"
        />
        <span className="kbd" aria-hidden="true">
          Ctrl+K
        </span>
        {open && results && (
          <div className="search-results" role="listbox">
            {results.sig.length > 0 && (
              <>
                <div className="sr-group">Signals</div>
                {results.sig.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="sr-item"
                    onClick={() => {
                      openSignal(s.id);
                      setOpen(false);
                    }}
                  >
                    <span className="k">{s.id}</span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </>
            )}
            {results.bills.length > 0 && (
              <>
                <div className="sr-group">Bills</div>
                {results.bills.map((b) => (
                  <button
                    key={b.ref}
                    type="button"
                    className="sr-item"
                    onClick={() => {
                      openModal({ kind: "bill", id: b.ref });
                      setOpen(false);
                    }}
                  >
                    <span className="k">{b.ref}</span>
                    <span>{b.title}</span>
                  </button>
                ))}
              </>
            )}
            {results.comm.length > 0 && (
              <>
                <div className="sr-group">Committees</div>
                {results.comm.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="sr-item"
                    onClick={() => {
                      openModal({ kind: "committee", id: c.id });
                      setOpen(false);
                    }}
                  >
                    <span className="k">{c.chamber}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </>
            )}
            {results.mem.length > 0 && (
              <>
                <div className="sr-group">Members</div>
                {results.mem.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="sr-item"
                    onClick={() => {
                      openModal({ kind: "member", id: m.id });
                      setOpen(false);
                    }}
                  >
                    <span className="k">{m.party}</span>
                    <span>{m.name}</span>
                  </button>
                ))}
              </>
            )}
            {results.feeds.length > 0 && (
              <>
                <div className="sr-group">Sources</div>
                {results.feeds.slice(0, 4).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="sr-item"
                    onClick={() => {
                      openModal({ kind: "feed", id: f.id });
                      setOpen(false);
                    }}
                  >
                    <span className="k">{f.group}</span>
                    <span>{f.name}</span>
                  </button>
                ))}
              </>
            )}
            {empty && (
              <div
                className="sr-item"
                style={{ color: "var(--ink-3)", cursor: "default" }}
              >
                No matches for "{q}"
              </div>
            )}
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
        <span className="chip">
          <span className="dot" /> 14/15 sources
        </span>
        <button
          type="button"
          className="btn ghost sm"
          title="Refresh all feeds"
          onClick={() => toast("Feeds refreshed")}
        >
          <Icon name="refresh" size={13} /> Refresh
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => toast("3 new alerts")}
        >
          <Icon name="bell" size={13} /> Alerts
        </button>
        <button
          type="button"
          className="btn primary sm"
          onClick={() => toast("Brief generator opened", "brass")}
        >
          <Icon name="plus" size={13} /> New brief
        </button>
      </div>
    </div>
  );
}
