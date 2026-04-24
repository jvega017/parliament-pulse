// Extended entity detail used by detail modals.
//
// IMPORTANT — these records are SAMPLE PERSONAS for design review, not real
// current parliamentarians. They are labelled with a leading "[Sample]"
// prefix so the UI cannot accidentally attribute real portfolios to the
// wrong person. For production use, repopulate from the APH Senators &
// Members roster at https://www.aph.gov.au/Senators_and_Members.

import type { Entities } from "../types";

export const ENTITIES: Entities = {
  committees: {
    legcon: {
      id: "legcon",
      name: "Legal & Constitutional Affairs Legislation Committee",
      chamber: "Senate",
      chair: "[Sample] Senator A",
      members: 7,
      portfolio: "Attorney-General, Home Affairs, Digital",
      active: 3,
      recentReports: 2,
      bio: "Senate legislation committee responsible for scrutiny of bills and portfolio estimates relating to the Attorney-General's and Home Affairs portfolios. Also considers matters on automation, identity and digital assurance where referred.",
      hearings: [
        { when: "Today, 10:00", topic: "AI assurance in regulated services", room: "Committee Room 2S1" },
        { when: "Next sitting week", topic: "Digital ID Amendment Bill, submissions", room: "Committee Room 2S1" },
      ],
      inquiries: [
        "Digital ID Amendment Bill 2026",
        "AI assurance in regulated services",
      ],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Legal_and_Constitutional_Affairs",
    },
    finpa: {
      id: "finpa",
      name: "Finance & Public Administration References Committee",
      chamber: "Senate",
      chair: "[Sample] Senator B",
      members: 6,
      portfolio: "Finance, PM&C, Public administration, Procurement",
      active: 4,
      recentReports: 1,
      bio: "Senate references committee examining matters referred by the Senate relating to finance, public administration, procurement and government operations.",
      hearings: [
        { when: "Today, 13:30", topic: "Commonwealth procurement & contract governance", room: "Committee Room 2S3" },
      ],
      inquiries: [
        "Commonwealth procurement governance (new)",
        "Consultancy expenditure",
      ],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Finance_and_Public_Administration",
    },
    econ: {
      id: "econ",
      name: "Economics Legislation Committee",
      chamber: "Senate",
      chair: "[Sample] Senator C",
      members: 6,
      portfolio: "Treasury, Industry",
      active: 2,
      recentReports: 0,
      bio: "Senate legislation committee for Treasury and Industry portfolios.",
      hearings: [
        { when: "Next sitting week", topic: "Consumer Data Right, expansion review", room: "Committee Room 2R2" },
      ],
      inquiries: ["Consumer Data Right expansion", "Competition reforms"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics",
    },
    rra: {
      id: "rra",
      name: "Rural & Regional Affairs Committee",
      chamber: "Senate",
      chair: "[Sample] Senator D",
      members: 6,
      portfolio: "Regional, Comms, Infrastructure",
      active: 3,
      recentReports: 1,
      bio: "Committee dealing with rural and regional matters including connectivity and infrastructure.",
      hearings: [
        { when: "Next sitting week", topic: "Regional connectivity outcomes", room: "CR 2S1" },
      ],
      inquiries: ["Regional 5G rollout", "Regional banking"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport",
    },
    jcle: {
      id: "jcle",
      name: "Joint Committee on Law Enforcement",
      chamber: "Joint",
      chair: "[Sample] MP E",
      members: 10,
      portfolio: "AFP, AIC, ACIC",
      active: 2,
      recentReports: 1,
      bio: "Joint committee responsible for oversight of Commonwealth law enforcement.",
      hearings: [{ when: "Next sitting week", topic: "Scam activity trends", room: "CR 1R3" }],
      inquiries: ["Scam activity trends", "AFP capability review"],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Law_Enforcement",
    },
    envcomms: {
      id: "envcomms",
      name: "Environment & Communications References",
      chamber: "Senate",
      chair: "[Sample] Senator F",
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
      chair: "[Sample] MP G",
      members: 16,
      portfolio: "ANAO, cross-portfolio",
      active: 5,
      recentReports: 2,
      bio: "Joint parliamentary committee overseeing the Auditor-General's reports.",
      hearings: [
        { when: "Next sitting week", topic: "Digital transformation program governance", room: "CR 1R5" },
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
      name: "[Sample] Senator Alpha",
      party: "Opposition",
      state: "QLD",
      roles: ["Shadow Assistant Minister for Digital Services", "Economics Committee"],
      bio: "Sample senator persona used for design review. Shadow portfolio roles and statistics in this profile are synthetic. For real member data, see the APH Senators & Members roster.",
      qons: 14,
      hansard: 28,
      committees: ["Economics", "Finance & PA"],
    },
    quirke: {
      id: "quirke",
      name: "[Sample] Senator Beta",
      party: "Crossbench",
      state: "TAS",
      roles: ["Independent senator"],
      bio: "Sample senator persona focused on transparency and consultancy reform. All figures below are synthetic.",
      qons: 9,
      hansard: 17,
      committees: ["Finance & PA"],
    },
    rafferty: {
      id: "rafferty",
      name: "[Sample] MP Gamma",
      party: "Opposition",
      state: "VIC",
      roles: ["Shadow Minister for Government Services"],
      bio: "Sample MP persona representing a shadow services spokesperson. Not a real member or electorate.",
      qons: 22,
      hansard: 41,
      committees: ["PAA"],
    },
  },

  ministers: {
    digital: {
      id: "digital",
      name: "[Sample] Minister for Digital Services",
      role: "Minister for Digital Services",
      portfolio: "Digital Services",
      bio: "Sample minister persona for the Digital Services portfolio. Not a real officeholder.",
      recent: [
        "Sample: Introduced Digital ID Amendment Bill",
        "Sample: Speech at AIIA forum",
        "Sample: Response to ANAO report",
      ],
    },
    cyber: {
      id: "cyber",
      name: "[Sample] Minister for Cyber Security",
      role: "Minister for Cyber Security",
      portfolio: "Cyber Security",
      bio: "Sample minister persona for the Cyber Security portfolio. Not a real officeholder.",
      recent: [
        "Sample: 2nd reading speech on Cyber Security Bill",
        "Sample: Press conference on critical infrastructure",
      ],
    },
  },

  bills: {
    "BILL-2026-048": {
      ref: "BILL-2026-048",
      title: "[Sample] Digital ID Amendment (Assurance) Bill 2026",
      stage: "Sample: House 2nd reading",
      stageHistory: [
        { when: "Prior sitting", event: "Introduced in House" },
        { when: "Prior sitting", event: "1st reading" },
        { when: "Current sitting", event: "2nd reading in progress" },
      ],
      portfolio: "Digital identity",
      minister: "digital",
      digest: "Published",
      owner: "Policy, Identity",
      att: "high",
      purpose:
        "Sample bill used for design review. Illustrates an amendment to expand the accreditation scheme and introduce new consumer assurance provisions, including obligations on accredited entities handling biometric attributes.",
      provisions: [
        "Part 2: accreditation scope expanded to cover state-level identity exchanges",
        "Part 4: new reporting obligations on biometric attribute use",
        "Schedule 1: consequential amendments to Privacy Act s.26",
      ],
      watchlists: ["Digital identity", "Data sharing & privacy"],
    },
    "BILL-2026-041": {
      ref: "BILL-2026-041",
      title: "[Sample] Cyber Security Legislation Amendment Bill 2026",
      stage: "Sample: House 2nd reading",
      stageHistory: [
        { when: "Prior sitting", event: "Introduced in House" },
        { when: "Prior sitting", event: "1st reading" },
        { when: "Current sitting", event: "2nd reading scheduled" },
      ],
      portfolio: "Cyber security",
      minister: "cyber",
      digest: "Published",
      owner: "Policy, Cyber",
      att: "high",
      purpose:
        "Sample bill illustrating mandatory incident reporting and critical-infrastructure obligations extended to a wider range of essential services providers.",
      provisions: [
        "Part 1: expanded definition of essential services",
        "Part 3: revised reporting thresholds (72h to 48h)",
        "Schedule 2: penalty regime",
      ],
      watchlists: ["Cyber security"],
    },
    "BILL-2026-037": {
      ref: "BILL-2026-037",
      title: "[Sample] Consumer Data Right Expansion Bill 2026",
      stage: "Sample: Senate committee stage",
      stageHistory: [
        { when: "Prior sitting", event: "Introduced" },
        { when: "Prior sitting", event: "Referred to Economics" },
      ],
      portfolio: "Data & privacy",
      minister: null,
      digest: "Published",
      owner: "Policy, Data",
      att: "med",
      purpose: "Sample bill illustrating CDR extension to non-bank lending, telco and energy datasets.",
      provisions: [],
      watchlists: ["Data sharing & privacy"],
    },
    "BILL-2026-031": {
      ref: "BILL-2026-031",
      title: "[Sample] Telecommunications (Regional Connectivity) Amendment Bill",
      stage: "Sample: House 3rd reading",
      stageHistory: [],
      portfolio: "Infrastructure",
      minister: null,
      digest: "Pending",
      owner: "—",
      att: "med",
      purpose: "Sample bill adjusting Universal Service Obligation funding for regional connectivity.",
      provisions: [],
      watchlists: ["Infrastructure & connectivity"],
    },
    "BILL-2026-024": {
      ref: "BILL-2026-024",
      title: "[Sample] Social Services Digital Delivery Amendment Bill",
      stage: "Sample: Senate introduced",
      stageHistory: [],
      portfolio: "Service delivery",
      minister: null,
      digest: "Pending",
      owner: "—",
      att: "low",
      purpose: "Sample bill updating digital delivery obligations for social services.",
      provisions: [],
      watchlists: ["Service delivery"],
    },
  },
};

// Committee name to id lookup used by list pages so the prototype's first-
// word matching cannot silently route Joint committees to the wrong entity.
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
