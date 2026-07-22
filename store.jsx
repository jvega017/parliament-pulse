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
function watchlistMatches(w, signals = (typeof SIGNALS !== "undefined" ? SIGNALS : [])) {
  const terms = watchlistKeywords(w);
  if (!Array.isArray(signals)) return [];
  return signals.filter(s => {
    const title = (s.title || "").toLowerCase();
    const tagHit = (s.tags || []).some(t => {
      const label = (t.l || "").toLowerCase();
      return terms.some(term => label.includes(term.toLowerCase()));
    });
    const titleHit = terms.some(term => title.includes(term.toLowerCase()));
    return tagHit || titleHit;
  });
}

// ---- Live /state mappers (module scope) ----
// Worker snake_case -> frontend fields. Every worker field is Verified from
// docs/state-contract.md. Mapping may rename and derive; it never fabricates a
// field. action/score/provenance-trail/updates stay undefined for live items;
// existing consumers guard on their presence.

// signals.items[] -> signal card shape. Moved from pages.jsx unchanged, then
// extended with the two new fields (link, isLive) marked NEW in the spec table.
function mapWorkerSignalToCard(row) {
  const when = row.pub_date ? new Date(row.pub_date) : null;
  // Validate the APH deep link once (safeHttpUrl enforces an aph.gov.au host) and
  // reuse that single validated value for both the title anchor and the evidence
  // link, so evidence can never keep a raw, unvalidated or non-APH URL.
  const link = safeHttpUrl(row.link);
  return {
    id: row.guid,
    time: when ? `${String(when.getHours()).padStart(2,"0")}:${String(when.getMinutes()).padStart(2,"0")}` : "—",
    date: when ? when.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—",
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
function mapConnectorCheck(row) {
  const registry = (typeof SOURCE_REGISTRY !== "undefined" && Array.isArray(SOURCE_REGISTRY)) ? SOURCE_REGISTRY : [];
  const reg = registry.find(r => r.url === row.url);
  const stripped = String(row.url || "").replace(/^https?:\/\/(www\.)?/, "");
  return {
    url: row.url,
    checkedAt: row.checked_at,
    ok: !!row.ok,                                // live sample carries 1; coerce truthy
    httpStatus: row.status,
    error: row.error,
    label: reg?.label || stripped,
    group: reg?.group || "Worker",
  };
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
function mapLiveBlocks(blocks) {
  const b = blocks || {};
  return {
    signals: mapOneBlock(b.signals, "items", mapWorkerSignalToCard),
    connectors: mapOneBlock(b.connectors, "checks", mapConnectorCheck),
    threads: mapOneBlock(b.threads, "items", mapThreadItem),
    alerts: mapOneBlock(b.alerts, "events", x => x),
    qons: mapOneBlock(b.qons, "items", x => x),
  };
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
// themselves, so this returns only the clock component.
function fmtFetchedAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" });
  } catch {
    return "—";
  }
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
    fetchedAt: liveBills.fetchedAt,
    isRefreshing: liveBills.isRefreshing,
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
  // dedupes concurrent fetches; fetchedAtRef mirrors liveState.fetchedAt so the
  // visibility handler reads a fresh value without a stale closure.
  const etagRef = React.useRef(null);
  const inFlightRef = React.useRef(false);
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
  const doFetch = React.useCallback(async () => {
    if (location.protocol === "file:") return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
          const nextBlocks = mapLiveBlocks(payload.blocks);
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
      inFlightRef.current = false;
    }
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
      const res = await fetch(`${WORKER_BASE_URL}/bills?limit=50`, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const payload = await res.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const now = Date.now();
      billsFetchedAtRef.current = now;
      if (billsMountedRef.current) {
        setLiveBills(s => ({ ...s, status: "ready", isRefreshing: false, fetchedAt: now, lastError: null, items: rows }));
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
    toast(`Feed added: ${feed.name}`, "brass");
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

// ---- Detail Modal: renders per entity type ----
function DetailModal() {
  const { modal, closeModal, openModal, state, assignOwner, addWatchlist, openSignal } = useStore();
  const prevFocusRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!modal) return;
    const h = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeModal(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [modal, closeModal]);

  React.useEffect(() => {
    if (!modal) return;
    prevFocusRef.current = document.activeElement;
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      prevFocusRef.current?.focus?.();
      prevFocusRef.current = null;
    };
  }, [modal]);

  React.useEffect(() => {
    if (!modal) return;
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const modalEl = closeButtonRef.current?.closest(".modal");
      if (!modalEl) return;
      const focusable = Array.from(modalEl.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter(el => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [modal]);

  if (!modal) return null;
  const { type, id } = modal;

  const render = () => {
    if (type === "committee") return <CommitteeDetail id={id} />;
    if (type === "bill") return <BillDetail id={id} />;
    if (type === "member") return <MemberDetail id={id} />;
    if (type === "minister") return <MinisterDetail id={id} />;
    if (type === "division") return <DivisionDetail id={id} />;
    if (type === "feed") return <FeedDetail id={id} />;
    if (type === "watchlist") return <WatchlistDetail id={id} />;
    if (type === "radar") return <RadarDetail id={id} />;
    if (type === "inquiry") return <InquiryDetail id={id} />;
    if (type === "hearing") return <HearingDetail data={id} />;
    return <div>Unknown</div>;
  };

  return (
    <div className="modal-back" onClick={closeModal}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          border: "1px solid var(--line-bright)",
          boxShadow: "0 1px 0 #00000060, 0 40px 90px -32px #000000bf, inset 0 0 0 1px #ffffff08",
        }}
      >
        {React.cloneElement(render(), { titleId, closeButtonRef })}
      </div>
    </div>
  );
}

function ModalHead({ kicker, title, right, onClose, representative = false, titleId, closeButtonRef }) {
  const { closeModal } = useStore();
  return (
    <div className="modal-head">
      <div style={{flex:1}}>
        <div className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
          <span>{kicker}</span>
          {representative && <span className="chip-fixture">Representative data</span>}
        </div>
        <h2 id={titleId} className="serif" style={{fontSize:22, margin:"4px 0 0", fontWeight:500, lineHeight:1.25}}>{title}</h2>
      </div>
      {right}
      <button ref={closeButtonRef} className="btn ghost sm" aria-label="Close detail" onClick={onClose || closeModal} style={{flex:"none"}}><Icon name="close" size={14}/></button>
    </div>
  );
}

function copyModalText(text, toast, ok = "Copied to clipboard") {
  return copyToClipboard(text)
    .then(() => toast(ok, "brass"))
    .catch(() => toast("Clipboard unavailable: content not copied", "error"));
}

function CommitteeDetail({ id, titleId, closeButtonRef }) {
  const c = ENTITIES.committees[id];
  const { openModal, closeModal, toast, addWatchlist, isWatched } = useStore();
  if (!c) return <ModalHead kicker="Committee" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const watchKey = `committee:${id}`;
  const watched = isWatched(watchKey);
  return (
    <>
      <ModalHead kicker={`Committee · ${c.chamber}`} title={c.name} representative={!!c.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{c.bio}</p>
        <dl className="kv" style={{marginTop:14}}>
          <dt>Chair</dt><dd>{c.chair || (c.url ? <a href={"https://www." + c.url.replace(/^https?:\/\/(www\.)?/, "")} target="_blank" rel="noopener noreferrer">See current membership at APH →</a> : "See APH for current membership")}</dd>
          <dt>Members</dt><dd>{c.members}</dd>
          <dt>Portfolio</dt><dd>{c.portfolio}</dd>
          <dt>Active inquiries</dt><dd>{c.active}</dd>
          <dt>Reports (30d)</dt><dd>{c.recentReports}</dd>
          <dt>Source</dt><dd className="mono" style={{fontSize:11, color:"var(--ink-3)"}}>{c.url}</dd>
        </dl>

        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:22, marginBottom:8}}>Upcoming & today's hearings</h3>
        <div className="empty">
          Parliament Pulse holds no verified hearing schedule for this committee, because APH publishes hearing programmes on the committee page rather than as a machine-readable feed. See the current schedule at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>aph.gov.au/Parliamentary_Business/Committees <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>

        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:22, marginBottom:8}}>Open inquiries</h3>
        <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
          {c.inquiries.map((q, i) => (
            <span key={i} className="tag clk" onClick={() => openModal("inquiry", q)}>{q}</span>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`# Committee prep pack\nCommittee: ${c.name}\nChamber: ${c.chamber}\nOpen inquiries: ${c.inquiries.join("; ")}\nGenerated: ${new Date().toISOString()}`, toast, "Committee prep pack copied");
          closeModal();
        }}><Icon name="brief" size={13}/> Prep pack</button>
        <button className="btn" onClick={() => addWatchlist(watchKey)} style={watched ? {borderColor:"var(--brass)", color:"var(--brass)"} : undefined}><Icon name="watch" size={13}/> {watched ? "Watching committee" : "Watch committee"}</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function HearingDetail({ data, titleId, closeButtonRef }) {
  const { closeModal, toast } = useStore();
  return (
    <>
      <ModalHead kicker="Hearing" title={data.topic} representative titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <dl className="kv">
          <dt>Committee</dt><dd>{data.committee}</dd>
          <dt>When</dt><dd>{data.when}</dd>
          <dt>Room</dt><dd>{data.room}</dd>
          <dt>Broadcast</dt><dd><a href="https://parlview.aph.gov.au/" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>ParlView <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a></dd>
        </dl>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Witnesses</h3>
        <div className="empty">
          Parliament Pulse holds no verified witness list for this hearing, because APH publishes witness lists as hearing programmes on the committee page rather than as a machine-readable feed. See the real hearing programme at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>aph.gov.au/Parliamentary_Business/Committees <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Parliament Pulse//Live Beta//EN\nBEGIN:VEVENT\nSUMMARY:${data.topic}\nLOCATION:${data.room}\nDESCRIPTION:${data.committee} hearing. Verify time against APH before importing.\nEND:VEVENT\nEND:VCALENDAR`, toast, "Calendar stub copied");
          closeModal();
        }}>Copy calendar stub</button>
        <button className="btn" onClick={() => {
          copyModalText(`# Hearing prep note\nTopic: ${data.topic}\nCommittee: ${data.committee}\nWhen: ${data.when}\nRoom: ${data.room}\n\nParliament Pulse holds no verified witness list for this hearing. See the real hearing programme at https://www.aph.gov.au/Parliamentary_Business/Committees`, toast, "Prep note copied");
        }}><Icon name="brief" size={13}/> Generate prep note</button>
      </div>
    </>
  );
}

function InquiryDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state, assignOwner } = useStore();
  const name = typeof id === "string" ? id : id?.name;
  const [owner, setOwner] = React.useState(state.owners[name] || "");
  return (
    <>
      <ModalHead kicker="Inquiry" title={name} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div className="empty">
          Parliament Pulse holds no verified detail for this inquiry, because APH publishes no machine-readable feed of inquiry terms of reference. See the real committee page at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Committees" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>aph.gov.au/Parliamentary_Business/Committees <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Assign owner</h3>
        <div style={{display:"flex", gap:8}}>
          <input aria-label="Owner name" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner name" className="search" style={{padding:"7px 10px", flex:1}}/>
          <button className="btn primary" onClick={() => { if (owner.trim()) { assignOwner(name, owner.trim()); } }}>Assign</button>
        </div>
        {state.owners[name] && <div style={{marginTop:8, fontSize:12.5, color:"var(--ok)"}}><Icon name="check" size={13} style={{verticalAlign:"-2px", marginRight:4}}/>Owner: <strong>{state.owners[name]}</strong></div>}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => copyModalText(`# Submission starter\nInquiry: ${name}\nOwner: ${state.owners[name] || owner || "Unassigned"}\nGenerated: ${new Date().toISOString()}`, toast, "Submission starter copied")}><Icon name="brief" size={13}/> Start submission</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function BillDetail({ id, titleId, closeButtonRef }) {
  const b = ENTITIES.bills[id];
  const { closeModal, toast, state, assignOwner, openModal, addWatchlist, isWatched } = useStore();
  const [owner, setOwner] = React.useState(state.owners[id] || (b?.owner === "—" ? "" : b?.owner || ""));
  if (!b) return <ModalHead kicker="Bill" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const min = ENTITIES.ministers[b.minister];
  const watchKey = `bill:${id}`;
  const watched = isWatched(watchKey);
  return (
    <>
      <ModalHead kicker={`Bill · ${b.ref}`} title={b.title} representative={!!b.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
          <Att level={b.att}/>
          <span className="tag">{b.portfolio}</span>
          <span className="tag teal">{b.stage}</span>
          {b.digest === "Published" && <span className="tag teal">Digest published</span>}
        </div>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginBottom:6}}>Purpose</h3>
        <p style={{margin:0, color:"var(--ink-2)"}}>{b.purpose}</p>

        {b.provisions.length > 0 && <>
          <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Key provisions</h3>
          <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>{b.provisions.map((p,i) => <li key={i}>{p}</li>)}</ul>
        </>}

        {b.stageHistory.length > 0 && <>
          <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Timeline</h3>
          <div className="timeline">
            {b.stageHistory.map((h,i) => (
              <div key={i} className="tl-item">
                <div className="tl-time">{h.when}</div>
                <div className="tl-body">{h.event}</div>
              </div>
            ))}
          </div>
        </>}

        {min && <>
          <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Responsible minister</h3>
          <span className="tag clk brass" onClick={() => openModal("minister", b.minister)}>{min.name}</span>
        </>}

        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Matching watchlists</h3>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>{b.watchlists.map(w => <span key={w} className="tag brass">{w}</span>)}</div>

        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Assign policy owner</h3>
        <div style={{display:"flex", gap:8}}>
          <input aria-label="Owner name" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner name" className="search" style={{padding:"7px 10px", flex:1}}/>
          <button className="btn primary" onClick={() => { if (owner.trim()) assignOwner(id, owner.trim()); }}>Assign</button>
        </div>
        {state.owners[id] && <div style={{marginTop:8, fontSize:12.5, color:"var(--ok)"}}><Icon name="check" size={13} style={{verticalAlign:"-2px", marginRight:4}}/>Owner: <strong>{state.owners[id]}</strong></div>}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`# Bill brief\nBill: ${b.title}\nReference: ${b.ref}\nStage: ${b.stage}\nPortfolio: ${b.portfolio}\n\nPurpose:\n${b.purpose}\n\nKey provisions:\n${b.provisions.map(p => `- ${p}`).join("\n") || "- Not recorded"}\n\nGenerated: ${new Date().toISOString()}`, toast, "Bill brief copied");
          closeModal();
        }}><Icon name="brief" size={13}/> Draft bill brief</button>
        <button className="btn" onClick={() => addWatchlist(watchKey)} style={watched ? {borderColor:"var(--brass)", color:"var(--brass)"} : undefined}><Icon name="watch" size={13}/> {watched ? "Tracking bill" : "Track bill"}</button>
      </div>
    </>
  );
}

