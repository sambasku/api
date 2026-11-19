CREATE TABLE `usaha_views` (
	`usaha_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`usaha_id`, `day`, `viewer_key`),
	FOREIGN KEY (`usaha_id`) REFERENCES `usahas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usaha_views_day_idx` ON `usaha_views` (`day`);