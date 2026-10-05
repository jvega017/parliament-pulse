// ---- Global store: persistent state for real interactivity ----
const StoreCtx = React.createContext(null);

function useStore() { return React.useContext(StoreCtx); }

function safeGetLocalStorage(key, fallback = null) {
  try {
    return window.localStorage?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    window.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function copyToClipboard(text) {
  const value = String(text ?? "");
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  } catch {
    // Fall through to the textarea copy path.
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      copied ? resolve() : reject(new Error("Clipboard copy failed"));
    } catch (error) {
      reject(error);
    }
  });
}

// Canonical default shape. Returning users from older builds may have saved
// state that is missing newer keys, so every read merges over this object.
const STORE_DEFAULTS = {
  owners: {}, // { entityId: ownerName }
  feedback: {}, // { signalId: { label, reason, ts } }
  archived: {}, // { signalId: true }
  briefsGenerated: {}, // { signalId: { ts, type } }
  watchlistAdds: {}, // { entityKey: true }
  watchlistCreated: [], // extra watchlists
  feeds: [], // extra custom feeds
  notes: {}, // { signalId: "text" }
};

// Merge a parsed blob over the defaults. Top-level keys are taken from the saved
// blob where present; the nested object keys (notes, feeds, owners, feedback,
// watchlistCreated and the rest) are coerced back to their default type so a
// corrupt or partial save can never crash a render that spreads or maps them.
function hydrateState(parsed) {
  if (!parsed || typeof parsed !== "object") return { ...STORE_DEFAULTS };
  const merged = { ...STORE_DEFAULTS, ...parsed };
  for (const key of Object.keys(STORE_DEFAULTS)) {
    const def = STORE_DEFAULTS[key];
    const val = parsed[key];
    if (Array.isArray(def)) {
      merged[key] = Array.isArray(val) ? val : [];
    } else if (def && typeof def === "object") {
      merged[key] = (val && typeof val === "object" && !Array.isArray(val)) ? { ...def, ...val } : { ...def };
    }
  }
  merged.watchlistCreated = merged.watchlistCreated.map(w => ({
    ...w,
    trend: Array.isArray(w.trend) ? w.trend : [],
    matches: Number.isFinite(Number(w.matches)) ? Number(w.matches) : 0,
    keywords: Number.isFinite(Number(w.keywords)) ? Number(w.keywords) : 0,
  }));
  return merged;
}

// Explicit keyword and tag lists per watchlist name, so signal matching is
// stable rather than relying on the first word of the watchlist name. Keys are
// the canonical WATCHLISTS names. Created watchlists fall back to a tokenised
// match on their own name (see watchlistKeywords).
const WATCHLIST_KEYWORDS = {
  "Digital government": ["digital", "service delivery", "myGov", "platform"],
  "AI & automation": ["ai", "automation", "automated", "assurance", "algorithm", "machine learning"],
  "Cyber security": ["cyber", "security", "breach", "ransomware", "incident"],
  "Digital identity": ["digital id", "identity", "credential", "verification"],
  "Data sharing & privacy": ["data", "privacy", "sharing", "consent", "personal information"],
  "Procurement": ["procurement", "contract", "tender", "consultancy"],
  "Service delivery": ["service delivery", "service", "client", "channel"],
  "Infrastructure & connectivity": ["infrastructure", "connectivity", "network", "5g", "broadband"],
  "Health digital systems": ["health", "ehealth", "medical", "telehealth"],
  "Parliamentary scrutiny": ["scrutiny", "estimates", "committee", "inquiry", "tabled"],
  "Estimates preparation": ["estimates", "budget", "appropriation", "portfolio"],
  "Queensland federal signals": ["queensland", "qld", "brisbane", "state"],
};

// Resolve the keyword list for any watchlist. Canonical lists win; created
// watchlists tokenise their own name into match terms.
function watchlistKeywords(w) {
  const explicit = WATCHLIST_KEYWORDS[w.name];
  if (explicit && explicit.length) return explicit;
  if (Array.isArray(w.keywordList) && w.keywordList.length) return w.keywordList;
  return w.name.toLowerCase().split(/\s+|&/).map(t => t.trim()).filter(t => t.length > 2);
}

// Count signals matching a watchlist by tag OR title against the keyword list.
// The optional `signals` argument lets a desk match against the live signal
// stream; the default preserves every existing caller (matches against SIGNALS).
// Live items carry only the `kind` tag, so title matching is what makes a live
// match real (section 2.4 of the live-wiring spec).
// Word-boundary matcher, cached per term. Substring matching (the previous
// implementation used String.includes) silently inflated every count: the term
// "ai" matched "said", "Australia", "chair" and "Chairman"; "state" matched
// "statement"; "data" matched "update". A match count produced by collision is
// a fabricated statistic, produced by a bug instead of by hand, and this product
// does not ship fabricated numbers. Multi-word terms ("digital id", "machine
// learning") phrase-match, still anchored at both ends.
const WATCHLIST_TERM_RE = new Map();
function watchlistTermRegex(term) {
  const key = term.toLowerCase();
  let re = WATCHLIST_TERM_RE.get(key);
  if (!re) {
    // Escape regex metacharacters so a term is always matched literally.
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // \b is unreliable next to a non-word character, so anchor on a
    // non-word-or-start / non-word-or-end boundary instead.
    re = new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i");
    WATCHLIST_TERM_RE.set(key, re);
  }
  return re;
}

function watchlistMatches(w, signals = (typeof SIGNALS !== "undefined" ? SIGNALS : [])) {
  const terms = watchlistKeywords(w);
  if (!Array.isArray(signals)) return [];
  return signals.filter(s => {
    const title = s.title || "";
    const tagHit = (s.tags || []).some(t => {
      const label = t.l || "";
      return terms.some(term => watchlistTermRegex(term).test(label));
    });
    const titleHit = terms.some(term => watchlistTermRegex(term).test(title));
    return tagHit || titleHit;
  });
}

// ---- Live /state mappers (module scope) ----
// Worker snake_case -> frontend fields. Every worker field is Verified from
// docs/state-contract.md. Mapping may rename and derive; it never fabricates a
// field. action/score/provenance-trail/updates stay undefined for live items;
// existing consumers guard on their presence.

// ---- Honest dates (FE-05, DATA-13, PR-02) ----
// Every date the product prints is in Brisbane time (AEST, no daylight saving),
// matching fmtFetchedAt below. Month names are spelt out here rather than taken
// from toLocaleDateString, whose en-AU output ("Sept") varies by ICU build.
const PP_TZ = "Australia/Brisbane";
const PP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ppDateParts(t, timeZone) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t))) parts[p.type] = p.value;
  return parts;
}
// "29 Sep 2026" for an epoch, in the given zone (Brisbane unless stated).
function fmtDayMonYear(t, timeZone = PP_TZ) {
  const p = ppDateParts(t, timeZone);
  return `${Number(p.day)} ${PP_MONTHS[Number(p.month) - 1]} ${p.year}`;
}
function fmtClockHM(t, timeZone = PP_TZ) {
  const p = ppDateParts(t, timeZone);
  return `${p.hour}:${p.minute}`;
}
// The single short-date formatter: "28 Sep", with the year added only when the
// date falls outside the current Brisbane year ("28 Sep 2025"). Every short date
// the product prints comes from here or fmtDayMonYear, never from
// toLocaleDateString, so a month is always "Sep" and never "Sept".
function fmtDayMon(t, timeZone = PP_TZ, now = Date.now()) {
  const p = ppDateParts(t, timeZone);
  const thisYear = ppDateParts(now, PP_TZ).year;
  return `${Number(p.day)} ${PP_MONTHS[Number(p.month) - 1]}${p.year === thisYear ? "" : " " + p.year}`;
}
// A card-head label for a timed item: the Brisbane clock when it was published
// today (Brisbane), otherwise its date ("28 Sep").
function fmtWhenShort(t, now = Date.now()) {
  return fmtDayMonYear(t) === fmtDayMonYear(now) ? fmtClockHM(t) : fmtDayMon(t, PP_TZ, now);
}
// ISO string in, formatted date out, or NOT_SUPPLIED for a missing or bad value.
function fmtIsoDate(iso, withYear = true) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return NOT_SUPPLIED;
  return withYear ? fmtDayMonYear(t) : fmtDayMon(t);
}
// A signal card's head label, worked out at render time so it stays right
// across midnight: timed items read the clock today and the date otherwise;
// date-only items read their calendar day; undated items keep their
// "Date not supplied" line.
function signalWhen(s, now = Date.now()) {
  if (!s) return "";
  if (typeof s.pubAt === "number" && !Number.isNaN(s.pubAt)) {
    if (s.dateKind === "datetime") return fmtWhenShort(s.pubAt, now);
    if (s.dateKind === "date") return fmtDayMon(s.pubAt, "UTC", now);
  }
  return s.when ?? s.time;
}

