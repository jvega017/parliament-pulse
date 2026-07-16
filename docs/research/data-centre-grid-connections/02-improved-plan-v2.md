# Connecting the AI Economy
## Multi-agent research and publication workflow

**Paper concept:** Pricing and reserving scarce locational electricity-grid capacity under uncertain data-centre demand in Australia
**Primary output:** A submission-ready economics research paper, working-paper version and reproducibility package
**Language and style:** Australian English, plain and sceptical academic prose. Reference style: APA 7 for the working paper; journal style decided at Gate H1.
**Workflow status:** Research operating pack, version 2.0, 16 July 2026. Supersedes version 1.0 (15 July 2026). Changes are documented in `01-critical-review.md`; evidence supporting factual statements is in `03-evidence-annex.md`.

## Executive judgement

This project should not begin with a swarm writing sections of a paper. It should begin with a controlled sequence that establishes novelty, tests whether the necessary data exist, locks the research design and only then permits drafting. That judgement from version 1.0 stands.

Three facts have changed since version 1.0 was drafted, and they change the paper's posture:

1. **Phantom demand in Australia is documented, not hypothetical.** AEMO received 44 GW of data centre connection requests in the 2025 IASR process. Oxford Economics, commissioned by AEMO, estimates 6 in every 7 MW will not materialise under the Step Change scenario: filtering for likelihood to proceed and duplicate applications leaves 7.9 GW of prospective projects, about 6 GW is needed, and those projects would draw only about 2.8 GW at maturity. The paper's job is no longer to ask whether speculative reservation exists. It is to decompose it (projects that will not proceed, duplicated applications, and the wedge between requested capacity and coincident draw) and to ask which mechanism prices each component efficiently.
2. **Every candidate mechanism is now live policy somewhere, except in Australia.** Texas prices large-load connection with a non-refundable USD 50,000 per MW fee, site-control maturity tests, anti-duplication disclosure and mandatory curtailability, and has moved to clustered batch studies. FERC has ordered all six US RTOs to justify or reform their large-load rules. Great Britain allocates by readiness gates. Ireland requires matched dispatchable capacity, renewable additionality and locational assessment. Australia's only live connection reform (AEMC access standards Package 2, final determination due 29 October 2026) is about system security, not capacity allocation, and the Commonwealth's March 2026 Expectations framework is a soft administrative screen. The contribution is therefore **evaluative, not propositional**: not "Australia should consider deposits and curtailable products" but "here is when each mechanism dominates, what option value current arrangements give away, and what the feasible Australian implementation is".
3. **The closest literature is identifiable and beatable.** Five works define the frontier (section 1.6). None prices or allocates scarce locational connection capacity under uncertain, staged, partly flexible load with private maturity information, and none applies such a framework to Australian institutions.

The initial ambition remains a model-led Australian institutional paper supported by calibrated simulations. A causal empirical paper remains an upgrade path, not the baseline promise. But a **descriptive empirical module** built from newly public data (the AEMO connection funnel, quarterly pipeline statistics, DNSP probability-weighted pipelines) is now feasible and should anchor the calibration and motivation.

The multi-agent design keeps four governing principles:

1. One controller manages workflow state, but does not determine substantive conclusions.
2. No agent approves its own work.
3. Every material claim, parameter and calculation must be traceable to evidence or clearly labelled as an assumption.
4. Human approval is required whenever the research question, method, contribution, data treatment or normative recommendation changes.

And adds two:

5. Every phase has an explicit effort budget and a pre-committed kill or narrow criterion.
6. Verification effort is tiered by the damage an error would cause, and headline claims are verified twice, independently.

## 1. Locked research brief

### 1.1 Provisional title

**The Option Value of a Grid Connection: Data Centres, Demand Uncertainty and Efficient Capacity Reservation**

Alternative title for a policy-facing working paper:

**Connecting the AI Economy: Pricing Scarce Grid Capacity Under Uncertain Data-Centre Demand**

### 1.2 Problem statement

Data centres can request very large electricity connections years before their ultimate demand is realised. In Australia this is no longer a conjecture about behaviour: network service providers reported 44 GW of data centre connection requests into AEMO's 2025 planning process, of which an estimated 6 in 7 MW will not materialise under AEMO's central scenario. The excess decomposes into three distinct phenomena with different economics:

- **Non-proceeding projects** (about 90 per cent of the phantom component): applications lodged for projects that will never be built at that site, consistent with firms competing to lock in scarce capacity ahead of rivals.
- **Duplication**: the same project applying at multiple sites or to multiple networks, inflating apparent demand in system planning.
- **The utilisation wedge**: even proceeding projects request roughly double their expected coincident draw, because requests are sized on peak, redundancy and growth buffers.

Where applicants do not face the opportunity cost of reservation or induced expansion, networks may overbuild, credible projects may be delayed behind speculative ones, and costs may shift to other electricity users. The opposite error is equally real: requiring every project to fund firm capacity from day one may deter productive investment, ignore staged development, and fail to reward loads capable of shifting or curtailing.

Two institutional cautions frame the Australian analysis. First, the NEM has no single load-connection queue or centrally allocated block of tradable capacity; connections are negotiated bilaterally with the relevant network service provider, with AEMO involved in performance-standard and security processes, and over 98 per cent of existing data centre consumption is connected at distribution level even as the new large-project pipeline shifts to transmission. Any model must be explicit about which connection level it describes. Second, the headline phantom-demand estimates are scenario-relative (defined against Step Change, not observed outcomes) and the most-cited briefing was commissioned by a hyperscaler; the evidence protocol treats these as flagged, conflicted sources to be used with attribution, not as neutral ground truth.

### 1.3 Primary research question

How should Australian electricity networks reserve, expand and price scarce locational grid capacity when prospective data-centre loads are large, staged, uncertain and partly flexible?

### 1.4 Secondary questions

