#!/usr/bin/env python3
"""Evidence-store consistency check. Run at every gate; a non-zero exit blocks the gate pack.

Checks:
  1. Every claim's source_id exists in sources.
  2. Every parameter's source_id exists in sources.
  3. Tier 1 claims marked 'verified' have at least two recorded verifications.
  4. No claim marked 'verified' cites a source whose verification_status is 'to_be_confirmed'.
  5. Scenario-dependent parameters and claims are labelled (scenario_dependent in {yes,no}).
  6. Conflicted sources (conflict_flag != none) are only cited by claims whose notes mention the conflict.
"""
import sqlite3
import sys
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "evidence.db"

def main() -> int:
    if not DB.exists():
        print("FAIL: evidence.db missing. Run `make evidence` first.")
        return 1
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    errors: list[str] = []

    src_ids = {r["source_id"] for r in conn.execute("SELECT source_id FROM sources")}

    for r in conn.execute("SELECT claim_id, source_id FROM claims"):
        if r["source_id"] not in src_ids:
            errors.append(f"claim {r['claim_id']}: unknown source {r['source_id']}")
    for r in conn.execute("SELECT param_id, source_id FROM parameters"):
        if r["source_id"] not in src_ids:
            errors.append(f"parameter {r['param_id']}: unknown source {r['source_id']}")

    for r in conn.execute(
        "SELECT claim_id, verifications FROM claims WHERE tier='1' AND verification_status='verified'"
    ):
        v = r["verifications"] or ""
        if not any(tag in v for tag in ("3-0", "2-0", "2-1")):
            errors.append(f"claim {r['claim_id']}: tier 1 verified without two recorded verifications ({v!r})")

    tbc = {r["source_id"] for r in conn.execute(
        "SELECT source_id FROM sources WHERE verification_status='to_be_confirmed'"
    )}
    for r in conn.execute("SELECT claim_id, source_id FROM claims WHERE verification_status='verified'"):
        if r["source_id"] in tbc:
            errors.append(f"claim {r['claim_id']}: verified but cites TO BE CONFIRMED source {r['source_id']}")

    for table, key in (("claims", "claim_id"), ("parameters", "param_id")):
        for r in conn.execute(f"SELECT {key}, scenario_dependent FROM {table}"):
            if (r["scenario_dependent"] or "").strip() not in ("yes", "no"):
                errors.append(f"{table[:-1]} {r[key]}: scenario_dependent must be yes or no")

    conflicted = {r["source_id"]: r["conflict_flag"] for r in conn.execute(
        "SELECT source_id, conflict_flag FROM sources WHERE conflict_flag NOT IN ('none','')"
    )}
    for r in conn.execute("SELECT claim_id, source_id, notes FROM claims"):
        if r["source_id"] in conflicted:
            notes = (r["notes"] or "").lower()
            if "conflict" not in notes and conflicted[r["source_id"]].split("_")[0].lower() not in notes:
                errors.append(
                    f"claim {r['claim_id']}: cites conflicted source {r['source_id']} without noting the conflict"
                )

    if errors:
        print(f"FAIL: {len(errors)} consistency error(s)")
        for e in errors:
            print(f"  - {e}")
        return 1
    n_claims = conn.execute("SELECT COUNT(*) FROM claims").fetchone()[0]
    n_src = conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
    n_par = conn.execute("SELECT COUNT(*) FROM parameters").fetchone()[0]
    print(f"OK: {n_src} sources, {n_claims} claims, {n_par} parameters; all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
