// Single source of truth for the banned fabrication patterns and the scanner.
//
// Imported by tests/release-gate.mjs (scans the LOCAL shipped bundle) and by
// tests/production-probe.mjs (scans the DEPLOYED site). Keeping one list here
// means the local gate and the production probe can never drift apart on what
// counts as an invented parliamentary record on a provenance-first product.
//
// Every pattern carries its own `canary`: a specimen string it must detect.
// The self-tests (tests/fabrication-selftest.test.mjs and the release gate)
// read the canary from here, so adding a pattern without a canary fails them.
//
// Each banned pattern is a specific fabrication found in the 2026-07-21 survey,
// or a class of invented content. A pattern means: this exact string must never
// render to a member of the public.

export const BANNED = [
  // Fabricated inquiry record (store.jsx InquiryDetail)
  { re: /Submissions close/i, why: "invented inquiry submission date", canary: "Submissions close: 19 May 2026" },
  { re: /30 August 2026/, why: "invented inquiry reporting date", canary: "Reporting: by 30 August 2026" },
  { re: /19 May 2026/, why: "invented inquiry submission deadline", canary: "deadline 19 May 2026" },
  { re: /Any related matters/i, why: "invented terms of reference", canary: "4. Any related matters" },
  { re: /digital programs over \$100m/i, why: "invented inquiry scope", canary: "governance for digital programs over $100m" },
  { re: /\$100m/, why: "invented procurement threshold used across fabrications", canary: "programs over $100m since" },

  // Fabricated witness list (store.jsx HearingDetail)
  { re: /First Assistant Secretary/i, why: "invented hearing witness", canary: "Department (First Assistant Secretary)" },
  { re: /Industry peak body/i, why: "invented hearing witness", canary: "Industry peak body" },

  // Fabricated QON scrutiny cluster (data.jsx QON_PATTERN)
  { re: /ANAO report tabled/i, why: "invented analytical trigger", canary: "Trigger likely: ANAO report tabled 22 Apr" },
  { re: /FY23[-–]24/, why: "invented question-on-notice text", canary: "contracts since FY23-24" },

  // Fabricated provenance/audit log (data.jsx SIGNALS provenance[])
  { re: /08:14:04/, why: "invented audit-log timestamp", canary: "08:14:04 · enrichment" },
  { re: /Attention = 0\.86/, why: "invented scoring log line", canary: "Attention = 0.86 → HIGH" },

  // Fabricated statistic (pages.jsx)
  { re: /5 of 38/, why: "fabricated watchlist total", canary: "5 of 38 watchlisted" },

  // Fabricated legislative content
  { re: /state-level identity exchanges/i, why: "invented bill provision", canary: "scope expanded to cover state-level identity exchanges" },
  { re: /Negatived \(\d+/, why: "invented division tally", canary: "Negatived (64-78)" },

  // Fabricated news and member activity
  { re: /Speaker announces procedural changes/i, why: "invented news headline", canary: "Speaker announces procedural changes to question time" },
  { re: /Lodged QON on digital procurement/i, why: "invented member activity", canary: "Lodged QON on digital procurement · 23 Apr" },

  // Time claims that are false by construction: a hardcoded "Today" claims a
  // hearing is happening today on every date the page is ever opened.
  { re: /"Today, \d{1,2}:\d{2}"/, why: "hardcoded 'Today' schedule claim", canary: "when: \"Today, 10:00\"" },
  { re: /Today, 10:00/, why: "hardcoded 'Today' schedule claim", canary: "Today, 10:00" },
  // Hardcoded sitting-date claims (UX-01, 5 Sep 2026 audit). A literal return
  // date baked into the bundle goes false the day Parliament's calendar moves,
  // and the "11 August" copy stayed live for weeks after that date passed. A
  // sitting date may only reach the page from a dated, sourced feed.
  { re: /returns on \d{1,2} \w+ 20\d\d/i, why: "hardcoded Parliament return date", canary: "Parliament returns on 11 August 2026" },
  { re: /NEXT_SITTING_DATE\s*=\s*"/, why: "hardcoded next-sitting-date constant", canary: 'const NEXT_SITTING_DATE = "11 August 2026";' },
  { re: /until Parliament returns on/i, why: "hardcoded recess-until copy", canary: "No divisions until Parliament returns on {NEXT_SITTING_DATE}." },
];

export function scan(text) {
  const hits = [];
  for (const b of BANNED) {
    if (b.re.test(text)) hits.push(b);
  }
  return hits;
}
