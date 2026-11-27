-- Migration 0201: asal foto lemma (promote foto Jinye, mobile#336).
-- source_reference = `<jinyeId>:<providerFileId foto Jinye>`.
ALTER TABLE `word_images` ADD `source_type` text;--> statement-breakpoint
ALTER TABLE `word_images` ADD `source_reference` text;--> statement-breakpoint
CREATE UNIQUE INDEX `word_images_source_uidx` ON `word_images` (`word_id`,`source_type`,`source_reference`) WHERE source_type IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `word_images_source_ref_idx` ON `word_images` (`source_type`,`source_reference`);
