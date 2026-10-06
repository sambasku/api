CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`actor_id` text,
	`target_word_id` text,
	`target_id` text,
	`occurred_at` integer NOT NULL,
	`hidden_at` integer,
	`dedupe_key` text,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_events_feed_idx` ON `activity_events` (`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `activity_events_actor_idx` ON `activity_events` (`actor_id`,`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `activity_events_word_idx` ON `activity_events` (`target_word_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_events_dedupe_idx` ON `activity_events` (`dedupe_key`);