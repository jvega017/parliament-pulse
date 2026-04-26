import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { DemoBanner } from "../shell/DemoBanner";
import {
  fetchConnectorHealth,
  subscribeDigest,
  type ConnectorHealth,
} from "../lib/archive";
import { useStore } from "../store/useStore";
import { APH_CONNECTORS } from "../data/fixtures";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";
const COMMIT_SHA = (import.meta.env.VITE_COMMIT_SHA ?? "dev").slice(0, 7);

export function PageStatus(): JSX.Element {
  const { toast } = useStore();
  const [proxyOk, setProxyOk] = useState<boolean | null>(null);
  const [proxyVersion, setProxyVersion] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorHealth[]>([]);
  const [loadingConn, setLoadingConn] = useState(true);
  const [email, setEmail] = useState("");
  const [attentionMin, setAttentionMin] = useState<"high" | "med" | "low">("high");
  const [submitting, setSubmitting] = useState(false);

  const apiBase = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

  useEffect(() => {
    if (!apiBase) return;
    const ctrl = new AbortController();
    fetch(`${apiBase}/healthz`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ ok: boolean; version?: string }>)
      .then((j) => {
        setProxyOk(j.ok);
        setProxyVersion(j.version ?? null);
      })
      .catch(() => setProxyOk(false));
    return () => ctrl.abort();
  }, [apiBase]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchConnectorHealth(ctrl.signal)
      .then((r) => setConnectors(r.connectors ?? []))
      .catch(() => setConnectors([]))
      .finally(() => setLoadingConn(false));
    return () => ctrl.abort();
  }, []);

  const onSubscribe = async (): Promise<void> => {
    if (!email) return;
    setSubmitting(true);
    const r = await subscribeDigest({ email, watchlists: "", attention_min: attentionMin });
    setSubmitting(false);
    if (r.ok) {
      toast("Digest subscription saved. Activation when delivery worker enabled.", "brass");
      setEmail("");
    } else {
      toast(`Subscription failed: ${r.error ?? "unknown"}`, "warn");
    }
  };

  return (
    <div className="page-fade">
      <DemoBanner />
      <div className="page-head">
        <div>
          <div className="page-kicker">Configuration · Status</div>
          <h1 className="page-title">Service status</h1>
          <div className="page-sub">
            Live infrastructure state and the daily digest signup. Updated on
            page load.
          </div>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="panel stat">
          <div className="stat-label">Frontend</div>
          <div className="stat-value" style={{ color: "var(--ok)" }}>
            v{APP_VERSION}
          </div>
          <div className="stat-meta">commit {COMMIT_SHA}</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Proxy worker</div>
          <div
            className="stat-value"
            style={{ color: proxyOk === null ? "var(--ink-3)" : proxyOk ? "var(--ok)" : "var(--escalate)" }}
          >
            {proxyOk === null ? "checking…" : proxyOk ? "online" : "offline"}
          </div>
          <div className="stat-meta">{proxyVersion ? `worker v${proxyVersion}` : apiBase || "no api base set"}</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Connector check</div>
          <div className="stat-value">
            {loadingConn ? "…" : `${connectors.filter((c) => c.ok).length}/${connectors.length}`}
            <span className="unit">live</span>
          </div>
          <div className="stat-meta">re-verified by cron every 14 days</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3 className="panel-title">APH connector health</h3>
          <span className="panel-kicker">{APH_CONNECTORS.length} canonical endpoints</span>
        </div>
        <div className="panel-body">
          {connectors.length === 0 && !loadingConn ? (
            <div className="empty">
              <strong>No connector checks recorded yet.</strong>
              <span>
                The fortnightly cron writes a row per check to D1. Once the
                archive Worker is deployed and the first cron has fired, results
                will appear here.
              </span>
            </div>
          ) : (
            <table className="ds">
              <thead>
                <tr>
                  <th>URL</th>
                  <th style={{ width: 120 }}>Last checked</th>
                  <th style={{ width: 90 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {connectors.map((c) => (
                  <tr key={c.url}>
                    <td>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--teal)", fontSize: 12 }}
                      >
                        {c.url.replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                      {c.checked_at ? c.checked_at.slice(0, 16).replace("T", " ") : "—"}
                    </td>
                    <td>
                      <span
                        className="tag"
                        style={{
                          color: c.ok ? "var(--ok)" : "var(--escalate)",
                          borderColor: c.ok ? "var(--ok)" : "var(--escalate)",
                        }}
                      >
                        {c.ok ? "OK" : (c.status ? `HTTP ${c.status}` : "down")}
                      </span>
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
          <h3 className="panel-title">Daily digest signup</h3>
          <span className="panel-kicker">Email when delivery worker is activated</span>
        </div>
        <div className="panel-body">
          <p style={{ marginTop: 0, color: "var(--ink-3)", fontSize: 12.5 }}>
            Subscribe to receive a daily digest of new high-attention live
            signals from the APH RSS feeds. Subscription is recorded in D1; no
            email is sent until the digest delivery worker is enabled (requires
            SendGrid credentials).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.gov.au"
              className="search"
              style={{ padding: 8, minWidth: 260 }}
            />
            <select
              value={attentionMin}
              onChange={(e) => setAttentionMin(e.target.value as "high" | "med" | "low")}
              style={{ padding: 8, background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--line-2)", borderRadius: 6 }}
            >
              <option value="high">High only</option>
              <option value="med">High + medium</option>
              <option value="low">All attention levels</option>
            </select>
            <button
              type="button"
              className="btn primary"
              disabled={!email || submitting}
              onClick={onSubscribe}
            >
              <Icon name="check" size={13} /> Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
