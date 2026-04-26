import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store/useStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { buildBriefMarkdown } from "../lib/export";
import { SCORE_LABELS } from "../lib/constants";
import type { Signal } from "../types";

function findSignal(id: string, live: Signal[]): Signal | null {
  return live.find((s) => s.id === id) ?? null;
}

function today(): string {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  });
}

function nowAEST(): string {
  return new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST";
}

function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type Classification = "OFFICIAL" | "OFFICIAL: SENSITIVE";

/**
 * Print-ready brief document.
 * Renders full-screen when open. The "Print" button calls window.print();
 * the print CSS in global.css hides everything except .brief-print so the
 * user can save the result as a PDF via the browser's print dialog.
 */
export function BriefPrint(): JSX.Element | null {
  const { briefSignalId, liveSignals, closeBrief, toast } = useStore();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [classification, setClassification] = useState<Classification>("OFFICIAL");
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

  // If a deep-link refers to a signal id that does not exist after a poll,
  // close and strip the URL param rather than render a blank overlay.
  useEffect(() => {
    if (!briefSignalId || signal) return;
    const t = window.setTimeout(() => {
      if (briefSignalId && !signal) {
        toast(`Brief target ${briefSignalId} not found`, "warn");
        closeBrief();
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("brief");
          window.history.replaceState({}, "", url.toString());
        } catch {
          // ignore
        }
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [briefSignalId, signal, closeBrief, toast]);

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
          Brief preview · {isLive ? "live APH RSS" : "archived item"}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value as Classification)}
            aria-label="Document classification"
            className="no-print"
            style={{
              padding: "5px 8px",
              background: "var(--panel-2)",
              color: classification === "OFFICIAL: SENSITIVE" ? "var(--caution)" : "var(--ink)",
              border: "1px solid var(--line-2)",
              borderRadius: 6,
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              letterSpacing: "0.06em",
            }}
          >
            <option value="OFFICIAL">OFFICIAL</option>
            <option value="OFFICIAL: SENSITIVE">OFFICIAL: SENSITIVE</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => {
              downloadMarkdown(
                `${signal.id}-brief.md`,
                buildBriefMarkdown(signal, SCORE_LABELS),
              );
              toast("Brief downloaded as Markdown", "brass");
            }}
          >
            <Icon name="download" size={13} /> Download .md
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.clipboard
                ?.writeText(buildBriefMarkdown(signal, SCORE_LABELS))
                .then(() => toast("Brief copied to clipboard as Markdown", "brass"))
                .catch(() => toast("Copy failed"));
            }}
          >
            <Icon name="download" size={13} /> Copy Markdown
          </button>
          <button
            type="button"
            className="btn"
            title="Copy deep-link to this brief"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set("brief", signal.id);
              navigator.clipboard
                ?.writeText(url.toString())
                .then(() => toast("Brief link copied", "brass"))
                .catch(() => toast("Copy failed"));
            }}
          >
            <Icon name="link" size={13} /> Share link
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => window.print()}
          >
            <Icon name="print" size={13} /> Print / save as PDF
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
          <div className="brief-print-kicker">
            Parliament Pulse · Executive brief · {isLive ? "Live APH RSS" : "Archived item"}
          </div>
          <h1 id="brief-title">{signal.title}</h1>
          <div className="brief-print-meta">
            {today()} · {signal.id} · Confidence {signal.confidence}/5 ·
            Attention {signal.attention.toUpperCase()} ·
            {isLive ? " LIVE" : " ARCHIVED"}
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
          <p>
            {signal.source} published this item on {signal.date} at {signal.time}.
            Source authority: {signal.sourceAuthority}. Access the primary source directly
            via the Evidence links below. The signal was scored by the Parliament Pulse
            live engine against {signal.tags.filter((t) => t.c === "brass").map((t) => t.l).join(", ") || "no configured watchlists"}.
          </p>
        </section>

        <section>
          <h2>Evidence</h2>
          <ul>
            {signal.evidence.map((e) => (
              <li key={e.url}>
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
                  <th scope="row">{SCORE_LABELS[k] ?? k}</th>
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
            {signal.confidence}/5. This brief is machine-generated and
            requires human review before release.
          </p>
        </section>

        <section>
          <h2>Human review</h2>
          <p>
            <strong>{signal.humanReview}.</strong> To be cleared by the
            nominated policy owner before issue.
          </p>
          <dl className="brief-print-clear">
            <dt>Classification</dt>
            <dd>{classification} (confirm before issue)</dd>
            <dt>Action by</dt>
            <dd>_________________</dd>
            <dt>Cleared by</dt>
            <dd>_________________</dd>
            <dt>Document number</dt>
            <dd>_________________</dd>
          </dl>
        </section>

        <footer className="brief-print-foot">
          Source: Parliament of Australia website. Generated by Parliament
          Pulse, {nowAEST()}. Classification: {classification}.
        </footer>
      </article>
    </div>
  );
}

// buildBriefText replaced by buildBriefMarkdown (lib/export.ts) which
// emits Markdown so the clipboard paste preserves structure in Word.
