// ---------- Data registry and representative fixtures for Parliament Pulse ----------
//
// SOURCE_REGISTRY is the single canonical source of truth for every feed the app
// fetches. It replaces the old duplication between data.jsx APH_FEEDS and the
// pages.jsx APH_FEED_URLS list. WP-C reads window.SOURCE_REGISTRY using exactly the
// field names below, so do not rename or remove any of them:
//   id, label, url, authority, fpr, confidence, module,
//   lastStatusCode, errorDetail, lastItemCount
//
// Only the SIX APH RSS feeds verified live this session are included. The parlinfo
// Bills Digests feed has been removed: it sits behind an Azure WAF JavaScript
// challenge and returns 403 even through a stealth proxy, so it is not usable.
//
// Live-health fields (lastStatusCode, errorDetail, lastItemCount) start null and are
// populated at runtime by the poller. Static config (authority, fpr, confidence) is
// held constant. Legacy display fields (name, group, status, last, today, modules,
// parser) are kept so existing consumers in shell.jsx, store.jsx and pages.jsx that
// read APH_FEEDS continue to work unchanged; APH_FEEDS is a const alias of the
// registry below.

// Cloudflare Worker base URL — single canonical constant so any endpoint
// consumer (the /state poller, the RSS poller, etc.) points at the same
// place instead of re-hardcoding the Worker hostname per call site.
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
    name: "House Media Releases", group: "House", status: null, last: null, today: null, modules: ["Media", "Overview"], parser: null,
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
    name: "Senate Committee Reports Tabled", group: "Senate", status: null, last: null, today: null, modules: ["Committees", "Briefings"], parser: null,
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
    name: "Senate New Inquiries", group: "Senate", status: null, last: null, today: null, modules: ["Committees", "Emerging Issues"], parser: null,
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
    name: "Senate Upcoming Hearings", group: "Senate", status: null, last: null, today: null, modules: ["What's On", "Committees"], parser: null,
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
    name: "House Divisions", group: "House", status: null, last: null, today: null, modules: ["Divisions"], parser: null,
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
    name: "House Daily Program", group: "House", status: null, last: null, today: null, modules: ["Parliament", "Live"], parser: null,
  },
];

// APH_FEEDS is retained as an alias pointing at the registry so existing code that
// reads APH_FEEDS (shell.jsx search, store.jsx feed modal, pages.jsx source table)
// keeps working. The registry is the source of truth; do not maintain two lists.
const APH_FEEDS = SOURCE_REGISTRY;

function sourceCounts() {
  const total = SOURCE_REGISTRY.length;
  const live = SOURCE_REGISTRY.filter(f => f.lastStatusCode >= 200 && f.lastStatusCode < 300).length;
  return { total, live, configured: total };
}

// SIGNALS emptied: every entry was an invented parliamentary event (an invented
// Senate inquiry, an invented Speaker announcement, an invented Bills Digest, an
// invented hearing, an invented daily-program listing, an invented FlagPost), each
// dressed with a fabricated source attribution, an invented analyst rationale and an
// "evidence" link to a real aph.gov.au page it did not actually document. On a
// provenance-first product this is the most damaging thing it can render, so the
// binding stays an empty array: SIGNALS is read as a global across pages.jsx,
// shell.jsx and store.jsx and removing the name breaks the app at load. The real
// signal source is the Worker's live /state endpoint (see useLiveState in
// store.jsx); when it is unreachable the desks must show an honest outage state,
// never this fixture.
const SIGNALS = [];

// COMMITTEE_ITEMS emptied: every field beyond the committee name (schedule time,
// hearing type, topic, portfolio tag, attention rating) was invented, including the
// literal string "Today" as a hardcoded (not computed) schedule value. The binding
// stays an empty array so the Committees desk still loads; it should render an
// honest empty state naming that no live committee-schedule feed is wired yet, with
// a link to https://www.aph.gov.au/Parliamentary_Business/Committees.
const COMMITTEE_ITEMS = [];

// BILLS emptied: the ref and title in every row here were previously claimed as "real,
// publicly identifiable Commonwealth bill citations". That claim was never verified and
// is probably wrong: the reference format ("BILL-2026-048") does not match APH bill
// numbering, and none of the five titles appears among the 25 genuine bills the Worker's
// live /bills endpoint returns (confirmed this session). On a provenance-first public
// product, a bill title that cannot be verified must not render, so every row is removed.
// The binding stays an empty array because the Bills desk is being wired to the live
// /bills endpoint (see the Worker's GET /bills, consumed elsewhere in this build), so
// nothing of value is lost by emptying the fixture.
const BILLS = [];

// DIVISIONS emptied: every field (date, chamber, question text, vote tally) described
// a specific division event with no verified source. Vote counts are explicitly named
// in the remediation brief as a forbidden invention class. Binding kept as an empty
// array; the Daily Program desk should render an honest empty state naming that no
// verified division-result feed is wired, with a link to
// https://www.aph.gov.au/house/rss/divisions (House) or the Senate equivalent.
const DIVISIONS = [];

// WATCHLISTS: name and keyword list are the product's own real configuration (a
// true statement about what Parliament Pulse is configured to watch for, kept per
// the honesty rule for genuine reference data). matches and trend claimed specific
// counts of live parliamentary activity that never happened: no keyword matcher
// over the signal stream is built (see DATASET_FLAGS below), so those counts were
// invented. Both are nulled/emptied; consumers compute the real match count from
// watchlistMatches() against the live signal stream (0 while it is disconnected)
// and show an honest "no trend history" state rather than a fabricated spark line.
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
  { name: "Queensland federal signals", keywords: 13, matches: null, trend: [] },
];

