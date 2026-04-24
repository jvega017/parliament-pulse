// Shared domain types for Parliament Pulse.
// Every fixture shape and UI prop surface lives here so fixtures and
// components cannot drift apart silently.

export type AttentionLevel = "high" | "med" | "low";
export type Chamber = "House" | "Senate" | "Joint" | "Federation";
export type FeedStatus = "live" | "delayed" | "broken" | "stale" | "review";
export type ParserStatus = "Valid" | "Warning" | "Needs validation";
export type ConfidenceBand = "High" | "Medium" | "Low" | "—";
export type Authority = "Official" | "Custom";
export type HumanReview = "Required" | "Optional" | "None";

export type TagColour = "" | "brass" | "teal" | "amber" | "red" | "info";

export interface Tag {
  l: string;
  c?: TagColour;
}

export interface EvidenceLink {
  label: string;
  url: string;
}

export interface ProvenanceEntry {
  ts: string;
  by: string;
  event: string;
}

export interface UpdateEntry {
  ts: string;
  who: string;
  what: string;
}

export interface ScoreDimensions {
  authority: number;
  portfolio: number;
  novelty: number;
  momentum: number;
  time: number;
  scrutiny: number;
  ops: number;
}

export interface Signal {
  id: string;
  time: string;
  date: string;
  source: string;
  sourceGroup: "Senate" | "House" | "Library" | "Custom";
  title: string;
  summary: string;
  tags: Tag[];
  attention: AttentionLevel;
  attentionReason: string;
  action: string;
  actionReason: string;
  confidence: number;
  sourceAuthority: Authority;
  humanReview: HumanReview;
  evidence: EvidenceLink[];
  score: ScoreDimensions;
  provenance: ProvenanceEntry[];
  updates: UpdateEntry[];
  members: string[];
}

export interface Feed {
  id: string;
  group: "Senate" | "House" | "Library" | "Custom";
  name: string;
  url: string;
  status: FeedStatus;
  last: string;
  today: number | null;
  fpr: "Low" | "Med" | "High" | "—";
  modules: string[];
  parser: ParserStatus;
  authority: Authority;
  confidence: ConfidenceBand;
}

export interface Hearing {
  when: string;
  topic: string;
  room: string;
}

export interface Committee {
  id: string;
  name: string;
  chamber: Chamber;
  chair: string;
  members: number;
  portfolio: string;
  active: number;
  recentReports: number;
  bio: string;
  hearings: Hearing[];
  inquiries: string[];
  url: string;
}

export interface Member {
  id: string;
  name: string;
  party: string;
  state: string;
  roles: string[];
  bio: string;
  qons: number;
  hansard: number;
  committees: string[];
}

export interface Minister {
  id: string;
  name: string;
  role: string;
  portfolio: string;
  bio: string;
  recent: string[];
}

export interface StageEvent {
  when: string;
  event: string;
}

export interface Bill {
  ref: string;
  title: string;
  stage: string;
  stageHistory: StageEvent[];
  portfolio: string;
  minister: string | null;
  digest: "Published" | "Pending";
  owner: string;
  att: AttentionLevel;
  purpose: string;
  provisions: string[];
  watchlists: string[];
}

// Summary used on list pages where full bill detail is not needed.
export interface BillSummary {
  ref: string;
  title: string;
  stage: string;
  portfolio: string;
  digest: "Published" | "Pending";
  owner: string;
  att: AttentionLevel;
}

export interface CommitteeItem {
  when: string;
  type: "Hearing" | "Report tabled" | "New inquiry";
  name: string;
  topic: string;
  portfolio: string;
  att: AttentionLevel;
}

export interface Division {
  when: string;
  chamber: "House" | "Senate";
  q: string;
  result: string;
  bill: string;
}

export interface Watchlist {
  name: string;
  keywords: number; // count — shown in UI
  terms: string[]; // actual terms used for live scoring
  matches: number;
  trend: number[];
}

export interface RadarIssue {
  issue: string;
  att: AttentionLevel;
  reason: string;
  sources: number;
  momentum: number;
  confidence: number;
}

export interface QonItem {
  when: string;
  who: string;
  chamber: "House" | "Senate";
  q: string;
}

export interface QonPattern {
  topic: string;
  members: string[];
  window: string;
  count: number;
  target: string;
  trigger: string;
  confidence: ConfidenceBand;
  items: QonItem[];
}

export interface BriefingQueueItem {
  type: string;
  for: string;
  status: "Drafted" | "Awaiting review" | "In progress";
  at: string;
  ready: boolean;
}

export interface Entities {
  committees: Record<string, Committee>;
  members: Record<string, Member>;
  ministers: Record<string, Minister>;
  bills: Record<string, Bill>;
}

// Modal discriminated union — replaces the `type + id: unknown` pattern
// in the prototype with a type-safe variant per modal kind.
export type ModalState =
  | { kind: "committee"; id: string }
  | { kind: "bill"; id: string }
  | { kind: "member"; id: string }
  | { kind: "minister"; id: string }
  | { kind: "division"; id: Division }
  | { kind: "feed"; id: string }
  | { kind: "watchlist"; id: string }
  | { kind: "radar"; id: string }
  | { kind: "inquiry"; id: string }
  | { kind: "hearing"; id: Hearing & { committee: string } };

export interface PersistedState {
  owners: Record<string, string>;
  feedback: Record<string, { label: string; reason: string; ts: number }>;
  archived: Record<string, true>;
  briefsGenerated: Record<string, { ts: number; type: string }>;
  briefStatus: Record<string, "draft" | "sent" | "approved">;
  watchlistAdds: Record<string, true>;
  watchlistCreated: Watchlist[];
  feeds: Feed[];
  notes: Record<string, string>;
}
