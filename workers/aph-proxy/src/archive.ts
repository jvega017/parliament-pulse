// Archive ingest + query layer for Parliament Pulse.
// Cron pollers write into D1; the /archive HTTP endpoint reads from it.

import { APH_FEEDS, type FeedMeta, sourceGroupForItem, APH_BROWSER_HEADERS } from "./feeds";
import { scoreForArchive, matchAlertRules, isFreshArrival, FRESH_ARRIVAL_SQL, type AlertRule, type NewItem } from "./workerScoring";
import { assignThreadKeyed, buildTokenSet, canonicalThreadKey, type ThreadCandidate, type ThreadAssignment } from "./threads";
import { parseHearingDate } from "./hearingDate";
import { fetchWithDeadline, UPSTREAM_TIMEOUT_MS } from "./rssProxy";
import type { FeedState } from "./stateContract";

export interface Env {
  CACHE: KVNamespace;
  ALLOWED_ORIGINS: string;
  ARCHIVE: D1Database;
  REQUIRE_ACCESS?: string;
  RESEND_API_KEY?: string;
  DIGEST_FROM_EMAIL?: string;
  ADMIN_TOKEN?: string;
  // Workers Rate Limiting bindings, one per per-minute budget (wrangler.toml
  // [[ratelimits]], 0.16.3). Optional: absent, the KV limiter is used.
  RL_30?: RateLimit;
  RL_60?: RateLimit;
  RL_120?: RateLimit;
}

export interface ArchiveRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_url: string;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  last_seen_at: string;
  attention: string | null;
  confidence: number | null;
  entities_json: string | null;
  scoring_explanation: string | null;
}

// Historically a bot-identifying UA; switched to APH_BROWSER_HEADERS 2026-07-10
// after confirming the APH edge WAF 403s the parlinfo.aph.gov.au Bills Digests
// feed under the bot UA (200 under the browser UA), while the six
// www.aph.gov.au feeds returned 200 under both. See commit message for the
// evidence table.

export interface ParsedItem {
  title: string;
  link: string;
  pubDate: string | null;
  guid: string;
  description: string | null;
}

// 0.16.3: items a single poll ingests from one feed at most. The parser used
// to stop at 50, so the 134-item Senate reports feed lost its tail and the
// Sources desk reported 50 parsed. parseFeed now reads every item and reports
// the true count (feed_health.items_parsed); this cap only bounds the D1
// writes of one poll against a runaway feed. Measured 5 Oct 2026: the largest
// feed holds 134 items.
export const MAX_INGEST_PER_FEED = 250;

// Unresolvable host seen on two hearing links (5 Oct 2026): aphcms.aph.gov.au
// fails DNS, while the same path on www.aph.gov.au returns 200.
const APHCMS_RE = /^https?:\/\/aphcms\.aph\.gov\.au\//i;
export function canonicalAphUrl(u: string): string {
  return u.replace(APHCMS_RE, "https://www.aph.gov.au/");
}

// A title for an item that has no <title> (House news). The last path
// segment of an APH news link is the article's headline with "_" for spaces
// (measured 5 Oct 2026: ".../News/Gain_a_better_understanding_of_the_House_of_
// Representatives_in_engaging_half-day_seminar" is that page's <title>). Only
// when the link has no such segment does the description stand in, cut at a
// word boundary with an ellipsis rather than mid-word.
export const FALLBACK_TITLE_MAX = 100;
export function fallbackTitle(link: string | null, description: string | null): string | null {
  if (link) {
    try {
      const segs = new URL(link).pathname.split("/").filter(Boolean);
      const last = segs.length ? decodeURIComponent(segs[segs.length - 1]) : "";
      if (last.includes("_") && last.split("_").filter(Boolean).length >= 3) {
        return last.replace(/_+/g, " ").trim();
      }
    } catch {
      // fall through to the description
    }
  }
  if (!description) return null;
  const line = description.split("\n")[0].trim();
  if (line.length <= FALLBACK_TITLE_MAX) return line || null;
  const cut = line.slice(0, FALLBACK_TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

// Naive RSS parser tuned for APH RSS 2.0 + Atom. Pure regex (no DOMParser
// in workers runtime). Returns every item; the caller caps ingest.
export function parseFeed(xml: string, feed: FeedMeta): ParsedItem[] {
  const out: ParsedItem[] = [];
  const itemRegex = /<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches) {
    let title = pluck(block, "title");
    let link = pluck(block, "link");
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href="([^"]+)"/);
      if (hrefMatch && hrefMatch[1]) link = decodeXmlEntities(hrefMatch[1]);
    }
    if (link) link = canonicalAphUrl(link.trim());
    const pubText = pluck(block, "pubDate") ?? pluck(block, "updated") ?? pluck(block, "published");
    const rawDesc = pluck(block, "description") ?? pluck(block, "summary") ?? null;
    if (!title) title = fallbackTitle(link, rawDesc);
    const rawGuid = pluck(block, "guid");
    const guid = rawGuid ? canonicalAphUrl(rawGuid.trim()) : (link ?? `${feed.url}#${title}`);
    if (!title || !link) continue;
    const pubMs = pubText ? Date.parse(pubText.trim()) : NaN;
    out.push({
      title: title.trim(),
      link,
      pubDate: Number.isFinite(pubMs) ? new Date(pubMs).toISOString() : null,
      guid: guid.trim(),
      description: rawDesc ? rawDesc.trim().slice(0, 600) : null,
    });
  }
  return out;
}

/** Today's civil date in Brisbane (AEST, no daylight saving), YYYY-MM-DD. */
export function brisbaneToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 10 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * One item per guid for a poll. A feed can repeat a guid: the Upcoming Senate
 * hearings feed has no <guid>, so every hearing of one inquiry shares the
 * inquiry's link. For a hearing feed the representative is the NEXT hearing
 * (earliest date on or after today in Brisbane), else the most recent past
 * one, so the stored description, and the hearing_date read from it, is the
 * date a reader needs.
 *
 * Every other feed (0.16.4): the item with the NEWEST pubDate keeps the
 * guid, so a re-seen row is refreshed to the latest document rather than the
 * first one listed. The Senate reports feed has no <guid> and lists 134
 * items under 130 links (measured 5 Oct 2026): an inquiry's interim and final
 * reports share its link, and keeping the first listed stored the 23 Jun
 * interim NDIS report and dropped the 14 Aug final one. Where the guid is the
 * link itself (the feed sent no <guid>), each OLDER dated item is kept as
 * well, under `${link}#${pubDate}`, which no existing row carries, so only
 * new rows are added and every stored guid keeps its meaning. Ties and
 * undated repeats fall back to the first listed, and an undated older repeat
 * is dropped. Returns the kept items and how many repeats were dropped.
 */
export function pickPerGuid(items: ParsedItem[], kind: string, today: string): { items: ParsedItem[]; dropped: number } {
  const byGuid = new Map<string, ParsedItem[]>();
  for (const it of items) {
    const list = byGuid.get(it.guid);
    if (list) list.push(it); else byGuid.set(it.guid, [it]);
  }
  const kept: ParsedItem[] = [];
  const keptGuids = new Set(items.map((it) => it.guid));
  for (const group of byGuid.values()) {
    if (group.length === 1) { kept.push(group[0]); continue; }
    if (kind !== "hearing") {
      // Stable sort: newest pubDate first, undated last, ties in feed order.
      const ordered = group
        .map((it, i) => ({ it, i }))
        .sort((a, b) => {
          const ad = a.it.pubDate, bd = b.it.pubDate;
          if (ad && bd && ad !== bd) return bd.localeCompare(ad);
          if (ad && !bd) return -1;
          if (!ad && bd) return 1;
          return a.i - b.i;
        })
        .map((x) => x.it);
      const [newest, ...older] = ordered;
      kept.push(newest);
      for (const it of older) {
        if (it.guid !== it.link || !it.pubDate || it.pubDate === newest.pubDate) continue;
        const guid = `${it.link}#${it.pubDate}`;
        if (keptGuids.has(guid)) continue;
        keptGuids.add(guid);
        kept.push({ ...it, guid });
      }
      continue;
    }
    const dated = group
      .map((it) => ({ it, d: parseHearingDate(it.description) }))
      .filter((x): x is { it: ParsedItem; d: string } => x.d !== null);
    if (dated.length === 0) { kept.push(group[0]); continue; }
    const upcoming = dated.filter((x) => x.d >= today).sort((a, b) => a.d.localeCompare(b.d));
    const past = dated.filter((x) => x.d < today).sort((a, b) => b.d.localeCompare(a.d));
    kept.push((upcoming[0] ?? past[0]).it);
  }
  return { items: kept, dropped: items.length - kept.length };
}

/**
 * The guid an item is written under in this poll (0.16.5), or null when it
 * must be skipped. Across feeds the first feed to carry a guid writes it.
 * When a later feed's item has the same guid and that guid is its own link
 * (the feed sent no <guid>) and it is dated, it is written under
 * `${link}#${pubDate}`, the key pickPerGuid already gives an older dated
 * repeat, so it is skipped only if that key is also taken. 0.16.4 skipped it
 * outright: the newest Senate report at five links that a New Senate
 * inquiries row also carries was dropped, so 129 of 134 reports were stored.
 */
export function guidForPoll(item: ParsedItem, seen: Set<string>): ParsedItem | null {
  if (!seen.has(item.guid)) return item;
  if (item.guid !== item.link || !item.pubDate) return null;
  const guid = `${item.link}#${item.pubDate}`;
  return seen.has(guid) ? null : { ...item, guid };
}

/** The stored row an item's candidate key already names (0.16.6). */
export interface StoredOwner {
  feed_url: string;
  title: string;
  description: string | null;
  pub_date: string | null;
}

/**
 * The guid an item is written under (0.16.6), chosen from the STORED owner
 * of the key, not only from this poll. Returns null when the item must be
 * skipped.
 *
 * 0.16.5 decided per poll (guidForPoll): the first feed in a poll to carry a
 * link wrote the bare link L, so whichever feed held L depended on what was
 * listed that poll. New Senate inquiries is polled first and is a rolling
 * feed, so while an inquiry was listed it overwrote a stored report row's
 * title and the report was re-inserted as L#pubDate with a fresh
 * first_seen_at; when the inquiry left its feed, the reports feed wrote L
 * again and the report appeared twice. Five production links are shared by
 * the two feeds (measured 5 Oct 2026).
 *
 * For an item whose guid is its own link (the feed sent no <guid>), in order:
 *   1. L#pubDate stored for THIS feed: write L#pubDate.
 *   2. An older repeat (pickPerGuid already keyed it L#pubDate): keep it.
 *   3. L not stored: the 0.16.5 in-poll rule (guidForPoll).
 *   4. L stored for THIS feed: write L.
 *   5. L stored for ANOTHER feed: write L#pubDate (undated: write L, and the
 *      upsert's same-feed guard leaves the other feed's row unchanged except
 *      last_seen_at).
 *
 * A row is never handed from one feed to another (0.16.7). 0.16.6 re-split a
 * New Senate inquiries row to the reports feed when the inquiry had left its
 * feed and the row's text equalled a report's; on the full production seed
 * (419 rows) that moved 24 of 75 inquiry rows into Senate reports tabled and
 * overwrote their pub_date. A 0.16.1-flipped inquiry row whose inquiry has
 * left its feed now stays an inquiry row, and the report is stored at
 * L#pubDate (rule 5). While the inquiry is still listed, rule 4 rewrites the
 * row from the inquiries feed.
 *
 * Which item at L is the stored row's document is settled first, by
 * keepStoredIdentity, before this runs.
 *
 * Any other guid (the feed sent its own <guid>) is written as is unless this
 * poll already wrote it; the upsert's same-feed guard keeps another feed's
 * row unchanged.
 */
