// Extended dataset — entities with rich details for click-through
window.ENTITIES = {
  // Every committee below keeps its real name, id and APH URL: those are public
  // facts. Every operational field that was attached to them (chair, member count,
  // portfolio breakdown, active-inquiry count, recent-report count, bio, hearing
  // schedule, inquiry list) was invented with no live source behind it, so each is
  // held null (scalars) or empty (arrays). The committee detail modal should render
  // an honest empty state for these fields naming that no live committee-detail feed
  // is wired, and link to the committee's own url for the real record.
  committees: {
    "legcon": {
      id: "legcon",
      name: "Legal & Constitutional Affairs Legislation Committee",
      chamber: "Senate",
      chair: null,
      members: null,
      portfolio: null,
      active: null,
      recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Legal_and_Constitutional_Affairs",
    },
    "finpa": {
      id: "finpa",
      name: "Finance & Public Administration References Committee",
      chamber: "Senate",
      chair: null,
      members: null,
      portfolio: null,
      active: null,
      recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Finance_and_Public_Administration",
    },
    "econ": {
      id: "econ", name: "Economics Legislation Committee", chamber: "Senate",
      chair: null, members: null, portfolio: null,
      active: null, recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Economics",
    },
    "rra": {
      id: "rra", name: "Rural & Regional Affairs Committee", chamber: "Senate",
      chair: null, members: null, portfolio: null,
      active: null, recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport",
    },
    "jcle": {
      id: "jcle", name: "Joint Committee on Law Enforcement", chamber: "Joint",
      chair: null, members: null, portfolio: null,
      active: null, recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Joint/Law_Enforcement",
    },
    "envcomms": {
      id: "envcomms", name: "Environment & Communications References", chamber: "Senate",
      chair: null, members: null, portfolio: null,
      active: null, recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Environment_and_Communications",
    },
    "jcpaa": {
      id: "jcpaa", name: "Joint Committee on Public Accounts & Audit", chamber: "Joint",
      chair: null, members: null, portfolio: null,
      active: null, recentReports: null,
      bio: null,
      hearings: [],
      inquiries: [],
      url: "aph.gov.au/Parliamentary_Business/Committees/Joint/Public_Accounts_and_Audit",
    },
  },

  members: {
    "hollis": {
      id: "hollis", name: "Opposition Senator (representative)", party: "Opposition", state: "QLD",
      roles: ["Shadow Assistant Minister for Digital Services", "Economics Committee"],
      bio: "Representative Opposition senator profile. No real parliamentarian is depicted; wire live APH member data before relying on this.",
      qons: 14, hansard: 28, committees: ["Economics", "Finance & PA"],
    },
    "quirke": {
      id: "quirke", name: "Crossbench Senator (representative)", party: "Crossbench", state: "TAS",
      roles: ["Independent senator"],
      bio: "Representative crossbench senator profile. No real parliamentarian is depicted; wire live APH member data before relying on this.",
      qons: 9, hansard: 17, committees: ["Finance & PA"],
    },
    "rafferty": {
      id: "rafferty", name: "Opposition Member (representative)", party: "Opposition", state: "VIC",
      roles: ["Shadow Minister for Government Services"],
      bio: "Representative Opposition member profile. No real parliamentarian is depicted; wire live APH member data before relying on this.",
      qons: 22, hansard: 41, committees: ["PAA"],
    },
  },

  // Ministers hold generic role titles only (no real minister is named). The "recent"
  // activity lists below were invented specific actions with invented dates and carry
  // no disclosure chip, so they are emptied. bio/portfolio/role are generic,
  // non-specific descriptions of the role and are kept.
  ministers: {
    "digital": {
      id: "digital", name: "Minister for Digital Services", role: "Minister for Digital Services",
      portfolio: "Digital Services",
      bio: "Minister responsible for digital government, identity, and service delivery.",
      recent: [],
    },
    "cyber": {
      id: "cyber", name: "Minister for Cyber Security", role: "Minister for Cyber Security",
      portfolio: "Cyber Security",
      bio: "Minister responsible for cyber security policy and co-ordination.",
      recent: [],
    },
  },

  // Bill ref and title are real, publicly identifiable Commonwealth bill citations
  // and are kept as identifiers, along with the product's own portfolio/watchlist
  // tags. stage, stageHistory, digest, owner, att and purpose were all invented
  // specific claims (a legislative stage, fabricated dated stage events including
  // the literal string "Today", a fabricated internal "owner", and an invented
  // description of the bill's scope) and are nulled/emptied. provisions were
  // invented specific legislative text and are emptied.
  bills: {
    "BILL-2026-048": {
      ref: "BILL-2026-048",
      title: "Digital ID Amendment (Assurance) Bill 2026",
      stage: null,
      stageHistory: [],
      portfolio: "Digital identity",
      minister: "digital",
      digest: null,
      owner: null,
      att: null,
      purpose: null,
      provisions: [],
      watchlists: ["Digital identity", "Data sharing & privacy"],
    },
    "BILL-2026-041": {
      ref: "BILL-2026-041",
      title: "Cyber Security Legislation Amendment Bill 2026",
      stage: null,
      stageHistory: [],
      portfolio: "Cyber security", minister: "cyber", digest: null,
      owner: null, att: null,
      purpose: null,
      provisions: [],
      watchlists: ["Cyber security"],
    },
    "BILL-2026-037": {
      ref: "BILL-2026-037",
      title: "Consumer Data Right Expansion Bill 2026",
      stage: null,
      stageHistory: [],
      portfolio: "Data & privacy", minister: null, digest: null, owner: null, att: null,
      purpose: null, provisions: [], watchlists: ["Data sharing & privacy"],
    },
    "BILL-2026-031": {
      ref: "BILL-2026-031",
      title: "Telecommunications (Regional Connectivity) Amendment Bill",
      stage: null,
      stageHistory: [], portfolio: "Infrastructure", minister: null,
      digest: null, owner: null, att: null,
      purpose: null, provisions: [], watchlists: ["Infrastructure & connectivity"],
    },
    "BILL-2026-024": {
      ref: "BILL-2026-024",
      title: "Social Services Digital Delivery Amendment Bill",
      stage: null,
      stageHistory: [], portfolio: "Service delivery", minister: null,
      digest: null, owner: null, att: null,
      purpose: null, provisions: [], watchlists: ["Service delivery"],
    },
  },
};