function MemberDetail({ id, titleId, closeButtonRef }) {
  const m = ENTITIES.members[id];
  const { closeModal, addWatchlist, isWatched } = useStore();
  if (!m) return <ModalHead kicker="Member" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const watchKey = `member:${id}`;
  const watched = isWatched(watchKey);
  return (
    <>
      <ModalHead kicker={`${m.party} · ${m.state}`} title={m.name} representative={!!m.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{m.bio}</p>
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:4}}>
          {m.roles.map((r,i) => <span key={i} className="tag">{r}</span>)}
        </div>
        <div className="grid g-3" style={{marginTop:16, gap:12}}>
          <div className="panel stat"><div className="stat-label">QONs (30d)</div><div className="stat-value" style={{fontSize:26}}>{m.qons}</div></div>
          <div className="panel stat"><div className="stat-label">Hansard mentions</div><div className="stat-value" style={{fontSize:26}}>{m.hansard}</div></div>
          <div className="panel stat"><div className="stat-label">Committees</div><div className="stat-value" style={{fontSize:26}}>{m.committees.length}</div></div>
        </div>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Recent activity</h3>
        <div className="empty">
          Parliament Pulse holds no verified activity log for this member, because Hansard and Questions on Notice records are not yet wired to a live feed. See Hansard search at{" "}
          <a href="https://www.aph.gov.au/Parliamentary_Business/Hansard" target="_blank" rel="noopener noreferrer" style={{color:"var(--teal)"}}>aph.gov.au/Parliamentary_Business/Hansard <Icon name="ext" size={11} style={{verticalAlign:"-1px"}}/></a>.
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => { addWatchlist(watchKey); closeModal(); }} style={watched ? {borderColor:"var(--brass)", color:"var(--brass)"} : undefined}>{watched ? "Tracking member" : "Track member"}</button>
      </div>
    </>
  );
}

