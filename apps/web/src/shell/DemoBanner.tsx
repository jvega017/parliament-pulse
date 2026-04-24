import { Icon } from "../icons";

// Build SHA injected at build time via Vite env. Allows beta testers to
// reference an exact deployed commit when filing feedback. Falls back to
// "dev" in local dev where the env var is not set.
const BUILD_SHA = (import.meta.env.VITE_COMMIT_SHA ?? "dev").slice(0, 7);

export function DemoBanner(): JSX.Element {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        marginBottom: 16,
        background:
          "linear-gradient(90deg, #d9a94a12 0%, #d9a94a06 60%, transparent 100%)",
        border: "1px solid #d9a94a40",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--ink-2)",
      }}
    >
      <Icon name="flag" size={14} stroke="var(--caution)" />
      <span style={{ flex: 1 }}>
        <strong style={{ color: "var(--caution)" }}>Sample data.</strong> Members,
        ministers, bills, committees and counts on this page are sample
        personas for design review. Only the Live parliament page polls real
        APH RSS feeds and the AUSParliamentLive broadcast.
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--ink-3)",
          letterSpacing: "0.08em",
        }}
        title="Deployed build (commit SHA, first 7 chars)"
      >
        build {BUILD_SHA}
      </span>
    </div>
  );
}