// Live Parliament YouTube channel IDs — @AUSParliamentLive
// [VERIFY] Channel id UCzx6ti0rql6Q2Dc2zSAPmuA and APH_YT_CHANNEL (in pages.jsx) are
// asserted in-code but were NOT verified against the live YouTube channel this session.
// Confirm the channel id and that the live_stream embed still resolves before relying
// on it. Do not treat this id as confirmed.
// Using channel live embed; falls back to latest uploads if no live stream is active.
window.PARL_STREAMS = [
  { id: "house", label: "House of Representatives", channel: "UCzx6ti0rql6Q2Dc2zSAPmuA", desc: "Official Australian Parliament House channel" }, // [VERIFY] channel id
  { id: "senate", label: "Senate chamber", channel: "UCzx6ti0rql6Q2Dc2zSAPmuA", desc: "Senate proceedings (shared APH channel)" }, // [VERIFY] channel id
];

// ---------- Honesty: representative-data flags on entities ----------
// Every entity in ENTITIES is representative (no live feed backs committee profiles,
// member activity counts, minister rosters, or bill provisions per the remediation
// data audit). Stamp representative:true onto every entity so the click-through
// modals can render a "Representative data" chip honestly. The ministers already
// carry the "(fixture)" name convention; this extends the same honesty to all
// entity types. This only ADDS a field; it does not change any field the UI reads.
Object.keys(window.ENTITIES).forEach(group => {
  const bucket = window.ENTITIES[group];
  Object.keys(bucket).forEach(key => {
    if (bucket[key] && bucket[key].representative === undefined) bucket[key].representative = true;
  });
});
