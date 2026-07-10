// Thread assignment: groups related signals (repeat coverage of the same
// inquiry, bill, or hearing across feed polls) under a shared thread.
//
// Method borrowed from the Hansard-Signal Estimates resolver's fingerprint
// matcher (token-set overlap against a normalised token set), adapted from
// windowed-substring matching to whole-title Jaccard similarity, which suits
// short RSS titles better than the resolver's 800-char transcript windows.
//
// Pure and deterministic: no Date.now(), no randomness, no I/O. Callers pass
// in timestamps and a candidate ID for a possible new thread; this module
// only decides which thread an item's tokens belong to.

export const SIMILARITY_THRESHOLD = 0.5;
export const MAX_FINGERPRINT_TOKENS = 30;
const MIN_TOKEN_LEN = 3; // shorter than the Hansard resolver's 4 -- RSS titles are short, so short tokens (e.g. "gst", "aid") carry more signal here

const STOPWORDS = new Set(
  `a an and are as at be been being but by can could did do does doing down during
   each few for from further had has have having he her here hers herself him himself
   his how i if in into is it its itself just me more most my myself no nor not now
   of off on once only or other our ours ourselves out over own same she should so
   some such than that the their theirs them themselves then there these they this
   those through to too under until up very was we were what when where which while
   who whom why will with would you your yours yourself yourselves new bill act`
    .split(/\s+/)
    .filter(Boolean),
);

// "new" and "bill" and "act" are dropped as near-universal in this corpus (most
// titles are "X Amendment Bill 2026" / "New inquiry: ...") -- keeping them would
// inflate similarity between otherwise-unrelated items.

/** Lowercase word tokens, dropping stopwords and anything shorter than MIN_TOKEN_LEN. */
export function tokenize(text: string): string[] {
  const words = (text || "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.filter((w) => w.length >= MIN_TOKEN_LEN && !STOPWORDS.has(w));
}

/** Build the deduplicated token set used for thread matching from a title + optional summary. */
export function buildTokenSet(title: string, summary?: string | null): Set<string> {
  return new Set([...tokenize(title), ...tokenize(summary ?? "")]);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface ThreadCandidate {
  thread_id: string;
  fingerprint: string[]; // token set, capped at MAX_FINGERPRINT_TOKENS
}

export interface ThreadAssignment {
  thread_id: string;
  fingerprint: string[]; // fingerprint to persist for this thread after the assignment
  created: boolean;      // true if a new thread was created, false if joined an existing one
  similarity: number;    // best similarity score found (0 when created is true and no candidates matched)
}

/**
 * Assign an item's token set to the best-matching existing thread, or signal
 * that a new thread should be created. `newThreadId` is supplied by the
 * caller (e.g. derived from the item's guid) so this function stays pure --
 * it never generates its own IDs.
 *
 * Empty-title safety: an item with no tokens never joins an existing thread
 * (Jaccard similarity is defined as 0 whenever either set is empty), and it
 * is created as its own thread with an empty fingerprint so it cannot later
 * absorb unrelated items either.
 */
export function assignThread(
  itemTokens: Set<string>,
  candidates: ThreadCandidate[],
  newThreadId: string,
  threshold: number = SIMILARITY_THRESHOLD,
): ThreadAssignment {
  let best: { candidate: ThreadCandidate; score: number } | null = null;
  for (const candidate of candidates) {
    const score = jaccardSimilarity(itemTokens, new Set(candidate.fingerprint));
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }

  if (best) {
    const union = new Set([...best.candidate.fingerprint, ...itemTokens]);
    return {
      thread_id: best.candidate.thread_id,
      fingerprint: [...union].slice(0, MAX_FINGERPRINT_TOKENS),
      created: false,
      similarity: best.score,
    };
  }

  return {
    thread_id: newThreadId,
    fingerprint: [...itemTokens].slice(0, MAX_FINGERPRINT_TOKENS),
    created: true,
    similarity: 0,
  };
}
