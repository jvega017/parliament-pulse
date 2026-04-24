import { createContext } from "react";
import type { FeedResult } from "../lib/aphFeed";
import type { Feed, ModalState, PersistedState, Signal } from "../types";

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
  liveSignals: Signal[];
  liveLoading: boolean;
  liveFeedResult: FeedResult | null;

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

  assignOwner: (entityId: string, owner: string) => void;
  saveFeedback: (signalId: string, label: string, reason?: string) => void;
  archive: (signalId: string) => void;
  addWatchlist: (key: string) => void;
  createWatchlist: (name: string) => void;
  generateBrief: (signalId: string, type: string) => void;
  addFeed: (feed: Feed) => void;
  saveNote: (signalId: string, text: string) => void;
}

export const StoreContext = createContext<StoreValue | null>(null);
