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
      return { dateKind: "datetime", time, date: fmtDayMonYear(t), when: time };
    }
    const date2 = fmtDayMonYear(t, "UTC");
    return { dateKind: "date", time: "", date: date2, when: date2 };
  }
  const seen = firstSeenAt ? Date.parse(firstSeenAt) : NaN;
  const date = Number.isNaN(seen) ? "Date not supplied" : `Date not supplied, first seen ${fmtDayMonYear(seen)}`;
  return { dateKind: "none", time: "", date, when: date };
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
function fmtFetchedAt(iso) {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" });
  } catch (e) {
    return "\u2014";
  }
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
    toast(`Feed added: ${feed.name}`, "brass");
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
function DetailModal() {
  const { modal, closeModal, openModal, state, assignOwner, addWatchlist, openSignal } = useStore();
  const prevFocusRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);
  const titleId = React.useId();
  React.useEffect(() => {
    if (!modal) return;
    const h = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [modal, closeModal]);
  React.useEffect(() => {
    if (!modal) return;
    prevFocusRef.current = document.activeElement;
    requestAnimationFrame(() => {
      var _a;
      return (_a = closeButtonRef.current) == null ? void 0 : _a.focus();
    });
    return () => {
      var _a, _b;
      (_b = (_a = prevFocusRef.current) == null ? void 0 : _a.focus) == null ? void 0 : _b.call(_a);
      prevFocusRef.current = null;
    };
  }, [modal]);
  React.useEffect(() => {
    if (!modal) return;
    const trap = (e) => {
      var _a;
      if (e.key !== "Tab") return;
      const modalEl = (_a = closeButtonRef.current) == null ? void 0 : _a.closest(".modal");
      if (!modalEl) return;
      const focusable = Array.from(modalEl.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter((el) => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [modal]);
  if (!modal) return null;
  const { type, id } = modal;
  const render = () => {
    if (type === "committee") return /* @__PURE__ */ React.createElement(CommitteeDetail, { id });
    if (type === "bill") return /* @__PURE__ */ React.createElement(BillDetail, { id });
    if (type === "member") return /* @__PURE__ */ React.createElement(MemberDetail, { id });
    if (type === "minister") return /* @__PURE__ */ React.createElement(MinisterDetail, { id });
    if (type === "division") return /* @__PURE__ */ React.createElement(DivisionDetail, { id });
    if (type === "feed") return /* @__PURE__ */ React.createElement(FeedDetail, { id });
    if (type === "watchlist") return /* @__PURE__ */ React.createElement(WatchlistDetail, { id });
    if (type === "radar") return /* @__PURE__ */ React.createElement(RadarDetail, { id });
    if (type === "inquiry") return /* @__PURE__ */ React.createElement(InquiryDetail, { id });
    if (type === "hearing") return /* @__PURE__ */ React.createElement(HearingDetail, { data: id });
    return /* @__PURE__ */ React.createElement("div", null, "Unknown");
  };
  return /* @__PURE__ */ React.createElement("div", { className: "modal-back", onClick: closeModal }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "modal",
      onClick: (e) => e.stopPropagation(),
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      style: {
        border: "1px solid var(--line-bright)",
        boxShadow: "0 1px 0 #00000060, 0 40px 90px -32px #000000bf, inset 0 0 0 1px #ffffff08"
      }
    },
    React.cloneElement(render(), { titleId, closeButtonRef })
  ));
}
const NOT_HELD = "Not held here \xB7 see APH";
function ModalHead({ kicker, title, right, onClose, representative = false, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return /* @__PURE__ */ React.createElement("div", { className: "modal-head" }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, kicker), representative && SITE_CONFIG.showUnsourcedSurfaces && /* @__PURE__ */ React.createElement("span", { className: "chip-fixture" }, "Sample data")), /* @__PURE__ */ React.createElement("h2", { id: titleId, className: "serif", style: { fontSize: 22, margin: "4px 0 0", fontWeight: 500, lineHeight: 1.25 } }, title)), right, /* @__PURE__ */ React.createElement("button", { ref: closeButtonRef, className: "btn ghost sm", "aria-label": "Close detail", onClick: onClose || closeModal, style: { flex: "none" } }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 14 })));
}
function copyModalText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text).then(() => toast(ok, "brass")).catch(() => toast("Clipboard unavailable: content not copied", "error"));
}
function CommitteeDetail({ id, titleId, closeButtonRef }) {
  var _a, _b, _c, _d;
  const c = ENTITIES.committees[id];
  const { openModal, closeModal, toast, addWatchlist, isWatched } = useStore();
  if (!c) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Committee", title: "Not found", titleId, closeButtonRef });
  const watchKey = `committee:${id}`;
  const watched = isWatched(watchKey);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: `Committee \xB7 ${c.chamber}`, title: c.name, representative: !!c.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, c.bio && /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", marginTop: 0 } }, c.bio), /* @__PURE__ */ React.createElement("dl", { className: "kv", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("dt", null, "Chair"), /* @__PURE__ */ React.createElement("dd", null, c.chair || (c.url ? /* @__PURE__ */ React.createElement("a", { href: "https://www." + c.url.replace(/^https?:\/\/(www\.)?/, ""), target: "_blank", rel: "noopener noreferrer" }, "See current membership at APH \u2192") : "See APH for current membership")), /* @__PURE__ */ React.createElement("dt", null, "Members"), /* @__PURE__ */ React.createElement("dd", null, (_a = c.members) != null ? _a : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Portfolio"), /* @__PURE__ */ React.createElement("dd", null, (_b = c.portfolio) != null ? _b : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Active inquiries"), /* @__PURE__ */ React.createElement("dd", null, (_c = c.active) != null ? _c : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Reports (30d)"), /* @__PURE__ */ React.createElement("dd", null, (_d = c.recentReports) != null ? _d : NOT_HELD), /* @__PURE__ */ React.createElement("dt", null, "Source"), /* @__PURE__ */ React.createElement("dd", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, c.url)), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 22, marginBottom: 8 } }, "Upcoming & today's hearings"), /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no verified hearing schedule for this committee, because APH publishes hearing programmes on the committee page rather than as a machine-readable feed. See the current schedule at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "aph.gov.au/Parliamentary_Business/Committees ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), "."), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 22, marginBottom: 8 } }, "Open inquiries"), c.inquiries.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, c.inquiries.map((q, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "tag clk", onClick: () => openModal("inquiry", q) }, q))) : /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no verified inquiry list for this committee. See the committee's own page on aph.gov.au for its current inquiries.")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyModalText(`# Committee prep pack
Committee: ${c.name}
Chamber: ${c.chamber}
Open inquiries: ${c.inquiries.join("; ")}
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Committee prep pack copied");
    closeModal();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Prep pack"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => addWatchlist(watchKey), style: watched ? { borderColor: "var(--brass)", color: "var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " ", watched ? "Watching committee" : "Watch committee"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function HearingDetail({ data, titleId, closeButtonRef }) {
  const { closeModal, toast } = useStore();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Hearing", title: data.topic, representative: true, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "Committee"), /* @__PURE__ */ React.createElement("dd", null, data.committee), /* @__PURE__ */ React.createElement("dt", null, "When"), /* @__PURE__ */ React.createElement("dd", null, data.when), /* @__PURE__ */ React.createElement("dt", null, "Room"), /* @__PURE__ */ React.createElement("dd", null, data.room), /* @__PURE__ */ React.createElement("dt", null, "Broadcast"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("a", { href: "https://parlview.aph.gov.au/", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "ParlView ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 8 } }, "Witnesses"), /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no verified witness list for this hearing, because APH publishes witness lists as hearing programmes on the committee page rather than as a machine-readable feed. See the real hearing programme at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "aph.gov.au/Parliamentary_Business/Committees ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), ".")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyModalText(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Parliament Pulse//Live Beta//EN
BEGIN:VEVENT
SUMMARY:${data.topic}
LOCATION:${data.room}
DESCRIPTION:${data.committee} hearing. Verify time against APH before importing.
END:VEVENT
END:VCALENDAR`, toast, "Calendar stub copied");
    closeModal();
  } }, "Copy calendar stub"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => {
    copyModalText(`# Hearing prep note
Topic: ${data.topic}
Committee: ${data.committee}
When: ${data.when}
Room: ${data.room}

Parliament Pulse holds no verified witness list for this hearing. See the real hearing programme at https://www.aph.gov.au/Parliamentary_Business/Committees`, toast, "Prep note copied");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Generate prep note")));
}
function InquiryDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state, assignOwner } = useStore();
  const name = typeof id === "string" ? id : id == null ? void 0 : id.name;
  const [owner, setOwner] = React.useState(state.owners[name] || "");
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Inquiry", title: name, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no verified detail for this inquiry, because APH publishes no machine-readable feed of inquiry terms of reference. See the real committee page at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Parliamentary_Business/Committees", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "aph.gov.au/Parliamentary_Business/Committees ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), "."), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 8 } }, "Assign owner"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("input", { "aria-label": "Owner name", value: owner, onChange: (e) => setOwner(e.target.value), placeholder: "Owner name", className: "search", style: { padding: "7px 10px", flex: 1 } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (owner.trim()) {
      assignOwner(name, owner.trim());
    }
  } }, "Assign")), state.owners[name] && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 12.5, color: "var(--ok)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 13, style: { verticalAlign: "-2px", marginRight: 4 } }), "Owner: ", /* @__PURE__ */ React.createElement("strong", null, state.owners[name]))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => copyModalText(`# Submission starter
