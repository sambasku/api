CREATE TABLE `place_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `place_categories_status_idx` ON `place_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `place_categories_sort_idx` ON `place_categories` (`sort_order`);
--> statement-breakpoint
INSERT OR IGNORE INTO `place_categories` (`id`, `name`, `sort_order`, `status`, `created_at`) VALUES
	('wisata', 'Wisata', 0, 'published', unixepoch()),
	('kuliner', 'Kuliner', 1, 'published', unixepoch()),
	('budaya', 'Budaya', 2, 'published', unixepoch());
