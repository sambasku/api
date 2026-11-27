CREATE TABLE IF NOT EXISTS `hot_viewed_slots` (
	`word_id` text PRIMARY KEY NOT NULL,
	`entered_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cooldown_until` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hot_viewed_slots_cooldown_idx` ON `hot_viewed_slots` (`cooldown_until`);
