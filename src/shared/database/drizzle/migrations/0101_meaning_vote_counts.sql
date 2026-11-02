-- Vote deck per makna: deck + tulis vote pindah dari level kata ke level
-- makna (1 kartu = 1 makna). Backfill: HANYA kata dengan tepat 1 makna
-- published - vote-nya bisa dipindahkan tanpa ambigu. Vote kata multi-makna
-- DIBIARKAN (riwayat my-votes tetap tampil, read-path baru mengabaikannya).

-- 1. Backfill vote makna dari vote kata (kata 1-makna published).
-- ID baris baru harus 26 char DAN urut waktu (ULID-ish): 10 char prefix
-- waktu Crockford base32 + 16 hex acak. Tanpa prefix waktu, riwayat
-- `/votes/my` (ORDER BY id DESC) jadi acak untuk baris hasil backfill.
INSERT INTO votes (id, user_id, entity_type, entity_id, value, client_id, created_at, updated_at)
SELECT
  (
    WITH alphabet(a) AS (
      SELECT '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    ), s(ms) AS (SELECT CAST(v.created_at AS INTEGER) * 1000)
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
  v.user_id,
  'meaning',
  m.id,
  v.value,
  v.client_id,
  v.created_at,
  v.updated_at
FROM votes v
JOIN words w ON w.id = v.entity_id AND w.deleted_at IS NULL
JOIN meanings m
  ON m.word_id = w.id
 AND m.deleted_at IS NULL
 AND m.status = 'published'
WHERE v.entity_type = 'word'
  AND (
    SELECT count(*)
    FROM meanings m2
    WHERE m2.word_id = w.id
      AND m2.deleted_at IS NULL
      AND m2.status = 'published'
  ) = 1
  AND NOT EXISTS (
    SELECT 1 FROM votes vm
    WHERE vm.user_id = v.user_id
      AND vm.entity_type = 'meaning'
      AND vm.entity_id = m.id
  );
--> statement-breakpoint
-- 2. Hapus vote kata yang sudah ter-wakili vote makna hasil backfill.
DELETE FROM votes
WHERE entity_type = 'word'
  AND EXISTS (
    SELECT 1
    FROM meanings m
    JOIN votes vm
      ON vm.entity_type = 'meaning'
     AND vm.entity_id = m.id
     AND vm.user_id = votes.user_id
    WHERE m.word_id = votes.entity_id
      AND m.deleted_at IS NULL
      AND m.status = 'published'
      AND (
        SELECT count(*)
        FROM meanings m2
        WHERE m2.word_id = m.word_id
          AND m2.deleted_at IS NULL
          AND m2.status = 'published'
      ) = 1
  );
--> statement-breakpoint
-- 3. Ringkasan vote makna (pengganti word_vote_counts untuk sort deck).
CREATE TABLE `meaning_vote_counts` (
`meaning_id` text PRIMARY KEY NOT NULL,
`total` integer NOT NULL DEFAULT 0,
`updated_at` integer NOT NULL,
FOREIGN KEY (`meaning_id`) REFERENCES `meanings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meaning_vote_counts_total_idx` ON `meaning_vote_counts` (`total`,`meaning_id`);
--> statement-breakpoint
INSERT INTO `meaning_vote_counts` (`meaning_id`, `total`, `updated_at`)
SELECT `entity_id`, COUNT(*), unixepoch()
FROM `votes`
WHERE `entity_type` = 'meaning'
GROUP BY `entity_id`;
--> statement-breakpoint
-- 4. Ringkasan kata pensiun (deck sort kini pakai meaning_vote_counts).
DROP TABLE IF EXISTS `word_vote_counts`;