// Does a pub_date carry a real clock time? A date-only source value must never
// grow an invented 00:00 (or 10:00 once shifted into AEST). Date-only forms:
//   "2026-09-29"                          (ISO date)
//   "Tue, 29 Sep 2026"                    (RFC 822 with no time)
//   "2026-09-29T00:00:00.000Z"            (the Worker's toISOString of a
//                                          date-only value: exactly UTC midnight)
//   "Tue, 29 Sep 2026 00:00:00 GMT"       (RFC 822 at exactly UTC midnight)
// Exactly-UTC-midnight is read as date-only because that is what a date-only
// feed value becomes after new Date(...).toISOString(); a genuine 10:00 AEST
// item is indistinguishable from it, and printing no clock is the honest side.
function pubDateHasClock(s) {
  if (!/\d{1,2}:\d{2}/.test(s)) return false;
  if (/T00:00(:00(\.0+)?)?(Z|[+-]00:?00)$/i.test(s)) return false;
  if (/\s00:00(:00)?\s*(GMT|UT|UTC|Z|[+-]0000)$/i.test(s)) return false;
  return true;
}

// Derive the card's date fields from pub_date and first_seen_at.
//   dateKind "datetime": time "HH:MM", date "D Mon YYYY" (both Brisbane)
//   dateKind "date":     time "",      date "D Mon YYYY" (the stated calendar day)
//   dateKind "none":     time "",      date "Date not supplied, first seen D Mon YYYY"
// `when` is the fallback card-head label; signalWhen() derives the live one at
// render time from `pubAt` (the parsed epoch) and dateKind. An undated card head
// reads only "Date not supplied": the "first seen" date stays in `date`, which
// the drawer shows, because the long label ran past the card at 390 and 320 px.
function signalDateFields(pubDate, firstSeenAt) {
  const raw = pubDate == null ? "" : String(pubDate).trim();
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isNaN(t)) {
    if (pubDateHasClock(raw)) {
      const time = fmtClockHM(t);
      return { dateKind: "datetime", time, date: fmtDayMonYear(t), when: time, pubAt: t };
    }
    // A date-only value names a calendar day; read it in UTC so the day never
    // shifts across the date line.
    const date = fmtDayMonYear(t, "UTC");
    return { dateKind: "date", time: "", date, when: date, pubAt: t };
  }
  const seen = firstSeenAt ? Date.parse(firstSeenAt) : NaN;
  const date = Number.isNaN(seen) ? "Date not supplied" : `Date not supplied, first seen ${fmtDayMonYear(seen)}`;
  return { dateKind: "none", time: "", date, when: "Date not supplied", pubAt: null };
}

