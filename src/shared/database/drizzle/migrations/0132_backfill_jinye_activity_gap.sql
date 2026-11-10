-- 0132: isi ulang activity_events Jinye yang lolos dari 0131 / gagal append.
-- Idempoten lewat UNIQUE(dedupe_key). Juga isi payload beku bila masih null.

-- Original (bukan repost/quote).
INSERT OR IGNORE INTO activity_events (id, kind, actor_id, target_id, occurred_at, dedupe_key, payload)
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
  'jinye:' || j.id,
  CASE
    WHEN length(trim(j.body)) > 0 THEN 'Jinye : ' || substr(trim(j.body), 1, 120)
    WHEN j.images IS NOT NULL AND length(j.images) > 2 AND j.images != '[]' THEN 'Jinye : Foto'
    WHEN j.audio_url IS NOT NULL AND length(trim(j.audio_url)) > 0 THEN 'Jinye : Suara'
    ELSE 'Jinye'
  END
FROM jinye j
WHERE j.status = 'published'
  AND j.repost_of_id IS NULL;
--> statement-breakpoint

-- Quote-repost.
INSERT OR IGNORE INTO activity_events (id, kind, actor_id, target_id, occurred_at, dedupe_key, payload)
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
  'jinye_quote:' || j.id,
  CASE
    WHEN length(trim(COALESCE(j.quote_body, ''))) > 0
      THEN 'Jinye : ' || substr(trim(j.quote_body), 1, 120)
    ELSE 'Jinye'
  END
FROM jinye j
WHERE j.status = 'published'
  AND j.repost_of_id IS NOT NULL
  AND j.quote_body IS NOT NULL
  AND length(trim(j.quote_body)) > 0;
--> statement-breakpoint

-- Repost polos (dedupe = user + original, sama use-case).
INSERT OR IGNORE INTO activity_events (id, kind, actor_id, target_id, occurred_at, dedupe_key, payload)
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
  'jinye_repost:' || j.user_id || ':' || j.repost_of_id,
  'Membagikan ulang Jinye'
FROM jinye j
WHERE j.status = 'published'
  AND j.repost_of_id IS NOT NULL
  AND (j.quote_body IS NULL OR length(trim(j.quote_body)) = 0);
--> statement-breakpoint

-- Isi payload beku untuk baris 0131 yang masih null (feed copy).
UPDATE activity_events
SET payload = (
  SELECT
    CASE
      WHEN length(trim(j.body)) > 0 THEN 'Jinye : ' || substr(trim(j.body), 1, 120)
      WHEN j.images IS NOT NULL AND length(j.images) > 2 AND j.images != '[]' THEN 'Jinye : Foto'
      WHEN j.audio_url IS NOT NULL AND length(trim(j.audio_url)) > 0 THEN 'Jinye : Suara'
      ELSE 'Jinye'
    END
  FROM jinye j
  WHERE j.id = activity_events.target_id
)
WHERE kind = 'jinye_created'
  AND payload IS NULL
  AND target_id IS NOT NULL;