1. What market failure, if any, arises from current bilateral connection, planning and cost-recovery arrangements, given the documented request-to-realisation funnel?
2. When does a connection right function as an option over scarce future network capacity, and what is that option worth?
3. Which mechanisms best reveal project maturity and expected utilisation, and how do the live implementations (Texas fees and site-control tests, GB readiness gates, Irish matched-capacity obligations, Australian administrative expectations) map onto the mechanism space?
4. When are flexible or curtailable connections more efficient than firm access plus augmentation?
5. How should stranding, delay, reliability and distributional risks be allocated between developers, networks and other consumers?
6. Which Australian legal and institutional constraints limit the feasible mechanism set, at distribution and at transmission level?

### 1.5 Candidate hypotheses

These are propositions to test, not conclusions to defend. Each is mapped to the design that addresses it and the claim class its answer will carry (model output, calibrated estimate, or institutional inference). Hypotheses that will be addressed qualitatively are labelled as such now, not discovered to be untestable later.

**H1: Underpriced reservation (model output, calibrated).** Where charges do not reflect the opportunity cost of reserving or inducing expansion of scarce locational capacity, applicants request earlier or larger connection rights than under efficient pricing. The Australian request-to-realisation funnel (44 to 7.9 to 6 to 2.8 GW) provides calibration targets for the equilibrium request-inflation a candidate mechanism must rationalise; the model is estimated or calibrated to reproduce this funnel, then used to price it.

**H2: Information revelation (model output).** Milestone-contingent deposits or reservation charges reduce low-maturity applications more efficiently than undifferentiated administrative screening. Benchmark implementations: Texas USD 50,000 per MW non-refundable fee versus GB Gate 2 readiness tests versus the DISR Expectations prioritisation screen.

**H3: Contract menus (model output).** A menu of firm and curtailable connection products produces higher welfare than a uniform firm-access product when workloads vary in flexibility and delay cost. Benchmark: ERCOT's curtailable-connection pathway and SB6 mandatory curtailability.

**H4: Staging (model output).** Ramp-up schedules and use-it-or-lose-it provisions reduce stranded network investment without materially reducing completion of high-value projects. Calibration: AEMO's 5 to 10 year observed ramp assumption.

**H5: Cost incidence (institutional inference, qualitative with worked examples).** Weak cost-allocation rules can transfer a material share of forecast-error and stranding risk from large loads to other network users. Addressed through the institutional map (AER contribution policies, the 85 per cent customer-contribution precedent, the 2026 tax treatment change) with model-based illustrations, not claimed as a general equilibrium result.

**H6: Locational and temporal flexibility (model output plus specialist review).** Connection contracts rewarding locational and temporal flexibility can reduce augmentation and system costs, but the benefit depends on latency, workload portability and credible measurement. The Riepin, Zavala and Brown open-source framework provides a tested quantification approach re-calibratable to NEM regions.

### 1.6 Contribution test

The novelty bar is now concrete. The paper proceeds only if it adds something material beyond each of the five closest works:

1. **Johnston, Liu and Yang (2023), NBER WP 31946.** Dynamic structural model of the US generation interconnection queue; shows screening and flat entry fees raise completed capacity. Gap: generation-side, queue-institution-specific, no private-information mechanism comparison, no load-side or Australian application.
2. **Norris, Profeta, Patino-Echeverri and Cowie-Haskell (2025), Duke Nicholas Institute.** Empirical headroom under curtailment tolerance (76 to 126 GW US-wide at 0.25 to 1.0 per cent curtailment). Gap: engineering headroom, not allocation or pricing; no mechanism.
3. **Knittel, Senga and Wang (2025/2026), MIT CEEPR WP 2025-14 / iScience.** Capacity-expansion value of temporal data-centre flexibility, with the emissions caveat. Gap: no connection-capacity scarcity, no allocation problem.
4. **Kay, Reaser and Taylor (2026), Dallas Fed WP 2606.** Dispatch-model estimates of data-centre effects on wholesale prices. Gap: price incidence, not connection allocation; treats the pipeline as exogenous scenarios.
5. **Riepin, Zavala and Brown (2025), Advances in Applied Energy.** Spatio-temporal load shifting value for carbon-free matching. Gap: operational optimisation, not mechanism design or institutions.

The paper's claim: a mechanism-design treatment of **load-side connection capacity as a priced option**, integrating uncertain staged demand, private maturity information and heterogeneous flexibility, applied to Australian institutions where no allocation reform yet exists. If the updated literature scan finds a paper occupying this square, the Research Director narrows to the Australian institutional application or invokes the fallback ladder.

Secondary contribution test: the institutional analysis must say something not already resolved by the live overseas reforms; comparative synthesis of Texas, GB, Ireland and the FERC orders is table stakes for the setting section, not a contribution.

## 2. Target paper architecture

Length and reference style are locked at Gate H1 after venue shortlisting. Working default: 9,000 to 11,000 words excluding references and appendices, and the section budgets below are set to sum inside that ceiling at their upper bound. Cutting removes secondary material rather than compressing every paragraph.

1. **Abstract**, 150 to 200 words.
2. **Introduction**, 900 to 1,100 words: puzzle, the Australian funnel evidence, contribution, findings and limits.
3. **Australian institutional setting**, 900 to 1,200 words: NEM connection processes at distribution and transmission level, planning, cost recovery, the security-standards reform correctly characterised, the DISR Expectations as incumbent screen, and the allocation vacuum.
4. **International mechanism benchmarks**, 600 to 800 words: Texas, FERC, GB, Ireland as implemented mechanism types (fees, readiness gates, matched capacity, curtailable products), reported as institutional facts feeding the model, not as a survey.
5. **Literature and contribution**, 900 to 1,100 words: anchored on the five closest works.
6. **Economic framework**, 1,400 to 1,800 words: agents, information, timing, capacity constraint, contract space, welfare function.
7. **Method and calibration**, 800 to 1,000 words: including the Australian funnel calibration targets.
8. **Results**, 1,100 to 1,500 words.
9. **Robustness and sensitivity**, 600 to 900 words.
10. **Institutional feasibility and distributional effects**, 700 to 1,000 words.
11. **Discussion and limitations**, 500 to 800 words.
12. **Conclusion**, 300 to 450 words.

