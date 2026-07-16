# Critical review of the research operating pack, version 1.0

**Document under review:** Connecting the AI Economy: multi-agent research and publication workflow, version 1.0, 15 July 2026
**Review date:** 16 July 2026
**Method:** Deep multi-source web research (22 sources fetched, 95 claims extracted, 25 adversarially verified) plus an independent structural review of the workflow design. Verification status for every factual claim used here is recorded in `03-evidence-annex.md`.

## Overall verdict

The plan is unusually good for its genre. The sequencing (novelty before design, design before data, data before drafting), the separation of duties, the claims ledger and the fallback ladder are all sound and should be preserved. The two central self-diagnoses in section 15, that the main risk is a topical policy essay dressed as economics and that public data cannot support a causal empirical paper, are correct.

However, the plan is already out of date on the facts, and several of its factual premises have inverted since it was drafted. The research question survives, and is arguably stronger than the plan believes, but the framing, the seed bibliography, the mechanism menu and parts of the workflow need revision. The workflow itself is over-engineered for a single unfunded author and under-specified where it matters most (budgets, verification tiering, a pre-analysis plan, regulatory tripwires).

Findings are classified with the plan's own severity scheme: S0 stop-ship, S1 major, S2 moderate, S3 minor.

---

## Part A. Factual and currency findings

### A1. The plan's central empirical caution is now outdated: phantom demand in Australia is documented, not hypothetical (S1)

Section 1.2 states: "Whether a material form of phantom demand exists in Australia is an empirical question, not an established premise." That was the right posture in early 2025. It is no longer the state of play:

- AEMO received **44 GW** of data centre connection requests from network service providers in the 2025 IASR process (verified 3-0).
- Oxford Economics, commissioned by AEMO, estimates **6 in every 7 MW** of those requests are "phantom demand" that will not materialise under the Step Change scenario (verified 3-0).
- Filtering for likelihood to proceed and **duplicate applications across networks** reduces the 44 GW stock to about 7.9 GW of prospective projects, of which about 6 GW is required under Step Change (verified 3-0).
- Even proceeding projects (~6 GW requested) are expected to draw only **~2.8 GW at maturity**, because requests are sized on peak plus redundancy buffers (verified 3-0).
- Nearly 90 per cent of the phantom demand comes from projects that will simply not proceed; the briefing explicitly characterises requests as firms competing to lock in scarce capacity ahead of rivals (verified 3-0). Note the follow-on briefing was commissioned by AWS, a party with a commercial interest in the "do not overbuild for us" framing; the underlying July 2025 forecast report was commissioned by AEMO itself.
- Independent DNSP-level corroboration: United Energy's December 2025 regulatory proposal probability-weights its own data centre pipeline down by about 44 per cent, and documents 27 new proponent requests totalling ~1,679 MW across the Victorian Power Networks group since November 2024 (single extraction from the AER-published document; not adversarially verified).

**Consequence.** The paper no longer needs to establish that phantom demand exists; it needs to *decompose and price* it. The three-way decomposition visible in the Oxford numbers (non-proceeding projects ~90 per cent, duplication, and the utilisation wedge between requested capacity and coincident draw) maps directly onto different mechanisms: non-proceeding and duplication are screening problems, the utilisation wedge is a product-design and pricing problem. The plan's H1 should be recast accordingly, and the problem statement should cite this evidence rather than treating existence as open. Two cautions must survive the reframing: "phantom" is defined relative to a forecast scenario, not observed outcomes, and the headline source has a commissioning conflict that the evidence protocol should flag.

### A2. The plan miscasts the AEMC's live reform: Package 2 is system security, not capacity allocation (S1)

The seed list cites "AEMC (2026), Improving the NEM access standards: Package 2" in a context implying connection-capacity relevance. Verified reality (3-0):

- The rule change exists, reached **draft determination on 12 March 2026**, and is about **disturbance ride-through access standards** for large inverter-based loads. It raises the large-load threshold from 5 MW to 30 MW, adds a three-tier classification for distribution-connected loads (up to 30 MW, 30 to 100 MW, 100 MW plus), and harmonises with standards proposed or used in Texas, Ireland and Finland.
- It does **not** address queue management, capacity allocation, reservation pricing or cost allocation for scarce connection capacity.
- Submissions closed 7 May 2026; the final determination has been **extended to 29 October 2026**, which lands mid-project on the plan's own schedule.

