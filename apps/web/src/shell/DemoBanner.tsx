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
        Committees, and Watchlists. Member, minister, and division detail are
        deferred — those surfaces link out to{" "}
        <a
          href="https://www.aph.gov.au"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--teal)" }}
        >
          aph.gov.au
        </a>{" "}
        until ingest lands. No data is fabricated; deferred surfaces show honest
        empty states.
      </span>
      <a
        href="https://github.com/jvega017/parliament-pulse/blob/main/STATUS.md"
        target="_blank"
        rel="noopener noreferrer"
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--ink-3)",
          letterSpacing: "0.08em",
          textDecoration: "none",
        }}
        title={`Deployed build: v${APP_VERSION} at commit ${BUILD_SHA}. Click for status page.`}
      >
        v{APP_VERSION} · {BUILD_SHA}
      </a>
    </aside>
  );
}