Inquiry: ${name}
Owner: ${state.owners[name] || owner || "Unassigned"}
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Submission starter copied") }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Start submission"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function BillDetail({ id, titleId, closeButtonRef }) {
  const b = ENTITIES.bills[id];
  const { closeModal, toast, state, assignOwner, openModal, addWatchlist, isWatched } = useStore();
  const [owner, setOwner] = React.useState(state.owners[id] || ((b == null ? void 0 : b.owner) === "\u2014" ? "" : (b == null ? void 0 : b.owner) || ""));
  if (!b) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Bill", title: "Not found", titleId, closeButtonRef });
  const min = ENTITIES.ministers[b.minister];
  const watchKey = `bill:${id}`;
  const watched = isWatched(watchKey);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: `Bill \xB7 ${b.ref}`, title: b.title, representative: !!b.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(Att, { level: b.att }), /* @__PURE__ */ React.createElement("span", { className: "tag" }, b.portfolio), /* @__PURE__ */ React.createElement("span", { className: "tag teal" }, b.stage), b.digest === "Published" && /* @__PURE__ */ React.createElement("span", { className: "tag teal" }, "Digest published")), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: 6 } }, "Purpose"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0, color: "var(--ink-2)" } }, b.purpose), b.provisions.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Key provisions"), /* @__PURE__ */ React.createElement("ul", { style: { margin: 0, paddingLeft: 18, color: "var(--ink-2)" } }, b.provisions.map((p, i) => /* @__PURE__ */ React.createElement("li", { key: i }, p)))), b.stageHistory.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Timeline"), /* @__PURE__ */ React.createElement("div", { className: "timeline" }, b.stageHistory.map((h, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "tl-item" }, /* @__PURE__ */ React.createElement("div", { className: "tl-time" }, h.when), /* @__PURE__ */ React.createElement("div", { className: "tl-body" }, h.event))))), min && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Responsible minister"), /* @__PURE__ */ React.createElement("span", { className: "tag clk brass", onClick: () => openModal("minister", b.minister) }, min.name)), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Matching watchlists"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, b.watchlists.map((w) => /* @__PURE__ */ React.createElement("span", { key: w, className: "tag brass" }, w))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Assign policy owner"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("input", { "aria-label": "Owner name", value: owner, onChange: (e) => setOwner(e.target.value), placeholder: "Owner name", className: "search", style: { padding: "7px 10px", flex: 1 } }), /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (owner.trim()) assignOwner(id, owner.trim());
  } }, "Assign")), state.owners[id] && /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8, fontSize: 12.5, color: "var(--ok)" } }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 13, style: { verticalAlign: "-2px", marginRight: 4 } }), "Owner: ", /* @__PURE__ */ React.createElement("strong", null, state.owners[id]))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    copyModalText(`# Bill brief
Bill: ${b.title}
Reference: ${b.ref}
Stage: ${b.stage}
Portfolio: ${b.portfolio}

Purpose:
${b.purpose}

Key provisions:
${b.provisions.map((p) => `- ${p}`).join("\n") || "- Not recorded"}

Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`, toast, "Bill brief copied");
    closeModal();
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "brief", size: 13 }), " Draft bill brief"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => addWatchlist(watchKey), style: watched ? { borderColor: "var(--brass)", color: "var(--brass)" } : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "watch", size: 13 }), " ", watched ? "Tracking bill" : "Track bill")));
}
function MemberDetail({ id, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Member", title: "No member profile held", titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Parliament Pulse holds no senator or member profiles, because no live source of member records is connected. Look up current senators and members at", " ", /* @__PURE__ */ React.createElement("a", { href: "https://www.aph.gov.au/Senators_and_Members", target: "_blank", rel: "noopener noreferrer", style: { color: "var(--teal)" } }, "aph.gov.au/Senators_and_Members ", /* @__PURE__ */ React.createElement(Icon, { name: "ext", size: 11, style: { verticalAlign: "-1px" } })), ".")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function MinisterDetail({ id, titleId, closeButtonRef }) {
  const m = ENTITIES.ministers[id];
  const { closeModal } = useStore();
  if (!m) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Minister", title: "Not found", titleId, closeButtonRef });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: m.role, title: m.name, representative: !!m.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", marginTop: 0 } }, m.bio), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 14, marginBottom: 6 } }, "Recent signals"), /* @__PURE__ */ React.createElement("ul", { style: { margin: 0, paddingLeft: 18, color: "var(--ink-2)" } }, m.recent.map((r, i) => /* @__PURE__ */ React.createElement("li", { key: i }, r)))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function DivisionDetail({ id, titleId, closeButtonRef }) {
  var _a, _b;
  const d = DIVISIONS.find((x) => x.bill === (id == null ? void 0 : id.bill) && x.when === (id == null ? void 0 : id.when)) || id;
  const { closeModal, openModal } = useStore();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Division", title: d.q, representative: !!d.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "When"), /* @__PURE__ */ React.createElement("dd", null, d.when), /* @__PURE__ */ React.createElement("dt", null, "Chamber"), /* @__PURE__ */ React.createElement("dd", null, d.chamber), /* @__PURE__ */ React.createElement("dt", null, "Result"), /* @__PURE__ */ React.createElement("dd", { style: { color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)" } }, d.result), /* @__PURE__ */ React.createElement("dt", null, "Related bill"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("span", { className: "tag clk brass", onClick: () => openModal("bill", d.bill) }, d.bill))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 16, marginBottom: 8 } }, "Vote breakdown"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px solid var(--line-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--ok)" } }, "AYES"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontFamily: "var(--serif)" } }, ((_a = d.result.match(/\d+/)) == null ? void 0 : _a[0]) || "\u2014")), /* @__PURE__ */ React.createElement("div", { style: { padding: 12, border: "1px solid var(--line-2)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10, color: "var(--escalate)" } }, "NOES"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 22, fontFamily: "var(--serif)" } }, ((_b = d.result.match(/\d+/g)) == null ? void 0 : _b[1]) || "\u2014")))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function FeedDetail({ id, titleId, closeButtonRef }) {
  var _a;
  const f = APH_FEEDS.find((x) => x.id === id);
  const { closeModal, toast } = useStore();
  if (!f) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Feed", title: "Not found", titleId, closeButtonRef });
  const status = f.lastStatusCode != null ? f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error" : "\u2014";
  const parser = f.parser || "\u2014";
  const last = f.last || "\u2014";
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: `Source \xB7 ${f.group}`, title: f.name, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("dl", { className: "kv" }, /* @__PURE__ */ React.createElement("dt", null, "URL"), /* @__PURE__ */ React.createElement("dd", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)", wordBreak: "break-all" } }, f.url), /* @__PURE__ */ React.createElement("dt", null, "Status"), /* @__PURE__ */ React.createElement("dd", null, status), /* @__PURE__ */ React.createElement("dt", null, "Authority"), /* @__PURE__ */ React.createElement("dd", null, f.authority), /* @__PURE__ */ React.createElement("dt", null, "Confidence"), /* @__PURE__ */ React.createElement("dd", null, f.confidence), /* @__PURE__ */ React.createElement("dt", null, "Parser"), /* @__PURE__ */ React.createElement("dd", null, parser), /* @__PURE__ */ React.createElement("dt", null, "Last refresh"), /* @__PURE__ */ React.createElement("dd", { className: "mono" }, last), /* @__PURE__ */ React.createElement("dt", null, "Items today"), /* @__PURE__ */ React.createElement("dd", { className: "mono" }, (_a = f.today) != null ? _a : "\u2014"), /* @__PURE__ */ React.createElement("dt", null, "False positive"), /* @__PURE__ */ React.createElement("dd", { title: FPR_PENDING_NOTE }, "\u2014 ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--ink-4)" } }, FPR_PENDING_NOTE)), /* @__PURE__ */ React.createElement("dt", null, "Modules"), /* @__PURE__ */ React.createElement("dd", null, f.modules.join(", "))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 16, marginBottom: 8 } }, "Recent items"), /* @__PURE__ */ React.createElement("div", { className: "empty" }, "\u2014")), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn primary", onClick: () => {
    if (typeof window.__refreshLiveFeeds === "function") {
      window.__refreshLiveFeeds();
      toast(`${f.name} refresh requested`, "brass");
    } else toast("Open Live parliament to start the feed poller", "brass");
  } }, /* @__PURE__ */ React.createElement(Icon, { name: "refresh", size: 13 }), " Re-fetch now"), /* @__PURE__ */ React.createElement("button", { className: "btn", title: "Copy parser checklist for this feed", onClick: () => copyModalText(`# Parser checklist
Feed: ${f.name}
URL: ${f.url}
Parser: ${parser}
Last refresh: ${last}

Checks:
- HTTP status is 2xx
- XML item count is non-zero when source publishes
- Title, date, link and description map cleanly
- Module routing matches: ${f.modules.join(", ")}`, toast, "Parser checklist copied") }, "Copy parser checklist"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", style: { marginLeft: "auto" }, onClick: closeModal }, "Close")));
}
function WatchlistDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state } = useStore();
  const all = [...WATCHLISTS, ...state.watchlistCreated || []];
  const w = all.find((x) => x.name === id);
  if (!w) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Watchlist", title: "Not found", titleId, closeButtonRef });
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  const matchingAll = watchlistMatches(w, matchSource);
  const matchingSignals = matchingAll.slice(0, 3);
  const keywordList = watchlistKeywords(w);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: w.created ? "Watchlist \xB7 New" : "Watchlist", title: w.name, representative: !!w.representative, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, w.created && /* @__PURE__ */ React.createElement("div", { className: "empty", style: { marginBottom: 14 } }, "Created watchlist. Keyword matching runs against the current signal stream. Trend builds as new signals arrive."), /* @__PURE__ */ React.createElement("div", { className: "grid g-3", style: { gap: 12 } }, /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Matches"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 26 } }, matchingAll.length)), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Keywords"), /* @__PURE__ */ React.createElement("div", { className: "stat-value", style: { fontSize: 26 } }, keywordList.length)), /* @__PURE__ */ React.createElement("div", { className: "panel stat" }, /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Trend history"), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { marginTop: 8, color: "var(--ink-4)", fontSize: 11 } }, "Not held \u2014 Parliament Pulse does not yet track watchlist matches over time."))), /* @__PURE__ */ React.createElement("h3", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".16em", marginTop: 18, marginBottom: 6 } }, "Matching signals"), matchingSignals.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty" }, "No matching signals in the current stream."), matchingSignals.map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, style: { padding: "8px 12px", border: "1px solid var(--line-2)", borderRadius: 8, marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 500 } }, s.title), /* @__PURE__ */ React.createElement("div", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)", marginTop: 2 } }, s.id, " \xB7 ", s.source)))), /* @__PURE__ */ React.createElement("div", { className: "modal-foot" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => {
    copyModalText(`# Watchlist digest
Watchlist: ${w.name}
Matches: ${matchingAll.length}
Keywords: ${keywordList.join(", ")}

Matching signals:
${matchingSignals.map((s) => `- ${s.id}: ${s.title}`).join("\n") || "- No matching signals in the current stream."}`, toast, "Watchlist digest copied");
    closeModal();
  } }, "Copy digest"), /* @__PURE__ */ React.createElement("button", { className: "btn", onClick: () => toast("Configuration saved locally") }, "Save config")));
}
function RadarDetail({ id, titleId, closeButtonRef }) {
  const r = RADAR.find((x) => x.group === id);
  if (!r) return /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Source group", title: "Not found", titleId, closeButtonRef });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ModalHead, { kicker: "Activity by source", title: r.group, titleId, closeButtonRef }), /* @__PURE__ */ React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } }, /* @__PURE__ */ React.createElement(Att, { level: r.att }), /* @__PURE__ */ React.createElement("span", { className: "tag" }, r.count, " items from ", r.sources, " feed", r.sources !== 1 ? "s" : "")), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--ink-2)", marginTop: 0 } }, attentionDisclosure())));
}
Object.assign(window, { StoreProvider, useStore, DetailModal, watchlistKeywords, watchlistMatches, useLiveState, useLiveBills, selectCounts, useCounts, COMMITTEE_STRIP_LABELS, liveStateDegradation, mapWorkerSignalToCard, mapLiveBlocks, fmtFetchedAt, mapLiveFreshness, freshnessView, useFreshness, pollIsStale, configuredFeedCount, useFeedCount, feedHealthState, signalDateFields, fmtDayMonYear, fmtPollStamp, ATTENTION_DIMS_DEFAULT, scoringDims, attentionDisclosure, attentionWord, confidenceLabel, uniformScore, uniformScoreLine, buildSearchResults });
