ALTER TABLE `comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_word_parent_idx` ON `comments` (`word_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `comments_parent_created_idx` ON `comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `article_comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `article_comments_article_parent_idx` ON `article_comments` (`article_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `article_comments_parent_created_idx` ON `article_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `place_comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `place_comments_place_parent_idx` ON `place_comments` (`place_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `place_comments_parent_created_idx` ON `place_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `usaha_comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `usaha_comments_usaha_parent_idx` ON `usaha_comments` (`usaha_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `usaha_comments_parent_created_idx` ON `usaha_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `cuisine_comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cuisine_comments_cuisine_parent_idx` ON `cuisine_comments` (`cuisine_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cuisine_comments_parent_created_idx` ON `cuisine_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `event_comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `event_comments_event_parent_idx` ON `event_comments` (`event_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `event_comments_parent_created_idx` ON `event_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `karya_comments` ADD COLUMN `parent_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `karya_comments_karya_parent_idx` ON `karya_comments` (`karya_id`, `parent_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `karya_comments_parent_created_idx` ON `karya_comments` (`parent_id`, `created_at`, `id`);
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_url` text;
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_mime_type` text;
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_file_size` integer;
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_duration_ms` integer;
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_provider` text;
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_provider_file_id` text;
--> statement-breakpoint
ALTER TABLE `jinye_comments` ADD COLUMN `audio_sha` text;
