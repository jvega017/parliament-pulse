// Regenerates the browser-harness fixtures in this directory (FE-07).
//
//   node tests/fixtures/make-fixtures.mjs
//
// Every title, description and date below is SYNTHETIC test content, written to
// exercise layout (long titles, long unbroken URLs, every feed kind), and is
// never shipped: build-dist.ps1 copies an allowlist that excludes tests/.
// Titles carry the word "Fixture" so a leaked row is obvious on sight.
// URLs point at real aph.gov.au parent paths (links, not content) so the
// Sources desk sees the same long unbroken strings the live Worker serves.
//
// Timestamps are fixed relative to FIXTURE_NOW. harness.mjs pins the browser
// clock to FIXTURE_NOW plus five minutes, so freshness labels, "x min ago"
// stamps and staleness are identical on every run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_NOW = "2026-09-29T00:00:00.000Z";
const NOW_MS = Date.parse(FIXTURE_NOW);
const MIN = 60 * 1000;
const iso = ms => new Date(ms).toISOString();

const FEEDS = [
  { label: "Upcoming Senate hearings", group: "Senate", kind: "hearing", url: "https://www.aph.gov.au/senate/rss/upcoming_hearings" },
  { label: "New Senate inquiries", group: "Senate", kind: "inquiry", url: "https://www.aph.gov.au/senate/rss/new_inquiries" },
  { label: "Senate committee reports", group: "Senate", kind: "report", url: "https://www.aph.gov.au/senate/rss/reports" },
  { label: "House media releases", group: "House", kind: "signal", url: "https://www.aph.gov.au/house/rss/media_releases" },
  { label: "House committee inquiries", group: "House", kind: "inquiry", url: "https://www.aph.gov.au/house/rss/new_inquiries" },
  { label: "Joint committee inquiries", group: "Joint", kind: "inquiry", url: "https://www.aph.gov.au/joint/rss/new_inquiries" },
];

// Title lengths span the live range (the longest live title on 29 Sep 2026 was
// 138 characters).
const TITLE_STEMS = [
  "Fixture inquiry into layout handling",
  "Fixture review of long-title wrapping across narrow phone viewports and dense tables in the Signal inbox",
  "Fixture hearing on the handling of very long parliamentary item titles that run past one hundred and thirty characters in length",
  "Fixture report",
  "Fixture inquiry into responsive table labels and reflow at 320 CSS pixels",
];
const ATTN = ["high", "med", "low"];

const signals = [];
for (let i = 0; i < 30; i++) {
  const f = FEEDS[i % FEEDS.length];
  const n = String(i + 1).padStart(2, "0");
  const slug = `Fixture_item_${n}_with_a_long_unbroken_path_segment_for_overflow_testing`;
  const link = `https://www.aph.gov.au/Parliamentary_Business/Committees/${f.group}/${slug}/Public_Hearings`;
  signals.push({
    guid: link,
    title: `${TITLE_STEMS[i % TITLE_STEMS.length]} ${n}`,
    link,
    pub_date: i % 4 === 0 ? null : iso(NOW_MS - (i + 1) * 47 * MIN),
    first_seen_at: iso(NOW_MS - (i + 1) * 50 * MIN),
    feed_label: f.label,
    source_group: f.group,
    kind: f.kind,
    attention: ATTN[i % ATTN.length],
    confidence: 1 + (i % 5),
    scoring_explanation: `Fixture score explanation ${n}: deterministic source and keyword rules.`,
  });
}

const feedChecks = FEEDS.map((f, i) => ({
  url: f.url, feed_label: f.label, kind: f.kind,
  checked_at: iso(NOW_MS - 5 * MIN), ok: i === 2 ? 0 : 1, status: i === 2 ? 500 : 200,
  error: i === 2 ? "HTTP 500" : null, last_http_status: i === 2 ? 500 : 200,
  items_parsed: i === 2 ? 0 : 5, parse_error: i === 2 ? "HTTP 500" : null,
  last_success_at: iso(NOW_MS - (i === 2 ? 26 * 60 : 5) * MIN),
}));
// Non-feed endpoint checks, shaped like the live Worker's: long unbroken URLs
// are what overflowed the Sources tables (UX-05).
const endpointChecks = [
  "https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22legislation%2Fbillsdgs%2Ffixture%22",
  "https://parlwork.aph.gov.au/Senate/DynamicRed",
  "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/Research/FlagPost",
  "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/",
  "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results",
  "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR/House_Daily_Program",
].map((url, i) => ({ url, checked_at: iso(NOW_MS - 5 * MIN), ok: i === 0 ? 0 : 1, status: i === 0 ? 403 : 200, error: i === 0 ? "HTTP 403" : null }));

const threads = [0, 1, 2, 3].map(i => ({
  thread_id: `thread:${signals[i].guid}`,
  title: `${TITLE_STEMS[(i + 1) % TITLE_STEMS.length]} thread ${i + 1}`,
  item_count: 3 + i * 7,
  first_seen_at: iso(NOW_MS - (10 + i) * 24 * 60 * MIN),
  last_seen_at: iso(NOW_MS - (i + 1) * 60 * MIN),
  signal_guids: [signals[i].guid, signals[i + 6].guid],
}));

