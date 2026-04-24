import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Feed, PersistedState, Signal, Watchlist } from "../types";
import { Icon } from "../icons";
import { StoreContext, type StoreValue, type Toast } from "./context";

const STORAGE_KEY = "pp-state-v1";

const INITIAL_STATE: PersistedState = {
  owners: {},
  feedback: {},
  archived: {},
  briefsGenerated: {},
  briefStatus: {},
  watchlistAdds: {},
  watchlistCreated: [],
  feeds: [],
  notes: {},
};

function loadState(): PersistedState {
  if (typeof localStorage === "undefined") return INITIAL_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { ...INITIAL_STATE, ...parsed };
  } catch (err) {
    console.warn("Failed to load persisted state", err);
    return INITIAL_STATE;
  }
}

// Track whether we have already warned the user about a persist failure
// so we do not spam them on every state change once quota is hit.
let persistWarned = false;
let persistOnError: (() => void) | null = null;

function persistState(state: PersistedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist state", err);
    if (!persistWarned) {
      persistWarned = true;
      persistOnError?.();
    }
  }
}

interface StoreProviderProps {
  children: ReactNode;
  page: string;
  setPage: (p: string) => void;
}

export function StoreProvider({
  children,
  page,
  setPage,
}: StoreProviderProps): JSX.Element {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<StoreValue["modal"]>(null);
  // Deep-link: ?signal=<id> opens the drawer on load, ?brief=<id> opens the brief overlay.
  const initialDeepLink = (() => {
    if (typeof window === "undefined") return { signal: null, brief: null };
    const p = new URLSearchParams(window.location.search);
    return { signal: p.get("signal"), brief: p.get("brief") };
  })();
  const [signalId, setSignalId] = useState<string | null>(initialDeepLink.signal);
  const [liveSignals, setLiveSignalsState] = useState<Signal[]>([]);
  const [liveLoading, setLiveLoading] = useState<boolean>(true);
  const [liveFeedResult, setLiveFeedResult] = useState<import("../lib/aphFeed").FeedResult | null>(null);
  const [briefSignalId, setBriefSignalId] = useState<string | null>(initialDeepLink.brief);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  // briefStatus mirrors state.briefStatus for callers that already use it.
  // Persisted via PersistedState so Send/Approve survive page reload.
  const [connectorRequests, setConnectorRequests] = useState<Record<string, true>>({});
  const [clusterStatus, setClusterStatusState] = useState<"open" | "tracking" | "coordinated" | "coincidence">("open");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toastSeq = useRef(0);

  useEffect(() => {
    persistState(state);
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modal) setModal(null);
      else if (signalId) setSignalId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, signalId]);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    const id = `t-${++toastSeq.current}`;
    setToasts((list) => [...list, { id, msg, kind }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  // Wire the persistState quota-warning callback so it can fire a toast.
  useEffect(() => {
    persistOnError = () =>
      toast(
        "Local storage full. Notes and feedback will not persist this session.",
        "warn",
      );
    return () => {
      persistOnError = null;
    };
  }, [toast]);

  const openModal = useCallback<StoreValue["openModal"]>((m) => setModal(m), []);
  const closeModal = useCallback(() => setModal(null), []);
  const openSignal = useCallback((id: string) => setSignalId(id), []);
  const closeSignal = useCallback(() => setSignalId(null), []);
  const goto = useCallback((p: string) => setPage(p), [setPage]);
  const setLiveSignals = useCallback(
    (signals: Signal[], loading: boolean, feedResult: import("../lib/aphFeed").FeedResult | null) => {
      setLiveSignalsState(signals);
      setLiveLoading(loading);
      setLiveFeedResult(feedResult);
    },
    [],
  );
  const openBrief = useCallback((id: string | null) => setBriefSignalId(id), []);
  const closeBrief = useCallback(() => setBriefSignalId(null), []);
  const triggerRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
    toast("Feed refresh triggered", "brass");
  }, [toast]);
  const setBriefStatus = useCallback(
    (sid: string, status: "draft" | "sent" | "approved") => {
      setState((s) => ({ ...s, briefStatus: { ...s.briefStatus, [sid]: status } }));
      toast(`Brief ${status}`, status === "approved" ? "brass" : "ok");
    },
    [toast],
  );
  const requestConnector = useCallback(
    (name: string) => {
      setConnectorRequests((s) => ({ ...s, [name]: true }));
      toast(`Connector requested: ${name}`, "brass");
    },
    [toast],
  );
  const setClusterStatus = useCallback(
    (status: "open" | "tracking" | "coordinated" | "coincidence") => {
      setClusterStatusState(status);
      toast(`Cluster marked ${status}`, status === "coordinated" ? "brass" : "ok");
    },
    [toast],
  );
  const toggleMobileNav = useCallback(() => setMobileNavOpen((o) => !o), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const assignOwner = useCallback(
    (entityId: string, owner: string) => {
      setState((s) => ({ ...s, owners: { ...s.owners, [entityId]: owner } }));
      toast(`Assigned ${owner} as policy owner`);
    },
    [toast],
  );

  const saveFeedback = useCallback(
    (sid: string, label: string, reason = "") => {
      setState((s) => ({
        ...s,
        feedback: { ...s.feedback, [sid]: { label, reason, ts: Date.now() } },
      }));
      toast(`Feedback logged: ${label}`, "brass");
    },
    [toast],
  );

  const archive = useCallback(
    (sid: string) => {
      setState((s) => ({ ...s, archived: { ...s.archived, [sid]: true } }));
      toast("Signal archived");
    },
    [toast],
  );

  const addWatchlist = useCallback(
    (key: string) => {
      setState((s) => ({ ...s, watchlistAdds: { ...s.watchlistAdds, [key]: true } }));
      toast("Added to watchlist", "brass");
    },
    [toast],
  );

  const createWatchlist = useCallback(
    (name: string, terms: string[] = []) => {
      const wl: Watchlist = {
        name,
        keywords: terms.length,
        terms,
        matches: 0,
        trend: [0, 0, 0, 0, 0, 0, 0],
      };
      setState((s) => ({ ...s, watchlistCreated: [...s.watchlistCreated, wl] }));
      toast(`Watchlist "${name}" created`, "brass");
    },
    [toast],
  );

  const updateWatchlistTerms = useCallback(
    (name: string, terms: string[]) => {
      setState((s) => ({
        ...s,
        watchlistCreated: s.watchlistCreated.map((w) =>
          w.name === name ? { ...w, terms, keywords: terms.length } : w,
        ),
      }));
      toast(`Watchlist "${name}" terms updated`, "brass");
    },
    [toast],
  );

  const generateBrief = useCallback(
    (sid: string, type: string) => {
      setState((s) => ({
        ...s,
        briefsGenerated: { ...s.briefsGenerated, [sid]: { ts: Date.now(), type } },
      }));
      toast(`${type} generated`, "brass");
    },
    [toast],
  );

  const addFeed = useCallback(
    (feed: Feed) => {
      setState((s) => ({ ...s, feeds: [...s.feeds, feed] }));
      toast(`Feed added: ${feed.name}`, "brass");
    },
    [toast],
  );

  const saveNote = useCallback((sid: string, text: string) => {
    setState((s) => ({ ...s, notes: { ...s.notes, [sid]: text } }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      toasts,
      modal,
      signalId,
      page,
      liveSignals,
      liveLoading,
      liveFeedResult,
      briefSignalId,
      toast,
      openModal,
      closeModal,
      openSignal,
      closeSignal,
      goto,
      setLiveSignals,
      openBrief,
      closeBrief,
      refreshTick,
      triggerRefresh,
      briefStatus: state.briefStatus,
      setBriefStatus,
      connectorRequests,
      requestConnector,
      clusterStatus,
      setClusterStatus,
      mobileNavOpen,
      toggleMobileNav,
      closeMobileNav,
      assignOwner,
      saveFeedback,
      archive,
      addWatchlist,
      createWatchlist,
      updateWatchlistTerms,
      generateBrief,
      addFeed,
      saveNote,
    }),
    [
      state,
      toasts,
      modal,
      signalId,
      page,
      liveSignals,
      liveLoading,
      liveFeedResult,
      briefSignalId,
      refreshTick,
      connectorRequests,
      clusterStatus,
      mobileNavOpen,
      toast,
      openModal,
      closeModal,
      openSignal,
      closeSignal,
      goto,
      setLiveSignals,
      openBrief,
      closeBrief,
      triggerRefresh,
      setBriefStatus,
      requestConnector,
      setClusterStatus,
      toggleMobileNav,
      closeMobileNav,
      assignOwner,
      saveFeedback,
      archive,
      addWatchlist,
      createWatchlist,
      updateWatchlistTerms,
      generateBrief,
      addFeed,
      saveNote,
    ],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icon
              name="check"
              size={14}
              stroke={
                t.kind === "brass"
                  ? "var(--brass)"
                  : t.kind === "warn"
                    ? "var(--caution)"
                    : "var(--ok)"
              }
            />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}
