# Data centre grid connections paper: operating pack

Implements the research workflow defined in `docs/research/data-centre-grid-connections/02-improved-plan-v2.md` (version 2.0, 16 July 2026). The critical review of version 1.0 and the evidence annex live alongside it.

**Paper:** The Option Value of a Grid Connection: Data Centres, Demand Uncertainty and Efficient Capacity Reservation
**Current phase:** 0 (Charter). Gate H0 awaits Human Research Director sign-off in `00_governance/research_charter.md`.

## Layout

| Path | Contents |
|---|---|
| `00_governance/` | Charter, analysis plan (locked at H2), style sheet, decision and change logs, task manifest, run log |
| `01_literature/` | Search protocol and logs, screening register, novelty map, regulatory watch |
| `02_evidence/` | Seed CSVs, `evidence.db` (built), consistency checks |
| `03_institutions/` | NEM process map, mechanism benchmark table, legal rule register, feasibility |
| `04_data/` | Immutable raw inputs, scripted transforms, dictionary, provenance |
| `05_analysis/` | Model specification, code, outputs, diagnostics, robustness |
| `06_manuscript/` | `manuscript.qmd` (single source), `references.bib`, figures, tables |
| `07_review/` | Referee reports, claims audits, response matrix |
| `08_release/` | Working paper, submission package, policy brief, replication package |
| `prompts/` | Controller and role prompts (operational copies of plan sections 7 and 8) |

## Toolchain (locked at Phase 0)

git; Python 3 with a lockfile for analysis; SQLite for the evidence store; Zotero + Better BibTeX exporting `06_manuscript/references.bib`; Quarto (or LaTeX) as the single manuscript source with Word output generated, never hand-edited; `make` as the single entry point.

## Commands

```sh
make evidence   # rebuild 02_evidence/evidence.db from seed CSVs
make check      # run the evidence-store consistency check (blocks gates on failure)
make all        # both
```

## Rules that bind everything here

1. Raw data are immutable; every transformation is scripted.
2. No agent approves its own substantive output.
3. Every material claim links to the claims ledger at its verification tier, or is labelled ASSUMPTION.
4. Scenario-dependent figures are labelled as such, never presented as observed outcomes.
5. Human gates (H0 to H6) are crossed only by the Human Research Director.
