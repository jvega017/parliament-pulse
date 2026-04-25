import { Icon } from "../icons";

// Build SHA injected at build time via Vite env. Allows beta testers to
// reference an exact deployed commit when filing feedback. Falls back to
// "dev" in local dev where the env var is not set.
const BUILD_SHA = (import.meta.env.VITE_COMMIT_SHA ?? "dev").slice(0, 7);
// App version from package.json, also injected at build time via define().
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

export function DemoBanner(): JSX.Element {
  return (
    <aside
      aria-label="Sample data notice"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        marginBottom: 16,
        background:
          "linear-gradient(90deg, #e0b55814 0%, #e0b5580a 60%, transparent 100%)",
        border: "1px solid #e0b55835",
        borderRadius: 10,
        fontSize: 12,
        color: "var(--ink-2)",
        boxShadow: "var(--shadow-xs), inset 0 1px 0 #ffffff04",
      }}
    >
      <Icon name="flag" size={14} stroke="var(--caution)" />
      <span style={{ flex: 1 }}>
        <strong style={{ color: "var(--caution)" }}>Sample data.</strong> Members,
        ministers, bills, committees and figures on this page are sample data
        only. Live APH RSS appears on the Overview and Live parliament pages.
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
    </aside>
  );
}