**Consequence.** Two edits. First, the institutional section must present Package 2 accurately as the security-standards workstream, useful context but not a capacity-allocation reform; a referee who knows the NEM would catch the conflation immediately. Second, and more valuable: the fact that Australia's only live large-load connection reform is technical, while Texas, Great Britain and Ireland have all moved on allocation and pricing in the last 18 months, means there is a **documented policy vacuum in Australia on exactly the paper's question**. That strengthens the contribution claim and should be stated in the introduction. It also creates a currency risk: the workflow needs a standing regulatory watch (see Part B) because the final determination, and any new AEMC or ministerial initiative on connection allocation, could land during drafting.

### A3. The plan implicitly assumes a transmission problem; 98 per cent of Australian data centre consumption is distribution-connected (S1)

The Oxford Economics report (single extraction, primary source): FY25 data centre consumption was 3.9 TWh, about 2 per cent of NEM grid-supplied consumption, of which **over 98 per cent is connected at distribution level** and only ~1.5 per cent at transmission level. Meanwhile AEMO's Quarterly Energy Dynamics for Q1 2026 disclosed, for the first time, a **transmission** connection pipeline of 11 projects above 5 MW totalling 5.4 GW of maximum demand, roughly 60 per cent in New South Wales and 40 per cent in Victoria, with a ~2 year application-to-energisation experience and a 5 to 10 year assumed ramp.

**Consequence.** The stock is a DNSP story; the pipeline is increasingly a TNSP story. The model and institutional map must cover both connection levels explicitly (who allocates, who pays, AER customer-contribution policy at distribution, negotiated transmission connections), or the paper must openly scope to one level and defend the choice. The plan's institutional prompt (8.4) mentions both but the method specification (section 9) is silent on connection level. United Energy's accepted 85 per cent customer contribution rate for data centre connections, and the 1 July 2026 change making high-voltage and sub-transmission connections liable for tax on capital contributions, are concrete distribution-level pricing parameters the plan did not know existed.

### A4. The mechanism menu is no longer hypothetical: every candidate mechanism is now live policy somewhere (S2)

Since the plan's mechanism list (section 4, baseline mechanisms 1 to 6) was drafted, the international landscape has hardened:

- **Texas.** SB6 and PUCT draft rule 16 TAC §25.194 (published 12 March 2026): a **non-refundable interconnection fee of USD 50,000 per MW** of contracted peak demand, financial security, 100 per cent up-front payment of direct interconnection costs, mandatory disclosure of parallel or substantially similar requests by the same company or affiliates (an explicit anti-duplication rule with defined materiality thresholds), site control extending at least five years beyond the contracted peak-demand date, and mandatory remote-curtailment capability (the "kill switch") for loads interconnected after 31 December 2025. On 18 June 2026 the PUCT approved ERCOT's **Batch Zero** clustered study process for 75 MW plus loads, gated by maturity criteria, with a curtailable-connection pathway for earlier access; batch inclusion notices are due August 2026. ERCOT is tracking **438 GW** of large-load requests, ~90 per cent from data centres. (All single extraction from primary and reputable secondary sources; the FERC and Texas verification votes were lost to a rate limit, not refuted.)
- **United States federal.** On 18 June 2026 FERC issued **six show cause orders** under FPA section 206 to PJM, MISO, SPP, CAISO, ISO-NE and NYISO, requiring within 60 days tariff justifications or reforms across five categories including new transmission services for flexible large loads, co-location, cost-shift prevention, and study processes.
- **Great Britain.** The TMO4+ "First Ready, First Connected" reform replaces first-come-first-served; Gate 2 requires demonstrated land rights and validated planning applications. Critically for this paper, **demand projects are deemed "needed" and face only the readiness test**, a design asymmetry between generation and load worth analysing.
- **Ireland.** CRU decision CRU/2025/236 (12 December 2025) supersedes the 2021 direction: new data centres must bring dispatchable generation or storage matched to their maximum import capacity and participate in the wholesale market, meet at least 80 per cent of annual demand from additional Irish renewables on a six-year glide path, and are assessed on a location-specific constrained/unconstrained basis, with system operators obliged to publish available-capacity information regularly.
- **Australia.** The DISR "Expectations of data centres and AI infrastructure developers" (released **23 March 2026**, verified to exist) is a non-binding framework with regulatory teeth via prioritisation: Commonwealth assessments will deprioritise energy-intensive proposals not aligned with expectations that include paying full connection costs, underwriting additional clean generation and offering demand flexibility. This is Australia's de facto administrative maturity screen and must be analysed as the incumbent mechanism, not ignored.

