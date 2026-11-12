-- 0131: backfill activity_events untuk Jinye published yang belum punya baris feed.
-- Idempoten lewat UNIQUE(dedupe_key). ID: prefix waktu Crockford + hex (pola 0105).

-- Original (bukan repost/quote).
INSERT OR IGNORE INTO activity_events (id, kind, actor_id, target_id, occurred_at, dedupe_key)
SELECT
  (
    WITH alphabet(a) AS (
      SELECT '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    ), s(ms) AS (SELECT CAST(j.created_at AS INTEGER) * 1000)
    SELECT
      (SELECT substr(a, 1 + ((ms / 35184372088832) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1099511627776) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 34359738368) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1073741824) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 33554432) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1048576) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 32768) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1024) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 32) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + (ms % 32), 1) FROM alphabet) ||
      lower(hex(randomblob(8)))
    FROM s
  ),
  'jinye_created',
  j.user_id,
  j.id,
  j.created_at,
  'jinye:' || j.id
FROM jinye j
WHERE j.status = 'published'
  AND j.repost_of_id IS NULL;
--> statement-breakpoint

-- Quote-repost.
INSERT OR IGNORE INTO activity_events (id, kind, actor_id, target_id, occurred_at, dedupe_key)
SELECT
  (
    WITH alphabet(a) AS (
      SELECT '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    ), s(ms) AS (SELECT CAST(j.created_at AS INTEGER) * 1000)
    SELECT
      (SELECT substr(a, 1 + ((ms / 35184372088832) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1099511627776) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 34359738368) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1073741824) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 33554432) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1048576) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 32768) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1024) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 32) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + (ms % 32), 1) FROM alphabet) ||
      lower(hex(randomblob(8)))
    FROM s
  ),
  'jinye_quote_created',
  j.user_id,
  j.id,
  j.created_at,
  'jinye_quote:' || j.id
FROM jinye j
WHERE j.status = 'published'
  AND j.repost_of_id IS NOT NULL
  AND j.quote_body IS NOT NULL
  AND length(trim(j.quote_body)) > 0;
--> statement-breakpoint

-- Repost polos (dedupe = user + original, sama use-case).
INSERT OR IGNORE INTO activity_events (id, kind, actor_id, target_id, occurred_at, dedupe_key)
SELECT
  (
    WITH alphabet(a) AS (
      SELECT '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    ), s(ms) AS (SELECT CAST(j.created_at AS INTEGER) * 1000)
    SELECT
      (SELECT substr(a, 1 + ((ms / 35184372088832) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1099511627776) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 34359738368) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1073741824) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 33554432) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1048576) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 32768) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 1024) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + ((ms / 32) % 32), 1) FROM alphabet) ||
      (SELECT substr(a, 1 + (ms % 32), 1) FROM alphabet) ||
      lower(hex(randomblob(8)))
    FROM s
  ),
  'jinye_reposted',
  j.user_id,
  j.id,
  j.created_at,
  'jinye_repost:' || j.user_id || ':' || j.repost_of_id
FROM jinye j
WHERE j.status = 'published'
  AND j.repost_of_id IS NOT NULL
  AND (j.quote_body IS NULL OR length(trim(j.quote_body)) = 0);
