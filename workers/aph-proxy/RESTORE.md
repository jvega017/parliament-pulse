# D1 backup and restore runbook

Database: `parliament-pulse-archive` (binding `ARCHIVE`), the persistent
archive behind the Worker: every RSS item observed (`signals`), threads,
feed health, job runs, members, QON and the dormant digest subscriber list.
Written for WK-07 (review findings ARCH-07 and ARCH-12, 29 Sep 2026).

Order of resort:

1. **Time Travel** (section 1) when the database still exists and the damage
   is recent. It needs no export.
2. **Restore an export** (sections 2 to 6) when the database is gone, the
   damage is older than the Time Travel window, or a copy is needed elsewhere.

Every remote command below is owner-run. None is run by CI except the manual
`D1 backup` workflow, which only exports.

## 1. First resort: D1 Time Travel

Verified on developers.cloudflare.com/d1/reference/time-travel/ on
29 Sep 2026:

- Retention: up to 30 days on the Workers Paid plan, 7 days on the Workers
  Free plan. Bookmarks outside the window cannot be used as a restore point.
- A restore is destructive: it overwrites the database in place and cancels
  in-flight queries. It can be undone by restoring to the previous bookmark,
  which the restore command prints.

```bash
cd workers/aph-proxy
# Current bookmark (record it before anything else)
npx wrangler d1 time-travel info parliament-pulse-archive
# Restore to a point in time (UNIX timestamp, seconds)
npx wrangler d1 time-travel restore parliament-pulse-archive --timestamp=<UNIX_TIMESTAMP>
```

After a Time Travel restore, run the count check in section 4 against a
recent export's manifest if one exists, and read `GET /healthz/deep`.

## 2. Export (backup)

Two routes; both write a dump and a manifest.

**Owner-local, full (includes subscriber email addresses):**

```bash
cd workers/aph-proxy
pnpm backup:export            # remote: node scripts/d1-export.mjs --remote
pnpm backup:export:local      # the local wrangler dev database
```

Output lands in `workers/aph-proxy/backups/` (git-ignored):

- `archive-<UTC stamp>.sql`, the `wrangler d1 export` dump;
- `archive-<UTC stamp>.manifest.json`: per-table row counts measured from
  the dump (one `INSERT` statement is one row; `sqlite_sequence` and `_cf_`
  tables are not counted), the dump's `sha256` and byte size, the wrangler
  version, the mode and any excluded tables.

