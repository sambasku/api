CREATE TABLE `karya_views` (
	`karya_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`karya_id`, `day`, `viewer_key`),
	FOREIGN KEY (`karya_id`) REFERENCES `karyas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `karya_views_day_idx` ON `karya_views` (`day`);
--> statement-breakpoint
CREATE TABLE `layanan_views` (
	`layanan_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`layanan_id`, `day`, `viewer_key`),
	FOREIGN KEY (`layanan_id`) REFERENCES `layanans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `layanan_views_day_idx` ON `layanan_views` (`day`);