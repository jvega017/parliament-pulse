// Lightweight regex-based entity extraction for parliamentary signals.
// Extracts bill references and dollar amounts from raw RSS title+description text.
// No AI required — deterministic, auditable, zero fabrication risk.

export interface ExtractedEntity {
  kind: "bill" | "dollar";
  text: string;
}

export function extractEntities(title: string, summary: string): ExtractedEntity[] {
  const text = `${title} ${summary}`;
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Australian Parliament bill references: "Foo Bar (Subtitle) Bill YYYY"
  // Anchored to capital letter; allows parenthesised subtitles and "Amendment".
  const billRe = /\b([A-Z][A-Za-z ,()&'-]{3,80}?Bill\s+\d{4})\b/g;
  for (const m of text.matchAll(billRe)) {
    const s = m[1].trim();
    if (!seen.has(s) && s.length <= 120) {
      seen.add(s);
      entities.push({ kind: "bill", text: s });
    }
  }

  // Dollar amounts with magnitude suffix
  const dollarRe = /\$[\d,]+(?:\.\d+)?\s*(?:million|billion|trillion|[mMbBkK])\b/gi;
  for (const m of text.matchAll(dollarRe)) {
    const s = m[0].trim();
    if (!seen.has(s)) {
      seen.add(s);
      entities.push({ kind: "dollar", text: s });
    }
  }

  return entities.slice(0, 5);
}