Options: `--out-dir <dir>`, `--database <name>`, `--config <path>`,
`--exclude-table <name>` (repeatable; drops that table's rows, keeps its
schema), `--yes` (skip wrangler's confirmation).

**GitHub Actions, manual only:** Actions > `D1 backup` > Run workflow. It
needs the repository secrets `CLOUDFLARE_API_TOKEN` (D1 read on the account)
and `CLOUDFLARE_ACCOUNT_ID`, and fails with a named error if either is
missing. The dump and manifest are uploaded as the artefact
`d1-archive-<run id>`, kept for 30 days. The repository is public and an
artefact download needs only read access to the repository (GitHub docs), so
the workflow passes `--exclude-table digest_subscribers`: no email address
enters the artefact. A restore from a CI artefact therefore has an empty
subscriber list; restore subscribers from an owner-local full export.

Cloudflare states that a running export blocks other requests to the
database (developers.cloudflare.com/d1/best-practices/import-export-data/,
read 29 Sep 2026). Run exports away from the :00 and :30 poll.

**Owner decision still open (ARCH-07):** off-GitHub storage. The artefact
expires after 30 days. The workflow carries a commented-out R2 upload step;
enabling it needs a private R2 bucket, R2 write on the token for that bucket
only, and the repository variable `D1_BACKUP_BUCKET`.

## 3. Restore into a new D1

Never import into the live database: `wrangler d1 execute --file` runs the
dump's `CREATE TABLE` statements, which fail on existing tables. Create a new
database and import there.

```bash
cd workers/aph-proxy
npx wrangler d1 create parliament-pulse-archive-restore-<YYYYMMDD>
# Note the printed database_id.
```

Add a temporary block to `wrangler.toml` (or a scratch config passed with
`--config`) so wrangler can address the new database by name:

```toml
[[d1_databases]]
binding = "RESTORE"
database_name = "parliament-pulse-archive-restore-<YYYYMMDD>"
database_id = "<printed id>"
migrations_dir = "migrations"
```

Import:

```bash
npx wrangler d1 execute parliament-pulse-archive-restore-<YYYYMMDD> --remote \
  --file=backups/archive-<UTC stamp>.sql
```

The dump already starts with `PRAGMA defer_foreign_keys=TRUE;` and carries no
`BEGIN TRANSACTION` or `_cf_KV` statements, which Cloudflare's import notes
say must be absent. It includes the `d1_migrations` ledger, so wrangler knows
which migrations the restored copy already has.

## 4. Verify row counts against the manifest

Run this straight after the import, before re-applying migrations (section
6), so the migration ledger still matches the dump:

```bash
pnpm backup:verify -- --manifest backups/archive-<UTC stamp>.manifest.json \
  --database parliament-pulse-archive-restore-<YYYYMMDD> --remote
```

`scripts/d1-verify.mjs` runs one read-only `SELECT COUNT(*)` per manifest
table and applies `compareCounts`, the same verdict function
`tests/restore.test.mjs` tests. It exits 0 only when every manifest table is
present with an equal count, and exits 1 naming each table that differs.
An excluded table is expected to hold 0 rows. Also check the dump's sha256
against the manifest before importing:

```bash
sha256sum backups/archive-<UTC stamp>.sql   # must equal manifest.sha256
```

## 5. Repoint the Worker (database_id)

Only after section 4 passes. In `wrangler.toml`, set `database_id` and
`database_name` in both `ARCHIVE` blocks (production `[[d1_databases]]` and
`[[env.dev.d1_databases]]`) to the restored database's id and name, and
remove the temporary `RESTORE` block. The Worker code reads the binding
`ARCHIVE`, which does not change. Use the restored name in every later
`wrangler d1` command, including section 6 and the export scripts
(`--database <name>`).
Deploy through the normal CI-gated route (merge to `main`; see README
"Deploy"), then read `GET /healthz/deep` and `GET /state`.

## 6. Re-apply migrations

```bash
npx wrangler d1 migrations apply <restored database name> --remote
```

Wrangler compares the migration files with the restored `d1_migrations`
ledger and applies only files newer than the dump. "No migrations to apply"
is the normal result for a recent dump. Migration 0003 contains
`ALTER TABLE ... ADD COLUMN`, which is not idempotent: never run migration
files by hand with `d1 execute --file`; always use `migrations apply`. After
this step `d1_migrations` holds more rows than the manifest if any migration
applied, which is why section 4 runs first.

## 7. Drill log

A drill proves the runbook, not the backups: repeat it after any change to
the export script, wrangler major version or schema.

| Date (AEST) | Who | Scope | Result |
|---|---|---|---|
| 29 Sep 2026, 09:27 | Claude (WK-07), local only | `pnpm backup:export:local` against the wrangler dev local D1 (wrangler 4.84.1) | Ran. Dump 5,537 bytes, 13 tables. The local database held only the migration ledger (8 `d1_migrations` rows, 0 data rows), so this proved the schema round trip only. Imported into a fresh local D1 with `wrangler d1 execute --local --file`; `d1-verify.mjs` reported 13 of 13 tables matching; `migrations apply --local` reported no migrations to apply. |
| 29 Sep 2026, 09:28 | Claude (WK-07), local only | Data-row round trip on a scratch local D1: migrations applied, 3 signals (one holding quotes, a semicolon, a newline and the text `INSERT INTO`), 1 thread, 3 signal_threads, 1 job run and 1 subscriber row, all labelled drill; exported with `--exclude-table digest_subscribers` | Ran. Manifest 16 rows across 13 tables; the subscriber email was absent from the dump. Imported into a second fresh local D1 (50 statements); `d1-verify.mjs` matched 13 of 13 tables and the tricky title came back intact. Negative check: after deleting one `signal_threads` row, `d1-verify.mjs` exited 1 naming `signal_threads` (expected 3, actual 2). |
| Not yet run | Owner | Remote export (`pnpm backup:export` or the `D1 backup` workflow) and a remote restore into a new D1 | Not run: remote commands are owner-only. Record the first remote drill here with the manifest sha256. |
