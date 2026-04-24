import { useEffect, useRef, useState } from "react";
import { fetchAllFeeds, type FeedResult } from "./aphFeed";
import { signalFromFeedItem } from "./scoring";
import { WATCHLISTS } from "../data/fixtures";
import type { Signal, Watchlist } from "../types";

export interface LiveSignalsState {
  signals: Signal[];
  feedResult: FeedResult | null;
  loading: boolean;
  lastError: string | null;
}

export type { FeedResult };

/**
 * Poll APH RSS every 2 minutes, score each item with the current watchlists,
 * and return the result as a Signal[] in attention-descending order.
 *
 * Uses one shared poll across the tab via the component that mounts this
 * hook first; navigating away from PageLive keeps the Overview signals
 * fresh because the poll is driven by whichever page is mounted.
 */
export function useLiveSignals(
  apiBase: string,
  watchlists: Watchlist[] = WATCHLISTS,
): LiveSignalsState {
  const [feedResult, setFeedResult] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll(initial: boolean): Promise<void> {
      if (initial) setLoading(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetchAllFeeds(apiBase, ctrl.signal);
        if (!cancelled) {
          setFeedResult(r);
          setLastError(null);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLastError(err instanceof Error ? err.message : "unknown");
        setLoading(false);
      }
    }

    poll(true);
    const id = window.setInterval(() => poll(false), 120_000);
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      window.clearInterval(id);
    };
  }, [apiBase]);

  const signals: Signal[] = feedResult
    ? feedResult.items
        .map((item, i) => signalFromFeedItem(item, watchlists, i))
        .sort((a, b) => {
          const rank = { high: 0, med: 1, low: 2 } as const;
          const d = rank[a.attention] - rank[b.attention];
          if (d !== 0) return d;
          return b.confidence - a.confidence;
        })
    : [];

  return { signals, feedResult, loading, lastError };
}
