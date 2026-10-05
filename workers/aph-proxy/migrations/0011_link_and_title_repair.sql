-- Stored link and title repairs (Worker 0.16.3, data review 5 Oct 2026).
--
-- 1. aphcms.aph.gov.au does not resolve (getaddrinfo ENOTFOUND); the same
--    path on www.aph.gov.au returns 200. Two Upcoming Senate hearings rows
--    carried it in link and guid. From 0.16.3 the parser rewrites the host
--    (src/archive.ts canonicalAphUrl); this rewrites stored rows the same
--    way. guid is the primary key and signal_threads references it, so the
--    mapping rows go first (migration 0012 and the thread backfill rebuild
--    them), then a row whose www twin already exists is dropped, then the
--    rest are renamed. 'https://aphcms.aph.gov.au/' is 26 characters.
--
-- 2. House news items have no <title>, so 0.16.2 and earlier stored the
--    first 100 characters of the description, cut mid-word ("... What is
--    the Hous"). The headline is the link's last path segment with "_" for
--    spaces, which 0.16.3 now uses at ingest (src/archive.ts fallbackTitle).
--    Only rows whose title is a prefix of their own description (that is,
--    the old fallback) and whose last segment holds at least two "_" and no
--    percent-escape are changed. rtrim(link, <every non-slash char of link>)
--    leaves the link up to its last "/", so replacing that prefix with ''
--    leaves the last segment.
--
-- Idempotent: after one run no aphcms value remains, and a repaired title
-- is no longer a prefix of its description, so a second run changes nothing.
--
-- NOT YET APPLIED REMOTELY. Applying needs owner approval:
--   wrangler d1 migrations apply parliament-pulse-archive --remote

-- 0.16.8: a www twin is the same item. When an aphcms row is dropped, the
-- twin takes the older first_seen_at, so the item keeps the date it was
-- first archived (a twin a poll inserted before this file runs has
-- first_seen_at = that poll and would read as a fresh arrival), and the
-- twin takes the dropped row's thread. The twin leaves its own thread only
-- when the dropped row had one; a thread the twin's poll created for it
-- ('t2:' || guid) that is left with no mapping row is removed. Edited before
-- any remote apply (remote was at 0009 on 5 Oct 2026). Same pattern as 0014.
UPDATE signals
   SET first_seen_at = (SELECT MIN(o.first_seen_at) FROM signals o
                         WHERE o.guid = 'https://aphcms.aph.gov.au/' || substr(signals.guid, 24))
 WHERE guid LIKE 'https://www.aph.gov.au/%'
   AND EXISTS (SELECT 1 FROM signals o
                WHERE o.guid = 'https://aphcms.aph.gov.au/' || substr(signals.guid, 24)
                  AND o.first_seen_at < signals.first_seen_at);

DELETE FROM signal_threads
 WHERE signal_guid LIKE 'https://www.aph.gov.au/%'
   AND EXISTS (SELECT 1 FROM signal_threads o
                WHERE o.signal_guid = 'https://aphcms.aph.gov.au/' || substr(signal_threads.signal_guid, 24));

INSERT OR IGNORE INTO signal_threads (signal_guid, thread_id)
SELECT 'https://www.aph.gov.au/' || substr(o.signal_guid, 27), o.thread_id
  FROM signal_threads o
 WHERE o.signal_guid LIKE 'https://aphcms.aph.gov.au/%'
   AND ('https://www.aph.gov.au/' || substr(o.signal_guid, 27)) IN (SELECT guid FROM signals);

DELETE FROM threads
 WHERE thread_id LIKE 't2:https://www.aph.gov.au/%'
   AND substr(thread_id, 4) IN (SELECT 'https://www.aph.gov.au/' || substr(guid, 27) FROM signals
                                 WHERE guid LIKE 'https://aphcms.aph.gov.au/%')
   AND NOT EXISTS (SELECT 1 FROM signal_threads st WHERE st.thread_id = threads.thread_id);

DELETE FROM signal_threads WHERE signal_guid LIKE 'https://aphcms.aph.gov.au/%';

DELETE FROM signals
 WHERE guid LIKE 'https://aphcms.aph.gov.au/%'
   AND ('https://www.aph.gov.au/' || substr(guid, 27)) IN (SELECT guid FROM signals);

UPDATE signals SET guid = 'https://www.aph.gov.au/' || substr(guid, 27)
 WHERE guid LIKE 'https://aphcms.aph.gov.au/%';

UPDATE signals SET link = 'https://www.aph.gov.au/' || substr(link, 27)
 WHERE link LIKE 'https://aphcms.aph.gov.au/%';

UPDATE OR IGNORE alert_events SET signal_guid = 'https://www.aph.gov.au/' || substr(signal_guid, 27)
 WHERE signal_guid LIKE 'https://aphcms.aph.gov.au/%';
DELETE FROM alert_events WHERE signal_guid LIKE 'https://aphcms.aph.gov.au/%';
UPDATE alert_events SET link = 'https://www.aph.gov.au/' || substr(link, 27)
 WHERE link LIKE 'https://aphcms.aph.gov.au/%';

UPDATE signals
   SET title = replace(replace(link, rtrim(link, replace(link, '/', '')), ''), '_', ' ')
 WHERE feed_label = 'House news'
   AND description IS NOT NULL
   AND substr(description, 1, length(title)) = title
   AND length(replace(link, rtrim(link, replace(link, '/', '')), ''))
       - length(replace(replace(link, rtrim(link, replace(link, '/', '')), ''), '_', '')) >= 2
   AND instr(replace(link, rtrim(link, replace(link, '/', '')), ''), '%') = 0;
