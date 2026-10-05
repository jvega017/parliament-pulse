-- Stored entity repair (Worker 0.16.5, review of 5 Oct 2026).
--
-- Worker 0.16.3 and earlier stored element text without decoding XML
-- entities, so a feed's "&amp;" stayed in guid and link. The Senators'
-- details feed sends
--   .../los.pdf?la=en&amp;hash=C7DFDAEB...
-- (measured 5 Oct 2026, live feed and live /archive), and the stored List of
-- Senators row carries that text. From 0.16.4 the parser decodes it to
-- ".../los.pdf?la=en&hash=...", so the stored row no longer matches its own
-- feed item. 0.16.5 renames such a row at ingest (src/archive.ts
-- adoptLegacyEntityRow); this file repairs every stored row, including rows
-- no longer in any feed and a decoded duplicate that a poll between the
-- 0.16.4 or 0.16.5 deploy and this migration may have added.
--
-- Modelled on 0011. guid is the primary key and signal_threads references it
-- with no ON UPDATE action, so the mapping rows go first (the per-poll heal
-- step re-threads the renamed rows), then a row whose decoded twin already
-- exists is dropped (the twin is kept), then the rest are renamed. A thread
-- left with no mapping row is removed. Alert events follow the same steps.
-- instr() is used, not LIKE, so no pattern limit applies.
--
-- Idempotent: after one run no guid, link or signal_guid contains "&amp;",
-- so a second run matches nothing.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

DELETE FROM signal_threads WHERE instr(signal_guid, '&amp;') > 0;

DELETE FROM threads
 WHERE instr(thread_id, '&amp;') > 0
   AND NOT EXISTS (SELECT 1 FROM signal_threads st WHERE st.thread_id = threads.thread_id);

-- A kept twin takes the older row's first_seen_at, so the item keeps the
-- date it was first archived rather than the date of the duplicate.
UPDATE signals
   SET first_seen_at = (SELECT MIN(o.first_seen_at) FROM signals o
                         WHERE instr(o.guid, '&amp;') > 0
                           AND replace(o.guid, '&amp;', '&') = signals.guid)
 WHERE instr(guid, '&amp;') = 0
   AND EXISTS (SELECT 1 FROM signals o
                WHERE instr(o.guid, '&amp;') > 0
                  AND replace(o.guid, '&amp;', '&') = signals.guid
                  AND o.first_seen_at < signals.first_seen_at);

DELETE FROM signals
 WHERE instr(guid, '&amp;') > 0
   AND replace(guid, '&amp;', '&') IN (SELECT guid FROM signals);

UPDATE signals SET guid = replace(guid, '&amp;', '&')
 WHERE instr(guid, '&amp;') > 0;

UPDATE signals SET link = replace(link, '&amp;', '&')
 WHERE instr(link, '&amp;') > 0;

UPDATE OR IGNORE alert_events SET signal_guid = replace(signal_guid, '&amp;', '&')
 WHERE instr(signal_guid, '&amp;') > 0;
DELETE FROM alert_events WHERE instr(signal_guid, '&amp;') > 0;
UPDATE alert_events SET link = replace(link, '&amp;', '&')
 WHERE instr(link, '&amp;') > 0;
