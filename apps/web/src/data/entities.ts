// Reference directory of real public APH committees and a stub map for
// members, ministers, and bills.
//
// Production data policy: only entities that can be verified against a
// canonical APH page are included here. Names below match the published
// committee titles on aph.gov.au. Member counts, chair attribution,
// portfolio scope, hearings, and inquiries are intentionally NOT
// pre-populated because they change per parliament and we will not
// fabricate that detail. Each record links to the authoritative APH
// page so users can read the current state of play.
//
// Members, ministers, and bills are empty maps until a verified data
// source (Senators_and_Members roster, ministry list, Bills Search)
// is wired in.

import type { Entities } from "../types";

export const ENTITIES: Entities = {
  committees: {
    legcon: {
      id: "legcon",
      name: "Legal and Constitutional Affairs Legislation Committee",
      chamber: "Senate",
      chair: "",
      members: 0,
      portfolio: "Attorney-General, Home Affairs",
      active: 0,
      recentReports: 0,
      bio: "Senate legislation committee responsible for scrutiny of bills and portfolio estimates relating to the Attorney-General's and Home Affairs portfolios. Open the APH committee page for the current chair, members, inquiries, and report list.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Legal_and_Constitutional_Affairs",
    },
    finpa: {
      id: "finpa",
      name: "Finance and Public Administration References Committee",
      chamber: "Senate",
      chair: "",
      members: 0,
      portfolio: "Finance, PM and Cabinet, Public administration",
      active: 0,
      recentReports: 0,
      bio: "Senate references committee examining matters referred by the Senate relating to finance, public administration, procurement, and government operations. Open the APH committee page for the current chair, members, and active inquiries.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Finance_and_Public_Administration",
    },
    econ: {
      id: "econ",
      name: "Economics Legislation Committee",
      chamber: "Senate",
      chair: "",
      members: 0,
      portfolio: "Treasury, Industry",
      active: 0,
      recentReports: 0,
      bio: "Senate legislation committee for the Treasury and Industry portfolios. Open the APH committee page for the current chair, members, and reports.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Economics",
    },
    rrat: {
      id: "rrat",
      name: "Rural and Regional Affairs and Transport Committee",
      chamber: "Senate",
      chair: "",
      members: 0,
      portfolio: "Regional, Communications, Infrastructure, Transport",
      active: 0,
      recentReports: 0,
      bio: "Senate committee dealing with rural, regional, communications, infrastructure, and transport matters. Open the APH committee page for current detail.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Rural_and_Regional_Affairs_and_Transport",
    },
    jcle: {
      id: "jcle",
      name: "Parliamentary Joint Committee on Law Enforcement",
      chamber: "Joint",
      chair: "",
      members: 0,
      portfolio: "AFP, ACIC, Australian Institute of Criminology",
      active: 0,
      recentReports: 0,
      bio: "Joint committee responsible for oversight of Commonwealth law enforcement. Open the APH committee page for current detail.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Law_Enforcement",
    },
    envcomms: {
      id: "envcomms",
      name: "Environment and Communications References Committee",
      chamber: "Senate",
      chair: "",
      members: 0,
      portfolio: "Environment, Communications",
      active: 0,
      recentReports: 0,
      bio: "Senate references committee on environment and communications. Open the APH committee page for the current chair, members, and inquiries.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Environment_and_Communications",
    },
    jcpaa: {
      id: "jcpaa",
      name: "Joint Committee of Public Accounts and Audit",
      chamber: "Joint",
      chair: "",
      members: 0,
      portfolio: "ANAO, cross-portfolio",
      active: 0,
      recentReports: 0,
      bio: "Joint parliamentary committee overseeing the Auditor-General's reports. Open the APH committee page for the current chair, members, and active reviews.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Public_Accounts_and_Audit",
    },
    pjcis: {
      id: "pjcis",
      name: "Parliamentary Joint Committee on Intelligence and Security",
      chamber: "Joint",
      chair: "",
      members: 0,
      portfolio: "ASIO, ASIS, ASD, AFP, ONI",
      active: 0,
      recentReports: 0,
      bio: "Joint statutory committee overseeing the Australian intelligence community. Open the APH committee page for current detail.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Intelligence_and_Security",
    },
    jchr: {
      id: "jchr",
      name: "Parliamentary Joint Committee on Human Rights",
      chamber: "Joint",
      chair: "",
      members: 0,
      portfolio: "Human rights, scrutiny of bills",
      active: 0,
      recentReports: 0,
      bio: "Joint statutory committee that scrutinises bills and legislative instruments for compatibility with human rights. Open the APH committee page for current detail.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Joint/Human_Rights_inquiries",
    },
    selscrut: {
      id: "selscrut",
      name: "Senate Standing Committee for the Scrutiny of Bills",
      chamber: "Senate",
      chair: "",
      members: 0,
      portfolio: "Bills scrutiny (rights, liberties, obligations)",
      active: 0,
      recentReports: 0,
      bio: "Senate standing committee that examines all bills introduced into the Parliament against scrutiny principles. Open the APH committee page for current detail.",
      hearings: [],
      inquiries: [],
      url: "https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Scrutiny_of_Bills",
    },
  },

  // Members and ministers are intentionally empty until a verified roster
  // source is wired in. The UI renders an empty state with a deep link to
  // the canonical Senators_and_Members directory.
  members: {},
  ministers: {},

  // Bills are intentionally empty until the Bills Search ingest is wired
  // in. The UI links to the live APH Bills Search.
  bills: {},
};

// Committee name to id lookup used by list pages so the prototype's first-
// word matching cannot silently route Joint committees to the wrong entity.
const COMMITTEE_NAME_INDEX: Record<string, string> = {
  "Legal and Constitutional Affairs Legislation Committee": "legcon",
  "Finance and Public Administration References Committee": "finpa",
  "Economics Legislation Committee": "econ",
  "Rural and Regional Affairs and Transport Committee": "rrat",
  "Parliamentary Joint Committee on Law Enforcement": "jcle",
  "Environment and Communications References Committee": "envcomms",
  "Joint Committee of Public Accounts and Audit": "jcpaa",
  "Parliamentary Joint Committee on Intelligence and Security": "pjcis",
  "Parliamentary Joint Committee on Human Rights": "jchr",
  "Senate Standing Committee for the Scrutiny of Bills": "selscrut",
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
