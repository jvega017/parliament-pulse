import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAllFeeds, type FeedResult } from "./aphFeed";
import { signalFromFeedItem } from "./scoring";
import { WATCHLISTS } from "../data/fixtures";
import type { Signal, Watchlist } from "../types";

// Adaptive poll intervals.
// During sitting weeks: poll every 2 minutes for near-real-time RSS updates.
// When all feeds are healthy but return 0 items (recess): back off to 30 minutes
// so we don't hammer APH for nothing. Returns to 2 min the moment items appear.
const POLL_ACTIVE_MS = 120_000;   // 2 min — sitting
const POLL_QUIET_MS  = 1_800_000; // 30 min — recess / quiet feeds

export interface LiveSignalsState {
  signals: Signal[];
  feedResult: FeedResult | null;
  loading: boolean;
  lastError: string | null;
  pollIntervalMs: number;
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
  refreshTick = 0,
): LiveSignalsState {
  const [feedResult, setFeedResult] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(POLL_ACTIVE_MS);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function scheduleNext(delayMs: number): void {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (!cancelled) void poll(false);
      }, delayMs);
    }

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

          // Adaptive interval: back off to 30 min when all feeds are healthy
          // but returned nothing — strong indicator of a recess week.
          const statuses = Object.values(r.feedStatus);
          const allOk = statuses.length > 0 && statuses.every((s) => s.ok);
          const nextMs = allOk && r.items.length === 0 ? POLL_QUIET_MS : POLL_ACTIVE_MS;
          setPollIntervalMs(nextMs);
          scheduleNext(nextMs);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLastError(err instanceof Error ? err.message : "unknown");
        setLoading(false);
        scheduleNext(POLL_ACTIVE_MS); // retry at normal rate after error
      }
    }

    void poll(true);
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [apiBase, refreshTick]);

  const signals: Signal[] = useMemo(() => {
    if (!feedResult) return [];
    // Compute batch-level momentum hints: normalise kind co-occurrence count.
    // Items from high-frequency kinds (e.g. many inquiries in one poll) get a
    // higher momentum value. Weight is still 0 in the scoring formula so this
    // does not affect attention levels — it populates the breakdown display only.
    const kindCounts = new Map<string, number>();
    for (const item of feedResult.items) {
      kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
    }
    const maxKindCount = Math.max(...kindCounts.values(), 1);
    const now = new Date();
    return feedResult.items
      .map((item, i) => {
        const momentumHint = Math.min(1, (kindCounts.get(item.kind) ?? 1) / maxKindCount);
        return signalFromFeedItem(item, watchlists, i, now, momentumHint);
      })
      .sort((a, b) => {
        const rank = { high: 0, med: 1, low: 2 } as const;
        const d = rank[a.attention] - rank[b.attention];
        if (d !== 0) return d;
        return b.confidence - a.confidence;
      });
  }, [feedResult, watchlists]);

  return { signals, feedResult, loading, lastError, pollIntervalMs };
}