export function chooseGuid(
  item: ParsedItem,
  feedUrl: string,
  seen: Set<string>,
  stored: Map<string, StoredOwner>,
): { item: ParsedItem } | null {
  const link = item.link;
  const dated = item.pubDate ? `${link}#${item.pubDate}` : null;
  const linkKeyed = item.guid === link || (dated !== null && item.guid === dated);
  if (!linkKeyed) return seen.has(item.guid) ? null : { item };
  if (dated && stored.get(dated)?.feed_url === feedUrl) {
    return seen.has(dated) ? null : { item: { ...item, guid: dated } };
  }
  if (item.guid !== link) return seen.has(item.guid) ? null : { item };
  const owner = stored.get(link);
  if (!owner) {
    const chosen = guidForPoll(item, seen);
    return chosen ? { item: chosen } : null;
  }
  if (owner.feed_url === feedUrl) return seen.has(link) ? null : { item };
  if (dated) return seen.has(dated) ? null : { item: { ...item, guid: dated } };
  return seen.has(link) ? null : { item };
}

/**
 * Keeps a stored row's identity when a feed lists a new document at its link
 * (0.16.7). pickPerGuid gives the bare link L to the NEWEST item at L. When
 * L is already stored for this feed and holds an older document, 0.16.6 let
 * the newest item rewrite that row (title, pub_date, description) while it
 * kept the old first_seen_at, and the older document, now keyed L#pubDate,
 * was inserted as if new. The new report then fired no alert (its row was
 * not new) and the old one could alert twice (a second guid).
 *
 * For each link L stored for THIS feed, the item that is the stored row's
 * document keeps L, and the newest item moves to L#pubDate, so it is stored
 * as a new row with first_seen_at = now and alerts if it is a fresh arrival.
 * When no listed item matches, a report feed's dated item with a different
 * date is a new report (it moves to L#pubDate and the stored row is left
 * unchanged); in any other feed it is the same item re-dated (the House
 * daily program keeps one link and changes its title and date each sitting
 * day) and rewrites L, as before. Only keys are changed here; chooseGuid then
 * applies the stored-owner rules. Pure.
 *
 * Match order (0.16.8): title AND pub_date, then pub_date alone, then title
 * alone, except in the Senate reports feed (kind "report", the only feed of
 * that kind) when the stored row has a pub_date. Worker 0.16.1 rewrote a
 * report row's title from whichever item reached the row last but kept its
 * pub_date, so a stored report's pub_date names its document and its title
 * may not. Production TripleZero48P (5 Oct 2026) carries the third progress
 * report's title with the aviation report's date; 0.16.7 matched on title
 * first, so it re-dated the row to the third progress report, kept the
 * April first_seen_at, and inserted the aviation report as a new row. In the
 * reports feed a title-only match would also absorb a NEW report that reuses
 * the stored title (a bill report and its later report often share one) and
 * suppress its alert. A stored report with no pub_date can only be matched
 * on its title, so the title step still applies to it.
 */
export function keepStoredIdentity(
  items: ParsedItem[],
  feedUrl: string,
  kind: string,
  stored: Map<string, StoredOwner>,
): ParsedItem[] {
  const groups = new Map<string, ParsedItem[]>();
  for (const it of items) {
    const linkKeyed = it.guid === it.link || (it.pubDate !== null && it.guid === `${it.link}#${it.pubDate}`);
    if (!linkKeyed) continue;
    const g = groups.get(it.link);
    if (g) g.push(it); else groups.set(it.link, [it]);
  }
  const rekey = new Map<ParsedItem, string>();
  for (const [link, group] of groups) {
    const owner = stored.get(link);
    if (!owner || owner.feed_url !== feedUrl) continue;
    const newest = group.find((it) => it.guid === link);
    if (!newest || !newest.pubDate) continue;
    const match = group.find((it) => it.title === owner.title && it.pubDate === owner.pub_date)
      ?? (owner.pub_date ? group.find((it) => it.pubDate === owner.pub_date) : undefined)
      ?? (kind === "report" && owner.pub_date ? undefined : group.find((it) => it.title === owner.title))
      ?? null;
    if (match === newest) continue;
    if (match === null && !(kind === "report" && owner.pub_date && newest.pubDate !== owner.pub_date)) continue;
    // The matched older item already has a stored L#pubDate row: leave the
    // keys alone rather than write the document twice.
    if (match && match.pubDate && stored.get(`${link}#${match.pubDate}`)?.feed_url === feedUrl) continue;
    if (match) rekey.set(match, link);
    rekey.set(newest, `${link}#${newest.pubDate}`);
  }
  if (rekey.size === 0) return items;
  return items.map((it) => {
    const g = rekey.get(it);
    return g === undefined ? it : { ...it, guid: g };
  });
}

/**
 * The stored rows any of these items' candidate keys (guid, link and
 * link#pubDate) already name, with their owning feed. D1 binds at most 100
 * parameters per statement, so the lookup is chunked.
 */
export async function storedOwners(env: Env, items: ParsedItem[]): Promise<Map<string, StoredOwner>> {
  const keys = new Set<string>();
  for (const it of items) {
    keys.add(it.guid);
    keys.add(it.link);
    if (it.pubDate) keys.add(`${it.link}#${it.pubDate}`);
  }
  const all = [...keys];
  const out = new Map<string, StoredOwner>();
  for (let i = 0; i < all.length; i += STORED_LOOKUP_CHUNK) {
    const chunk = all.slice(i, i + STORED_LOOKUP_CHUNK);
    const res = await env.ARCHIVE.prepare(
      `SELECT guid, feed_url, title, description, pub_date FROM signals WHERE guid IN (${chunk.map(() => "?").join(", ")})`,
    ).bind(...chunk).all<{ guid: string } & StoredOwner>();
    for (const r of res.results ?? []) {
      out.set(r.guid, { feed_url: r.feed_url, title: r.title, description: r.description ?? null, pub_date: r.pub_date ?? null });
    }
  }
  return out;
}

const STORED_LOOKUP_CHUNK = 90;

/**
 * The guid (or link) Worker 0.16.3 and earlier stored for a value that
 * 0.16.4 now entity-decodes. Those versions stored element text undecoded,
 * so the feed's "&amp;" stayed in the row: the List of Senators link was
 * stored as "...los.pdf?la=en&amp;hash=..." and 0.16.4 parses it as
 * "...la=en&hash=...". Migration 0014 applies the same mapping to stored rows.
 */
export function legacyEntityForm(s: string): string {
  return s.replace(/&/g, "&amp;");
}

/**
 * Every guid an earlier Worker may have stored for this canonical guid
 * (0.16.8): the undecoded form (pre-0.16.4, see legacyEntityForm) and the
 * aphcms.aph.gov.au host form (pre-0.16.3, see canonicalAphUrl). Production
 * holds two Upcoming Senate hearings rows on the aphcms host, first seen
 * 10 Aug 2026 with no pub_date. Without the host form, the first 0.16.8 poll
 * inserted each one again at its www guid with first_seen_at = now, which
 * reads as a fresh arrival (an undated row is fresh) and alerted; migration
 * 0011 then dropped the older row and its history.
 */
const WWW_APH = "https://www.aph.gov.au/";
export function legacyForms(guid: string): string[] {
  const out: string[] = [];
  if (guid.includes("&")) out.push(legacyEntityForm(guid));
  if (guid.startsWith(WWW_APH)) out.push(`https://aphcms.aph.gov.au/${guid.slice(WWW_APH.length)}`);
  return out;
}

/** Which legacy-form rows exist for a feed's candidate keys (0.16.9). */
export interface LegacyPresence {
  /** Every candidate key the lookup covered: guid, link and link#pubDate. */
  keys: Set<string>;
  /** The legacy-form guids among them that are stored. */
  present: Set<string>;
}

/**
 * One chunked lookup per feed of every legacy form (legacyForms) of every
 * key an item can be written under: its guid, its link and link#pubDate,
 * the same keys storedOwners reads (chooseGuid and keepStoredIdentity pick
 * among them). 0.16.8 ran a SELECT from adoptLegacyEntityRow for every
 * item with a www or "&" guid, nearly every APH item, while production held
 * no legacy row (0 aphcms and 0 "&amp;" guids, 6 Oct 2026). This Worker
 * never writes a legacy form, so a form absent here stays absent for the
 * rest of the poll.
 * Returns null on a D1 error; adoptLegacyEntityRow then queries per item.
 */
export async function legacyRowsPresent(env: Env, items: ParsedItem[]): Promise<LegacyPresence | null> {
  const keys = new Set<string>();
  for (const it of items) {
    keys.add(it.guid);
    keys.add(it.link);
    if (it.pubDate) keys.add(`${it.link}#${it.pubDate}`);
  }
  const forms = [...new Set([...keys].flatMap(legacyForms))];
  const present = new Set<string>();
  try {
    for (let i = 0; i < forms.length; i += STORED_LOOKUP_CHUNK) {
      const chunk = forms.slice(i, i + STORED_LOOKUP_CHUNK);
      const res = await env.ARCHIVE.prepare(
        `SELECT guid FROM signals WHERE guid IN (${chunk.map(() => "?").join(", ")})`,
      ).bind(...chunk).all<{ guid: string }>();
      for (const r of res.results ?? []) present.add(r.guid);
    }
  } catch (err) {
    console.warn("legacy lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
  return { keys, present };
}

/**
 * Renames a row stored under the undecoded (pre-0.16.4) form of this item's
 * guid to the decoded guid, before the upsert, so the upsert finds it and
 * the item is re-seen, not new (0.16.5). Without this the first poll after
 * the 0.16.5 deploy inserted "List of Senators as at 28 January 2026" a
 * second time with a fresh first_seen_at, which reads as new and fires
 * alerts. The thread mapping and alert events move with the row. 0.16.8
 * applies the same rename to a row stored on the aphcms host (legacyForms).
 * Does nothing when no legacy row exists, or when the canonical row already
 * exists (migrations 0011 and 0014 merge that duplicate).
 * Never throws: a failed rename leaves ingest to proceed as before.
 */
export async function adoptLegacyEntityRow(env: Env, item: ParsedItem, pre?: LegacyPresence | null): Promise<void> {
  const forms = legacyForms(item.guid);
  if (forms.length === 0) return;
  // 0.16.9: the per-feed lookup (legacyRowsPresent) already answered for
  // this key, and no legacy row exists, so there is nothing to rename and no
  // query. A key it did not cover, or a failed lookup, takes the path below.
  if (pre && pre.keys.has(item.guid) && !forms.some((f) => pre.present.has(f))) return;
  try {
    const found = await env.ARCHIVE.prepare(
      `SELECT guid FROM signals WHERE guid IN (${["?", ...forms.map(() => "?")].join(", ")})`,
    ).bind(item.guid, ...forms).all<{ guid: string }>();
    const have = new Set((found.results ?? []).map((r) => r.guid));
    if (have.has(item.guid)) return;
    const legacy = forms.find((f) => have.has(f));
    if (!legacy) return;
    const mapped = await env.ARCHIVE.prepare(
      `SELECT thread_id FROM signal_threads WHERE signal_guid = ?`,
    ).bind(legacy).first<{ thread_id: string }>();
    // signal_threads references signals(guid) with no ON UPDATE action, so
    // the mapping row is removed before the rename and written back after.
    const stmts = [
      env.ARCHIVE.prepare(`DELETE FROM signal_threads WHERE signal_guid = ?`).bind(legacy),
      env.ARCHIVE.prepare(`UPDATE signals SET guid = ?, link = ? WHERE guid = ?`).bind(item.guid, item.link, legacy),
      env.ARCHIVE.prepare(`UPDATE OR IGNORE alert_events SET signal_guid = ?, link = ? WHERE signal_guid = ?`).bind(item.guid, item.link, legacy),
      env.ARCHIVE.prepare(`DELETE FROM alert_events WHERE signal_guid = ?`).bind(legacy),
    ];
    if (mapped?.thread_id) {
      stmts.push(env.ARCHIVE.prepare(`INSERT OR IGNORE INTO signal_threads (signal_guid, thread_id) VALUES (?, ?)`).bind(item.guid, mapped.thread_id));
    }
    await env.ARCHIVE.batch(stmts);
  } catch (err) {
    console.warn("legacy entity rename failed", item.guid, err instanceof Error ? err.message : err);
  }
}

const XML_NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

/**
 * Decode XML character references in element text (0.16.4): the five named
 * entities and numeric &#NNN; / &#xHH; references. One pass, so "&amp;lt;"
 * becomes "&lt;", never "<". An unknown name, or a code point outside
 * Unicode, is left as written. Before 0.16.4 the "List of Senators" link was
 * stored and served with "&amp;hash=" in it.
 */
export function decodeXmlEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));/g, (whole, dec, hex, name) => {
    if (name !== undefined) return XML_NAMED_ENTITIES[name] ?? whole;
    const cp = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
  });
}

