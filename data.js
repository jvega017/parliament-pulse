const NOT_SUPPLIED = "Not supplied";
const NO_VALUE = "\xB7";
const WORKER_BASE_URL = "https://aph-proxy.jvega019.workers.dev";
const APH_LICENCE_NAME = "CC BY-NC-ND 4.0";
const APH_LICENCE_URL = "https://creativecommons.org/licenses/by-nc-nd/4.0/";
const APH_ATTRIBUTION = "Source material: Parliament of Australia website, licensed under CC BY-NC-ND 4.0 (" + APH_LICENCE_URL + "). Titles reproduced unmodified; scores and summaries are Parliament Pulse analysis.";
const SITE_CONFIG = {
  showUnsourcedSurfaces: false,
  contact: null,
  unavailable: [
    {
      id: "qon",
      name: "Questions on notice",
      // Re-verified 29 Sep 2026 (05:43 to 05:45 UTC): ParlInfo answers a Chrome
      // user-agent with HTTP 200 (a scripted user-agent gets HTTP 403 from its
      // Azure WAF), serves Hansard results to the same request, and returns "No
      // results found" for the questions on notice query. The earlier claim that
      // it "refuses automated access" was not true for a browser user-agent.
      reason: "Parliament Pulse's search of ParlInfo returns no questions on notice, so none are held here.",
      aphUrl: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/qon"
    },
    {
      id: "hansard",
      name: "Hansard",
      reason: "No Hansard transcript feed is connected, so speeches and debate are not searchable here.",
      aphUrl: "https://www.aph.gov.au/Parliamentary_Business/Hansard"
    },
    {
      id: "members",
      name: "Member profiles",
      reason: "No live source of senator and member records is connected, so no profiles or activity counts are shown.",
      aphUrl: "https://www.aph.gov.au/Senators_and_Members"
    },
    {
      id: "alerts",
      name: "Alert rules and email digests",
      reason: "Delivering alerts needs sign-in, which is not built. Watchlist matching runs in your browser only.",
      aphUrl: "https://www.aph.gov.au/Help/Rss_feeds"
    },
    {
      id: "lines",
      name: "Parliamentary lines",
      reason: "Drafting lines needs an analyst workflow that is not built. Briefs you generate from a signal stay in your browser.",
      aphUrl: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents"
    }
  ]
};
const SOURCE_REGISTRY = [
  {
    id: "h-media",
    label: "House media releases",
    url: "https://www.aph.gov.au/house/rss/media_releases",
    authority: "Official",
    confidence: "High",
    module: "Media",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    // legacy display fields for existing APH_FEEDS consumers
    name: "House media releases",
    group: "House",
    status: null,
    last: null,
    today: null,
    modules: ["Media", "Overview"],
    parser: null
  },
  {
    id: "s-reports",
    label: "Senate reports tabled",
    url: "https://www.aph.gov.au/senate/rss/reports",
    authority: "Official",
    confidence: "High",
    module: "Committees",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "Senate reports tabled",
    group: "Senate",
    status: null,
    last: null,
    today: null,
    modules: ["Committees", "Briefings"],
    parser: null
  },
  {
    id: "s-new-inquiries",
    label: "New Senate inquiries",
    url: "https://www.aph.gov.au/senate/rss/new_inquiries",
    authority: "Official",
    confidence: "High",
    module: "Committees",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "New Senate inquiries",
    group: "Senate",
    status: null,
    last: null,
    today: null,
    modules: ["Committees", "Emerging Issues"],
    parser: null
  },
  {
    id: "s-upcoming",
    label: "Upcoming Senate hearings",
    url: "https://www.aph.gov.au/senate/rss/upcoming_hearings",
    authority: "Official",
    confidence: "High",
    module: "What's On",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "Upcoming Senate hearings",
    group: "Senate",
    status: null,
    last: null,
    today: null,
    modules: ["What's On", "Committees"],
    parser: null
  },
  {
    id: "h-div",
    label: "House divisions",
    url: "https://www.aph.gov.au/house/rss/divisions",
    authority: "Official",
    confidence: "High",
    module: "Divisions",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "House divisions",
    group: "House",
    status: null,
    last: null,
    today: null,
    modules: ["Divisions"],
    parser: null
  },
  {
    id: "h-program",
    label: "House daily program",
    url: "https://www.aph.gov.au/house/rss/daily_program",
    authority: "Official",
    confidence: "High",
    module: "Parliament",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "House daily program",
    group: "House",
    status: null,
    last: null,
    today: null,
    modules: ["Parliament", "Live"],
    parser: null
  }
];
const APH_FEEDS = SOURCE_REGISTRY;
function sourceCounts() {
  const total = SOURCE_REGISTRY.length;
  const live = SOURCE_REGISTRY.filter((f) => f.lastStatusCode >= 200 && f.lastStatusCode < 300).length;
  return { total, live, configured: total };
}
const SIGNALS = [];
const COMMITTEE_ITEMS = [];
const BILLS = [];
const DIVISIONS = [];
const WATCHLISTS = [
  { name: "Digital government", keywords: null, matches: null, trend: [] },
  { name: "AI & automation", keywords: null, matches: null, trend: [] },
  { name: "Cyber security", keywords: null, matches: null, trend: [] },
  { name: "Digital identity", keywords: null, matches: null, trend: [] },
  { name: "Data sharing & privacy", keywords: null, matches: null, trend: [] },
  { name: "Procurement", keywords: null, matches: null, trend: [] },
  { name: "Service delivery", keywords: null, matches: null, trend: [] },
  { name: "Infrastructure & connectivity", keywords: null, matches: null, trend: [] },
  { name: "Health digital systems", keywords: null, matches: null, trend: [] },
  { name: "Parliamentary scrutiny", keywords: null, matches: null, trend: [] },
  { name: "Estimates preparation", keywords: null, matches: null, trend: [] },
  { name: "Queensland federal signals", keywords: null, matches: null, trend: [] }
];
const RADAR = [];
const QON_PATTERN = {
  topic: null,
  members: [],
  window: null,
  count: 0,
  target: null,
  trigger: null,
  confidence: null,
  items: []
};
const BRIEFING_QUEUE = [];
const DATASET_FLAGS = {
  SOURCE_REGISTRY: { representative: false, note: "Verified APH feeds, polled live via the Worker proxy." },
  SIGNALS: { representative: true, note: "Empty: every fixture signal was an invented parliamentary event with a fabricated source and evidence link. No enrichment pipeline (attention, scoring, provenance, NER) is built. The desks read the live /state signal stream instead; with no live connection they show an honest outage state, never invented signals." },
  COMMITTEE_ITEMS: { representative: true, note: "Empty: no live committee-schedule feed is wired. Hearing times, topics and attention ratings were invented and have been removed. See https://www.aph.gov.au/Parliamentary_Business/Committees." },
  BILLS: { representative: true, note: "Empty: the fixture ref and title in every row could not be verified against the live bills data (none of the five titles appears among the 25 genuine bills the Worker's /bills endpoint returns) and have been removed. The Bills desk reads the live /bills endpoint instead." },
  DIVISIONS: { representative: true, note: "Empty: no verified division-result feed is wired. Vote tallies were invented and have been removed. See https://www.aph.gov.au/house/rss/divisions." },
  WATCHLISTS: { representative: true, note: "Name and keyword list are real product configuration and are kept. matches and trend were invented counts of live activity: no keyword matcher over the signal stream is built, so both are nulled/emptied and consumers compute the real (currently zero) match count live." },
  RADAR: { representative: true, note: "Empty: every issue named an invented cluster of parliamentary activity (fabricated inquiries, QON references, hearings) with an invented momentum/confidence score. No clustering layer over real signals is built; rows only render once the live signal stream is grouped (derived mode)." },
  QON_PATTERN: { representative: true, note: "Empty: the ParlInfo questions on notice query returns no results, so no live QON source is held. No representative fixture is held either. See https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Senate_chamber_documents/qon." },
  BRIEFING_QUEUE: { representative: true, note: "Empty: every row invented a piece of parliamentary business already sitting in a named policy team's queue. A shared briefings queue needs a backend that does not exist; the desks read the user's own generated briefs (state.briefsGenerated) as the real source instead." }
};
[SIGNALS, COMMITTEE_ITEMS, BILLS, DIVISIONS, WATCHLISTS, RADAR, BRIEFING_QUEUE].forEach((arr) => {
  arr.forEach((item) => {
    if (item && item.representative === void 0) item.representative = true;
  });
});
QON_PATTERN.representative = true;
Object.assign(window, {
  WORKER_BASE_URL,
  APH_ATTRIBUTION,
  APH_LICENCE_URL,
  APH_LICENCE_NAME,
  SITE_CONFIG,
  SOURCE_REGISTRY,
  sourceCounts,
  DATASET_FLAGS,
  APH_FEEDS,
  SIGNALS,
  COMMITTEE_ITEMS,
  BILLS,
  DIVISIONS,
  WATCHLISTS,
  RADAR,
  QON_PATTERN,
  BRIEFING_QUEUE
});