Upper-bound total: 10,850 words excluding the abstract. The paper must distinguish positive findings from normative recommendations. A mechanism that improves modelled total welfare may still be infeasible, inequitable or inconsistent with the National Electricity Objective and existing legal arrangements.

## 3. Operating model

### 3.1 Roles

Version 1.0 defined twelve core roles plus specialists. For a single unfunded author that is workflow theatre: every role costs prompting, context curation and output review, and the Human Director pays that cost at each of seven gates. Version 2.0 distinguishes **roles** (checklist-driven hats) from **agent instances** (separate context windows), and consolidates to seven core roles. Separation of duties is preserved where it earns its cost: nobody approves their own substantive output, the analysis is rerun independently, and review is adversarial.

| Role | Core responsibility | Prohibited action | Required output |
|---|---|---|---|
| Human Research Director | Owns question, contribution, method, publication decision | Delegating final judgement to the controller | Signed gate decisions and change log |
| Orchestration Controller | Assigns work, checks prerequisites, versions, state; runs the consistency-check script at each gate | Creating or approving substantive conclusions | Run log, task manifests, gate packs |
| Research Design Lead | Questions, hypotheses, conceptual model, pre-analysis plan | Approving its own model or results | Research charter, design memo, locked analysis plan |
| Evidence Agent (merges v1 Literature Agent and Evidence Librarian) | Two-pass protocol: pass 1 systematic search and screening; pass 2 acquisition and page-level extraction into the evidence store. Also runs the weekly regulatory watch. | Drafting novelty claims from snippets; interpreting beyond the source | Search log, screening register, evidence store, novelty map, watch bulletins |
| Institutional Economics Agent | NEM rules and actors at both connection levels, incentives, cost allocation, feasible reforms, international benchmark table | Legal advice; inventing confidential practice | Institutional map, mechanism-feasibility table, benchmark table |
| Modelling and Estimation Agent | Formalises mechanisms, calibrates, runs scenarios per the locked analysis plan | Altering raw data; accepting its own model; post-hoc specification changes without a deviation notice | Model spec, code, results, diagnostics |
| Data and Reproducibility Agent | Builds datasets from immutable raw inputs; independent clean-environment rerun of all results | Choosing samples or transformations because they improve results | Data dictionary, pipeline scripts, validation and rerun reports |

Review functions are **instances, not standing roles**, activated at Phase 6 with fresh context: economics referee, methods referee, power-systems referee, cloud-compute referee, institutional and legal referee, citation auditor, code red-team, writing editor. The Manuscript Agent and Publication Editor from v1 become two phases of one writing role with different checklists and fresh context between them.

Reviewer independence: at minimum a different prompt lineage with no access to the drafting agent's reasoning; where more than one model family is available, use a family not used for analysis or drafting.

### 3.2 Separation of duties

- The Evidence Agent's pass 1 (screening) and pass 2 (extraction) are separate runs; extraction sees only accepted sources, not the screening rationale.
- The Modelling Agent produces results. The Data Agent reruns them in a clean environment. Differences are stop-ship defects.
- The writing role drafts. The citation auditor verifies. Polishing happens only after substantive acceptance.
- The Controller can reject incomplete work against mechanical criteria, but cannot declare a disputed economic conclusion correct.

### 3.3 Permission model

| Permission | Controller | Research agents | Review instances | Human Director |
|---|---:|---:|---:|---:|
| Read approved corpus | Yes | Yes | Yes | Yes |
| Add candidate sources | Assign only | Yes | Recommend only | Yes |
| Accept source into corpus | No | Evidence Agent proposes | Audit | Yes at disputed cases |
| Modify raw data | No | Data Agent only, by scripted copy | No | Authorise exceptions |
| Run analysis | Assign | Modelling and Data Agents | Code red-team only | Yes |
| Change research question | No | Propose | Challenge | Approve |
| Change model specification | No | Propose with deviation notice | Challenge | Approve after design lock |
| Edit manuscript | Route changes | Writing role | Comments only | Approve publication version |
| Approve phase gate | Mechanical pre-check | No | Recommend | Yes |

## 4. Single source of truth

### 4.1 Folder structure and toolchain

Toolchain decisions are made at Phase 0, not deferred: **git** for versioning; **Python** with a locked environment (uv or conda lockfile) for all analysis; **Zotero with Better BibTeX** as the reference manager exporting `references.bib`; **Quarto or LaTeX as the single manuscript source** with Word outputs generated, never hand-edited; a **Makefile or single entry script** so the full pipeline runs with one command; **SQLite** (or one spreadsheet with three validated sheets) as the relational evidence store replacing v1's three hand-synchronised CSVs, with a consistency-check script the Controller runs at every gate. A failed consistency check blocks the gate pack.

