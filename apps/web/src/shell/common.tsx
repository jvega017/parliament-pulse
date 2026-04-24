import { Icon } from "../icons";
import type { AttentionLevel } from "../types";

interface AttProps {
  level: AttentionLevel;
}

const ATT_LABELS: Record<AttentionLevel, string> = {
  high: "High",
  med: "Medium",
  low: "Low",
};

export function Att({ level }: AttProps): JSX.Element {
  return <span className={`att ${level}`}>{ATT_LABELS[level]}</span>;
}

interface ConfProps {
  n?: number;
}

export function Conf({ n = 3 }: ConfProps): JSX.Element {
  return (
    <span className="conf" title={`Confidence ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "on" : ""} />
      ))}
    </span>
  );
}

interface ModalHeadProps {
  kicker: string;
  title: string;
  onClose: () => void;
}

export function ModalHead({ kicker, title, onClose }: ModalHeadProps): JSX.Element {
  return (
    <div className="modal-head">
      <div style={{ flex: 1 }}>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            color: "var(--ink-3)",
            textTransform: "uppercase",
            letterSpacing: "0.16em",
          }}
        >
          {kicker}
        </div>
        <h2
          id="modal-title"
          className="serif"
          style={{ fontSize: 22, margin: "4px 0 0", fontWeight: 500, lineHeight: 1.25 }}
        >
          {title}
        </h2>
      </div>
      <button
        type="button"
        className="btn ghost sm"
        onClick={onClose}
        style={{ flex: "none" }}
        aria-label="Close dialog"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
