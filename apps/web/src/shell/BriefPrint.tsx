import { useEffect, useRef } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { SIGNALS } from "../data/fixtures";
import type { Signal } from "../types";

function findSignal(id: string, live: Signal[]): Signal | null {
  return live.find((s) => s.id === id) ?? SIGNALS.find((s) => s.id === id) ?? null;
}

function today(): string {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Print-ready brief document.
 * Renders full-screen when open. The "Print" button calls window.print();
 * the print CSS in global.css hides everything except .brief-print so the
 * user can save the result as a PDF via the browser's print dialog.
 */
export function BriefPrint(): JSX.Element | null {
  const { briefSignalId, liveSignals, closeBrief, toast } = useStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  useFocusTrap(overlayRef, !!briefSignalId);

  useEffect(() => {
    if (!briefSignalId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBrief();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [briefSignalId, closeBrief]);

  const signal = briefSignalId ? findSignal(briefSignalId, liveSignals) : null;
  if (!signal) return null;

  const isLive = liveSignals.some((s) => s.id === signal.id);

  return (
    <div
      ref={overlayRef}
      className="brief-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brief-title"
    >
      <div className="brief-overlay-bar no-print">
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          Brief preview · {isLive ? "from live APH RSS" : "from sample data"}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.clipboard
                ?.writeText(buildBriefText(signal))
                .then(() => toast("Brief copied to clipboard", "brass"))
                .catch(() => toast("Copy failed"));
            }}
          >
            <Icon name="download" size={13} /> Copy text
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => window.print()}
          >
            <Icon name="download" size={13} /> Print / save as PDF
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={closeBrief}
            aria-label="Close brief"
          >
            <Icon name="close" size={13} /> Close
          </button>
        </div>
      </div>

      <article className="brief-print">
        <header className="brief-print-head">
          <div className="brief-print-kicker">Parliament Pulse · Prometheus Policy Lab</div>
          <h1 id="brief-title">{signal.title.replace(/^\[Sample\]\s*/, "")}</h1>
          <div className="brief-print-meta">
            {today()} · Executive brief · {signal.id} ·{" "}
            Confidence {signal.confidence}/5 · Attention {signal.attention.toUpperCase()}
          </div>
        </header>

        <section>
          <h2>Recommended action (BLUF)</h2>
          <p>
            <strong>{signal.action}.</strong> {signal.actionReason}
          </p>
        </section>

        <section>
          <h2>Why it matters</h2>
          <p>{signal.attentionReason}</p>
        </section>

        <section>
          <h2>Summary</h2>
          <p>{signal.summary}</p>
        </section>

        <section>
          <h2>What happened</h2>
          <p>{signal.title}. Retrieved from {signal.source} on {signal.date}.</p>
        </section>

        <section>
          <h2>Evidence</h2>
          <ul>
            {signal.evidence.map((e, i) => (
              <li key={i}>
                {e.label} — <span className="brief-print-url">{e.url}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Attention score breakdown</h2>
          <table className="brief-print-table">
            <tbody>
              {Object.entries(signal.score).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{Math.round(v * 100)} / 100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {signal.provenance.length > 0 && (
          <section>
            <h2>Provenance</h2>
            <table className="brief-print-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>By</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {signal.provenance.map((p, i) => (
                  <tr key={i}>
                    <td>{p.ts}</td>
                    <td>{p.by}</td>
                    <td>{p.event}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>Uncertainty</h2>
          <p>
            Source authority: {signal.sourceAuthority}. Analyst confidence:{" "}
            {signal.confidence}/5. This brief is generated from an automated
            scoring pipeline and requires human review before release.
          </p>
        </section>

        <section>
          <h2>Human review</h2>
          <p>
            <strong>{signal.humanReview}.</strong> To be cleared by the
            nominated policy owner before issue.
          </p>
        </section>

        <footer className="brief-print-foot">
          Source: Parliament of Australia website · Generated by Parliament
          Pulse · {new Date().toLocaleString("en-AU")}
        </footer>
      </article>
    </div>
  );
}

function buildBriefText(signal: Signal): string {
  const lines = [
    `PARLIAMENT PULSE — EXECUTIVE BRIEF`,
    `${today()} · ${signal.id}`,
    ``,
    `TITLE`,
    signal.title,
    ``,
    `SUMMARY`,
    signal.summary,
    ``,
    `WHY IT MATTERS`,
    signal.attentionReason,
    ``,
    `RECOMMENDED ACTION`,
    `${signal.action}. ${signal.actionReason}`,
    ``,
    `EVIDENCE`,
    ...signal.evidence.map((e) => `- ${e.label}: ${e.url}`),
    ``,
    `ATTENTION ${signal.attention.toUpperCase()} · CONFIDENCE ${signal.confidence}/5`,
    `Source authority: ${signal.sourceAuthority} · Human review: ${signal.humanReview}`,
  ];
  return lines.join("\n");
}
