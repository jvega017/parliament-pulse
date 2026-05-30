import { useState } from "react";
import { Icon } from "../icons";

const BUILD_SHA = (import.meta.env.VITE_COMMIT_SHA ?? "dev").slice(0, 7);
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";
const DISMISS_KEY = "pp-demobanner-dismissed";
const DISMISS_TTL_MS = 7 * 24 * 3_600_000; // re-show after 7 days

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch { return false; }
}

export function DemoBanner(): JSX.Element | null {
  const [dismissed, setDismissed] = useState(() => isDismissed());

  if (dismissed) return null;

  function dismiss(): void {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* quota */ }
    setDismissed(true);
  }

  return (
    <aside
      aria-label="Limited beta scope"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        marginBottom: 16,
        background:
          "linear-gradient(90deg, #58b9ad14 0%, #58b9ad0a 60%, transparent 100%)",
        border: "1px solid #58b9ad35",
        borderRadius: 10,
        fontSize: 12,
        color: "var(--ink-2)",
        boxShadow: "var(--shadow-xs), inset 0 1px 0 #ffffff04",
      }}
    >
      <Icon name="signal" size={14} stroke="var(--teal)" />
      <span style={{ flex: 1 }}>
        <strong style={{ color: "var(--teal)" }}>Limited beta.</strong> Live
        APH RSS (8 feeds) drives Overview, Live, Radar, Briefings, Bills Digests,
        Committees, Watchlists, Archive, and Alerts. QON patterns and Bills
        archive draw from D1. House member detail and division vote records link
        out to{" "}
        <a
          href="https://www.aph.gov.au"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--teal)" }}
        >
          aph.gov.au
        </a>{" "}
        until full ingest lands. No data is fabricated.
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--ink-3)",
          letterSpacing: "0.08em",
        }}
        title={`Deployed build: v${APP_VERSION} at commit ${BUILD_SHA}`}
      >
        v{APP_VERSION} · {BUILD_SHA}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this notice for 7 days"
        style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: "0 0 0 8px" }}
      >
        <Icon name="close" size={13} />
      </button>
    </aside>
  );
}
