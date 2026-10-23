-- Optimasi rows-read (lanjutan 0083): examples adalah satu-satunya child
-- table detail kata TANPA index meaning_id - query batch findDetailById
-- (WHERE meaning_id IN (...) AND deleted_at IS NULL) full scan setiap
-- GET /words/:id dan /words/lemma/:lemma. Partial index: hanya baris aktif.
CREATE INDEX `examples_meaning_idx` ON `examples` (`meaning_id`) WHERE `examples`.`deleted_at` IS NULL;
