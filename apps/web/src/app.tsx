import { useEffect, useState } from "react";

interface ProxyHealth {
  ok: boolean;
  base: string;
  error?: string;
  items?: number;
}

async function checkProxy(base: string): Promise<ProxyHealth> {
  if (!base) {
    return { ok: false, base, error: "VITE_API_BASE not set" };
  }
  try {
    const res = await fetch(
      `${base}/rss?u=${encodeURIComponent("https://www.aph.gov.au/senate/rss/new_inquiries")}`,
      { headers: { Accept: "application/xml" } },
    );
    if (!res.ok) return { ok: false, base, error: `HTTP ${res.status}` };
    const text = await res.text();
    const items = (text.match(/<item/g) ?? []).length;
    return { ok: true, base, items };
  } catch (err) {
    return { ok: false, base, error: err instanceof Error ? err.message : "unknown" };
  }
}

export function App(): JSX.Element {
  const base = import.meta.env.VITE_API_BASE ?? "";
  const [health, setHealth] = useState<ProxyHealth | null>(null);

  useEffect(() => {
    checkProxy(base).then(setHealth);
  }, [base]);

  return (
    <main className="splash">
      <div className="splash-card">
        <div className="splash-kicker">Prometheus Policy Lab</div>
        <h1 className="splash-title serif">Parliament Pulse</h1>
        <p className="splash-sub">
          Policy intelligence dashboard for the Australian Parliament. Migration in progress
          from the JSX-in-browser prototype to a production Vite plus Cloudflare build.
        </p>

        <span className="splash-status">
          <span className="dot" /> Scaffold deployed · full port in progress
        </span>

        <dl className="splash-meta">
          <dt>Proxy base</dt>
          <dd>
            <code>{base || "(not configured)"}</code>
          </dd>
          <dt>Proxy health</dt>
          <dd>
            {health === null && "Checking..."}
            {health && health.ok && `Reachable, ${health.items ?? 0} items in sample feed`}
            {health && !health.ok && `Unreachable: ${health.error}`}
          </dd>
          <dt>Build</dt>
          <dd>
            <code>{import.meta.env.MODE}</code>
          </dd>
        </dl>
      </div>
    </main>
  );
}
