import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { QON_PATTERN } from "../data/fixtures";

function memberIdFor(who: string): string {
  if (who.includes("Hollis")) return "hollis";
  if (who.includes("Quirke")) return "quirke";
  return "rafferty";
}

export function PagePatterns(): JSX.Element {
  const { openModal, toast } = useStore();

  return (
    <div className="page-fade">
      <div className="page-head">
        <div>
          <div className="page-kicker">Parliament · Scrutiny</div>
          <h1 className="page-title">QON pattern engine</h1>
          <div className="page-sub">
            Detects clustered scrutiny across members, topics and targets. Click
            any member to open their profile.
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "10px 14px",
          background: "#7ba0d410",
          border: "1px solid #7ba0d433",
          borderRadius: 8,
          marginBottom: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          color: "var(--ink-2)",
          fontSize: 12.5,
        }}
      >
        <Icon name="flag" size={14} stroke="var(--info)" />
        <span>
          <strong>Design-state module.</strong> Direct QON feed not yet
          connected. The pattern below uses sample scrutiny data. Status visible
          on Sources page.
        </span>
      </div>

      <div className="pattern">
        <div className="ribbon">Clustered pattern · medium confidence</div>
        <div
          className="serif"
          style={{ fontSize: 22, fontWeight: 500, marginBottom: 6, paddingRight: 200 }}
        >
          Clustered scrutiny pattern on digital procurement governance
        </div>
        <div style={{ color: "var(--ink-2)", fontSize: 13.5, maxWidth: 720 }}>
          4 related questions lodged by 3 members within 48 hours, all targeting
          digital services portfolio. Trigger likely: ANAO report tabled 22 Apr.
          Cross-source reinforcement with today's Senate inquiry.
        </div>

        <div className="grid g-4" style={{ marginTop: 16, marginBottom: 18 }}>
          <PatternStat label="Members" value={String(QON_PATTERN.members.length)} />
          <PatternStat label="Questions" value={String(QON_PATTERN.count)} />
          <PatternStat label="Window" value={QON_PATTERN.window} />
          <PatternStat label="Target" value={QON_PATTERN.target} small />
        </div>

        <div style={{ borderTop: "1px dashed var(--line-2)", paddingTop: 14 }}>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              marginBottom: 8,
            }}
          >
            Evidence · click member for profile
          </div>
          {QON_PATTERN.items.map((q, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 200px 1fr 90px",
                gap: 12,
                padding: "8px 0",
                borderBottom:
                  i < QON_PATTERN.items.length - 1
                    ? "1px solid var(--line)"
                    : 0,
                alignItems: "start",
                fontSize: 12.5,
              }}
            >
              <div className="mono" style={{ color: "var(--ink-3)" }}>{q.when}</div>
              <div>
                <button
                  type="button"
                  className="tag brass clk"
                  onClick={() =>
                    openModal({ kind: "member", id: memberIdFor(q.who) })
                  }
                >
                  {q.who}
                </button>
              </div>
              <div style={{ color: "var(--ink-2)" }}>{q.q}</div>
              <div style={{ textAlign: "right" }}>
                <span className="tag">{q.chamber}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => toast("Estimates monitor note drafted", "brass")}
          >
            <Icon name="brief" size={13} /> Draft Estimates monitor note
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => toast("Cluster tracked", "brass")}
          >
            <Icon name="watch" size={13} /> Track cluster
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => toast("Cluster confirmed as coordinated", "brass")}
          >
            <Icon name="check" size={13} /> Confirm as coordinated
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => toast("Marked as coincidence")}
          >
            Mark as coincidence
          </button>
        </div>
      </div>
    </div>
  );
}

function PatternStat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}): JSX.Element {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: small ? 13 : 18, marginTop: 4, lineHeight: 1.25 }}>
        {value}
      </div>
    </div>
  );
}
