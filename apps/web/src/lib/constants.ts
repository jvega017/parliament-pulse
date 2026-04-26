// Shared constants used across multiple components.

export const SCORE_LABELS: Record<string, string> = {
  authority: "Source authority",
  portfolio: "Portfolio relevance",
  novelty: "Novelty",
  momentum: "Momentum",
  time: "Time sensitivity",
  scrutiny: "Scrutiny relevance",
  ops: "Operational impact",
};

// Actual weight table — mirrors scoring.ts WEIGHTS.
// Momentum and ops are zeroed (no time-series or operational data yet).
export const SCORE_WEIGHTS: Record<string, number> = {
  authority: 0.25,
  portfolio: 0.35,
  novelty: 0.10,
  momentum: 0,
  time: 0.20,
  scrutiny: 0.10,
  ops: 0,
};