// Element text. Markup outside CDATA is stripped and its entities decoded;
// CDATA content is literal XML text, so it is only tag-stripped (as before),
// never entity-decoded.
function pluck(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m || !m[1]) return null;
  const parts = m[1].split(/(<!\[CDATA\[[\s\S]*?\]\]>)/);
  return parts
    .map((p) => p.startsWith("<![CDATA[")
      ? p.slice(9, -3).replace(/<[^>]+>/g, "")
      : decodeXmlEntities(p.replace(/<[^>]+>/g, "")))
    .join("")
    .trim();
}

// ---- Thread layer ------------------------------------------------------------
// Groups related signals (repeat coverage of the same inquiry/bill/hearing)
// under a shared thread. See ./threads.ts for the pure tokeniser + matcher;
// everything here is D1 I/O around that pure core.

const THREAD_CANDIDATE_LIMIT = 500;

async function loadThreadCandidates(env: Env, limit = THREAD_CANDIDATE_LIMIT): Promise<ThreadCandidate[]> {
  const res = await env.ARCHIVE.prepare(
    `SELECT thread_id, fingerprint FROM threads ORDER BY last_seen_at DESC LIMIT ?`,
  ).bind(limit).all<{ thread_id: string; fingerprint: string }>();
  return (res.results ?? []).map((r) => ({
    thread_id: r.thread_id,
    fingerprint: r.fingerprint ? r.fingerprint.split(",").filter(Boolean) : [],
  }));
}

async function persistThreadAssignment(
  env: Env,
  assignment: ThreadAssignment,
  guid: string,
  title: string,
  now: string,
): Promise<void> {
  const fingerprintCsv = assignment.fingerprint.join(",");
  // item_count is never incremented. It is recomputed from signal_threads
  // after the mapping row is written, so a re-seen or re-threaded signal
  // (signal_threads is keyed on signal_guid and INSERT OR IGNORE) cannot
  // inflate it. DATA-06, 29 Sep 2026: the old `item_count + 1` fired on
  // every poll that re-saw an item, because the new-row test below it was
  // unreliable, so a thread with one signal could claim dozens of updates.
  if (assignment.created) {
    await env.ARCHIVE.prepare(
      `INSERT INTO threads (thread_id, fingerprint, title, first_seen_at, last_seen_at, item_count)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(thread_id) DO UPDATE SET
         fingerprint  = excluded.fingerprint,
         last_seen_at = excluded.last_seen_at`,
    ).bind(assignment.thread_id, fingerprintCsv, title, now, now).run();
  } else {
    await env.ARCHIVE.prepare(
      `UPDATE threads SET fingerprint = ?, last_seen_at = ? WHERE thread_id = ?`,
    ).bind(fingerprintCsv, now, assignment.thread_id).run();
  }
  await env.ARCHIVE.prepare(
    `INSERT OR IGNORE INTO signal_threads (signal_guid, thread_id) VALUES (?, ?)`,
  ).bind(guid, assignment.thread_id).run();
  await env.ARCHIVE.prepare(
    `UPDATE threads
        SET item_count = (SELECT COUNT(*) FROM signal_threads st WHERE st.thread_id = threads.thread_id)
      WHERE thread_id = ?`,
  ).bind(assignment.thread_id).run();
}

// 0.16.3: threads built by the canonical-key matcher carry this id prefix.
// Migration 0012 deletes every thread WITHOUT it (the 0.16.2-and-earlier
// word-overlap threads), so re-running it never touches a rebuilt thread.
export const THREAD_ID_PREFIX = "t2:";

/** Unthreaded signals each poll threads (see the heal step in pollAndArchive). */
export const THREAD_HEAL_PER_POLL = 25;

// A keyed item whose thread fell outside the in-memory candidate window is
// found by its key, which leads its fingerprint, so it never starts a second
// thread for the same inquiry or bill.
//
// 0.16.4: the lookup compares the fingerprint's first token (everything
// before its first comma) for equality. 0.16.3 matched `LIKE '<key>,%'`, and
// D1 rejects any LIKE pattern over 50 bytes ("LIKE or GLOB pattern too
// complex"), which most inquiry keys exceed, so most keyed items failed to
// thread. THREAD_KEY_EXPR is the exact expression migration 0013 indexes
// (idx_threads_key); the two must stay byte-identical for SQLite to use the
// index. Without the index the query is still correct, only a scan.
export const THREAD_KEY_EXPR = "substr(fingerprint, 1, instr(fingerprint || ',', ',') - 1)";
export async function findKeyedThread(env: Env, key: string): Promise<ThreadCandidate | null> {
  const row = await env.ARCHIVE.prepare(
    `SELECT thread_id, fingerprint FROM threads
      WHERE ${THREAD_KEY_EXPR} = ?
      ORDER BY last_seen_at DESC LIMIT 1`,
  ).bind(key).first<{ thread_id: string; fingerprint: string }>();
  return row ? { thread_id: row.thread_id, fingerprint: row.fingerprint.split(",").filter(Boolean) } : null;
}

// Assigns one item and keeps the in-memory candidate list in sync so later
// items in the same poll/backfill batch can join a thread created earlier in
// that same batch, without a re-query per item.
async function threadItem(
  env: Env,
  candidates: ThreadCandidate[],
  item: { guid: string; title: string; link: string | null; kind: string | null },
  now: string,
): Promise<ThreadAssignment> {
  const tokens = buildTokenSet(item.title);
  const key = canonicalThreadKey(item.title, item.link, item.kind);
  if (key && !candidates.some((c) => c.fingerprint[0] === key)) {
    const found = await findKeyedThread(env, key);
    if (found) candidates.push(found);
  }
  const assignment = assignThreadKeyed(tokens, key, candidates, `${THREAD_ID_PREFIX}${item.guid}`);
  await persistThreadAssignment(env, assignment, item.guid, item.title, now);
  const idx = candidates.findIndex((c) => c.thread_id === assignment.thread_id);
  if (idx >= 0) candidates[idx] = { thread_id: assignment.thread_id, fingerprint: assignment.fingerprint };
  else candidates.push({ thread_id: assignment.thread_id, fingerprint: assignment.fingerprint });
  return assignment;
}

// Threads any archived signals that pollAndArchive inserted before this layer
// existed (or that failed thread assignment at ingest time, or whose old
// thread migration 0012 removed). Chronological order so earlier items seed
// threads that later items join, matching how pollAndArchive threads items
// as they arrive. Idempotent: only processes signals with no row in
// signal_threads yet, so it is safe to call repeatedly (e.g. in a loop until
// `processed` comes back 0) to work through a large backlog in bounded
// batches.
//
// 0.16.5: one row's failure no longer ends the batch. Before, a row whose
// assignment threw (the 0.16.3 LIKE limit did this to most keyed rows)
// aborted the loop, and because rows are taken oldest first the same row led
// every later batch, so the per-poll heal step threaded nothing ever again.
// Each row is now assigned on its own; a failure is logged, counted in
// `failed`, and the rest of the batch proceeds. `processed` counts rows
// threaded, so "repeat until processed is 0" still ends.
export async function backfillThreads(env: Env, limit = 500): Promise<{
  processed: number;
  failed: number;
  threadsCreated: number;
  threadsJoined: number;
}> {
  const res = await env.ARCHIVE.prepare(
    `SELECT s.guid, s.title, s.link, s.kind, s.first_seen_at
       FROM signals s
       LEFT JOIN signal_threads st ON st.signal_guid = s.guid
      WHERE st.signal_guid IS NULL
      ORDER BY s.first_seen_at ASC, s.guid ASC
      LIMIT ?`,
  ).bind(limit).all<{ guid: string; title: string; link: string | null; kind: string | null; first_seen_at: string }>();
  const rows = res.results ?? [];
  // 0.16.9: nothing to heal, so no candidate load. Every poll calls this, and
  // 0.16.8 read up to 1,000 thread rows each time to thread nothing.
  if (rows.length === 0) return { processed: 0, failed: 0, threadsCreated: 0, threadsJoined: 0 };

  const candidates = await loadThreadCandidates(env, 1000);
  let threadsCreated = 0;
  let threadsJoined = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const assignment = await threadItem(env, candidates, row, row.first_seen_at);
      if (assignment.created) threadsCreated += 1; else threadsJoined += 1;
    } catch (err) {
      failed += 1;
      console.warn("thread backfill failed", row.guid, err instanceof Error ? err.message : err);
    }
  }

  return { processed: rows.length - failed, failed, threadsCreated, threadsJoined };
}

// ---- Feed health (DATA-08) ---------------------------------------------------
// Connector health is derived from the feeds the poller actually reads, on
// every 30-minute poll, so a reported "ok" means "this feed returned 200 and
// parsed", not "a landing page answered". One row per feed_url, upserted.
// last_success_at only moves on a successful poll, so a failing feed keeps
// the time it last worked. Never throws: a health write must not break ingest.
async function recordFeedHealth(
  env: Env,
  feed: FeedMeta,
  httpStatus: number,
  itemsParsed: number | null,
  parseError: string | null,
  now: string,
  success: boolean,
): Promise<void> {
  try {
    await env.ARCHIVE.prepare(
      `INSERT INTO feed_health
         (feed_url, feed_label, kind, last_http_status, items_parsed, parse_error, last_polled_at, last_success_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(feed_url) DO UPDATE SET
         feed_label       = excluded.feed_label,
         kind             = excluded.kind,
         last_http_status = excluded.last_http_status,
         items_parsed     = excluded.items_parsed,
         parse_error      = excluded.parse_error,
         last_polled_at   = excluded.last_polled_at,
         last_success_at  = COALESCE(excluded.last_success_at, feed_health.last_success_at)`,
    ).bind(
      feed.url, feed.label, feed.kind, httpStatus, itemsParsed, parseError, now, success ? now : null,
    ).run();
  } catch (err) {
    console.warn("feed health write failed", feed.url, err instanceof Error ? err.message : err);
  }
}

