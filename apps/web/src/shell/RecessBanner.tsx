import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { APH_FEED_URLS } from "../lib/aphFeed";

const APH_SITTING_CALENDAR =
  "https://www.aph.gov.au/About_Parliament/House_of_Representatives/Business_of_the_House/Sitting_Dates";
const SENATE_PROGRAM =
  "https://parlwork.aph.gov.au/Senate/DynamicRed";

function formatNextPoll(ms: number): string {
  if (ms <= 120_000) return "every 2 minutes";
  const mins = Math.round(ms / 60_000);
  return `every ${mins} minutes`;
}

/**
 * Global recess banner — renders between Topbar and main content.
 * Auto-detects "quiet" state: all feeds healthy, zero items returned.
 * This is the strongest browser-side signal that parliament is not sitting.
 * Hidden during loading, during sitting weeks, and when the Worker is offline
 * (feed errors prevent the "all feeds OK" condition from being met).
 */
export function RecessBanner(): JSX.Element | null {
  const { liveSignals, liveLoading, liveFeedResult, livePollIntervalMs } = useStore();

  // Wait for first poll to complete before making any judgment.
  if (liveLoading && liveFeedResult === null) return null;
  if (liveFeedResult === null) return null;

  const feedStatuses = Object.values(liveFeedResult.feedStatus);
  const feedsTotal = feedStatuses.length || APH_FEED_URLS.length;
  const feedsOk = feedStatuses.filter((s) => s.ok).length;

  // Only show when ALL feeds are healthy AND returned nothing.
  // If some feeds are failing, that's a connectivity issue — not recess.
  // Require at least half the feeds to be responding to avoid false positives
  // during startup or partial Worker outage.
  const allFeedsOk = feedsTotal > 0 && feedsOk === feedsTotal;
  const isQuiet = allFeedsOk && liveSignals.length === 0 && !liveLoading;

  if (!isQuiet) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Parliament recess status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 20px",
        background:
          "linear-gradient(90deg, #e0b55812 0%, #e0b5580a 60%, transparent 100%)",
        borderBottom: "1px solid #e0b55830",
        fontSize: 12,
        color: "var(--ink-2)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Icon
        name="clock"
        size={14}
        stroke="var(--caution)"
        style={{ flexShrink: 0, marginTop: 1 }}
      />
      <div style={{ flex: 1, lineHeight: 1.5 }}>
        <strong style={{ color: "var(--caution)" }}>
          Parliament is not currently sitting.
        </strong>{" "}
        All {feedsOk}/{feedsTotal} APH RSS feeds are reachable but returned no
        new items — the expected state during a recess week. Feeds resume
        automatically when a chamber sits.{" "}
        <a
          href={APH_SITTING_CALENDAR}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--teal)" }}
        >
          House sitting dates
        </a>
        {" · "}
        <a
          href={SENATE_PROGRAM}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--teal)" }}
        >
          Senate program
        </a>
        {" · "}
        Archive, alerts, and watchlists remain fully operational.{" "}
        <span
          className="mono"
          style={{ fontSize: 10.5, color: "var(--ink-3)", marginLeft: 4 }}
        >
          Polling slowed to {formatNextPoll(livePollIntervalMs)} to reduce load on APH.
        </span>
      </div>
    </aside>
  );
}
