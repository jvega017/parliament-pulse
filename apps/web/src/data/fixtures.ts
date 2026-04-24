// Fixture data for Parliament Pulse.
// Every record here is sample data for UI rendering and should be labelled
// as such in any beta release. Real live content is polled from APH via the
// aph-proxy Worker (see lib/aphFeed.ts).

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

// Feeds shown on the Sources table. Only the five below are actually wired
// to the live poller (see lib/aphFeed.APH_FEED_URLS). Seven APH feeds have
// been removed from this table because they currently return empty RSS
// containers and showing them as "live" would be dishonest. When APH
// restores them, restore these rows and add them back to APH_FEED_URLS.
//   Removed: house_news, house_inquiries, joint_inquiries, daily_program,
//            todays_hearings, divisions, senate red (today's hearings)
//   Removed: Bills Digests parlinfo matrix-param URL (returns 502)
//   Removed: Library Publications matrix-param URL (returns 502)
//   Removed: FlagPost HTML endpoint (not RSS, parser needs validation)
export const APH_FEEDS: Feed[] = [
  { id: "s-new-inquiries", group: "Senate", name: "New Senate committee inquiries", url: "https://www.aph.gov.au/senate/rss/new_inquiries", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Committees", "Emerging Issues"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "s-reports", group: "Senate", name: "Senate committee reports tabled", url: "https://www.aph.gov.au/senate/rss/reports", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Committees", "Briefings"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "s-upcoming", group: "Senate", name: "Upcoming Senate committee hearings", url: "https://www.aph.gov.au/senate/rss/upcoming_hearings", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Committees", "Briefing Queue"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "s-senators", group: "Senate", name: "Senators' details updates", url: "https://www.aph.gov.au/senate/rss/senators_details", status: "live", last: "just polled", today: 0, fpr: "Low", modules: ["Source archive"], parser: "Valid", authority: "Official", confidence: "High" },
  { id: "h-media", group: "House", name: "House Media Releases", url: "https://www.aph.gov.au/house/rss/media_releases", status: "live", last: "just polled", today: 0, fpr: "Med", modules: ["Today's Signal"], parser: "Valid", authority: "Official", confidence: "Medium" },
];

export const SIGNALS: Signal[] = [
  {
    id: "CS-0412",
    time: "08:15",
    date: "24 Apr 2026",
    source: "Senate New Inquiries RSS",
    sourceGroup: "Senate",
    title: "[Sample] New Senate inquiry into digital government procurement governance",
    summary:
      "The Senate Finance and Public Administration References Committee has opened an inquiry examining procurement governance across large-scale digital programs, with submissions due 19 May.",
    tags: [
      { l: "Digital procurement", c: "brass" },
      { l: "Finance & PA Committee", c: "teal" },
      { l: "Watchlist match", c: "info" },
    ],
    attention: "high",
    attentionReason:
      "Matches two watchlists (Digital procurement, Procurement). Source authority: Official APH feed. Novelty: new inquiry.",
    action: "Assign Policy Owner",
    actionReason:
      "New inquiry with direct portfolio relevance and submission window open. A named owner reduces the risk of a missed submission date.",
    confidence: 4,
    sourceAuthority: "Official",
    humanReview: "Required",
    evidence: [
      { label: "Finance & PA Committee (APH)", url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Finance_and_Public_Administration" },
      { label: "Senate New Inquiries RSS", url: "https://www.aph.gov.au/senate/rss/new_inquiries" },
      { label: "APH RSS feed directory", url: "https://www.aph.gov.au/Help/RSS_feeds" },
    ],
    score: { authority: 0.95, portfolio: 0.9, novelty: 0.9, momentum: 0.4, time: 0.6, scrutiny: 0.85, ops: 0.7 },
    provenance: [
      { ts: "08:14:02", by: "parser", event: "Fetched item from Senate New Inquiries RSS (200 OK, 2.3kb)" },
      { ts: "08:14:03", by: "parser", event: "Matched <item> schema v3, GUID: aph-inq-2026-0412" },
      { ts: "08:14:04", by: "enrichment", event: "Keyword match: procurement, digital programs, $100m triggered watchlists [Digital procurement, Procurement]" },
      { ts: "08:14:05", by: "scoring", event: "Attention = 0.86 -> HIGH (authority 0.95 x portfolio 0.90 x novelty 0.90)" },
      { ts: "08:15:00", by: "publish", event: "Published as CS-0412, human review required" },
    ],
    updates: [
      { ts: "08:47", who: "System", what: "Cross-linked to BILL-2026-048 via procurement co-occurrence" },
      { ts: "09:12", who: "System", what: "Momentum +0.1, 2nd media release picked up (House Media RSS)" },
      { ts: "09:30", who: "K. Ngata (analyst)", what: "Confirmed portfolio match, no reclassification" },
    ],
    members: ["hollis", "quirke"],
  },
  {
    id: "CS-0411",
    time: "08:04",
    date: "24 Apr 2026",
    source: "House Media Releases RSS",
    sourceGroup: "House",
    title: "[Sample] Speaker announces procedural changes to Wednesday sittings",
    summary:
      "The Speaker has confirmed adjusted sitting order for private members' business on Wednesdays, effective next sitting week.",
    tags: [{ l: "Procedural" }, { l: "House" }],
    attention: "low",
    attentionReason:
      "No portfolio keywords, no watchlist match, procedural in nature. Downgraded from Medium after prior feedback on similar items.",
    action: "No Action Required / Archive",
    actionReason: "Procedural update with no portfolio or scrutiny implications.",
    confidence: 5,
    sourceAuthority: "Official",
    humanReview: "Optional",
    evidence: [
      { label: "Speaker's media release", url: "https://www.aph.gov.au/About_Parliament/House_of_Representatives/News_and_events/Media_releases" },
    ],
    score: { authority: 0.95, portfolio: 0.05, novelty: 0.3, momentum: 0.1, time: 0.1, scrutiny: 0.1, ops: 0.05 },
    provenance: [
      { ts: "08:03:22", by: "parser", event: "Fetched item from House Media Releases RSS (200 OK)" },
      { ts: "08:03:23", by: "enrichment", event: "No watchlist match, no portfolio keywords" },
      { ts: "08:03:24", by: "scoring", event: "Attention = 0.18 -> LOW (portfolio 0.05)" },
      { ts: "08:03:25", by: "learning", event: "Downgrade rule applied: 3 prior 'Too high' votes on procedural items from this source" },
      { ts: "08:04:00", by: "publish", event: "Published as CS-0411" },
    ],
    updates: [],
    members: [],
  },
  {
    id: "CS-0410",
    time: "07:48",
    date: "24 Apr 2026",
    source: "Bills Digests RSS",
    sourceGroup: "Library",
    title: "[Sample] Bills Digest published: Digital ID Amendment (Assurance) Bill 2026",
    summary:
      "Parliamentary Library Bills Digest provides background, purpose and key provisions for the Digital ID Amendment (Assurance) Bill, with notes on scope of accreditation and consumer safeguards.",
    tags: [
      { l: "Digital identity", c: "brass" },
      { l: "Bills Digest", c: "teal" },
      { l: "Watchlist match", c: "info" },
    ],
    attention: "high",
    attentionReason:
      "Bill touches two watchlists (Digital identity, Data sharing & privacy). Digest explicitly notes accreditation scope changes.",
    action: "Draft Executive Brief",
    actionReason:
      "Material shift in accreditation scope warrants DDG-level awareness ahead of second reading.",
    confidence: 4,
    sourceAuthority: "Official",
    humanReview: "Required",
    evidence: [
      { label: "Bills Digests index (Parliamentary Library)", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results" },
      { label: "Bills Legislation landing", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation" },
      { label: "Parliamentary Library", url: "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library" },
    ],
    score: { authority: 0.95, portfolio: 0.85, novelty: 0.8, momentum: 0.55, time: 0.5, scrutiny: 0.7, ops: 0.7 },
    provenance: [
      { ts: "07:46:11", by: "parser", event: "Fetched Bills Digest bd2526a-048 (PDF, 342kb)" },
      { ts: "07:46:45", by: "extractor", event: "Extracted sections: Purpose, Key provisions, Parliamentary consideration" },
      { ts: "07:47:02", by: "enrichment", event: "Linked to BILL-2026-048, 2 watchlists matched" },
      { ts: "07:47:10", by: "scoring", event: "Attention = 0.78 -> HIGH, accreditation scope flagged as novel" },
      { ts: "07:48:00", by: "publish", event: "Published as CS-0410" },
    ],
    updates: [{ ts: "08:22", who: "System", what: "Linked to incoming QON cluster (3 references)" }],
    members: ["rafferty"],
  },
  {
    id: "CS-0409",
    time: "07:30",
    date: "24 Apr 2026",
    source: "Today's Senate Hearings RSS",
    sourceGroup: "Senate",
    title: "[Sample] Today: Legal & Constitutional, AI assurance in regulated services",
    summary:
      "Hearing scheduled 10:00 AEST. Witnesses include Dept. of Industry, OAIC, and two industry peak bodies. Related to ongoing AI assurance inquiry.",
    tags: [
      { l: "AI assurance", c: "brass" },
      { l: "Today", c: "amber" },
      { l: "Legal & Constitutional", c: "teal" },
    ],
    attention: "high",
    attentionReason:
      "Hearing today, portfolio match, cross-source reinforcement with last week's FlagPost on AI assurance.",
    action: "Monitor for Estimates",
    actionReason: "Likely to produce QONs and Hansard references useful for Estimates preparation.",
    confidence: 4,
    sourceAuthority: "Official",
    humanReview: "Required",
    evidence: [
      { label: "Committee home page", url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Legal_and_Constitutional_Affairs" },
      { label: "Today's Senate hearings RSS", url: "https://www.aph.gov.au/senate/rss/red" },
    ],
    score: { authority: 0.95, portfolio: 0.85, novelty: 0.4, momentum: 0.7, time: 0.95, scrutiny: 0.9, ops: 0.6 },
    provenance: [
      { ts: "07:28:30", by: "parser", event: "Fetched Today's Senate Hearings RSS" },
      { ts: "07:28:45", by: "enrichment", event: "Witness list extracted, OAIC flagged (regulator)" },
      { ts: "07:29:10", by: "scoring", event: "Attention = 0.82 -> HIGH, time-sensitive (today)" },
      { ts: "07:30:00", by: "publish", event: "Published as CS-0409" },
    ],
    updates: [{ ts: "09:45", who: "System", what: "Hearing commenced, live broadcast link attached" }],
    members: [],
  },
  {
    id: "CS-0408",
    time: "07:10",
    date: "24 Apr 2026",
    source: "House Daily Program RSS",
    sourceGroup: "House",
    title: "[Sample] House daily program: Cyber Security Legislation Amendment listed for 2nd reading",
    summary:
      "Program shows second reading debate scheduled for Cyber Security Legislation Amendment Bill 2026. Private members' business follows at 4:30pm.",
    tags: [
      { l: "Cyber security", c: "brass" },
      { l: "2nd reading", c: "amber" },
    ],
    attention: "med",
    attentionReason: "Tracked bill on daily program. Time sensitivity elevated for sitting day.",
    action: "Prepare Ministerial / Parliamentary Lines",
    actionReason:
      "Public debate may surface new scrutiny angles; suggested lines should be ready before 2pm.",
    confidence: 4,
    sourceAuthority: "Official",
    humanReview: "Optional",
    evidence: [
      { label: "House daily program", url: "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR_chamber_documents/Daily_program" },
      { label: "Bills Legislation search", url: "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results" },
    ],
    score: { authority: 0.95, portfolio: 0.75, novelty: 0.35, momentum: 0.5, time: 0.85, scrutiny: 0.7, ops: 0.55 },
    provenance: [
      { ts: "07:08:15", by: "parser", event: "Fetched House Daily Program RSS" },
      { ts: "07:08:40", by: "enrichment", event: "Matched BILL-2026-041, stage change: Listed for 2nd reading" },
      { ts: "07:09:20", by: "scoring", event: "Attention = 0.64 -> MEDIUM, sitting day" },
      { ts: "07:10:00", by: "publish", event: "Published as CS-0408" },
    ],
    updates: [],
    members: [],
  },
  {
    id: "CS-0407",
    time: "06:30",
    date: "24 Apr 2026",
    source: "Library Publications RSS",
    sourceGroup: "Library",
    title: "[Sample] FlagPost: Trust, automation, and the next phase of Digital ID",
    summary:
      "Research commentary on governance frameworks for automated identity assurance and implications for public-sector service delivery.",
    tags: [
      { l: "Digital identity", c: "brass" },
      { l: "FlagPost" },
    ],
    attention: "med",
    attentionReason: "Strong contextual source. Reinforces the Digital ID bill signal.",
    action: "Add to Watchlist",
    actionReason: "Feeds into emerging issues cluster around Digital ID assurance governance.",
    confidence: 3,
    sourceAuthority: "Official",
    humanReview: "Optional",
    evidence: [
      { label: "FlagPost (Parliamentary Library)", url: "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/FlagPost" },
      { label: "Parliamentary Library landing", url: "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library" },
    ],
    score: { authority: 0.8, portfolio: 0.7, novelty: 0.6, momentum: 0.5, time: 0.3, scrutiny: 0.4, ops: 0.3 },
    provenance: [
      { ts: "06:28:50", by: "parser", event: "Fetched Library Publications RSS" },
      { ts: "06:29:10", by: "enrichment", event: "Cluster match: Digital ID (co-occurring with CS-0410)" },
      { ts: "06:29:30", by: "scoring", event: "Attention = 0.52 -> MEDIUM, contextual support" },
      { ts: "06:30:00", by: "publish", event: "Published as CS-0407" },
    ],
    updates: [],
    members: [],
  },
];

export const COMMITTEE_ITEMS: CommitteeItem[] = [
  { when: "Today, 10:00", type: "Hearing", name: "Legal & Constitutional Affairs Legislation Committee", topic: "AI assurance in regulated services", portfolio: "Digital government", att: "high" },
  { when: "Today, 13:30", type: "Hearing", name: "Finance & Public Administration References", topic: "Commonwealth procurement & contract governance", portfolio: "Procurement", att: "high" },
  { when: "25 Apr, 09:00", type: "Hearing", name: "Economics Legislation Committee", topic: "Consumer Data Right — expansion review", portfolio: "Data & privacy", att: "med" },
  { when: "26 Apr, 14:00", type: "Hearing", name: "Rural & Regional Affairs Committee", topic: "Regional connectivity outcomes", portfolio: "Infrastructure", att: "med" },
  { when: "28 Apr, 11:00", type: "Hearing", name: "Joint Committee on Law Enforcement", topic: "Scam activity trends", portfolio: "Cyber security", att: "low" },
  { when: "Yesterday", type: "Report tabled", name: "Environment & Communications References", topic: "Regional 5G rollout — interim report", portfolio: "Infrastructure", att: "med" },
  { when: "Yesterday", type: "New inquiry", name: "Joint Committee on Public Accounts & Audit", topic: "Digital transformation program governance", portfolio: "Digital government", att: "high" },
];

export const BILLS: BillSummary[] = [
  { ref: "BILL-2026-048", title: "Digital ID Amendment (Assurance) Bill 2026", stage: "House: 2nd reading", portfolio: "Digital identity", digest: "Published", owner: "Policy — Identity", att: "high" },
  { ref: "BILL-2026-041", title: "Cyber Security Legislation Amendment Bill 2026", stage: "House: 2nd reading today", portfolio: "Cyber security", digest: "Published", owner: "Policy — Cyber", att: "high" },
  { ref: "BILL-2026-037", title: "Consumer Data Right Expansion Bill 2026", stage: "Senate: committee stage", portfolio: "Data & privacy", digest: "Published", owner: "Policy — Data", att: "med" },
  { ref: "BILL-2026-031", title: "Telecommunications (Regional Connectivity) Amendment Bill", stage: "House: 3rd reading", portfolio: "Infrastructure", digest: "Pending", owner: "—", att: "med" },
  { ref: "BILL-2026-024", title: "Social Services Digital Delivery Amendment Bill", stage: "Senate: introduced", portfolio: "Service delivery", digest: "Pending", owner: "—", att: "low" },
];

export const DIVISIONS: Division[] = [
  { when: "23 Apr, 16:42", chamber: "House", q: "Question — amendment to Cyber Security Bill, clause 12", result: "Negatived (64-78)", bill: "BILL-2026-041" },
  { when: "23 Apr, 15:10", chamber: "House", q: "Motion — adjournment of debate on Digital ID Bill", result: "Agreed (77-63)", bill: "BILL-2026-048" },
  { when: "22 Apr, 12:05", chamber: "House", q: "Second reading — CDR Expansion Bill", result: "Agreed (81-58)", bill: "BILL-2026-037" },
];

export const WATCHLISTS: Watchlist[] = [
  { name: "Digital government", keywords: 24, matches: 11, trend: [3, 4, 5, 4, 6, 8, 11] },
  { name: "AI & automation", keywords: 18, matches: 7, trend: [2, 2, 3, 5, 4, 6, 7] },
  { name: "Cyber security", keywords: 21, matches: 9, trend: [6, 5, 7, 8, 6, 9, 9] },
  { name: "Digital identity", keywords: 14, matches: 6, trend: [1, 2, 3, 4, 5, 5, 6] },
  { name: "Data sharing & privacy", keywords: 19, matches: 5, trend: [3, 3, 4, 4, 5, 5, 5] },
  { name: "Procurement", keywords: 16, matches: 8, trend: [4, 4, 5, 6, 7, 7, 8] },
  { name: "Service delivery", keywords: 17, matches: 3, trend: [2, 2, 2, 3, 3, 3, 3] },
  { name: "Infrastructure & connectivity", keywords: 15, matches: 4, trend: [2, 3, 3, 4, 4, 4, 4] },
  { name: "Health digital systems", keywords: 12, matches: 2, trend: [1, 1, 2, 2, 2, 2, 2] },
  { name: "Parliamentary scrutiny", keywords: 22, matches: 10, trend: [6, 7, 8, 9, 9, 10, 10] },
  { name: "Estimates preparation", keywords: 11, matches: 4, trend: [2, 2, 3, 3, 4, 4, 4] },
  { name: "Queensland federal signals", keywords: 13, matches: 2, trend: [1, 1, 1, 2, 2, 2, 2] },
];

export const RADAR: RadarIssue[] = [
  { issue: "Digital procurement governance", att: "high", reason: "New Senate inquiry plus 2 media releases plus 4 QON references", sources: 7, momentum: 0.82, confidence: 0.82 },
  { issue: "Digital ID accreditation scope", att: "high", reason: "New Bills Digest plus FlagPost plus committee hearing", sources: 5, momentum: 0.74, confidence: 0.78 },
  { issue: "AI assurance in regulated services", att: "med", reason: "Hearing today plus library publication plus prior FlagPost", sources: 4, momentum: 0.62, confidence: 0.65 },
  { issue: "Cyber resilience for critical infrastructure", att: "med", reason: "Upcoming hearing plus related bill on daily program", sources: 3, momentum: 0.55, confidence: 0.6 },
  { issue: "Consumer Data Right expansion", att: "med", reason: "Committee stage plus QON cluster", sources: 3, momentum: 0.48, confidence: 0.55 },
  { issue: "Regional connectivity outcomes", att: "low", reason: "Interim report tabled", sources: 2, momentum: 0.3, confidence: 0.5 },
];

export const QON_PATTERN: QonPattern = {
  topic: "Digital procurement governance",
  members: ["Sen. A. Hollis", "Sen. M. Quirke", "Hon. P. Rafferty MP"],
  window: "24 to 72 hours",
  count: 4,
  target: "Minister for Digital Services / Department",
  trigger: "Audit report tabled 22 Apr",
  confidence: "Medium",
  items: [
    { when: "22 Apr 14:12", who: "Sen. A. Hollis (Opposition)", chamber: "Senate", q: "Details of contract governance framework for digital programs over $100m since FY23-24" },
    { when: "22 Apr 15:40", who: "Sen. M. Quirke (Crossbench)", chamber: "Senate", q: "Number of variations to digital procurement contracts in the last 24 months, by department" },
    { when: "23 Apr 11:02", who: "Hon. P. Rafferty MP", chamber: "House", q: "Status of Departmental response to ANAO report on digital program governance" },
    { when: "23 Apr 16:18", who: "Sen. A. Hollis (Opposition)", chamber: "Senate", q: "Use of limited tender for digital platforms where contract value exceeded $10m" },
  ],
};

export const BRIEFING_QUEUE: BriefingQueueItem[] = [
  { type: "Daily Signal Brief", for: "DDG Digital", status: "Drafted", at: "08:20", ready: true },
  { type: "Committee Brief", for: "Procurement lead", status: "Awaiting review", at: "07:50", ready: false },
  { type: "Bill Digest Note", for: "Identity policy", status: "Drafted", at: "07:02", ready: true },
  { type: "Estimates Monitor Note", for: "Estimates pack", status: "In progress", at: "06:44", ready: false },
];
