// Canonical APH feed list shared by the proxy, the archival cron, and the
// connector health cron. Mirrors apps/web/src/lib/aphFeed.APH_FEED_URLS.

export interface FeedMeta {
  url: string;
  label: string;
  kind: "division" | "hearing" | "program" | "inquiry" | "report" | "digest" | "signal";
}

export const APH_FEEDS: FeedMeta[] = [
  // Senate feeds (verified working, high-value committee intelligence)
  { url: "https://www.aph.gov.au/senate/rss/new_inquiries", label: "New Senate inquiries", kind: "inquiry" },
  { url: "https://www.aph.gov.au/senate/rss/reports", label: "Senate reports tabled", kind: "report" },
  { url: "https://www.aph.gov.au/senate/rss/upcoming_hearings", label: "Upcoming Senate hearings", kind: "hearing" },
  { url: "https://www.aph.gov.au/senate/rss/senators_details", label: "Senators' details updates", kind: "signal" },
  // House feeds
  { url: "https://www.aph.gov.au/house/rss/media_releases", label: "House media releases", kind: "signal" },
  { url: "https://www.aph.gov.au/house/rss/house_inquiries", label: "House committee inquiries", kind: "inquiry" },
  { url: "https://www.aph.gov.au/house/rss/joint_inquiries", label: "Joint committee inquiries", kind: "inquiry" },
  // Parliamentary Library — Bills Digests (plain-English summaries, Date:thisYear = 2026)
  // This is the primary source for 2026 legislative data in the archive.
  { url: "https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=0;query=Date%3AthisYear%20Dataset%3Abillsdgs;resCount=100", label: "Bills Digests 2026", kind: "digest" },
];

// Canonical 12 connector URLs; cron pings these fortnightly for liveness.
export const APH_CONNECTORS: string[] = [
  "https://www.aph.gov.au/Help/RSS_feeds",
  "https://www.aph.gov.au/Parliamentary_Business/Hansard",
  "https://parlinfo.aph.gov.au/",
  "https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results",
  "https://www.aph.gov.au/Parliamentary_Business/Chamber_documents/HoR/House_Daily_Program",
  "https://parlwork.aph.gov.au/Senate/DynamicRed",
  "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen/ParlView/",
  "https://www.aph.gov.au/News_and_Events/Watch_Read_Listen",
  "https://www.aph.gov.au/Senators_and_Members",
  "https://www.aph.gov.au/Parliamentary_Business/Committees",
  "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/Research/FlagPost",
  "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library",
];

export function sourceGroupFor(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("library") || lower.includes("flagpost") || lower.includes("digest") || lower.includes("bills digest")) return "Library";
  if (lower.includes("joint")) return "Custom";
  if (lower.includes("senate") || lower.includes("senators")) return "Senate";
  return "House";
}