// RADAR emptied: every issue named a specific cluster of invented parliamentary
// activity (an invented Senate inquiry, invented QON references, an invented
// committee hearing) with an invented momentum/confidence score. No clustering
// layer over real signals is built. The binding stays an empty array; PageRadar
// renders an honest empty state in fixture mode and only shows rows once it is
// clustering the live signal stream (derived mode).
const RADAR = [];

// QON_PATTERN emptied: this fixture invented an entire analytical finding (a scrutiny
// cluster, a trigger event, four verbatim questions on notice) with no real ParlInfo
// or Hansard data behind it. Every field is kept in place with a null/empty value so
// the QON desk still loads and any code that reads QON_PATTERN.count or
// QON_PATTERN.items.length continues to work. The true reason there is no live
// substitute: ParlInfo's Questions on Notice search returns 403 to automated access,
// so no machine-readable QON feed can currently be fetched. The QON page should
// render an honest empty state naming that reason and linking to
// https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Questions_on_Notice
// (or the ParlInfo QON search) so a user can look it up manually.
const QON_PATTERN = {
  topic: null,
  members: [],
  window: null,
  count: 0,
  target: null,
  trigger: null,
  confidence: null,
  items: [],
};

// BRIEFING_QUEUE emptied: every row invented a specific piece of parliamentary
// business (a "Bill Digest Note" on a specific bill, an "Estimates Monitor Note")
// as if a named policy team already held it in review, naming real-sounding
// recipients ("Director, Digital Policy", "Procurement lead") against fabricated
// status and timestamps. A shared briefings queue needs a backend that does not
// exist. The binding stays an empty array; PageBriefings and the Overview briefing
// panel already read the user's own generated briefs (state.briefsGenerated) as
// their real source, so this fixture emptying only removes the invented rows and
// the nav badge count now reflects real generated briefs only.
const BRIEFING_QUEUE = [];

// ---------- Honesty: representative-data flags ----------
//
// Per the remediation honesty rule, every dataset NOT backed by a verified live
// feed must be clearly marked so the UI can render a "Representative data" chip and
// no control fires a success toast implying a backend action that did not happen.
//
// DATASET_FLAGS maps each global dataset name to whether it is representative
// (non-live fixture) or live (sourced from the SOURCE_REGISTRY poll at runtime).
// The Sources, Overview and Parliament/Today modules read live items from the
// poller; the arrays below are the representative fallback and enrichment fixtures.
// Each item additionally carries representative:true so per-card chips are honest.
//
// SOURCE_REGISTRY itself is live: it is the registry of verified feeds, not a fixture.
const DATASET_FLAGS = {
  SOURCE_REGISTRY: { representative: false, note: "Verified APH feeds, polled live via the Worker proxy." },
  SIGNALS:         { representative: true,  note: "Empty: every fixture signal was an invented parliamentary event with a fabricated source and evidence link. No enrichment pipeline (attention, scoring, provenance, NER) is built. The desks read the live /state signal stream instead; with no live connection they show an honest outage state, never invented signals." },
  COMMITTEE_ITEMS: { representative: true,  note: "Empty: no live committee-schedule feed is wired. Hearing times, topics and attention ratings were invented and have been removed. See https://www.aph.gov.au/Parliamentary_Business/Committees." },
  BILLS:           { representative: true,  note: "Empty: the fixture ref and title in every row could not be verified against the live bills data (none of the five titles appears among the 25 genuine bills the Worker's /bills endpoint returns) and have been removed. The Bills desk reads the live /bills endpoint instead." },
  DIVISIONS:       { representative: true,  note: "Empty: no verified division-result feed is wired. Vote tallies were invented and have been removed. See https://www.aph.gov.au/house/rss/divisions." },
  WATCHLISTS:      { representative: true,  note: "Name and keyword list are real product configuration and are kept. matches and trend were invented counts of live activity: no keyword matcher over the signal stream is built, so both are nulled/emptied and consumers compute the real (currently zero) match count live." },
  RADAR:           { representative: true,  note: "Empty: every issue named an invented cluster of parliamentary activity (fabricated inquiries, QON references, hearings) with an invented momentum/confidence score. No clustering layer over real signals is built; rows only render once the live signal stream is grouped (derived mode)." },
  QON_PATTERN:     { representative: true,  note: "Empty: ParlInfo Questions on Notice search returns 403 to automated access, so no live QON feed can be fetched. No representative fixture is held either. See https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/Questions_on_Notice." },
  BRIEFING_QUEUE:  { representative: true,  note: "Empty: every row invented a piece of parliamentary business already sitting in a named policy team's queue. A shared briefings queue needs a backend that does not exist; the desks read the user's own generated briefs (state.briefsGenerated) as the real source instead." },
};

// Stamp representative:true onto every item of each representative dataset so the UI
// can render the chip at the card level. This only ADDS a field; it never changes the
// existing field shape that pages.jsx and the drawer read.
[SIGNALS, COMMITTEE_ITEMS, BILLS, DIVISIONS, WATCHLISTS, RADAR, BRIEFING_QUEUE].forEach(arr => {
  arr.forEach(item => { if (item && item.representative === undefined) item.representative = true; });
});
QON_PATTERN.representative = true;

Object.assign(window, {
  WORKER_BASE_URL, SOURCE_REGISTRY, sourceCounts, DATASET_FLAGS, APH_FEEDS,
  SIGNALS, COMMITTEE_ITEMS, BILLS, DIVISIONS, WATCHLISTS, RADAR, QON_PATTERN, BRIEFING_QUEUE
});