function MinisterDetail({ id, titleId, closeButtonRef }) {
  const m = ENTITIES.ministers[id];
  const { closeModal } = useStore();
  if (!m) return <ModalHead kicker="Minister" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  return (
    <>
      <ModalHead kicker={m.role} title={m.name} representative={!!m.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <p style={{color:"var(--ink-2)", marginTop:0}}>{m.bio}</p>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:14, marginBottom:6}}>Recent signals</h3>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>{m.recent.map((r,i) => <li key={i}>{r}</li>)}</ul>
      </div>
      <div className="modal-foot"><button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button></div>
    </>
  );
}

function DivisionDetail({ id, titleId, closeButtonRef }) {
  const d = DIVISIONS.find(x => x.bill === id?.bill && x.when === id?.when) || id;
  const { closeModal, openModal } = useStore();
  return (
    <>
      <ModalHead kicker="Division" title={d.q} representative={!!d.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <dl className="kv">
          <dt>When</dt><dd>{d.when}</dd>
          <dt>Chamber</dt><dd>{d.chamber}</dd>
          <dt>Result</dt><dd style={{color: d.result.startsWith("Agreed") ? "var(--ok)" : "var(--escalate)"}}>{d.result}</dd>
          <dt>Related bill</dt><dd><span className="tag clk brass" onClick={() => openModal("bill", d.bill)}>{d.bill}</span></dd>
        </dl>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:16, marginBottom:8}}>Vote breakdown</h3>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div style={{padding:12, border:"1px solid var(--line-2)", borderRadius:8}}>
            <div className="mono" style={{fontSize:10, color:"var(--ok)"}}>AYES</div>
            <div style={{fontSize:22, fontFamily:"var(--serif)"}}>{d.result.match(/\d+/)?.[0] || "—"}</div>
          </div>
          <div style={{padding:12, border:"1px solid var(--line-2)", borderRadius:8}}>
            <div className="mono" style={{fontSize:10, color:"var(--escalate)"}}>NOES</div>
            <div style={{fontSize:22, fontFamily:"var(--serif)"}}>{d.result.match(/\d+/g)?.[1] || "—"}</div>
          </div>
        </div>
      </div>
      <div className="modal-foot"><button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button></div>
    </>
  );
}