```text
data-centre-connections-paper/
  00_governance/
    research_charter.md
    analysis_plan.md          # locked at H2
    style_sheet.md            # all prose rules live here, not in prompts
    decisions.md
    change_log.md
    run_log.jsonl
    task_manifest.yaml
  01_literature/
    search_protocol.md
    search_log.csv
    screening_register.csv
    novelty_map.md
    regulatory_watch.md       # weekly bulletin, tripwire log
  02_evidence/
    sources/                  # archived PDFs where lawful
    evidence.db               # source register, evidence matrix, claims ledger, parameter ledger
    checks/                   # consistency-check script and gate reports
  03_institutions/
    nem_process_map.md        # distribution AND transmission tracks
    legal_rule_register.csv
    mechanism_benchmarks.md   # Texas, FERC, GB, Ireland, DISR as-implemented table
    mechanism_feasibility.md
  04_data/
    raw_read_only/
    interim/
    processed/
    data_dictionary.csv
    provenance.json
  05_analysis/
    model_specification.md
    code/
    outputs/
    diagnostics/
    robustness/
  06_manuscript/
    manuscript.qmd            # single source; .docx and .pdf are build artefacts
    references.bib
    figures/
    tables/
  07_review/
    referee_reports/
    claims_audits/
    response_matrix.csv
    final_qa.md
  08_release/
    working_paper.pdf
    journal_submission/
    policy_brief.pdf
    replication_package/
    README.md
```

Raw data are immutable. Every transformation from raw to processed is scripted. Manual corrections require a logged correction file with reason, author, date and original value.

### 4.2 Evidence store schemas

The store keeps v1's four schemas (source register, evidence matrix, claims ledger, parameter ledger) as related tables with the same required fields, plus:

- **Conflict flag** on sources: commissioning party and interest (for example, the AWS-commissioned phantom-demand briefing), advocacy funding, or professional proximity.
- **Verification tier** on claims: Tier 1 (headline results, institutional-rule statements, every number in the abstract) requires two independent verifications; Tier 2 (supporting quantitative claims) requires one page-level verification; Tier 3 (background and context) requires source linkage only.
- **Scenario dependence** on parameters: values defined relative to a forecast scenario (Step Change) are labelled as such and never presented as observed outcomes.

No quantitative or causal claim may be marked accepted merely because it has a citation. The cited evidence must support the exact magnitude, population, period and direction asserted. Assumed parameters are labelled `ASSUMPTION`, never given a pseudo-citation.

## 5. Phase workflow, budgets and human gates

Each phase carries an effort budget (Director hours are the binding constraint; agent effort scales with them) and a pre-committed kill or narrow criterion. Budgets are targets with a 50 per cent overrun tripwire: exceeding one triggers a scope decision, not silent absorption.

### Phase 0: Charter, toolchain and conflict check

**Budget:** 1 week; Director 4 hours.

1. Research Design Lead prepares the charter.
2. Institutional Agent drafts the conflict and disclaimer protocol covering the author's professional proximity to Queensland Government energy matters, **including interim public commentary** (LinkedIn posts during research), not only the final paper.
3. Controller confirms no confidential government or commercial information is in scope, and records the toolchain decisions (section 4.1).

**Gate H0:** question and audience approved; conflict and disclosure protocol settled; toolchain locked; no confidential data in scope.
**Stop condition:** any part of the argument depends on non-public information that cannot lawfully be disclosed.

### Phase 1: Novelty confirmation and institutional scan

**Budget:** 2 weeks; Director 6 hours.

The scan starts from the verified corpus in `03-evidence-annex.md`, not from zero. Workstreams:

- Evidence Agent (pass 1): systematic search to confirm, extend or overturn the five-closest-works list; backward and forward citation chasing; working papers and regulator consultations included. Exact queries, dates, filters and counts logged.
- Evidence Agent (pass 2): acquisition and page-level extraction of accepted sources into the evidence store, with conflict flags.
- Institutional Agent: NEM process map at both connection levels; status table of Australian reforms (access standards Package 2 correctly characterised as security standards, final determination due 29 October 2026; DISR Expectations of 23 March 2026 as the incumbent soft screen; any AEMC, AEMO, AER or ministerial work on connection allocation); international benchmark table (Texas SB6 and 16 TAC §25.194, ERCOT Batch Zero, FERC show cause orders, GB TMO4+ Gate 2, Ireland CRU/2025/236).
- **Standing regulatory watch begins:** 30 minutes weekly against a fixed source list (AEMC, AEMO, AER, DISR, FERC, PUCT/ERCOT, Ofgem/NESO, CRU), producing a one-line bulletin. Tripwire: any development that changes the closest-paper set, the Australian mechanism status or a calibration anchor escalates to the Director within the week. The watch runs until submission; searches are also re-run in full immediately before submission.

**Outputs:** PRISMA-style screening record, 30 to 60 core sources, novelty memorandum against the five closest works, institutional timeline, venue shortlist with style and length implications.

**Gate H1:** proceed, narrow or abandon. The Director signs a one-page contribution statement against each of the five closest works (updated if the scan moved the list), and locks target venue class, reference style and length budget.
**Kill criterion (pre-committed):** if the scan finds a paper that prices load-side connection capacity as an option under private maturity information, narrow to the Australian institutional application or drop to the fallback ladder. Comparative description of overseas reforms alone does not clear the bar.

### Phase 2: Data-scouting spike, then design selection

**Budget:** 2 weeks total; Director 6 hours. The spike is 2 to 3 days and precedes any design work.

**Phase 2a, data-scouting spike (new in v2.0).** No modelling. Produce a one-page data inventory: what exists, at what granularity, with what access cost. Known starting points:

- AEMO Quarterly Energy Dynamics data centre connection-pipeline statistics (from Q1 2026: 11 projects above 5 MW, 5.4 GW, 60/40 NSW/Victoria, about two years application to energisation).
- Oxford Economics calibration set (FY25 3.9 TWh baseline; over 98 per cent distribution-connected; Step Change 25.1 per cent average annual growth to 12.0 TWh by FY30 and 34.5 TWh by FY50; the 44 to 7.9 to 6 to 2.8 GW funnel).
- AER regulatory filings exposing DNSP pipelines (United Energy December 2025: 27 requests, about 1,679 MW since November 2024; expected capacity 44 per cent below pipeline; 85 per cent customer contribution rate; capital-contribution tax change from 1 July 2026).
- AEMO ISP 2026 and IASR inputs (confirm publication status), ESOO, NEMWeb, network annual planning reports, overseas queue datasets (LBNL for the US; NESO and EirGrid publications).
- Confirmation of what remains non-public: project-level applications, confidential connection terms, study costs, withdrawal dates.

