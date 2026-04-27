import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import type { Signal } from "../types";
import { Att, Conf } from "./common";
import { formatRelative } from "../lib/export";

interface SignalCardProps {
  s: Signal;
}

const SG_CLASS: Record<string, string> = {
  Senate: "sg-senate",
  House: "sg-house",
  Library: "sg-lib",
  Custom: "sg-custom",
};

export function SignalCard({ s }: SignalCardProps): JSX.Element | null {
  const { openSignal, state, lastSessionTime } = useStore();
  if (state.archived[s.id]) return null;
  const feedback = state.feedback[s.id];
  const hasNote = !!state.notes?.[s.id];
  const hasBrief = !!state.briefsGenerated?.[s.id];
  const isNew = lastSessionTime > 0 && !!s.pubMs && s.pubMs > lastSessionTime;

  const dateStamp = s.date !== "—" ? `${s.date} · ` : "";
  const age = s.pubMs ? formatRelative(new Date(s.pubMs)) : null;
  const sgClass = SG_CLASS[s.sourceGroup] ?? "";

  return (
    <button
      type="button"
      className={`signal att-${s.attention}`}
      onClick={() => openSignal(s.id)}
      aria-label={`Open signal ${s.id}: ${s.title}`}
    >
      <div className="sig-head">
        <span className="sig-id mono">{s.id}</span>
        <span className={`badge ${sgClass}`} style={{ fontSize: 9.5, padding: "1px 5px" }}>
          {s.sourceGroup}
        </span>
        {isNew && (
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--mono)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ok)",
              background: "#84c79c18",
              border: "1px solid #84c79c50",
              borderRadius: 4,
              padding: "1px 5px",
            }}
            title="Published after your last session"
          >
            new
          </span>
        )}
        <Att level={s.attention} />
        <span className="sig-time mono">{dateStamp}{s.time}</span>
        {age && (
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-4)", marginLeft: 4 }}
            title={`Published: ${s.date} ${s.time}`}
          >
            {age}
          </span>
        )}
      </div>
      <div className="sig-title serif">{s.title}</div>
      <div className="sig-sum">{s.summary}</div>
      <div className="sig-tags">
        {s.tags.map((t) => (
          <span key={`${t.l}-${t.c ?? "default"}`} className={`tag ${t.c ?? ""}`}>
            {t.l}
          </span>
        ))}
      </div>
      <div className="sig-action">
        <span className="sig-action-label">Action</span>
        <span className="sig-action-value">{s.action}</span>
        <Conf n={s.confidence} />
        <span className="sig-action-reason">{s.actionReason}</span>
      </div>
      {(feedback || hasNote || hasBrief) && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {feedback && (
            <span style={{ fontSize: 11.5, color: "var(--brass)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="check" size={12} style={{ verticalAlign: "-2px" }} />
              {feedback.label}
            </span>
          )}
          {hasNote && (
            <span
              title="You have a note on this signal"
              style={{
                fontSize: 10,
                color: "var(--caution)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
                padding: "1px 5px",
                background: "#e0b55818",
                border: "1px solid #e0b55840",
                borderRadius: 4,
              }}
            >
              note
            </span>
          )}
          {hasBrief && (
            <span
              title="Brief generated for this signal"
              style={{
                fontSize: 10,
                color: "var(--teal)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
                padding: "1px 5px",
                background: "#58b9ad18",
                border: "1px solid #58b9ad40",
                borderRadius: 4,
              }}
            >
              briefed
            </span>
          )}
        </div>
      )}
    </button>
  );
}
