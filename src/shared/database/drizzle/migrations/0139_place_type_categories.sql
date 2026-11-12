-- Refactor tipe wisata (places.type) ke kategori baru:
-- sejarah | alam | religi | tirta | agro | bahari | budaya.
-- Kolom text tanpa CHECK, jadi cukup remap data lama:
--   pantai  -> bahari (wisata bahari)
--   belanja -> NULL   (tipe belanja dihapus)
UPDATE `places` SET `type` = 'bahari' WHERE `type` = 'pantai';
--> statement-breakpoint
UPDATE `places` SET `type` = NULL WHERE `type` = 'belanja';
--> statement-breakpoint
-- Usulan pending/approved/rejected simpan type di payload_json (json1).
UPDATE `place_contributions`
SET `payload_json` = json_set(`payload_json`, '$.type', 'bahari')
WHERE json_extract(`payload_json`, '$.type') = 'pantai';
--> statement-breakpoint
UPDATE `place_contributions`
SET `payload_json` = json_set(`payload_json`, '$.type', NULL)
WHERE json_extract(`payload_json`, '$.type') = 'belanja';
