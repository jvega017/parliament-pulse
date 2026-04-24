// Extended entity detail used by detail modals.
// Typed to catch drift between fixture shape and rendering code.

import type { Entities } from "../types";

export const ENTITIES: Entities = {
  committees: {
    legcon: {
      id: "legcon",
      name: "Legal & Constitutional Affairs Legislation Committee",
      chamber: "Senate",
      chair: "Sen. N. Waters",
      members: 7,
      portfolio: "Attorney-General, Home Affairs, Digital",
      active: 3,
      recentReports: 2,
      bio: "Senate legislation committee responsible for scrutiny of bills and portfolio estimates relating to the Attorney-General's and Home Affairs portfolios. Also considers matters on automation, identity and digital assurance where referred.",
      hearings: [
        { when: "Today, 10:00", topic: "AI assurance in regulated services", room: "Committee Room 2S1" },
        { when: "25 Apr, 09:00", topic: "Digital ID Amendment Bill, submissions", room: "Committee Room 2S1" },
        { when: "02 May, 14:00", topic: "Privacy Act review consultation", room: "Committee Room 2R1" },
      ],
      inquiries: [
        "Digital ID Amendment Bill 2026",
        "AI assurance in regulated services",
        "Identity-matching services review",
      ],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Legal_and_Constitutional_Affairs",
    },
    finpa: {
      id: "finpa",
      name: "Finance & Public Administration References Committee",
      chamber: "Senate",
      chair: "Sen. R. Thorpe",
      members: 6,
      portfolio: "Finance, PM&C, Public administration, Procurement",
      active: 4,
      recentReports: 1,
      bio: "Senate references committee examining matters referred by the Senate relating to finance, public administration, procurement and government operations.",
      hearings: [
        { when: "Today, 13:30", topic: "Commonwealth procurement & contract governance", room: "Committee Room 2S3" },
        { when: "01 May, 10:00", topic: "Consultancy expenditure review", room: "Committee Room 2S3" },
      ],
      inquiries: [
        "Commonwealth procurement governance (new)",
        "Consultancy expenditure",
        "Digital program governance",
      ],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Finance_and_Public_Administration",
    },
    econ: {
      id: "econ",
      name: "Economics Legislation Committee",
      chamber: "Senate",
      chair: "Sen. D. Pocock",
      members: 6,
      portfolio: "Treasury, Industry",
      active: 2,
      recentReports: 0,
      bio: "Senate legislation committee for Treasury and Industry portfolios.",
      hearings: [
        { when: "25 Apr, 09:00", topic: "Consumer Data Right, expansion review", room: "Committee Room 2R2" },
      ],
      inquiries: ["Consumer Data Right expansion", "Competition reforms"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics",
    },
    rra: {
      id: "rra",
      name: "Rural & Regional Affairs Committee",
      chamber: "Senate",
      chair: "Sen. B. McKenzie",
      members: 6,
      portfolio: "Regional, Comms, Infrastructure",
      active: 3,
      recentReports: 1,
      bio: "Committee dealing with rural and regional matters including connectivity and infrastructure.",
      hearings: [
        { when: "26 Apr, 14:00", topic: "Regional connectivity outcomes", room: "CR 2S1" },
      ],
      inquiries: ["Regional 5G rollout", "Regional banking"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport",
    },
    jcle: {
      id: "jcle",
      name: "Joint Committee on Law Enforcement",
      chamber: "Joint",
      chair: "Hon. S. Georganas MP",
      members: 10,
      portfolio: "AFP, AIC, ACIC",
      active: 2,
      recentReports: 1,
      bio: "Joint committee responsible for oversight of Commonwealth law enforcement.",
      hearings: [{ when: "28 Apr, 11:00", topic: "Scam activity trends", room: "CR 1R3" }],
      inquiries: ["Scam activity trends", "AFP capability review"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Law_Enforcement",
    },
    envcomms: {
      id: "envcomms",
      name: "Environment & Communications References",
      chamber: "Senate",
      chair: "Sen. P. Hanson-Young",
      members: 6,
      portfolio: "Environment, Communications",
      active: 1,
      recentReports: 1,
      bio: "References committee on environment and communications.",
      hearings: [],
      inquiries: ["Regional 5G rollout", "Spectrum allocation review"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Environment_and_Communications",
    },
    jcpaa: {
      id: "jcpaa",
      name: "Joint Committee on Public Accounts & Audit",
      chamber: "Joint",
      chair: "Hon. J. Hill MP",
      members: 16,
      portfolio: "ANAO, cross-portfolio",
      active: 5,
      recentReports: 2,
      bio: "Joint parliamentary committee overseeing the Auditor-General's reports.",
      hearings: [
        { when: "29 Apr, 10:30", topic: "Digital transformation program governance", room: "CR 1R5" },
      ],
      inquiries: [
        "Digital transformation governance (new)",
        "Review of ANAO reports tabled Q1",
      ],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Public_Accounts_and_Audit",
    },
  },

  members: {
    hollis: {
      id: "hollis",
      name: "Sen. Arabella Hollis",
      party: "Opposition",
      state: "QLD",
      roles: ["Shadow Assistant Minister for Digital Services", "Economics Committee"],
      bio: "Senator for Queensland since 2019. Shadow spokesperson on digital services and procurement. Frequent contributor to estimates on ICT matters.",
      qons: 14,
      hansard: 28,
      committees: ["Economics", "Finance & PA"],
    },
    quirke: {
      id: "quirke",
      name: "Sen. Marcus Quirke",
      party: "Crossbench",
      state: "TAS",
      roles: ["Independent senator"],
      bio: "Senator focused on transparency and consultancy reform. Active in procurement-related QONs.",
      qons: 9,
      hansard: 17,
      committees: ["Finance & PA"],
    },
    rafferty: {
      id: "rafferty",
      name: "Hon. Priya Rafferty MP",
      party: "Opposition",
      state: "VIC",
      roles: ["Shadow Minister for Government Services"],
      bio: "Member for Higgins since 2022. Shadow spokesperson on government services and digital delivery.",
      qons: 22,
      hansard: 41,
      committees: ["PAA"],
    },
  },

  ministers: {
    digital: {
      id: "digital",
      name: "Hon. C. Linden MP",
      role: "Minister for Digital Services",
      portfolio: "Digital Services",
      bio: "Minister responsible for digital government, identity, and service delivery.",
      recent: [
        "Introduced Digital ID Amendment Bill (18 Apr)",
        "Speech at AIIA forum (20 Apr)",
        "Response to ANAO report (22 Apr)",
      ],
    },
    cyber: {
      id: "cyber",
      name: "Hon. K. Beaumont MP",
      role: "Minister for Cyber Security",
      portfolio: "Cyber Security",
      bio: "Minister responsible for cyber security policy and co-ordination.",
      recent: [
        "2nd reading speech on Cyber Security Bill",
        "Press conference on critical infrastructure",
      ],
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
        { when: "Today", event: "2nd reading, in progress" },
      ],
      portfolio: "Digital identity",
      minister: "digital",
      digest: "Published",
      owner: "Policy — Identity",
      att: "high",
      purpose:
        "Amends the Digital ID Act to expand the scope of the accreditation scheme and introduce new consumer assurance provisions, including revised obligations on accredited entities handling biometric attributes.",
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
        { when: "Today", event: "2nd reading, scheduled" },
      ],
      portfolio: "Cyber security",
      minister: "cyber",
      digest: "Published",
      owner: "Policy — Cyber",
      att: "high",
      purpose:
        "Extends mandatory incident reporting and critical-infrastructure obligations to a wider range of essential services providers.",
      provisions: [
        "Part 1: expanded definition of essential services",
        "Part 3: revised reporting thresholds (72h to 48h)",
        "Schedule 2: penalty regime",
      ],
      watchlists: ["Cyber security"],
    },
    "BILL-2026-037": {
      ref: "BILL-2026-037",
      title: "Consumer Data Right Expansion Bill 2026",
      stage: "Senate: committee stage",
      stageHistory: [
        { when: "12 Mar", event: "Introduced" },
        { when: "22 Apr", event: "Referred to Economics" },
      ],
      portfolio: "Data & privacy",
      minister: null,
      digest: "Published",
      owner: "Policy — Data",
      att: "med",
      purpose: "Extends CDR to non-bank lending, telco and energy datasets.",
      provisions: [],
      watchlists: ["Data sharing & privacy"],
    },
    "BILL-2026-031": {
      ref: "BILL-2026-031",
      title: "Telecommunications (Regional Connectivity) Amendment Bill",
      stage: "House: 3rd reading",
      stageHistory: [],
      portfolio: "Infrastructure",
      minister: null,
      digest: "Pending",
      owner: "—",
      att: "med",
      purpose: "Adjusts Universal Service Obligation funding for regional connectivity.",
      provisions: [],
      watchlists: ["Infrastructure & connectivity"],
    },
    "BILL-2026-024": {
      ref: "BILL-2026-024",
      title: "Social Services Digital Delivery Amendment Bill",
      stage: "Senate: introduced",
      stageHistory: [],
      portfolio: "Service delivery",
      minister: null,
      digest: "Pending",
      owner: "—",
      att: "low",
      purpose: "Updates digital delivery obligations for social services.",
      provisions: [],
      watchlists: ["Service delivery"],
    },
  },
};

// Reverse lookup: committee item name -> committee entity id.
// Replaces the `matchId` function in the prototype that silently routed
// every "Joint ..." committee to `jcle` because it matched on the first
// word and stopped. This is an exact-or-substring match with a deterministic
// ranking by overlap length.
const COMMITTEE_NAME_INDEX: Record<string, string> = {
  "Legal & Constitutional Affairs Legislation Committee": "legcon",
  "Finance & Public Administration References": "finpa",
  "Economics Legislation Committee": "econ",
  "Rural & Regional Affairs Committee": "rra",
  "Joint Committee on Law Enforcement": "jcle",
  "Environment & Communications References": "envcomms",
  "Joint Committee on Public Accounts & Audit": "jcpaa",
};

export function committeeIdFromName(name: string): string | null {
  if (COMMITTEE_NAME_INDEX[name]) return COMMITTEE_NAME_INDEX[name];
  // Fallback: best overlap by shared keyword count (case-insensitive)
  const lowered = name.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const committee of Object.values(ENTITIES.committees)) {
    const keyWords = committee.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    let score = 0;
    for (const word of keyWords) {
      if (lowered.includes(word)) score += word.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { id: committee.id, score };
    }
  }
  return best?.id ?? null;
}