export interface FeedHealthRow {
  feed_url: string;
  feed_label: string;
  kind: string | null;
  last_http_status: number | null;
  items_parsed: number | null;
  parse_error: string | null;
  last_polled_at: string;
  last_success_at: string | null;
}

export interface FeedHealthCheck {
  url: string;
  feed_label: string;
  kind: string;
  checked_at: string | null;
  ok: number;
  status: number | null;
  error: string | null;
  last_http_status: number | null;
  items_parsed: number | null;
  parse_error: string | null;
  last_success_at: string | null;
  state: FeedState;
  next_poll_at: string | null;
}

// ---- Source-blocked feeds and per-feed cadence (0.16.11) ---------------------
// parlinfo.aph.gov.au sits behind an Azure WAF that answered the Worker's
// Bills Digests fetch with HTTP 403 on every poll from at least 2 Oct 2026 to
// 19:30 UTC 6 Oct 2026, then 200 again from 20:01 UTC (job_runs, D1). Measured
// from a home PC on 7 Oct 2026 AEST: the Worker's browser headers get 200 and
// a bot user-agent gets 403 with the "Azure WAF JS Challenge" page, and the
// live Worker's /rss proxy also got 200 (Cloudflare egress). 0.16.10's
// deploy at 13:41 UTC was not the cause: polls stayed blocked until 19:30. So
// the refusal is the host's, it comes and goes, and no other official
// Bills Digests feed exists (aph.gov.au/Help/RSS_feeds lists only parlinfo).
// A feed with blockedBackoffMinutes records such a refusal as "source
// blocked": its row keeps the real HTTP status and its last_success_at, the
// poll does not count it as a failed feed, and the scheduled poll retries it
// only after the backoff. pollEveryMinutes spaces its normal polls: Bills
// Digests are published a few a sitting week, so 30-minute polling bought
// nothing and put 48 requests a day in front of the WAF.
export const SOURCE_BLOCKED_ERROR = "source blocked";

/** Slack so a cron that fires a few seconds early still counts as due. */
export const FEED_DUE_SLACK_MS = 5 * 60_000;

/** True when this response is the host refusing the Worker on a blockable feed. */
export function isSourceBlocked(feed: FeedMeta, status: number): boolean {
  return feed.blockedBackoffMinutes !== undefined && (status === 403 || status === 429);
}

type FeedCadenceRow = Pick<FeedHealthRow, "last_polled_at" | "parse_error">;

/** Minutes the scheduled poll waits after this row's poll, or null for every poll. */
function waitMinutes(feed: FeedMeta, row: FeedCadenceRow | undefined): number | null {
  if (row?.parse_error === SOURCE_BLOCKED_ERROR && feed.blockedBackoffMinutes !== undefined) {
    return feed.blockedBackoffMinutes;
  }
  return feed.pollEveryMinutes ?? null;
}

/** Earliest time the scheduled poll fetches this feed again, or null. */
export function nextPollAt(feed: FeedMeta, row: FeedCadenceRow | undefined): string | null {
  const wait = waitMinutes(feed, row);
  if (wait === null || !row?.last_polled_at) return null;
  const at = Date.parse(row.last_polled_at);
  return Number.isFinite(at) ? new Date(at + wait * 60_000).toISOString() : null;
}

/**
 * True when the scheduled poll should fetch this feed now. A feed never
 * polled, with an unreadable or future last_polled_at, or with no cadence of
 * its own is always due.
 */
export function feedDue(feed: FeedMeta, row: FeedCadenceRow | undefined, nowMs: number): boolean {
  const wait = waitMinutes(feed, row);
  if (wait === null || !row?.last_polled_at) return true;
  const age = nowMs - Date.parse(row.last_polled_at);
  if (!Number.isFinite(age) || age < 0) return true;
  return age >= wait * 60_000 - FEED_DUE_SLACK_MS;
}

function feedState(r: FeedHealthRow | undefined): FeedState {
  if (!r) return "not_polled";
  const status = r.last_http_status;
  if (status !== null && status >= 200 && status < 300 && !r.parse_error) return "ok";
  return r.parse_error === SOURCE_BLOCKED_ERROR ? "source_blocked" : "failed";
}

export const FEED_HEALTH_SQL =
  `SELECT feed_url, feed_label, kind, last_http_status, items_parsed, parse_error, last_polled_at, last_success_at
     FROM feed_health`;

// Serves one row per CONFIGURED feed, in jurisdictions.json order, labelled
// with the configured feed_label. A configured feed with no health row yet is
// reported as never polled (ok 0, status null) rather than omitted, and a
// health row for a feed no longer configured is dropped. The ok/status/
// checked_at/error fields keep the ConnectorCheck shape the frontend already
// maps, so this is a drop-in replacement for the old connector_checks rollup.
export async function queryFeedHealth(env: Env): Promise<FeedHealthCheck[]> {
  const res = await env.ARCHIVE.prepare(FEED_HEALTH_SQL).all<FeedHealthRow>();
  const byUrl = new Map((res.results ?? []).map((r) => [r.feed_url, r]));
  return APH_FEEDS.map((feed) => {
    const r = byUrl.get(feed.url);
    const status = r?.last_http_status ?? null;
    const ok = r != null && status !== null && status >= 200 && status < 300 && !r.parse_error;
    return {
      url: feed.url,
      feed_label: feed.label,
      kind: feed.kind,
      checked_at: r?.last_polled_at ?? null,
      ok: ok ? 1 : 0,
      status,
      error: r ? (r.parse_error ?? null) : "not yet polled",
      last_http_status: status,
      items_parsed: r?.items_parsed ?? null,
      parse_error: r?.parse_error ?? null,
      last_success_at: r?.last_success_at ?? null,
      state: feedState(r),
      next_poll_at: nextPollAt(feed, r),
    };
  });
}

/** Per-feed deadline for the poll, headers and body together (0.16.9). */
export const FEED_FETCH_TIMEOUT_MS = UPSTREAM_TIMEOUT_MS;

/**
 * Feed fetches in flight at once (0.16.10). A Worker invocation may have six
 * connections open at once and queues any further fetch until one closes
 * (developers.cloudflare.com/workers/platform/limits). Five keeps every feed
 * fetch out of that platform queue, with one connection to spare.
 */
export const FEED_FETCH_CONCURRENCY = 5;

/**
 * Upper bound on the poll's fetch phase: every feed takes its full deadline,
 * FEED_FETCH_CONCURRENCY at a time. 13 feeds: ceil(13 / 5) x 8 s = 24 s.
 */
export const FEED_FETCH_WORST_CASE_MS = Math.ceil(APH_FEEDS.length / FEED_FETCH_CONCURRENCY) * FEED_FETCH_TIMEOUT_MS;

/**
 * Maps `fn` over `items` with at most `limit` calls in flight, preserving
 * order. A call starts only when a slot is free, so anything `fn` times
 * starts when its own work begins, never while it waits for a slot.
 */
export async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return out;
}

/**
 * New rows one poll writes at most (0.16.10). A new row costs up to six D1
 * queries (upsert, keyed-thread lookup, thread writes), and D1 allows 1,000
 * queries per invocation, shared with the members job that runs in the same
 * scheduled invocation. On an empty or freshly restored archive every listed
 * item is new. Measured with no cap (tests/review-0.16.10.test.mjs): 208
 * synthetic items took 883 queries, and the real 5 Oct 2026 Senate reports
 * fixture (134 reports, with 130 inquiries at their links: 264 items) took
 * 1,216, so the queries past 1,000 would fail. With this cap the same polls
 * take at most 644. Items past this cap are left for the next poll: they are
 * not written, so they are still new then. Feeds are written in order, so
 * the first new items in feed order are written first, as one unbounded poll
 * would key them. Re-seen items are not capped.
 */
export const MAX_NEW_PER_POLL = 120;

export type PollFeedResult = {
  feed: string;
  ok: boolean;
  new: number;
  seen: number;
  dedup: number;
  backfilled?: number;
  deferred?: number;
  error?: string;
  /** 0.16.11: the host refused the Worker (isSourceBlocked); not a failed feed. */
  blocked?: boolean;
  /** 0.16.11: not fetched this poll, its own cadence says not yet (feedDue). */
  not_due?: boolean;
};

/**
 * One archive poll. `scheduled` (the 30-minute cron) honours each feed's own
 * cadence (pollEveryMinutes, blockedBackoffMinutes); a manual /admin/poll-now
 * and the tests fetch every feed.
 */
