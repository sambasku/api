-- Migration 0202: favorit stiker per user & custom stiker privat (#359).
ALTER TABLE `stickers` ADD `owner_user_id` text REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `stickers` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `stickers` ADD `visibility` text NOT NULL DEFAULT 'public';--> statement-breakpoint
ALTER TABLE `stickers` ADD `provider_file_id` text;--> statement-breakpoint
CREATE INDEX `stickers_owner_active_idx` ON `stickers` (`owner_user_id`,`created_at`) WHERE deleted_at is null;--> statement-breakpoint
CREATE TABLE `user_sticker_favorites` (
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`sticker_id` text NOT NULL REFERENCES `stickers`(`id`) ON DELETE cascade,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `sticker_id`)
);--> statement-breakpoint
CREATE INDEX `user_sticker_favorites_user_created_idx` ON `user_sticker_favorites` (`user_id`,`created_at`);
