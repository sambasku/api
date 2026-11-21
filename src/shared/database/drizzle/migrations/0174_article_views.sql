CREATE TABLE `article_views` (
	`article_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`article_id`, `day`, `viewer_key`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_views_day_idx` ON `article_views` (`day`);