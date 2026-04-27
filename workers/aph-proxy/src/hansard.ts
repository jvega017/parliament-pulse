// Hansard QON ingest.
// Issues a ParlInfo full-text query for Questions on Notice and inserts a row
// per result. Extracts questioner, chamber, and topic from the HTML page title
// and result snippets where present.

import type { Env } from "./archive";

const PARLINFO_BASE = "https://parlinfo.aph.gov.au/parlInfo/search/search.w3p";
const USER_AGENT =
  "parliament-pulse/0.12 (+https://github.com/jvega019/parliament-pulse)";

// Extract the asking member from result text.
// ParlInfo QON titles often follow: "Question: <member> to <target> — <topic>"
function parseQonMeta(title: string, snippet: string): {
  member: string | null;
  chamber: string | null;
  target: string | null;
  question: string | null;
} {
  const combined = `${title} ${snippet}`;

  // Chamber detection
  const chamber =
    /\bsenate\b/i.test(combined) ? "Senate" :
    /\bhouse\b|\brepresentative\b/i.test(combined) ? "House" : null;

  // Member: "Senator <Name>" or "Mr/Ms/Dr <Name>"
  const memberMatch = combined.match(
    /(?:Senator|Mr|Ms|Mrs|Dr|Prof)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)/,
  );
  const member = memberMatch ? memberMatch[0].trim() : null;

  // Target: "to the Minister for X" or "to the Prime Minister"
  const targetMatch = combined.match(/to\s+the\s+((?:Minister|Prime Minister|Assistant Minister|Secretary)[^,;.]{0,60})/i);
  const target = targetMatch ? targetMatch[1].trim().slice(0, 80) : null;

  // Topic: use the title truncated, or first meaningful sentence
  const question = title.replace(/^Question[^:]*:\s*/i, "").trim().slice(0, 200) || null;

  return { member, chamber, target, question };
}

export async function ingestQons(env: Env, sinceIso?: string): Promise<{
  added: number;
  attempted: number;
}> {
  const since = sinceIso ?? new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    adv: "yes",
    orderBy: "date-eFirst",
    page: "0",
    query: "Date:thisYear Dataset:qon",
    resCount: "50",
  });
  const url = `${PARLINFO_BASE}?${params.toString()}`;

  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!res.ok) return { added: 0, attempted: 0 };
    html = await res.text();
  } catch {
    return { added: 0, attempted: 0 };
  }

  // Extract result blocks — ParlInfo wraps each result in a <div class="resultDiv"> or similar.
  // Fallback: collect every parlInfo document link.
  const resultBlocks: Array<{ href: string; title: string; snippet: string }> = [];

  // Try to parse structured result blocks
  const blockRe = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(html))) {
    const block = blockMatch[1] ?? "";
    const hrefMatch = block.match(/href="(\/parlInfo\/[^"]+?)"/);
    if (!hrefMatch?.[1]) continue;
    const href = `https://parlinfo.aph.gov.au${hrefMatch[1]}`;
    const titleMatch = block.match(/<(?:h[2-4]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[2-4]|strong|b)>/i);
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    resultBlocks.push({ href, title: rawTitle, snippet: rawSnippet });
  }

  // Fallback: bare link scan
  if (resultBlocks.length === 0) {
    const linkRe = /href="(\/parlInfo\/[^"]+?fileType=[^"]+?)"/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      if (m[1]) resultBlocks.push({ href: `https://parlinfo.aph.gov.au${m[1]}`, title: "", snippet: "" });
    }
  }

  const seen = new Set<string>(resultBlocks.map((r) => r.href));
  const now = new Date().toISOString();
  let added = 0;

  for (const { href, title, snippet } of seen.size > 0 ? resultBlocks : []) {
    const id = href.split("?")[0]?.split("/").pop() ?? href;
    const meta = parseQonMeta(title, snippet);
    try {
      const r = await env.ARCHIVE.prepare(
        `INSERT INTO qons (id, asked_at, member, chamber, target, question, hansard_url, ingested_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           member     = COALESCE(excluded.member, member),
           chamber    = COALESCE(excluded.chamber, chamber),
           target     = COALESCE(excluded.target, target),
           question   = COALESCE(excluded.question, question),
           ingested_at = excluded.ingested_at`,
      )
        .bind(id, since, meta.member, meta.chamber, meta.target, meta.question, href, now)
        .run();
      if (r.meta?.last_row_id && r.meta.last_row_id > 0) added += 1;
    } catch {
      // ignore individual row failures
    }
  }

  return { added, attempted: seen.size };
}
