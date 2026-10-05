-- Per-item chamber for stored signals (Worker 0.16.3, data review 5 Oct 2026).
--
-- Up to 0.16.2 every item took its feed's source group, so House committee
-- hearings in "Today's House and joint hearings" were stored as Joint, and
-- joint committee items in the Senate feeds were stored as Senate (23 rows
-- live on 5 Oct 2026). From 0.16.3 ingest takes the group from the item's
-- link when it names a committee chamber (/Committees/House|Joint|Senate/,
-- src/jurisdictions.ts sourceGroupForItemConfig). This file applies the same
-- rule to rows written before that. Library (Bills Digests) rows are never
-- changed, matching the code. LIKE is case-insensitive for ASCII in SQLite,
-- as the code's regex is.
--
-- Idempotent: each statement only changes rows whose group differs from the
-- one their link names, so a second run changes nothing.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

UPDATE signals SET source_group = 'House'
 WHERE link LIKE '%/Committees/House/%' AND source_group NOT IN ('House', 'Library');

UPDATE signals SET source_group = 'Joint'
 WHERE link LIKE '%/Committees/Joint/%' AND source_group NOT IN ('Joint', 'Library');

UPDATE signals SET source_group = 'Senate'
 WHERE link LIKE '%/Committees/Senate/%' AND source_group NOT IN ('Senate', 'Library');