export async function pollAndArchive(env: Env, opts: { scheduled?: boolean } = {}): Promise<{
  perFeed: PollFeedResult[];
}> {
  const now = new Date().toISOString();
  const perFeed: PollFeedResult[] = [];

  // 0.16.11: which feeds this poll fetches. Fails open: a feed_health read
  // that fails fetches every feed, since the cadence only saves upstream load.
  let due: (feed: FeedMeta) => boolean = () => true;
  if (opts.scheduled && APH_FEEDS.some((f) => f.pollEveryMinutes !== undefined || f.blockedBackoffMinutes !== undefined)) {
    try {
      // A previous poll that left new items for later (MAX_NEW_PER_POLL, a
      // restore) may have left them in a cadence feed, so the poll after it
      // fetches every feed until nothing is deferred.
      const last = await env.ARCHIVE.prepare(
        `SELECT detail FROM job_runs WHERE job = 'poll' AND outcome IS NOT NULL ORDER BY id DESC LIMIT 1`,
      ).first<{ detail: string | null }>();
      let lastDeferred = 0;
      try {
        const d = JSON.parse(last?.detail ?? "null");
        if (d && typeof d.deferred_items === "number") lastDeferred = d.deferred_items;
      } catch {
        lastDeferred = 0;
      }
      if (lastDeferred === 0) {
        const res = await env.ARCHIVE.prepare(FEED_HEALTH_SQL).all<FeedHealthRow>();
        const byUrl = new Map((res.results ?? []).map((r) => [r.feed_url, r]));
        const nowMs = Date.parse(now);
        due = (feed) => feedDue(feed, byUrl.get(feed.url), nowMs);
      }
    } catch (err) {
      console.warn("feed cadence read failed; fetching every feed", err instanceof Error ? err.message : err);
    }
  }

  // Fetch the feeds FEED_FETCH_CONCURRENCY at a time, each with an 8-second
  // deadline, so a slow upstream cannot block the cron. Results are
  // collected and inserted into D1 after all fetches complete.
  //
  // 0.16.9: the deadline covers the body read (fetchWithDeadline). 0.16.8
  // cleared the timer when headers arrived and then awaited res.text() with
  // no limit, so one APH response that stalled mid-body left the poll, and
  // its job_runs row, unfinished.
  //
  // 0.16.10: 0.16.9 started all 13 fetches, and their 8 s timers, at once.
  // The platform holds a seventh fetch until one of six open connections
  // closes, so with six feeds that never answer, the queued seven only began
  // when the dead six timed out at 8 s, which is when their own timers fired:
  // every feed failed. 0.16.9's test missed this because its fake answered a
  // queued fetch in the same macrotask as the abort that freed its slot; a
  // real answer takes network time (tests/review-0.16.10.test.mjs). Each
  // deadline now starts when its fetch starts, and no fetch waits in the
  // platform queue. Worst case for the fetch phase: FEED_FETCH_WORST_CASE_MS.
  type FetchOk = { ok: true; meta: FeedMeta; xml: string; status: number };
  type FetchErr = { ok: false; meta: FeedMeta; status: number; error: string; notDue?: boolean };
  const feedResults = await mapConcurrent(APH_FEEDS, FEED_FETCH_CONCURRENCY, async (feedMeta): Promise<FetchOk | FetchErr> => {
    if (!due(feedMeta)) return { ok: false, meta: feedMeta, status: 0, error: "not due", notDue: true };
    const r = await fetchWithDeadline(feedMeta.url, {
      headers: APH_BROWSER_HEADERS,
      cf: { cacheTtl: 60, cacheEverything: true },
    }, { timeoutMs: FEED_FETCH_TIMEOUT_MS, readBody: true, logLabel: "feed fetch failed" });
    // SEC-11: the stored and served error (feed_health, /admin/poll-now,
    // /state) is a fixed string; fetchWithDeadline logs the raw message.
    if (r.ok) return { ok: true, meta: feedMeta, xml: r.text ?? "", status: r.status };
    if (r.status === 429) {
      console.warn("APH returned 429", { feed: feedMeta.url, retryAfter: r.headers?.get("retry-after") ?? null });
      return { ok: false, meta: feedMeta, status: 429, error: "HTTP 429 Too Many Requests" };
    }
    return { ok: false, meta: feedMeta, status: r.status, error: r.error };
  });

  // Compute kind-level momentum from D1 history before scoring.
  // One query: count each kind in the recent 7 days vs the prior 7 days.
  // Momentum = recent / prior (clamped 0-1); neutral (0.5) when no history.
  const momentumMap = new Map<string, number>();
  try {
    const sevenAgo = new Date(new Date(now).getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const fourteenAgo = new Date(new Date(now).getTime() - 14 * 24 * 3600 * 1000).toISOString();
    const momRes = await env.ARCHIVE.prepare(
      `SELECT kind,
              SUM(CASE WHEN pub_date >= ? THEN 1 ELSE 0 END)             AS recent,
              SUM(CASE WHEN pub_date >= ? AND pub_date < ? THEN 1 ELSE 0 END) AS prior
         FROM signals
         WHERE pub_date >= ?
         GROUP BY kind`,
    ).bind(sevenAgo, fourteenAgo, sevenAgo, fourteenAgo)
     .all<{ kind: string; recent: number; prior: number }>();
    for (const row of momRes.results ?? []) {
      const r = row.recent ?? 0;
      const p = row.prior ?? 0;
      if (p === 0 && r === 0) { momentumMap.set(row.kind, 0.5); continue; }
      if (p === 0) { momentumMap.set(row.kind, 0.9); continue; }
      momentumMap.set(row.kind, Math.min(1, r / p));
    }
  } catch (momErr) {
    console.warn("momentum query failed", momErr instanceof Error ? momErr.message : momErr);
  }

  // Thread candidates loaded once per poll (not per item) and kept in sync
  // in-memory as items are threaded below, mirroring the momentum map above.
  let threadCandidates: ThreadCandidate[] = [];
  try {
    threadCandidates = await loadThreadCandidates(env);
  } catch (threadLoadErr) {
    console.warn("thread candidate load failed", threadLoadErr instanceof Error ? threadLoadErr.message : threadLoadErr);
  }

  // 0.16.3 (data review 5 Oct 2026): no title dedup across feeds. Keying the
  // in-poll dedup on a normalised title dropped real items whose title
  // another feed had used first: six Bills Digests that share a bill's name
  // with a Senate inquiry, and six of eight "Annual reports (No. 2 of 2026)"
  // reports from different committees. The archive's key is the guid, so the
  // only in-poll dedup is by guid: within one feed pickPerGuid keeps one item
  // per guid, and across feeds the first feed to carry a guid writes it.
  const seenGuids = new Set<string>();
  const today = brisbaneToday(new Date(now));
  let newBudget = MAX_NEW_PER_POLL;

  // Every fetched feed is parsed before any is written. 0.16.7 removed the
  // 0.16.6 re-split heal that needed this (see chooseGuid); the order is kept.
  const prepared = new Map<string, { parsed: ParsedItem[]; items: ParsedItem[]; dropped: number } | { error: unknown }>();
  for (const fr of feedResults) {
    if (!fr.ok) continue;
    try {
      const parsed = parseFeed(fr.xml, fr.meta);
      const picked = pickPerGuid(parsed, fr.meta.kind, today);
      const items = picked.items.slice(0, MAX_INGEST_PER_FEED);
      prepared.set(fr.meta.url, { parsed, items, dropped: picked.dropped });
    } catch (err) {
      prepared.set(fr.meta.url, { error: err });
    }
  }

  for (const feedResult of feedResults) {
    if (!feedResult.ok) {
      // 0.16.11: a feed not due this poll keeps its health row untouched.
      if (feedResult.notDue) {
        perFeed.push({ feed: feedResult.meta.url, ok: true, new: 0, seen: 0, dedup: 0, not_due: true });
        continue;
      }
      if (isSourceBlocked(feedResult.meta, feedResult.status)) {
        perFeed.push({ feed: feedResult.meta.url, ok: false, new: 0, seen: 0, dedup: 0, error: SOURCE_BLOCKED_ERROR, blocked: true });
        await recordFeedHealth(env, feedResult.meta, feedResult.status, null, SOURCE_BLOCKED_ERROR, now, false);
        continue;
      }
      perFeed.push({ feed: feedResult.meta.url, ok: false, new: 0, seen: 0, dedup: 0, error: feedResult.error });
      await recordFeedHealth(env, feedResult.meta, feedResult.status, null, feedResult.error, now, false);
      continue;
    }
    const { meta: feed } = feedResult;
    try {
      const prep = prepared.get(feed.url);
      if (!prep) throw new Error("feed not prepared");
      if ("error" in prep) throw prep.error;
      const { parsed, items } = prep;
      let added = 0;
      let backfilled = 0;
      let deferred = 0;
      let dedupSkipped = prep.dropped;
      const nowDate = new Date(now);
      // Owners are read after every earlier feed in this poll has written,
      // so a link an earlier feed inserted this poll reads as stored.
      const stored = await storedOwners(env, items);
      const legacy = await legacyRowsPresent(env, items);
      for (const picked of keepStoredIdentity(items, feed.url, feed.kind, stored)) {
        const chosen = chooseGuid(picked, feed.url, seenGuids, stored);
        if (!chosen) { dedupSkipped += 1; continue; }
        const item = chosen.item;
        seenGuids.add(item.guid);
        // MAX_NEW_PER_POLL (0.16.10): a key with no stored row, and no
        // legacy-form row a rename would adopt, is a new row. Past the cap it
        // is left for the next poll. Its key stays in seenGuids. Once the cap
        // is reached every later new item is deferred too, so no later feed
        // could write that key anyway; holding it is a guard against a future
        // change to that order, and no test can tell it apart. A failed
        // legacy lookup counts the item as new, so the cap still holds.
        const legacyStored = legacy !== null && legacyForms(item.guid).some((f) => legacy.present.has(f));
        if (!stored.has(item.guid) && !legacyStored) {
          if (newBudget <= 0) { deferred += 1; continue; }
          newBudget -= 1;
        }
        const sourceGroup = sourceGroupForItem(item.link, feed.label);
        await adoptLegacyEntityRow(env, item, legacy);
        const momentumHint = momentumMap.get(feed.kind) ?? 0.5;
        const scored = scoreForArchive(item.title, feed.kind, item.pubDate, nowDate, momentumHint, now);
        // NOTE: attention, confidence and scoring_explanation below are an
        // INGEST-TIME SNAPSHOT only. scoring_explanation in particular embeds a
        // relative-age phrase ("today", "3d ago") that is true only at `now`
        // above -- it is never true again after this row is written. Once an
        // item drops out of its RSS feed, the re-seen UPDATE branch below stops
        // firing for its guid, so these three columns freeze permanently.
        // Every read path that SERVES a score to a user (queryStateSignals,
        // queryArchive, queryBills, the /state signals block, the digest
        // renderer) must call scoreForArchive again at read time with a fresh
        // `now` and serve that result, never these stored columns directly.
        // These columns exist for historical analysis only (e.g. the
        // /archive/timeline day-by-day volume chart, which is deliberately an
        // ingest-time record of what was assessed on each day).
        //
        // New-row detection (DATA-06, 0.16.3). One upsert per item. RETURNING
        // yields the stored first_seen_at, which equals this poll's `now` only
        // when this statement inserted the row: the DO UPDATE branch never
        // touches first_seen_at, and seenGuids stops a second write of one
        // guid in the same poll. (meta.last_row_id is NOT usable: SQLite's
        // last_insert_rowid() keeps the previous INSERT's value.)
        //
        // A re-seen row refreshes pub_date when the feed supplies one (the
        // House daily program keeps one guid and changes its date each sitting
        // day; it showed 11 Aug beside a 16 Sep title), and its link and group
        // from this item. source_group changes only when the same feed wrote
        // the row, so a guid two feeds share keeps its first feed's group.
        //
        // 0.16.6: the same guard covers the title and every other item field.
        // A row is rewritten only by the feed that owns it; another feed
        // re-seeing its guid refreshes last_seen_at alone. 0.16.1 and 0.16.5
        // let New Senate inquiries overwrite a Senate report's title (and the
        // reverse), which is how three production inquiry rows came to carry
        // report titles.
        const res = await env.ARCHIVE.prepare(
          `INSERT INTO signals
             (guid, title, link, pub_date, feed_url, feed_label, source_group, kind,
              first_seen_at, last_seen_at,
              attention, confidence, score_json, entities_json, scoring_explanation, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(guid) DO UPDATE SET
             last_seen_at        = excluded.last_seen_at,
             title               = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.title ELSE signals.title END,
             link                = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.link ELSE signals.link END,
             pub_date            = CASE WHEN signals.feed_url = excluded.feed_url
                                        THEN COALESCE(excluded.pub_date, signals.pub_date) ELSE signals.pub_date END,
             description         = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.description ELSE signals.description END,
             source_group        = CASE WHEN signals.feed_url = excluded.feed_url
                                        THEN excluded.source_group ELSE signals.source_group END,
             attention           = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.attention ELSE signals.attention END,
             confidence          = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.confidence ELSE signals.confidence END,
             score_json          = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.score_json ELSE signals.score_json END,
             entities_json       = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.entities_json ELSE signals.entities_json END,
             scoring_explanation = CASE WHEN signals.feed_url = excluded.feed_url THEN excluded.scoring_explanation ELSE signals.scoring_explanation END
           RETURNING first_seen_at`,
        )
          .bind(
            item.guid, item.title, item.link, item.pubDate,
            feed.url, feed.label, sourceGroup, feed.kind,
            now, now,
            scored.attention, scored.confidence,
            scored.scoreJson, scored.entitiesJson, scored.explanation,
            item.description,
          )
          .all<{ first_seen_at: string }>();
        if (res.results?.[0]?.first_seen_at === now) {
          added += 1;
          // Stored and threaded either way; a backfill is not counted as new
          // in the run log (fresh arrivals, workerScoring.ts).
          if (!isFreshArrival(item.pubDate, now)) backfilled += 1;
          // Thread only genuinely new rows -- a re-seen item already has a
          // signal_threads row from when it first arrived.
          try {
            await threadItem(env, threadCandidates, { guid: item.guid, title: item.title, link: item.link, kind: feed.kind }, now);
          } catch (threadErr) {
            console.warn("thread assignment failed", item.guid, threadErr instanceof Error ? threadErr.message : threadErr);
          }
        }
      }
      perFeed.push({ feed: feed.url, ok: true, new: added, seen: items.length, dedup: dedupSkipped, backfilled, ...(deferred ? { deferred } : {}) });
      // items_parsed is the feed's true item count, not the ingest window.
      await recordFeedHealth(env, feed, feedResult.status, parsed.length, null, now, true);
    } catch (err) {
      console.warn("feed processing failed", feed.url, err instanceof Error ? err.message : err);
      const msg = "feed processing failed";
      perFeed.push({ feed: feed.url, ok: false, new: 0, seen: 0, dedup: 0, error: msg });
      await recordFeedHealth(env, feed, feedResult.status, null, msg, now, false);
    }
  }

  // Self-healing thread layer (0.16.3): thread a few signals that have no
  // thread yet (a failed assignment, or rows migration 0012 unthreaded), so
  // the layer rebuilds without an admin call. Bounded so one poll's D1 work
  // stays small; when nothing is unthreaded this is one query.
  try {
    await backfillThreads(env, THREAD_HEAL_PER_POLL);
  } catch (healErr) {
    console.warn("thread heal failed", healErr instanceof Error ? healErr.message : healErr);
  }

  // Evaluate alert rules against items seen in this poll window.
  // Watermark stored in KV prevents re-firing on re-poll of the same items.
  //
  // 0.16.7: the watermark is written with no expiry, and when it is missing
  // (a new namespace, an evicted key, or a key written by 0.16.6 and earlier
  // with a 7-day TTL and then a polling gap longer than 7 days) it is derived
  // from D1: the latest first_seen_at stored BEFORE this poll. Falling back to
  // the epoch made every fresh row in the archive match again.
  try {
    const wmKey = "alert:watermark";
    let watermark = await env.CACHE.get(wmKey);
    if (!watermark) {
      const prior = await env.ARCHIVE.prepare(
        `SELECT MAX(first_seen_at) AS wm FROM signals WHERE first_seen_at < ?`,
      ).bind(now).first<{ wm: string | null }>();
      watermark = prior?.wm ?? new Date(0).toISOString();
    }
    const rulesRes = await env.ARCHIVE.prepare(
      `SELECT id, name, terms, attention_min, source_group, kind, active FROM alert_rules WHERE active = 1`,
    ).all<AlertRule>();
    const rules = rulesRes.results ?? [];
    if (rules.length > 0) {
      const newItemsRes = await env.ARCHIVE.prepare(
        // 0.16.6: fresh arrivals only. A backfilled row (APH dated it more
        // than FRESH_ARRIVAL_DAYS before it was stored) fires no rule.
        `SELECT guid, title, link, kind, source_group, attention FROM signals
          WHERE first_seen_at > ? AND first_seen_at <= ? AND ${FRESH_ARRIVAL_SQL}`,
      ).bind(watermark, now).all<NewItem>();
      const newItems = newItemsRes.results ?? [];
      if (newItems.length > 0) {
        const events = matchAlertRules(rules, newItems, now);
        for (const ev of events) {
          // INSERT OR IGNORE: UNIQUE index on (rule_id, signal_guid) prevents duplication.
          await env.ARCHIVE.prepare(
            `INSERT OR IGNORE INTO alert_events (rule_id, signal_guid, fired_at, title, link, attention)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(ev.rule_id, ev.signal_guid, ev.fired_at, ev.title, ev.link, ev.attention).run();
        }
      }
    }
    await env.CACHE.put(wmKey, now);
  } catch (alertErr) {
    console.warn("alert evaluation failed", alertErr instanceof Error ? alertErr.message : alertErr);
  }

  return { perFeed };
}

/** Per-link deadline for the daily connector check (0.16.9). */
export const CONNECTOR_TIMEOUT_MS = UPSTREAM_TIMEOUT_MS;

export async function checkConnectors(env: Env, urls: string[]): Promise<{
  results: Array<{ url: string; ok: boolean; status: number; error?: string }>;
}> {
  const now = new Date().toISOString();
  const results: Array<{ url: string; ok: boolean; status: number; error?: string }> = [];
  for (const url of urls) {
    // GET (not HEAD) with the same browser UA/accept headers as the working
    // /rss proxy path: the APH edge WAF 403s both HEAD requests and the
    // bot-identifying UA this check previously sent. The body is never read;
    // fetchWithDeadline cancels it (0.16.9), so it holds no connection open.
    //
    // 0.16.9: each link has an 8-second deadline. 0.16.8 had none, so one
    // link APH never answered held the daily job open until the platform
    // ended it, with no finish row written.
    const r = await fetchWithDeadline(url, {
      method: "GET",
      headers: APH_BROWSER_HEADERS,
      redirect: "follow",
      cf: { cacheTtl: 0 },
    }, { timeoutMs: CONNECTOR_TIMEOUT_MS, readBody: false, logLabel: "connector check failed" });
    const error = r.ok ? null : r.error;
    if (r.ok) results.push({ url, ok: true, status: r.status });
    else results.push(r.status === 0 ? { url, ok: false, status: 0, error: r.error } : { url, ok: false, status: r.status });
    await env.ARCHIVE.prepare(
      `INSERT INTO connector_checks (url, status, ok, checked_at, error) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(url, r.status, r.ok ? 1 : 0, now, error)
      .run();
  }
  return { results };
}

/**
 * A row limit from a query string. SEC (5 Oct 2026): the old
 * Math.min(parseInt(x) || d, max) let limit=-1 through, and SQLite treats
 * LIMIT -1 as no limit, so one request could read a whole table. A missing,
 * non-numeric, zero or negative value now gives the default; anything larger
 * than max gives max.
 */
export function clampLimit(raw: string | null, dflt: number, max: number): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return dflt;
  return Math.min(n, max);
}

// ---- Search terms (0.16.4) ---------------------------------------------------
// Every user search is a literal substring test, instr(LOWER(col), ?) > 0,
// never LIKE. D1 rejects a LIKE pattern over 50 bytes ("LIKE or GLOB pattern
// too complex"), so under 0.16.3 any q over about 48 bytes made /archive,
// /bills, /qons and /members answer 503. instr() has no pattern limit and no
// wildcards, so "%", "_" and a backslash need no escaping. Matching is as
// before: the term is lowercased here and the column with LOWER(), which
// folds ASCII only, exactly as the LIKE did.
//
// A term longer than MAX_QUERY_CHARS is refused with QueryInputError, which
// the router answers 400.
export const MAX_QUERY_CHARS = 200;

export class QueryInputError extends Error {
  readonly param: string;
  constructor(param: string) {
    super(`${param} too long: at most ${MAX_QUERY_CHARS} characters`);
    this.param = param;
  }
}

/** The lowercased search term, or null when absent; throws when too long. */
export function searchTerm(raw: string | null, param = "q"): string | null {
  if (raw === null || raw === "") return null;
  if ([...raw].length > MAX_QUERY_CHARS) throw new QueryInputError(param);
  return raw.toLowerCase();
}

export async function queryArchive(env: Env, params: URLSearchParams): Promise<{
  rows: ArchiveRow[];
  total: number;
  has_more: boolean;
}> {
  const from = params.get("from");
  const to = params.get("to");
  const kind = params.get("kind");
  const group = params.get("source_group");
  const q = searchTerm(params.get("q"));
  const limit = clampLimit(params.get("limit"), 100, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const attention = params.get("attention");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (from) { where.push("pub_date >= ?"); binds.push(from); }
  if (to) { where.push("pub_date <= ?"); binds.push(to); }
  if (kind) { where.push("kind = ?"); binds.push(kind); }
  if (group) { where.push("source_group = ?"); binds.push(group); }
  if (attention) { where.push("attention = ?"); binds.push(attention); }
  if (q) {
    where.push("instr(LOWER(title), ?) > 0");
    binds.push(q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalStmt = await env.ARCHIVE.prepare(
    `SELECT COUNT(*) AS n FROM signals ${whereSql}`,
  )
    .bind(...binds)
    .first<{ n: number }>();
  const total = totalStmt?.n ?? 0;

  const rowsRes = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, feed_url, feed_label, source_group, kind,
            first_seen_at, last_seen_at, attention, confidence, entities_json, scoring_explanation
       FROM signals
       ${whereSql}
       ORDER BY COALESCE(pub_date, first_seen_at) DESC
       LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<ArchiveRow>();

  // The /archive page (PageArchive.tsx) renders scoring_explanation directly,
  // including its relative-age phrase. Recompute attention/confidence/
  // scoring_explanation against the current instant before serving so an old
  // row never claims to have been "published today". The `attention` WHERE
  // filter above still runs against the stored ingest-time bucket -- that is
  // a coarse pre-filter D1 can do cheaply without loading every row -- so a
  // row's returned attention can occasionally differ from the bucket it was
  // filtered on if it has decayed since ingest; that is an accepted tradeoff,
  // not a fabrication, because the served value is always the honest current
  // score. entities_json is left untouched: entity extraction is a pure
  // function of title text only and does not change over time.
  const now = new Date();
  const rows = (rowsRes.results ?? []).map((row) => {
    const scored = scoreForArchive(row.title, row.kind, row.pub_date, now, 0, row.first_seen_at);
    return {
      ...row,
      attention: scored.attention,
      confidence: scored.confidence,
      scoring_explanation: scored.explanation,
    };
  });

  return { rows, total, has_more: total > offset + limit };
}

// WK-02 (SEC-02, PERF-01): analytics used to run one D1 query per term with no
// cap on the number of terms, so a single request could fan out into an
// unbounded number of queries. Terms are now capped and folded into ONE query.
export const MAX_ANALYTICS_TERMS = 10;

export class AnalyticsInputError extends Error {}

export async function watchlistAnalytics(env: Env, params: URLSearchParams): Promise<{
  series: Array<{ term: string; count: number; last_seen: string | null }>;
}> {
  const from = params.get("from");
  const to = params.get("to");
  const termsCsv = params.get("terms") ?? "";
  const terms = termsCsv.split(",").map((t) => t.trim()).filter(Boolean).map((t) => searchTerm(t, "terms") as string);
  if (terms.length === 0) return { series: [] };

  const uniqueTerms = [...new Set(terms)];
  if (uniqueTerms.length > MAX_ANALYTICS_TERMS) {
    throw new AnalyticsInputError(
      `too many terms: ${uniqueTerms.length} supplied, at most ${MAX_ANALYTICS_TERMS} allowed`,
    );
  }

  const cols: string[] = [];
  const binds: unknown[] = [];
  uniqueTerms.forEach((term, i) => {
    cols.push(`SUM(CASE WHEN instr(LOWER(title), ?) > 0 THEN 1 ELSE 0 END) AS n${i}`);
    cols.push(`MAX(CASE WHEN instr(LOWER(title), ?) > 0 THEN pub_date END) AS l${i}`);
    binds.push(term, term);
  });
  const where: string[] = [];
  if (from) { where.push("pub_date >= ?"); binds.push(from); }
  if (to) { where.push("pub_date <= ?"); binds.push(to); }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const r = await env.ARCHIVE.prepare(`SELECT ${cols.join(", ")} FROM signals${whereSql}`)
    .bind(...binds)
    .first<Record<string, number | string | null>>();
  const series = uniqueTerms.map((term, i) => ({
    term,
    count: Number(r?.[`n${i}`] ?? 0) || 0,
    last_seen: (r?.[`l${i}`] as string | null | undefined) ?? null,
  }));
  return { series };
}

export async function timelineArchive(env: Env, params: URLSearchParams): Promise<{
  days: Array<{ day: string; total: number; high: number; med: number; low: number }>;
}> {
  const from = params.get("from");
  const to   = params.get("to");
  const kind = params.get("kind");
  const group = params.get("source_group");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (from)  { where.push("COALESCE(pub_date, first_seen_at) >= ?"); binds.push(from); }
  if (to)    { where.push("COALESCE(pub_date, first_seen_at) <= ?"); binds.push(`${to}T23:59:59`); }
  if (kind)  { where.push("kind = ?"); binds.push(kind); }
  if (group) { where.push("source_group = ?"); binds.push(group); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Deliberately left as the stored, ingest-time `attention` bucket, not
  // recomputed: this is a day-by-day historical volume chart ("N days · by
  // attention level" on PageArchive.tsx), an audit of how much high/med/low
  // material was assessed on each past day. Recomputing against `now` would
  // time-decay almost every past day's counts down to "low" (scoreTime and
  // scoreNovelty both collapse after a few days), destroying the comparison
  // the chart exists to show. This is the "historical record" exception noted
  // in the INSERT comment above.
  const res = await env.ARCHIVE.prepare(
    `SELECT
       DATE(COALESCE(pub_date, first_seen_at)) AS day,
       COUNT(*) AS total,
       SUM(CASE WHEN attention = 'high' THEN 1 ELSE 0 END) AS high,
       SUM(CASE WHEN attention = 'med'  THEN 1 ELSE 0 END) AS med,
       SUM(CASE WHEN attention = 'low' OR attention IS NULL THEN 1 ELSE 0 END) AS low
     FROM signals
     ${whereSql}
     GROUP BY day
     ORDER BY day`,
  ).bind(...binds).all<{ day: string; total: number; high: number; med: number; low: number }>();

  return { days: res.results ?? [] };
}

// ---- Alert rules CRUD -------------------------------------------------------

export async function listAlertRules(env: Env): Promise<{ rules: AlertRule[] }> {
  const res = await env.ARCHIVE.prepare(
    `SELECT id, name, terms, attention_min, source_group, kind, created_at, active FROM alert_rules ORDER BY id DESC`,
  ).all<AlertRule & { created_at: string }>();
  return { rules: (res.results ?? []) as unknown as AlertRule[] };
}

export async function createAlertRule(env: Env, body: {
  name: string;
  terms?: string;
  attention_min?: string;
  source_group?: string | null;
  kind?: string | null;
}): Promise<{ id: number }> {
  const now = new Date().toISOString();
  const res = await env.ARCHIVE.prepare(
    `INSERT INTO alert_rules (name, terms, attention_min, source_group, kind, created_at, active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(
      body.name,
      body.terms ?? "",
      body.attention_min ?? "high",
      body.source_group ?? null,
      body.kind ?? null,
      now,
    )
    .run();
  return { id: res.meta.last_row_id ?? 0 };
}

export async function deleteAlertRule(env: Env, id: number): Promise<void> {
  await env.ARCHIVE.prepare(`DELETE FROM alert_rules WHERE id = ?`).bind(id).run();
}

// `attention` here is the alert_events.attention column: the level the rule
// actually fired against at fired_at. It is a point-in-time audit record of
// why the alert fired, not a live signal score, so it is deliberately left
// as stored -- recomputing it against `now` would misrepresent the reason
// the alert fired in the past. This is the other "historical record"
// exception noted in the INSERT comment in pollAndArchive.
export async function listAlertEvents(env: Env, limit = 50): Promise<{
  events: Array<{ id: number; rule_id: number; rule_name: string; signal_guid: string; fired_at: string; title: string; link: string; attention: string }>;
}> {
  const res = await env.ARCHIVE.prepare(
    `SELECT e.id, e.rule_id, r.name AS rule_name, e.signal_guid, e.fired_at, e.title, e.link, e.attention
       FROM alert_events e
       JOIN alert_rules r ON r.id = e.rule_id
       ORDER BY e.fired_at DESC
       LIMIT ?`,
  ).bind(limit).all<{ id: number; rule_id: number; rule_name: string; signal_guid: string; fired_at: string; title: string; link: string; attention: string }>();
  return { events: res.results ?? [] };
}

// ---- Bills (archive view) ---------------------------------------------------

export async function queryBills(env: Env, params: URLSearchParams): Promise<{
  rows: Array<{ guid: string; title: string; link: string; pub_date: string | null; description: string | null; attention: string | null; confidence: number | null }>;
  total: number;
}> {
  const q = searchTerm(params.get("q"));
  const limit = clampLimit(params.get("limit"), 100, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = ["kind = 'digest'"];
  const binds: unknown[] = [];
  if (q) {
    where.push("instr(LOWER(title), ?) > 0");
    binds.push(q);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const total = (await env.ARCHIVE.prepare(`SELECT COUNT(*) AS n FROM signals ${whereSql}`)
    .bind(...binds).first<{ n: number }>())?.n ?? 0;

  const rows = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, description, attention, confidence
       FROM signals ${whereSql}
       ORDER BY COALESCE(pub_date, first_seen_at) DESC
       LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<{ guid: string; title: string; link: string; pub_date: string | null; description: string | null; attention: string | null; confidence: number | null }>();

  // PageBills.tsx renders `attention` as a coloured chip per row. kind is
  // always 'digest' here (see the WHERE clause above). Recompute at read time
  // for the same reason as queryStateSignals/queryArchive: the stored value is
  // an ingest-time snapshot that freezes once the bill drops out of its feed.
  const now = new Date();
  const scoredRows = (rows.results ?? []).map((row) => {
    const scored = scoreForArchive(row.title, "digest", row.pub_date, now);
    return { ...row, attention: scored.attention, confidence: scored.confidence };
  });

  return { rows: scoredRows, total };
}

// ---- QONs -------------------------------------------------------------------

export interface QonRow {
  id: string;
  asked_at: string;
  member: string | null;
  chamber: string | null;
  target: string | null;
  question: string | null;
  hansard_url: string;
  ingested_at: string;
}

export async function queryQons(env: Env, params: URLSearchParams): Promise<{
  rows: QonRow[];
  total: number;
}> {
  const q = searchTerm(params.get("q"));
  const chamber = params.get("chamber");
  const limit = clampLimit(params.get("limit"), 100, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) {
    where.push("(instr(LOWER(member), ?) > 0 OR instr(LOWER(question), ?) > 0)");
    binds.push(q, q);
  }
  if (chamber) { where.push("chamber = ?"); binds.push(chamber); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (await env.ARCHIVE.prepare(`SELECT COUNT(*) AS n FROM qons ${whereSql}`)
    .bind(...binds).first<{ n: number }>())?.n ?? 0;

  const rows = await env.ARCHIVE.prepare(
    `SELECT id, asked_at, member, chamber, target, question, hansard_url, ingested_at
       FROM qons ${whereSql}
       ORDER BY asked_at DESC
       LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<QonRow>();

  return { rows: rows.results ?? [], total };
}

// ---- Members ----------------------------------------------------------------

export interface MemberRow {
  mpid: string;
  name: string;
  chamber: string;
  party: string | null;
  state: string | null;
  role: string | null;
  profile_url: string;
  updated_at: string;
}

const PARTY_RE = /\b(ALP|Labor|Labour|LNP|Liberal|LPA|NPA|National|GRN|Greens?|UAP|ONP|Pauline|IND|Independent|CLP|KAP|CA|Centre Alliance)\b/i;
const STATE_RE = /\b(NSW|New South Wales|VIC|Victoria|QLD|Queensland|SA|South Australia|WA|Western Australia|TAS|Tasmania|ACT|Australian Capital Territory|NT|Northern Territory)\b/i;
const STATE_ABBR: Record<string, string> = {
  "new south wales": "NSW", "victoria": "VIC", "queensland": "QLD",
  "south australia": "SA", "western australia": "WA", "tasmania": "TAS",
  "australian capital territory": "ACT", "northern territory": "NT",
};
const PARTY_ABBR: Record<string, string> = {
  "labor": "ALP", "labour": "ALP", "liberal": "LIB", "lpa": "LIB",
  "national": "NAT", "npa": "NAT", "greens": "GRN", "green": "GRN",
  "independent": "IND", "pauline": "ONP",
};

function normaliseParty(raw: string): string {
  const lo = raw.toLowerCase();
  return PARTY_ABBR[lo] ?? raw.toUpperCase().slice(0, 8);
}
function normaliseState(raw: string): string {
  const lo = raw.toLowerCase();
  return STATE_ABBR[lo] ?? raw.toUpperCase().slice(0, 8);
}

export async function ingestMembers(env: Env): Promise<{ added: number; updated: number }> {
  const now = new Date().toISOString();
  // Pull senators_details archive items — these have title=senator name, link=APH profile
  const res = await env.ARCHIVE.prepare(
    `SELECT title, link, description FROM signals
     WHERE feed_label LIKE '%senator%' AND link LIKE '%Parliamentarian%MPID%'
     ORDER BY last_seen_at DESC LIMIT 500`,
  ).all<{ title: string; link: string; description: string | null }>();

  let added = 0;
  let updated = 0;
  const items = res.results ?? [];

  for (const row of items) {
    // Extract MPID from link: ?MPID=283869
    const mpidMatch = row.link.match(/[?&]MPID=([A-Za-z0-9]+)/i);
    if (!mpidMatch || !mpidMatch[1]) continue;
    const mpid = mpidMatch[1];

    // Name: strip "Senator " / "The Hon. " prefix
    const rawName = row.title.replace(/^(Senator|The Hon\.|Hon\.|Dr\.|Prof\.)\s+/i, "").trim();
    if (!rawName) continue;

    // Party and state from description (e.g. "ALP, NSW")
    const desc = row.description ?? "";
    const partyMatch = desc.match(PARTY_RE) ?? row.title.match(PARTY_RE);
    const stateMatch = desc.match(STATE_RE) ?? row.title.match(STATE_RE);
    const party = partyMatch ? normaliseParty(partyMatch[1]) : null;
    const state = stateMatch ? normaliseState(stateMatch[1]) : null;
    const role = row.title.toLowerCase().startsWith("senator") ? "Senator" : "Member";

    const r = await env.ARCHIVE.prepare(
      `INSERT INTO members (mpid, name, chamber, party, state, role, profile_url, updated_at)
       VALUES (?, ?, 'Senate', ?, ?, ?, ?, ?)
       ON CONFLICT(mpid) DO UPDATE SET
         name = excluded.name, party = COALESCE(excluded.party, party),
         state = COALESCE(excluded.state, state), profile_url = excluded.profile_url,
         updated_at = excluded.updated_at`,
    ).bind(mpid, rawName, party, state, role, row.link, now).run();

    if (r.meta?.last_row_id && r.meta.last_row_id > 0) added += 1;
    else updated += 1;
  }

  return { added, updated };
}

export async function queryMembers(env: Env, params: URLSearchParams): Promise<{
  members: MemberRow[];
  total: number;
}> {
  const q = searchTerm(params.get("q"));
  const party = params.get("party");
  const chamber = params.get("chamber");
  const limit = clampLimit(params.get("limit"), 200, 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) { where.push("instr(LOWER(name), ?) > 0"); binds.push(q); }
  if (party) { where.push("party = ?"); binds.push(party); }
  if (chamber) { where.push("chamber = ?"); binds.push(chamber); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (await env.ARCHIVE.prepare(`SELECT COUNT(*) AS n FROM members ${whereSql}`)
    .bind(...binds).first<{ n: number }>())?.n ?? 0;

  const rows = await env.ARCHIVE.prepare(
    `SELECT mpid, name, chamber, party, state, role, profile_url, updated_at
       FROM members ${whereSql}
       ORDER BY name ASC LIMIT ? OFFSET ?`,
  ).bind(...binds, limit, offset).all<MemberRow>();

  return { members: rows.results ?? [], total };
}

// ---- Top signals (composed /state endpoint) ---------------------------------
// Ordered by a freshly recomputed score (high first) then recency. Distinct
// from queryArchive: no filters, no pagination -- just the current
// top-of-inbox view for the composed /state response.
//
// LB-03 fix (2026-07-22): this used to ORDER BY the stored `attention`
// column, which is an ingest-time snapshot that freezes the moment an item
// drops out of its RSS feed (see the INSERT comment in pollAndArchive). A
// stale item scored "high" weeks ago would then pin the top of the inbox
// forever, and its persisted scoring_explanation would go on claiming
// "Published today" indefinitely. Fixed by selecting candidates by recency
// only, rescoring every candidate against the current instant, and sorting
// by that fresh score instead.
//
// WK-04 fix (DATA-05, 29 Sep 2026): a single global LIMIT 30 let the busiest
// feeds (inquiries, hearings) take every row, so divisions, media releases,
// reports and digests received nothing and their desks sat empty. Selection
// is now per feed: one query ranks each configured feed_label's rows by
// recency with ROW_NUMBER() OVER (PARTITION BY feed_label ...) and keeps a
// per-feed candidate window; each feed's candidates are rescored and the top
// PER_FEED_QUOTA kept; the union is sorted globally and capped at
// STATE_SIGNAL_CAP. COUNT(*) OVER the same partition gives `available` for
// meta.signal_counts, so the UI can say "latest N held" honestly.

/** Rows each configured feed contributes to /state at most. */
export const PER_FEED_QUOTA = 10;
/** Hard ceiling on the /state signals block (13 feeds x 10 = 130 today). */
export const STATE_SIGNAL_CAP = 150;
/** Recency window per feed that is rescored before the quota is applied. */
const PER_FEED_CANDIDATES = PER_FEED_QUOTA * 4;

export interface TopSignalRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  attention: string | null;
  confidence: number | null;
  scoring_explanation: string | null;
  // 0.16.2: the hearing's civil date (YYYY-MM-DD) parsed at read time from
  // the stored description (see hearingDate.ts). null for every non-hearing
  // row and for a hearing row whose description carries no parseable date.
  hearing_date: string | null;
}

/** held = rows served in the block; available = rows archived for the feed. */
export type SignalCounts = Record<string, { held: number; available: number }>;

export interface StateSignals {
  items: TopSignalRow[];
  signal_counts: SignalCounts;
}

interface TopSignalCandidate {
  guid: string;
  title: string;
  link: string;
  pub_date: string | null;
  feed_label: string;
  source_group: string;
  kind: string;
  first_seen_at: string;
  description: string | null;
  feed_available: number;
}

interface Rescored {
  row: TopSignalCandidate;
  overallPct: number;
  attention: string | null;
  confidence: number | null;
  explanation: string | null;
}

function byScoreThenRecency(a: Rescored, b: Rescored): number {
  if (b.overallPct !== a.overallPct) return b.overallPct - a.overallPct;
  const aKey = a.row.pub_date ?? a.row.first_seen_at;
  const bKey = b.row.pub_date ?? b.row.first_seen_at;
  return bKey.localeCompare(aKey); // ISO-8601 strings sort correctly lexically
}

/**
 * Hearing-feed order for the per-feed quota (0.16.4). Hearing rows carry no
 * pubDate, so ranking them by score then recency compared equal timestamps
 * and the quota kept an arbitrary 10 of 13 (5 Oct 2026: the 16 Oct aviation
 * sector hearing was dropped, and Committees said 2 dated today or later
 * when 3 were). Order: upcoming hearings (on or after `today`, Brisbane)
 * soonest first, then past hearings most recent first, then rows with no
 * parseable date by score then recency.
 */
export function byHearingDate(today: string) {
  return (a: Rescored & { hearing: string | null }, b: Rescored & { hearing: string | null }): number => {
    const tier = (d: string | null) => (d === null ? 2 : d >= today ? 0 : 1);
    const ta = tier(a.hearing), tb = tier(b.hearing);
    if (ta !== tb) return ta - tb;
    if (ta === 0 && a.hearing !== b.hearing) return (a.hearing as string).localeCompare(b.hearing as string);
    if (ta === 1 && a.hearing !== b.hearing) return (b.hearing as string).localeCompare(a.hearing as string);
    return byScoreThenRecency(a, b);
  };
}

export async function queryStateSignals(
  env: Env,
  opts: { perFeed?: number; cap?: number; feeds?: string[]; now?: Date } = {},
): Promise<StateSignals> {
  const perFeed = opts.perFeed ?? PER_FEED_QUOTA;
  const cap = opts.cap ?? STATE_SIGNAL_CAP;
  const labels = opts.feeds ?? APH_FEEDS.map((f) => f.label);
  const candidatesPerFeed = Math.max(perFeed, PER_FEED_CANDIDATES);

  const signal_counts: SignalCounts = {};
  for (const l of labels) signal_counts[l] = { held: 0, available: 0 };
  if (labels.length === 0) return { items: [], signal_counts };

  // One query for every feed. Candidates are ranked by RECENCY only, never by
  // the stored `attention` column (the LB-03 half: ordering by a frozen value
  // is what let a stale item pin the inbox). guid breaks recency ties so the
  // window is deterministic. A hearing row without a pubDate is windowed by
  // last_seen_at (0.16.4), so every hearing the feed still lists is a
  // candidate; first_seen_at would rank a long-listed hearing below old ones.
  const placeholders = labels.map(() => "?").join(", ");
  const res = await env.ARCHIVE.prepare(
    `SELECT guid, title, link, pub_date, feed_label, source_group, kind, first_seen_at, description, feed_available
       FROM (
         SELECT guid, title, link, pub_date, feed_label, source_group, kind, first_seen_at, description,
                ROW_NUMBER() OVER (PARTITION BY feed_label ORDER BY
                  CASE WHEN kind = 'hearing' AND pub_date IS NULL THEN last_seen_at
                       ELSE COALESCE(pub_date, first_seen_at) END DESC, guid) AS feed_rank,
                COUNT(*) OVER (PARTITION BY feed_label) AS feed_available
           FROM signals
          WHERE feed_label IN (${placeholders})
       )
      WHERE feed_rank <= ?`,
  ).bind(...labels, candidatesPerFeed).all<TopSignalCandidate>();
  const candidates = res.results ?? [];

  // One `now` for the whole batch so every candidate is scored against the
  // same instant. Captured here, after the D1 query above has already forced
  // the isolate to perform I/O, so it cannot read back the frozen epoch
  // clock (do not hoist this above the query or to module scope).
  const now = opts.now ?? new Date();
  const today = brisbaneToday(now);

  const byFeed = new Map<string, Array<Rescored & { hearing: string | null }>>();
  for (const row of candidates) {
    const scored = scoreForArchive(row.title, row.kind, row.pub_date, now, 0, row.first_seen_at);
    const list = byFeed.get(row.feed_label) ?? [];
    list.push({
      row, overallPct: scored.overallPct, attention: scored.attention, confidence: scored.confidence, explanation: scored.explanation,
      hearing: row.kind === "hearing" ? parseHearingDate(row.description) : null,
    });
    byFeed.set(row.feed_label, list);
    signal_counts[row.feed_label].available = Number(row.feed_available);
  }

  const merged: Rescored[] = [];
  for (const list of byFeed.values()) {
    list.sort(list.some((r) => r.hearing !== null) ? byHearingDate(today) : byScoreThenRecency);
    merged.push(...list.slice(0, perFeed));
  }
  merged.sort(byScoreThenRecency);
  const kept = merged.slice(0, cap);
  for (const r of kept) signal_counts[r.row.feed_label].held += 1;

  const items = kept.map(({ row, attention, confidence, explanation }): TopSignalRow => ({
    guid: row.guid,
    title: row.title,
    link: row.link,
    pub_date: row.pub_date,
    feed_label: row.feed_label,
    source_group: row.source_group,
    kind: row.kind,
    first_seen_at: row.first_seen_at,
    attention,
    confidence,
    scoring_explanation: explanation,
    // Parsed at read time, so it needs no column or migration and always
    // tracks the description the latest poll wrote. The description itself is
    // not served.
    hearing_date: row.kind === "hearing" ? parseHearingDate(row.description) : null,
  }));
  return { items, signal_counts };
}

// ---- Watchlist 7-day trend --------------------------------------------------
// Returns signal counts per day for the last 7 days matching any of the given
// keyword terms. Days with zero matches are included so the chart has a stable
// 7-bar shape. Accepts up to 5 terms.

export async function watchlistTrend(env: Env, params: URLSearchParams): Promise<{
  days: Array<{ day: string; count: number }>;
}> {
  const rawTerms = params.get("terms") ?? "";
  const terms = rawTerms.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5).map((t) => searchTerm(t, "terms") as string);
  if (terms.length === 0) return { days: buildEmptyWeek() };

  // SEC-16, then 0.16.4: a literal substring test (see searchTerm), so "50%"
  // matches only a title containing "50%", and a long term cannot hit D1's
  // 50-byte LIKE limit.
  const termConditions = terms.map(() => `instr(LOWER(title), ?) > 0`).join(" OR ");
  const termBinds = terms;

  const rows = await env.ARCHIVE.prepare(
    `SELECT DATE(pub_date) AS day, COUNT(*) AS count
       FROM signals
      WHERE (${termConditions})
        AND pub_date >= datetime('now', '-7 days')
      GROUP BY DATE(pub_date)
      ORDER BY day ASC`,
  ).bind(...termBinds).all<{ day: string; count: number }>();

  const result = buildEmptyWeek();
  for (const row of rows.results ?? []) {
    const entry = result.find(d => d.day === row.day);
    if (entry) entry.count = row.count;
  }
  return { days: result };
}

function buildEmptyWeek(): Array<{ day: string; count: number }> {
  const days: Array<{ day: string; count: number }> = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  return days;
}
