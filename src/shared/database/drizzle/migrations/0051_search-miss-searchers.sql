-- Siapa saja yang sudah mencari istilah yang bermiss (37-api-activity-feed.md
-- `exclude_self`). Tabel terpisah, bukan kolom user_id di `search_misses`:
-- satu baris miss dipakai bersama semua orang yang mencari istilah sama.
CREATE TABLE `search_miss_searchers` (
	`id` text PRIMARY KEY NOT NULL,
	`search_miss_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`search_miss_id`) REFERENCES `search_misses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_miss_searchers_miss_user_unique` ON `search_miss_searchers` (`search_miss_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `search_miss_searchers_user_miss_idx` ON `search_miss_searchers` (`user_id`,`search_miss_id`);
