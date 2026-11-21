CREATE TABLE `cuisine_views` (
	`cuisine_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`cuisine_id`, `day`, `viewer_key`),
	FOREIGN KEY (`cuisine_id`) REFERENCES `cuisines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cuisine_views_day_idx` ON `cuisine_views` (`day`);