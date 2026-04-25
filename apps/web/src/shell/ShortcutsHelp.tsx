import { useEffect, useRef } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { useFocusTrap } from "../lib/useFocusTrap";

const SHORTCUTS: Array<{ keys: string[]; desc: string }> = [
  { keys: ["Ctrl", "K"], desc: "Open global search" },
  { keys: ["/"], desc: "Focus global search" },
  { keys: ["?"], desc: "Open this keyboard shortcuts list" },
  { keys: ["Esc"], desc: "Close drawer, modal, brief, or search" },
  { keys: ["Tab"], desc: "Move keyboard focus forward" },
  { keys: ["Shift", "Tab"], desc: "Move keyboard focus back" },
  { keys: ["Enter"], desc: "Activate focused control" },
  { keys: ["↑", "↓"], desc: "Move through search results" },
];

export function ShortcutsHelp(): JSX.Element | null {
  const { shortcutsOpen, toggleShortcuts } = useStore();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, shortcutsOpen);

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === "?" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        toggleShortcuts();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggleShortcuts]);

  if (!shortcutsOpen) return null;

  return (
    <div className="modal-back" onClick={toggleShortcuts} aria-hidden="true">
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.16em",
              }}
            >
              Help
            </div>
            <h2
              id="shortcuts-title"
              className="serif"
              style={{ fontSize: 22, margin: "4px 0 0", fontWeight: 500 }}
            >
              Keyboard shortcuts
            </h2>
          </div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={toggleShortcuts}
            aria-label="Close shortcuts help"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="modal-body">
          <dl className="kv" style={{ gridTemplateColumns: "180px 1fr" }}>
            {SHORTCUTS.map((s) => (
              <div key={s.desc} style={{ display: "contents" }}>
                <dt style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {s.keys.map((k) => (
                    <kbd key={k} className="kbd">
                      {k}
                    </kbd>
                  ))}
                </dt>
                <dd>{s.desc}</dd>
              </div>
            ))}
          </dl>
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "#ffffff04",
              border: "1px dashed var(--line-2)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            Shortcuts work from anywhere in the app. Typing inside a text input
            disables <kbd className="kbd">/</kbd> and <kbd className="kbd">?</kbd> to
            avoid conflicts.
          </div>
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="btn ghost"
            style={{ marginLeft: "auto" }}
            onClick={toggleShortcuts}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
