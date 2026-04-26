import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import type { Signal } from "../types";
import { Att, Conf } from "./common";
import { formatRelative } from "../lib/export";

interface SignalCardProps {
  s: Signal;
}

export function SignalCard({ s }: SignalCardProps): JSX.Element | null {
  const { openSignal, state } = useStore();
  if (state.archived[s.id]) return null;
  const feedback = state.feedback[s.id];

  const dateStamp = s.date !== "—" ? `${s.date} · ` : "";
  const age = s.pubMs ? formatRelative(new Date(s.pubMs)) : null;

  return (
    <button
      type="button"
      className="signal"
      onClick={() => openSignal(s.id)}
      aria-label={`Open signal ${s.id}: ${s.title}`}
    >
      <div className="sig-head">
        <span className="sig-id mono">{s.id}</span>
        <span className="sig-source mono">· {s.source}</span>
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
      {feedback && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--brass)" }}>
          <Icon
            name="check"
            size={12}
            style={{ verticalAlign: "-2px", marginRight: 4 }}
          />{" "}
          Feedback: {feedback.label}
        </div>
      )}
    </button>
  );
}
