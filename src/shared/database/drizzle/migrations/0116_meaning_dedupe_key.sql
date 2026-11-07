-- Sidik duplikat makna per kata. Kunci diisi aplikasi (bukan lower() SQL).
-- Null = tidak ada teks identitas. Banyak null tidak bentrok.
ALTER TABLE `meanings` ADD `dedupe_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `meanings_word_dedupe_key_uidx`
  ON `meanings` (`word_id`, `dedupe_key`)
  WHERE `deleted_at` IS NULL AND `dedupe_key` IS NOT NULL;