**Consequence.** Opportunity and threat. Opportunity: the paper gains real parameter anchors (USD 50,000 per MW fee, five-year site control, 80 per cent additionality, curtailment-for-earlier-access products) and a natural comparative-institutional table. Threat: a paper that *proposes* deposits, maturity tests or curtailable products as ideas is now behind the news cycle. The contribution must be repositioned as **evaluative and theoretical**: when does each mechanism dominate, what is the option value being given away or priced, which mechanism combinations are welfare-superior under private information about maturity, and what does that imply for the Australian vacuum. The plan's section 1.6 contribution test should be tightened to reflect this.

### A5. The closest-papers set is now identifiable, and the gap survives (S2)

The novelty scan converged on five works any contribution claim must beat:

1. **Johnston, Liu and Yang (2023), NBER WP 31946**, "An Empirical Analysis of the Interconnection Queue". Dynamic structural model of the US generation queue; finds most entrants never complete, congestion raises waiting times, high interconnection costs drive withdrawal, and that **screening mechanisms and flat entry fees increase completed capacity**. This is the methodological benchmark. It is generation-side and US; a load-side, mechanism-design treatment with private maturity information and an Australian institutional application is an extension, not a duplication. (Claims single-extraction; verification votes lost to rate limit.)
2. **Norris, Profeta, Patino-Echeverri and Cowie-Haskell (2025), Duke Nicholas Institute**, "Rethinking Load Growth": 76 to 126 GW of new US load integrable at 0.25 to 1.0 per cent annual curtailment rates; short average curtailment durations (1.7 to 2.5 hours); ~90 per cent of curtailment hours retain at least half the load. The quantitative case for curtailable connection products.
3. **Knittel, Senga and Wang (2025/2026)**, MIT CEEPR WP 2025-14, also NBER w34065, published in iScience 2026: flexible data centres reduce system costs (up to ~5 per cent in Texas) but can **raise emissions ~3 per cent** in low-renewables grids. Models temporal shifting, not capacity allocation.
4. **Kay, Reaser and Taylor (2026)**, "Processing Power: The Effect of Data Centers on Wholesale Electricity Markets", Federal Reserve Bank of Dallas WP 2606, March 2026: existing US data centres have raised wholesale prices ~3 to 5 per cent; 2028 scenarios span +20 to +50 per cent. Dispatch simulation, not mechanism design. **The plan's attribution ("Kay, O.") is incomplete and the title is wrong.**
5. **Riepin, Zavala and Brown (2025)**, "Spatio-temporal load shifting for truly clean computing", Advances in Applied Energy 17, 100202: flexibility worth 1.29 ± 0.07 EUR/MWh per percentage point of flexible load for 24/7 CFE matching; open-source model re-calibratable to the NEM. **The plan's "Riepin, I., and colleagues (2025)" omits the journal, co-authors and the fact the code is reusable.**

None of these prices or allocates scarce locational connection capacity under uncertain, staged, partly flexible load with private maturity information. The gap the plan bets on is real as of this review. The plan should name these five works in section 1.6 so the H1 gate has a concrete target, and the literature agent's first task becomes verification and extension of this list rather than a cold start.

### A6. Seed bibliography corrections (S2, one item S1)

