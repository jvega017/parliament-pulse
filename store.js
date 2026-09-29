const StoreCtx = React.createContext(null);
function useStore() {
  return React.useContext(StoreCtx);
}
function safeGetLocalStorage(key, fallback = null) {
  var _a, _b;
  try {
    return (_b = (_a = window.localStorage) == null ? void 0 : _a.getItem(key)) != null ? _b : fallback;
  } catch (e) {
    return fallback;
  }
}
function safeSetLocalStorage(key, value) {
  var _a;
  try {
    (_a = window.localStorage) == null ? void 0 : _a.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}
function copyToClipboard(text) {
  var _a;
  const value = String(text != null ? text : "");
  try {
    if ((_a = navigator.clipboard) == null ? void 0 : _a.writeText) return navigator.clipboard.writeText(value);
  } catch (e) {
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
const STORE_DEFAULTS = {
  owners: {},
  // { entityId: ownerName }
  feedback: {},
  // { signalId: { label, reason, ts } }
  archived: {},
  // { signalId: true }
  briefsGenerated: {},
  // { signalId: { ts, type } }
  watchlistAdds: {},
  // { entityKey: true }
  watchlistCreated: [],
  // extra watchlists
  feeds: [],
  // extra custom feeds
  notes: {}
  // { signalId: "text" }
};
function hydrateState(parsed) {
  if (!parsed || typeof parsed !== "object") return { ...STORE_DEFAULTS };
  const merged = { ...STORE_DEFAULTS, ...parsed };
  for (const key of Object.keys(STORE_DEFAULTS)) {
    const def = STORE_DEFAULTS[key];
    const val = parsed[key];
    if (Array.isArray(def)) {
      merged[key] = Array.isArray(val) ? val : [];
    } else if (def && typeof def === "object") {
      merged[key] = val && typeof val === "object" && !Array.isArray(val) ? { ...def, ...val } : { ...def };
    }
  }
  merged.watchlistCreated = merged.watchlistCreated.map((w) => ({
    ...w,
    trend: Array.isArray(w.trend) ? w.trend : [],
    matches: Number.isFinite(Number(w.matches)) ? Number(w.matches) : 0,
    keywords: Number.isFinite(Number(w.keywords)) ? Number(w.keywords) : 0
  }));
  return merged;
}
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
  "Queensland federal signals": ["queensland", "qld", "brisbane", "state"]
};
function watchlistKeywords(w) {
  const explicit = WATCHLIST_KEYWORDS[w.name];
  if (explicit && explicit.length) return explicit;
  if (Array.isArray(w.keywordList) && w.keywordList.length) return w.keywordList;
  return w.name.toLowerCase().split(/\s+|&/).map((t) => t.trim()).filter((t) => t.length > 2);
}
const WATCHLIST_TERM_RE = /* @__PURE__ */ new Map();
function watchlistTermRegex(term) {
  const key = term.toLowerCase();
  let re = WATCHLIST_TERM_RE.get(key);
  if (!re) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i");
    WATCHLIST_TERM_RE.set(key, re);
  }
  return re;
}
function watchlistMatches(w, signals = typeof SIGNALS !== "undefined" ? SIGNALS : []) {
  const terms = watchlistKeywords(w);
  if (!Array.isArray(signals)) return [];
  return signals.filter((s) => {
    const title = s.title || "";
    const tagHit = (s.tags || []).some((t) => {
      const label = t.l || "";
      return terms.some((term) => watchlistTermRegex(term).test(label));
    });
    const titleHit = terms.some((term) => watchlistTermRegex(term).test(title));
    return tagHit || titleHit;
  });
}
const PP_TZ = "Australia/Brisbane";
const PP_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ppDateParts(t, timeZone) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-AU", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t))) parts[p.type] = p.value;
  return parts;
}
function fmtDayMonYear(t, timeZone = PP_TZ) {
  const p = ppDateParts(t, timeZone);
  return `${Number(p.day)} ${PP_MONTHS[Number(p.month) - 1]} ${p.year}`;
}
function fmtClockHM(t, timeZone = PP_TZ) {
  const p = ppDateParts(t, timeZone);
  return `${p.hour}:${p.minute}`;
}
function fmtDayMon(t, timeZone = PP_TZ, now = Date.now()) {
  const p = ppDateParts(t, timeZone);
  const thisYear = ppDateParts(now, PP_TZ).year;
  return `${Number(p.day)} ${PP_MONTHS[Number(p.month) - 1]}${p.year === thisYear ? "" : " " + p.year}`;
}
function fmtWhenShort(t, now = Date.now()) {
  return fmtDayMonYear(t) === fmtDayMonYear(now) ? fmtClockHM(t) : fmtDayMon(t, PP_TZ, now);
}
function fmtIsoDate(iso, withYear = true) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return NOT_SUPPLIED;
  return withYear ? fmtDayMonYear(t) : fmtDayMon(t);
}
function signalWhen(s, now = Date.now()) {
  var _a;
  if (!s) return "";
  if (typeof s.pubAt === "number" && !Number.isNaN(s.pubAt)) {
    if (s.dateKind === "datetime") return fmtWhenShort(s.pubAt, now);
    if (s.dateKind === "date") return fmtDayMon(s.pubAt, "UTC", now);
  }
  return (_a = s.when) != null ? _a : s.time;
}
function pubDateHasClock(s) {
  if (!/\d{1,2}:\d{2}/.test(s)) return false;
  if (/T00:00(:00(\.0+)?)?(Z|[+-]00:?00)$/i.test(s)) return false;
  if (/\s00:00(:00)?\s*(GMT|UT|UTC|Z|[+-]0000)$/i.test(s)) return false;
  return true;
}
function signalDateFields(pubDate, firstSeenAt) {
  const raw = pubDate == null ? "" : String(pubDate).trim();
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isNaN(t)) {
    if (pubDateHasClock(raw)) {
      const time = fmtClockHM(t);
      return { dateKind: "datetime", time, date: fmtDayMonYear(t), when: time, pubAt: t };
    }
    const date2 = fmtDayMonYear(t, "UTC");
    return { dateKind: "date", time: "", date: date2, when: date2, pubAt: t };
  }
  const seen = firstSeenAt ? Date.parse(firstSeenAt) : NaN;
  const date = Number.isNaN(seen) ? "Date not supplied" : `Date not supplied, first seen ${fmtDayMonYear(seen)}`;
  return { dateKind: "none", time: "", date, when: "Date not supplied", pubAt: null };
}
function mapWorkerSignalToCard(row) {
  var _a, _b;
  const dates = signalDateFields(row.pub_date, row.first_seen_at);
  const link = safeHttpUrl(row.link);
  return {
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
    link,
    // validated APH deep link (licence render rule)
    summary: row.scoring_explanation || "",
    tags: [{ l: row.kind, c: "" }],
    // Missing attention or confidence carries a null sentinel that the UI renders
    // as an em-dash; the product never invents a "low"/0 metric the Worker did not send.
    attention: (_a = row.attention) != null ? _a : null,
    attentionReason: row.scoring_explanation || "",
    action: "",
    actionReason: "",
    confidence: (_b = row.confidence) != null ? _b : null,
    sourceAuthority: "Official",
    isLive: true,
    // NEW: drives the licence render rule
    evidence: link ? [{ label: row.feed_label, url: link }] : []
  };
}
function feedGroupFromLabel(label) {
  const l = String(label || "").toLowerCase();
  if (/digest|library|flagpost/.test(l)) return "Library";
  if (/joint/.test(l)) return "Joint";
  if (/senate|senator/.test(l)) return "Senate";
  if (/house/.test(l)) return "House";
  return "APH";
}
function mapConnectorCheck(row) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const registry = typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY) ? SOURCE_REGISTRY : [];
  const reg = registry.find((r) => r.url === row.url);
  const stripped = String(row.url || "").replace(/^https?:\/\/(www\.)?/, "");
  const feedLabel = typeof row.feed_label === "string" && row.feed_label ? row.feed_label : null;
  const lastHttpStatus = (_b = (_a = row.last_http_status) != null ? _a : row.status) != null ? _b : null;
  return {
    url: row.url,
    checkedAt: (_c = row.checked_at) != null ? _c : null,
    ok: !!row.ok,
    // live sample carries 1; coerce truthy
    httpStatus: (_d = row.status) != null ? _d : null,
    error: (_e = row.error) != null ? _e : null,
    label: feedLabel || (reg == null ? void 0 : reg.label) || stripped,
    group: (reg == null ? void 0 : reg.group) || (feedLabel ? feedGroupFromLabel(feedLabel) : "Worker"),
    isFeed: !!feedLabel,
    feedLabel,
    kind: (_f = row.kind) != null ? _f : null,
    lastHttpStatus,
    itemsParsed: (_g = row.items_parsed) != null ? _g : null,
    lastSuccessAt: (_h = row.last_success_at) != null ? _h : null,
    parseError: (_i = row.parse_error) != null ? _i : null,
    // A configured feed with no poll yet: no check time and no HTTP status. It is
    // reported as "Not yet polled", never coloured as a failure.
    neverPolled: row.checked_at == null && lastHttpStatus == null
  };
}
function feedHealthState(c) {
  if (!c || c.neverPolled) return "pending";
  return c.ok ? "ok" : "failed";
}
const POLL_STALE_AFTER_MS = 90 * 60 * 1e3;
function mapLiveFreshness(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  const has = (k) => Object.prototype.hasOwnProperty.call(m, k);
  return {
    known: has("last_poll_at") || has("stale"),
    lastPollAt: m.last_poll_at || null,
    lastNewItemAt: m.last_new_item_at || null,
    stale: m.stale === true,
    feeds: Array.isArray(m.feeds) ? m.feeds.filter((f) => f && f.feed_label).map((f) => ({ feedLabel: f.feed_label, lastSeenAt: f.last_seen_at || null })) : []
  };
}
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
  const mins = Math.max(0, Math.floor((now - t) / 6e4));
  if (mins < 1) return "under 1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}
