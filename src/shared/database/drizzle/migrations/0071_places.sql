CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`type` text,
	`lat` real,
	`lng` real,
	`maps_url` text,
	`short_description` text NOT NULL,
	`region_id` text,
	`hours` text,
	`contact` text,
	`author_id` text,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_slug_uidx` ON `places` (`slug`);
--> statement-breakpoint
CREATE INDEX `places_category_idx` ON `places` (`category`);
--> statement-breakpoint
CREATE INDEX `places_region_id_idx` ON `places` (`region_id`);
--> statement-breakpoint
CREATE INDEX `places_status_idx` ON `places` (`status`);
--> statement-breakpoint
CREATE INDEX `places_status_updated_at_idx` ON `places` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `place_images` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`url` text NOT NULL,
	`is_main` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`attribution_json` text,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `place_images_place_id_idx` ON `place_images` (`place_id`);
