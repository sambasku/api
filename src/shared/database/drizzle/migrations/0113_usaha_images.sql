CREATE TABLE `usaha_images` (
	`id` text PRIMARY KEY NOT NULL,
	`usaha_id` text NOT NULL,
	`url` text NOT NULL,
	`is_main` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`attribution_json` text,
	`created_at` integer,
	`hidden_at` integer,
	FOREIGN KEY (`usaha_id`) REFERENCES `usahas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usaha_images_usaha_id_idx` ON `usaha_images` (`usaha_id`);
