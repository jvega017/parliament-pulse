// APH feed fetch via our own Cloudflare Worker (workers/aph-proxy).
// The Worker enforces the APH host allowlist, caches for 5 min in KV,
// and sends proper CORS headers.

export interface FeedMeta {
  url: string;
  label: string;
  kind: "division" | "hearing" | "program" | "inquiry" | "report" | "digest" | "signal";
}

export interface FeedItem {
  title: string;
  link: string;
  pubDate: Date | null;
  sourceLabel: string;
  sourceUrl: string;
  kind: FeedMeta["kind"];
}

export interface FeedResult {
  items: FeedItem[];
  feedStatus: Record<string, { ok: boolean; count?: number; error?: string }>;
  lastPoll: Date;
}

export const APH_FEED_URLS: FeedMeta[] = [
  { url: "https://www.aph.gov.au/house/rss/divisions", label: "House Divisions", kind: "division" },
  { url: "https://www.aph.gov.au/house/rss/todays_hearings", label: "Today's House hearings", kind: "hearing" },
  { url: "https://www.aph.gov.au/house/rss/daily_program", label: "House Daily Program", kind: "program" },
  { url: "https://www.aph.gov.au/senate/rss/red", label: "Today's Senate hearings", kind: "hearing" },
  { url: "https://www.aph.gov.au/senate/rss/new_inquiries", label: "New Senate inquiries", kind: "inquiry" },
  { url: "https://www.aph.gov.au/senate/rss/reports", label: "Senate reports tabled", kind: "report" },
  { url: "https://www.aph.gov.au/senate/rss/upcoming_hearings", label: "Upcoming Senate hearings", kind: "hearing" },
  { url: "https://www.aph.gov.au/house/rss/house_inquiries", label: "House inquiries", kind: "inquiry" },
  { url: "https://www.aph.gov.au/house/rss/joint_inquiries", label: "Joint inquiries", kind: "inquiry" },
  { url: "https://www.aph.gov.au/house/rss/media_releases", label: "House media releases", kind: "signal" },
  { url: "https://www.aph.gov.au/house/rss/house_news", label: "About the House News", kind: "signal" },
  {
    url: "https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=0;query=Date%3AthisYear%20Dataset%3Abillsdgs;resCount=100",
    label: "Bills Digests",
    kind: "digest",
  },
];

function parseRssXml(xml: string, feed: FeedMeta): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const items: FeedItem[] = [];

  const nodes = doc.querySelectorAll("item, entry");
  nodes.forEach((node) => {
    const title = node.querySelector("title")?.textContent?.trim() ?? "";
    const linkEl = node.querySelector("link");
    const link = linkEl?.getAttribute("href") ?? linkEl?.textContent?.trim() ?? "";
    const pubText =
      node.querySelector("pubDate")?.textContent ??
      node.querySelector("updated")?.textContent ??
      node.querySelector("published")?.textContent ??
      null;
    const pubDate = pubText ? new Date(pubText) : null;

    if (!title || !link) return;
    items.push({
      title,
      link,
      pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : null,
      sourceLabel: feed.label,
      sourceUrl: feed.url,
      kind: feed.kind,
    });
  });

  return items.slice(0, 8);
}

export async function fetchFeedViaProxy(
  feed: FeedMeta,
  apiBase: string,
  signal?: AbortSignal,
): Promise<FeedItem[]> {
  const proxyUrl = `${apiBase.replace(/\/$/, "")}/rss?u=${encodeURIComponent(feed.url)}`;
  const res = await fetch(proxyUrl, { signal, headers: { Accept: "application/xml" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();
  return parseRssXml(text, feed);
}

export async function fetchAllFeeds(
  apiBase: string,
  signal?: AbortSignal,
): Promise<FeedResult> {
  const results = await Promise.allSettled(
    APH_FEED_URLS.map((f) => fetchFeedViaProxy(f, apiBase, signal)),
  );
  const items: FeedItem[] = [];
  const feedStatus: FeedResult["feedStatus"] = {};

  results.forEach((r, i) => {
    const feed = APH_FEED_URLS[i]!;
    if (r.status === "fulfilled") {
      feedStatus[feed.url] = { ok: true, count: r.value.length };
      items.push(...r.value);
    } else {
      feedStatus[feed.url] = {
        ok: false,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    }
  });

  // Sort by pubDate desc; items without dates go last (preserve feed order within).
  items.sort((a, b) => {
    if (a.pubDate && b.pubDate) return b.pubDate.getTime() - a.pubDate.getTime();
    if (a.pubDate) return -1;
    if (b.pubDate) return 1;
    return 0;
  });

  return { items: items.slice(0, 30), feedStatus, lastPoll: new Date() };
}