**Phase 2b, design selection.** Two live designs compete, scored against the actual inventory:

- **Design A, contract model plus calibrated simulation.** A network allocates constrained capacity among projects with private maturity, uncertain staged demand, delay costs and heterogeneous flexibility. Calibration targets: reproduce the Australian funnel.
- **Design B, real-options and queue model.** Connection rights as options over future capacity; tests reservation fees, deposits, milestones, use-it-or-lose-it; extends the Johnston, Liu and Yang apparatus to load-side private information.

Both designs incorporate a **descriptive empirical module** (the Australian funnel, duplication and realisation statistics from public data) as motivation and calibration. Version 1.0's standalone causal-empirical Design C is retired as a competitor; it remains the documented upgrade path if project-level data are later obtained.

Each design team specifies assumptions, welfare criterion, required data, identification or calibration risks, falsification tests and what failure looks like. An independent referee instance scores novelty, internal validity, data feasibility, policy relevance, reproducibility and false-precision risk.

**Gate H2, design lock:** one primary design, one fallback, and the **locked pre-analysis plan** (new in v2.0): hypothesis-to-test mapping, welfare metric definition, mechanism-ranking criteria, the full sensitivity grid, and the claim class each hypothesis's answer will carry. Post-lock specification changes require a design-deviation notice recorded in the change log.

### Phase 3: Pilot

**Budget:** 2 weeks; Director 4 hours.

- Build a five to ten project or stylised-node sample spanning both connection levels.
- Complete one raw-to-result reproducible pipeline, one command.
- Estimate effort for the full build; identify missing variables and defensible proxies.
- Preliminary sensitivity pass on the parameters the pre-analysis plan flags as decisive.

**Gate H3, feasibility:** confirm full build, switch to fallback, or stop. No full-scale data collection before this gate.

### Phase 4: Full analysis

**Budget:** 3 weeks; Director 8 hours, including a mid-phase checkpoint.

Required model components:

- finite network connection capacity by location, time and connection level;
- project private information about maturity or completion probability;
- staged demand ramp (anchored to the observed 5 to 10 year ramp), never instantaneous nameplate load;
- the requested-versus-drawn utilisation wedge as a modelled object, not an afterthought;
- firm and flexible connection products;
- developer delay and curtailment costs;
- network augmentation, congestion, reliability and stranding costs;
- explicit cost incidence;
- social welfare measure and distributional outputs;
- baseline allocation mechanism and at least three alternatives.

**Mechanism set, anchored to live implementations:**

1. first-come or administratively sequenced connection (status quo baseline);
2. administrative maturity or alignment screening (GB Gate 2; DISR Expectations);
3. reservation charge or non-refundable fee (Texas USD 50,000 per MW as a calibration point);
4. staged use-it-or-lose-it rights with milestones;
5. auction or priority pricing;
6. menu of firm and curtailable contracts (ERCOT curtailable pathway; SB6 curtailability);
7. matched-capacity or additionality obligations (Ireland CRU/2025/236) as a comparison case.

**Mandatory sensitivity dimensions:** completion probability, ramp, flexibility cost, network lead time, augmentation cost, forecast correlation, fee or deposit size, market concentration, risk aversion, and scenario dependence of the calibration funnel.

**Mid-phase checkpoint (new in v2.0):** calibration sign-off by the Director before welfare and mechanism-comparison runs, preventing expensive wrong-direction computation.

The Data Agent independently reruns the complete analysis in a clean environment. Differences are stop-ship defects.

**Gate H4, results acceptance:** the Director approves which results are robust enough to report and which remain illustrative.

### Phase 5: Manuscript drafting

**Budget:** 2 weeks; Director 6 hours.

Drafting order: method and model; results and robustness; institutional setting and benchmarks; literature and contribution; discussion and limitations; introduction; abstract and conclusion.

The writing role receives only the approved outline, evidence store, accepted outputs and the style sheet. Claim IDs are inserted during drafting with verification tiers. Unsupported transitions, broad claims and rhetorical inflation are prohibited. Every section closes with an internal note listing unresolved claims, assumptions and likely referee objections, removed only after resolution.

**Gate H5, full-draft acceptance:** coherent enough for independent review. Polishing before this point is wasted effort.

### Phase 6: Adversarial review

**Budget:** 2 weeks; Director 8 hours.

Eight review instances run independently and in parallel (economics, methods, power systems, cloud compute, institutional and legal, citation audit, code red-team, writing). Reviewers do not see each other's reports until all are lodged. Findings are classified S0 to S3 as in v1. The response matrix records finding, decision, rationale, change and verification. Reviewers may be answered, never silently ignored.

**Loop-back is legal and logged:** an S0 or S1 finding that invalidates a result returns the project to Phase 4 with a deviation notice; the state machine records the loop rather than pretending linearity.

**Gate H6:** all S0 closed; all S1 closed or explicitly accepted by the Director with reasons.

### Phase 7: Publication and release

**Budget:** 1 week; Director 4 hours.

Required package: working paper PDF with author information and disclaimer; journal-format manuscript per the H1 venue decision (generated from the single source); anonymised version if required; references database; figures and tables in editable and publication formats (readable in grayscale, accessible to colour-vision-deficient readers); online appendix; data and code package or a precise access-restriction disclosure; one-command reproducibility README; conflicts, funding and AI-assistance statements; two-page policy brief; public article per the section 13 rules; submission checklist and cover letter.

A release comparison script checks every repeated number across manuscript, brief and public article. **Searches and the regulatory watch are re-run in full before submission**; material developments (for example the AEMC final determination of 29 October 2026, FERC compliance outcomes, Batch Zero results) are incorporated or explicitly scoped out in the discussion.

