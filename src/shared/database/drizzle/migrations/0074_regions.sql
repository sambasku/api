CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`parent_id` text,
	`code` text,
	`lat` real,
	`lng` real,
	`status` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `regions_type_idx` ON `regions` (`type`);
--> statement-breakpoint
CREATE INDEX `regions_parent_id_idx` ON `regions` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `regions_status_idx` ON `regions` (`status`);
--> statement-breakpoint
CREATE INDEX `regions_type_parent_idx` ON `regions` (`type`,`parent_id`);
--> statement-breakpoint
CREATE INDEX `regions_status_updated_at_idx` ON `regions` (`status`,`updated_at`);
