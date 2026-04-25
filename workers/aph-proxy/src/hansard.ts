// Hansard QON ingest — skeleton.
// Wire-compatible D1 schema is in 0001_signals.sql (qons table). The actual
// ingest is intentionally minimal: it issues a ParlInfo full-text query for
// "questions on notice" and inserts a row per result link. The richer NER
// pipeline (member resolution, target identification, paragraph extraction)
// is a follow-up.

import type { Env } from "./archive";

const PARLINFO_BASE = "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p";
const USER_AGENT =
  "parliament-pulse/0.10 (+https://github.com/jvega019/parliament-pulse)";

export async function ingestQons(env: Env, sinceIso?: string): Promise<{
  added: number;
  attempted: number;
}> {
  const since = sinceIso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    query: "Dataset:qon",
    page: "1",
    resCount: "50",
  });
  const url = `${PARLINFO_BASE}?${params.toString()}`;

  let html = "";
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) return { added: 0, attempted: 0 };
    html = await res.text();
  } catch {
    return { added: 0, attempted: 0 };
  }

  // Naive extraction — pull every result link of the form `/parlInfo/...?fileType=`.
  // Production ingest should parse the structured XHR endpoint instead.
  const linkRegex = /href="(\/parlInfo\/[^"]+?fileType=[^"]+?)"/g;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html))) {
    if (match[1]) seen.add(`https://parlinfo.aph.gov.au${match[1]}`);
  }

  const now = new Date().toISOString();
  let added = 0;
  for (const link of seen) {
    const id = link.split("?")[0]?.split("/").pop() ?? link;
    try {
      const r = await env.ARCHIVE.prepare(
        `INSERT INTO qons (id, asked_at, member, chamber, target, question, hansard_url, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET ingested_at = excluded.ingested_at`,
      )
        .bind(id, since, null, null, null, null, link, now)
        .run();
      if (r.meta?.last_row_id && r.meta.last_row_id > 0) added += 1;
    } catch {
      // ignore individual row failures so the batch still progresses
    }
  }

  return { added, attempted: seen.size };
}
