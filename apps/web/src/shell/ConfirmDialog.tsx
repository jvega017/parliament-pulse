import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";

// Replaces native window.confirm() with a styled, focus-trapped modal that
// matches the rest of the app. Trigger via store.confirm("message"); the
// caller awaits a Promise<boolean>.

export function ConfirmDialog(): JSX.Element | null {
  const { confirmRequest, resolveConfirm } = useStore();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmRequest) return;
    confirmBtnRef.current?.focus();
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") resolveConfirm(false);
      if (e.key === "Enter") resolveConfirm(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmRequest, resolveConfirm]);

  if (!confirmRequest) return null;
  const { msg, title, confirmLabel, cancelLabel, destructive } = confirmRequest;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        background: "#000a",
        backdropFilter: "blur(6px)",
      }}
      onClick={() => resolveConfirm(false)}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          padding: 24,
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--line-bright)",
        }}
      >
        <h3
          id="confirm-title"
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontFamily: "var(--serif)",
            fontSize: 18,
          }}
        >
          {title ?? "Are you sure?"}
        </h3>
        <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.55 }}>{msg}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => resolveConfirm(false)}
          >
            {cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`btn ${destructive ? "" : "primary"}`}
            style={
              destructive
                ? { background: "var(--escalate)", color: "#fff", border: "1px solid var(--escalate)" }
                : undefined
            }
            onClick={() => resolveConfirm(true)}
          >
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