function FeedDetail({ id, titleId, closeButtonRef }) {
  const f = APH_FEEDS.find(x => x.id === id);
  const { closeModal, toast } = useStore();
  if (!f) return <ModalHead kicker="Feed" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  const status = f.lastStatusCode != null ? (f.lastStatusCode >= 200 && f.lastStatusCode < 300 ? "Live" : "Error") : "—";
  const parser = f.parser || "—";
  const last = f.last || "—";
  return (
    <>
      <ModalHead kicker={`Source · ${f.group}`} title={f.name} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <dl className="kv">
          <dt>URL</dt><dd className="mono" style={{fontSize:11, color:"var(--ink-3)", wordBreak:"break-all"}}>{f.url}</dd>
          <dt>Status</dt><dd>{status}</dd>
          <dt>Authority</dt><dd>{f.authority}</dd>
          <dt>Confidence</dt><dd>{f.confidence}</dd>
          <dt>Parser</dt><dd>{parser}</dd>
          <dt>Last refresh</dt><dd className="mono">{last}</dd>
          <dt>Items today</dt><dd className="mono">{f.today ?? "—"}</dd>
          <dt>False positive</dt><dd>{f.fpr}</dd>
          <dt>Modules</dt><dd>{f.modules.join(", ")}</dd>
        </dl>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:16, marginBottom:8}}>Recent items</h3>
        <div className="empty">—</div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          if (typeof window.__refreshLiveFeeds === "function") { window.__refreshLiveFeeds(); toast(`${f.name} refresh requested`, "brass"); }
          else toast("Open Live parliament to start the feed poller", "brass");
        }}><Icon name="refresh" size={13}/> Re-fetch now</button>
        <button className="btn" title="Copy parser checklist for this feed" onClick={() => copyModalText(`# Parser checklist\nFeed: ${f.name}\nURL: ${f.url}\nParser: ${parser}\nLast refresh: ${last}\n\nChecks:\n- HTTP status is 2xx\n- XML item count is non-zero when source publishes\n- Title, date, link and description map cleanly\n- Module routing matches: ${f.modules.join(", ")}`, toast, "Parser checklist copied")}>Copy parser checklist</button>
        <button className="btn ghost" style={{marginLeft:"auto"}} onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

