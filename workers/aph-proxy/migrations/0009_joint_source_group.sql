-- One-off relabel: joint committee items were grouped as "Custom" (29 Sep 2026).
--
-- src/jurisdictions.json mapped any feed label containing "joint" to the
-- source group "Custom", which the frontend showed on Activity by source and
-- in the drawer's Source group. From Worker 0.16.1 the rule writes "Joint".
-- This file relabels rows written before that, so stored signals and alert
-- rules agree with new ingests and a "Joint" filter finds them. (No code
-- writes saved_searches, so it holds nothing to relabel.)
--
-- Idempotent: re-running changes nothing once no "Custom" value remains.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

UPDATE signals     SET source_group = 'Joint' WHERE source_group = 'Custom';
UPDATE alert_rules SET source_group = 'Joint' WHERE source_group = 'Custom';
