// Extended dataset — entities with rich details for click-through
window.ENTITIES = {
  committees: {
    "legcon": {
      id: "legcon",
      name: "Legal & Constitutional Affairs Legislation Committee",
      chamber: "Senate",
      chair: "Sen. A. Morrow",
      members: 7,
      portfolio: "Attorney-General, Home Affairs, Digital",
      active: 3,
      recentReports: 2,
      bio: "Senate legislation committee responsible for scrutiny of bills and portfolio estimates relating to the Attorney-General's and Home Affairs portfolios. Also considers matters on automation, identity and digital assurance where referred.",
      hearings: [
        { when: "Today, 10:00", topic: "AI assurance in regulated services", room: "Committee Room 2S1" },
        { when: "25 Apr, 09:00", topic: "Digital ID Amendment Bill — submissions", room: "Committee Room 2S1" },
        { when: "02 May, 14:00", topic: "Privacy Act review consultation", room: "Committee Room 2R1" },
      ],
      inquiries: ["Digital ID Amendment Bill 2026", "AI assurance in regulated services", "Identity-matching services review"],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Legal_and_Constitutional_Affairs",
    },
    "finpa": {
      id: "finpa",
      name: "Finance & Public Administration References Committee",
      chamber: "Senate",
      chair: "Sen. J. Prentice",
      members: 6,
      portfolio: "Finance, PM&C, Public administration, Procurement",
      active: 4,
      recentReports: 1,
      bio: "Senate references committee examining matters referred by the Senate relating to finance, public administration, procurement and government operations.",
      hearings: [
        { when: "Today, 13:30", topic: "Commonwealth procurement & contract governance", room: "Committee Room 2S3" },
        { when: "01 May, 10:00", topic: "Consultancy expenditure review", room: "Committee Room 2S3" },
      ],
      inquiries: ["Commonwealth procurement governance (new)", "Consultancy expenditure", "Digital program governance"],
      url: "aph.gov.au/Parliamentary_Business/Committees/Senate/Finance_and_Public_Administration",
    },
    "econ": {
      id: "econ", name: "Economics Legislation Committee", chamber: "Senate",
      chair: "Sen. L. Hartley", members: 6, portfolio: "Treasury, Industry",
      active: 2, recentReports: 0,
      bio: "Senate legislation committee for Treasury and Industry portfolios.",
      hearings: [{ when: "25 Apr, 09:00", topic: "Consumer Data Right — expansion review", room: "Committee Room 2R2" }],
      inquiries: ["Consumer Data Right expansion", "Competition reforms"],
      url: "aph.gov.au/…/Economics",
    },
    "rra": {
      id: "rra", name: "Rural & Regional Affairs Committee", chamber: "Senate",
      chair: "Sen. K. Forrest", members: 6, portfolio: "Regional, Comms, Infrastructure",
      active: 3, recentReports: 1,
      bio: "Committee dealing with rural and regional matters including connectivity and infrastructure.",
      hearings: [{ when: "26 Apr, 14:00", topic: "Regional connectivity outcomes", room: "CR 2S1" }],
      inquiries: ["Regional 5G rollout", "Regional banking"],
      url: "aph.gov.au/…/RRA",
    },
    "jcle": {
      id: "jcle", name: "Joint Committee on Law Enforcement", chamber: "Joint",
      chair: "Hon. P. Chand MP", members: 10, portfolio: "AFP, AIC, ACIC",
      active: 2, recentReports: 1,
      bio: "Joint committee responsible for oversight of Commonwealth law enforcement.",
      hearings: [{ when: "28 Apr, 11:00", topic: "Scam activity trends", room: "CR 1R3" }],
      inquiries: ["Scam activity trends", "AFP capability review"],
      url: "aph.gov.au/…/Law_Enforcement",
    },
    "envcomms": {
      id: "envcomms", name: "Environment & Communications References", chamber: "Senate",
      chair: "Sen. O. Frew", members: 6, portfolio: "Environment, Communications",
      active: 1, recentReports: 1,
      bio: "References committee on environment and communications.",
      hearings: [],
      inquiries: ["Regional 5G rollout", "Spectrum allocation review"],
      url: "aph.gov.au/…/Env_Comms",
    },
    "jcpaa": {
      id: "jcpaa", name: "Joint Committee on Public Accounts & Audit", chamber: "Joint",
      chair: "Hon. R. Calder MP", members: 16, portfolio: "ANAO, cross-portfolio",
      active: 5, recentReports: 2,
      bio: "Joint parliamentary committee overseeing the Auditor-General's reports.",
      hearings: [{ when: "29 Apr, 10:30", topic: "Digital transformation program governance", room: "CR 1R5" }],
      inquiries: ["Digital transformation governance (new)", "Review of ANAO reports tabled Q1"],
      url: "aph.gov.au/…/PAA",
    },
  },

  members: {
    "hollis": {
      id: "hollis", name: "Sen. Arabella Hollis", party: "Opposition", state: "QLD",
      roles: ["Shadow Assistant Minister for Digital Services", "Economics Committee"],
      bio: "Senator for Queensland since 2019. Shadow spokesperson on digital services and procurement. Frequent contributor to estimates on ICT matters.",
      qons: 14, hansard: 28, committees: ["Economics", "Finance & PA"],
    },
    "quirke": {
      id: "quirke", name: "Sen. Marcus Quirke", party: "Crossbench", state: "TAS",
      roles: ["Independent senator"],
      bio: "Senator focused on transparency and consultancy reform. Active in procurement-related QONs.",
      qons: 9, hansard: 17, committees: ["Finance & PA"],
    },
    "rafferty": {
      id: "rafferty", name: "Hon. Priya Rafferty MP", party: "Opposition", state: "VIC",
      roles: ["Shadow Minister for Government Services"],
      bio: "Opposition member · Victoria. Shadow spokesperson on government services and digital delivery.",
      qons: 22, hansard: 41, committees: ["PAA"],
    },
  },

  ministers: {
    "digital": {
      id: "digital", name: "Minister for Digital Services", role: "Minister for Digital Services",
      portfolio: "Digital Services",
      bio: "Minister responsible for digital government, identity, and service delivery.",
      recent: ["Introduced Digital ID Amendment Bill (18 Apr)", "Speech at AIIA forum (20 Apr)", "Response to ANAO report (22 Apr)"],
    },
    "cyber": {
      id: "cyber", name: "Minister for Cyber Security", role: "Minister for Cyber Security",
      portfolio: "Cyber Security",
      bio: "Minister responsible for cyber security policy and co-ordination.",
      recent: ["2nd reading speech on Cyber Security Bill", "Press conference on critical infrastructure"],
    },
  },

  bills: {
    "BILL-2026-048": {
      ref: "BILL-2026-048",
      title: "Digital ID Amendment (Assurance) Bill 2026",
      stage: "House: 2nd reading",
      stageHistory: [
        { when: "18 Apr", event: "Introduced in House" },
        { when: "19 Apr", event: "1st reading" },
        { when: "Today", event: "2nd reading — in progress" },
      ],
      portfolio: "Digital identity",
      minister: "digital",
      digest: "Published",
      owner: "Policy — Identity",
      att: "high",
      purpose: "Amends the Digital ID Act to expand the scope of the accreditation scheme and introduce new consumer assurance provisions, including revised obligations on accredited entities handling biometric attributes.",
      provisions: [
        "Part 2: accreditation scope expanded to cover state-level identity exchanges",
        "Part 4: new reporting obligations on biometric attribute use",
        "Schedule 1: consequential amendments to Privacy Act s.26",
      ],
      watchlists: ["Digital identity", "Data sharing & privacy"],
    },
    "BILL-2026-041": {
      ref: "BILL-2026-041",
      title: "Cyber Security Legislation Amendment Bill 2026",
      stage: "House: 2nd reading today",
      stageHistory: [
        { when: "02 Apr", event: "Introduced in House" },
        { when: "03 Apr", event: "1st reading" },
        { when: "Today", event: "2nd reading — scheduled" },
      ],
      portfolio: "Cyber security", minister: "cyber", digest: "Published",
      owner: "Policy — Cyber", att: "high",
      purpose: "Extends mandatory incident reporting and critical-infrastructure obligations to a wider range of essential services providers.",
      provisions: [
        "Part 1: expanded definition of essential services",
        "Part 3: revised reporting thresholds (72h → 48h)",
        "Schedule 2: penalty regime",
      ],
      watchlists: ["Cyber security"],
    },
    "BILL-2026-037": {
      ref: "BILL-2026-037",
      title: "Consumer Data Right Expansion Bill 2026",
      stage: "Senate: committee stage",
      stageHistory: [{ when: "12 Mar", event: "Introduced" },{ when: "22 Apr", event: "Referred to Economics" }],
      portfolio: "Data & privacy", minister: null, digest: "Published", owner: "Policy — Data", att: "med",
      purpose: "Extends CDR to non-bank lending, telco and energy datasets.", provisions: [], watchlists: ["Data sharing & privacy"],
    },
    "BILL-2026-031": {
      ref: "BILL-2026-031",
      title: "Telecommunications (Regional Connectivity) Amendment Bill",
      stage: "House: 3rd reading",
      stageHistory: [], portfolio: "Infrastructure", minister: null,
      digest: "Pending", owner: "—", att: "med",
      purpose: "Adjusts Universal Service Obligation funding for regional connectivity.", provisions: [], watchlists: ["Infrastructure & connectivity"],
    },
    "BILL-2026-024": {
      ref: "BILL-2026-024",
      title: "Social Services Digital Delivery Amendment Bill",
      stage: "Senate: introduced",
      stageHistory: [], portfolio: "Service delivery", minister: null,
      digest: "Pending", owner: "—", att: "low",
      purpose: "Updates digital delivery obligations for social services.", provisions: [], watchlists: ["Service delivery"],
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
