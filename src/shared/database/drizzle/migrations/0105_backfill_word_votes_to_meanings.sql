-- 0105: backfill ulang vote level kata -> vote makna, KHUSUS kata dengan
-- tepat 1 makna published. 0101 sudah pernah melakukannya sekali; migrasi
-- ini menutup sisa yang tidak ikut terjaring saat itu (makna baru dibuat /
-- baru published setelah 0101, kata yang tadinya 0 makna) dan aman
-- dijalankan berulang.
--
-- Vote kata multi-makna TIDAK disentuh: tidak ada cara memetakan satu vote
-- lama ke salah satu makna tanpa mengarang data. Baris itu tetap tampil
-- read-only di riwayat (`GET /api/v1/votes/history`).
--
-- ID baris baru: 10 char prefix waktu Crockford base32 + 16 hex acak (sama
-- dengan 0101) supaya riwayat `ORDER BY id DESC` tetap urut waktu.

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
-- Hapus vote kata yang sudah terwakili (jangan dobel di riwayat).
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
-- Ringkasan vote makna: recalculation penuh (idempoten) supaya baris hasil
-- backfill ikut terhitung di urutan deck. Tabel kecil, satu query.
INSERT INTO meaning_vote_counts (meaning_id, total, updated_at)
SELECT entity_id, COUNT(*), unixepoch()
FROM votes
WHERE entity_type = 'meaning'
GROUP BY entity_id
ON CONFLICT (meaning_id) DO UPDATE
SET total = excluded.total, updated_at = excluded.updated_at;
--> statement-breakpoint
-- Makna yang seluruh vote-nya hilang (mis. baris yatim pasca-backfill)
-- jangan menyisakan total basi > 0.
DELETE FROM meaning_vote_counts
WHERE NOT EXISTS (
  SELECT 1 FROM votes v
  WHERE v.entity_type = 'meaning' AND v.entity_id = meaning_vote_counts.meaning_id
);
