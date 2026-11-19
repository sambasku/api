-- Jam/tanggal acara boleh kosong: starts_at & ends_at nullable.
-- DROP COLUMN gagal di SQLite: CHECK `events_ends_after_starts` masih merujuk
-- `events.starts_at` (error: no such column: events.starts_at).
-- Rebuild tabel; child FK (event_places/goings/images/comments) aman karena
-- drizzle/libsql migrate() menjalankan batch dengan foreign_keys=OFF.
CREATE TABLE `events_new` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category_id` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`location_text` text NOT NULL,
	`lat` real,
	`lng` real,
	`maps_url` text,
	`poster_urls` text DEFAULT '[]' NOT NULL,
	`organizer` text,
	`source_url` text,
	`source_type` text,
	`source_attribution` text,
	`region_id` text,
	`village_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`cancelled_at` integer,
	`published_at` integer,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `event_categories`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`ends_at` IS NULL OR `starts_at` IS NULL OR `ends_at` >= `starts_at`)
);--> statement-breakpoint
INSERT INTO `events_new` (
	`id`, `slug`, `name`, `description`, `category_id`,
	`starts_at`, `ends_at`, `location_text`, `lat`, `lng`, `maps_url`,
	`poster_urls`, `organizer`, `source_url`, `source_type`, `source_attribution`,
	`region_id`, `village_id`, `status`, `cancelled_at`, `published_at`,
	`author_id`, `created_at`, `updated_at`, `deleted_at`
)
SELECT
	`id`, `slug`, `name`, `description`, `category_id`,
	`starts_at`, `ends_at`, `location_text`, `lat`, `lng`, `maps_url`,
	`poster_urls`, `organizer`, `source_url`, `source_type`, `source_attribution`,
	`region_id`, `village_id`, `status`, `cancelled_at`, `published_at`,
	`author_id`, `created_at`, `updated_at`, `deleted_at`
FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `events_new` RENAME TO `events`;--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_uidx` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_category_idx` ON `events` (`category_id`);--> statement-breakpoint
CREATE INDEX `events_village_id_idx` ON `events` (`village_id`);--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`);--> statement-breakpoint
CREATE INDEX `events_starts_at_idx` ON `events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `events_status_starts_at_idx` ON `events` (`status`, `starts_at`);
