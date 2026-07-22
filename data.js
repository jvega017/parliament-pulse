const WORKER_BASE_URL = "https://aph-proxy.jvega019.workers.dev";
const SOURCE_REGISTRY = [
  {
    id: "h-media",
    label: "House Media Releases",
    url: "https://www.aph.gov.au/house/rss/media_releases",
    authority: "Official",
    fpr: "Med",
    confidence: "High",
    module: "Media",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    // legacy display fields for existing APH_FEEDS consumers
    name: "House Media Releases",
    group: "House",
    status: null,
    last: null,
    today: null,
    modules: ["Media", "Overview"],
    parser: null
  },
  {
    id: "s-reports",
    label: "Senate Committee Reports Tabled",
    url: "https://www.aph.gov.au/senate/rss/reports",
    authority: "Official",
    fpr: "Low",
    confidence: "High",
    module: "Committees",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "Senate Committee Reports Tabled",
    group: "Senate",
    status: null,
    last: null,
    today: null,
    modules: ["Committees", "Briefings"],
    parser: null
  },
  {
    id: "s-new-inquiries",
    label: "Senate New Inquiries",
    url: "https://www.aph.gov.au/senate/rss/new_inquiries",
    authority: "Official",
    fpr: "Low",
    confidence: "High",
    module: "Committees",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "Senate New Inquiries",
    group: "Senate",
    status: null,
    last: null,
    today: null,
    modules: ["Committees", "Emerging Issues"],
    parser: null
  },
  {
    id: "s-upcoming",
    label: "Senate Upcoming Hearings",
    url: "https://www.aph.gov.au/senate/rss/upcoming_hearings",
    authority: "Official",
    fpr: "Low",
    confidence: "High",
    module: "What's On",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "Senate Upcoming Hearings",
    group: "Senate",
    status: null,
    last: null,
    today: null,
    modules: ["What's On", "Committees"],
    parser: null
  },
  {
    id: "h-div",
    label: "House Divisions",
    url: "https://www.aph.gov.au/house/rss/divisions",
    authority: "Official",
    fpr: "Low",
    confidence: "High",
    module: "Divisions",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "House Divisions",
    group: "House",
    status: null,
    last: null,
    today: null,
    modules: ["Divisions"],
    parser: null
  },
  {
    id: "h-program",
    label: "House Daily Program",
    url: "https://www.aph.gov.au/house/rss/daily_program",
    authority: "Official",
    fpr: "Low",
    confidence: "High",
    module: "Parliament",
    lastStatusCode: null,
    errorDetail: null,
    lastItemCount: null,
    name: "House Daily Program",
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
  { name: "Digital government", keywords: 24, matches: null, trend: [] },
  { name: "AI & automation", keywords: 18, matches: null, trend: [] },
  { name: "Cyber security", keywords: 21, matches: null, trend: [] },
  { name: "Digital identity", keywords: 14, matches: null, trend: [] },
  { name: "Data sharing & privacy", keywords: 19, matches: null, trend: [] },
  { name: "Procurement", keywords: 16, matches: null, trend: [] },
  { name: "Service delivery", keywords: 17, matches: null, trend: [] },
  { name: "Infrastructure & connectivity", keywords: 15, matches: null, trend: [] },
  { name: "Health digital systems", keywords: 12, matches: null, trend: [] },
  { name: "Parliamentary scrutiny", keywords: 22, matches: null, trend: [] },
  { name: "Estimates preparation", keywords: 11, matches: null, trend: [] },
  { name: "Queensland federal signals", keywords: 13, matches: null, trend: [] }
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
  QON_PATTERN: { representative: true, note: "Empty: ParlInfo Questions on Notice search returns 403 to automated access, so no live QON feed can be fetched. No representative fixture is held either. See https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Questions_on_Notice." },
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