## 6. Controller logic

### 6.1 State machine

```text
CHARTER -> NOVELTY -> SCOUT+DESIGN -> PILOT -> ANALYSIS -> DRAFT -> REVIEW -> RELEASE
             |            |             |         ^  |        |       |  |
             v            v             v         |  v        v       |  v
           NARROW      REDESIGN      FALLBACK     | RERUN   REVISE    | HOLD
                                                  |                   |
                                                  +---- loop-back ----+
                (REVIEW may return to ANALYSIS with a logged deviation notice)
```

Only the Human Research Director moves the project past a human gate. The Controller may return work to the responsible agent when mechanical acceptance criteria are unmet, and blocks any gate whose evidence-store consistency check fails.

### 6.2 Task object

Unchanged from v1.0 in structure, with two added fields:

```yaml
task_id: PH2-MOD-003
phase: design
owner_role: modelling_agent
objective: "Specify the staged connection-capacity model"
authorised_inputs:
  - 00_governance/research_charter.md
  - 00_governance/analysis_plan.md
  - 02_evidence/evidence.db
required_outputs:
  - 05_analysis/model_specification_v1.md
acceptance_tests:
  - all variables defined with units
  - information structure and timing explicit
  - welfare function separates private and external costs
  - calibrated parameters linked to the parameter ledger with scenario-dependence labels
budget_tokens_or_hours: <explicit>
verification_tier_of_outputs: <1|2|3>
prohibited_actions:
  - adding uncited factual claims
  - changing the research question
reviewer_role: independent_referee_instance
deadline: YYYY-MM-DD
```

### 6.3 Retry and escalation

Unchanged from v1.0: first failure returns with failed tests; second failure assigns an independent repair agent; third failure escalates to the Director. Conflicts get an adjudication memorandum, never majority vote. Missing evidence marks the claim unresolved. Tool failure triggers a rerun with a different model or deterministic method.

### 6.4 Context discipline

Agents receive the minimum approved context for their role. Review instances receive the manuscript and necessary evidence, never the drafting agent's reasoning. Reviewer independence per section 3.1: different prompt lineage at minimum, different model family where available.

## 7. Master controller prompt

```text
You are the Orchestration Controller for an economics research project titled
"The Option Value of a Grid Connection: Data Centres, Demand Uncertainty and
Efficient Capacity Reservation".

Your function is to manage a permissioned, auditable workflow that produces a
submission-ready paper. You are not the author, economist of record or final
decision maker.

NON-NEGOTIABLE RULES
1. The Human Research Director owns the research question, contribution,
   design, interpretation and publication decision.
2. Never allow an agent to approve its own substantive output.
3. Use only authorised inputs named in each task object.
4. Every material claim must link to the claims ledger and either page-level
   evidence, a reproducible model output, or an explicit assumption, at the
   verification tier its class requires.
5. Never invent or complete citations from memory. Mark unresolved references
   TO BE CONFIRMED and block the affected claim from publication.
6. Distinguish factual claims, assumptions, model outputs, inferences and
   normative recommendations. Label scenario-dependent figures as such.
7. Preserve raw data. Require scripted transformations and reproducible runs.
8. Record every material decision, deviation, agent output and review result.
9. Enforce the style sheet at 00_governance/style_sheet.md for all prose.
10. Do not permit confidential government, network or commercial information
    unless the Human Director has documented authority and a disclosure plan.
11. Enforce phase budgets. At 50 per cent overrun, halt and escalate for a
    scope decision instead of absorbing the overrun silently.
12. Run the evidence-store consistency check before assembling any gate pack.
    A failed check blocks the gate.

AT THE START OF EACH RUN
- read the research charter, analysis plan, decision log, task manifest and
  current gate;
- check the regulatory watch bulletin for unactioned tripwires;
- identify incomplete prerequisites and unresolved stop-ship findings;
- assign only tasks allowed in the current phase;
- state the evidence and files each agent may use;
- define acceptance tests before execution.

AT THE END OF EACH RUN
- validate deliverables against acceptance tests;
- update the run log, artefact versions and unresolved-issues register;
- prepare a concise gate pack when phase requirements are complete;
- never cross a human gate without explicit approval.

If evidence conflicts, preserve the disagreement and commission adjudication.
If data cannot support the intended design, activate the approved fallback.
If the contribution is not novel or the analysis is not reproducible, recommend
stopping rather than manufacturing a publishable-looking result.
```

## 8. Role prompts

Version 1.0 prompts 8.1 (Research Design Lead), 8.5 (Data and Reproducibility Agent), 8.6 (Modelling and Estimation Agent), 8.8 (Independent Economics Referee), 8.9 (Citation and Claims Auditor) and 8.10 (Publication Editor) carry over unchanged except that each now references the style sheet and the analysis plan instead of embedding style rules. Replacements and additions:

### 8.2 Evidence Agent (replaces v1 8.2 and 8.3)

```text
Act as the evidence agent, in two strictly separated passes.

Pass 1, search and screen: run the documented search protocol across academic
databases, working-paper repositories and primary regulatory sources. Cover
grid connection queues, capacity allocation, congestion, real options,
mechanism and contract design, large-load flexibility, data-centre electricity
demand, and the live reform record in Australia, the United States, Great
Britain and Ireland. Record exact searches, screening decisions and the
closest papers. Never infer findings from titles or snippets when full text is
required.

Pass 2, acquire and extract: obtain accepted sources, verify bibliographic
details, and extract only propositions actually supported by each source, with
page, table, figure or section locators, into the evidence store. Record
commissioning conflicts (for example hyperscaler-funded briefings) and
scenario dependence of quantitative estimates. Do not upgrade partial support
to direct support. Prefer primary Australian sources for institutional claims
and peer-reviewed or high-quality working papers for economic claims.

Standing duty: the weekly regulatory watch against the fixed source list, with
a one-line bulletin and immediate escalation when a tripwire condition is met.
```