const signalCounts = {};
for (const f of FEEDS) {
  const held = signals.filter(s => s.feed_label === f.label).length;
  signalCounts[f.label] = { held, available: held * 4 };
}

const state = {
  meta: {
    generated_at: FIXTURE_NOW, worker_version: "fixture", schema: "state-v1",
    last_poll_at: FIXTURE_NOW, last_new_item_at: iso(NOW_MS - 60 * MIN), stale: false,
    feeds: feedChecks.map(c => ({ feed_label: c.feed_label, last_seen_at: c.last_success_at })),
    signal_counts: signalCounts,
  },
  blocks: {
    signals: { provenance: "live", fetched_at: FIXTURE_NOW, origin: "fixture", items: signals },
    connectors: {
      provenance: "live", fetched_at: FIXTURE_NOW, origin: "fixture",
      checks: [...feedChecks, ...endpointChecks],
      reference_links: [
        "https://www.aph.gov.au/Help/RSS_feeds",
        "https://www.aph.gov.au/Parliamentary_Business/Hansard",
        "https://www.aph.gov.au/Senators_and_Members",
      ],
    },
    threads: { provenance: "derived", fetched_at: FIXTURE_NOW, origin: "fixture", items: threads },
    alerts: { provenance: "fixture", fetched_at: FIXTURE_NOW, origin: "fixture", events: [], note: "Fixture: no alert events." },
    qons: { provenance: "fixture", fetched_at: FIXTURE_NOW, origin: "fixture", items: [], note: "Fixture: no questions on notice." },
  },
};

const BILL_TITLES = [
  "Fixture Amendment Bill 2026",
  "Fixture Laws Amendment (Responsive Tables and Long Title Wrapping Across Narrow Viewports No. 1) Bill 2026 [and related Bill]",
  "Fixture (Layout Measures) Bill 2026",
  "Fixture Legislation Amendment (Reflow at Three Hundred and Twenty Pixels) Bill 2026",
];
const bills = [];
for (let i = 0; i < 25; i++) {
  const n = String(i + 1).padStart(2, "0");
  const link = `https://parlinfo.aph.gov.au:443/parlInfo/search/display/display.w3p;query=Id%3A%22legislation%2Fbillsdgs%2Ffixture${n}%22`;
  bills.push({
    guid: link, title: BILL_TITLES[i % BILL_TITLES.length].replace("Bill 2026", `(No. ${n}) Bill 2026`), link,
    pub_date: iso(NOW_MS - (i + 1) * 20 * 60 * MIN), description: null,
    attention: ATTN[i % ATTN.length], confidence: 1 + (i % 5),
  });
}

// One RSS template for every proxied feed; the harness substitutes the feed
// URL so each feed yields distinct guids.
const rssItems = [0, 1, 2, 3].map(i => `<item>
<title>${TITLE_STEMS[(i + 2) % TITLE_STEMS.length]} (RSS fixture ${i + 1})</title>
<link>{{FEED}}/fixture-item-${i + 1}</link>
<guid>{{FEED}}/fixture-item-${i + 1}</guid>
<description>Fixture description ${i + 1} for layout testing only.</description>
<pubDate>${new Date(NOW_MS - (i + 1) * 90 * MIN).toUTCString()}</pubDate>
</item>`).join("\n");
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Fixture feed</title>
<link>{{FEED}}</link>
<description>Synthetic RSS fixture for the Parliament Pulse browser harness.</description>
${rssItems}
</channel>
</rss>
`;

// The deployed Worker as at 29 Sep 2026 (v0.15.0) still serves the OLDER shape:
// no freshness fields in meta and connector checks without feed labels, so the
// Sources desk renders its registry-shaped table. That table overflowed at
// 1280 px on the live payload, so the harness exercises it too.
const legacyState = {
  meta: { generated_at: FIXTURE_NOW, worker_version: "0.15.0", schema: "state-v1" },
  blocks: {
    ...state.blocks,
    connectors: {
      provenance: "live", fetched_at: FIXTURE_NOW, origin: "fixture",
      checks: [...FEEDS.map(f => f.url), ...endpointChecks.map(c => c.url),
        "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Fixture_committee_with_a_very_long_unbroken_path_name/Inquiry_into_layout"]
        .map((url, i) => ({ url, checked_at: iso(NOW_MS - 5 * MIN), ok: i === 6 ? 0 : 1, status: i === 6 ? 403 : 200, error: i === 6 ? "HTTP 403" : null })),
    },
  },
};

fs.writeFileSync(path.join(here, "state.json"), JSON.stringify(state, null, 1) + "\n");
fs.writeFileSync(path.join(here, "state-legacy.json"), JSON.stringify(legacyState, null, 1) + "\n");
fs.writeFileSync(path.join(here, "bills.json"), JSON.stringify({ rows: bills, total: bills.length }, null, 1) + "\n");
fs.writeFileSync(path.join(here, "rss.xml"), rss);
fs.writeFileSync(path.join(here, "alerts.json"), JSON.stringify({ rules: [] }) + "\n");
console.log(`fixtures written: ${signals.length} signals, ${bills.length} bills, ${threads.length} threads`);
