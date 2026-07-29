#!/usr/bin/env python3
"""Build 02_evidence/evidence.db from the seed CSVs.

Idempotent: drops and recreates tables on each run. The CSVs are the
editable source of truth; the database is a derived artefact for querying
and for the consistency check.
"""
import csv
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "evidence.db"
SEED = ROOT / "seed"

TABLES = {
    "sources": SEED / "sources.csv",
    "claims": SEED / "claims.csv",
    "parameters": SEED / "parameters.csv",
}


def load(conn: sqlite3.Connection, table: str, path: Path) -> int:
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit(f"{path} is empty")
    cols = list(rows[0].keys())
    conn.execute(f"DROP TABLE IF EXISTS {table}")
    conn.execute(f"CREATE TABLE {table} ({', '.join(c + ' TEXT' for c in cols)})")
    conn.executemany(
        f"INSERT INTO {table} VALUES ({', '.join('?' for _ in cols)})",
        [[r[c] for c in cols] for r in rows],
    )
    return len(rows)


def main() -> None:
    conn = sqlite3.connect(DB)
    for table, path in TABLES.items():
        n = load(conn, table, path)
        print(f"{table}: {n} rows")
    conn.commit()
    conn.close()
    print(f"built {DB}")


if __name__ == "__main__":
    main()