### 8.4 Institutional Economics Agent (updated)

```text
Act as an Australian electricity institutional economist. Map the legal and
commercial sequence through which a large data-centre load seeks connection at
BOTH distribution and transmission level, including AEMO, AEMC, AER, TNSP and
DNSP roles, and the customer-contribution and cost-recovery arrangements that
set the effective price of capacity. Identify who controls capacity, who pays
for dedicated and shared assets, who bears forecast and stranding risk, and
which reforms are legally and operationally feasible.

Characterise reforms accurately by function: the AEMC access-standards work is
system security, not capacity allocation; the DISR Expectations are a
non-binding administrative screen enforced through regulatory prioritisation.
Maintain the international benchmark table (Texas, FERC, GB, Ireland) as
implemented mechanisms with parameters, not as a survey. Separate published
rules from observed practice and proposals. Do not present legal
interpretation as legal advice. Return a process map, incentive analysis,
cost-incidence map and mechanism-feasibility table with primary-source
citations.
```

### 8.7 Writing role (drafting phase; the polishing-phase checklist is v1 8.10)

```text
Act as the academic manuscript writer. Draft only from the approved outline,
evidence store, claims ledger and accepted analysis outputs, under the style
sheet. Distinguish evidence, assumptions, model findings, inferences and
recommendations. Label scenario-dependent figures as scenario-dependent. Keep
the strongest counterarguments and limitations visible.

Do not add facts or citations from memory. Do not conceal null or fragile
results. Do not describe calibrated scenarios as forecasts or causal
estimates. Insert Claim IDs with verification tiers during drafting and
provide a section-level unresolved-issues list.
```

## 9. Method specification for the preferred baseline

### 9.1 Economic environment

At each location and time, a network has available connection capacity and may invest in augmentation with a lead time and uncertain cost. The environment is explicit about connection level: distribution-connected projects face DNSP hosting limits and contribution policies; transmission-connected projects face negotiated connections, system-strength studies and longer augmentation lead times. Prospective projects differ in social value, private value, completion probability, ramp profile, delay cost, reliability requirement and capacity to curtail or shift. Some attributes are privately known.

Applicants request connection rights before uncertainty resolves; a right may reserve current capacity or influence future investment. The network selects an allocation and pricing mechanism from the section 5 set. Realised projects connect, ramp over years, curtail, or fail to proceed. The model must be capable of generating, in equilibrium, the observed Australian funnel: gross requests far above prospective projects, prospective projects above needed capacity, and coincident draw well below connected capacity.

### 9.2 Welfare components

As v1.0: productive surplus from connected compute; developer delay and curtailment costs; connection-study and administrative costs; dedicated and shared augmentation; congestion and reliability costs; expected stranded capacity; environmental externalities only where accounting is credible; transfers distinguished from real resource costs; distribution across developers, networks and other consumers.

### 9.3 Key cautions

Unchanged in substance from v1.0, with two additions. First, the paper should not assume all requested capacity is socially valuable, nor that deterring an application is a welfare gain; reservation prices can entrench capital-rich incumbents, administrative tests create discretion and lobbying, and auctions allocate to willingness to pay rather than national value. The Texas fee level and the Irish obligations give the paper real cases to examine for exactly these side effects, including the equity critique that fixed per-MW fees screen out entrants rather than speculators. Second, the paper uses **data centres under AI-driven demand uncertainty**, not **LLM data centres**; public records rarely distinguish workload types, and AI is a driver of forecast uncertainty, not an observed facility classification.

### 9.4 Fallback ladder

1. **Preferred:** structural or contract model calibrated to Australian public data, with the descriptive empirical module.
2. **Fallback 1:** stylised model plus transparent sensitivity ranges and institutional case study.
3. **Fallback 2:** comparative institutional economics paper without numerical welfare claims.
4. **Fallback 3:** policy research note identifying the data and rule reforms required before efficient allocation can be assessed.

The fallback is activated openly, never disguised as the original ambition.

## 10. Quality gates and stop-ship criteria

The v1.0 stop-ship list carries over in full. Additions:

- headline claim relying on a conflicted source without the conflict disclosed;
- scenario-dependent estimate presented as an observed outcome;
- Tier 1 claim with fewer than two independent verifications;
- gate crossed with a failing evidence-store consistency check;
- regulatory-watch tripwire left unactioned at submission (for example, the AEMC final determination published and not addressed).

Target acceptance metrics as v1.0, plus: 100 per cent of Tier 1 claims dual-verified; zero unactioned watch tripwires at release.

## 11. Practical schedule

Fifteen working weeks remains the target, paced by evidence and the external regulatory calendar rather than agent count. Director hours are budgeted per phase in section 5 (total roughly 46 hours).

| Period | Main work | Human decision | External calendar |
|---|---|---|---|
| Week 1 | Charter, toolchain, disclosures | H0 scope | |
| Weeks 2 to 3 | Novelty confirmation from the verified corpus; institutional scan; watch begins | H1 proceed or narrow; venue, style, length locked | FERC RTO filings due about 17 August 2026; ERCOT Batch Zero notices August 2026 |
| Weeks 4 to 5 | Data-scouting spike, then two-design selection | H2 design lock plus analysis plan | |
| Weeks 6 to 7 | Pilot, end-to-end reproduction | H3 feasibility | |
| Weeks 8 to 10 | Full analysis; mid-phase calibration checkpoint | H4 results | AEMC final determination due 29 October 2026 (falls here or in drafting; tripwire handles it) |
| Weeks 11 to 12 | Full manuscript | H5 draft | |
| Weeks 13 to 14 | Independent reviews and revisions; loop-backs as needed | H6 stop-ship clear | |
| Week 15 | Package, final search re-run, release | Final approval | |

