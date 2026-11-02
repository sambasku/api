-- Komentar + foto (mobile#200 opsi B): teks tayang langsung;
-- foto staging ImageKit dengan image_status pending_review sampai approve.
ALTER TABLE `comments` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `image_provider` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `image_provider_file_id` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `image_public_url` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `image_status` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `image_content_warnings` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `image_reviewed_by` text REFERENCES `users`(`id`);--> statement-breakpoint
ALTER TABLE `comments` ADD `image_reviewed_at` integer;--> statement-breakpoint
CREATE INDEX `comments_image_status_idx` ON `comments` (`image_status`,`id`);
