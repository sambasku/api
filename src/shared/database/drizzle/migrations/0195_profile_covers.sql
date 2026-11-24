CREATE TABLE `profile_covers` (
	`id` text PRIMARY KEY NOT NULL,
	`variant` text NOT NULL,
	`url` text NOT NULL,
	`file_id` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size_bytes` integer,
	`is_active` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`activated_at` integer
);
--> statement-breakpoint
CREATE INDEX `profile_covers_variant_created_idx` ON `profile_covers` (`variant`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_covers_variant_active_uidx` ON `profile_covers` (`variant`) WHERE is_active = 1;