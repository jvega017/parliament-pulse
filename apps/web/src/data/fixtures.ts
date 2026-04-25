// Reference data for Parliament Pulse — production data policy.
//
// What lives here:
//   * APH_FEEDS — URLs of RSS endpoints the live poller reads
//   * APH_CONNECTORS — verified deep links into authoritative APH surfaces
//   * WATCHLISTS — the keyword sets that drive the live scoring engine
//
// What is intentionally empty:
//   * SIGNALS — driven entirely by the live RSS pump (lib/aphFeed +
//     lib/scoring). No seeded fake items.
//   * BILLS, COMMITTEE_ITEMS, DIVISIONS, RADAR, QON_PATTERN,
//     BRIEFING_QUEUE — empty until a verified upstream source is wired.
//     The UI surfaces a clear empty state with an APH deep link.
//
// Anti-fabrication rule: nothing here should be invented. Every URL must
// resolve against the live aph.gov.au site, every label must match an
// authoritative source.

import type {
  BillSummary,
  BriefingQueueItem,
  CommitteeItem,
  Division,
  Feed,
  QonPattern,
  RadarIssue,
  Signal,
  Watchlist,
} from "../types";

// Feeds shown on the Sources table. The five rows below are the working
// APH endpoints the poller reads (see lib/aphFeed.APH_FEED_URLS). Seven
// other APH RSS endpoints listed at https://www.aph.gov.au/Help/RSS_feeds
// currently return empty containers and are not surfaced here. They will
// be restored when APH publishes content again.
export const APH_FEEDS: Feed[] = [
  { id: "s-new-inquiries", group: "Senate", name: "New Senate committee inquiries", url: "https://www.aph.gov.au/senate/rss/new_inquiries", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Committees", "Emerging Issues"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "s-reports", group: "Senate", name: "Senate committee reports tabled", url: "https://www.aph.gov.au/senate/rss/reports", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Committees", "Briefings"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "s-upcoming", group: "Senate", name: "Upcoming Senate committee hearings", url: "https://www.aph.gov.au/senate/rss/upcoming_hearings", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Committees", "Briefing Queue"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "s-senators", group: "Senate", name: "Senators' details updates", url: "https://www.aph.gov.au/senate/rss/senators_details", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Source archive"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "h-media", group: "House", name: "House Media Releases", url: "https://www.aph.gov.au/house/rss/media_releases", status: "live", last: "just polled", today: 0, fpr: "Med", modules: ["Today's Signal"], parser: "Valid", authority: "Official", confidence: "Medium" },
];

/**
 * Authoritative APH connector index used across the app.
 * Every URL in this table resolves against the live Parliament of Australia
 * website. Source: https://www.aph.gov.au/Help/RSS_feeds plus the public
 * Parliamentary Business chamber and committee pages.
 */
export const APH_CONNECTORS = [
  { id: "rss-directory", name: "APH RSS feed directory", url: "https://www.aph.gov.au/Help/RSS_feeds", desc: "Every published RSS endpoint" },
  { id: "hansard", name: "Hansard hub", url: "https://www.aph.gov.au/Parliamentary_Business/Hansard", desc: "Daily transcripts of Senate, House, Federation Chamber and committees" },
  { id: "parlinfo", name: "ParlInfo search", url: "https://parlinfo.aph.gov.au/", desc: "Full-text across bills, Hansard, committee transcripts" },
  { id: "bills", name: "Bills Search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results", desc: "Filter bills by stage, type, date" },
  { id: "house-program", name: "House Daily Program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR/House_Daily_Program", desc: "Today's House business, posted ~1h before sitting" },
  { id: "senate-red", name: "Senate Dynamic Red", url: "https://parlwork.aph.gov.au/Senate/DynamicRed", desc: "Live Senate order of business (ParlWork)" },
  { id: "parlview", name: "ParlView archive", url: "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/", desc: "Search and download recorded proceedings" },
  { id: "watch", name: "Watch / Read / Listen", url: "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen", desc: "Live streams, Hansard, podcasts, public hearings" },
  { id: "members", name: "Senators and Members", url: "https://www.aph.gov.au/Senators_and_Members", desc: "Roster, portfolios, contact details" },
  { id: "committees", name: "Committees hub", url: "https://www.aph.gov.au/Parliamentary_Business/Committees", desc: "All Senate, House, Joint and select committees" },
  { id: "flagpost", name: "FlagPost (Parliamentary Library)", url: "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/Research/FlagPost", desc: "Library research blog" },
  { id: "library", name: "Parliamentary Library research", url: "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library", desc: "Bills Digests, Issues and Insights, briefing papers" },
];

// SIGNALS is empty by design. The Live page polls APH RSS through the
// aph-proxy Worker and feeds items through lib/scoring.signalFromFeedItem,
// which is what populates the in-memory store at runtime. No seed items.
export const SIGNALS: Signal[] = [];

// COMMITTEE_ITEMS is empty by design. The Committees page lists the real
// public APH committees from ENTITIES and links to each committee's
// canonical APH page for current hearings, inquiries and reports.
export const COMMITTEE_ITEMS: CommitteeItem[] = [];

// BILLS is empty by design. The Bills Intelligence page links to APH
// Bills Search until a verified Bills ingest is wired in.
export const BILLS: BillSummary[] = [];

// DIVISIONS is empty by design. Wire to APH division records when the
// House and Senate division feeds resume.
export const DIVISIONS: Division[] = [];

// Watchlist terms drive the live scoring engine (see lib/scoring.ts). Each
// `terms` entry is matched case-insensitively against incoming RSS titles.
// These are policy-neutral keyword sets, not synthetic content.
export const WATCHLISTS: Watchlist[] = [
  { name: "Digital government", keywords: 7, terms: ["digital", "service delivery", "mygov", "apsc", "dta", "ict", "government services"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "AI and automation", keywords: 6, terms: ["artificial intelligence", "ai assurance", "automation", "algorithm", "machine learning", "automated decision"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Cyber security", keywords: 6, terms: ["cyber", "ransomware", "critical infrastructure", "data breach", "information security", "essential services"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Digital identity", keywords: 5, terms: ["digital id", "identity", "biometric", "credential", "accreditation"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Data sharing and privacy", keywords: 6, terms: ["privacy", "data sharing", "consumer data right", "cdr", "oaic", "personal information"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Procurement", keywords: 6, terms: ["procurement", "contract", "tender", "consultancy", "anao", "audit"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Service delivery", keywords: 4, terms: ["services australia", "centrelink", "medicare", "social services"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Infrastructure and connectivity", keywords: 5, terms: ["telecommunications", "broadband", "nbn", "spectrum", "regional connectivity"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Health digital systems", keywords: 4, terms: ["my health record", "digital health", "health systems", "aged care digital"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Parliamentary scrutiny", keywords: 5, terms: ["inquiry", "committee", "hearing", "report tabled", "submissions"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Estimates preparation", keywords: 3, terms: ["estimates", "question on notice", "qon"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
  { name: "Queensland federal signals", keywords: 3, terms: ["queensland", "brisbane", "qld"], matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
];

// RADAR is empty by design. Replace with a real cluster engine that derives
// emerging issues from the live signal stream once that lands.
export const RADAR: RadarIssue[] = [];

// QON_PATTERN is null by design. The QON pattern detector requires a real
// Hansard QON ingest, not yet wired.
export const QON_PATTERN: QonPattern | null = null;

// BRIEFING_QUEUE is empty by design. Briefings are produced only from
// real signals via the Drawer's "Generate brief" action.
export const BRIEFING_QUEUE: BriefingQueueItem[] = [];
