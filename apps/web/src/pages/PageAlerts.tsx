import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import {
  fetchAlertRules,
  createAlertRule,
  deleteAlertRule,
  fetchAlertEvents,
  type AlertRule,
  type AlertEvent,
} from "../lib/archive";
import { useStore } from "../store/useStore";

const KINDS = ["", "inquiry", "hearing", "report", "digest", "signal"];
const GROUPS = ["", "Senate", "House", "Library", "Custom"];

const ATT_STYLE: Record<string, { color: string; label: string }> = {
  high: { color: "var(--escalate)", label: "HIGH" },
  med:  { color: "var(--caution)",  label: "MED" },
  low:  { color: "var(--ink-4)",    label: "LOW" },
};

export function PageAlerts(): JSX.Element {
  const { toast, confirm } = useStore();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-rule form state
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState("");
  const [attMin, setAttMin] = useState<"high" | "med" | "low">("high");
  const [srcGroup, setSrcGroup] = useState("");
  const [kind, setKind] = useState("");
  const [saving, setSaving] = useState(false);

  function loadRules(): void {
    const ctrl = new AbortController();
    setRulesLoading(true);
    fetchAlertRules(ctrl.signal)
      .then((r) => setRules(r.rules))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "unavailable");
      })
      .finally(() => setRulesLoading(false));
  }

  function loadEvents(): void {
    const ctrl = new AbortController();
    setEventsLoading(true);
    fetchAlertEvents(50, ctrl.signal)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }

  useEffect(() => {
    loadRules();
    loadEvents();
  }, []);

  async function handleCreate(): Promise<void> {
    if (!name.trim()) { toast("Name required", "warn"); return; }
    setSaving(true);
    try {
      await createAlertRule({ name: name.trim(), terms, attention_min: attMin, source_group: srcGroup || undefined, kind: kind || undefined });
      toast(`Alert rule "${name.trim()}" created`, "brass");
      setName(""); setTerms(""); setAttMin("high"); setSrcGroup(""); setKind("");
      setFormOpen(false);
      loadRules();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "create failed", "warn");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: AlertRule): Promise<void> {
    const ok = await confirm(`Delete alert rule "${rule.name}"?`, { confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await deleteAlertRule(rule.id);
      toast(`Rule "${rule.name}" deleted`);
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "delete failed", "warn");
    }
  }

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Intelligence · Alerts</div>
          <h1 className="page-title">Alert rules</h1>
          <div className="page-sub">
            Rules fire when the cron poll sees a new item matching your keyword
            and metadata conditions. Events are stored in D1 — no email required.
          </div>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setFormOpen((o) => !o)}
        >
          <Icon name="plus" size={13} /> New rule
        </button>
      </div>

      {formOpen && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h3 className="panel-title">Create alert rule</h3>
          </div>
          <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
              Rule name *
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI governance"
                className="search"
                style={{ padding: 7 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
              Keywords (comma-separated)
              <input
                type="text"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="e.g. artificial intelligence, automation"
                className="search"
                style={{ padding: 7 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
              Minimum attention
              <select
                value={attMin}
                onChange={(e) => setAttMin(e.target.value as "high" | "med" | "low")}
                style={{ padding: 7, background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
              >
                <option value="high">High only</option>
                <option value="med">Med and above</option>
                <option value="low">All levels</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
              Source group (optional)
              <select
                value={srcGroup}
                onChange={(e) => setSrcGroup(e.target.value)}
                style={{ padding: 7, background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
              >
                {GROUPS.map((g) => <option key={g || "any-group"} value={g}>{g || "Any source"}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--ink-3)" }}>
              Kind (optional)
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                style={{ padding: 7, background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
              >
                {KINDS.map((k) => <option key={k || "any-kind"} value={k}>{k || "Any kind"}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="btn primary sm"
                disabled={saving}
                onClick={() => void handleCreate()}
              >
                {saving ? "Saving…" : "Create rule"}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3 className="panel-title">Rules</h3>
          <span className="panel-kicker">{rulesLoading ? "Loading…" : `${rules.length} active`}</span>
        </div>
        <div className="panel-body">
          {error && (
            <div className="empty">
              <strong>Alert rules unavailable.</strong>
              <span>The Worker D1 backend must be deployed. Check Status page.</span>
            </div>
          )}
          {!error && rules.length === 0 && !rulesLoading && (
            <div className="empty">
              <strong>No alert rules yet.</strong>
              <span>Create a rule to receive D1 events when new items match your conditions.</span>
            </div>
          )}
          {rules.length > 0 && (
            <table className="ds">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Keywords</th>
                  <th style={{ width: 90 }}>Min attention</th>
                  <th style={{ width: 90 }}>Source</th>
                  <th style={{ width: 90 }}>Kind</th>
                  <th style={{ width: 120 }}>Created</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: 500 }}>{rule.name}</td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {rule.terms || <span style={{ color: "var(--ink-4)" }}>any</span>}
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: 9.5, letterSpacing: "0.1em",
                          color: ATT_STYLE[rule.attention_min]?.color ?? "var(--ink-4)",
                        }}
                      >
                        {(ATT_STYLE[rule.attention_min]?.label ?? rule.attention_min).toUpperCase()}+
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {rule.source_group ?? <span style={{ color: "var(--ink-4)" }}>any</span>}
                    </td>
                    <td>
                      {rule.kind ? <span className="tag">{rule.kind}</span> : <span style={{ color: "var(--ink-4)", fontSize: 11 }}>any</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                      {rule.created_at?.slice(0, 10) ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => void handleDelete(rule)}
                        title="Delete rule"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Recent events</h3>
          <span className="panel-kicker">
            {eventsLoading ? "Loading…" : `Last ${events.length} firings`}
          </span>
          <button
            type="button"
            className="btn ghost sm"
            style={{ marginLeft: "auto" }}
            onClick={() => { loadRules(); loadEvents(); }}
          >
            <Icon name="refresh" size={12} /> Refresh
          </button>
        </div>
        <div className="panel-body">
          {events.length === 0 && !eventsLoading ? (
            <div className="empty">
              <strong>No events yet.</strong>
              <span>Events appear here when the cron poll finds a new item matching an active rule.</span>
            </div>
          ) : (
            <table className="ds">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Fired</th>
                  <th>Title</th>
                  <th style={{ width: 130 }}>Rule</th>
                  <th style={{ width: 70 }}>Attention</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const attStyle = ATT_STYLE[ev.attention] ?? ATT_STYLE.low;
                  return (
                    <tr key={ev.id}>
                      <td className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                        {ev.fired_at.slice(0, 16).replace("T", " ")}
                      </td>
                      <td style={{ fontSize: 13 }}>{ev.title}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--brass)" }}>
                        {ev.rule_name}
                      </td>
                      <td>
                        <span
                          className="mono"
                          style={{ fontSize: 9.5, letterSpacing: "0.1em", color: attStyle.color }}
                        >
                          {attStyle.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <a
                          href={ev.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono"
                          style={{ color: "var(--teal)", fontSize: 11 }}
                        >
                          Open ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
