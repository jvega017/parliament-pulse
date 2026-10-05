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

// 0.16.3: raised from 0.5. At 0.5, with descriptions in the token set,
// "Annual reports" and "Budget Estimates" items from different committees
// and four different Treasury Laws bills each shared one thread.
export const SIMILARITY_THRESHOLD = 0.6;
export const MAX_FINGERPRINT_TOKENS = 30;
const MIN_TOKEN_LEN = 3; // shorter than the Hansard resolver's 4 -- RSS titles are short, so short tokens (e.g. "gst", "aid") carry more signal here

const STOPWORDS = new Set(
  `a an and are as at be been being but by can could did do does doing down during
   each few for from further had has have having he her here hers herself him himself
   his how i if in into is it its itself just me more most my myself no nor not now
   of off on once only or other our ours ourselves out over own same she should so
   some such than that the their theirs them themselves then there these they this
   those through to too under until up very was we were what when where which while
   who whom why will with would you your yours yourself yourselves new bill act
   committee standing joint inquiry division suspension sessional orders annual
   reports report estimates review amendment legislation treasury laws`
    .split(/\s+/)
    .filter(Boolean),
);

// The second line (0.16.3) is committee and procedure vocabulary that every
// committee item shares, so it said nothing about WHICH inquiry an item is.
// "new" and "bill" and "act" are dropped as near-universal in this corpus (most
// titles are "X Amendment Bill 2026" / "New inquiry: ...") -- keeping them would
// inflate similarity between otherwise-unrelated items.

/** Lowercase word tokens, dropping stopwords and anything shorter than MIN_TOKEN_LEN. */
export function tokenize(text: string): string[] {
  const words = (text || "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.filter((w) => w.length >= MIN_TOKEN_LEN && !STOPWORDS.has(w));
}

/**
 * Build the deduplicated token set used for thread matching. 0.16.3: the
 * title only. A summary is accepted for call-site compatibility and ignored:
 * descriptions are boilerplate ("... Committee have tabled a report titled")
 * that made unrelated items look similar.
 */
export function buildTokenSet(title: string, _summary?: string | null): Set<string> {
  return new Set(tokenize(title));
}

// ---- Canonical keys (0.16.3) ------------------------------------------------
// An item that names its inquiry, bill or division is threaded by that name,
// never by word overlap. Keys are stored as the first fingerprint token with
// a "key:" prefix, which tokenize() can never produce (it emits [a-z0-9]+).
export const KEY_PREFIX = "key:";

const INQUIRY_PATH_RE = /\/Committees\/(House|Joint|Senate)\/([^/?#]+)\/([^/?#]+)/i;
const DIVISION_ID_RE = /\/divisions\/Details\?id=(\d+)/i;
const DIVISION_PREFIX_RE = /^Division\s+\d+\s+-\s+/i;
const BILL_NAME_RE = /^(.*?\bBill\s+\d{4})\b/i;
const APOSTROPHES_RE = /[‘’']/g;

function normKeyText(t: string): string {
  return t.toLowerCase().replace(APOSTROPHES_RE, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The canonical thread key for an item, or null when it has none.
 *  - a committee link: the inquiry path /Committees/<chamber>/<committee>/<inquiry>
 *  - a division: the bill named before ":" when it is a bill, else the division itself
 *  - a Bills Digest (or any title that is a bill name): the bill name
 */
export function canonicalThreadKey(title: string, link: string | null | undefined, kind?: string | null): string | null {
  const l = link ?? "";
  const inquiry = INQUIRY_PATH_RE.exec(l);
  if (inquiry) return `${KEY_PREFIX}inquiry/${inquiry[1]}/${inquiry[2]}/${inquiry[3]}`.toLowerCase();
  const t = (title ?? "").trim();
  if (kind === "division" || DIVISION_PREFIX_RE.test(t)) {
    const subject = t.replace(DIVISION_PREFIX_RE, "").split(":")[0];
    const bill = BILL_NAME_RE.exec(subject);
    if (bill) return `${KEY_PREFIX}bill/${normKeyText(bill[1])}`;
    const id = DIVISION_ID_RE.exec(l);
    return id ? `${KEY_PREFIX}division/${id[1]}` : null;
  }
  if (kind === "digest") {
    const bill = BILL_NAME_RE.exec(t);
    if (bill) return `${KEY_PREFIX}bill/${normKeyText(bill[1])}`;
  }
  return null;
}

function keyOf(fingerprint: string[]): string | null {
  const k = fingerprint.find((tok) => tok.startsWith(KEY_PREFIX));
  return k ?? null;
}

function wordTokens(fingerprint: string[]): Set<string> {
  return new Set(fingerprint.filter((tok) => !tok.startsWith(KEY_PREFIX)));
}

/**
 * Assign an item that may carry a canonical key. A keyed item joins only the
 * thread holding the same key, and otherwise starts its own keyed thread. An
 * unkeyed item falls back to title Jaccard, against word tokens only, so a
 * key token never adds or removes similarity.
 */
export function assignThreadKeyed(
  itemTokens: Set<string>,
  key: string | null,
  candidates: ThreadCandidate[],
  newThreadId: string,
  threshold: number = SIMILARITY_THRESHOLD,
): ThreadAssignment {
  if (key) {
    const match = candidates.find((c) => keyOf(c.fingerprint) === key);
    const base = match ? [...wordTokens(match.fingerprint)] : [];
    const union = [key, ...new Set([...base, ...itemTokens])].slice(0, MAX_FINGERPRINT_TOKENS);
    return match
      ? { thread_id: match.thread_id, fingerprint: union, created: false, similarity: 1 }
      : { thread_id: newThreadId, fingerprint: union, created: true, similarity: 0 };
  }
  const plain = candidates.map((c) => ({ ...c, fingerprint: [...wordTokens(c.fingerprint)], key: keyOf(c.fingerprint) }));
  const a = assignThread(itemTokens, plain, newThreadId, threshold);
  if (a.created) return a;
  const k = plain.find((c) => c.thread_id === a.thread_id)?.key ?? null;
  return k ? { ...a, fingerprint: [k, ...a.fingerprint].slice(0, MAX_FINGERPRINT_TOKENS) } : a;
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