A polished conceptual paper may be faster; a credible causal empirical paper would be slower and is not the baseline promise.

## 12. Seed evidence base, version 2.0

Verification status is recorded per source; the Evidence Agent must still independently verify and expand this list. Full claim-level detail is in `03-evidence-annex.md`.

**Australian primary:**

- AEMO. (2026). *2026 Integrated System Plan*. Status: publication to be confirmed before citation.
- Oxford Economics Australia. (2025, July). *Data centre energy demand: Final report*. Commissioned by AEMO for the 2025 IASR. Verified.
- Oxford Economics. (2025, November). *Estimating data centre phantom demand* (research briefing). Commissioned by AWS; conflict flag. Verified.
- AEMO. (2026). *Quarterly Energy Dynamics, Q1 2026* (first public NEM data-centre connection-pipeline statistics). Reported via secondary source; verify against the primary.
- AEMC. (2026, 12 March). *Improving the NEM access standards, Package 2: Draft determination*. System-security standards; final determination due 29 October 2026. Verified.
- Korte, R. (2026, 28 April). *Data | Power: Navigating policy, regulation and networks* (speech, AEMC). Verified as a speech, not a Commission report.
- Department of Industry, Science and Resources. (2026, 23 March). *Expectations of data centres and AI infrastructure developers*. Verified.
- United Energy. (2025, December). *Data centre connections business case* (AER revised regulatory proposal document). DNSP pipeline and contribution-rate evidence. Verified via search-indexed text; confirm by direct access.
- AER distribution determination materials for Victorian networks, 2026 to 2031 cycle.

**International reform record:**

- Texas SB6; PUCT draft rule 16 TAC §25.194 (March 2026); ERCOT Batch Zero protocol revisions (approved 18 June 2026).
- FERC. (2026, 18 June). Show cause orders to PJM, MISO, SPP, CAISO, ISO-NE and NYISO on large-load interconnection.
- NESO and Ofgem TMO4+ connections reform (Gate 2 readiness criteria; demand deemed needed).
- Commission for Regulation of Utilities (Ireland). (2025, 12 December). *Large Energy Users Connection Policy*, CRU/2025/236.
- ENTSO-E data centres publication: existence not confirmed in this review; verify or drop.

**Closest academic works:**

- Johnston, S., Liu, Y., & Yang, C. (2023). *An empirical analysis of the interconnection queue* (NBER Working Paper 31946).
- Norris, T. H., Profeta, T., Patino-Echeverri, D., & Cowie-Haskell, A. (2025, 13 February). *Rethinking load growth*. Duke University Nicholas Institute.
- Knittel, C. R., Senga, J. R. L., & Wang, S. (2025). *Flexible data centers and the grid: Lower costs, higher emissions?* MIT CEEPR WP 2025-14; NBER w34065; published in iScience (2026).
- Kay, O., Reaser, R., & Taylor, R. (2026, March). *Processing power: The effect of data centers on wholesale electricity markets*. Federal Reserve Bank of Dallas WP 2606. Companion inflation analysis: Kay, Kilian and Taylor (2026, 5 March), Dallas Fed Economics.
- Riepin, I., Zavala, V. M., & Brown, T. (2025). Spatio-temporal load shifting for truly clean computing. *Advances in Applied Energy, 17*, 100202. Open-source model (Zenodo 10869650).
- Lawrence Berkeley National Laboratory queue statistics (standard US attrition reference). To be added at Phase 1.

## 13. Publication and authorship integrity

Unchanged from v1.0, with one extension: the conflict and disclaimer protocol covers interim public commentary. The LinkedIn series during research is framed as questions and design problems, never as findings; each interim post carries the personal-capacity disclaimer; and no interim post may state a quantitative result before Gate H4. The end-of-project public article is checked by the release comparison script like every other derivative.

## 14. Immediate commencement checklist

The Director's seven questions from v1.0 stand. Recommended initial decisions, updated:

- Target an Australian economics or energy-policy working paper first; select the journal at Gate H1, and let that decision set style and length.
- Keep the primary object data-centre connections, using electrolysers and other large loads as robustness cases.
- Model both connection levels or scope explicitly to one; do not let the transmission framing sit unexamined while 98 per cent of the existing load is distribution-connected.
- Seek a technical reviewer early; delay co-authorship decisions until contribution and data access are clearer.
- Publish no definitive mechanism recommendation until the model and institutional review are complete; in particular, do not endorse the Texas fee level or the Irish obligations by implication when citing them as benchmarks.
- Approach AEMO, a TNSP or a Victorian DNSP about anonymised connection-pipeline data only after Gate H2, with the pre-analysis plan in hand; the request is more credible and the design does not depend on success.

## 15. Final critical judgement

The paper is viable and its window is better than version 1.0 assumed: the premise is now documented in Australian data, the mechanism menu has live overseas implementations to price against, and Australia conspicuously lacks an allocation reform. The central risk is unchanged: producing a topical policy essay dressed as economics. The discipline that prevents it is also unchanged: a genuine mechanism, an explicit counterfactual, disciplined treatment of information and cost incidence, and a pre-analysis plan locked before results exist.

The strongest publishable contribution remains a contract-design result showing when staged firm and curtailable connection rights outperform blunt queue priority, uniform fees or matched-capacity obligations, calibrated so the model reproduces the observed Australian request-to-realisation funnel. The weakest route remains the intuitive claim that data centres should pay their own way, which the Commonwealth has already asserted rhetorically and which resolves none of the hard questions about incremental cost, common-asset allocation and the pricing of uncertainty.

The second major risk is currency: this is a fast-moving reform space, and a fifteen-week project will be overtaken somewhere. The regulatory watch, the tripwires and the pre-submission re-run are the insurance. A calibrated model with transparent assumptions and honestly labelled scenario dependence will survive a news cycle; a pseudo-empirical exercise will not.
