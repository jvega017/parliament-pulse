// Archive client. Calls the Worker /archive endpoints.

export interface ArchiveRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_url: string;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  last_seen_at: string;
  attention: string | null;
  confidence: number | null;
  entities_json: string | null;
  scoring_explanation: string | null;
}

export interface ArchiveQueryParams {
  from?: string;
  to?: string;
  kind?: string;
  source_group?: string;
  attention?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AlertRule {
  id: number;
  name: string;
  terms: string;
  attention_min: "high" | "med" | "low";
  source_group: string | null;
  kind: string | null;
  created_at: string;
  active: number;
}

export interface AlertEvent {
  id: number;
  rule_id: number;
  rule_name: string;
  signal_guid: string;
  fired_at: string;
  title: string;
  link: string;
  attention: string;
}

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
}

export async function fetchArchive(params: ArchiveQueryParams, signal?: AbortSignal): Promise<{
  rows: ArchiveRow[];
  total: number;
}> {
  const u = new URL(`${apiBase()}/archive`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) throw new Error(`archive ${res.status}`);
  return (await res.json()) as { rows: ArchiveRow[]; total: number };
}

export async function fetchAnalytics(
  terms: string[],
  from?: string,
  to?: string,
  signal?: AbortSignal,
): Promise<{ series: Array<{ term: string; count: number; last_seen: string | null }> }> {
  const u = new URL(`${apiBase()}/archive/analytics`);
  u.searchParams.set("terms", terms.join(","));
  if (from) u.searchParams.set("from", from);
  if (to) u.searchParams.set("to", to);
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) throw new Error(`analytics ${res.status}`);
  return (await res.json()) as { series: Array<{ term: string; count: number; last_seen: string | null }> };
}

export interface ConnectorHealth {
  url: string;
  checked_at: string | null;
  ok: number;
  status: number | null;
  error: string | null;
}

export async function fetchConnectorHealth(signal?: AbortSignal): Promise<{
  ok: boolean;
  connectors: ConnectorHealth[];
}> {
  const u = `${apiBase()}/healthz/connectors`;
  const res = await fetch(u, { signal });
  if (!res.ok) throw new Error(`healthz/connectors ${res.status}`);
  return (await res.json()) as { ok: boolean; connectors: ConnectorHealth[] };
}

export async function subscribeDigest(payload: {
  email: string;
  watchlists: string;
  attention_min: "high" | "med" | "low";
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${apiBase()}/digest/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  return { ok: !!json.ok };
}

export async function fetchTimeline(
  params: { from?: string; to?: string; kind?: string; source_group?: string },
  signal?: AbortSignal,
): Promise<{ days: Array<{ day: string; total: number; high: number; med: number; low: number }> }> {
  const u = new URL(`${apiBase()}/archive/timeline`);
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) throw new Error(`timeline ${res.status}`);
  return (await res.json()) as { days: Array<{ day: string; total: number; high: number; med: number; low: number }> };
}

export async function fetchAlertRules(signal?: AbortSignal): Promise<{ rules: AlertRule[] }> {
  const res = await fetch(`${apiBase()}/alerts`, { signal });
  if (!res.ok) throw new Error(`alerts ${res.status}`);
  return (await res.json()) as { rules: AlertRule[] };
}

export async function createAlertRule(body: {
  name: string;
  terms: string;
  attention_min: "high" | "med" | "low";
  source_group?: string;
  kind?: string;
}, signal?: AbortSignal): Promise<{ id: number }> {
  const res = await fetch(`${apiBase()}/alerts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`create alert ${res.status}`);
  return (await res.json()) as { id: number };
}

export async function deleteAlertRule(id: number): Promise<void> {
  const res = await fetch(`${apiBase()}/alerts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete alert ${res.status}`);
}

export async function fetchAlertEvents(limit = 50, signal?: AbortSignal): Promise<{ events: AlertEvent[] }> {
  const u = new URL(`${apiBase()}/alerts/events`);
  u.searchParams.set("limit", String(limit));
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) throw new Error(`alert events ${res.status}`);
  return (await res.json()) as { events: AlertEvent[] };
}

export function downloadArchiveCsv(rows: ArchiveRow[], filename: string): void {
  const cols: Array<keyof ArchiveRow> = [
    "pub_date",
    "title",
    "attention",
    "confidence",
    "feed_label",
    "source_group",
    "kind",
    "link",
    "first_seen_at",
    "guid",
  ];
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
