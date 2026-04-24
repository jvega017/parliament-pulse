import { Icon } from "../icons";

// Top-of-page banner that makes the beta status of fixture-backed modules
// explicit. Shown on every page except Live (which polls real APH feeds).
// Visible reminder that members, ministers, bills and statistics are sample
// personas, not real parliamentarians.
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
      <span>
        <strong style={{ color: "var(--caution)" }}>Sample data.</strong> Members,
        ministers, bills, committees and counts on this page are sample
        personas for design review. Only the Live parliament page polls real
        APH RSS feeds and the AUSParliamentLive broadcast.
      </span>
    </div>
  );
}
