// Single source of truth for the banned fabrication patterns and the scanner.
//
// Imported by tests/release-gate.mjs (scans the LOCAL shipped bundle) and by
// tests/production-probe.mjs (scans the DEPLOYED site). Keeping one list here
// means the local gate and the production probe can never drift apart on what
// counts as an invented parliamentary record on a provenance-first product.
//
// Each banned pattern is a specific fabrication found in the 2026-07-21 survey,
// or a class of invented content. A pattern means: this exact string must never
// render to a member of the public.

export const BANNED = [
  // Fabricated inquiry record (store.jsx InquiryDetail)
  { re: /Submissions close/i, why: "invented inquiry submission date" },
  { re: /30 August 2026/, why: "invented inquiry reporting date" },
  { re: /19 May 2026/, why: "invented inquiry submission deadline" },
  { re: /Any related matters/i, why: "invented terms of reference" },
  { re: /digital programs over \$100m/i, why: "invented inquiry scope" },
  { re: /\$100m/, why: "invented procurement threshold used across fabrications" },

  // Fabricated witness list (store.jsx HearingDetail)
  { re: /First Assistant Secretary/i, why: "invented hearing witness" },
  { re: /Industry peak body/i, why: "invented hearing witness" },

  // Fabricated QON scrutiny cluster (data.jsx QON_PATTERN)
  { re: /ANAO report tabled/i, why: "invented analytical trigger" },
  { re: /FY23[-–]24/, why: "invented question-on-notice text" },

  // Fabricated provenance/audit log (data.jsx SIGNALS provenance[])
  { re: /08:14:04/, why: "invented audit-log timestamp" },
  { re: /Attention = 0\.86/, why: "invented scoring log line" },

  // Fabricated statistic (pages.jsx)
  { re: /5 of 38/, why: "fabricated watchlist total" },

  // Fabricated legislative content
  { re: /state-level identity exchanges/i, why: "invented bill provision" },
  { re: /Negatived \(\d+/, why: "invented division tally" },

  // Fabricated news and member activity
  { re: /Speaker announces procedural changes/i, why: "invented news headline" },
  { re: /Lodged QON on digital procurement/i, why: "invented member activity" },

  // Time claims that are false by construction: a hardcoded "Today" claims a
  // hearing is happening today on every date the page is ever opened.
  { re: /"Today, \d{1,2}:\d{2}"/, why: "hardcoded 'Today' schedule claim" },
  { re: /Today, 10:00/, why: "hardcoded 'Today' schedule claim" },
];

export function scan(text) {
  const hits = [];
  for (const b of BANNED) {
    if (b.re.test(text)) hits.push(b);
  }
  return hits;
}
