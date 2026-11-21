-- FTS5 trigram untuk pencarian layanan publik (nama layanan + alamat +
-- nama kecamatan). Pola sama pantuns_search_fts (0104): satu row index per
-- teks terindeks, owner_id UNINDEXED, trigram = substring match + bm25.
-- ponytail: rename kecamatan tidak meng-reindex layanan turunannya
-- (nama wilayah data seed statis); kalau rename jadi rutin, tambah
-- trigger AFTER UPDATE OF name ON regions.
CREATE VIRTUAL TABLE IF NOT EXISTS `layanans_search_fts` USING fts5(
`text`,
`owner_id` UNINDEXED,
tokenize = 'trigram'
);
--> statement-breakpoint
-- Trigger layanans FTS: indeks nama, alamat, dan nama kecamatan.
-- Hanya published (unpublished tidak boleh bocor ke pencarian).
CREATE TRIGGER IF NOT EXISTS `layanans_search_fts_ai`
AFTER INSERT ON `layanans`
WHEN new.publish_status = 'published'
BEGIN
INSERT INTO layanans_search_fts (text, owner_id)
SELECT x.text, new.id FROM (
SELECT new.name AS text
UNION ALL SELECT COALESCE(new.address_text, '')
UNION ALL SELECT r.name FROM regions r WHERE r.id = new.region_id
) x WHERE x.text <> '';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `layanans_search_fts_au`
AFTER UPDATE ON `layanans`
BEGIN
DELETE FROM layanans_search_fts WHERE owner_id = new.id;
INSERT INTO layanans_search_fts (text, owner_id)
SELECT x.text, new.id FROM (
SELECT new.name AS text
UNION ALL SELECT COALESCE(new.address_text, '')
UNION ALL SELECT r.name FROM regions r WHERE r.id = new.region_id
) x WHERE new.publish_status = 'published' AND x.text <> '';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `layanans_search_fts_ad`
AFTER DELETE ON `layanans`
BEGIN
DELETE FROM layanans_search_fts WHERE owner_id = old.id;
END;
--> statement-breakpoint
-- Backfill data lama.
INSERT INTO layanans_search_fts (text, owner_id)
SELECT l.name, l.id FROM layanans l
WHERE l.publish_status = 'published' AND l.name <> ''
UNION ALL
SELECT l.address_text, l.id FROM layanans l
WHERE l.publish_status = 'published' AND COALESCE(l.address_text, '') <> ''
UNION ALL
SELECT r.name, l.id FROM layanans l
INNER JOIN regions r ON r.id = l.region_id
WHERE l.publish_status = 'published' AND r.name <> '';
