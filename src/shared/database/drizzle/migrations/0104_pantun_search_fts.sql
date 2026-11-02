-- FTS5 trigram untuk pencarian pantun (induk + balasan). Pola sama
-- words_search_fts (0069): kolom identitas UNINDEXED, trigram = substring
-- match + skor bm25. Satu tabel untuk dua owner supaya search cuma 1 query.
CREATE VIRTUAL TABLE IF NOT EXISTS `pantuns_search_fts` USING fts5(
	`text`,
	`owner_table` UNINDEXED,
	`owner_id` UNINDEXED,
	tokenize = 'trigram'
);
--> statement-breakpoint
-- Trigger pantuns -> FTS: tiap baris pantun jadi satu row index (json_each).
-- Hanya published (taken_down tidak boleh bocor ke hasil pencarian).
CREATE TRIGGER IF NOT EXISTS `pantuns_search_fts_ai`
AFTER INSERT ON `pantuns`
WHEN new.status = 'published'
BEGIN
	INSERT INTO pantuns_search_fts (text, owner_table, owner_id)
	SELECT je.value, 'pantun', new.id FROM json_each(new.lines) je;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `pantuns_search_fts_au`
AFTER UPDATE ON `pantuns`
BEGIN
	DELETE FROM pantuns_search_fts WHERE owner_id = new.id AND owner_table = 'pantun';
	INSERT INTO pantuns_search_fts (text, owner_table, owner_id)
	SELECT je.value, 'pantun', new.id FROM json_each(new.lines) je
	WHERE new.status = 'published';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `pantuns_search_fts_ad`
AFTER DELETE ON `pantuns`
BEGIN
	DELETE FROM pantuns_search_fts WHERE owner_id = old.id AND owner_table = 'pantun';
END;
--> statement-breakpoint
-- Trigger pantun_replies -> FTS (owner_table 'reply').
CREATE TRIGGER IF NOT EXISTS `pantun_replies_search_fts_ai`
AFTER INSERT ON `pantun_replies`
WHEN new.status = 'published'
BEGIN
	INSERT INTO pantuns_search_fts (text, owner_table, owner_id)
	SELECT je.value, 'reply', new.id FROM json_each(new.lines) je;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `pantun_replies_search_fts_au`
AFTER UPDATE ON `pantun_replies`
BEGIN
	DELETE FROM pantuns_search_fts WHERE owner_id = new.id AND owner_table = 'reply';
	INSERT INTO pantuns_search_fts (text, owner_table, owner_id)
	SELECT je.value, 'reply', new.id FROM json_each(new.lines) je
	WHERE new.status = 'published';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `pantun_replies_search_fts_ad`
AFTER DELETE ON `pantun_replies`
BEGIN
	DELETE FROM pantuns_search_fts WHERE owner_id = old.id AND owner_table = 'reply';
END;
--> statement-breakpoint
-- Backfill data lama: baris induk + balasan published.
INSERT INTO pantuns_search_fts (text, owner_table, owner_id)
SELECT je.value, 'pantun', p.id
FROM pantuns p, json_each(p.lines) je
WHERE p.status = 'published';
--> statement-breakpoint
INSERT INTO pantuns_search_fts (text, owner_table, owner_id)
SELECT je.value, 'reply', r.id
FROM pantun_replies r, json_each(r.lines) je
WHERE r.status = 'published';