function WatchlistDetail({ id, titleId, closeButtonRef }) {
  const { closeModal, toast, state } = useStore();
  // F2: resolve against the merged list so user-created watchlists open their
  // detail rather than a "Not found" modal.
  const all = [...WATCHLISTS, ...(state.watchlistCreated || [])];
  const w = all.find(x => x.name === id);
  if (!w) return <ModalHead kicker="Watchlist" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  // Matches and keyword count are always computed live, never read from a stored
  // field: a built-in watchlist's matches/trend are held null (the fixture
  // numbers were invented) and a created watchlist's seed values would
  // otherwise go stale as new signals arrive. matchSource is the same live
  // items or (now empty) SIGNALS fallback every other desk uses.
  const live = useLiveState("signals");
  const matchSource = live.items || SIGNALS;
  // F16: stable keyword matching against signal tags, not a name-prefix substring.
  const matchingAll = watchlistMatches(w, matchSource);
  const matchingSignals = matchingAll.slice(0, 3);
  const keywordList = watchlistKeywords(w);
  return (
    <>
      <ModalHead kicker={w.created ? "Watchlist · New" : "Watchlist"} title={w.name} representative={!!w.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        {w.created && (
          <div className="empty" style={{marginBottom:14}}>Created watchlist. Keyword matching runs against the current signal stream. Trend builds as new signals arrive.</div>
        )}
        <div className="grid g-3" style={{gap:12}}>
          <div className="panel stat"><div className="stat-label">Matches</div><div className="stat-value" style={{fontSize:26}}>{matchingAll.length}</div></div>
          <div className="panel stat"><div className="stat-label">Keywords</div><div className="stat-value" style={{fontSize:26}}>{keywordList.length}</div></div>
          <div className="panel stat"><div className="stat-label">Trend history</div>
            <div className="mono" style={{marginTop:8, color:"var(--ink-4)", fontSize:11}}>Not held — Parliament Pulse does not yet track watchlist matches over time.</div>
          </div>
        </div>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:6}}>Matching signals</h3>
        {matchingSignals.length === 0 && <div className="empty">No matching signals in the current stream.</div>}
        {matchingSignals.map(s => (
          <div key={s.id} style={{padding:"8px 12px", border:"1px solid var(--line-2)", borderRadius:8, marginBottom:6}}>
            <div style={{fontSize:12.5, fontWeight:500}}>{s.title}</div>
            <div className="mono" style={{fontSize:10.5, color:"var(--ink-4)", marginTop:2}}>{s.id} · {s.source}</div>
          </div>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={() => {
          copyModalText(`# Watchlist digest\nWatchlist: ${w.name}\nMatches: ${matchingAll.length}\nKeywords: ${keywordList.join(", ")}\n\nMatching signals:\n${matchingSignals.map(s => `- ${s.id}: ${s.title}`).join("\n") || "- No matching signals in the current stream."}`, toast, "Watchlist digest copied");
          closeModal();
        }}>Copy digest</button>
        <button className="btn" onClick={() => toast("Configuration saved locally")}>Save config</button>
      </div>
    </>
  );
}

function RadarDetail({ id, titleId, closeButtonRef }) {
  const r = RADAR.find(x => x.issue === id);
  const { closeModal, toast } = useStore();
  if (!r) return <ModalHead kicker="Issue" title="Not found" titleId={titleId} closeButtonRef={closeButtonRef} />;
  return (
    <>
      <ModalHead kicker="Attention radar issue" title={r.issue} representative={!!r.representative} titleId={titleId} closeButtonRef={closeButtonRef} />
      <div className="modal-body">
        <div style={{display:"flex", gap:8, marginBottom:12}}><Att level={r.att}/><span className="tag">{r.sources} contributing sources</span></div>
        <p style={{color:"var(--ink-2)", marginTop:0}}>{r.reason}</p>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Momentum (7 days)</h3>
        <div className="spark" style={{height:40}}>
          {[3,4,5,4,6,7,Math.round(r.momentum*10)].map((v,i)=><span key={i} style={{height:(v*3+4)+"px"}}/>)}
        </div>
        <h3 className="mono" style={{fontSize:10, color:"var(--ink-4)", textTransform:"uppercase", letterSpacing:".16em", marginTop:18, marginBottom:8}}>Suggested actions</h3>
        <ul style={{margin:0, paddingLeft:18, color:"var(--ink-2)"}}>
          <li>Draft Executive Brief for Director, Digital Policy</li>
          <li>Monitor for Estimates references</li>
          <li>Coordinate with Procurement lead</li>
        </ul>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => {
          copyModalText(`# Issue brief\nIssue: ${r.issue}\nPortfolio: ${r.portfolio}\nMomentum: ${Math.round(r.momentum * 100)}\n\nSuggested actions:\n- Draft Executive Brief for Director, Digital Policy\n- Monitor for Estimates references\n- Coordinate with Procurement lead`, toast, "Issue brief copied");
          closeModal();
        }}><Icon name="brief" size={13}/> Draft issue brief</button>
      </div>
    </>
  );
}

Object.assign(window, { StoreProvider, useStore, DetailModal, watchlistKeywords, watchlistMatches, useLiveState, useLiveBills, liveStateDegradation, mapWorkerSignalToCard, mapLiveBlocks, fmtFetchedAt });
