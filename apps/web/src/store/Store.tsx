import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Feed, ModalState, PersistedState, Watchlist } from "../types";
import { Icon } from "../icons";

const STORAGE_KEY = "pp-state-v1";

const INITIAL_STATE: PersistedState = {
  owners: {},
  feedback: {},
  archived: {},
  briefsGenerated: {},
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

function persistState(state: PersistedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // Quota exceeded or storage disabled.
    console.warn("Failed to persist state", err);
  }
}

export interface Toast {
  id: string;
  msg: string;
  kind: "ok" | "brass" | "warn";
}

export interface StoreValue {
  state: PersistedState;
  toasts: Toast[];
  modal: ModalState | null;
  signalId: string | null;
  page: string;

  toast: (msg: string, kind?: Toast["kind"]) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  openSignal: (id: string) => void;
  closeSignal: () => void;
  goto: (page: string) => void;

  assignOwner: (entityId: string, owner: string) => void;
  saveFeedback: (signalId: string, label: string, reason?: string) => void;
  archive: (signalId: string) => void;
  addWatchlist: (key: string) => void;
  createWatchlist: (name: string) => void;
  generateBrief: (signalId: string, type: string) => void;
  addFeed: (feed: Feed) => void;
  saveNote: (signalId: string, text: string) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}

interface StoreProviderProps {
  children: ReactNode;
  page: string;
  setPage: (p: string) => void;
}

export function StoreProvider({ children, page, setPage }: StoreProviderProps): JSX.Element {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [signalId, setSignalId] = useState<string | null>(null);
  const toastSeq = useRef(0);

  useEffect(() => {
    persistState(state);
  }, [state]);

  // Close modal / drawer on Escape — prototype forgot this.
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

  const openModal = useCallback((m: ModalState) => setModal(m), []);
  const closeModal = useCallback(() => setModal(null), []);
  const openSignal = useCallback((id: string) => setSignalId(id), []);
  const closeSignal = useCallback(() => setSignalId(null), []);
  const goto = useCallback((p: string) => setPage(p), [setPage]);

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
    (name: string) => {
      const wl: Watchlist = { name, keywords: 0, matches: 0, trend: [0, 0, 0, 0, 0, 0, 0] };
      setState((s) => ({ ...s, watchlistCreated: [...s.watchlistCreated, wl] }));
      toast(`Watchlist "${name}" created`, "brass");
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
      toast,
      openModal,
      closeModal,
      openSignal,
      closeSignal,
      goto,
      assignOwner,
      saveFeedback,
      archive,
      addWatchlist,
      createWatchlist,
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
      toast,
      openModal,
      closeModal,
      openSignal,
      closeSignal,
      goto,
      assignOwner,
      saveFeedback,
      archive,
      addWatchlist,
      createWatchlist,
      generateBrief,
      addFeed,
      saveNote,
    ],
  );

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icon
              name="check"
              size={14}
              stroke={t.kind === "brass" ? "var(--brass)" : t.kind === "warn" ? "var(--caution)" : "var(--ok)"}
            />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}