| Seed entry (v1.0) | Status | Correction |
|---|---|---|
| AEMO (2026) 2026 ISP | Unverified in this run | The fetch of the presumed ISP PDF URL failed. The 2026 ISP is expected in mid-2026 on AEMO's cycle but its publication status and content must be confirmed before citation. Mark TO BE CONFIRMED. |
| Oxford Economics Australia (2025) data centre forecasts | **Verified (3-0)** | Correct title: "Data Centre Energy Demand Final Report", July 2025, commissioned by AEMO for the 2025 IASR, hosted on AEMO's consultation site. Add the companion November 2025 phantom-demand research briefing (AWS-commissioned; conflict flag). |
| AEMC (2026) Improving the NEM access standards: Package 2 | **Verified (3-0), miscast** | Exists; draft determination 12 March 2026; final determination due 29 October 2026. It is a system-security standards reform, not capacity allocation. Reposition (finding A2). |
| AEMC (2026) Data \| Power: Navigating policy, regulation and networks | Verified with correction (single extraction) | Not a Commission publication; it is a **speech by AEMC Commissioner Rainer Korte**, delivered 28 April 2026 in Melbourne, published on the AEMC site. Cite as a speech. |
| DISR (2026) Expectations of data centres and AI infrastructure developers | Verified (single extraction) | Released 23 March 2026; five expectations; enforced via Commonwealth regulatory prioritisation. |
| DCCEEW (2025) CER Roadmap update | Not examined | Peripheral to the core question; verify before use or drop. |
| MIT CEEPR (2025) Flexible Data Centers | **Verified (single extraction, primary)** | Attribute to authors: Knittel, Senga and Wang, CEEPR WP 2025-14; NBER w34065; published in iScience (2026). |
| Riepin and colleagues (2025) | Verified with correction | Riepin, Zavala and Brown, Advances in Applied Energy 17 (2025), 100202; arXiv 2405.00036; open-source code (Zenodo 10869650). |
| Kay, O. (2026), Dallas Fed | **Verified with correction** | Kay, Reaser and Taylor, "Processing Power: The Effect of Data Centers on Wholesale Electricity Markets", Dallas Fed WP 2606, March 2026. Add the companion Dallas Fed Economics inflation article (Kay, Kilian and Taylor, 5 March 2026). |
| ENTSO-E (2026) Data centres and the power system | Unverified | Not located in this run. Confirm existence and exact title before citation. |

**Missing from the seed list entirely** (all should be added): Johnston, Liu and Yang NBER 31946; Norris et al. Duke report; Texas SB6, PUCT draft 16 TAC §25.194 and ERCOT Batch Zero; the FERC show cause orders of 18 June 2026; Ireland CRU/2025/236; GB TMO4+/Gate 2 materials; AEMO Quarterly Energy Dynamics Q1 2026 (first public NEM data centre connection-pipeline statistics); United Energy December 2025 revised proposal and AER determination materials (DNSP-level pipeline and contribution-rate evidence); Lawrence Berkeley National Laboratory queue statistics as the standard US queue-attrition reference.

### A7. New public data improves feasibility beyond what the plan assumed (S2)

The plan's Phase 3 candidate-input list is missing the three most useful newly public series: AEMO QED quarterly data centre connection-pipeline statistics (from Q1 2026), the Oxford Economics calibration set (FY25 baseline 3.9 TWh; Step Change 25.1 per cent CAGR to 12.0 TWh by FY30 and 34.5 TWh by FY50; the 44/7.9/6/2.8 GW funnel), and probability-weighted DNSP pipeline disclosures inside AER regulatory filings. Project-level application data remains non-public, so the plan's core judgement (model-led paper, causal empirics as upgrade path) stands. But a **descriptive empirical module** (the Australian connection funnel, requested versus realised, duplication rates) is now feasible from public sources and materially strengthens the calibration and motivation sections without overclaiming causality.

---

## Part B. Structural findings on the workflow itself

### B1. Role inflation for a single unfunded author (S1)

Twelve core roles, five optional specialists and eight reviewer types, each with prompts, context curation and output QA, all funnelling through one Human Director who signs seven gates. The plan never costs this. Distinguish *hats* (checklist-driven functions) from *agent instances* (separate context windows). Consolidation that loses nothing material: Literature Agent + Evidence Librarian (one agent, two-pass protocol: screen, then extract); Data Agent + Modelling Agent stay separate (the rerun independence matters); Controller + run log are bookkeeping, not a personality. Seven roles suffice. The version 2.0 plan implements this.

### B2. No effort or token budget anywhere (S1)

Every phase should carry an explicit budget (agent-hours or token allowance) and a "what we drop first" rule. Without it, the tournament and review phases will silently consume the project.

### B3. The design tournament runs before anyone has touched the data (S1)

Phase 2 (design tournament) precedes Phase 3 (data feasibility), yet the plan's own executive judgement already concedes Design C's data probably do not exist. Competing designs should be scored against *known* data constraints. Fix: insert a short **data-scouting spike** (2 to 3 days, no modelling) before the tournament, producing a one-page inventory of what is actually available (now partly known from A7). The tournament then shrinks to two live designs plus a descriptive empirical module, and Gate H2 locks against reality.

### B4. No pre-analysis plan artefact (S1)

Section 8.6 says "preregistered sensitivity tests" but no artefact or gate produces a pre-analysis plan. A model-led paper's chief vulnerability is the accusation that assumptions were tuned to produce the headline result. A short locked analysis plan (hypothesis-to-test mapping, welfare metric definition, mechanism-ranking criteria, sensitivity grid) as a required Gate H2 output is cheap and is the single highest-leverage credibility upgrade available.

