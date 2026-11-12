-- #253: laporan per-makna (meaning_id) + unique open report per target.
ALTER TABLE `word_reports` ADD `meaning_id` text REFERENCES `meanings`(`id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `word_reports_open_user_word_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `word_reports_open_user_word_image_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `word_reports_open_user_word_idx` ON `word_reports` (`word_id`,`user_id`) WHERE `status` = 'open' AND `image_id` IS NULL AND `meaning_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `word_reports_open_user_word_image_idx` ON `word_reports` (`word_id`,`user_id`,`image_id`) WHERE `status` = 'open' AND `image_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `word_reports_open_user_word_meaning_idx` ON `word_reports` (`word_id`,`user_id`,`meaning_id`) WHERE `status` = 'open' AND `meaning_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `word_reports_meaning_id_idx` ON `word_reports` (`meaning_id`);
