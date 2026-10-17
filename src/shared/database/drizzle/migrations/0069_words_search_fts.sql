-- FTS5 trigram untuk pencarian kata (lemma + variasi + terjemahan).
-- Trigram = substring match semantik sama dengan LIKE '%q%' lama, plus
-- skor bm25 untuk ranking. Kolom word_id/kind UNINDEXED adalah identitas.
CREATE VIRTUAL TABLE IF NOT EXISTS `words_search_fts` USING fts5(
  `text`,
  `word_id` UNINDEXED,
  `kind` UNINDEXED,
  tokenize = 'trigram'
);
--> statement-breakpoint
-- Trigger sinkron words -> FTS (lemma). Hanya baris published (draft/pending
-- tidak boleh bocor ke index pencarian). UPDATE juga re-index lemma.
CREATE TRIGGER IF NOT EXISTS `words_search_fts_ai`
AFTER INSERT ON `words`
WHEN new.status = 'published'
BEGIN
  INSERT INTO words_search_fts (text, word_id, kind)
  VALUES (new.lemma, new.id, 'lemma');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `words_search_fts_au`
AFTER UPDATE ON `words`
WHEN new.status = 'published'
BEGIN
  DELETE FROM words_search_fts WHERE word_id = new.id AND kind = 'lemma';
  INSERT INTO words_search_fts (text, word_id, kind)
  VALUES (new.lemma, new.id, 'lemma');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `words_search_fts_ad`
AFTER DELETE ON `words`
BEGIN
  DELETE FROM words_search_fts WHERE word_id = old.id;
END;
--> statement-breakpoint
-- Trigger sinkron word_variants -> FTS (form). Varian soft-deleted tidak
-- diindex (repo lama juga memfilter deleted_at IS NULL).
CREATE TRIGGER IF NOT EXISTS `word_variants_fts_ai`
AFTER INSERT ON `word_variants`
BEGIN
  INSERT INTO words_search_fts (text, word_id, kind)
  VALUES (new.form, new.word_id, 'variant');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `word_variants_fts_ad`
AFTER DELETE ON `word_variants`
BEGIN
  DELETE FROM words_search_fts WHERE word_id = old.word_id AND kind = 'variant' AND text = old.form;
END;
--> statement-breakpoint
-- Trigger sinkron meaning_translations -> FTS (teks terjemahan). Hanya
-- terjemahan milik kata published; trigger WHEN mengecek via subquery.
CREATE TRIGGER IF NOT EXISTS `meaning_translations_fts_ai`
AFTER INSERT ON `meaning_translations`
WHEN (
  SELECT w.status FROM words w
  JOIN meanings m ON m.id = new.meaning_id
  WHERE w.id = m.word_id
) = 'published'
BEGIN
  INSERT INTO words_search_fts (text, word_id, kind)
  VALUES (new.translation_text,
          (SELECT m.word_id FROM meanings m WHERE m.id = new.meaning_id),
          'translation');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `meaning_translations_fts_ad`
AFTER DELETE ON `meaning_translations`
BEGIN
  DELETE FROM words_search_fts
  WHERE word_id = (SELECT m.word_id FROM meanings m WHERE m.id = old.meaning_id)
    AND kind = 'translation' AND text = old.translation_text;
END;
--> statement-breakpoint
-- Backfill data lama: lemma + variasi + terjemahan kata published.
INSERT INTO words_search_fts (text, word_id, kind)
SELECT lemma, id, 'lemma' FROM words WHERE status = 'published';
--> statement-breakpoint
INSERT INTO words_search_fts (text, word_id, kind)
SELECT form, word_id, 'variant' FROM word_variants WHERE deleted_at IS NULL;
--> statement-breakpoint
INSERT INTO words_search_fts (text, word_id, kind)
SELECT mt.translation_text, m.word_id, 'translation'
FROM meaning_translations mt
JOIN meanings m ON m.id = mt.meaning_id
JOIN words w ON w.id = m.word_id
WHERE w.status = 'published'
  AND mt.deleted_at IS NULL
  AND m.deleted_at IS NULL
  AND m.status = 'published'
  AND mt.translation_text <> '-';