### B5. No mid-project regulatory tripwire (S1, elevated by Part A)

The plan re-runs literature searches before submission only. Given the AEMC final determination is due 29 October 2026, FERC compliance filings land August 2026, and ERCOT Batch Zero notices land August 2026 with a transmission plan in late 2027, the probability that a material development lands mid-project is near one. Add a standing weekly regulatory watch (30 minutes, fixed source list) with an escalation rule: if the closest-paper set or the Australian mechanism status changes, the Director is notified within the week, not at submission.

### B6. Verification is flat where it should be tiered (S2)

Every material claim gets the same page-level verification, and nobody verifies the verifier. Tier it: headline results, institutional-rule claims and all numbers appearing in the abstract get dual independent verification; background and contextual claims get single-pass. This review itself demonstrates the failure mode: a rate limit killed 13 of 25 verification votes, and a flat protocol gives no guidance on what to re-verify first.

### B7. State machine has no legal loop-backs (S2)

CHARTER through RELEASE is drawn linear with side exits. Real projects loop (a referee finding at Phase 6 forces a Phase 4 rerun). Make loops explicit and logged (REVIEW to ANALYSIS with a deviation notice) rather than pretending linearity.

### B8. Journal style and length are hardcoded prematurely (S2)

APA 7 appears in three places and 9,000 to 11,000 words is assumed, but economics venues (Energy Economics, The Energy Journal, Energy Policy, Economic Record, Utilities Policy) have different reference styles and length norms, and section 2's own word budget sums to 9,150 to 12,400 words, exceeding its stated ceiling. Fix: style and length become Gate H1 outputs (after venue shortlisting), with APA 7 retained as the default for the working-paper version only. Reconcile the arithmetic.

### B9. Three hand-synchronised CSVs (S2)

Source register, evidence matrix and claims ledger overlap and will drift. Use one relational store (SQLite, or one spreadsheet with three sheets) plus a consistency-check script run automatically at every gate; a failed check blocks the gate pack.

### B10. Toolchain never chosen (S2)

Reproducibility is demanded but no language, environment manager, reference manager or build tool is named. Decide at Phase 0: git; Python (or Julia) with a lockfile; Zotero + BibTeX/CSL; a Makefile or single entry script; plain-text manuscript source (LaTeX or Quarto) with the Word version generated, not hand-maintained. "Manuscript.docx" and "manuscript.tex" as sibling sources (section 4.1) is a consistency bug waiting to happen; pick one source of truth.

### B11. Smaller inconsistencies (S3)

- The "Global Comparison Agent" appears in Phase 1 but not in the roles table.
- Hypotheses H1 to H6 are not all testable by the preferred design (H5 cost incidence is largely institutional accounting); map each hypothesis to design, artefact and claim class up front, and label the qualitative ones as such.
- The LinkedIn guidance conflicts: section 5 Phase 7 schedules the article at release; section 14 recommends publishing a question-framed series during research. Pick the section 14 position and extend the conflict protocol to interim posts.
- The "no em dashes" style rule sits inside the controller's non-negotiable governance rules; move style to a style-sheet artefact.
- Model-family diversity for reviewers (6.4) is a good idea the plan cannot guarantee; restate as "different prompt lineage at minimum, different model family where available".

---

## Part C. What the improved plan changes

Version 2.0 (`02-improved-plan-v2.md`) implements every S1 finding and most S2 findings:

1. Problem statement and H1 reframed around the now-documented phantom-demand evidence and its three-way decomposition (A1), with the conflict caveat institutionalised.
2. Institutional section corrected on Package 2 and extended with the DISR Expectations as incumbent mechanism, dual connection-level scope, and the Australian allocation vacuum as an explicit contribution hook (A2, A3, A4).
3. Contribution test rewritten against the five named closest works (A5).
4. Seed evidence base corrected and doubled, with per-source verification status (A6).
5. Data inventory updated; a descriptive empirical module added to the design space (A7).
6. Roles consolidated 12 to 7; per-phase budgets added; data-scouting spike inserted before a two-design tournament; pre-analysis plan required at H2; standing regulatory watch with tripwires; tiered verification; legal loop-backs; venue-dependent style decision at H1; single relational evidence store with gate-blocking consistency checks; explicit toolchain (B1 to B10).
7. Schedule rebuilt around the external regulatory calendar (AEMC final determination 29 October 2026 falls in the drafting window and is handled by design, not by luck).