// ---- Brisbane calendar days and hearing dates (round 5) ----
// "YYYY-MM-DD" of an epoch in Brisbane, the civil day every "today" test uses.
function brisbaneDayKey(t = Date.now()) {
  const p = ppDateParts(t, PP_TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
// The Brisbane calendar day a mapped signal was published on, or null. A
// date-only value names its calendar day directly (read in UTC, as
// signalDateFields does), so it never shifts across the date line.
function signalDayKey(s) {
  if (!s || typeof s.pubAt !== "number" || Number.isNaN(s.pubAt)) return null;
  if (s.dateKind === "date") {
    const d = new Date(s.pubAt);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return s.dateKind === "datetime" ? brisbaneDayKey(s.pubAt) : null;
}
// Worker 0.16.2 serves hearing_date, the hearing's civil day as printed by APH
// ("YYYY-MM-DD", no time zone). Worker 0.16.1 omits the field. Anything that is
// not a real calendar date maps to null, so no row ever carries a guessed day.
function parseHearingDay(v) {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const cal = new Date(Date.UTC(y, mo - 1, d));
  if (cal.getUTCFullYear() !== y || cal.getUTCMonth() !== mo - 1 || cal.getUTCDate() !== d) return null;
  return m[0];
}
const PP_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// "Tue 6 Oct" for a "YYYY-MM-DD" hearing day, read as a calendar day (UTC), never
// shifted through a time zone. The year is added outside the current year.
function fmtHearingDay(key, now = Date.now()) {
  const day = parseHearingDay(key);
  if (!day) return null;
  const [y, mo, d] = day.split("-").map(Number);
  const t = Date.UTC(y, mo - 1, d);
  return `${PP_WEEKDAYS[new Date(t).getUTCDay()]} ${fmtDayMon(t, "UTC", now)}`;
}
// A feed name for display. Two APH feeds are named "Today's ...", which read
// false on a card dated another day, so the leading "Today's " is dropped
// wherever a label sits beside a date. The Worker's feed_label itself (s.source)
// is unchanged, so every filter still matches it exactly.
function feedDisplayName(label) {
  const l = String(label || "");
  const m = /^Today's\s+(.+)$/i.exec(l);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : l;
}
// The committee an APH committee link belongs to, read from its path:
// /Committees/<House|Senate|Joint>/<Committee_Name>/... -> "Senate · Community Affairs".
// Same-titled reports from different committees ("Additional Estimates 2025-26"
// from five committees) are then told apart. null for any other link.
function committeeFromLink(link) {
  const m = /\/Committees\/(House|Senate|Joint)\/([^/?#;]+)/i.exec(String(link || ""));
  if (!m) return /\/Senate_estimates\//i.test(String(link || "")) ? "Senate estimates" : null;
  let name = m[2];
  try { name = decodeURIComponent(name); } catch { /* keep the raw segment */ }
  name = name.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return null;
  return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()} · ${name}`;
}
// Two archived hearing links point at aphcms.aph.gov.au, which does not resolve;
// the same path on www.aph.gov.au answers (data review, 5 Oct 2026).
function canonicalAphLink(link) {
  return typeof link === "string" ? link.replace(/^https:\/\/aphcms\.aph\.gov\.au\//i, "https://www.aph.gov.au/") : link;
}

// signals.items[] -> signal card shape. Moved from pages.jsx unchanged, then
// extended with the two new fields (link, isLive) marked NEW in the spec table.
function mapWorkerSignalToCard(row) {
  const dates = signalDateFields(row.pub_date, row.first_seen_at);
  // Validate the APH deep link once (safeHttpUrl enforces an aph.gov.au host) and
  // reuse that single validated value for both the title anchor and the evidence
  // link, so evidence can never keep a raw, unvalidated or non-APH URL.
  const link = safeHttpUrl(canonicalAphLink(row.link));
  return {
    // Worker 0.16.2: the hearing's civil day, or null (0.16.1 sends no field).
    hearingDate: parseHearingDay(row.hearing_date),
    committee: committeeFromLink(link),
    id: row.guid,
    time: dates.time,
    date: dates.date,
    when: dates.when,
    pubAt: dates.pubAt,
    dateKind: dates.dateKind,
    firstSeenAt: row.first_seen_at || null,
    // DATA-20: the badge is the Worker's own feed_label for this row, never a
    // label looked up in a static registry.
    source: row.feed_label,
    sourceGroup: row.source_group,
    title: row.title,
    link,                                        // validated APH deep link (licence render rule)
    summary: row.scoring_explanation || "",
    tags: [{ l: row.kind, c: "" }],
    // Missing attention or confidence carries a null sentinel that the UI renders
    // as an em-dash; the product never invents a "low"/0 metric the Worker did not send.
    attention: row.attention ?? null,
    attentionReason: row.scoring_explanation || "",
    action: "",
    actionReason: "",
    confidence: row.confidence ?? null,
    sourceAuthority: "Official",
    isLive: true,                                // NEW: drives the licence render rule
    evidence: link ? [{ label: row.feed_label, url: link }] : [],
  };
}

// connectors.checks[] -> feed-health row. Joins each check to SOURCE_REGISTRY by
// exact url for its label and group; unmatched checks are real Worker-monitored
// endpoints the frontend does not poll directly.
//
// FE-05 (DATA-08, UX-12, DATA-16, DATA-20): the Worker now serves one check per
// CONFIGURED feed, carrying feed_label, last_http_status, items_parsed,
// last_success_at and parse_error. The label is the Worker's feed_label; the
// registry supplies only the group. An older Worker serves landing-page probes
// with none of those fields: every new field then maps to null, isFeed is false,
// and the Sources page keeps its previous table.
function feedGroupFromLabel(label) {
  const l = String(label || "").toLowerCase();
  if (/digest|library|flagpost/.test(l)) return "Library";
  if (/joint/.test(l)) return "Joint";
  if (/senate|senator/.test(l)) return "Senate";
  if (/house/.test(l)) return "House";
  return "APH";
}
function mapConnectorCheck(row) {
  const registry = (typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY)) ? SOURCE_REGISTRY : [];
  const reg = registry.find(r => r.url === row.url);
  const stripped = String(row.url || "").replace(/^https?:\/\/(www\.)?/, "");
  const feedLabel = typeof row.feed_label === "string" && row.feed_label ? row.feed_label : null;
  const lastHttpStatus = row.last_http_status ?? row.status ?? null;
  return {
    url: row.url,
    checkedAt: row.checked_at ?? null,
    ok: !!row.ok,                                // live sample carries 1; coerce truthy
    httpStatus: row.status ?? null,
    error: row.error ?? null,
    label: feedLabel || reg?.label || stripped,
    group: reg?.group || (feedLabel ? feedGroupFromLabel(feedLabel) : "Worker"),
    isFeed: !!feedLabel,
    feedLabel,
    kind: row.kind ?? null,
    lastHttpStatus,
    itemsParsed: row.items_parsed ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    parseError: row.parse_error ?? null,
    // A configured feed with no poll yet: no check time and no HTTP status. It is
    // reported as "Not yet polled", never coloured as a failure.
    neverPolled: (row.checked_at == null) && lastHttpStatus == null,
  };
}

// Health of one mapped feed check: "ok" | "failed" | "pending" (never polled).
function feedHealthState(c) {
  if (!c || c.neverPolled) return "pending";
  return c.ok ? "ok" : "failed";
}

// ---- Ingest freshness (FE-05, DATA-07) ----
// meta.last_poll_at is the last poll that re-saw any item, meta.last_new_item_at
// the last genuinely new item, meta.stale the Worker's own stall verdict (90 min),
// and meta.feeds[] the per-feed last_seen_at. An older Worker omits them all:
// known is then false and every surface keeps its previous behaviour.
const POLL_STALE_AFTER_MS = 90 * 60 * 1000;
function mapLiveFreshness(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  const has = k => Object.prototype.hasOwnProperty.call(m, k);
  return {
    known: has("last_poll_at") || has("stale"),
    lastPollAt: m.last_poll_at || null,
    lastNewItemAt: m.last_new_item_at || null,
    stale: m.stale === true,
    feeds: Array.isArray(m.feeds)
      ? m.feeds.filter(f => f && f.feed_label).map(f => ({ feedLabel: f.feed_label, lastSeenAt: f.last_seen_at || null }))
      : [],
    // meta.signal_counts: per feed, the rows served (held) and archived
    // (available). Empty on a Worker that does not send it.
    signalCounts: (m.signal_counts && typeof m.signal_counts === "object") ? m.signal_counts : {},
  };
}

// "latest 10 of 75": the rows a list holds beside the rows archived for its
// feeds, from meta.signal_counts. Returns "" when the Worker sent no counts or
// the list holds every archived row, so no list claims more than it knows.
function heldOfAvailable(fr, labels, held) {
  const counts = fr && fr.signalCounts ? fr.signalCounts : {};
  let available = 0, known = false;
  for (const l of labels) {
    const c = counts[l];
    if (c && Number.isFinite(Number(c.available))) { available += Number(c.available); known = true; }
  }
  if (!known || !(available > held)) return "";
  return `latest ${held} of ${available}`;
}

// When a feed last carried an item at all (meta.feeds[].last_seen_at), or null.
function feedLastSeenAt(fr, label) {
  const f = fr && Array.isArray(fr.feeds) ? fr.feeds.find(x => x.feedLabel === label) : null;
  return f ? f.lastSeenAt : null;
}

// Health across the configured feeds, from the feed-shaped connector checks:
// { total, ok, failed, pending }, or null when the Worker serves no feed rows.
function feedHealthSummary(blocks) {
  const items = blocks && blocks.connectors && Array.isArray(blocks.connectors.items) ? blocks.connectors.items : null;
  const feeds = items ? items.filter(c => c && c.isFeed) : [];
  if (!feeds.length) return null;
  const st = feeds.map(feedHealthState);
  return { total: feeds.length, ok: st.filter(x => x === "ok").length, failed: st.filter(x => x === "failed").length, pending: st.filter(x => x === "pending").length };
}
// The check row for one feed label, or null.
function feedCheckFor(blocks, label) {
  const items = blocks && blocks.connectors && Array.isArray(blocks.connectors.items) ? blocks.connectors.items : [];
  return items.find(c => c && c.isFeed && c.feedLabel === label) || null;
}

// True when the poller looks stalled. The Worker's flag decides; a cache that
// has aged past the same 90-minute window since last_poll_at also counts, so a
// cached "fresh" verdict cannot outlive the cron it describes.
function pollIsStale(fr, now = Date.now()) {
  if (!fr || !fr.known) return false;
  if (fr.stale) return true;
  const t = fr.lastPollAt ? Date.parse(fr.lastPollAt) : NaN;
  if (Number.isNaN(t)) return true;
  return now - t > POLL_STALE_AFTER_MS;
}

function fmtPollAgo(iso, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return "under 1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

// "14:05 AEST, 29 Sep 2026", or null.
function fmtPollStamp(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return null;
  return `${fmtClockHM(t)} AEST, ${fmtDayMonYear(t)}`;
}

// The strings every freshness surface prints, derived in one place.
//   known:     the Worker served freshness fields at all
//   stale:     polling looks stalled (the topbar must not read Live)
//   pollLine:  "Last APH poll 5 min ago" (null when unknown)
//   stallText: "APH polling appears stalled; last successful poll 14:05 AEST, 29 Sep 2026"
function freshnessView(fr, now = Date.now()) {
  if (!fr || !fr.known) return { known: false, stale: false, pollLine: null, stallText: null };
  const stale = pollIsStale(fr, now);
  const ago = fmtPollAgo(fr.lastPollAt, now);
  const stamp = fmtPollStamp(fr.lastPollAt);
  return {
    known: true,
    stale,
    pollLine: ago ? `Last APH poll ${ago}` : "No APH poll recorded",
    stallText: stale ? `APH polling appears stalled; last successful poll ${stamp || "not recorded"}` : null,
  };
}

function useFreshness() {
  const { liveState } = useStore();
  const fr = (liveState && liveState.blocks && liveState.blocks.freshness) || null;
  return freshnessView(fr);
}

// Number of feeds the Worker is configured to poll, counted from the feed-shaped
// connector checks (one row per configured feed). null when the Worker has not
// served that shape: callers then print no number rather than a registry count.
function configuredFeedCount(blocks) {
  const items = blocks && blocks.connectors && Array.isArray(blocks.connectors.items) ? blocks.connectors.items : null;
  if (!items) return null;
  const feeds = items.filter(c => c && c.isFeed);
  return feeds.length ? feeds.length : null;
}
function useFeedCount() {
  const { liveState } = useStore();
  return configuredFeedCount(liveState && liveState.blocks);
}

// threads.items[] -> thread row. signalGuids MAY resolve against the mapped
// signals; unresolved guids render as a count only, never a fabricated row.
function mapThreadItem(row) {
  return {
    id: row.thread_id,
    title: row.title,
    itemCount: row.item_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    signalGuids: Array.isArray(row.signal_guids) ? row.signal_guids : [],
  };
}

// Map one raw block. Copies provenance, maps fetched_at -> fetchedAt and note ->
// note (when present), and maps the payload array ONLY when provenance is "live"
// and the array is non-empty; otherwise the mapped array is null so the desk
// falls back to its fixture. The mapped array is always stored under `items`
// (the hook is uniform; connectors know their rows are checks).
function mapOneBlock(block, arrayKey, mapFn) {
  if (!block || typeof block !== "object") {
    return { provenance: "fixture", fetchedAt: null, items: null };
  }
  const arr = block[arrayKey];
  // Map when the Worker declares the block "live" (real source data) OR "derived"
  // (the Worker's own analysis, for example thread clustering). Both are usable and
  // honestly chipped; "fixture"/"representative"/empty fall back to the desk fixture.
  const usable = (block.provenance === "live" || block.provenance === "derived") && Array.isArray(arr) && arr.length > 0;
  const out = {
    provenance: block.provenance,
    fetchedAt: block.fetched_at || null,
    items: usable ? arr.map(mapFn) : null,
  };
  if (block.note != null) out.note = block.note;
  return out;
}

// mapLiveBlocks(blocks) -> object keyed by the five block names. The payload
// array field differs per block (signals/threads/qons -> items, connectors ->
// checks, alerts -> events); each maps into the uniform `items` slot.
//
// FE-05: the optional second argument is the /state meta. Its freshness fields
// travel in the `freshness` slot (it carries no `items`, so mergeLiveBlocks
// always takes the newest), and connectors.reference_links travels beside the
// connector checks as referenceLinks (plain URLs, never an ok/fail claim).
function mapLiveBlocks(blocks, meta) {
  const b = blocks || {};
  const connectors = mapOneBlock(b.connectors, "checks", mapConnectorCheck);
  const refs = b.connectors && Array.isArray(b.connectors.reference_links) ? b.connectors.reference_links : null;
  connectors.referenceLinks = refs ? refs.filter(u => typeof u === "string" && safeHttpUrl(u)) : null;
  return {
    freshness: mapLiveFreshness(meta),
    signals: mapOneBlock(b.signals, "items", mapWorkerSignalToCard),
    connectors,
    threads: mapOneBlock(b.threads, "items", mapThreadItem),
    alerts: mapOneBlock(b.alerts, "events", x => x),
    qons: mapOneBlock(b.qons, "items", x => x),
    // Dedicated desk blocks the Worker does not serve yet (state-v1 carries none).
    // Mapped when present so a later Worker release lights the counts up with no
    // frontend change; absent, they map to items:null and the counts fall back to
    // the signals-derived subset below.
    committees: mapOneBlock(b.committees, "items", x => x),
    reports: mapOneBlock(b.reports, "items", x => x),
    divisions: mapOneBlock(b.divisions, "items", x => x),
  };
}

// ---- Single-source counts (UX-02) ----
// Every count the product shows (nav badges, Overview tiles, the About ledger,
// the activation matrix) is read from selectCounts() over the /state cache, so no
// two surfaces can disagree and no literal default can survive a data change.
// A count is null when its desk has no live or derived block with rows: callers
// render no badge (or a dash) for null, never a remembered number.
//
// Real Worker feed_label values (workers/aph-proxy/src/jurisdictions.json,
// verified against a live /state probe 2026-07-22).
const COMMITTEE_STRIP_LABELS = new Set([
  "Senate reports tabled", "New Senate inquiries", "Upcoming Senate hearings",
  "House committee inquiries", "Joint committee inquiries",
]);
const REPORT_LABELS = new Set(["Senate reports tabled"]);
const DIVISION_LABELS = new Set(["House divisions"]);

function selectCounts(blocks, liveBills) {
  const b = blocks || {};
  const signals = (b.signals && Array.isArray(b.signals.items)) ? b.signals.items : null;
  const own = (blk) => (blk && Array.isArray(blk.items)) ? blk.items.length : null;
  const fromSignals = (labels) => signals ? signals.filter(s => labels.has(s.source)).length : null;
  const prov = (blk) => (blk && Array.isArray(blk.items)) ? blk.provenance : null;
  const billsItems = liveBills && Array.isArray(liveBills.items) ? liveBills.items : null;
  // A dedicated block wins; otherwise the subset is derived from live signals.
  const pick = (blk, labels) => own(blk) ?? fromSignals(labels);
  const pickProv = (blk) => prov(blk) || (signals ? prov(b.signals) : null);
  return {
    signals: signals ? signals.length : null,
    committees: pick(b.committees, COMMITTEE_STRIP_LABELS),
    reports: pick(b.reports, REPORT_LABELS),
    divisions: pick(b.divisions, DIVISION_LABELS),
    threads: own(b.threads),
    qons: own(b.qons),
    connectors: own(b.connectors),
    bills: billsItems ? billsItems.length : null,
    // Provenance of whatever produced each count: "live" | "derived" | null.
    provenance: {
      signals: prov(b.signals),
      committees: pickProv(b.committees),
      reports: pickProv(b.reports),
      divisions: pickProv(b.divisions),
      threads: prov(b.threads),
      qons: prov(b.qons),
      connectors: prov(b.connectors),
      bills: billsItems ? "live" : null,
    },
  };
}

function useCounts() {
  const { liveState, liveBills } = useStore();
  return React.useMemo(() => selectCounts(liveState && liveState.blocks, liveBills), [liveState && liveState.blocks, liveBills]);
}

// Merge a freshly-mapped block set over the cached one, per block. A fresh block
// with usable items replaces the cache; a fresh block that is degraded or empty
// (items null) keeps the last-good cached block AND its own fetchedAt, so a
// transient bad revalidation never erases good data or resets its age. This is the
// honesty guarantee behind stale-while-revalidate.
function mergeLiveBlocks(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  const out = {};
  for (const k of Object.keys(next)) {
    const nb = next[k], pb = prev[k];
    if (nb && nb.items) out[k] = nb;
    else if (pb && pb.items) out[k] = pb;
    else out[k] = nb || pb;
  }
  return out;
}

// Shared fetched-at formatter: HH:MM in Brisbane time. Desks append "AEST"
// themselves, so this returns only the clock component. Accepts an ISO string
// (the Worker's fetched_at) or a millisecond epoch (the store's own fetchedAt:
// the liveState and liveBills caches stamp Date.now()). Date.parse(number) is
// NaN, which printed "fetched Not supplied AEST" on the Bills header.
function fetchedAtMs(v) {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : NaN;
  if (typeof v !== "string" || !v) return NaN;
  return Date.parse(v);
}
function fmtFetchedAt(v) {
  try {
    const t = fetchedAtMs(v);
    return Number.isNaN(t) ? NOT_SUPPLIED : fmtClockHM(t);
  } catch {
    return NOT_SUPPLIED;
  }
}
// "fetched 14:05 AEST" when a fetch time is held, or "" when none is, so a
// header never prints "fetched Not supplied AEST". Callers join it with " · ".
function fetchedClause(v) {
  const t = fetchedAtMs(v);
  return Number.isNaN(t) ? "" : `fetched ${fmtClockHM(t)} AEST`;
}
// The latest check time across a set of feed health checks, as
// "last check 09:55 AEST", or "" when no check carries a time. The Sources
// "Healthy" tile reads this: the page's own fetch time says nothing about when
// the service last checked the feeds. A check made before today (Brisbane)
// carries its day, "last check 28 Sep 09:55 AEST", so a stalled poller's clock
// time never reads as this morning's.
function latestCheckClause(checks, now = Date.now()) {
  let latest = NaN;
  for (const c of checks || []) {
    const t = fetchedAtMs(c && c.checkedAt);
    if (!Number.isNaN(t) && (Number.isNaN(latest) || t > latest)) latest = t;
  }
  if (Number.isNaN(latest)) return "";
  const day = fmtDayMonYear(latest) === fmtDayMonYear(now) ? "" : `${fmtDayMon(latest, PP_TZ, now)} `;
  return `last check ${day}${fmtClockHM(latest)} AEST`;
}

// Explicit degradation state machine over the /state cache: loading | ready |
// stale | error. This is the surface-level machine the topbar and banners read;
// it is derived (never stored) because "stale" drifts with the clock. It is kept
// distinct from liveState.status (which stays idle|loading|ready|error and drives
// skeleton control) so introducing "stale" never changes a skeleton or fixture
// decision. Honesty posture:
//   loading: no good load yet and a fetch is in progress (initial skeletons).
//   error:   no good load has EVER landed (fetchedAt null and a fetch has failed).
//            The desks show their Representative fixtures; the topbar shows the
//            LIVE DATA UNAVAILABLE chip. It NEVER reports a cache we do not hold.
//   stale:   a good cache exists but is older than 30 minutes (staleness banner).
//   ready:   a good cache exists and is fresh.
// A background failure with a cache present stays "ready" (or "stale" by age),
// so a failed refetch can never regress the honest fixture fallback.
function liveStateDegradation(liveState, now = Date.now()) {
  if (!liveState) return "loading";
  const { status, fetchedAt } = liveState;
  if (fetchedAt == null) return status === "error" ? "error" : "loading";
  if (now - fetchedAt > 30 * 60 * 1000) return "stale";
  return "ready";
}

// Selector over the store's /state cache. blockName: "signals" | "connectors"
// | "threads" | "alerts" | "qons".
function useLiveState(blockName) {
  const { liveState } = useStore();
  const block = liveState.blocks?.[blockName] || null;
  const items = block?.items || null;      // null => render the desk's fixture
  // liveStale is a whole-cache freshness flag, deliberately read from the shared
  // liveState.fetchedAt (the last SUCCESSFUL load) rather than this one block's
  // stamp, so every desk agrees on staleness. It is true ONLY when a good cache
  // exists (at least one mapped block carries items) AND that cache is older than
  // 30 minutes. It stays false while data is fresh, during the first load (no
  // cache yet), and whenever no cache has ever landed. This mirrors the "stale"
  // arm of liveStateDegradation and never overstates freshness.
  const hasGoodCache = !!(liveState.blocks && Object.values(liveState.blocks).some(b => b && b.items));
  const liveStale = hasGoodCache
    && liveState.fetchedAt != null
    && (Date.now() - liveState.fetchedAt) > 30 * 60 * 1000;
  return {
    status: liveState.status,
    items,                                  // mapped array, or null
    fetchedAt: block?.fetchedAt || null,
    note: block?.note || null,
    referenceLinks: block?.referenceLinks || null,   // connectors only (FE-05)
    isRefreshing: liveState.isRefreshing,
    liveStale,                              // cache older than 30 min AND a good cache exists
    // What the chip shows. A block with usable items shows its own provenance
    // ("live" or "derived"); an empty or missing block can never place a Live chip
    // (invariant 2) and falls back to "fixture".
    displayProvenance: items ? block.provenance
      : (block && block.provenance !== "live" && block.provenance !== "derived" ? block.provenance : "fixture"),
  };
}

// Selector over the store's independent /bills cache (see the liveBills state
// block in StoreProvider below). Bills carries no frontend fixture at all, so a
// null `items` means literally nothing has ever loaded (first load, or every
// attempt so far has failed) rather than "show the representative fallback" —
// the desk must render an honest empty/error state in that case, never a
// "Fixture" chip implying representative content is on screen.
function useLiveBills() {
  const { liveBills } = useStore();
  return {
    status: liveBills.status,
    items: liveBills.items,        // null (nothing has ever loaded) or an array (maybe empty) once live
    total: liveBills.total ?? null, // the Worker's archived digest count, when sent
    fetchedAt: liveBills.fetchedAt,
    isRefreshing: liveBills.isRefreshing,
  };
}

// ---- Analytics honesty (FE-06: UX-03, PR-11, UX-08, DATA-14) ----
// Pure helpers shared by the Bills, Signals and Activity-by-source desks and the
// search palette. They never invent a score: they only describe the values the
// Worker actually sent.

// The dimensions the Worker's scoreForArchive computes (workers/aph-proxy
// src/workerScoring.ts: authority, recency, novelty, scrutiny). A live
// scoring_explanation that ends "Scored on a, b, c." overrides this list, so the
// disclosure follows the Worker rather than a frozen copy of it.
const ATTENTION_DIMS_DEFAULT = ["authority", "recency", "novelty", "scrutiny"];
const ATTENTION_DIM_LABELS = {
  authority: "source authority", recency: "recency", novelty: "novelty",
  scrutiny: "scrutiny keyword match", momentum: "momentum",
};
function scoringDims(explanations) {
  for (const e of explanations || []) {
    const m = String(e || "").match(/Scored on ([a-z ,]+)\./i);
    if (m) {
      const dims = m[1].split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
      if (dims.length) return dims;
    }
  }
  return ATTENTION_DIMS_DEFAULT;
}
function attentionDisclosure(dims = ATTENTION_DIMS_DEFAULT) {
  const words = dims.map(d => ATTENTION_DIM_LABELS[d] || d);
  const list = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words.join("");
  return `Attention is a transparent heuristic (${list}). It has not yet been validated against practitioner judgement.`;
}

const ATTENTION_WORDS = { high: "High", med: "Medium", low: "Low" };
function attentionWord(level) { return ATTENTION_WORDS[level] || null; }
// Confidence is always "Confidence n of 5", never a bare number or a bar.
function confidenceLabel(n) {
  return (n == null || n === "" || Number.isNaN(Number(n))) ? "Confidence not scored" : `Confidence ${n} of 5`;
}

// The one value every row shares, or undefined when the rows differ (or there
// are fewer than two rows, where "all" says nothing). null is a real shared
// value: every row unscored.
function uniformScore(rows, key) {
  if (!Array.isArray(rows) || rows.length < 2) return undefined;
  const first = rows[0] ? (rows[0][key] ?? null) : null;
  return rows.every(r => ((r && r[key]) ?? null) === first) ? first : undefined;
}
// `noun` names what is counted: "items" by default; Activity by source passes
// "source groups", whose rows are groups that PEAK at a level, not items.
function uniformScoreLine(n, kind, value, noun = "items") {
  if (value == null) return `All ${n} ${noun} are currently unscored for ${kind}; the score does not yet separate them.`;
  const level = kind === "confidence" ? confidenceLabel(value) : `${attentionWord(value) || value} attention`;
  if (noun !== "items") return `All ${n} ${noun} peak at ${level}; the score does not yet separate them.`;
  return `All ${n} items currently score ${level}; the score does not yet separate them.`;
}

// Search palette index (UX-08, DATA-14). Signals are the live /state rows (or
// the empty fixture), bills are the live /bills rows from the shared liveBills
// cache that PageBills also reads, committees and feeds are the static lists.
// Each group carries its real scope so the palette never implies it searched
// more than it holds.
function buildSearchResults(q, { signals, bills, committees, feeds, liveSignals }) {
  const term = String(q || "").trim().toLowerCase();
  if (!term) return null;
  const has = v => (v || "").toLowerCase().includes(term);
  const sigSource = signals || [];
  const billSource = bills || [];
  const commSource = committees || [];
  const feedSource = feeds || [];
  const sig = sigSource.filter(s => has(s.title) || has(s.summary) || has(s.id));
  const billHits = billSource.filter(b => has(b.title));
  const comm = commSource.filter(c => [c.name, c.portfolio, c.chamber].some(has));
  const feedHits = feedSource.filter(f => has(f.name));
  return {
    sig, bills: billHits, comm, feeds: feedHits,
    labels: {
      sig: liveSignals ? `Signals (latest ${sigSource.length} held)` : `Signals (${sigSource.length} held)`,
      bills: bills ? `Bills (latest ${billSource.length} with a Bills Digest)` : "Bills (not loaded)",
      comm: `Committees (${commSource.length} listed)`,
      feeds: `Sources (${feedSource.length} listed feeds)`,
    },
  };
}

function StoreProvider({ children, navigate = () => {} }) {
  // Owners assigned to signals/bills, feedback given, watchlist additions, toasts
  const [state, setState] = React.useState(() => {
    try {
      const raw = safeGetLocalStorage("cs-state-v1");
      if (raw) return hydrateState(JSON.parse(raw));
    } catch(e){
      // Corrupt or incompatible saved state. Fall through to defaults so the
      // app still loads rather than throwing on hydration.
    }
    return { ...STORE_DEFAULTS };
  });

  React.useEffect(() => {
    safeSetLocalStorage("cs-state-v1", JSON.stringify(state));
  }, [state]);

  const [toasts, setToasts] = React.useState([]);
  const toast = React.useCallback((msg, kind = "ok", action = null) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), action ? 5000 : 2800);
  }, []);

  const [modal, setModal] = React.useState(null); // { type, id }
  const openModal = React.useCallback((type, id) => setModal({ type, id }), []);
  const closeModal = React.useCallback(() => setModal(null), []);

  const [signalId, setSignalId] = React.useState(null);
  const openSignal = React.useCallback(s => setSignalId(typeof s === "string" ? s : s?.id), []);
  const closeSignal = React.useCallback(() => setSignalId(null), []);
  const [visibleSignalOrder, setVisibleSignalOrder] = React.useState(null);
  const [signalSearchQuery, setSignalSearchQuery] = React.useState("");
  // Live /state cache: polled data, deliberately NOT persisted to localStorage.
  // One cache, one selector (useLiveState); every desk reads this through the
  // hook rather than fetching for itself. Refreshed by a stale-while-revalidate
  // loop (initial load, a five-minute visible interval, and tab wake) that keeps
  // serving the cached blocks during revalidation and never erases a good cache
  // on error.
  const [liveState, setLiveState] = React.useState({
    status: "idle",       // idle | loading | ready | error (skeleton control; only the initial load shows "loading")
    meta: null,           // { generated_at, worker_version, schema } passthrough
    blocks: null,         // { signals, connectors, threads, alerts, qons } mapped, see mapLiveBlocks
    fetchedAt: null,      // ms epoch of the last SUCCESSFUL load; drives the age label and staleness
    isRefreshing: false,  // a background refetch is in flight; the UI stays on cached data, never skeletons
    lastError: null,      // ms epoch of the last failed fetch; a background failure is silent (no toast)
  });
  // SWR plumbing. etagRef enables optional If-None-Match revalidation; inFlightRef
  // dedupes concurrent fetches and holds the running fetch's promise, so a second
  // caller awaits that fetch instead of getting undefined back straight away (the
  // Sources "Refresh health" button toasted "reloaded" before anything had
  // reloaded); fetchedAtRef mirrors liveState.fetchedAt so the
  // visibility handler reads a fresh value without a stale closure.
  const etagRef = React.useRef(null);
  const inFlightRef = React.useRef(null);
  const fetchedAtRef = React.useRef(null);
  const mountedRef = React.useRef(true);
  const pendingLiveRefreshRef = React.useRef(false);
  const requestLiveRefresh = React.useCallback(() => { pendingLiveRefreshRef.current = true; }, []);
  const consumeLiveRefresh = React.useCallback(() => {
    const pending = pendingLiveRefreshRef.current;
    pendingLiveRefreshRef.current = false;
    return pending;
  }, []);

  // One stale-while-revalidate fetch for the whole app. Called on mount, on the
  // five-minute visible interval, on tab wake, and by refreshLiveState(). Guards
  // preserved from the former PageSignals effect: file:// early-return,
  // AbortController with an 8-second timeout, an in-flight flag. Invariants held:
  // a background refetch keeps status at "ready" (never flips the UI back to
  // skeletons), and a failed refetch never erases a good cache.
  const doFetch = React.useCallback(() => {
    if (location.protocol === "file:") return undefined;
    if (inFlightRef.current) return inFlightRef.current;
    const running = (async () => {
      // Only the first load (no cache yet) shows "loading". Once a good load has
      // landed, revalidation keeps status "ready" and flags isRefreshing instead,
      // so a background refetch can never regress the surface to skeletons.
      setLiveState(s => ({ ...s, status: s.fetchedAt == null ? "loading" : "ready", isRefreshing: true }));
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const headers = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;
        const res = await fetch(`${WORKER_BASE_URL}/state`, { signal: ctrl.signal, headers });
        // 304 Not Modified: a successful no-op revalidate. Keep the cached blocks
        // and meta exactly as they are; only refresh the age stamp. (Worker ETag
        // support is optional; without it every response is a full 200 fetch.)
        if (res.status === 304) {
          const now = Date.now();
          fetchedAtRef.current = now;
          if (mountedRef.current) setLiveState(s => ({ ...s, status: "ready", isRefreshing: false, fetchedAt: now, lastError: null }));
          return;
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        const nextEtag = res.headers.get("ETag");
        const payload = await res.json();
        const now = Date.now();
        etagRef.current = nextEtag || null;
        if (mountedRef.current) {
          setLiveState(s => {
            const nextBlocks = mapLiveBlocks(payload.blocks, payload.meta);
            // Merge per block: a fresh block with usable items wins; a block that comes
            // back degraded or empty keeps its last-good cache, so a transient bad
            // revalidation never erases good data. Freshness tracks the primary
            // (signals) block: if signals came back usable the shown data is fresh,
            // otherwise the age stays put so the topbar never overstates freshness.
            const merged = mergeLiveBlocks(s.blocks, nextBlocks);
            const signalsFresh = !!(nextBlocks.signals && nextBlocks.signals.items);
            const nextFetchedAt = signalsFresh ? now : (s.fetchedAt || null);
            fetchedAtRef.current = nextFetchedAt;
            return {
              ...s,
              status: "ready",
              isRefreshing: false,
              fetchedAt: nextFetchedAt,
              lastError: null,
              meta: payload.meta ?? s.meta ?? null,
              blocks: merged,
            };
          });
        }
      } catch (e) {
        // A failed refetch keeps the cache untouched (blocks and meta are preserved)
        // and records the failure time. Status degrades to "error" only when no good
        // load has ever landed; with a cache present the surface stays "ready" and
        // the age label keeps counting up. Silent by design: no toast fires here, so
        // the manual-refresh caller owns any user-facing failure message.
        if (mountedRef.current) {
          setLiveState(s => ({ ...s, status: s.fetchedAt != null ? "ready" : "error", isRefreshing: false, lastError: Date.now() }));
        }
        throw e;
      } finally {
        clearTimeout(timer);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = running;
    return running;
  }, []);

  // Manual refresh trigger for the topbar. Forces a fetch and returns the promise
  // so the caller can await it, spin its icon while isRefreshing, and toast on a
  // rejected (failed) manual refresh.
  const refreshLiveState = React.useCallback(() => doFetch(), [doFetch]);

  // Initial load plus the revalidation loop.
  React.useEffect(() => {
    // file:// origins cannot reach the Worker (same guard as the Live page
    // poller): skip the initial fetch and all revalidation there.
    if (location.protocol === "file:") return;
    mountedRef.current = true;
    doFetch().catch(() => {});   // degradation is carried in state; nothing to handle here

    // Revalidate every five minutes, but only while the tab is visible so a
    // backgrounded tab does not poll the Worker needlessly.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") doFetch().catch(() => {});
    }, 5 * 60 * 1000);

    // Revalidate on tab wake when the cache is older than five minutes (or absent).
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const last = fetchedAtRef.current;
      if (last == null || Date.now() - last > 5 * 60 * 1000) doFetch().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [doFetch]);

  // Expose the manual trigger and a read-only snapshot on window (spec 3.4.4), so
  // non-React callers and the topbar affordance reach the same single source.
  React.useEffect(() => {
    window.refreshLiveState = refreshLiveState;
    window.__pulseLiveState = liveState;
  }, [refreshLiveState, liveState]);

  // ---- Live bills (GET /bills) ----
  // Independent SWR cache alongside the /state cache above: Bills is served from a
  // separate Worker endpoint with its own shape (GET /bills?limit=N -> {rows,total}),
  // so it cannot ride the /state poller. Mirrors doFetch's guards (file:// early
  // return, 8s abort timeout, in-flight dedupe) and its degradation contract: a
  // failed revalidation keeps the last-good rows rather than blanking the desk, and
  // only the very first load ever shows "loading". Bills carries no frontend
  // fixture, so `items` stays null until a fetch has genuinely succeeded at least
  // once — there is nothing else honest to fall back to.
  const [liveBills, setLiveBills] = React.useState({
    status: "idle",       // idle | loading | ready | error
    items: null,           // null = nothing has ever loaded; array (maybe empty) once one lands
    fetchedAt: null,
    isRefreshing: false,
    lastError: null,
  });
  const billsInFlightRef = React.useRef(false);
  const billsMountedRef = React.useRef(true);
  const billsFetchedAtRef = React.useRef(null);

  const doFetchBills = React.useCallback(async () => {
    if (location.protocol === "file:") return;
    if (billsInFlightRef.current) return;
    billsInFlightRef.current = true;
    setLiveBills(s => ({ ...s, status: s.fetchedAt == null ? "loading" : "ready", isRefreshing: true }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      // limit=200 (the Worker caps at 500): limit=50 cut the list at 50 of 52.
      const res = await fetch(`${WORKER_BASE_URL}/bills?limit=200`, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const payload = await res.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      // The Worker's own archive count, so the header can say "50 of 52".
      const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : null;
      const now = Date.now();
      billsFetchedAtRef.current = now;
      if (billsMountedRef.current) {
        setLiveBills(s => ({ ...s, status: "ready", isRefreshing: false, fetchedAt: now, lastError: null, items: rows, total }));
      }
    } catch (e) {
      // A failed revalidation leaves the cached rows untouched; status only
      // degrades to "error" when nothing has ever loaded (spec: keep last-good
      // data on a failed revalidation rather than blanking the desk).
      if (billsMountedRef.current) {
        setLiveBills(s => ({ ...s, status: s.fetchedAt != null ? "ready" : "error", isRefreshing: false, lastError: Date.now() }));
      }
    } finally {
      clearTimeout(timer);
      billsInFlightRef.current = false;
    }
  }, []);

  const refreshLiveBills = React.useCallback(() => doFetchBills(), [doFetchBills]);

  React.useEffect(() => {
    if (location.protocol === "file:") return;
    billsMountedRef.current = true;
    doFetchBills().catch(() => {});
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") doFetchBills().catch(() => {});
    }, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const last = billsFetchedAtRef.current;
      if (last == null || Date.now() - last > 5 * 60 * 1000) doFetchBills().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      billsMountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [doFetchBills]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    if (modal || signalId) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [modal, signalId]);

  const assignOwner = React.useCallback((entityId, owner) => {
    setState(s => ({ ...s, owners: { ...s.owners, [entityId]: owner } }));
    toast(`Assigned ${owner} as policy owner`);
  }, [toast]);
  const saveFeedback = React.useCallback((signalId, label, reason) => {
    // The feedback chip's inline .on state is the single confirmation (UX-13); no toast.
    setState(s => ({ ...s, feedback: { ...s.feedback, [signalId]: { label, reason, ts: Date.now() } } }));
  }, []);
  const unarchive = React.useCallback((signalId) => {
    setState(s => { const n = { ...s.archived }; delete n[signalId]; return { ...s, archived: n }; });
  }, []);
  const archive = React.useCallback((signalId) => {
    let remaining = 0;
    // The count must reflect whichever inbox is actually on screen: live items
    // when the /state signals block is connected, otherwise the (now empty)
    // SIGNALS fixture. Reading SIGNALS alone would always report "0 remaining"
    // even while real live signals are still sitting unarchived.
    const currentSignals = liveState.blocks?.signals?.items || SIGNALS;
    setState(s => {
      const archived = { ...s.archived, [signalId]: true };
      // Compute the count from the NEXT state so rapid successive archives do
      // not read a stale snapshot. Clamp at 0 for safety.
      remaining = Math.max(0, currentSignals.filter(x => !archived[x.id]).length);
      return { ...s, archived };
    });
    const msg = remaining > 0 ? `${signalId} archived · ${remaining} remaining` : "All signals reviewed";
    toast(msg, "ok", { label: "Undo", fn: () => unarchive(signalId) });
  }, [toast, unarchive, liveState]);
  const addWatchlist = React.useCallback((key) => {
    // Persist the flag and report the real running count so the action is
    // observable, not a bare success toast. The flag survives reload and can
    // be read back via state.watchlistAdds.
    let total = 0;
    let already = false;
    setState(s => {
      if (s.watchlistAdds[key]) {
        already = true;
        total = Object.keys(s.watchlistAdds).length;
        return s;
      }
      const watchlistAdds = { ...s.watchlistAdds, [key]: true };
      total = Object.keys(watchlistAdds).length;
      return { ...s, watchlistAdds };
    });
    toast(already ? "Already on watchlist" : `Saved to watchlist, ${total} tracked`, "brass");
  }, [toast]);
  const isWatched = React.useCallback((key) => !!state.watchlistAdds[key], [state.watchlistAdds]);
  const removeWatchlist = React.useCallback((key) => {
    setState(s => {
      const watchlistAdds = { ...s.watchlistAdds };
      delete watchlistAdds[key];
      return { ...s, watchlistAdds };
    });
    toast("Removed from watchlist", "brass");
  }, [toast]);
  const createWatchlist = React.useCallback((name) => {
    // Seed sensibly: derive keyword terms from the name and compute real match
    // counts against whichever signal stream is actually on screen (live items
    // when connected, otherwise the now-empty SIGNALS fixture, which honestly
    // yields 0 rather than a fabricated seed). trend stays empty — Parliament
    // Pulse holds no real history of a brand-new watchlist's matches over time,
    // so seeding six invented zero-days plus today's real count (the previous
    // behaviour) would still be presenting an invented history, just with one
    // true data point buried in it. The entry is flagged new for the UI.
    const keywordList = name.toLowerCase().split(/\s+|&/).map(t => t.trim()).filter(t => t.length > 2);
    const currentSignals = liveState.blocks?.signals?.items || SIGNALS;
    const matches = watchlistMatches({ name, keywordList }, currentSignals).length;
    const entry = {
      name,
      keywordList,
      keywords: keywordList.length,
      matches,
      trend: [],
      created: true,
    };
    setState(s => ({ ...s, watchlistCreated: [...s.watchlistCreated, entry] }));
    toast(`Watchlist "${name}" created`, "brass");
  }, [toast, liveState]);
  const generateBrief = React.useCallback((signalId, type) => {
    setState(s => ({ ...s, briefsGenerated: { ...s.briefsGenerated, [signalId]: { ts: Date.now(), type } } }));
  }, []);
  const addFeed = React.useCallback((feed) => {
    setState(s => ({ ...s, feeds: [...s.feeds, feed] }));
    toast(`Feed saved on this device: ${feed.name}`, "brass");
  }, [toast]);
  const saveNote = React.useCallback((signalId, text) => {
    setState(s => ({ ...s, notes: { ...s.notes, [signalId]: text } }));
  }, []);

  const storeValue = React.useMemo(() => ({
      state, setState, toast, toasts,
      modal, openModal, closeModal,
      signalId, openSignal, closeSignal,
      visibleSignalOrder, setVisibleSignalOrder,
      signalSearchQuery, setSignalSearchQuery,
      liveState,
      requestLiveRefresh, consumeLiveRefresh,
      refreshLiveState, liveStateDegradation,
      liveBills, refreshLiveBills,
      navigate,
      assignOwner, saveFeedback, archive, unarchive,
      addWatchlist, removeWatchlist, isWatched, createWatchlist, generateBrief, addFeed, saveNote,
  }), [
    state, toasts, toast,
    modal, openModal, closeModal,
    signalId, openSignal, closeSignal,
    visibleSignalOrder, signalSearchQuery,
    liveState,
    requestLiveRefresh, consumeLiveRefresh, refreshLiveState,
    liveBills, refreshLiveBills,
    navigate, assignOwner, saveFeedback, archive, unarchive,
    addWatchlist, removeWatchlist, isWatched, createWatchlist, generateBrief, addFeed, saveNote,
  ]);

  return (
    <StoreCtx.Provider value={storeValue}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            // Errors announce assertively: a failed live refresh is exactly the
            // case a screen-reader user must not miss, because the data on
            // screen is then older than it appears.
            role={t.kind === "error" ? "alert" : undefined}
            aria-live={t.kind === "error" ? "assertive" : undefined}
            className={"toast" + (t.kind === "error" ? " toast-err" : "")}
            style={{
              border: "1px solid var(--line-bright)",
              borderLeft: "3px solid " + (t.kind === "error" ? "var(--ember-flash)" : "var(--brass)"),
            }}
          >
            <Icon
              name={t.kind === "error" ? "close" : "check"}
              size={14}
              stroke={t.kind === "error" ? "var(--ember-flash)" : t.kind === "brass" ? "var(--brass)" : "var(--ok)"}
            />
            <span>{t.msg}</span>
            {t.action && (
              <button className="toast-act" onClick={() => { t.action.fn(); setToasts(ts => ts.filter(x => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}

// ---------- Hash routing (FE-08: UX-06, A11Y-04, ARCH-14) ----------
// Every desk has an address, so a link can be shared and Back and Forward work.
//   #/<deskId>                     a NAV desk (an empty hash or "#/" is Overview)
//   #/signal/<encodeURIComponent(guid)>  the signal drawer, opened over the Signal inbox
//   #/about/<section>              About the data, scrolled to one section
// Anything else that starts with "#/" is a real "Page not found" desk, never a
// silent fall back to Overview. A hash that does not start with "#/" (the skip
// link's #pp-content, for example) is an in-page anchor, not a route: parseRoute
// returns null and the router leaves the current desk alone.
// parseRoute and routeHash are pure; app.jsx owns the listener and the history writes.
const ABOUT_SECTIONS = ["legal", "privacy", "not-yet-available", "licence", "accessibility"];

function routeDeskIds() {
  return (typeof NAV !== "undefined" && Array.isArray(NAV)) ? NAV.map(n => n.id) : [];
}

function decodeRoutePart(s) {
  try { return decodeURIComponent(s); } catch (e) { return null; }
}

function parseRoute(hash) {
  const h = String(hash == null ? "" : hash).replace(/^#/, "");
  if (h === "" || h === "/") return { page: "overview" };
  if (h.charAt(0) !== "/") return null;
  const parts = h.slice(1).split("/");
  const head = decodeRoutePart(parts[0]);
  if (head === "signal") {
    const guid = parts.length > 1 ? decodeRoutePart(parts.slice(1).join("/")) : null;
    return guid ? { page: "signals", signal: guid } : { page: "notfound", path: h };
  }
  if (head === "about" && parts.length > 1 && parts[1] !== "") {
    return ABOUT_SECTIONS.includes(parts[1]) && parts.length === 2
      ? { page: "about", section: parts[1] }
      : { page: "notfound", path: h };
  }
  if (parts.length === 1 || (parts.length === 2 && parts[1] === "")) {
    if (head && routeDeskIds().includes(head)) return { page: head };
  }
  return { page: "notfound", path: h };
}

function routeHash(route) {
  if (!route || !route.page || route.page === "overview") return "#/overview";
  if (route.signal) return "#/signal/" + encodeURIComponent(route.signal);
  if (route.page === "about" && route.section) return "#/about/" + route.section;
  if (route.page === "notfound") return "#/" + (route.path || "").replace(/^\//, "");
  return "#/" + route.page;
}

function routeLabel(route) {
  if (!route || route.page === "notfound") return "Page not found";
  const n = routeDeskIds().length ? NAV.find(x => x.id === route.page) : null;
  return n ? n.label : "Page not found";
}

// "<Desk label> · Parliament Pulse": a middle dot (U+00B7), never an em dash.
function routeTitle(route) {
  return routeLabel(route) + " · Parliament Pulse";
}

// The pre-routing ?page=<desk> address maps to its hash once, with replaceState,
// so an old bookmark lands on its desk and Back does not return to the query form.
// Other query parameters (?debug) are kept. Returns the hash it wrote, or null.
function migrateLegacyPageQuery(loc, hist) {
  if (!loc || !hist || typeof hist.replaceState !== "function") return null;
  if (loc.hash && loc.hash !== "#" && loc.hash !== "#/") return null;
  let params;
  try { params = new URLSearchParams(loc.search || ""); } catch (e) { return null; }
  const legacy = params.get("page");
  if (!legacy) return null;
  params.delete("page");
  const rest = params.toString();
  const hash = "#/" + encodeURIComponent(legacy);
  hist.replaceState(hist.state, "", (loc.pathname || "/") + (rest ? "?" + rest : "") + hash);
  return hash;
}

Object.assign(window, { ABOUT_SECTIONS, parseRoute, routeHash, routeLabel, routeTitle, migrateLegacyPageQuery });

Object.assign(window, { StoreProvider, useStore, watchlistKeywords, watchlistMatches, useLiveState, useLiveBills, selectCounts, useCounts, COMMITTEE_STRIP_LABELS, liveStateDegradation, mapWorkerSignalToCard, mapLiveBlocks, fmtFetchedAt, fetchedClause, mapLiveFreshness, freshnessView, useFreshness, pollIsStale, configuredFeedCount, useFeedCount, feedHealthState, signalDateFields, fmtDayMonYear, fmtPollStamp, ATTENTION_DIMS_DEFAULT, scoringDims, attentionDisclosure, attentionWord, confidenceLabel, uniformScore, uniformScoreLine, buildSearchResults, brisbaneDayKey, signalDayKey, parseHearingDay, fmtHearingDay, feedDisplayName, committeeFromLink, heldOfAvailable, feedLastSeenAt, feedHealthSummary, feedCheckFor });
