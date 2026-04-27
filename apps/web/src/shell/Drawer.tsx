import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { ENTITIES } from "../data/entities";
import { useFocusTrap } from "../lib/useFocusTrap";
import { exportSignalCsv } from "../lib/export";
import { SCORE_LABELS, SCORE_WEIGHTS } from "../lib/constants";
import { Att, Conf } from "./common";

const FEEDBACK_LABELS = [
  "Correct priority",
  "Too high",
  "Too low",
  "Wrong topic",
  "Wrong portfolio",
  "Duplicate",
  "Noise",
  "Needs human review",
];

export function Drawer(): JSX.Element {
  const {
    signalId,
    closeSignal,
    state,
    liveSignals,
    saveFeedback,
    archive,
    addWatchlist,
    saveNote,
    openModal,
    openBrief,
    toast,
  } = useStore();

  const signal = useMemo(() => {
    if (!signalId) return null;
    return liveSignals.find((s) => s.id === signalId) ?? null;
  }, [signalId, liveSignals]);

  // Deep-link with a non-existent signal id should not leave a blank
  // drawer open. Wait until live signals have arrived (or 4 s pass) before
  // declaring the id missing, then close and clean the URL.
  useEffect(() => {
    if (!signalId || signal) return;
    // If liveSignals is still loading, wait one cycle.
    const t = window.setTimeout(() => {
      if (signalId && !signal) {
        toast(`Signal ${signalId} not found`, "warn");
        closeSignal();
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("signal");
          window.history.replaceState({}, "", url.toString());
        } catch {
          // ignore
        }
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [signalId, signal, closeSignal, toast]);

  const [fb, setFb] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!signalId) return;
    setFb(state.feedback[signalId]?.label ?? null);
    setNote(state.notes[signalId] ?? "");
  }, [signalId, state.feedback, state.notes]);

  const on = !!signal;
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, on);

  return (
    <>
      <div
        className={`drawer-back${on ? " on" : ""}`}
        onClick={closeSignal}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={`drawer${on ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-hidden={!on}
      >
        {signal && (
          <>
            <div className="drawer-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="mono u-uppercase"
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-3)",
                  }}
                >
                  {signal.id} · {signal.sourceGroup} · {signal.date}
                </div>
                <div
                  id="drawer-title"
                  className="serif"
                  style={{
                    fontSize: 20,
                    marginTop: 4,
                    maxWidth: 460,
                    lineHeight: 1.25,
                  }}
                >
                  {signal.title}
                </div>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                style={{ marginLeft: "auto" }}
                onClick={closeSignal}
                aria-label="Close signal drawer"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">
                <h4>Summary</h4>
                <p>{signal.summary}</p>
              </div>

              <div className="drawer-section">
                <h4>Signal metadata</h4>
                <dl className="kv">
                  <dt>Source</dt>
                  <dd>{signal.source}</dd>
                  <dt>Source group</dt>
                  <dd>{signal.sourceGroup}</dd>
                  <dt>Authority</dt>
                  <dd>{signal.sourceAuthority}</dd>
                  <dt>Attention</dt>
                  <dd>
                    <Att level={signal.attention} />
                  </dd>
                  <dt>Confidence</dt>
                  <dd>
                    <Conf n={signal.confidence} />
                    <span
                      style={{
                        color: "var(--ink-3)",
                        marginLeft: 8,
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                      }}
                    >
                      {signal.confidence}/5
                    </span>
                  </dd>
                  <dt>Human review</dt>
                  <dd>{signal.humanReview}</dd>
                </dl>
              </div>

              <div className="drawer-section">
                <h4>Why it matters</h4>
                <p>{signal.attentionReason}</p>
              </div>

              {signal.scoringExplanation && (
                <div className="drawer-section">
                  <h4>
                    Scoring basis
                    <span
                      style={{ marginLeft: 8, fontWeight: 400, fontSize: 11, color: "var(--teal)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
                    >
                      [deterministic · no AI]
                    </span>
                  </h4>
                  <div className="callout callout-info" style={{ fontSize: 12.5 }}>
                    {signal.scoringExplanation}
                  </div>
                </div>
              )}

              {(signal.entities?.length ?? 0) > 0 && (
                <div className="drawer-section">
                  <h4>Extracted entities</h4>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {signal.entities!.map((e, i) => (
                      <span
                        key={i}
                        className={`badge ${e.kind === "bill" ? "badge-teal" : "badge-warn"}`}
                        title={e.text}
                        style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {e.kind === "bill" ? "Bill" : "$"} {e.text.length > 50 ? `${e.text.slice(0, 50)}…` : e.text}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
                    Extracted by regex from RSS title and description — verify against primary source.
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <h4>Recommended action</h4>
                <div
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--brass-tint-border)",
                    borderRadius: 8,
                    background: "var(--brass-tint-bg)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--brass)" }}>
                    {signal.action}
                  </div>
                  <div
                    style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 4 }}
                  >
                    {signal.actionReason}
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <h4>
                  Attention score breakdown
                  <span
                    title="Weighted sum: authority 0.25, portfolio 0.35, novelty 0.10, time 0.20, scrutiny 0.10. Momentum shown as batch co-occurrence (weight=0, display only). Ops zeroed. High ≥0.65, medium ≥0.40."
                    style={{
                      marginLeft: 8,
                      cursor: "help",
                      color: "var(--ink-3)",
                      fontWeight: 400,
                    }}
                  >
                    (how?)
                  </span>
                </h4>
                {Object.entries(signal.score).map(([k, v]) => {
                  const weight = SCORE_WEIGHTS[k] ?? 0;
                  const zeroed = weight === 0;
                  const contribution = Math.round(v * weight * 100);
                  const scorePct = Math.round(v * 100);
                  const barLevel = zeroed ? "low" : scorePct >= 70 ? "ok" : scorePct >= 40 ? "mid" : "low";
                  return (
                  <div
                    key={k}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px 1fr 36px 40px 32px",
                      gap: 8,
                      alignItems: "center",
                      padding: "4px 0",
                      opacity: zeroed ? 0.45 : 1,
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                      {SCORE_LABELS[k] ?? k}
                    </div>
                    <div
                      className="bar"
                      role="progressbar"
                      aria-valuenow={scorePct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${SCORE_LABELS[k] ?? k} score ${scorePct}%`}
                      data-level={barLevel}
                    >
                      <div className="fill" style={{ width: `${scorePct}%` }} />
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}
                    >
                      {Math.round(v * 100)}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 10, color: "var(--ink-4)", textAlign: "right" }}
                      title={zeroed ? "Weight zeroed — not yet wired" : `Weight: ${Math.round(weight * 100)}%`}
                    >
                      {zeroed ? "—" : `×${Math.round(weight * 100)}%`}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        textAlign: "right",
                        color: zeroed ? "var(--ink-4)" : contribution > 10 ? "var(--brass)" : "var(--ink-3)",
                      }}
                      title={zeroed ? "Not counted" : `Contributes ${contribution} pts to overall score`}
                    >
                      {zeroed ? "—" : `=${contribution}`}
                    </div>
                  </div>
                  );
                })}
              </div>

              {signal.evidence.length > 0 && (
              <div className="drawer-section">
                <h4>Evidence · open the actual source</h4>
                {signal.evidence.map((e) => (
                  <div
                    key={e.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        border: "1px solid var(--line-2)",
                        borderRadius: 8,
                        color: "var(--ink)",
                        textDecoration: "none",
                        flex: 1,
                        fontSize: 13,
                        minWidth: 0,
                      }}
                    >
                      <Icon name="link" size={14} stroke="var(--teal)" />
                      <span>{e.label}</span>
                      <span
                        className="mono"
                        style={{
                          color: "var(--ink-3)",
                          fontSize: 11,
                          marginLeft: "auto",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.url.replace(/^https?:\/\//, "")}
                      </span>
                      <Icon name="ext" size={12} stroke="var(--ink-3)" />
                    </a>
                    <button
                      type="button"
                      className="btn ghost sm"
                      title="Copy URL to clipboard"
                      onClick={() =>
                        navigator.clipboard
                          ?.writeText(e.url)
                          .then(() => toast("URL copied", "brass"))
                          .catch(() => toast("Copy failed"))
                      }
                      style={{ flexShrink: 0 }}
                    >
                      <Icon name="link" size={12} />
                    </button>
                  </div>
                ))}
              </div>
              )}

              {signal.provenance.length > 0 && (
                <div className="drawer-section">
                  <h4>Provenance · how this signal was produced</h4>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-3)" }}>
                    All pipeline events are timestamped at ingest time (AEST).
                  </p>
                  <div
                    style={{
                      border: "1px solid var(--line-2)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {signal.provenance.map((p, pi) => (
                      <div
                        key={`${p.ts}-${p.by}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "78px 90px 1fr",
                          gap: 10,
                          padding: "8px 12px",
                          fontSize: 12,
                          borderBottom:
                            pi < signal.provenance.length - 1
                              ? "1px solid var(--line)"
                              : 0,
                          background: pi % 2 ? "#ffffff03" : "transparent",
                        }}
                      >
                        <div
                          className="mono"
                          style={{ color: "var(--ink-3)", fontSize: 10.5 }}
                        >
                          {p.ts}
                        </div>
                        <div>
                          <span
                            className="tag"
                            style={{ fontSize: 10.5, padding: "1px 6px" }}
                          >
                            {p.by}
                          </span>
                        </div>
                        <div style={{ color: "var(--ink-2)" }}>{p.event}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {signal.updates.length > 0 && (
                <div className="drawer-section">
                  <h4>Updates to this signal · who / what / when</h4>
                  {signal.updates.map((u, ui) => (
                    <div
                      key={`${u.ts}-${u.who}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 140px 1fr",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom:
                          ui < signal.updates.length - 1
                            ? "1px solid var(--line)"
                            : 0,
                        fontSize: 12.5,
                      }}
                    >
                      <div
                        className="mono"
                        style={{ color: "var(--ink-3)", fontSize: 11 }}
                      >
                        {u.ts}
                      </div>
                      <div style={{ color: "var(--brass)" }}>{u.who}</div>
                      <div style={{ color: "var(--ink-2)" }}>{u.what}</div>
                    </div>
                  ))}
                </div>
              )}

              {signal.members.length > 0 && (
                <div className="drawer-section">
                  <h4>People referenced</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {signal.members.map((mid) => {
                      const m = ENTITIES.members[mid];
                      if (!m) return null;
                      return (
                        <button
                          key={mid}
                          type="button"
                          className="tag brass clk"
                          onClick={() => openModal({ kind: "member", id: mid })}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <label htmlFor="analyst-note" style={{ display: "block" }}>
                  <h4>Analyst note</h4>
                </label>
                <textarea
                  id="analyst-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => saveNote(signal.id, note)}
                  placeholder="Private notes (auto-saved)"
                  rows={3}
                  aria-label={`Analyst note for signal ${signal.id}`}
                  style={{
                    width: "100%",
                    background: "var(--panel)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 8,
                    color: "var(--ink)",
                    padding: "8px 10px",
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    resize: "vertical",
                  }}
                />
              </div>

              <div className="drawer-section">
                <h4>Analyst feedback · is this right?</h4>
                <div className="feedback-row">
                  {FEEDBACK_LABELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`fb${fb === l ? " on" : ""}`}
                      onClick={() => {
                        setFb(l);
                        saveFeedback(signal.id, l);
                      }}
                    >
                      {l === "Correct priority" && (
                        <Icon
                          name="check"
                          size={12}
                          style={{ marginRight: 6, verticalAlign: "-2px" }}
                        />
                      )}
                      {l}
                    </button>
                  ))}
                </div>
                {fb && fb !== "Correct priority" && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "#ffffff04",
                      border: "1px dashed var(--line-2)",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: "var(--ink-2)",
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                      }}
                    >
                      Feedback recorded
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Feedback logged for {signal.source}. Scoring weights are static in this release and are not adjusted automatically.
                    </div>
                  </div>
                )}
                {fb === "Correct priority" && (
                  <div style={{ marginTop: 10, color: "var(--ok)", fontSize: 12.5 }}>
                    <Icon
                      name="check"
                      size={13}
                      style={{ verticalAlign: "-2px", marginRight: 4 }}
                    />
                    Feedback logged.
                  </div>
                )}
              </div>
            </div>

            <div className="drawer-foot">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  openBrief(signal.id);
                  closeSignal();
                }}
              >
                <Icon name="brief" size={13} /> Generate brief
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  exportSignalCsv(
                    signal,
                    state.owners[signal.id],
                    state.feedback[signal.id]?.label,
                  )
                }
                title="Download evidence + score matrix as CSV"
              >
                <Icon name="download" size={13} /> CSV
              </button>
              <button
                type="button"
                className="btn"
                title="Copy deep-link to this signal"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("signal", signal.id);
                  navigator.clipboard
                    ?.writeText(url.toString())
                    .then(() => toast("Signal link copied", "brass"))
                    .catch(() => toast("Copy failed"));
                }}
              >
                <Icon name="link" size={13} /> Share
              </button>
              <button
                type="button"
                className="btn"
                title="Add this signal ID to watchlist monitoring"
                onClick={() => addWatchlist(signal.id)}
              >
                <Icon name="watch" size={13} /> Watchlist
              </button>
              <button
                type="button"
                className="btn"
                title="Archive this signal — removes it from the live feed view"
                onClick={() => {
                  archive(signal.id);
                  closeSignal();
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ marginLeft: "auto" }}
                onClick={closeSignal}
              >
                Close
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
