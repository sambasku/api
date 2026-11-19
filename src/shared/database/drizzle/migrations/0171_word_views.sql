-- G6: pembaca unik per lemma per hari WIB (mirror place_views / 0090).
CREATE TABLE `word_views` (
	`word_id` text NOT NULL,
	`day` text NOT NULL,
	`viewer_key` text NOT NULL,
	`count` integer NOT NULL DEFAULT 1,
	PRIMARY KEY(`word_id`, `day`, `viewer_key`),
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `word_views_day_idx` ON `word_views` (`day`);
