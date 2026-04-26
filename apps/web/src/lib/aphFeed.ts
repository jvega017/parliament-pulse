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

// Verified working APH RSS feeds (audit 2026-04-24).
// Seven feeds that are listed on https://www.aph.gov.au/Help/RSS_feeds
// currently return empty containers and have been removed from the poll.
// If APH restores content, they can be re-added:
//   house/rss/divisions, house/rss/todays_hearings, house/rss/daily_program,
//   senate/rss/red, house/rss/house_inquiries, house/rss/joint_inquiries,
//   house/rss/house_news
// Feed expansion: house_inquiries, joint_inquiries, and ParlInfo Bills Digests
// added in Wave 13 after re-verifying the APH RSS feed directory (Apr 2026).
// The ParlInfo Bills Digests URL uses Date:thisYear so it always returns
// current-year bills — this is the primary 2026 legislative data source.
export const APH_FEED_URLS: FeedMeta[] = [
  // Senate
  { url: "https://www.aph.gov.au/senate/rss/new_inquiries", label: "New Senate inquiries", kind: "inquiry" },
  { url: "https://www.aph.gov.au/senate/rss/reports", label: "Senate reports tabled", kind: "report" },
  { url: "https://www.aph.gov.au/senate/rss/upcoming_hearings", label: "Upcoming Senate hearings", kind: "hearing" },
  { url: "https://www.aph.gov.au/senate/rss/senators_details", label: "Senators' details updates", kind: "signal" },
  // House
  { url: "https://www.aph.gov.au/house/rss/media_releases", label: "House media releases", kind: "signal" },
  { url: "https://www.aph.gov.au/house/rss/house_inquiries", label: "House committee inquiries", kind: "inquiry" },
  // Joint committees (managed by House secretariat)
  { url: "https://www.aph.gov.au/house/rss/joint_inquiries", label: "Joint committee inquiries", kind: "inquiry" },
  // Parliamentary Library — Bills Digests 2026
  { url: "https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=0;query=Date%3AthisYear%20Dataset%3Abillsdgs;resCount=100", label: "Bills Digests 2026", kind: "digest" },
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

// --------- AUSParliamentLive YouTube resolver ---------
// The @AUSParliamentLive channel does not run a single persistent live stream.
// Each sitting session and committee hearing is a separately scheduled stream
// with its own video id, so the /embed/live_stream?channel=<id> endpoint
// resolves to an offline placeholder. We work around that by reading the
// channel's public RSS feed and picking the most recent entry whose title
// matches the requested chamber.

export type YtChamber = "house" | "senate" | "federation";

export interface LiveVideo {
  videoId: string;
  title: string;
  publishedAt: Date;
}

const APH_YT_CHANNEL = "UCvO8Qfr3etT6khGA9Zln8WA";
const APH_YT_RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${APH_YT_CHANNEL}`;

interface YtEntry {
  videoId: string;
  title: string;
  published: Date;
}

function parseYtFeed(xml: string): YtEntry[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const entries: YtEntry[] = [];
  doc.querySelectorAll("entry").forEach((entry) => {
    const videoId = entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim();
    const title = entry.querySelector("title")?.textContent?.trim();
    const pub = entry.querySelector("published")?.textContent?.trim();
    if (!videoId || !title) return;
    const published = pub ? new Date(pub) : new Date(0);
    entries.push({ videoId, title, published });
  });
  return entries;
}

function matchChamber(entry: YtEntry, chamber: YtChamber): boolean {
  const t = entry.title.toLowerCase();
  switch (chamber) {
    case "house":
      return /house of representatives|\bhor\b|\bhouse\b/.test(t) && !/senate/.test(t);
    case "senate":
      return /\bsenate\b/.test(t) && !/federation/.test(t);
    case "federation":
      return /federation chamber/.test(t);
  }
}

export async function resolveLiveVideo(
  apiBase: string,
  chamber: YtChamber,
  signal?: AbortSignal,
): Promise<LiveVideo | null> {
  const proxied = `${apiBase.replace(/\/$/, "")}/rss?u=${encodeURIComponent(APH_YT_RSS)}`;
  try {
    const res = await fetch(proxied, { signal });
    if (!res.ok) return null;
    const xml = await res.text();
    const entries = parseYtFeed(xml);
    if (entries.length === 0) return null;

    entries.sort((a, b) => b.published.getTime() - a.published.getTime());
    // Strict chamber match — never fall back to an unrelated chamber's stream.
    // The caller renders a clear "no recent stream" state when we return null.
    const match = entries.find((e) => matchChamber(e, chamber));
    if (!match) return null;
    return { videoId: match.videoId, title: match.title, publishedAt: match.published };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    console.warn("Failed to resolve live video", err);
    return null;
  }
}

// --------- APH RSS poller ---------

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
