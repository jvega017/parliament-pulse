import { createContext } from "react";
import type { FeedResult } from "../lib/aphFeed";
import type { Feed, ModalState, PersistedState, Signal } from "../types";

export interface Toast {
  id: string;
  msg: string;
  kind: "ok" | "brass" | "warn";
}

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  title?: string;
}

export interface ConfirmRequest extends ConfirmOptions {
  msg: string;
}

export interface StoreValue {
  state: PersistedState;
  toasts: Toast[];
  modal: ModalState | null;
  signalId: string | null;
  page: string;
  liveSignals: Signal[];
  liveLoading: boolean;
  liveFeedResult: FeedResult | null;
  refreshTick: number;

  toast: (msg: string, kind?: Toast["kind"]) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  openSignal: (id: string) => void;
  closeSignal: () => void;
  goto: (page: string) => void;
  setLiveSignals: (signals: Signal[], loading: boolean, feedResult: FeedResult | null) => void;
  openBrief: (signalId: string | null) => void;
  briefSignalId: string | null;
  closeBrief: () => void;
  triggerRefresh: () => void;
  briefStatus: Record<string, "draft" | "sent" | "approved">;
  setBriefStatus: (signalId: string, status: "draft" | "sent" | "approved") => void;
  connectorRequests: Record<string, true>;
  requestConnector: (name: string) => void;
  clusterStatus: "open" | "tracking" | "coordinated" | "coincidence";
  setClusterStatus: (status: "open" | "tracking" | "coordinated" | "coincidence") => void;
  mobileNavOpen: boolean;
  toggleMobileNav: () => void;
  closeMobileNav: () => void;
  deleteWatchlist: (name: string) => void;
  shortcutsOpen: boolean;
  toggleShortcuts: () => void;
  density: "comfortable" | "compact";
  setDensity: (d: "comfortable" | "compact") => void;

  lastSessionTime: number; // epoch ms of previous session — signals newer than this are "new"
  confirmRequest: ConfirmRequest | null;
  confirm: (msg: string, options?: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;

  assignOwner: (entityId: string, owner: string) => void;
  saveFeedback: (signalId: string, label: string, reason?: string) => void;
  archive: (signalId: string) => void;
  addWatchlist: (key: string) => void;
  createWatchlist: (name: string, terms?: string[]) => void;
  updateWatchlistTerms: (name: string, terms: string[]) => void;
  generateBrief: (signalId: string, type: string) => void;
  addFeed: (feed: Feed) => void;
  saveNote: (signalId: string, text: string) => void;
}

export const StoreContext = createContext<StoreValue | null>(null);