function fmtPollStamp(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return null;
  return `${fmtClockHM(t)} AEST, ${fmtDayMonYear(t)}`;
}
function freshnessView(fr, now = Date.now()) {
  if (!fr || !fr.known) return { known: false, stale: false, pollLine: null, stallText: null };
  const stale = pollIsStale(fr, now);
  const ago = fmtPollAgo(fr.lastPollAt, now);
  const stamp = fmtPollStamp(fr.lastPollAt);
  return {
    known: true,
    stale,
    pollLine: ago ? `Last APH poll ${ago}` : "No APH poll recorded",
    stallText: stale ? `APH polling appears stalled; last successful poll ${stamp || "not recorded"}` : null
  };
}
function useFreshness() {
  const { liveState } = useStore();
  const fr = liveState && liveState.blocks && liveState.blocks.freshness || null;
  return freshnessView(fr);
}
function configuredFeedCount(blocks) {
  const items = blocks && blocks.connectors && Array.isArray(blocks.connectors.items) ? blocks.connectors.items : null;
  if (!items) return null;
  const feeds = items.filter((c) => c && c.isFeed);
  return feeds.length ? feeds.length : null;
}
function useFeedCount() {
  const { liveState } = useStore();
  return configuredFeedCount(liveState && liveState.blocks);
}
function mapThreadItem(row) {
  return {
    id: row.thread_id,
    title: row.title,
    itemCount: row.item_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    signalGuids: Array.isArray(row.signal_guids) ? row.signal_guids : []
  };
}
function mapOneBlock(block, arrayKey, mapFn) {
  if (!block || typeof block !== "object") {
    return { provenance: "fixture", fetchedAt: null, items: null };
  }
  const arr = block[arrayKey];
  const usable = (block.provenance === "live" || block.provenance === "derived") && Array.isArray(arr) && arr.length > 0;
  const out = {
    provenance: block.provenance,
    fetchedAt: block.fetched_at || null,
    items: usable ? arr.map(mapFn) : null
  };
  if (block.note != null) out.note = block.note;
  return out;
}
function mapLiveBlocks(blocks, meta) {
  const b = blocks || {};
  const connectors = mapOneBlock(b.connectors, "checks", mapConnectorCheck);
  const refs = b.connectors && Array.isArray(b.connectors.reference_links) ? b.connectors.reference_links : null;
  connectors.referenceLinks = refs ? refs.filter((u) => typeof u === "string" && safeHttpUrl(u)) : null;
  return {
    freshness: mapLiveFreshness(meta),
    signals: mapOneBlock(b.signals, "items", mapWorkerSignalToCard),
    connectors,
    threads: mapOneBlock(b.threads, "items", mapThreadItem),
    alerts: mapOneBlock(b.alerts, "events", (x) => x),
    qons: mapOneBlock(b.qons, "items", (x) => x),
    // Dedicated desk blocks the Worker does not serve yet (state-v1 carries none).
    // Mapped when present so a later Worker release lights the counts up with no
    // frontend change; absent, they map to items:null and the counts fall back to
    // the signals-derived subset below.
    committees: mapOneBlock(b.committees, "items", (x) => x),
    reports: mapOneBlock(b.reports, "items", (x) => x),
    divisions: mapOneBlock(b.divisions, "items", (x) => x)
  };
}
const COMMITTEE_STRIP_LABELS = /* @__PURE__ */ new Set([
  "Senate reports tabled",
  "New Senate inquiries",
  "Upcoming Senate hearings",
  "House committee inquiries",
  "Joint committee inquiries"
]);
const REPORT_LABELS = /* @__PURE__ */ new Set(["Senate reports tabled"]);
const DIVISION_LABELS = /* @__PURE__ */ new Set(["House divisions"]);
function selectCounts(blocks, liveBills) {
  const b = blocks || {};
  const signals = b.signals && Array.isArray(b.signals.items) ? b.signals.items : null;
  const own = (blk) => blk && Array.isArray(blk.items) ? blk.items.length : null;
  const fromSignals = (labels) => signals ? signals.filter((s) => labels.has(s.source)).length : null;
  const prov = (blk) => blk && Array.isArray(blk.items) ? blk.provenance : null;
  const billsItems = liveBills && Array.isArray(liveBills.items) ? liveBills.items : null;
  const pick = (blk, labels) => {
    var _a;
    return (_a = own(blk)) != null ? _a : fromSignals(labels);
  };
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
      bills: billsItems ? "live" : null
    }
  };
}
function useCounts() {
  const { liveState, liveBills } = useStore();
  return React.useMemo(() => selectCounts(liveState && liveState.blocks, liveBills), [liveState && liveState.blocks, liveBills]);
}
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
function fetchedAtMs(v) {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : NaN;
  if (typeof v !== "string" || !v) return NaN;
  return Date.parse(v);
}
function fmtFetchedAt(v) {
  try {
    const t = fetchedAtMs(v);
    return Number.isNaN(t) ? NOT_SUPPLIED : fmtClockHM(t);
  } catch (e) {
    return NOT_SUPPLIED;
  }
}
function fetchedClause(v) {
  const t = fetchedAtMs(v);
  return Number.isNaN(t) ? "" : `fetched ${fmtClockHM(t)} AEST`;
}
function latestCheckClause(checks) {
  let latest = NaN;
  for (const c of checks || []) {
    const t = fetchedAtMs(c && c.checkedAt);
    if (!Number.isNaN(t) && (Number.isNaN(latest) || t > latest)) latest = t;
  }
  return Number.isNaN(latest) ? "" : `last check ${fmtClockHM(latest)} AEST`;
}
function liveStateDegradation(liveState, now = Date.now()) {
  if (!liveState) return "loading";
  const { status, fetchedAt } = liveState;
  if (fetchedAt == null) return status === "error" ? "error" : "loading";
  if (now - fetchedAt > 30 * 60 * 1e3) return "stale";
  return "ready";
}
function useLiveState(blockName) {
  var _a;
  const { liveState } = useStore();
  const block = ((_a = liveState.blocks) == null ? void 0 : _a[blockName]) || null;
  const items = (block == null ? void 0 : block.items) || null;
  const hasGoodCache = !!(liveState.blocks && Object.values(liveState.blocks).some((b) => b && b.items));
  const liveStale = hasGoodCache && liveState.fetchedAt != null && Date.now() - liveState.fetchedAt > 30 * 60 * 1e3;
  return {
    status: liveState.status,
    items,
    // mapped array, or null
    fetchedAt: (block == null ? void 0 : block.fetchedAt) || null,
    note: (block == null ? void 0 : block.note) || null,
    referenceLinks: (block == null ? void 0 : block.referenceLinks) || null,
    // connectors only (FE-05)
    isRefreshing: liveState.isRefreshing,
    liveStale,
    // cache older than 30 min AND a good cache exists
    // What the chip shows. A block with usable items shows its own provenance
    // ("live" or "derived"); an empty or missing block can never place a Live chip
    // (invariant 2) and falls back to "fixture".
    displayProvenance: items ? block.provenance : block && block.provenance !== "live" && block.provenance !== "derived" ? block.provenance : "fixture"
  };
}
function useLiveBills() {
  const { liveBills } = useStore();
  return {
    status: liveBills.status,
    items: liveBills.items,
    // null (nothing has ever loaded) or an array (maybe empty) once live
    fetchedAt: liveBills.fetchedAt,
    isRefreshing: liveBills.isRefreshing
  };
}
const ATTENTION_DIMS_DEFAULT = ["authority", "recency", "novelty", "scrutiny"];
const ATTENTION_DIM_LABELS = {
  authority: "source authority",
  recency: "recency",
  novelty: "novelty",
  scrutiny: "scrutiny keyword match",
  momentum: "momentum"
};
function scoringDims(explanations) {
  for (const e of explanations || []) {
    const m = String(e || "").match(/Scored on ([a-z ,]+)\./i);
    if (m) {
      const dims = m[1].split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
      if (dims.length) return dims;
    }
  }
  return ATTENTION_DIMS_DEFAULT;
}
function attentionDisclosure(dims = ATTENTION_DIMS_DEFAULT) {
  const words = dims.map((d) => ATTENTION_DIM_LABELS[d] || d);
  const list = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words.join("");
  return `Attention is a transparent heuristic (${list}). It has not yet been validated against practitioner judgement.`;
}
const ATTENTION_WORDS = { high: "High", med: "Medium", low: "Low" };
function attentionWord(level) {
  return ATTENTION_WORDS[level] || null;
}
function confidenceLabel(n) {
  return n == null || n === "" || Number.isNaN(Number(n)) ? "Confidence not scored" : `Confidence ${n} of 5`;
}
function uniformScore(rows, key) {
  var _a;
  if (!Array.isArray(rows) || rows.length < 2) return void 0;
  const first = rows[0] ? (_a = rows[0][key]) != null ? _a : null : null;
  return rows.every((r) => {
    var _a2;
    return ((_a2 = r && r[key]) != null ? _a2 : null) === first;
  }) ? first : void 0;
}
function uniformScoreLine(n, kind, value) {
  if (value == null) return `All ${n} items are currently unscored for ${kind}; the score does not yet separate them.`;
  const level = kind === "confidence" ? confidenceLabel(value) : `${attentionWord(value) || value} attention`;
  return `All ${n} items currently score ${level}; the score does not yet separate them.`;
}
function buildSearchResults(q, { signals, bills, committees, feeds, liveSignals }) {
  const term = String(q || "").trim().toLowerCase();
  if (!term) return null;
  const has = (v) => (v || "").toLowerCase().includes(term);
  const sigSource = signals || [];
  const billSource = bills || [];
  const commSource = committees || [];
  const feedSource = feeds || [];
  const sig = sigSource.filter((s) => has(s.title) || has(s.summary) || has(s.id));
  const billHits = billSource.filter((b) => has(b.title));
  const comm = commSource.filter((c) => [c.name, c.portfolio, c.chamber].some(has));
  const feedHits = feedSource.filter((f) => has(f.name));
  return {
    sig,
    bills: billHits,
    comm,
    feeds: feedHits,
    labels: {
      sig: liveSignals ? `Signals (latest ${sigSource.length} held)` : `Signals (${sigSource.length} held)`,
      bills: bills ? `Bills (latest ${billSource.length} with a Bills Digest)` : "Bills (not loaded)",
      comm: `Committees (${commSource.length} listed)`,
      feeds: `Sources (${feedSource.length} listed feeds)`
    }
  };
}
function StoreProvider({ children, navigate = () => {
} }) {
  const [state, setState] = React.useState(() => {
    try {
      const raw = safeGetLocalStorage("cs-state-v1");
      if (raw) return hydrateState(JSON.parse(raw));
    } catch (e) {
    }
    return { ...STORE_DEFAULTS };
  });
  React.useEffect(() => {
    safeSetLocalStorage("cs-state-v1", JSON.stringify(state));
  }, [state]);
  const [toasts, setToasts] = React.useState([]);
  const toast = React.useCallback((msg, kind = "ok", action = null) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5e3 : 2800);
  }, []);
  const [modal, setModal] = React.useState(null);
  const openModal = React.useCallback((type, id) => setModal({ type, id }), []);
  const closeModal = React.useCallback(() => setModal(null), []);
  const [signalId, setSignalId] = React.useState(null);
  const openSignal = React.useCallback((s) => setSignalId(typeof s === "string" ? s : s == null ? void 0 : s.id), []);
  const closeSignal = React.useCallback(() => setSignalId(null), []);
  const [visibleSignalOrder, setVisibleSignalOrder] = React.useState(null);
  const [signalSearchQuery, setSignalSearchQuery] = React.useState("");
  const [liveState, setLiveState] = React.useState({
    status: "idle",
    // idle | loading | ready | error (skeleton control; only the initial load shows "loading")
    meta: null,
    // { generated_at, worker_version, schema } passthrough
    blocks: null,
    // { signals, connectors, threads, alerts, qons } mapped, see mapLiveBlocks
    fetchedAt: null,
    // ms epoch of the last SUCCESSFUL load; drives the age label and staleness
    isRefreshing: false,
    // a background refetch is in flight; the UI stays on cached data, never skeletons
    lastError: null
    // ms epoch of the last failed fetch; a background failure is silent (no toast)
  });
  const etagRef = React.useRef(null);
  const inFlightRef = React.useRef(false);
  const fetchedAtRef = React.useRef(null);
  const mountedRef = React.useRef(true);
  const pendingLiveRefreshRef = React.useRef(false);
  const requestLiveRefresh = React.useCallback(() => {
    pendingLiveRefreshRef.current = true;
  }, []);
  const consumeLiveRefresh = React.useCallback(() => {
    const pending = pendingLiveRefreshRef.current;
    pendingLiveRefreshRef.current = false;
    return pending;
  }, []);
  const doFetch = React.useCallback(async () => {
    if (location.protocol === "file:") return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLiveState((s) => ({ ...s, status: s.fetchedAt == null ? "loading" : "ready", isRefreshing: true }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8e3);
    try {
      const headers = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      const res = await fetch(`${WORKER_BASE_URL}/state`, { signal: ctrl.signal, headers });
      if (res.status === 304) {
        const now2 = Date.now();
        fetchedAtRef.current = now2;
        if (mountedRef.current) setLiveState((s) => ({ ...s, status: "ready", isRefreshing: false, fetchedAt: now2, lastError: null }));
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const nextEtag = res.headers.get("ETag");
      const payload = await res.json();
      const now = Date.now();
      etagRef.current = nextEtag || null;
      if (mountedRef.current) {
        setLiveState((s) => {
          var _a, _b;
          const nextBlocks = mapLiveBlocks(payload.blocks, payload.meta);
          const merged = mergeLiveBlocks(s.blocks, nextBlocks);
          const signalsFresh = !!(nextBlocks.signals && nextBlocks.signals.items);
          const nextFetchedAt = signalsFresh ? now : s.fetchedAt || null;
          fetchedAtRef.current = nextFetchedAt;
          return {
            ...s,
            status: "ready",
            isRefreshing: false,
            fetchedAt: nextFetchedAt,
            lastError: null,
            meta: (_b = (_a = payload.meta) != null ? _a : s.meta) != null ? _b : null,
            blocks: merged
          };
        });
      }
    } catch (e) {
      if (mountedRef.current) {
        setLiveState((s) => ({ ...s, status: s.fetchedAt != null ? "ready" : "error", isRefreshing: false, lastError: Date.now() }));
      }
      throw e;
    } finally {
      clearTimeout(timer);
      inFlightRef.current = false;
    }
  }, []);
  const refreshLiveState = React.useCallback(() => doFetch(), [doFetch]);
  React.useEffect(() => {
    if (location.protocol === "file:") return;
    mountedRef.current = true;
    doFetch().catch(() => {
    });
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") doFetch().catch(() => {
      });
    }, 5 * 60 * 1e3);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const last = fetchedAtRef.current;
      if (last == null || Date.now() - last > 5 * 60 * 1e3) doFetch().catch(() => {
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [doFetch]);
  React.useEffect(() => {
    window.refreshLiveState = refreshLiveState;
    window.__pulseLiveState = liveState;
  }, [refreshLiveState, liveState]);
  const [liveBills, setLiveBills] = React.useState({
    status: "idle",
    // idle | loading | ready | error
    items: null,
    // null = nothing has ever loaded; array (maybe empty) once one lands
    fetchedAt: null,
    isRefreshing: false,
    lastError: null
  });
  const billsInFlightRef = React.useRef(false);
  const billsMountedRef = React.useRef(true);
  const billsFetchedAtRef = React.useRef(null);
  const doFetchBills = React.useCallback(async () => {
    if (location.protocol === "file:") return;
    if (billsInFlightRef.current) return;
    billsInFlightRef.current = true;
    setLiveBills((s) => ({ ...s, status: s.fetchedAt == null ? "loading" : "ready", isRefreshing: true }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8e3);
    try {
      const res = await fetch(`${WORKER_BASE_URL}/bills?limit=50`, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const payload = await res.json();
      const rows = Array.isArray(payload == null ? void 0 : payload.rows) ? payload.rows : [];
      const now = Date.now();
      billsFetchedAtRef.current = now;
      if (billsMountedRef.current) {
        setLiveBills((s) => ({ ...s, status: "ready", isRefreshing: false, fetchedAt: now, lastError: null, items: rows }));
      }
    } catch (e) {
      if (billsMountedRef.current) {
        setLiveBills((s) => ({ ...s, status: s.fetchedAt != null ? "ready" : "error", isRefreshing: false, lastError: Date.now() }));
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
    doFetchBills().catch(() => {
    });
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") doFetchBills().catch(() => {
      });
    }, 5 * 60 * 1e3);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const last = billsFetchedAtRef.current;
      if (last == null || Date.now() - last > 5 * 60 * 1e3) doFetchBills().catch(() => {
      });
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
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal, signalId]);
  const assignOwner = React.useCallback((entityId, owner) => {
    setState((s) => ({ ...s, owners: { ...s.owners, [entityId]: owner } }));
    toast(`Assigned ${owner} as policy owner`);
  }, [toast]);
  const saveFeedback = React.useCallback((signalId2, label, reason) => {
    setState((s) => ({ ...s, feedback: { ...s.feedback, [signalId2]: { label, reason, ts: Date.now() } } }));
  }, []);
  const unarchive = React.useCallback((signalId2) => {
    setState((s) => {
      const n = { ...s.archived };
      delete n[signalId2];
      return { ...s, archived: n };
    });
  }, []);
  const archive = React.useCallback((signalId2) => {
    var _a, _b;
    let remaining = 0;
    const currentSignals = ((_b = (_a = liveState.blocks) == null ? void 0 : _a.signals) == null ? void 0 : _b.items) || SIGNALS;
    setState((s) => {
      const archived = { ...s.archived, [signalId2]: true };
      remaining = Math.max(0, currentSignals.filter((x) => !archived[x.id]).length);
      return { ...s, archived };
    });
    const msg = remaining > 0 ? `${signalId2} archived \xB7 ${remaining} remaining` : "All signals reviewed";
    toast(msg, "ok", { label: "Undo", fn: () => unarchive(signalId2) });
  }, [toast, unarchive, liveState]);
  const addWatchlist = React.useCallback((key) => {
    let total = 0;
    let already = false;
    setState((s) => {
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
    setState((s) => {
      const watchlistAdds = { ...s.watchlistAdds };
      delete watchlistAdds[key];
      return { ...s, watchlistAdds };
    });
    toast("Removed from watchlist", "brass");
  }, [toast]);
  const createWatchlist = React.useCallback((name) => {
    var _a, _b;
    const keywordList = name.toLowerCase().split(/\s+|&/).map((t) => t.trim()).filter((t) => t.length > 2);
    const currentSignals = ((_b = (_a = liveState.blocks) == null ? void 0 : _a.signals) == null ? void 0 : _b.items) || SIGNALS;
    const matches = watchlistMatches({ name, keywordList }, currentSignals).length;
    const entry = {
      name,
      keywordList,
      keywords: keywordList.length,
      matches,
      trend: [],
      created: true
    };
    setState((s) => ({ ...s, watchlistCreated: [...s.watchlistCreated, entry] }));
    toast(`Watchlist "${name}" created`, "brass");
  }, [toast, liveState]);
  const generateBrief = React.useCallback((signalId2, type) => {
    setState((s) => ({ ...s, briefsGenerated: { ...s.briefsGenerated, [signalId2]: { ts: Date.now(), type } } }));
  }, []);
  const addFeed = React.useCallback((feed) => {
    setState((s) => ({ ...s, feeds: [...s.feeds, feed] }));
    toast(`Feed saved on this device: ${feed.name}`, "brass");
  }, [toast]);
  const saveNote = React.useCallback((signalId2, text) => {
    setState((s) => ({ ...s, notes: { ...s.notes, [signalId2]: text } }));
  }, []);
  const storeValue = React.useMemo(() => ({
    state,
    setState,
    toast,
    toasts,
    modal,
    openModal,
    closeModal,
    signalId,
    openSignal,
    closeSignal,
    visibleSignalOrder,
    setVisibleSignalOrder,
    signalSearchQuery,
    setSignalSearchQuery,
    liveState,
    requestLiveRefresh,
    consumeLiveRefresh,
    refreshLiveState,
    liveStateDegradation,
    liveBills,
    refreshLiveBills,
    navigate,
    assignOwner,
    saveFeedback,
    archive,
    unarchive,
    addWatchlist,
    removeWatchlist,
    isWatched,
    createWatchlist,
    generateBrief,
    addFeed,
    saveNote
  }), [
    state,
    toasts,
    toast,
    modal,
    openModal,
    closeModal,
    signalId,
    openSignal,
    closeSignal,
    visibleSignalOrder,
    signalSearchQuery,
    liveState,
    requestLiveRefresh,
    consumeLiveRefresh,
    refreshLiveState,
    liveBills,
    refreshLiveBills,
    navigate,
    assignOwner,
    saveFeedback,
    archive,
    unarchive,
    addWatchlist,
    removeWatchlist,
    isWatched,
    createWatchlist,
    generateBrief,
    addFeed,
    saveNote
  ]);
  return /* @__PURE__ */ React.createElement(StoreCtx.Provider, { value: storeValue }, children, /* @__PURE__ */ React.createElement("div", { className: "toast-wrap", role: "status", "aria-live": "polite", "aria-atomic": "false" }, toasts.map((t) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: t.id,
      role: t.kind === "error" ? "alert" : void 0,
      "aria-live": t.kind === "error" ? "assertive" : void 0,
      className: "toast" + (t.kind === "error" ? " toast-err" : ""),
      style: {
        border: "1px solid var(--line-bright)",
        borderLeft: "3px solid " + (t.kind === "error" ? "var(--ember-flash)" : "var(--brass)")
      }
    },
    /* @__PURE__ */ React.createElement(
      Icon,
      {
        name: t.kind === "error" ? "close" : "check",
        size: 14,
        stroke: t.kind === "error" ? "var(--ember-flash)" : t.kind === "brass" ? "var(--brass)" : "var(--ok)"
      }
    ),
    /* @__PURE__ */ React.createElement("span", null, t.msg),
    t.action && /* @__PURE__ */ React.createElement("button", { className: "toast-act", onClick: () => {
      t.action.fn();
      setToasts((ts) => ts.filter((x) => x.id !== t.id));
    } }, t.action.label)
  ))));
}
const ABOUT_SECTIONS = ["legal", "privacy", "not-yet-available", "licence", "accessibility"];
function routeDeskIds() {
  return typeof NAV !== "undefined" && Array.isArray(NAV) ? NAV.map((n) => n.id) : [];
}
function decodeRoutePart(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return null;
  }
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
    return ABOUT_SECTIONS.includes(parts[1]) && parts.length === 2 ? { page: "about", section: parts[1] } : { page: "notfound", path: h };
  }
  if (parts.length === 1 || parts.length === 2 && parts[1] === "") {
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
  const n = routeDeskIds().length ? NAV.find((x) => x.id === route.page) : null;
  return n ? n.label : "Page not found";
}
function routeTitle(route) {
  return routeLabel(route) + " \xB7 Parliament Pulse";
}
function migrateLegacyPageQuery(loc, hist) {
  if (!loc || !hist || typeof hist.replaceState !== "function") return null;
  if (loc.hash && loc.hash !== "#" && loc.hash !== "#/") return null;
  let params;
  try {
    params = new URLSearchParams(loc.search || "");
  } catch (e) {
    return null;
  }
  const legacy = params.get("page");
  if (!legacy) return null;
  params.delete("page");
  const rest = params.toString();
  const hash = "#/" + encodeURIComponent(legacy);
  hist.replaceState(hist.state, "", (loc.pathname || "/") + (rest ? "?" + rest : "") + hash);
  return hash;
}
Object.assign(window, { ABOUT_SECTIONS, parseRoute, routeHash, routeLabel, routeTitle, migrateLegacyPageQuery });
Object.assign(window, { StoreProvider, useStore, watchlistKeywords, watchlistMatches, useLiveState, useLiveBills, selectCounts, useCounts, COMMITTEE_STRIP_LABELS, liveStateDegradation, mapWorkerSignalToCard, mapLiveBlocks, fmtFetchedAt, fetchedClause, mapLiveFreshness, freshnessView, useFreshness, pollIsStale, configuredFeedCount, useFeedCount, feedHealthState, signalDateFields, fmtDayMonYear, fmtPollStamp, ATTENTION_DIMS_DEFAULT, scoringDims, attentionDisclosure, attentionWord, confidenceLabel, uniformScore, uniformScoreLine, buildSearchResults });
