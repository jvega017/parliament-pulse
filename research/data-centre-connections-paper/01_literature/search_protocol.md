# Search protocol

## Databases and repositories

Scopus or Web of Science (whichever is accessible), EconLit, NBER, SSRN, RePEc/IDEAS, arXiv (econ.GN, eess.SY), Google Scholar (supplementary only, logged), and primary regulatory sources: AEMC, AEMO, AER, DISR, DCCEEW, FERC eLibrary, PUCT interchange, ERCOT, Ofgem, NESO, CRU/EirGrid, ENTSO-E, LBNL.

## Query families (log exact strings, dates, filters and counts in search_log.csv)

1. interconnection queue AND (reform OR economics OR withdrawal OR attrition)
2. (grid connection OR interconnection) AND (data center OR data centre OR large load)
3. (capacity reservation OR connection right) AND (option OR real option) AND electricity
4. mechanism design AND (transmission OR network) AND capacity allocation
5. (curtailable OR flexible OR interruptible) AND (connection OR interconnection) AND (load OR demand)
6. data centre electricity demand AND (forecast OR phantom OR speculative)
7. use-it-or-lose-it AND (connection OR capacity) AND electricity

## Rules

- Backward and forward citation chasing for every paper accepted as "close".
- Working papers and regulator consultations included: reform moves faster than journals.
- No findings inferred from titles, abstracts or snippets where full text is required.
- Screening decisions recorded in screening_register.csv with reason codes: R1 off-topic, R2 duplicate, R3 superseded, R4 quality, A accepted.
- Full re-run of all query families immediately before submission.

## Verification tiers (applied at extraction)

Tier 1: headline results, institutional-rule claims, every abstract number. Two independent verifications.
Tier 2: supporting quantitative claims. One page-level verification.
Tier 3: background. Source linkage only.
